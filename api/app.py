"""
Flask REST API — exposes pipeline control and knowledge-base querying.

Endpoints
---------
GET  /health                  → service health check
GET  /status                  → scheduler + DB + FAISS stats
GET  /topics                  → list configured topics
GET  /stats                   → DB aggregate counts
GET  /articles?topic=&limit=  → list articles for a topic

POST /query                   → RAG: question → grounded answer + sources
POST /retrieve                → semantic retrieval only (no LLM)

POST /pipeline/run            → trigger full ingestion (optional body: {"topics":[…]})
POST /pipeline/embed          → trigger embedding update
POST /pipeline/cleanup        → trigger outdated-article cleanup
"""

from datetime import datetime
from functools import wraps
from typing import Any

import queue
import threading
import json
from flask import Flask, Response, jsonify, request, stream_with_context
from flask_cors import CORS

from utils.logger import get_logger
from utils.redis_client import redis_client
from storage.db import Article

logger = get_logger(__name__)

# Module-level singletons — injected by create_app()
_orchestrator = None
_rag          = None
_db           = None
_risk_desk_engine = None
_podcast_engine   = None
_dossier_engine   = None
_event_queue  = queue.Queue(maxsize=100) # For real-time SSE


# ── Response helpers ──────────────────────────────────────────────────────────

def _ok(data: Any, status: int = 200) -> Response:
    return jsonify({
        "status":    "success",
        "data":      data,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }), status


def _err(message: str, status: int = 400) -> Response:
    return jsonify({
        "status":    "error",
        "message":   message,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }), status


# ── Guard decorators ──────────────────────────────────────────────────────────

def _need_rag(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if _rag is None:
            return _err("RAG system not initialised.", 503)
        return f(*args, **kwargs)
    return wrapper


def _need_db(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if _db is None:
            return _err("Database not initialised.", 503)
        return f(*args, **kwargs)
    return wrapper


def _need_pipeline(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if _orchestrator is None:
            return _err("Pipeline not initialised.", 503)
        return f(*args, **kwargs)
    return wrapper


def _need_dossiers(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if _dossier_engine is None:
            return _err("Dossier engine not initialised.", 503)
        return f(*args, **kwargs)
    return wrapper


# ── App factory ───────────────────────────────────────────────────────────────

def create_app(config: dict, orchestrator, rag, db) -> Flask:
    """
    Create and configure the Flask application.

    Injects shared component singletons so every endpoint can reach them
    without violating the module boundary.
    """
    global _orchestrator, _rag, _db, _risk_desk_engine, _podcast_engine, _dossier_engine
    _orchestrator = orchestrator
    _rag          = rag
    _db           = db

    from processing.risk_desk import RiskDeskEngine
    from processing.podcast_briefing import PodcastBriefingEngine
    from processing.dossier import DossierEngine
    _risk_desk_engine = RiskDeskEngine(_db)
    _podcast_engine   = PodcastBriefingEngine(_db)
    _dossier_engine   = DossierEngine(_db)

    # Register event callback for real-time tracking
    if _orchestrator:
        _orchestrator.on_event = lambda e: _event_queue.put(e) if not _event_queue.full() else None

    app = Flask(__name__)
    CORS(app, resources={r"/*": {"origins": "*"}})

    # ── Health / Info ─────────────────────────────────────────

    @app.route("/health", methods=["GET"])
    def health():
        """Liveness probe."""
        return _ok({"service": "WebMining ML Pipeline", "healthy": True})

    @app.route("/telemetry", methods=["GET"])
    def telemetry():
        """
        Hardware and pipeline telemetry: CPU, RAM, active jobs, pipeline state.
        """
        import psutil
        
        cpu = psutil.cpu_percent(interval=0.1)
        ram = psutil.virtual_memory()
        
        jobs = []
        if _orchestrator:
            for job in _orchestrator.scheduler.get_jobs():
                jobs.append({
                    "id": job.id,
                    "name": job.name,
                    "next_run": job.next_run_time.isoformat() if job.next_run_time else None
                })
                
        return _ok({
            "hardware": {
                "cpu_percent": cpu,
                "ram_percent": ram.percent,
                "ram_used_gb": round(ram.used / (1024**3), 2),
                "ram_total_gb": round(ram.total / (1024**3), 2),
            },
            "pipeline": {
                "active_jobs": jobs,
                "models_loaded": ["all-MiniLM-L6-v2", "sshleifer/distilbart-cnn-12-6", "VADER Sentiment"],
                "data_sources": ["NewsAPI", "RSS", "Wikipedia", "Reddit", "HackerNews", "ArXiv", "Yahoo Finance"],
            }
        })

    @app.route("/status", methods=["GET"])
    @_need_pipeline
    def status():
        """Full system status: scheduler jobs, DB counts, FAISS index size."""
        return _ok(_orchestrator.get_status())

    @app.route("/topics", methods=["GET"])
    @_need_pipeline
    def topics():
        """Return the list of configured crawl topics."""
        return _ok({"topics": _orchestrator.topics})

    @app.route("/stats", methods=["GET"])
    @_need_db
    def stats():
        """DB aggregate statistics."""
        return _ok(_db.get_stats())

    @app.route("/stats/entities", methods=["GET"])
    @_need_db
    def stats_entities():
        """
        Aggregate top entities (PERSON, ORG) from recent articles.
        Returns a leaderboard sorted by frequency and average sentiment.
        """
        from collections import defaultdict
        
        limit_days = int(request.args.get("days", 3))
        
        # Get recent articles
        with _db.SessionFactory() as session:
            from storage.db import Article
            from datetime import datetime, timedelta
            cutoff = datetime.utcnow() - timedelta(days=limit_days)
            
            articles = (
                session.query(Article)
                .filter(Article.is_relevant == True, Article.created_at >= cutoff)
                .all()
            )
            
        people_stats = defaultdict(lambda: {"count": 0, "sentiment_sum": 0.0})
        org_stats = defaultdict(lambda: {"count": 0, "sentiment_sum": 0.0})
        
        for art in articles:
            meta = art.meta or {}
            entities = meta.get("entities", {})
            sentiment = art.sentiment_score or 0.0
            
            for person in entities.get("PERSON", []):
                people_stats[person]["count"] += 1
                people_stats[person]["sentiment_sum"] += sentiment
                
            for org in entities.get("ORG", []):
                org_stats[org]["count"] += 1
                org_stats[org]["sentiment_sum"] += sentiment
                
        def format_stats(stats_dict, top_n=10):
            lst = []
            for name, data in stats_dict.items():
                lst.append({
                    "name": name,
                    "mentions": data["count"],
                    "avg_sentiment": round(data["sentiment_sum"] / data["count"], 2)
                })
            return sorted(lst, key=lambda x: x["mentions"], reverse=True)[:top_n]

        return _ok({
            "people": format_stats(people_stats),
            "organizations": format_stats(org_stats)
        })

    @app.route("/stats/finance/correlation", methods=["GET"])
    @_need_db
    def finance_correlation():
        """
        Phase 3: Financial Market Sentiment Correlation
        Returns historical sentiment for a target company mapped against (mocked) stock prices.
        """
        from datetime import datetime, timedelta
        company = request.args.get("company", "NVIDIA").strip()
        days = int(request.args.get("days", 7))
        
        # In a real production system, you would call Yahoo Finance or Alpaca API here.
        # For Phase 3 implementation, we generate dynamic mock stock data that roughly correlates with our DB sentiment.
        
        # 1. Fetch recent articles mentioning the company
        with _db.SessionFactory() as session:
            from storage.db import Article
            cutoff = datetime.utcnow() - timedelta(days=days)
            articles = (
                session.query(Article)
                .filter(Article.is_relevant == True, Article.created_at >= cutoff)
                .all()
            )
            
        # Group sentiment by day
        from collections import defaultdict
        daily_sentiment = defaultdict(list)
        
        for art in articles:
            meta = art.meta or {}
            entities = meta.get("entities", {})
            orgs = entities.get("ORG", [])
            # Only consider articles where the company is mentioned
            if any(company.lower() in o.lower() for o in orgs):
                day_str = art.created_at.strftime("%Y-%m-%d") if art.created_at else "Unknown"
                daily_sentiment[day_str].append(art.sentiment_score or 0.0)
                
        # 2. Build time series
        timeline = []
        import random
        random.seed(len(company)) # Deterministic baseline
        
        base_price = 100.0
        if company.lower() == "nvidia": base_price = 900.0
        if company.lower() == "apple": base_price = 170.0
        if company.lower() == "microsoft": base_price = 400.0
        
        current_price = base_price
        
        for i in range(days, -1, -1):
            date_obj = datetime.utcnow() - timedelta(days=i)
            day_str = date_obj.strftime("%Y-%m-%d")
            
            # Avg sentiment
            scores = daily_sentiment.get(day_str, [])
            avg_sent = sum(scores) / len(scores) if scores else 0.0
            
            # Calculate mock price shift based heavily on AI sentiment + some noise
            shift = (avg_sent * 0.05) + (random.uniform(-0.01, 0.01))
            current_price = current_price * (1 + shift)
            
            timeline.append({
                "date": date_obj.strftime("%b %d"),
                "sentiment": round(avg_sent, 2),
                "mentions": len(scores),
                "stock_price": round(current_price, 2)
            })
            
        return _ok({
            "company": company,
            "timeline": timeline
        })

    @app.route("/stats/knowledge-graph", methods=["GET"])
    @_need_db
    def knowledge_graph():
        """
        Phase 4: Entity Knowledge Graph (Enhanced with Drill-down)
        Builds a force-directed graph of entity co-occurrence relationships.
        If 'focus' is provided, builds a star graph around that entity, connecting it to categories and other co-occurring entities.
        """
        from datetime import datetime, timedelta
        from collections import defaultdict
        from api.entity_db import ENTITY_DB

        days = int(request.args.get("days", 7))
        topic_filter = request.args.get("topic", "").strip()
        focus = request.args.get("focus", "").strip()

        with _db.SessionFactory() as session:
            from storage.db import Article
            cutoff = datetime.utcnow() - timedelta(days=days)
            q = session.query(Article).filter(
                Article.is_relevant == True,
                Article.created_at >= cutoff
            )
            if topic_filter:
                q = q.filter(Article.topic == topic_filter)
            articles = q.all()

        node_counts = defaultdict(lambda: {"count": 0, "type": "ORG", "sentiment_sum": 0.0})
        edge_counts = defaultdict(int)

        if not focus:
            # --- MAIN GRAPH (No Focus) ---
            for art in articles:
                meta = art.meta or {}
                entities = meta.get("entities", {})
                sentiment = art.sentiment_score or 0.0

                all_ents = []
                for etype in ["PERSON", "ORG", "GPE"]:
                    for name in entities.get(etype, []):
                        if len(name) > 2:
                            # Prefer entity_db type if exists
                            db_type = ENTITY_DB.get(name, {}).get("type", etype)
                            all_ents.append((name, db_type))
                            node_counts[name]["count"] += 1
                            node_counts[name]["type"] = db_type
                            node_counts[name]["sentiment_sum"] += sentiment

                for i in range(len(all_ents)):
                    for j in range(i + 1, len(all_ents)):
                        n1, n2 = sorted([all_ents[i][0], all_ents[j][0]])
                        edge_counts[(n1, n2)] += 1

            # Keep top nodes, but explicitly inject ones from ENTITY_DB if they appear at all
            # Inject ALL ENTITY_DB keys even if 0 mentions
            for db_key, db_val in ENTITY_DB.items():
                if db_key not in node_counts:
                    node_counts[db_key]["count"] = 0
                    node_counts[db_key]["type"] = db_val.get("type", "ORG")
                    node_counts[db_key]["sentiment_sum"] = 0.0

            top_nodes_sorted = sorted(node_counts.items(), key=lambda x: x[1]["count"], reverse=True)
            
            # Take all DB nodes, then pad with top organic nodes
            db_nodes = [(n, d) for n, d in top_nodes_sorted if n in ENTITY_DB]
            other_nodes = [(n, d) for n, d in top_nodes_sorted if n not in ENTITY_DB][:20]
            final_nodes = db_nodes + other_nodes
            top_node_ids = {name for name, _ in final_nodes}

            nodes = []
            for name, data in final_nodes:
                val = min(max(data["count"] * 3, 10), 30)
                if name in ENTITY_DB: val = max(val, 15) # Ensure db entities are visible
                nodes.append({
                    "id": name, "label": name, "type": data["type"],
                    "val": val, "mentions": data["count"],
                    "avg_sentiment": round(data["sentiment_sum"] / max(data["count"], 1), 2),
                    "has_details": name in ENTITY_DB
                })

            links = []
            
            # 1. Real organic connections from news articles
            for (n1, n2), count in edge_counts.items():
                if n1 in top_node_ids and n2 in top_node_ids and count >= 1:
                    links.append({"source": n1, "target": n2, "value": count})
            links = sorted(links, key=lambda x: x["value"], reverse=True)[:80]

            # 2. Create logical connections between entities
            for key, val in ENTITY_DB.items():
                # Connect Person to Companies
                if val.get("type") == "PERSON":
                    for comp in val.get("companies", []):
                        if comp in top_node_ids:
                            links.append({"source": key, "target": comp, "value": 3})
                # Connect Org to CEO
                ceo = val.get("ceo", "")
                for other_key in top_node_ids:
                    if ENTITY_DB.get(other_key, {}).get("type") == "PERSON" and other_key in ceo:
                        links.append({"source": key, "target": other_key, "value": 3})

            # To ensure the graph forms a single connected component and doesn't fly apart,
            # add a central visible gravity node "Current Affairs"
            nodes.append({
                "id": "Current Affairs", "label": "Current Affairs", "type": "CATEGORY", 
                "val": 80, "mentions": 0, "avg_sentiment": 0, "has_details": False
            })
            for key in top_node_ids:
                if key != "Current Affairs":
                    links.append({"source": key, "target": "Current Affairs", "value": 0.5, "is_category": True})

            return _ok({"nodes": nodes, "links": links, "article_count": len(articles)})

        else:
            # --- DRILL-DOWN GRAPH (Focused on one entity) ---
            focus_info = ENTITY_DB.get(focus)
            if not focus_info:
                # Fallback if focus is not in DB but clicked
                focus_info = {"type": "ORG", "categories": ["Related"], "services": []}

            nodes = [{
                "id": focus, "label": focus, "type": focus_info["type"],
                "val": 40, "mentions": 0, "avg_sentiment": 0.0,
                "is_focus": True
            }]
            links = []

            # Add Category nodes
            for cat in focus_info.get("categories", []):
                cat_id = f"cat_{cat}"
                nodes.append({"id": cat_id, "label": cat, "type": "CATEGORY", "val": 15})
                links.append({"source": focus, "target": cat_id, "value": 5, "is_category": True})

            # Find related entities from articles mentioning the focus
            related_counts = defaultdict(lambda: {"count": 0, "type": "ORG", "sentiment_sum": 0.0})
            focus_mentions = 0
            focus_sentiment_sum = 0.0

            for art in articles:
                meta = art.meta or {}
                entities = meta.get("entities", {})
                sentiment = art.sentiment_score or 0.0
                all_ents_in_art = []
                for etype in ["PERSON", "ORG", "GPE"]:
                    all_ents_in_art.extend([(n, etype) for n in entities.get(etype, []) if len(n) > 2])
                
                art_names = [n for n, _ in all_ents_in_art]
                if focus in art_names:
                    focus_mentions += 1
                    focus_sentiment_sum += sentiment
                    for name, etype in all_ents_in_art:
                        if name != focus:
                            db_type = ENTITY_DB.get(name, {}).get("type", etype)
                            related_counts[name]["count"] += 1
                            related_counts[name]["type"] = db_type
                            related_counts[name]["sentiment_sum"] += sentiment

            nodes[0]["mentions"] = focus_mentions
            nodes[0]["avg_sentiment"] = round(focus_sentiment_sum / max(focus_mentions, 1), 2)

            top_related = sorted(related_counts.items(), key=lambda x: x[1]["count"], reverse=True)[:15]
            for name, data in top_related:
                # Attach related entities to the categories to make it look like a neural net
                cats = ENTITY_DB.get(name, {}).get("categories", ["Related"])
                target_cat = f"cat_{cats[0]}" if cats[0] in focus_info.get("categories", []) else f"cat_{focus_info.get('categories', ['Related'])[0]}"
                
                nodes.append({
                    "id": name, "label": name, "type": data["type"],
                    "val": min(data["count"] * 2 + 5, 20), "mentions": data["count"],
                    "avg_sentiment": round(data["sentiment_sum"] / max(data["count"], 1), 2),
                    "has_details": name in ENTITY_DB
                })
                links.append({"source": target_cat, "target": name, "value": min(data["count"], 5)})

            return _ok({"nodes": nodes, "links": links, "article_count": len(articles)})

    @app.route("/stats/entity/details", methods=["GET"])
    @_need_db
    def entity_details():
        """
        Phase 4: Entity Details & Real-time News
        Returns static metadata + dynamic recent articles & summaries for a given entity.
        """
        from datetime import datetime, timedelta
        from api.entity_db import ENTITY_DB

        name = request.args.get("name")
        if not name:
            return _err("Missing name")

        info = ENTITY_DB.get(name)
        
        with _db.SessionFactory() as session:
            from storage.db import Article
            cutoff = datetime.utcnow() - timedelta(days=7) # Only last week
            articles = session.query(Article).filter(
                Article.is_relevant == True,
                Article.created_at >= cutoff
            ).order_by(Article.published_at.desc()).all()

            # Filter in Python based on JSON metadata
            related_articles = []
            for art in articles:
                meta = art.meta or {}
                entities = meta.get("entities", {})
                all_ents = entities.get("ORG", []) + entities.get("PERSON", []) + entities.get("GPE", [])
                if name in all_ents:
                    related_articles.append({
                        "id": art.id,
                        "title": art.title,
                        "source": art.source,
                        "url": art.url,
                        "published_at": art.published_at.isoformat() if art.published_at else None,
                        "sentiment": art.sentiment_score,
                        "summary": art.summary
                    })
                    if len(related_articles) >= 10: # limit to 10 news items
                        break

        return _ok({
            "entity": name,
            "metadata": info,
            "news": related_articles
        })

    @app.route("/stats/alerts", methods=["GET"])
    @_need_db
    def get_alerts():
        """
        Phase 5: Proactive Alerting
        Returns recent alerts generated by the system based on sentiment spikes and mention velocity.
        """
        from datetime import datetime, timedelta
        from api.entity_db import ENTITY_DB
        from collections import defaultdict
        
        with _db.SessionFactory() as session:
            from storage.db import Article
            cutoff = datetime.utcnow() - timedelta(days=3)
            articles = session.query(Article).filter(
                Article.is_relevant == True,
                Article.created_at >= cutoff
            ).all()

            # Analyze entity mentions and sentiment
            entity_stats = defaultdict(lambda: {"count": 0, "sentiment_sum": 0.0})
            
            for art in articles:
                meta = art.meta or {}
                entities = meta.get("entities", {})
                all_ents = entities.get("ORG", []) + entities.get("PERSON", []) + entities.get("GPE", [])
                sentiment = art.sentiment_score or 0.0
                
                # unique entities per article
                for ent in set(all_ents):
                    if ent in ENTITY_DB:  # Only alert for known DB entities
                        entity_stats[ent]["count"] += 1
                        entity_stats[ent]["sentiment_sum"] += sentiment

            alerts = []
            alert_id = 1
            
            for ent, stats in entity_stats.items():
                count = stats["count"]
                avg_sentiment = stats["sentiment_sum"] / max(count, 1)
                
                if count >= 3:
                    if avg_sentiment <= -0.4:
                        alerts.append({
                            "id": alert_id,
                            "type": "CRITICAL",
                            "entity": ent,
                            "message": f"Negative sentiment spike detected ({avg_sentiment:.2f}) across {count} recent mentions.",
                            "timestamp": datetime.utcnow().isoformat() + "Z"
                        })
                        alert_id += 1
                    elif avg_sentiment >= 0.5:
                        alerts.append({
                            "id": alert_id,
                            "type": "POSITIVE",
                            "entity": ent,
                            "message": f"Highly positive sentiment trend ({avg_sentiment:.2f}) driven by {count} articles.",
                            "timestamp": datetime.utcnow().isoformat() + "Z"
                        })
                        alert_id += 1
                    elif count >= 10:
                        alerts.append({
                            "id": alert_id,
                            "type": "VELOCITY",
                            "entity": ent,
                            "message": f"High mention velocity: {count} mentions in the last 72 hours.",
                            "timestamp": datetime.utcnow().isoformat() + "Z"
                        })
                        alert_id += 1
                        
            # Sort alerts by severity
            alerts = sorted(alerts, key=lambda x: {"CRITICAL": 0, "VELOCITY": 1, "POSITIVE": 2}.get(x["type"], 3))
            
            return _ok({"alerts": alerts})

    @app.route("/predictive/trends", methods=["GET"])
    @_need_db
    def get_predictive_trends():
        """
        Phase 6: Neural Sentiment Forecasting
        Calculates momentum and projected trends for top entities.
        """
        from datetime import datetime, timedelta
        from api.entity_db import ENTITY_DB
        from collections import defaultdict
        import math

        with _db.SessionFactory() as session:
            from storage.db import Article
            # Look at last 7 days for trend analysis
            cutoff = datetime.utcnow() - timedelta(days=7)
            articles = session.query(Article).filter(
                Article.is_relevant == True,
                Article.created_at >= cutoff
            ).all()

            # entity -> day_index (0-6) -> stats
            daily_stats = defaultdict(lambda: defaultdict(lambda: {"count": 0, "sentiment_sum": 0.0}))
            
            for art in articles:
                days_ago = (datetime.utcnow() - art.created_at).days
                if days_ago > 6: continue
                
                meta = art.meta or {}
                entities = meta.get("entities", {})
                all_ents = set(entities.get("ORG", []) + entities.get("PERSON", []))
                
                for ent in all_ents:
                    if len(ent) < 3: continue
                    daily_stats[ent][days_ago]["count"] += 1
                    daily_stats[ent][days_ago]["sentiment_sum"] += (art.sentiment_score or 0.0)

            predictions = []
            for ent, timeline in daily_stats.items():
                # Calculate momentum (comparing last 3 days vs previous 4 days)
                recent_count = sum(timeline[i]["count"] for i in range(3))
                older_count = sum(timeline[i]["count"] for i in range(3, 7))
                
                recent_sent = sum(timeline[i]["sentiment_sum"] for i in range(3)) / max(recent_count, 1)
                older_sent = sum(timeline[i]["sentiment_sum"] for i in range(3, 7)) / max(older_count, 1)
                
                sentiment_momentum = recent_sent - older_sent
                velocity_score = (recent_count / 3.0) / (max(older_count, 1) / 4.0) if older_count > 0 else recent_count
                
                # Simple projection
                projected_sentiment = recent_sent + (sentiment_momentum * 0.5)
                projected_sentiment = max(-1.0, min(1.0, projected_sentiment))
                
                predictions.append({
                    "entity": ent,
                    "current_sentiment": round(recent_sent, 2),
                    "momentum": round(sentiment_momentum, 2),
                    "velocity": round(velocity_score, 2),
                    "projected_sentiment": round(projected_sentiment, 2),
                    "trend": "UP" if sentiment_momentum > 0.1 else "DOWN" if sentiment_momentum < -0.1 else "STABLE",
                    "confidence": min(100, (recent_count + older_count) * 5)
                })

            # Sort by velocity and momentum
            predictions = sorted(predictions, key=lambda x: (x["velocity"], abs(x["momentum"])), reverse=True)[:10]
            
            return _ok({"predictions": predictions})

    @app.route("/predictive/risk-desk", methods=["GET"])
    @_need_db
    def get_predictive_risk_desk():
        topic = request.args.get("topic", "").strip()
        force_refresh = request.args.get("refresh", "").lower() == "true"
        
        try:
            forecast = _risk_desk_engine.generate_risk_forecast(topic, force_refresh)
            return _ok(forecast)
        except Exception as e:
            logger.error(f"Failed to generate risk forecast: {e}")
            return _err(f"Failed to generate risk forecast: {str(e)}", 500)

    @app.route("/briefing/info", methods=["GET"])
    @_need_db
    def get_briefing_info():
        import os
        from datetime import datetime
        output_dir = os.path.join(app.root_path, "..", "frontend", "public", "audio")
        output_path = os.path.join(output_dir, "briefing.mp3")
        exists = os.path.exists(output_path)
        
        if exists:
            return _ok({
                "exists": True,
                "url": "http://localhost:3000/audio/briefing.mp3",
                "size_bytes": os.path.getsize(output_path),
                "last_synthesized": datetime.fromtimestamp(os.path.getmtime(output_path)).isoformat() + "Z"
            })
        else:
            return _ok({
                "exists": False,
                "url": None,
                "size_bytes": 0,
                "last_synthesized": None
            })

    @app.route("/briefing/synthesize", methods=["POST"])
    @_need_db
    def trigger_briefing_synthesis():
        import os
        try:
            # 1. Generate script
            data = _podcast_engine.generate_briefing_script()
            script = data["script"]
            stories = data["stories"]
            
            # 2. Synthesize to public/audio/briefing.mp3
            output_dir = os.path.join(app.root_path, "..", "frontend", "public", "audio")
            output_path = os.path.join(output_dir, "briefing.mp3")
            
            success = _podcast_engine.synthesize_briefing_audio(script, output_path)
            if not success:
                return _err("TTS audio synthesis failed.", 500)
                
            return _ok({
                "message": "Daily briefing successfully synthesized.",
                "script": script,
                "stories": stories,
                "url": "http://localhost:3000/audio/briefing.mp3"
            })
        except Exception as e:
            logger.error(f"Daily briefing synthesis failed: {e}")
            return _err(f"Synthesis failed: {str(e)}", 500)

    # ── Article listing ───────────────────────────────────────

    @app.route("/articles/recent", methods=["GET"])
    @_need_db
    def articles_recent():
        """
        Return recent articles across ALL topics.
        Supports 7-day limit and 'Latest' vs 'Default' ranking.
        """
        limit   = max(1, min(int(request.args.get("limit", 50)), 100))
        offset  = max(0, int(request.args.get("offset", 0)))
        days    = max(1, min(int(request.args.get("days", 7)), 30))
        sort_by = request.args.get("sort", "default").lower()
        topic_list = request.args.getlist("topics") or None
        fields     = request.args.get("fields", "").split(",") if request.args.get("fields") else None

        # Try cache if no offset
        cache_key = f"recent_feed_{sort_by}_{limit}_{days}_{topic_list}_{fields}"
        if offset == 0 and redis_client.client:
            cached = redis_client.client.get(cache_key)
            if cached:
                return _ok(json.loads(cached))

        rows = _db.get_recent_feed(limit=limit, days=days, sort_by=sort_by, topics=topic_list, offset=offset)
        articles = [a.to_dict(fields=fields) for a in rows]
        result = {"count": len(articles), "articles": articles}

        # Cache results for 300 seconds (5 minutes) if no offset
        # Provides sub-millisecond retrieval speeds on repeat requests,
        # with automatic cache clearing when new articles are mined.
        if offset == 0 and redis_client.client:
            redis_client.client.setex(cache_key, 300, json.dumps(result))

        return _ok(result)

    @app.route("/topics/stats", methods=["GET"])
    @_need_db
    def topics_stats():
        """Return per-topic article counts for the sidebar."""
        topics = _orchestrator.topics if _orchestrator else []
        counts = {}
        total  = 0
        for topic in topics:
            rows = _db.get_articles_by_topic(topic, limit=10000)
            counts[topic] = len(rows)
            total += len(rows)
        counts["__total__"] = total
        return _ok(counts)

    @app.route("/articles", methods=["GET"])
    @_need_db
    def articles():
        """
        Return the most-recent articles for a topic.

        Query params:
            topic  (required)
            limit  (optional, 1–100, default 20)
        """
        topic = request.args.get("topic", "").strip()
        if not topic:
            return _err("'topic' query parameter is required.", 400)

        try:
            limit  = max(1, min(int(request.args.get("limit", 20)), 100))
            offset = max(0, int(request.args.get("offset", 0)))
            fields = request.args.get("fields", "").split(",") if request.args.get("fields") else None
        except ValueError:
            limit  = 20
            offset = 0
            fields = None

        rows = _db.get_articles_by_topic(topic, limit=limit, offset=offset)
        return _ok({
            "topic":    topic,
            "count":    len(rows),
            "articles": [a.to_dict(fields=fields) for a in rows],
        })

    # ── RAG querying ──────────────────────────────────────────

    @app.route("/query", methods=["POST"])
    @_need_rag
    def query():
        """
        Full RAG query: retrieve relevant docs and generate a grounded answer.

        Body (JSON):
            question  (str, required)
            top_k     (int, optional, 1–20, default 5)
        """
        body     = request.get_json(silent=True) or {}
        question = body.get("question", "").strip()
        if not question:
            return _err("'question' field is required.", 400)

        try:
            top_k = max(1, min(int(body.get("top_k", 5)), 20))
        except (TypeError, ValueError):
            top_k = 5

        from datetime import datetime
        start_date = body.get("start_date")
        end_date = body.get("end_date")
        
        def parse_date(d_str):
            if not d_str: return None
            try: return datetime.fromisoformat(d_str.replace("Z", "+00:00"))
            except ValueError: return None

        logger.info(f"[API /query] '{question[:80]}' (top_k={top_k})")
        result = _rag.query(
            question, 
            top_k=top_k,
            start_date=parse_date(start_date),
            end_date=parse_date(end_date)
        )
        return _ok(result)

    @app.route("/retrieve", methods=["POST"])
    @_need_rag
    def retrieve():
        """
        Semantic retrieval only — no LLM, just ranked documents.

        Body (JSON):
            query  (str, required)
            top_k  (int, optional, default 5)
        """
        body  = request.get_json(silent=True) or {}
        query_text = body.get("query", "").strip()
        if not query_text:
            return _err("'query' field is required.", 400)

        try:
            top_k = max(1, min(int(body.get("top_k", 5)), 20))
        except (TypeError, ValueError):
            top_k = 5
            
        from datetime import datetime
        start_date = body.get("start_date")
        end_date = body.get("end_date")
        
        def parse_date(d_str):
            if not d_str: return None
            try: return datetime.fromisoformat(d_str.replace("Z", "+00:00"))
            except ValueError: return None

        docs = _rag.retrieve(
            query_text, 
            top_k=top_k,
            start_date=parse_date(start_date), 
            end_date=parse_date(end_date)
        )
        return _ok({"query": query_text, "count": len(docs), "documents": docs})

    # ── Analytics endpoints ───────────────────────────────────

    @app.route("/stats/timeline", methods=["GET"])
    @_need_db
    def stats_timeline():
        """
        Articles saved per topic per day (last N days).
        Query params:
            topic (optional) — filter to one topic
            days  (optional, default 14)
        """
        from sqlalchemy import func, cast, Date as SADate
        try:
            days  = max(1, min(int(request.args.get("days", 14)), 90))
        except ValueError:
            days = 14
        topic_filter = request.args.get("topic", "").strip()

        from datetime import datetime, timedelta
        from storage.db import Article
        cutoff = datetime.utcnow() - timedelta(days=days)

        with _db.SessionFactory() as session:
            q = session.query(
                cast(Article.created_at, SADate).label("date"),
                Article.topic,
                func.count(Article.id).label("count"),
            ).filter(Article.created_at >= cutoff)
            if topic_filter:
                q = q.filter(Article.topic == topic_filter)
            rows = q.group_by("date", Article.topic).order_by("date").all()

        data = [{"date": str(r.date), "topic": r.topic, "count": r.count} for r in rows]
        return _ok({"days": days, "data": data})

    @app.route("/stats/sources", methods=["GET"])
    @_need_db
    def stats_sources():
        """
        Breakdown of article count by source type per topic.
        Query params:
            topic (optional) — filter to one topic
        """
        from sqlalchemy import func
        from storage.db import Article
        topic_filter = request.args.get("topic", "").strip()

        with _db.SessionFactory() as session:
            q = session.query(
                Article.topic,
                Article.source,
                func.count(Article.id).label("count"),
            )
            if topic_filter:
                q = q.filter(Article.topic == topic_filter)
            rows = q.group_by(Article.topic, Article.source).all()

        data = [{"topic": r.topic, "source": r.source, "count": r.count} for r in rows]
        return _ok({"data": data})

    @app.route("/topics/trending", methods=["GET"])
    @_need_db
    def articles_trending():
        """
        Return topics sorted by recent article velocity (last 24h count).
        """
        from sqlalchemy import func
        from storage.db import Article
        from datetime import datetime, timedelta
        cutoff = datetime.utcnow() - timedelta(hours=24)

        with _db.SessionFactory() as session:
            rows = session.query(
                Article.topic,
                func.count(Article.id).label("recent_count"),
            ).filter(
                Article.created_at >= cutoff,
                Article.is_relevant == True,
            ).group_by(Article.topic).order_by(func.count(Article.id).desc()).all()

        data = [{"topic": r.topic, "recent_count": r.recent_count} for r in rows]
        return _ok({"trending": data})

    @app.route("/articles/popular", methods=["GET"])
    @_need_db
    def articles_popular():
        """
        Return top articles globally sorted by a combined algorithm of:
        - Importance (relevance_score)
        - Engagement (metadata)
        - Freshness (time decay)
        """
        from sqlalchemy import func
        from storage.db import Article
        from datetime import datetime
        try:
            limit  = max(1, min(int(request.args.get("limit", 30)), 100))
            offset = max(0, int(request.args.get("offset", 0)))
            fields = request.args.get("fields", "").split(",") if request.args.get("fields") else None
        except ValueError:
            limit  = 30
            offset = 0
            fields = None
            
        with _db.SessionFactory() as session:
            # Pull a wide net of recent relevant articles
            rows = session.query(Article).filter(
                Article.is_relevant == True,
                Article.is_outdated == False
            ).order_by(Article.created_at.desc()).limit(300).all()

        def calc_popularity(a: Article) -> float:
            # Base importance (0 to 1.0) scaled up - give more weight to relevance
            score = float(a.relevance_score or 0.5) * 40.0
            
            # Sentiment intensity (absolute value = polarization/engagement)
            if a.sentiment_score:
                score += abs(a.sentiment_score) * 15.0
                
            # Attention bonus: Extract engagement from metadata
            if isinstance(a.meta, dict):
                points = int(a.meta.get("points") or a.meta.get("upvotes") or a.meta.get("score") or 0)
                comments = int(a.meta.get("num_comments") or 0)
                attention = (points * 0.1) + (comments * 2.0)
                score += min(100.0, attention)
                
            # Time Decay: Use created_at (discovery time) to prioritize fresh mining results
            # Older articles decay but stay relevant if their scores are high enough
            ref_time = a.created_at
            hours_since = (datetime.utcnow() - ref_time).total_seconds() / 3600
            decay = 1.0 / (1.0 + (hours_since * 0.1)) # Faster decay for discovery (importance of "now")
            
            return score * decay
        # Sort by the new custom algorithm and slice with offset support
        rows.sort(key=calc_popularity, reverse=True)
        top_rows = rows[offset : offset + limit]

        return _ok({"count": len(top_rows), "articles": [a.to_dict(fields=fields) for a in top_rows]})

    @app.route("/articles/social", methods=["GET"])
    @_need_db
    def articles_social():
        """Retrieve social media posts across all platforms."""
        try:
            limit  = max(1, min(int(request.args.get("limit", 24)), 100))
            offset = max(0, int(request.args.get("offset", 0)))
            fields = request.args.get("fields", "").split(",") if request.args.get("fields") else None
        except ValueError:
            limit  = 24
            offset = 0
            fields = None
            
        with _db.SessionFactory() as session:
            rows = session.query(Article).filter(
                Article.source.in_(["x", "reddit", "instagram", "facebook", "tweet"]),
                Article.is_relevant == True
            ).order_by(Article.created_at.desc()).offset(offset).limit(limit).all()

        return _ok({"count": len(rows), "articles": [a.to_dict(fields=fields) for a in rows]})

    @app.route("/articles/export", methods=["GET"])
    @_need_db
    def articles_export():
        """
        Download all articles for a topic as CSV or JSON.
        Query params:
            topic (required)
            fmt   (optional: 'csv' | 'json', default 'json')
        """
        import csv, io
        from flask import Response
        topic = request.args.get("topic", "").strip()
        fmt   = request.args.get("fmt", "json").lower()
        if not topic:
            return _err("'topic' query parameter is required.", 400)

        rows = _db.get_articles_by_topic(topic, limit=10000)
        articles_data = [a.to_dict() for a in rows]

        if fmt == "csv":
            fields = ["id", "title", "url", "source", "topic",
                      "summary", "relevance_score", "sentiment_label",
                      "sentiment_score", "published_at", "created_at"]
            buf = io.StringIO()
            writer = csv.DictWriter(buf, fieldnames=fields, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(articles_data)
            return Response(
                buf.getvalue(),
                mimetype="text/csv",
                headers={"Content-Disposition": f'attachment; filename="{topic}.csv"'},
            )
        else:
            import json
            return Response(
                json.dumps({"topic": topic, "count": len(articles_data), "articles": articles_data}, indent=2),
                mimetype="application/json",
                headers={"Content-Disposition": f'attachment; filename="{topic}.json"'},
            )

    # ── Pipeline control ──────────────────────────────────────

    @app.route("/pipeline/run", methods=["POST"])
    @_need_pipeline
    def pipeline_run():
        """
        Trigger the full ingestion pipeline asynchronously.
        """
        body   = request.get_json(silent=True) or {}
        topics = body.get("topics") or None      

        def background_task():
            try:
                _orchestrator.run_ingestion_pipeline(topics=topics)
                _orchestrator._emit("status", {"message": "Completed Pipeline Cycle. All sources synced."})
            except Exception as e:
                logger.error(f"Background pipeline task failed: {e}")
                _orchestrator._emit("status", {"message": f"Pipeline failed: {str(e)}"})

        thread = threading.Thread(target=background_task)
        thread.start()

        return _ok({"message": "Pipeline started in background.", "topics": topics or _orchestrator.topics})

    @app.route("/pipeline/stream")
    def pipeline_stream():
        """SSE endpoint for real-time pipeline events."""
        def event_stream():
            # Keep-alive event
            yield f"data: {json.dumps({'type': 'connected'})}\n\n"
            while True:
                try:
                    # Wait for an event with a timeout to allow checking for disconnected clients
                    event = _event_queue.get(timeout=20)
                    yield f"data: {json.dumps(event)}\n\n"
                except queue.Empty:
                    yield f"data: {json.dumps({'type': 'ping'})}\n\n"
                except Exception as e:
                    logger.error(f"SSE Error: {e}")
                    break
        
        return Response(stream_with_context(event_stream()), mimetype="text/event-stream")

    @app.route("/pipeline/embed", methods=["POST"])
    @_need_pipeline
    def pipeline_embed():
        """Trigger the embedding update for un-embedded articles."""
        count = _orchestrator.run_embedding_update()
        return _ok({"newly_embedded": count})

    @app.route("/pipeline/cleanup", methods=["POST"])
    @_need_pipeline
    def pipeline_cleanup():
        """Mark stale articles as outdated."""
        count = _orchestrator.run_cleanup()
        return _ok({"articles_marked_outdated": count})

    # ── Private Dossier Endpoints ─────────────────────────────

    @app.route("/dossiers", methods=["GET"])
    @_need_db
    def dossiers_list():
        try:
            with _db.SessionFactory() as session:
                from storage.db import Article
                dossier_articles = session.query(Article).filter(Article.source == "dossier").all()
                
                files = {}
                for art in dossier_articles:
                    fname = art.meta.get("filename", "Unknown") if isinstance(art.meta, dict) else "Unknown"
                    if fname not in files:
                        files[fname] = {
                            "filename": fname,
                            "chunks": 0,
                            "uploaded_at": art.created_at.isoformat() + "Z" if art.created_at else None
                        }
                    files[fname]["chunks"] += 1
                
                return _ok({"dossiers": list(files.values())})
        except Exception as e:
            logger.error(f"Failed to list dossiers: {e}")
            return _err(f"Failed to list dossiers: {str(e)}", 500)

    @app.route("/dossiers/upload", methods=["POST"])
    @_need_db
    @_need_rag
    @_need_dossiers
    def dossiers_upload():
        if "file" not in request.files:
            return _err("No file part in the request.", 400)
        file = request.files["file"]
        if file.filename == "":
            return _err("No selected file.", 400)
            
        try:
            file_bytes = file.read()
            filename = file.filename
            mime_type = file.mimetype or "application/octet-stream"
            
            result = _dossier_engine.index_dossier(
                file_bytes=file_bytes,
                filename=filename,
                mime_type=mime_type,
                embedder=_rag.embedder,
                vector_store=_rag.vector_store
            )
            return _ok(result)
        except Exception as e:
            logger.error(f"Dossier upload failed: {e}")
            return _err(f"Indexing failed: {str(e)}", 500)

    @app.route("/dossiers/query", methods=["POST"])
    @_need_db
    @_need_rag
    @_need_dossiers
    def dossiers_query():
        body = request.get_json() or {}
        question = body.get("question") or body.get("query")
        if not question or not question.strip():
            return _err("Missing 'question' in request body.", 400)
            
        try:
            result = _dossier_engine.query_dossiers(
                question=question,
                embedder=_rag.embedder,
                vector_store=_rag.vector_store
            )
            return _ok(result)
        except Exception as e:
            logger.error(f"Dossier querying failed: {e}")
            return _err(f"Querying failed: {str(e)}", 500)

    # ── Error handlers ────────────────────────────────────────

    @app.errorhandler(404)
    def not_found(_):
        return _err("Endpoint not found.", 404)

    @app.errorhandler(405)
    def method_not_allowed(_):
        return _err("Method not allowed.", 405)

    @app.errorhandler(500)
    def internal_error(exc):
        logger.error(f"Unhandled exception: {exc}", exc_info=True)
        return _err("Internal server error.", 500)

    @app.route("/pipeline/events", methods=["GET"])
    def pipeline_events():
        """Retrieve recent pipeline events from Redis."""
        return _ok({"events": redis_client.get_events()})

    return app

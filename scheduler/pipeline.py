"""
Pipeline orchestrator — ties all agents together and drives
the APScheduler-based automation.

Scheduled Jobs
--------------
1. ingestion_pipeline   — every N hours (configurable)
   crawl → clean → filter → summarise → save to DB

2. embedding_update     — N hours + 30 min offset
   embed new articles → add to FAISS

3. weekly_cleanup       — every Sunday at 02:00 UTC
   mark old articles as outdated
"""

import uuid
from datetime import datetime
from typing import Any, Dict, List

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from crawler.news_crawler import NewsCrawler
from crawler.reddit_crawler import RedditCrawler
from crawler.wiki_crawler import WikiCrawler
from crawler.extended_crawlers import HackerNewsCrawler, ArxivCrawler, FinanceCrawler
from crawler.social_crawler import SocialCrawler
from embedding.embedder import EmbeddingAgent
from filtering.content_filter import ContentFilter
from filtering.social_analyzer import SocialAnalyzer
from processing.cleaner import TextCleaner
from processing.deduplicator import SemanticDeduplicator
from processing.keywords import KeywordExtractor
from processing.sentiment import SentimentAnalyzer
from processing.summarizer import Summarizer
from storage.db import DatabaseManager
from storage.vector_store import VectorStore
from utils.logger import get_logger
from utils.metrics import pipeline_metrics
from utils.redis_client import redis_client

logger = get_logger(__name__)


class PipelineOrchestrator:
    """
    Coordinates all pipeline agents and manages the APScheduler lifecycle.

    Args:
        config       : Top-level config dict (from config.yaml)
        db           : Shared DatabaseManager instance
        vector_store : Shared VectorStore instance
    """

    def __init__(
        self,
        config:       dict,
        db:           DatabaseManager,
        vector_store: VectorStore,
    ):
        self.config       = config
        self.db           = db
        self.vector_store = vector_store
        self.topics: List[str] = config.get("topics", [])
        self.on_event = None # Callback for real-time events

        # ── Agents ────────────────────────────────────────────
        from crawler.extended_crawlers import HackerNewsCrawler, ArxivCrawler, FinanceCrawler, NYTimesCrawler, GNewsCrawler, PolygonCrawler
        self.crawlers = [
            NewsCrawler(config),
            WikiCrawler(config),
            RedditCrawler(config),
            HackerNewsCrawler(config),
            ArxivCrawler(config),
            FinanceCrawler(config),
            NYTimesCrawler(config),
            GNewsCrawler(config),
            PolygonCrawler(config),
            SocialCrawler(config),
        ]
        self.cleaner        = TextCleaner()
        self.content_filter = ContentFilter(config)
        self.social_analyzer = SocialAnalyzer()
        self.summarizer     = Summarizer(config)
        self.embedder       = EmbeddingAgent(config)
        self.keyword_ext    = KeywordExtractor(top_n=10)
        self.sentiment      = SentimentAnalyzer()
        self.deduplicator   = SemanticDeduplicator(self.embedder)

        # ── Scheduler ─────────────────────────────────────────
        self.scheduler  = BackgroundScheduler(timezone="UTC")
        self._configure_jobs()

    # ── Scheduler lifecycle ───────────────────────────────────

    def _configure_jobs(self) -> None:
        """Register all scheduled jobs."""
        sched_cfg     = self.config.get("scheduler", {})
        interval_h    = float(sched_cfg.get("ingestion_interval_hours", 1.0))
        cleanup_days  = int(sched_cfg.get("cleanup_interval_days", 7))

        # Job 1: full ingestion pipeline
        self.scheduler.add_job(
            self.run_ingestion_pipeline,
            trigger       = IntervalTrigger(hours=interval_h),
            id            = "ingestion_pipeline",
            name          = "Data Ingestion Pipeline",
            replace_existing = True,
            max_instances = 1,
            coalesce      = True,
        )

        # Job 2: embedding update (offset by 30 min so it runs after ingestion)
        self.scheduler.add_job(
            self.run_embedding_update,
            trigger       = IntervalTrigger(hours=interval_h, minutes=30),
            id            = "embedding_update",
            name          = "Embedding Update",
            replace_existing = True,
            max_instances = 1,
            coalesce      = True,
        )

        # Job 3: weekly cleanup
        self.scheduler.add_job(
            self.run_cleanup,
            trigger          = CronTrigger(day_of_week="sun", hour=2, minute=0),
            id               = "weekly_cleanup",
            name             = "Weekly Data Cleanup",
            replace_existing = True,
        )

        logger.info(
            f"Scheduler configured: ingestion every {interval_h}h, "
            f"cleanup every {cleanup_days}d."
        )

    def start(self) -> None:
        """Start the background scheduler."""
        if not self.scheduler.running:
            self.scheduler.start()
            logger.info("Pipeline scheduler STARTED.")

    def stop(self) -> None:
        """Gracefully stop the scheduler."""
        if self.scheduler.running:
            self.scheduler.shutdown(wait=False)
            logger.info("Pipeline scheduler STOPPED.")

    # ── Main pipeline ─────────────────────────────────────────

    def run_ingestion_pipeline(
        self, topics: List[str] = None
    ) -> Dict[str, Any]:
        """
        Execute the full ingestion pipeline once for all topics.

        Steps: crawl → clean → filter → summarise → save
        Returns a stats dict describing the run.
        """
        run_id     = str(uuid.uuid4())[:8]
        started_at = datetime.utcnow()
        topics     = topics or self.topics

        logger.info(f"══ Pipeline run [{run_id}] started ({len(topics)} topics) ══")
        redis_client.clear_events()
        redis_client.push_event({"type": "status", "message": f"Pipeline initialized: {run_id}", "status": "started"})

        totals = {
            "run_id":              run_id,
            "articles_fetched":    0,
            "articles_cleaned":    0,
            "articles_filtered":   0,
            "articles_summarized": 0,
            "articles_saved":      0,
            "articles_embedded":   0,
            "status":              "running",
        }

        try:
            for topic in topics:
                logger.info(f"[{run_id}] ▶ topic: '{topic}'")
                t_stats = self._process_topic(topic)
                totals["articles_fetched"]    += t_stats["fetched"]
                totals["articles_cleaned"]    += t_stats["cleaned"]
                totals["articles_filtered"]   += t_stats["filtered"]
                totals["articles_summarized"] += t_stats["summarized"]
                totals["articles_saved"]      += t_stats["saved"]

            self._emit("status", {
                "message": f"Completed Pipeline Cycle. Saved {totals['articles_saved']} new articles.", 
                "saved": totals["articles_saved"],
                "final": True
            })
            
            # Phase 6: Auto-trigger embedding update after ingestion
            if totals["articles_saved"] > 0:
                self._emit("status", {"message": "Indexing new intelligence into vector memory..."})
                embedded_count = self.run_embedding_update()
                totals["articles_embedded"] = embedded_count

            totals["status"] = "success"

        except Exception as exc:
            logger.error(f"[{run_id}] Pipeline error: {exc}", exc_info=True)
            totals["status"] = "failed"
            totals["error"]  = str(exc)

        finally:
            duration                 = (datetime.utcnow() - started_at).total_seconds()
            totals["duration_seconds"] = round(duration, 2)
            totals["started_at"]     = started_at
            totals["completed_at"]   = datetime.utcnow()

            # Persist to database for historical audit and dashboard stats
            self.db.log_pipeline_run(totals)

            logger.info(
                f"══ Pipeline run [{run_id}] {totals['status'].upper()} "
                f"| fetched={totals['articles_fetched']} "
                f"saved={totals['articles_saved']} "
                f"duration={duration:.1f}s ══"
            )
            pipeline_metrics.log_summary()

        return totals

    def _emit(self, event_type: str, data: Dict[str, Any]):
        """Helper to trigger event callback and persist to Redis."""
        event = {"type": event_type, "timestamp": datetime.utcnow().isoformat(), **data}
        
        # Store in Redis for history playback
        redis_client.push_event(event)
        
        if self.on_event:
            try:
                self.on_event(event)
            except:
                pass

    # ── Per-topic processing ──────────────────────────────────

    def _process_topic(self, topic: str) -> Dict[str, int]:
        """Run all pipeline stages for a single topic."""
        self._emit("status", {"message": f"Processing topic: {topic}", "topic": topic})

        # ── 1. Crawl ─────────────────────────────────────────
        raw: List[Dict[str, Any]] = []
        for crawler in self.crawlers:
            try:
                self._emit("status", {"message": f"Mining {type(crawler).__name__} for {topic}...", "topic": topic, "source": type(crawler).__name__})
                results = crawler.fetch(topic)
                if results:
                    for r in results[:3]: # Emit first few found articles for visual flair
                         self._emit("mining", {
                             "title": r.get("title"),
                             "source": type(crawler).__name__,
                             "topic": topic,
                             "url": r.get("url")
                         })
                raw.extend(results)
            except Exception as exc:
                logger.warning(
                    f"[{type(crawler).__name__}] failed for '{topic}': {exc}"
                )
        fetched = len(raw)
        if not raw:
            logger.info(f"No articles fetched for '{topic}'. Skipping.")
            return {"fetched": 0, "cleaned": 0, "filtered": 0, "summarized": 0, "saved": 0}

        # ── 2. Clean ─────────────────────────────────────────
        self._emit("status", {"message": f"Cleaning {fetched} articles...", "topic": topic})
        cleaned_articles = self.cleaner.clean_batch(raw)
        cleaned = len(cleaned_articles)

        # ── 3. Filter ────────────────────────────────────────
        self._emit("status", {"message": f"Filtering and scoring relevance...", "topic": topic})
        scored   = self.content_filter.filter(cleaned_articles, topic)
        relevant = [a for a in scored if a.get("is_relevant", True)]
        
        # ── 4. Deduplicate (BEFORE expensive ML stages) ──────
        self._emit("status", {"message": f"Deduplicating findings...", "topic": topic})
        relevant = self.deduplicator.deduplicate(relevant)
        filtered = len(relevant)

        # ── 5. Summarise ──────────────────────────────────────
        if relevant:
            self._emit("status", {"message": f"Generating AI summaries for {filtered} articles...", "topic": topic})
            try:
                self.summarizer.summarize_batch(relevant)
            except Exception as e:
                logger.error(f"Summarization failed for topic {topic}: {e}")
                # Fallback: create minimal summaries if summarizer failed completely
                for a in relevant:
                    if not a.get("summary"):
                        a["summary"] = (a.get("cleaned_content") or "")[:200] + "..."
        summarized = sum(1 for a in relevant if a.get("summary"))

        # ── 6. ML Enrichment ─────────────────────────────────
        self._emit("status", {"message": f"Analyzing sentiment and keywords...", "topic": topic})
        self.keyword_ext.extract_batch(relevant)          # TF-IDF keywords
        self.sentiment.score_batch(relevant)              # VADER sentiment

        # ── 6b. Social Analysis ───────────────────────────────
        self._emit("status", {"message": f"Evaluating social credibility and impact...", "topic": topic})
        for art in relevant:
            # If it's a social post or has social metadata
            if art.get("source") in ("x", "reddit", "instagram", "facebook") or art.get("metadata", {}).get("is_social"):
                scores = self.social_analyzer.analyze(art)
                art["truth_score"] = scores["truth"]
                art["importance_score"] = scores["importance"]
                art["attention_score"] = scores["attention"]
            else:
                # Default scores for regular news
                art["truth_score"] = 0.9  # Regular news is generally more trusted
                art["importance_score"] = art.get("relevance_score", 0.7)
                art["attention_score"] = 0.5

        # ── 7. Save ───────────────────────────────────────────
        self._emit("status", {"message": f"Saving {len(relevant)} intelligence units to database...", "topic": topic})
        saved = self.db.save_articles(relevant)
        if saved > 0:
            redis_client.clear_cache()
        
        self._emit("status", {"message": f"Completed topic: {topic}", "topic": topic, "saved": saved})

        return {
            "fetched":    fetched,
            "cleaned":    cleaned,
            "filtered":   filtered,
            "summarized": summarized,
            "saved":      saved,
        }

    # ── Embedding update ──────────────────────────────────────

    def run_embedding_update(self) -> int:
        """
        Generate embeddings for articles that are not yet in FAISS.
        Returns the number of newly embedded articles.
        """
        logger.info("Embedding update: checking for un-embedded articles ...")
        self._emit("status", {"message": "Scanning for un-indexed articles..."})
        
        sched_cfg  = self.config.get("scheduler", {})
        batch_size = int(sched_cfg.get("embedding_update_batch_size", 100))
 
        articles = self.db.get_unembedded_articles(limit=batch_size)
        if not articles:
            logger.info("Embedding update: nothing to embed.")
            self._emit("status", {"message": "All intelligence currently indexed."})
            return 0
 
        self._emit("status", {"message": f"Generating vector embeddings for {len(articles)} units..."})
        texts, ids = [], []
        for art in articles:
            text = art.summary or art.cleaned_content or ""
            if len(text) > 50:
                texts.append(f"{art.title or ''}: {text}")
                ids.append(art.id)
 
        if not texts:
            self._emit("status", {"message": "No valid content found for indexing."})
            return 0
 
        embeddings = self.embedder.embed_batch(texts)
        if embeddings.size > 0:
            self.vector_store.add(embeddings, ids)
            self.db.mark_as_embedded(ids)
            logger.info(f"Embedding update: {len(ids)} articles indexed in FAISS.")
            self._emit("status", {"message": f"Successfully indexed {len(ids)} articles. Intelligence updated."})
 
        return len(ids)

    # ── Cleanup ───────────────────────────────────────────────

    def run_cleanup(self) -> int:
        """Mark articles older than the configured age as outdated."""
        max_age = int(
            self.config.get("scheduler", {}).get("max_article_age_days", 30)
        )
        count = self.db.cleanup_outdated(max_age)
        logger.info(f"Cleanup: {count} articles marked as outdated.")
        return count

    # ── Status ────────────────────────────────────────────────

    def get_status(self) -> Dict[str, Any]:
        """Return scheduler status + DB/FAISS stats for the API."""
        jobs = []
        for job in self.scheduler.get_jobs():
            next_run = getattr(job, "next_run_time", None)
            jobs.append({
                "id":       job.id,
                "name":     job.name,
                "next_run": next_run.isoformat() if next_run and hasattr(next_run, "isoformat") else None,
            })
        return {
            "scheduler_running":    self.scheduler.running,
            "scheduled_jobs":       jobs,
            "topics":               self.topics,
            "db_stats":             self.db.get_stats(),
            "faiss_total_vectors":  self.vector_store.total,
        }

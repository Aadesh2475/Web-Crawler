"""
PostgreSQL storage layer using SQLAlchemy ORM.

Tables
------
articles      – every collected and processed article
pipeline_runs – audit log for each pipeline execution
"""

import os
import hashlib
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import (
    Boolean, Column, DateTime, Float, Index, Integer,
    String, Text, UniqueConstraint, create_engine, event,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from utils.logger import get_logger

logger = get_logger(__name__)


# ─── ORM Models ───────────────────────────────────────────────────────────────

class Base(DeclarativeBase):
    pass


class Article(Base):
    """Stores every article collected and processed by the pipeline."""

    __tablename__ = "articles"

    id               = Column(Integer, primary_key=True, autoincrement=True)
    url_hash         = Column(String(64), unique=True, nullable=False, index=True)
    url              = Column(Text, nullable=False)
    title            = Column(Text)
    source           = Column(String(100))        # news | wikipedia | reddit
    topic            = Column(String(255), index=True)
    raw_content      = Column(Text)
    cleaned_content  = Column(Text)
    summary          = Column(Text)
    relevance_score  = Column(Float)
    is_relevant      = Column(Boolean, default=True)
    is_embedded      = Column(Boolean, default=False, index=True)
    is_outdated      = Column(Boolean, default=False, index=True)
    published_at     = Column(DateTime)
    created_at       = Column(DateTime, default=datetime.utcnow)
    updated_at       = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    meta             = Column("metadata", JSONB, default=dict)
    # ── ML-enriched fields ──────────────────────────────────────
    keywords         = Column(JSONB, default=list)   # top TF-IDF keywords
    sentiment_score  = Column(Float)                 # VADER compound -1..1
    sentiment_label  = Column(String(20))            # positive|neutral|negative

    # ── Social / Analysis Scores ────────────────────────────────
    truth_score      = Column(Float, default=0.5)    # 0..1 (Heuristic or ML based)
    importance_score = Column(Float, default=0.5)    # 0..1 (Engagement / Impact)
    attention_score  = Column(Float, default=0.5)    # 0..1 (Viral potential / Views)

    __table_args__ = (
        Index("idx_topic_source",  "topic", "source"),
        Index("idx_created_at",    "created_at"),
        Index("idx_embed_flag",    "is_embedded", "is_relevant", "is_outdated"),
    )

    def to_dict(self, fields: Optional[List[str]] = None) -> Dict[str, Any]:
        full_dict = {
            "id":              self.id,
            "url":             self.url,
            "title":           self.title,
            "source":          self.source,
            "topic":           self.topic,
            "summary":         self.summary,
            "relevance_score": self.relevance_score,
            "is_relevant":     self.is_relevant,
            "published_at":    self.published_at.isoformat() if self.published_at else None,
            "created_at":      self.created_at.isoformat()   if self.created_at   else None,
            "keywords":        self.keywords or [],
            "sentiment_score": self.sentiment_score,
            "sentiment_label": self.sentiment_label,
            "truth_score":     self.truth_score,
            "importance_score": self.importance_score,
            "attention_score": self.attention_score,
            "author":          self.meta.get("author") or self.meta.get("username") if isinstance(self.meta, dict) else None,
            "meta":            self.meta if isinstance(self.meta, dict) else {},
        }
        if fields:
            return {k: v for k, v in full_dict.items() if k in fields}
        return full_dict


class PipelineRun(Base):
    """Audit log — one row per pipeline execution."""

    __tablename__ = "pipeline_runs"

    id                  = Column(Integer, primary_key=True, autoincrement=True)
    run_id              = Column(String(64), unique=True, nullable=False)
    status              = Column(String(20), default="running")   # running|success|failed
    articles_fetched    = Column(Integer, default=0)
    articles_cleaned    = Column(Integer, default=0)
    articles_filtered   = Column(Integer, default=0)
    articles_summarized = Column(Integer, default=0)
    articles_embedded   = Column(Integer, default=0)
    articles_saved      = Column(Integer, default=0)
    error_message       = Column(Text)
    started_at          = Column(DateTime, default=datetime.utcnow)
    completed_at        = Column(DateTime)
    duration_seconds    = Column(Float)


# ─── Helpers ──────────────────────────────────────────────────────────────────

import re
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode

def url_to_hash(url: str) -> str:
    """Normalize URL and return deterministic SHA-256 hash."""
    try:
        parsed = urlparse(url)
        # Strip tracking params (utm_*, ref, etc.)
        params = parse_qsl(parsed.query)
        clean_params = [(k, v) for k, v in params if not k.startswith('utm_') and k not in ('ref', 'source', 'fbclid')]
        
        # Reconstruct clean URL
        clean_url = urlunparse((
            parsed.scheme,
            parsed.netloc.lower(),
            parsed.path.rstrip('/'),
            parsed.params,
            urlencode(clean_params),
            '' # Strip fragment
        ))
        return hashlib.sha256(clean_url.encode("utf-8")).hexdigest()
    except:
        return hashlib.sha256(url.encode("utf-8")).hexdigest()


# ─── Database Manager ────────────────────────────────────────────────────────

class DatabaseManager:
    """High-level interface for all PostgreSQL operations."""

    def __init__(self, config: dict):
        # Prefer DATABASE_URL env var (works directly with Neon's SSL URL)
        database_url = os.getenv("DATABASE_URL", "")

        if database_url:
            # Neon provides postgres:// — SQLAlchemy needs postgresql://
            conn_str = database_url.replace("postgres://", "postgresql://", 1)
            # Strip channel_binding param if present (not supported by psycopg2)
            conn_str = conn_str.replace("&channel_binding=require", "").replace(
                "?channel_binding=require&", "?"
            )
            logger.info("Database: using DATABASE_URL (Neon / external).")
        else:
            # Fall back to individual config values
            db_cfg = config["storage"]["postgres"]
            host   = os.getenv("DB_HOST",     db_cfg.get("host",     "localhost"))
            port   = os.getenv("DB_PORT",     str(db_cfg.get("port", 5432)))
            dbname = os.getenv("DB_NAME",     db_cfg.get("database", "webmining_db"))
            user   = os.getenv("DB_USER",     db_cfg.get("user",     "postgres"))
            passwd = os.getenv("DB_PASSWORD", db_cfg.get("password", ""))
            conn_str = f"postgresql://{user}:{passwd}@{host}:{port}/{dbname}"
            logger.info(f"Database: {host}:{port}/{dbname}")

        self.engine = create_engine(
            conn_str,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10,
        )
        self.SessionFactory = sessionmaker(bind=self.engine, expire_on_commit=False)

    # ── Schema ──────────────────────────────────────────────

    def create_tables(self) -> None:
        """Create all ORM tables if they do not exist."""
        Base.metadata.create_all(self.engine)
        logger.info("Database tables created / verified.")

    # ── Write operations ─────────────────────────────────────

    def save_articles(self, articles: List[Dict[str, Any]]) -> int:
        """
        Bulk-insert articles, skipping already-seen URLs.

        Returns the number of newly saved rows.
        """
        saved = 0
        with self.SessionFactory() as session:
            for art in articles:
                url = art.get("url", "")
                if not url:
                    continue
                url_hash = url_to_hash(url)
                title = art.get("title", "").strip()
                
                from sqlalchemy import func
                clean_title = title.lower().strip()
                existing = session.query(Article.id).filter(
                    (Article.url_hash == url_hash) | (func.lower(Article.title) == clean_title)
                ).first()
                
                if existing:
                    continue   # Duplicate — skip

                record = Article(
                    url_hash        = url_hash,
                    url             = url,
                    title           = art.get("title"),
                    source          = art.get("source"),
                    topic           = art.get("topic"),
                    raw_content     = art.get("raw_content", ""),
                    cleaned_content = art.get("cleaned_content"),
                    summary         = art.get("summary"),
                    relevance_score = art.get("relevance_score"),
                    is_relevant     = art.get("is_relevant", True),
                    published_at    = art.get("published_at"),
                    meta            = art.get("metadata", {}),
                    keywords        = art.get("keywords", []),
                    sentiment_score = art.get("sentiment_score"),
                    sentiment_label = art.get("sentiment_label"),
                )
                session.add(record)
                saved += 1

            session.commit()

        logger.info(f"Saved {saved} new articles to the database.")
        return saved

    def mark_as_embedded(self, article_ids: List[int]) -> None:
        """Flag articles as having their embeddings stored in FAISS."""
        with self.SessionFactory() as session:
            session.query(Article).filter(Article.id.in_(article_ids)).update(
                {"is_embedded": True, "updated_at": datetime.utcnow()},
                synchronize_session=False,
            )
            session.commit()

    def cleanup_outdated(self, max_age_days: int = 30) -> int:
        """Mark articles older than *max_age_days* as outdated. Returns count."""
        cutoff = datetime.utcnow() - timedelta(days=max_age_days)
        with self.SessionFactory() as session:
            count = (
                session.query(Article)
                .filter(Article.created_at < cutoff, Article.is_outdated == False)   # noqa: E712
                .update({"is_outdated": True}, synchronize_session=False)
            )
            session.commit()
        logger.info(f"Marked {count} articles as outdated.")
        return count

    def log_pipeline_run(self, run_data: Dict[str, Any]) -> None:
        """Persist a PipelineRun record."""
        with self.SessionFactory() as session:
            session.add(PipelineRun(**run_data))
            session.commit()

    # ── Read operations ──────────────────────────────────────

    def article_exists(self, url: str) -> bool:
        """Return True if the URL is already in the database."""
        with self.SessionFactory() as session:
            return bool(
                session.query(Article.id)
                .filter_by(url_hash=url_to_hash(url))
                .first()
            )

    def get_unembedded_articles(self, limit: int = 100) -> List[Article]:
        """Fetch relevant articles that still need vector embeddings."""
        with self.SessionFactory() as session:
            return (
                session.query(Article)
                .filter(
                    Article.is_relevant  == True,     # noqa: E712
                    Article.is_embedded  == False,    # noqa: E712
                    Article.is_outdated  == False,    # noqa: E712
                    Article.summary.isnot(None),
                )
                .order_by(Article.created_at.desc())
                .limit(limit)
                .all()
            )

    def get_articles_by_ids(self, ids: List[int]) -> List[Article]:
        """Bulk-fetch articles by primary key list."""
        with self.SessionFactory() as session:
            return (
                session.query(Article)
                .filter(Article.id.in_(ids))
                .all()
            )

    def get_articles_by_topic(
        self, topic: str, limit: int = 50, offset: int = 0
    ) -> List[Article]:
        """Return the most-recent relevant articles for a topic."""
        with self.SessionFactory() as session:
            return (
                session.query(Article)
                .filter(Article.topic == topic, Article.is_relevant == True)   # noqa: E712
                .order_by(Article.created_at.desc(), Article.id.desc())
                .limit(limit)
                .offset(offset)
                .all()
            )

    def get_recent_feed(
        self, limit: int = 50, days: int = 7, sort_by: str = "default", topics: List[str] = None, offset: int = 0
    ) -> List[Article]:
        """
        Return a high-quality global feed of recent articles.
        Logic:
          - 'latest': Check articles published/mined within the last 24 hours in real time. Sort by published_at DESC (nulls last) and created_at DESC.
          - 'default': Check articles from the last X days. Prioritize articles mined/published in the last 24h with high importance.
        """
        from sqlalchemy import case, or_

        with self.SessionFactory() as session:
            query = session.query(Article).filter(Article.is_relevant == True)

            if topics:
                query = query.filter(Article.topic.in_(topics))

            cutoff_24h = datetime.utcnow() - timedelta(hours=24)

            if sort_by == "latest":
                # Only check articles published or mined in the last 24 hours
                query = query.filter(
                    or_(
                        Article.published_at >= cutoff_24h,
                        (Article.published_at.is_(None)) & (Article.created_at >= cutoff_24h)
                    )
                )
                # Sort by published_at desc (with nulls last) and created_at desc
                query = query.order_by(
                    Article.published_at.desc().nulls_last(),
                    Article.created_at.desc(),
                    Article.id.desc()
                )
            else: # default
                # Filter for content within the last X days (discovery time)
                discovery_cutoff = datetime.utcnow() - timedelta(days=days)
                query = query.filter(Article.created_at >= discovery_cutoff)

                # Prioritize articles mined/published recently (last 24h) with importance
                recent_important_cond = (
                    or_(
                        Article.published_at >= cutoff_24h,
                        (Article.published_at.is_(None)) & (Article.created_at >= cutoff_24h)
                    )
                ) & (
                    or_(
                        Article.relevance_score >= 0.7,
                        Article.importance_score >= 0.7
                    )
                )

                query = query.order_by(
                    case((recent_important_cond, 1), else_=0).desc(),
                    Article.created_at.desc(),
                    Article.id.desc()
                )

            return query.limit(limit).offset(offset).all()

    def get_stats(self) -> Dict[str, int]:
        """Return aggregate counts for the monitoring dashboard."""
        with self.SessionFactory() as session:
            return {
                "total_articles":        session.query(Article).count(),
                "relevant_articles":     session.query(Article).filter_by(is_relevant=True).count(),
                "embedded_articles":     session.query(Article).filter_by(is_embedded=True).count(),
                "outdated_articles":     session.query(Article).filter_by(is_outdated=True).count(),
                "articles_with_summary": session.query(Article).filter(Article.summary.isnot(None)).count(),
            }

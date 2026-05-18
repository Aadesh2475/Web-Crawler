"""
Abstract base crawler with shared helpers.

All concrete crawlers extend this class and implement `fetch(topic)`.
"""

import random
import time
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, Dict, List, Optional

from utils.logger import get_logger

logger = get_logger(__name__)


class BaseCrawler(ABC):
    """
    Common interface for all data-ingestion agents.

    Sub-classes must set `SOURCE_NAME` and implement `fetch()`.
    """

    SOURCE_NAME: str = "base"

    def __init__(self, config: dict):
        self.config = config

    # ── Public interface ──────────────────────────────────────

    @abstractmethod
    def fetch(self, topic: str) -> List[Dict[str, Any]]:
        """
        Fetch documents relevant to *topic*.

        Returns a list of dicts with at minimum:
            url, title, source, topic, raw_content, published_at, metadata
        """

    # ── Helpers shared by all crawlers ────────────────────────

    def _polite_sleep(self, min_s: float = 0.5, max_s: float = 2.0) -> None:
        """
        Random sleep to avoid hammering servers.
        Respects robots.txt spirit without requiring a full parser.
        """
        time.sleep(random.uniform(min_s, max_s))

    def _normalize(
        self,
        raw: Dict[str, Any],
        topic: str,
    ) -> Dict[str, Any]:
        """
        Convert a crawler-specific dict into the pipeline's canonical format.

        This is the contract all downstream agents depend on.
        """
        return {
            "url":          raw.get("url", ""),
            "title":        raw.get("title", ""),
            "source":       self.SOURCE_NAME,
            "topic":        topic,
            "raw_content":  raw.get("content", ""),
            "published_at": raw.get("published_at"),
            "metadata":     raw.get("metadata", {}),
        }

    @staticmethod
    def _deduplicate(articles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Remove articles with duplicate URLs (keeps first occurrence)."""
        seen: set = set()
        unique: List[Dict[str, Any]] = []
        for art in articles:
            url = art.get("url", "")
            if url and url not in seen:
                seen.add(url)
                unique.append(art)
        return unique

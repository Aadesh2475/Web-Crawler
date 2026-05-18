"""
News crawler — fetches articles from NewsAPI and RSS feeds.

Priority order
--------------
1. NewsAPI (if API key is present) — structured JSON, ~100 req/day free
2. RSS feeds  — zero-auth, good variety
3. BeautifulSoup body extraction — fallback when full text is missing
"""

import os
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from time import mktime
from typing import Any, Dict, List, Optional

import feedparser
import requests
from bs4 import BeautifulSoup

from crawler.base_crawler import BaseCrawler
from utils.logger import get_logger

logger = get_logger(__name__)

# Polite browser-like User-Agent (not hidden, just not default "python-requests")
_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; WebMiningBot/1.0; "
        "+https://github.com/webmining-pipeline)"
    )
}

# Tags whose entire subtree should be removed before text extraction
_NOISE_TAGS = ["script", "style", "nav", "footer", "header", "aside", "form", "noscript"]


class NewsCrawler(BaseCrawler):
    """Ingestion agent for news articles (NewsAPI + RSS)."""

    SOURCE_NAME    = "news"
    NEWSAPI_URL    = "https://newsapi.org/v2/everything"
    REQUEST_TIMEOUT = 12   # seconds

    def __init__(self, config: dict):
        super().__init__(config)
        news_cfg         = config["sources"]["news"]
        self.enabled     = news_cfg.get("enabled", True)
        self.api_key     = os.getenv("NEWS_API_KEY", news_cfg.get("api_key", ""))
        self.max_articles = 100 # Increased for better collection
        self.rss_feeds   = news_cfg.get("rss_feeds", [])

    # ── Public ────────────────────────────────────────────────

    def fetch(self, topic: str) -> List[Dict[str, Any]]:
        if not self.enabled:
            return []

        articles: List[Dict[str, Any]] = []

        if self.api_key:
            articles.extend(self._fetch_newsapi(topic))

        if len(articles) < self.max_articles:
            articles.extend(self._fetch_rss(topic))

        unique = self._deduplicate(articles)
        
        # Parallel Body Extraction for speed
        with ThreadPoolExecutor(max_workers=10) as executor:
            list(executor.map(self._populate_body, unique))

        logger.info(f"[News] '{topic}' → {len(unique)} unique articles collected.")
        return unique[: self.max_articles]

    def _populate_body(self, art: Dict[str, Any]):
        """Helper for parallel body extraction."""
        content = art.get("content") or ""
        # Only fetch full body if we have almost nothing, to save speed/bandwidth
        if len(content) < 250:
            full_text = self._extract_body(art.get("url", ""))
            if full_text and len(full_text) > len(content):
                art["content"] = full_text

    # ── NewsAPI ───────────────────────────────────────────────

    def _fetch_newsapi(self, topic: str) -> List[Dict[str, Any]]:
        try:
            resp = requests.get(
                self.NEWSAPI_URL,
                params={
                    "q":        topic,
                    "language": "en",
                    "sortBy":   "publishedAt",
                    "pageSize": 100, # Maximize batch size
                    "apiKey":   self.api_key,
                },
                headers=_HEADERS,
                timeout=self.REQUEST_TIMEOUT,
            )
            resp.raise_for_status()
            data = resp.json()
        except Exception as exc:
            logger.error(f"[NewsAPI] Request failed for '{topic}': {exc}")
            return []

        articles = []
        for item in data.get("articles", []):
            articles.append(
                self._normalize(
                    {
                        "url":          item.get("url", ""),
                        "title":        item.get("title", ""),
                        "content":      item.get("content") or item.get("description") or "",
                        "published_at": self._parse_date(item.get("publishedAt")),
                        "metadata": {
                            "author":      item.get("author"),
                            "source_name": (item.get("source") or {}).get("name"),
                            "description": item.get("description", ""),
                            "image_url":   item.get("urlToImage"), # Capture image
                        },
                    },
                    topic,
                )
            )

        logger.info(f"[NewsAPI] '{topic}' → {len(articles)} articles.")
        return articles

    # ── RSS feeds ─────────────────────────────────────────────

    def _fetch_rss(self, topic: str) -> List[Dict[str, Any]]:
        keywords = topic.lower().split()
        articles = []

        for feed_url in self.rss_feeds:
            try:
                feed = feedparser.parse(feed_url)
            except Exception as exc:
                logger.warning(f"[RSS] Could not parse {feed_url}: {exc}")
                continue

            for entry in feed.entries[:40]:
                title   = getattr(entry, "title",   "").lower()
                summary = getattr(entry, "summary", "").lower()

                # Quick relevance filter — at least one keyword must match
                if not any(kw in title or kw in summary for kw in keywords):
                    continue

                url     = getattr(entry, "link", "")
                content = getattr(entry, "summary", "")
                if len(content) < 300:
                    content = self._extract_body(url) or content

                pub = None
                if getattr(entry, "published_parsed", None):
                    try:
                        pub = datetime.fromtimestamp(mktime(entry.published_parsed))
                    except Exception:
                        pass

                articles.append(
                    self._normalize(
                        {
                            "url":          url,
                            "title":        getattr(entry, "title", ""),
                            "content":      content,
                            "published_at": pub,
                            "metadata":     {"feed_url": feed_url},
                        },
                        topic,
                    )
                )

            self._polite_sleep(0.3, 0.8)

        logger.info(f"[RSS] '{topic}' → {len(articles)} articles from feeds.")
        return articles

    # ── Body extraction ───────────────────────────────────────

    def _extract_body(self, url: str) -> str:
        """
        Fetch a URL and return the main article body text.
        Returns an empty string on any error.
        """
        if not url:
            return ""
        try:
            resp = requests.get(url, headers=_HEADERS, timeout=self.REQUEST_TIMEOUT)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "lxml")

            for tag in soup(_NOISE_TAGS):
                tag.decompose()

            # Heuristic: prefer <article>, then <main>, then a content-classed div
            container = (
                soup.find("article")
                or soup.find("main")
                or soup.find(
                    "div",
                    class_=re.compile(r"article|content|body|post|story", re.I),
                )
                or soup.body
            )

            if container:
                return " ".join(container.get_text(separator=" ").split())[:6000]
        except Exception as exc:
            logger.debug(f"[News] Body extraction failed for {url}: {exc}")
        return ""

    # ── Utility ───────────────────────────────────────────────

    @staticmethod
    def _parse_date(date_str: Optional[str]) -> Optional[datetime]:
        if not date_str:
            return None
        try:
            return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        except Exception:
            return None

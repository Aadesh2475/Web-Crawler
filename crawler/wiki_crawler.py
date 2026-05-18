"""
Wikipedia crawler using the Wikimedia REST API.

Uses the official /w/api.php endpoint — no API key required.
Fetches full plain-text page extracts for each topic.
"""

import requests
from datetime import datetime
from typing import Any, Dict, List, Optional

from crawler.base_crawler import BaseCrawler
from utils.logger import get_logger

logger = get_logger(__name__)

_WIKI_API   = "https://en.wikipedia.org/w/api.php"
_USER_AGENT = "WebMiningBot/1.0 (educational; https://github.com/webmining-pipeline)"


class WikiCrawler(BaseCrawler):
    """Ingestion agent for Wikipedia articles."""

    SOURCE_NAME     = "wikipedia"
    REQUEST_TIMEOUT = 15

    def __init__(self, config: dict):
        super().__init__(config)
        wiki_cfg          = config["sources"]["wikipedia"]
        self.enabled      = wiki_cfg.get("enabled", True)
        self.max_pages    = wiki_cfg.get("max_pages_per_topic", 5)
        self.language     = wiki_cfg.get("language", "en")
        self._api_url     = f"https://{self.language}.wikipedia.org/w/api.php"
        self._headers     = {"User-Agent": _USER_AGENT}

    # ── Public ────────────────────────────────────────────────

    def fetch(self, topic: str) -> List[Dict[str, Any]]:
        if not self.enabled:
            return []

        titles   = self._search(topic)
        articles = []

        for title in titles[: self.max_pages * 2]:           # fetch extra, filter short
            article = self._fetch_page(title, topic)
            if article:
                articles.append(article)
            if len(articles) >= self.max_pages:
                break
            self._polite_sleep(0.5, 1.2)

        logger.info(f"[Wikipedia] '{topic}' → {len(articles)} pages fetched.")
        return articles

    # ── Search ────────────────────────────────────────────────

    def _search(self, topic: str) -> List[str]:
        """Return a list of page titles matching *topic*."""
        try:
            resp = requests.get(
                self._api_url,
                params={
                    "action":   "query",
                    "list":     "search",
                    "srsearch": topic,
                    "srlimit":  self.max_pages * 3,
                    "format":   "json",
                    "srprop":   "snippet",
                },
                headers=self._headers,
                timeout=self.REQUEST_TIMEOUT,
            )
            resp.raise_for_status()
            items = resp.json().get("query", {}).get("search", [])
            return [item["title"] for item in items]
        except Exception as exc:
            logger.error(f"[Wikipedia] Search failed for '{topic}': {exc}")
            return []

    # ── Page fetch ────────────────────────────────────────────

    def _fetch_page(self, title: str, topic: str) -> Optional[Dict[str, Any]]:
        """Fetch plain-text extract + canonical URL for *title*."""
        try:
            resp = requests.get(
                self._api_url,
                params={
                    "action":      "query",
                    "titles":      title,
                    "prop":        "extracts|info",
                    "exlimit":     1,
                    "explaintext": True,        # Plain text, no HTML
                    "inprop":      "url",
                    "format":      "json",
                    "redirects":   True,
                },
                headers=self._headers,
                timeout=self.REQUEST_TIMEOUT,
            )
            resp.raise_for_status()
            pages = resp.json().get("query", {}).get("pages", {})
        except Exception as exc:
            logger.error(f"[Wikipedia] Page fetch failed for '{title}': {exc}")
            return None

        for page_id, page in pages.items():
            if page_id == "-1":
                continue

            content = page.get("extract", "").strip()
            if len(content) < 300:               # Skip stub / disambiguation pages
                continue

            url = page.get(
                "fullurl",
                f"https://en.wikipedia.org/wiki/{title.replace(' ', '_')}",
            )

            return self._normalize(
                {
                    "url":          url,
                    "title":        page.get("title", title),
                    "content":      content[:12_000],   # Cap at ~12k chars
                    "published_at": datetime.utcnow(),
                    "metadata": {
                        "page_id": page_id,
                        "touched": page.get("touched"),
                    },
                },
                topic,
            )
        return None

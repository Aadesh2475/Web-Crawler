"""
Reddit crawler using Reddit's **free JSON API** — no API key required.

Reddit exposes every subreddit's listings as JSON by appending `.json`
to any URL, e.g.:
    https://www.reddit.com/r/MachineLearning/hot.json?limit=25

This approach:
  ✅  No API key or OAuth needed
  ✅  Same data as the official API (titles, bodies, scores)
  ✅  Respects Reddit's standard rate-limit (1 req/s with a proper User-Agent)
  ⚠️  Reddit policy: must include a descriptive User-Agent header

Docs: https://www.reddit.com/dev/api/
"""

import time
from datetime import datetime
from typing import Any, Dict, List, Optional

import requests

from crawler.base_crawler import BaseCrawler
from utils.logger import get_logger

logger = get_logger(__name__)

_BASE_URL   = "https://www.reddit.com/r/{subreddit}/{sort}.json"
_USER_AGENT = "WebMiningBot/1.0 (educational project; python-requests)"
_HEADERS    = {"User-Agent": _USER_AGENT}
_TIMEOUT    = 15   # seconds


class RedditCrawler(BaseCrawler):
    """
    Ingestion agent for Reddit — uses the public JSON API (no credentials).

    Reddit allows unauthenticated JSON access at:
        https://www.reddit.com/r/<subreddit>/<sort>.json
    """

    SOURCE_NAME = "reddit"

    def __init__(self, config: dict):
        super().__init__(config)
        reddit_cfg         = config["sources"]["reddit"]
        self.enabled       = reddit_cfg.get("enabled", True)
        self.max_posts     = int(reddit_cfg.get("max_posts_per_subreddit", 25))
        self.post_type     = reddit_cfg.get("post_type", "hot")   # hot | new | top
        self.subreddit_map = reddit_cfg.get("subreddits", {})
        self._last_request = 0.0   # Track time of last request for rate-limiting

    # ── Public ────────────────────────────────────────────────

    def fetch(self, topic: str) -> List[Dict[str, Any]]:
        if not self.enabled:
            return []

        subreddits = self._subreddits_for_topic(topic)
        articles: List[Dict[str, Any]] = []

        for sub in subreddits:
            posts = self._fetch_subreddit(sub)
            for post in posts:
                content = self._build_content(post)
                if len(content) < 80:
                    continue
                articles.append(
                    self._normalize(
                        {
                            "url":          f"https://reddit.com{post.get('permalink', '')}",
                            "title":        post.get("title", ""),
                            "content":      content,
                            "published_at": datetime.utcfromtimestamp(
                                post.get("created_utc", 0)
                            ),
                            "metadata": {
                                "subreddit":    sub,
                                "score":        post.get("score", 0),
                                "upvote_ratio": post.get("upvote_ratio", 0),
                                "num_comments": post.get("num_comments", 0),
                                "post_id":      post.get("id", ""),
                            },
                        },
                        topic,
                    )
                )

        unique = self._deduplicate(articles)
        logger.info(
            f"[Reddit JSON] '{topic}' → {len(unique)} posts "
            f"from {len(subreddits)} subreddits."
        )
        return unique

    # ── Subreddit fetch ───────────────────────────────────────

    def _fetch_subreddit(self, subreddit: str) -> List[Dict[str, Any]]:
        """
        Fetch posts from a single subreddit via the JSON API.
        Enforces a 1-second gap between requests (Reddit rate-limit guidance).
        """
        url = _BASE_URL.format(subreddit=subreddit, sort=self.post_type)
        params = {"limit": min(self.max_posts, 100), "raw_json": 1}

        # ── Polite rate-limiting ──────────────────────────────
        elapsed = time.monotonic() - self._last_request
        if elapsed < 1.0:
            time.sleep(1.0 - elapsed)

        try:
            resp = requests.get(
                url,
                params  = params,
                headers = _HEADERS,
                timeout = _TIMEOUT,
            )
            self._last_request = time.monotonic()

            if resp.status_code == 404:
                logger.warning(f"[Reddit JSON] r/{subreddit} not found (404).")
                return []
            if resp.status_code == 403:
                logger.warning(f"[Reddit JSON] r/{subreddit} is private/banned (403).")
                return []

            resp.raise_for_status()
            data  = resp.json()
            posts = [
                child["data"]
                for child in data.get("data", {}).get("children", [])
                if child.get("kind") == "t3"    # t3 = link/post
            ]
            logger.debug(f"[Reddit JSON] r/{subreddit} → {len(posts)} posts.")
            return posts

        except requests.exceptions.RequestException as exc:
            logger.warning(f"[Reddit JSON] Request error for r/{subreddit}: {exc}")
            return []
        except (KeyError, ValueError) as exc:
            logger.warning(f"[Reddit JSON] Parse error for r/{subreddit}: {exc}")
            return []

    # ── Content assembly ──────────────────────────────────────

    @staticmethod
    def _build_content(post: Dict[str, Any]) -> str:
        """
        Build a text blob from:
          1. Post title
          2. Self-text (if any)

        Note: comment fetching via the JSON API requires a second request
        per post. We skip it here to stay within rate limits; the title
        + selftext is usually sufficient for summarisation.
        """
        parts = [post.get("title", "")]

        selftext = (post.get("selftext") or "").strip()
        # Ignore "[removed]" / "[deleted]" placeholders
        if selftext and selftext not in ("[removed]", "[deleted]"):
            parts.append(selftext[:2_500])

        # Include URL if it's a link post (not a self-post)
        if not post.get("is_self") and post.get("url"):
            parts.append(f"Link: {post['url']}")

        return "\n\n".join(p for p in parts if p)

    # ── Topic → subreddit mapping ─────────────────────────────

    def _subreddits_for_topic(self, topic: str) -> List[str]:
        """Return configured subreddits for *topic*, or a generic fallback."""
        if topic in self.subreddit_map:
            return self.subreddit_map[topic]
        # Generic fallback derived from topic keywords
        slug = topic.lower().replace(" ", "").replace("-", "")
        return [slug, "worldnews", "technology", "science"]

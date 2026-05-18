"""
Social crawler — fetches posts from X (Twitter), Reddit, and other social platforms.
Uses RSS-based extraction to avoid heavy API auth requirements.
"""

import os
import re
from datetime import datetime
from time import mktime
from typing import Any, Dict, List, Optional

import feedparser
import requests
from bs4 import BeautifulSoup

from crawler.base_crawler import BaseCrawler
from utils.logger import get_logger

logger = get_logger(__name__)

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}

class SocialCrawler(BaseCrawler):
    """Ingestion agent for social media posts (X/Twitter, Reddit, etc)."""

    SOURCE_NAME = "social"
    
    # Nitter instances are good for public Twitter RSS
    NITTER_INSTANCES = [
        "https://nitter.net",
        "https://nitter.cz",
        "https://nitter.it",
        "https://nitter.sethforprivacy.com"
    ]

    def __init__(self, config: dict):
        super().__init__(config)
        self.enabled = config.get("sources", {}).get("social", {}).get("enabled", True)
        self.max_posts = 50

    def fetch(self, topic: str) -> List[Dict[str, Any]]:
        if not self.enabled:
            return []

        posts: List[Dict[str, Any]] = []
        
        # 1. Fetch from Apify (Real Data with metrics)
        posts.extend(self._fetch_apify(topic))
        
        # 2. Fetch from X (Twitter) via Nitter (Fallback)
        posts.extend(self._fetch_twitter_nitter(topic))
        
        # 3. Fetch from Reddit
        posts.extend(self._fetch_reddit(topic))

        # Filter by relevance before deduplicating
        # Threshold lowered to 0.1 to allow broader social context
        relevant_posts = [p for p in posts if self._calculate_relevance(p, topic) >= 0.1]
        
        unique = self._deduplicate(relevant_posts)
        logger.info(f"[Social] '{topic}' → {len(unique)} relevant social posts collected (filtered from {len(posts)}).")
        return unique[:self.max_posts]

    def _calculate_relevance(self, post: Dict[str, Any], topic: str) -> float:
        """
        Calculate a relevance score (0..1).
        Higher score for:
        - Keyword density in content
        - Engagement metrics (likes, views)
        - Recency
        """
        content = post.get("content", "").lower()
        topic_lower = topic.lower()
        
        if not content: return 0.0
        
        # 1. Keyword check
        if topic_lower not in content:
            return 0.1 # Low baseline if keyword missing from content
            
        score = 0.5
        
        # 2. Engagement boost (Social only)
        meta = post.get("metadata", {})
        likes = meta.get("likes", 0)
        views = meta.get("views", 0)
        
        if likes > 100: score += 0.2
        elif likes > 10: score += 0.1
        
        if views > 1000: score += 0.1
        
        # 3. Content quality (length)
        if len(content) < 30: score -= 0.2 # Too short (likely spam/low effort)
        
        return min(1.0, score)

    def _fetch_apify(self, topic: str) -> List[Dict[str, Any]]:
        """Fetch real social posts from Apify dataset."""
        url = os.getenv("APIFY_DATASET_URL")
        if not url:
            return []
            
        posts = []
        try:
            resp = requests.get(url, timeout=15)
            resp.raise_for_status()
            data = resp.json()
            
            # Filter posts by topic keyword in text
            topic_lower = topic.lower()
            
            for item in data:
                text = item.get("text") or item.get("fullText") or ""
                if topic_lower not in text.lower():
                    continue
                    
                # Extract image
                img_url = None
                media = item.get("media", [])
                if media and len(media) > 0:
                    img_url = media[0]
                
                author = item.get("author", {})
                username = author.get("userName") or author.get("name") or "User"
                
                posts.append(self._normalize({
                    "url": item.get("url"),
                    "title": f"Post by {username}",
                    "content": self._clean_text(text),
                    "published_at": self._parse_apify_date(item.get("createdAt")),
                    "source": item.get("type", "social"),
                    "metadata": {
                        "username": username,
                        "platform": item.get("type", "Social").capitalize(),
                        "image_url": img_url,
                        "likes": item.get("likeCount", 0),
                        "replies": item.get("replyCount", 0),
                        "retweets": item.get("retweetCount", 0),
                        "views": item.get("viewCount", 0),
                        "is_social": True
                    }
                }, topic))
        except Exception as e:
            logger.warning(f"[Social/Apify] Failed to fetch: {e}")
            
        return posts

    def _clean_text(self, text: str) -> str:
        """Remove URLs, mentions, and excessive whitespace."""
        if not text: return ""
        # Remove URLs
        text = re.sub(r'https?://\S+', '', text)
        # Remove multiple newlines/spaces
        text = re.sub(r'\s+', ' ', text).strip()
        # Remove any leading/trailing garbage
        return text

    def _parse_apify_date(self, date_str: Optional[str]) -> Optional[datetime]:
        if not date_str: return None
        try:
            # Apify dates: "Thu May 14 18:35:46 +0000 2026"
            return datetime.strptime(date_str, "%a %b %d %H:%M:%S %z %Y")
        except:
            return None

    def _fetch_twitter_nitter(self, topic: str) -> List[Dict[str, Any]]:
        """Fetch tweets using Nitter's RSS feed search."""
        posts = []
        # Try primary instance
        base_url = self.NITTER_INSTANCES[0]
        # nitter search rss: /search?f=tweets&q={topic}&rss=1
        rss_url = f"{base_url}/search?f=tweets&q={topic}&rss=1"
        
        try:
            feed = feedparser.parse(rss_url)
            for entry in feed.entries[:20]:
                content = getattr(entry, "summary", "")
                # Nitter summary usually contains HTML. Clean it.
                soup = BeautifulSoup(content, "lxml")
                text = self._clean_text(soup.get_text())
                
                # Extract image if any
                img_url = None
                img_tag = soup.find("img")
                if img_tag and img_tag.get("src"):
                    src = img_tag["src"]
                    if src.startswith("/"): src = base_url + src
                    img_url = src

                # Author is usually in the title: "Username (@handle)"
                author = getattr(entry, "author", "Unknown")
                
                posts.append(self._normalize({
                    "url": getattr(entry, "link", ""),
                    "title": f"Post by {author}",
                    "content": text,
                    "published_at": self._parse_rss_date(entry),
                    "source": "x",
                    "metadata": {
                        "username": author,
                        "platform": "X",
                        "image_url": img_url,
                        "is_social": True
                    }
                }, topic))
        except Exception as e:
            logger.warning(f"[Social/X] Failed to fetch from Nitter: {e}")
            
        return posts

    def _deduplicate(self, articles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Enhanced deduplication: 
        - Strips query params from URLs
        - Checks for near-duplicate content
        """
        import hashlib
        seen_urls: set = set()
        seen_hashes: set = set()
        unique: List[Dict[str, Any]] = []
        
        for art in articles:
            url = art.get("url", "")
            if not url: continue
            
            # Clean URL (strip tracking params)
            clean_url = url.split("?")[0].rstrip("/")
            
            # Content hash for near-duplicate detection
            content = art.get("content", "")
            content_hash = hashlib.md5(content.encode()).hexdigest() if content else None
            
            if clean_url not in seen_urls and (not content_hash or content_hash not in seen_hashes):
                seen_urls.add(clean_url)
                if content_hash: seen_hashes.add(content_hash)
                unique.append(art)
                
        return unique

    def _fetch_reddit(self, topic: str) -> List[Dict[str, Any]]:
        """Fetch posts from Reddit via search RSS."""
        posts = []
        rss_url = f"https://www.reddit.com/search.rss?q={topic}&sort=new"
        
        try:
            # Reddit requires a custom User-Agent to avoid 429
            resp = requests.get(rss_url, headers=_HEADERS, timeout=10)
            feed = feedparser.parse(resp.text)
            
            for entry in feed.entries[:20]:
                content = getattr(entry, "content", [{}])[0].get("value", "")
                soup = BeautifulSoup(content, "lxml")
                
                # Extract image
                img_url = None
                links = soup.find_all("a")
                for link in links:
                    href = link.get("href", "")
                    if any(href.endswith(ext) for ext in [".jpg", ".png", ".gif", ".jpeg"]):
                        img_url = href
                        break

                posts.append(self._normalize({
                    "url": getattr(entry, "link", ""),
                    "title": getattr(entry, "title", ""),
                    "content": self._clean_text(soup.get_text()[:1000]),
                    "published_at": self._parse_rss_date(entry),
                    "source": "reddit",
                    "metadata": {
                        "username": getattr(entry, "author", "redditor"),
                        "platform": "Reddit",
                        "image_url": img_url,
                        "is_social": True
                    }
                }, topic))
        except Exception as e:
            logger.warning(f"[Social/Reddit] Failed to fetch: {e}")
            
        return posts

    def _parse_rss_date(self, entry: Any) -> Optional[datetime]:
        if hasattr(entry, "published_parsed") and entry.published_parsed:
            return datetime.fromtimestamp(mktime(entry.published_parsed))
        return None

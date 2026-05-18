import datetime
import requests
import xml.etree.ElementTree as ET
from typing import Any, Dict, List

from .base_crawler import BaseCrawler
from utils.logger import get_logger

logger = get_logger(__name__)

class HackerNewsCrawler(BaseCrawler):
    """
    Fetches top stories from Hacker News using the free Algolia HN Search API.
    Perfect for tech, startup, and software engineering data.
    """
    SOURCE_NAME = "hackernews"

    def fetch(self, topic: str) -> List[Dict[str, Any]]:
        url = f"https://hn.algolia.com/api/v1/search?query={topic}&tags=story&hitsPerPage=30"
        articles = []
        try:
            resp = requests.get(url, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                for hit in data.get("hits", []):
                    title = hit.get("title", "")
                    content = hit.get("story_text", "") or title
                    story_url = hit.get("url") or f"https://news.ycombinator.com/item?id={hit.get('objectID')}"
                    author = hit.get("author", "Unknown")
                    created_at = hit.get("created_at")

                    if not title:
                        continue

                    raw = {
                        "url": story_url,
                        "title": title,
                        "content": content,
                        "published_at": datetime.datetime.strptime(created_at, "%Y-%m-%dT%H:%M:%S.%fZ") if created_at else datetime.datetime.utcnow(),
                        "metadata": {
                            "author": author, 
                            "points": hit.get("points"),
                            "num_comments": hit.get("num_comments")
                        }
                    }
                    articles.append(self._normalize(raw, topic))
        except Exception as e:
            logger.error(f"HackerNewsCrawler error for topic '{topic}': {e}")
            
        return self._deduplicate(articles)


class ArxivCrawler(BaseCrawler):
    """
    Fetches peer-reviewed academic papers and abstracts directly from Cornell's ArXiv API.
    Perfect for machine learning, quantum physics, and advanced science categories.
    """
    SOURCE_NAME = "arxiv"

    def fetch(self, topic: str) -> List[Dict[str, Any]]:
        url = f"http://export.arxiv.org/api/query?search_query=all:{topic}&start=0&max_results=20"
        articles = []
        try:
            resp = requests.get(url, timeout=10)
            if resp.status_code == 200:
                root = ET.fromstring(resp.text)
                ns = {'arxiv': 'http://www.w3.org/2005/Atom'}
                
                for entry in root.findall('arxiv:entry', ns):
                    title = entry.find('arxiv:title', ns)
                    summary = entry.find('arxiv:summary', ns)
                    link = entry.find('arxiv:id', ns)
                    published = entry.find('arxiv:published', ns)
                    author_tags = entry.findall('arxiv:author', ns)
                    
                    if title is None or summary is None or link is None:
                        continue

                    title_text = title.text.replace('\n', ' ').strip()
                    summary_text = summary.text.replace('\n', ' ').strip()
                    authors = [a.find('arxiv:name', ns).text for a in author_tags if a.find('arxiv:name', ns) is not None]

                    raw = {
                        "url": link.text,
                        "title": title_text,
                        "content": summary_text,
                        "published_at": datetime.datetime.strptime(published.text, "%Y-%m-%dT%H:%M:%SZ") if published is not None else datetime.datetime.utcnow(),
                        "metadata": {
                            "author": ", ".join(authors), 
                            "pdf_url": link.text.replace("abs", "pdf")
                        }
                    }
                    articles.append(self._normalize(raw, topic))
        except Exception as e:
            logger.error(f"ArxivCrawler error for topic '{topic}': {e}")
            
        return self._deduplicate(articles)


class FinanceCrawler(BaseCrawler):
    """
    Fetches real-time financial market news and stock data using the 'yfinance' library.
    Perfect for finance and economic topics.
    Requires: pip install yfinance
    """
    SOURCE_NAME = "finance"

    def fetch(self, topic: str) -> List[Dict[str, Any]]:
        try:
            import yfinance as yf
        except ImportError:
            logger.error("yfinance is not installed. Run: pip install yfinance")
            return []

        # Map broad topics to representative market indices/ETFs to fetch related news
        ticker_symbol = "SPY" # S&P 500 default
        topic_lower = topic.lower()
        if "tech" in topic_lower or "ai" in topic_lower: 
            ticker_symbol = "QQQ" # NASDAQ
        elif "finance" in topic_lower or "bank" in topic_lower: 
            ticker_symbol = "XLF" # Financials
        elif "health" in topic_lower:
            ticker_symbol = "XLV" # Healthcare
        
        articles = []
        try:
            ticker = yf.Ticker(ticker_symbol)
            news = ticker.news
            for item in news:
                title = item.get("title", "")
                link = item.get("link", "")
                publisher = item.get("publisher", "Yahoo Finance")
                published_ts = item.get("providerPublishTime")
                
                if not title or not link:
                    continue
                
                raw = {
                    "url": link,
                    "title": title,
                    "content": title, # Yahoo finance news API provides headlines as primary content
                    "published_at": datetime.datetime.fromtimestamp(published_ts) if published_ts else datetime.datetime.utcnow(),
                    "metadata": {"author": publisher, "related_tickers": item.get("relatedTickers", [])}
                }
                articles.append(self._normalize(raw, topic))
        except Exception as e:
            logger.error(f"FinanceCrawler error for topic '{topic}': {e}")
            
        return self._deduplicate(articles)


class NYTimesCrawler(BaseCrawler):
    """
    Fetches high-impact journalism from The New York Times using their Article Search API.
    """
    SOURCE_NAME = "nytimes"

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        import os
        self.api_key = os.getenv("NYTIMES_API_KEY", config.get("sources", {}).get("nytimes", {}).get("api_key", ""))
        self.enabled = config.get("sources", {}).get("nytimes", {}).get("enabled", True)

    def fetch(self, topic: str) -> List[Dict[str, Any]]:
        if not self.enabled or not self.api_key:
            return []
        
        url = f"https://api.nytimes.com/svc/search/v2/articlesearch.json?q={topic}&api-key={self.api_key}"
        articles = []
        try:
            resp = requests.get(url, timeout=12)
            if resp.status_code == 200:
                data = resp.json()
                docs = data.get("response", {}).get("docs", [])
                for doc in docs:
                    title = doc.get("headline", {}).get("main", "")
                    abstract = doc.get("abstract", "") or doc.get("snippet", "")
                    url_link = doc.get("web_url", "")
                    pub_date = doc.get("pub_date")
                    
                    if not title or not url_link:
                        continue

                    raw = {
                        "url": url_link,
                        "title": title,
                        "content": abstract,
                        "published_at": datetime.datetime.fromisoformat(pub_date.replace("Z", "+00:00")) if pub_date else datetime.datetime.utcnow(),
                        "metadata": {
                            "author": doc.get("byline", {}).get("original", "NYT Staff"),
                            "section": doc.get("section_name", "General"),
                            "image_url": f"https://www.nytimes.com/{doc['multimedia'][0]['url']}" if doc.get("multimedia") else None
                        }
                    }
                    articles.append(self._normalize(raw, topic))
        except Exception as e:
            logger.error(f"NYTimesCrawler error for topic '{topic}': {e}")
            
        return self._deduplicate(articles)


class GNewsCrawler(BaseCrawler):
    """
    Fetches global news from GNews API. Great for real-time topical data.
    """
    SOURCE_NAME = "gnews"

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        import os
        self.api_key = os.getenv("GNEWS_API_KEY", config.get("sources", {}).get("gnews", {}).get("api_key", ""))
        self.enabled = config.get("sources", {}).get("gnews", {}).get("enabled", True)

    def fetch(self, topic: str) -> List[Dict[str, Any]]:
        if not self.enabled or not self.api_key:
            return []
        
        url = f"https://gnews.io/api/v4/search?q={topic}&lang=en&max=10&token={self.api_key}"
        articles = []
        try:
            resp = requests.get(url, timeout=12)
            if resp.status_code == 200:
                data = resp.json()
                for item in data.get("articles", []):
                    raw = {
                        "url": item.get("url", ""),
                        "title": item.get("title", ""),
                        "content": item.get("description", "") + " " + item.get("content", ""),
                        "published_at": datetime.datetime.fromisoformat(item.get("publishedAt").replace("Z", "+00:00")),
                        "metadata": {
                            "author": item.get("source", {}).get("name", "GNews"),
                            "image_url": item.get("image")
                        }
                    }
                    articles.append(self._normalize(raw, topic))
        except Exception as e:
            logger.error(f"GNewsCrawler error for topic '{topic}': {e}")
            
        return self._deduplicate(articles)


class PolygonCrawler(BaseCrawler):
    """
    Fetches specialized financial news from Polygon.io.
    """
    SOURCE_NAME = "polygon"

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        import os
        self.api_key = os.getenv("POLYGON_API_KEY", config.get("sources", {}).get("polygon", {}).get("api_key", ""))
        self.enabled = config.get("sources", {}).get("polygon", {}).get("enabled", True)

    def fetch(self, topic: str) -> List[Dict[str, Any]]:
        if not self.enabled or not self.api_key:
            return []
        
        # Map topics to some representative tickers for better results, or use empty ticker for general news
        ticker = ""
        topic_l = topic.lower()
        if "tech" in topic_l: ticker = "AAPL,MSFT,NVDA"
        elif "finance" in topic_l: ticker = "JPM,GS,V"
        elif "ai" in topic_l: ticker = "MSFT,GOOGL,AMZN"

        url = f"https://api.polygon.io/v2/reference/news?ticker={ticker}&limit=10&apiKey={self.api_key}"
        articles = []
        try:
            resp = requests.get(url, timeout=12)
            if resp.status_code == 200:
                data = resp.json()
                for item in data.get("results", []):
                    raw = {
                        "url": item.get("article_url", ""),
                        "title": item.get("title", ""),
                        "content": item.get("description", "") or item.get("title", ""),
                        "published_at": datetime.datetime.fromisoformat(item.get("published_utc").replace("Z", "+00:00")),
                        "metadata": {
                            "author": item.get("author", "Polygon.io"),
                            "image_url": item.get("image_url"),
                            "tickers": item.get("tickers", [])
                        }
                    }
                    articles.append(self._normalize(raw, topic))
        except Exception as e:
            logger.error(f"PolygonCrawler error for topic '{topic}': {e}")
            
        return self._deduplicate(articles)

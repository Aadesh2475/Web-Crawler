import os
import redis
import json
from datetime import datetime
from utils.logger import get_logger

logger = get_logger(__name__)

class RedisClient:
    def __init__(self):
        url = os.getenv("REDIS_URL")
        if not url:
            logger.warning("REDIS_URL not found in environment. Redis features disabled.")
            self.client = None
            return
            
        try:
            # Handle possible quotes in REDIS_URL from .env
            url = url.strip('"').strip("'")
            self.client = redis.from_url(url, decode_responses=True)
            self.client.ping()
            logger.info("Connected to Redis successfully.")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            self.client = None

    def push_event(self, event: dict, limit: int = 100):
        if not self.client: return
        try:
            event_json = json.dumps(event)
            self.client.lpush("pipeline_events", event_json)
            self.client.ltrim("pipeline_events", 0, limit - 1)
        except Exception as e:
            logger.error(f"Redis lpush failed: {e}")

    def get_events(self, limit: int = 100):
        if not self.client: return []
        try:
            events = self.client.lrange("pipeline_events", 0, limit - 1)
            # Return in chronological order
            return [json.loads(e) for e in reversed(events)]
        except Exception as e:
            logger.error(f"Redis lrange failed: {e}")
            return []

    def clear_events(self):
        if not self.client: return
        self.client.delete("pipeline_events")

    def clear_cache(self, prefix: str = "recent_feed_"):
        if not self.client: return
        try:
            keys = self.client.keys(f"{prefix}*")
            if keys:
                self.client.delete(*keys)
                logger.info(f"Cleared {len(keys)} cache keys with prefix '{prefix}'")
        except Exception as e:
            logger.error(f"Redis clear_cache failed: {e}")

redis_client = RedisClient()

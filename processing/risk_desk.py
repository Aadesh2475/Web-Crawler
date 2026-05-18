import os
import json
from datetime import datetime, timedelta
from utils.logger import get_logger
from utils.redis_client import redis_client
from storage.db import Article
from rag.gemini_client import GeminiClient

logger = get_logger(__name__)

class RiskDeskEngine:
    def __init__(self, db_manager):
        self.db = db_manager
        self.gemini = GeminiClient()

    def generate_risk_forecast(self, topic: str = "", force_refresh: bool = False) -> dict:
        cache_key = f"risk_desk_forecast:{topic}"

        # Check cache unless forced refresh
        if not force_refresh:
            cached = redis_client.get(cache_key)
            if cached:
                try:
                    logger.info(f"Returning cached risk forecast for topic: {topic}")
                    return json.loads(cached)
                except Exception as e:
                    logger.error(f"Failed to load cached risk forecast: {e}")

        # Fetch articles from the last 3 days
        cutoff = datetime.utcnow() - timedelta(days=3)
        with self.db.SessionFactory() as session:
            query = session.query(Article).filter(
                Article.is_relevant == True,
                Article.created_at >= cutoff
            )
            if topic:
                query = query.filter(Article.topic == topic)

            # Take top 15 by relevance & creation time
            articles = query.order_by(Article.relevance_score.desc(), Article.created_at.desc()).limit(15).all()

        if not articles:
            return {
                "global_risk_level": "medium",
                "risk_score": 50,
                "summary": "Insufficient intelligence signals to construct a highly reliable risk matrix. Standard monitoring active.",
                "key_clusters": [],
                "risk_events": [],
                "forecast_text": "### 📉 Intelligence Signal Scarcity\nNo significant cluster signals were detected in the database within the past 72 hours. Standard systemic health check is operational, but predictive capabilities are limited. Triggering fresh OSINT crawler cycles is recommended.",
                "last_updated": datetime.utcnow().isoformat() + "Z"
            }

        # Build prompt inputs
        signals = []
        for i, art in enumerate(articles, 1):
            sent = art.sentiment_score or 0.0
            signals.append({
                "index": i,
                "title": art.title,
                "summary": art.summary or art.cleaned_content[:200],
                "topic": art.topic,
                "sentiment": sent,
                "published_at": art.published_at.isoformat() if art.published_at else ""
            })

        prompt = f"""
Analyze the following recently crawled intelligence signals and generate a highly rigorous, forward-looking 24-hour predictive risk desk intelligence forecast.

INTELLIGENCE SIGNALS:
{json.dumps(signals, indent=2)}

You MUST output ONLY a valid JSON object matching the following structure:
{{
  "global_risk_level": "low" | "medium" | "high" | "critical",
  "risk_score": <int between 0 and 100>,
  "summary": "Concise 2-3 sentence overview of the global geopolitical/financial risk landscape.",
  "key_clusters": [
    {{
      "theme": "Thematic name of the cluster, e.g. Taiwan Strait Trade Friction",
      "signal_velocity": "Low" | "Medium" | "High",
      "sentiment": <float between -1.0 and 1.0>,
      "summary": "Analysis of what this means."
    }}
  ],
  "risk_events": [
    {{
      "title": "Title of the prediction/risk event",
      "probability": <int percentage between 0 and 100>,
      "timeframe": "Expected timeframe, e.g., 24-48 Hours",
      "impact": "Low" | "Medium" | "High" | "Critical",
      "geography": "Primary geographic/sector focus",
      "description": "Comprehensive analytical prediction description.",
      "hedging_strategy": "Actionable hedging or mitigation recommendation for asset managers or policy desks."
    }}
  ],
  "forecast_text": "A detailed, premium executive intelligence briefing formatted in beautiful, concise Markdown. Include section headings, bold key terms, and bullet points. Focus on systemic risk factors, macro-economic impacts, and direct implications."
}}

Ensure the JSON is strictly valid. Do not wrap it in ```json ... ``` tags. Output ONLY the raw JSON string.
"""

        system_instruction = "You are an elite geopolitical and financial risk intelligence analyst for a tier-1 investment bank and intelligence desk (similar to Janes, Bloomberg, or Stratfor). Your goal is to analyze recent global news signals and generate a highly rigorous, forward-looking 24-hour predictive risk desk intelligence briefing. Be specific, analytical, and highly structured. Always return valid, parsable JSON."

        logger.info(f"Generating risk forecast via Gemini for topic: {topic} ...")
        raw_response = self.gemini.generate_content(prompt, system_instruction)

        # Clean up any potential markdown wrap if Gemini ignored instructions
        clean_response = raw_response.strip()
        if clean_response.startswith("```json"):
            clean_response = clean_response[7:]
        if clean_response.endswith("```"):
            clean_response = clean_response[:-3]
        clean_response = clean_response.strip()

        try:
            forecast = json.loads(clean_response)
            forecast["last_updated"] = datetime.utcnow().isoformat() + "Z"

            # Cache in Redis with 1 hour TTL
            redis_client.setex(cache_key, 3600, json.dumps(forecast))
            logger.info("Successfully generated and cached risk forecast.")
            return forecast
        except Exception as e:
            logger.error(f"Failed to parse Gemini risk forecast JSON: {e}\nRaw response:\n{raw_response}")
            # Fallback
            return {
                "global_risk_level": "medium",
                "risk_score": 55,
                "summary": "An error occurred while synthesizing the predictive risk matrix. Basic monitoring is operational.",
                "key_clusters": [],
                "risk_events": [],
                "forecast_text": f"### ⚠️ Forecast Synthesis Interrupted\nFailed to parse predictive risk intelligence payload.\n\n**Details**: {str(e)}",
                "last_updated": datetime.utcnow().isoformat() + "Z"
            }

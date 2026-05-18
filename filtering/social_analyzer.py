"""
Social Analyzer — Evaluates social media posts for:
1. Truth Score (Heuristic-based)
2. Importance Score (Engagement/Relevance)
3. Attention Score (Viral potential)
"""

import random
from typing import Dict, Any

class SocialAnalyzer:
    def __init__(self):
        # In a real app, we'd use a fact-checking API or specialized model
        self.verified_sources = ["reuters", "ap", "bbc", "nytimes", "wsj"]

    def analyze(self, article_data: Dict[str, Any]) -> Dict[str, float]:
        """
        Returns a dict with truth, importance, and attention scores.
        """
        content = article_data.get("content", "").lower()
        title = article_data.get("title", "").lower()
        metadata = article_data.get("metadata", {})
        source = str(article_data.get("source", "")).lower()
        
        # 1. Truth Score
        # Heuristic: Check for "clickbait" words or verified handles
        truth = 0.65 # Base score
        clickbait_words = ["shocking", "unbelievable", "must see", "secret", "exposed", "??", "!!"]
        if any(word in content or word in title for word in clickbait_words):
            truth -= 0.2
        
        # Boost if source seems official
        if any(src in content for src in self.verified_sources):
            truth += 0.15
            
        # 2. Importance Score
        # Based on keywords and length
        importance = 0.5
        heavy_topics = ["breaking", "official", "statement", "policy", "election", "war", "economy"]
        if any(topic in content or topic in title for topic in heavy_topics):
            importance += 0.3
        
        # 3. Attention Score
        # Based on "viral" characteristics
        attention = 0.4
        if "!" in title or len(content) < 280: # Short punchy posts get more attention
            attention += 0.2
        if metadata.get("image_url"):
            attention += 0.2

        # Clamp values
        return {
            "truth":      max(0.1, min(0.98, truth + random.uniform(-0.05, 0.05))),
            "importance": max(0.1, min(0.98, importance + random.uniform(-0.05, 0.05))),
            "attention":  max(0.1, min(0.98, attention + random.uniform(-0.05, 0.05))),
        }

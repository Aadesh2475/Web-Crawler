"""
Sentiment analyzer using VADER (Valence Aware Dictionary and sEntiment Reasoner).

VADER is rule-based, requires no model download, and works well for short
news-style text. Ships with NLTK — already in requirements.

Scores
------
  compound  : float  [-1.0 (most negative) .. +1.0 (most positive)]
  label     : str    "positive" | "neutral" | "negative"
"""

from typing import Any, Dict, List, Tuple

from utils.logger import get_logger

logger = get_logger(__name__)

_THRESHOLD_POS =  0.05
_THRESHOLD_NEG = -0.05


def _get_sia():
    """Lazy-load VADER SentimentIntensityAnalyzer (downloads ~30 KB data once)."""
    try:
        from nltk.sentiment.vader import SentimentIntensityAnalyzer  # type: ignore
        import nltk  # type: ignore
        try:
            return SentimentIntensityAnalyzer()
        except LookupError:
            nltk.download("vader_lexicon", quiet=True)
            return SentimentIntensityAnalyzer()
    except Exception as exc:
        logger.warning(f"[Sentiment] VADER unavailable: {exc}")
        return None


class SentimentAnalyzer:
    """
    Fast, zero-download sentiment scorer for article text.

    Usage
    -----
    >>> sa = SentimentAnalyzer()
    >>> score, label = sa.score("SpaceX launches new rocket!")
    # (0.62, "positive")
    """

    def __init__(self):
        self._sia = None

    def _get(self):
        if self._sia is None:
            self._sia = _get_sia()
        return self._sia

    def score(self, text: str) -> Tuple[float, str]:
        """
        Return (compound_score, label) for *text*.
        Falls back to (0.0, "neutral") on error.
        """
        if not text:
            return 0.0, "neutral"
        try:
            sia = self._get()
            if sia is None:
                return 0.0, "neutral"
            # Use first 1000 chars — VADER is fast but no need for full article
            scores = sia.polarity_scores(text[:1_000])
            compound = round(scores["compound"], 4)
            if compound >= _THRESHOLD_POS:
                label = "positive"
            elif compound <= _THRESHOLD_NEG:
                label = "negative"
            else:
                label = "neutral"
            return compound, label
        except Exception as exc:
            logger.debug(f"[Sentiment] Score failed: {exc}")
            return 0.0, "neutral"

    def score_batch(
        self, articles: List[Dict[str, Any]], text_key: str = "cleaned_content"
    ) -> List[Dict[str, Any]]:
        """
        Add `sentiment_score` and `sentiment_label` to each article dict.
        Returns the same list (mutated).
        """
        for article in articles:
            text = article.get(text_key) or article.get("summary", "")
            compound, label = self.score(text)
            article["sentiment_score"] = compound
            article["sentiment_label"] = label
        return articles

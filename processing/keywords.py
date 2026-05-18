"""
TF-IDF Keyword Extractor.

Extracts the top-N most distinctive keywords from an article's text using
TF-IDF scoring against a small in-memory corpus. No model download needed.

Usage
-----
>>> kw = KeywordExtractor()
>>> keywords = kw.extract("Some long article text...", top_n=8)
# Returns: ["machine learning", "neural network", ...]
"""

import re
from typing import List

from sklearn.feature_extraction.text import TfidfVectorizer  # type: ignore

from utils.logger import get_logger

logger = get_logger(__name__)

# Common stopwords (extend as needed)
_EXTRA_STOP = {
    "said", "say", "says", "also", "one", "two", "new", "year", "years",
    "time", "way", "like", "just", "make", "made", "going", "know", "get",
    "use", "used", "using", "people", "world", "including", "according",
    "according", "percent", "week", "month", "day", "first", "last",
}


class KeywordExtractor:
    """
    Lightweight TF-IDF keyword extractor.
    Works on a single document using character-level n-gram enrichment.
    """

    def __init__(self, top_n: int = 10):
        self.top_n = top_n

    def extract(self, text: str, top_n: int = None) -> List[str]:
        """
        Return top-N keywords from *text*.
        Falls back to empty list on any error.
        """
        top_n = top_n or self.top_n
        if not text or len(text.strip()) < 50:
            return []
        try:
            # Clean text
            clean = re.sub(r"[^a-zA-Z0-9\s]", " ", text.lower())
            clean = re.sub(r"\s+", " ", clean).strip()

            # Sentence-level TF-IDF: treat each sentence as a "document"
            sentences = [s.strip() for s in re.split(r"[.!?\n]", clean) if len(s.strip()) > 20]
            if len(sentences) < 2:
                sentences = [clean]  # single-doc fallback

            vectorizer = TfidfVectorizer(
                ngram_range   = (1, 2),    # unigrams + bigrams
                stop_words    = "english",
                max_features  = 500,
                min_df        = 1,
                token_pattern = r"[a-z][a-z]{2,}",  # min 3-char words
            )
            tfidf_matrix = vectorizer.fit_transform(sentences)

            # Sum TF-IDF scores across all sentences (document-level score)
            scores = tfidf_matrix.sum(axis=0).A1
            feature_names = vectorizer.get_feature_names_out()

            # Rank and filter
            ranked = sorted(
                zip(feature_names, scores),
                key=lambda x: x[1],
                reverse=True,
            )

            keywords = [
                kw for kw, _ in ranked
                if kw not in _EXTRA_STOP and len(kw) > 3
            ][:top_n]

            return keywords

        except Exception as exc:
            logger.debug(f"[Keywords] Extraction failed: {exc}")
            return []

    def extract_batch(self, articles: list, text_key: str = "cleaned_content") -> list:
        """
        Add `keywords` list to each article dict in-place.
        Returns the same list.
        """
        for article in articles:
            text = article.get(text_key) or article.get("raw_content", "")
            article["keywords"] = self.extract(text)
        return articles

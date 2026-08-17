"""
Text cleaning and normalisation agent.

Pipeline per article
--------------------
1. Strip HTML tags (BeautifulSoup)
2. Normalise unicode (NFKD → ASCII)
3. Remove web boilerplate (newsletter prompts, cookie notices, etc.)
4. Collapse whitespace / blank lines
5. Enforce minimum content length filter
"""

import re
import unicodedata
from typing import Any, Dict, List

from bs4 import BeautifulSoup

from utils.logger import get_logger

logger = get_logger(__name__)

# ── Boilerplate patterns ──
_BOILERPLATE_PATTERNS = [
    r"subscribe (to|for) (our )?(newsletter|updates|emails?).*?(?=\n\n|\Z)",
    r"sign[ -]?up (for|to).*?(?=\n\n|\Z)",
    r"click here to.*?(?=\n\n|\Z)",
    r"all rights reserved.*?(?=\n\n|\Z)",
    r"privacy policy.*?(?=\n\n|\Z)",
    r"terms (of|and) (service|use).*?(?=\n\n|\Z)",
    r"cookie (policy|notice|settings).*?(?=\n\n|\Z)",
    r"\[?\s*advertisement\s*\]?.*?(?=\n\n|\Z)",
    r"share this (article|story|post).*?(?=\n\n|\Z)",
    r"follow us on (twitter|facebook|instagram|linkedin).*?(?=\n\n|\Z)",
    r"read (more|also):.*?(?=\n\n|\Z)",
]

_BOILERPLATE_RE = re.compile(
    "|".join(_BOILERPLATE_PATTERNS),
    re.IGNORECASE | re.DOTALL,
)

# HTML noise tags to remove entirely
_NOISE_TAGS = [
    "script", "style", "nav", "footer", "header",
    "aside", "form", "noscript", "iframe", "figure",
]


class TextCleaner:
    """
    Stateless text cleaning utility.

    Args:
        min_length: Minimum character count for an article to survive cleaning.
                    Articles shorter than this are dropped.
    """

    def __init__(self, min_length: int = 150):
        self.min_length = min_length

    # ── Batch interface ───────────────────────────────────────

    def clean_batch(self, articles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Clean a list of raw article dicts in-place.

        Adds / overwrites the `cleaned_content` field.
        Articles that are too short after cleaning are removed entirely.

        Returns the list of articles that passed the length filter.
        """
        passed: List[Dict[str, Any]] = []
        for article in articles:
            raw   = article.get("raw_content", "") or ""
            clean = self.clean(raw)
            if clean:
                article["cleaned_content"] = clean
                passed.append(article)
            else:
                logger.debug(
                    f"[Cleaner] Dropped short/empty article: {article.get('url', '')[:80]}"
                )

        logger.info(
            f"[Cleaner] {len(passed)}/{len(articles)} articles passed "
            f"(min_length={self.min_length})."
        )
        return passed

    # ── Single-document interface ─────────────────────────────

    def clean(self, text: str) -> str:
        """
        Full cleaning pipeline on a single text string.

        Returns cleaned text, or '' if the result is too short.
        """
        if not text:
            return ""

        text = self._strip_html(text)
        text = self._normalise_unicode(text)
        text = self._remove_boilerplate(text)
        text = self._normalise_whitespace(text)

        return text if len(text) >= self.min_length else ""

    # ── Stage implementations ─────────────────────────────────

    @staticmethod
    def _strip_html(text: str) -> str:
        """Remove HTML markup and noise tags."""
        try:
            soup = BeautifulSoup(text, "lxml")
            for tag in soup(_NOISE_TAGS):
                tag.decompose()
            return soup.get_text(separator=" ")
        except Exception:
            # Fallback: simple regex strip
            return re.sub(r"<[^>]+>", " ", text)

    @staticmethod
    def _normalise_unicode(text: str) -> str:
        """NFKD normalisation → ASCII-safe representation."""
        text = unicodedata.normalize("NFKD", text)
        return text.encode("ascii", "ignore").decode("ascii")

    @staticmethod
    def _remove_boilerplate(text: str) -> str:
        """Strip common web boilerplate phrases."""
        return _BOILERPLATE_RE.sub("", text)

    @staticmethod
    def _normalise_whitespace(text: str) -> str:
        """Collapse multiple spaces and excessive blank lines."""
        text = re.sub(r"\n{3,}", "\n\n", text)   # max 2 consecutive newlines
        text = re.sub(r" {2,}", " ", text)        # max 1 consecutive space
        text = re.sub(r"\t+", " ", text)          # replace tabs
        return text.strip()

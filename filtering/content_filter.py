"""
Content filtering agent — two-stage relevance scoring.

Stage 1  Fast keyword matching
         ─ Clearly relevant  → mark is_relevant=True,  skip ML
         ─ Clearly irrelevant → mark is_relevant=False, skip ML
         ─ Borderline        → proceed to Stage 2

Stage 2  Zero-shot NLI classification (DistilBERT-MNLI)
         ─ Computes P(text is about <topic>) using NLI entailment
         ─ Threshold configurable in config.yaml
"""

import re
from typing import Any, Dict, List

from utils.logger import get_logger
from utils.metrics import pipeline_metrics

logger = get_logger(__name__)


class ContentFilter:
    """
    Relevance filter that adds `is_relevant` and `relevance_score`
    to every article dict.

    Args:
        config: Top-level pipeline config dict.
    """

    _MIN_CONTENT_LEN = 150          # Characters — shorter articles are rejected

    def __init__(self, config: dict):
        model_cfg            = config.get("models", {})
        self.classifier_name = model_cfg.get(
            "classifier", "typeform/distilbert-base-uncased-mnli"
        )
        self.threshold       = float(model_cfg.get("classifier_threshold", 0.55))
        self.use_ml          = bool(model_cfg.get("use_ml_filter", True))
        self._clf            = None   # Lazy load for relevance
        self._bias_clf       = None   # Lazy load for bias
        self._nlp            = None   # Lazy load for spaCy NER

    # ── Public ────────────────────────────────────────────────

    def filter(
        self, articles: List[Dict[str, Any]], topic: str
    ) -> List[Dict[str, Any]]:
        """
        Score every article for relevance to *topic*.

        Adds keys:
          is_relevant    (bool)
          relevance_score (float 0-1)

        Returns the same list (mutated).
        """
        pipeline_metrics.start_timer("filtering")

        for article in articles:
            content = article.get("cleaned_content") or article.get("raw_content", "")
            title   = article.get("title", "")
            
            # Ensure meta dict exists
            if "meta" not in article or article["meta"] is None:
                article["meta"] = {}

            # ── Stage 1: Quality gate ─────────────────────────
            if not self._passes_quality(content, title):
                article["is_relevant"]    = False
                article["relevance_score"] = 0.0
                continue

            # ── Stage 2: Keyword score ────────────────────────
            kw_score = self._keyword_score(content, title, topic)

            if kw_score >= 0.50:                   # Clearly relevant
                article["is_relevant"]    = True
                article["relevance_score"] = round(kw_score, 4)

            elif kw_score < 0.05:                  # Clearly irrelevant
                article["is_relevant"]    = False
                article["relevance_score"] = round(kw_score, 4)

            elif self.use_ml:                       # Borderline → ML (if enabled)
                # Only run ML on the first few hundred chars for speed
                ml_score = self._ml_score(content[:500], title, topic)
                article["is_relevant"]    = ml_score >= self.threshold
                article["relevance_score"] = round(ml_score, 4)

            else:                                   # ML disabled → use keyword score
                article["is_relevant"]    = kw_score >= self.threshold
                article["relevance_score"] = round(kw_score, 4)

            # ── Phase 1 Addition: NER & Bias Detection ────────
            if article["is_relevant"]:
                # 1. Named Entity Recognition
                article["meta"]["entities"] = self._extract_entities(content[:2000])
                
                # 2. Bias Detection
                if self.use_ml:
                    article["meta"]["bias"] = self._detect_bias(content[:800])

        relevant = sum(1 for a in articles if a.get("is_relevant"))
        elapsed  = pipeline_metrics.stop_timer("filtering")
        pipeline_metrics.increment("articles_filtered", relevant)

        logger.info(
            f"[Filter] '{topic}' → {relevant}/{len(articles)} relevant "
            f"({elapsed:.1f}s)."
        )
        return articles

    # ── Stage implementations ─────────────────────────────────

    def _passes_quality(self, content: str, title: str) -> bool:
        """Basic sanity checks before any scoring."""
        if not content or len(content.strip()) < self._MIN_CONTENT_LEN:
            return False
        if not title or len(title.strip()) < 5:
            return False
        # Reject near-empty character streams (e.g., repeated punctuation)
        alpha_ratio = len(re.sub(r"[^a-zA-Z\s]", "", content)) / max(len(content), 1)
        return alpha_ratio > 0.45

    def _keyword_score(self, content: str, title: str, topic: str) -> float:
        """
        Word-overlap score between topic keywords and article text.
        Title matches are boosted by 20 %.
        Returns a float in [0, 1].
        """
        topic_words = set(topic.lower().split())
        combined    = f"{title} {content}".lower()

        body_hits  = sum(1 for w in topic_words if w in combined)
        base_score = body_hits / max(len(topic_words), 1)

        title_hits  = sum(1 for w in topic_words if w in title.lower())
        title_boost = 0.20 * (title_hits / max(len(topic_words), 1))

        return min(1.0, base_score + title_boost)

    def _ml_score(self, text: str, title: str, topic: str) -> float:
        """
        Zero-shot NLI entailment score: P(text entails "This text is about <topic>").
        Falls back to 0.5 (uncertain) on any error.
        """
        try:
            clf = self._get_classifier()
            input_text = f"{title}. {text}"[:1_200]
            result = clf(
                input_text,
                candidate_labels   = [topic, "unrelated content"],
                hypothesis_template= "This text is about {}.",
            )
            # Index of our topic in the returned labels
            idx = result["labels"].index(topic)
            return float(result["scores"][idx])
        except Exception as exc:
            logger.debug(f"[Filter] ML score failed: {exc}")
            return 0.50   # Uncertain — let threshold decide

    def _get_classifier(self):
        """Lazy-load the zero-shot classification pipeline (CPU)."""
        if self._clf is None:
            logger.info(f"Loading classifier: {self.classifier_name} (CPU) ...")
            from transformers import pipeline  # type: ignore
            self._clf = pipeline(
                "zero-shot-classification",
                model  = self.classifier_name,
                device = -1,    # CPU
            )
        return self._clf

    # ── Phase 1: NER & Bias Methods ───────────────────────────

    def _extract_entities(self, text: str) -> Dict[str, List[str]]:
        """Extract PERSON, ORG, and GPE using NLTK."""
        entities = {"PERSON": [], "ORG": [], "GPE": []}
        try:
            import nltk
            sentences = nltk.sent_tokenize(text)
            for sent in sentences:
                words = nltk.word_tokenize(sent)
                tags = nltk.pos_tag(words)
                chunks = nltk.ne_chunk(tags)
                
                for chunk in chunks:
                    if hasattr(chunk, 'label'):
                        label = chunk.label()
                        if label in ["PERSON", "ORGANIZATION", "GPE"]:
                            mapped_label = "ORG" if label == "ORGANIZATION" else label
                            name = " ".join(c[0] for c in chunk)
                            clean_name = name.strip().title()
                            if len(clean_name) > 2 and clean_name not in entities[mapped_label]:
                                entities[mapped_label].append(clean_name)
                                
            # Keep top 5 per category
            return {k: v[:5] for k, v in entities.items()}
        except Exception as e:
            logger.debug(f"[Filter] NER failed: {e}")
            return entities

    def _detect_bias(self, text: str) -> str:
        """Classify political bias using zero-shot."""
        try:
            clf = self._get_bias_classifier()
            if clf is None: return "Unknown"
            
            result = clf(
                text,
                candidate_labels=["Left-wing bias", "Center / Unbiased", "Right-wing bias"],
                hypothesis_template="The political leaning of this text is {}.",
            )
            # Return the top scoring label
            return result["labels"][0]
        except Exception as e:
            logger.debug(f"[Filter] Bias detection failed: {e}")
            return "Unknown"

    def _get_bias_classifier(self):
        """Reuse the zero-shot classifier pipeline for bias."""
        # For memory efficiency on CPU, we reuse the exact same model instance
        # since it's a generic zero-shot MNLI model!
        return self._get_classifier()

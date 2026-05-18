"""
Summarization agent — dual-mode:

  Fast mode (default)  — extractive: first N sentences, no model download.
  ML mode              — abstractive via DistilBART (set use_summarizer: true
                         in config.yaml after model is cached).

Extractive mode is instant and good enough for RAG retrieval; the summaries
are stored in the DB and indexed into FAISS verbatim.
"""

import re
from typing import Any, Dict, List, Optional

from utils.logger import get_logger
from utils.metrics import pipeline_metrics

logger = get_logger(__name__)


# ── Extractive helpers ────────────────────────────────────────────────────────

def _split_sentences(text: str) -> List[str]:
    """Very lightweight sentence splitter (no NLTK needed)."""
    parts = re.split(r'(?<=[.!?])\s+', text.strip())
    return [p.strip() for p in parts if len(p.strip()) > 20]


def _extractive_summary(text: str, max_chars: int = 400) -> str:
    """Return the first few sentences that fit within max_chars."""
    sentences = _split_sentences(text)
    out = []
    total = 0
    for s in sentences:
        if total + len(s) > max_chars:
            break
        out.append(s)
        total += len(s) + 1
    return " ".join(out) if out else text[:max_chars].rstrip()


# ── Summarizer class ──────────────────────────────────────────────────────────

class Summarizer:
    """
    Batched summarization agent.

    Config keys (under `models:`):
      use_summarizer   : bool  — True = abstractive ML, False = extractive (default)
      summarizer       : str   — HuggingFace model name (ML mode only)
      max_summary_length: int  — max tokens for ML summary
      min_summary_length: int  — min tokens for ML summary
      summary_num_beams : int  — beam width for ML summary
    """

    _MAX_INPUT_CHARS = 3_000
    _BATCH_SIZE      = 4

    def __init__(self, config: dict):
        model_cfg         = config.get("models", {})
        self.model_name   = model_cfg.get("summarizer", "sshleifer/distilbart-cnn-12-6")
        self.max_length   = model_cfg.get("max_summary_length", 150)
        self.min_length   = model_cfg.get("min_summary_length", 40)
        self.num_beams    = model_cfg.get("summary_num_beams", 2)
        self.use_ml       = bool(model_cfg.get("use_summarizer", False))
        self._pipeline    = None

    # ── Lazy ML loading ───────────────────────────────────────────────────────

    def _get_pipeline(self):
        if self._pipeline is None:
            logger.info(f"Loading summarizer model: {self.model_name} (CPU) ...")
            # Transformers v5 removed the 'summarization' task alias;
            # use text2text-generation which works for all seq2seq models.
            from transformers import pipeline, AutoTokenizer, AutoModelForSeq2SeqLM  # type: ignore
            tokenizer = AutoTokenizer.from_pretrained(self.model_name)
            model     = AutoModelForSeq2SeqLM.from_pretrained(self.model_name)
            self._pipeline = pipeline(
                "text2text-generation",
                model     = model,
                tokenizer = tokenizer,
                device    = -1,
            )
            logger.info("Summarizer model ready.")
        return self._pipeline

    # ── Single article ────────────────────────────────────────────────────────

    def summarize(self, text: str) -> Optional[str]:
        """Summarize a single text. Returns None on failure."""
        if not text or len(text.strip()) < 100:
            return None
        if not self.use_ml:
            return _extractive_summary(text)
        try:
            pipe   = self._get_pipeline()
            result = pipe(
                text[:self._MAX_INPUT_CHARS],
                max_new_tokens = self.max_length,
                num_beams      = self.num_beams,
                do_sample      = False,
                truncation     = True,
            )
            return result[0]["generated_text"].strip()
        except Exception as exc:
            logger.warning(f"[Summarizer] ML error, falling back to extractive: {exc}")
            return _extractive_summary(text)

    # ── Batch ─────────────────────────────────────────────────────────────────

    def summarize_batch(self, articles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Summarize a list of article dicts in-place.
        Adds / updates the `summary` key on each article.
        Returns the same list (mutated).
        """
        pipeline_metrics.start_timer("summarization")

        to_process = [
            (i, a)
            for i, a in enumerate(articles)
            if a.get("cleaned_content") and len(a["cleaned_content"]) >= 100
        ]
        logger.info(
            f"[Summarizer] {'ML' if self.use_ml else 'Extractive'} mode — "
            f"summarizing {len(to_process)} articles ..."
        )

        if not self.use_ml:
            # Fast extractive path — no model needed
            for idx, article in to_process:
                articles[idx]["summary"] = _extractive_summary(
                    article["cleaned_content"]
                )
        else:
            # Abstractive ML path (batched)
            pipe = self._get_pipeline()
            for batch_start in range(0, len(to_process), self._BATCH_SIZE):
                batch = to_process[batch_start : batch_start + self._BATCH_SIZE]
                texts = [a["cleaned_content"][:self._MAX_INPUT_CHARS] for _, a in batch]
                try:
                    results = pipe(
                        texts,
                        max_new_tokens = self.max_length,
                        num_beams      = self.num_beams,
                        do_sample      = False,
                        truncation     = True,
                        batch_size     = self._BATCH_SIZE,
                    )
                    for (idx, _), result in zip(batch, results):
                        articles[idx]["summary"] = result["generated_text"].strip()
                except Exception as exc:
                    logger.warning(f"[Summarizer] Batch error: {exc}")
                    for idx, article in batch:
                        articles[idx]["summary"] = self.summarize(
                            article.get("cleaned_content", "")
                        )

        summarized = sum(1 for a in articles if a.get("summary"))
        elapsed    = pipeline_metrics.stop_timer("summarization")
        pipeline_metrics.increment("articles_summarized", summarized)
        logger.info(
            f"[Summarizer] {summarized}/{len(articles)} articles summarized "
            f"in {elapsed:.1f}s."
        )
        return articles

"""
Evaluation metrics and pipeline instrumentation.

Provides:
  - PipelineMetrics: lightweight in-process counter / timer / recorder
  - compute_rouge_scores(): ROUGE-1/2/L evaluation for summaries
"""

import time
from typing import Any, Dict, List

from utils.logger import get_logger

logger = get_logger(__name__)


# ─── Pipeline Metrics ─────────────────────────────────────────────────────────

class PipelineMetrics:
    """
    Lightweight in-process metrics store.

    Usage::
        metrics.start_timer("summarization")
        # ... do work ...
        elapsed = metrics.stop_timer("summarization")
        metrics.increment("articles_summarized", n)
        metrics.record("relevance_score", 0.87)
    """

    def __init__(self):
        self._metrics: Dict[str, List[float]] = {}
        self._counters: Dict[str, int] = {}
        self._timers: Dict[str, float] = {}

    # ── Recording ────────────────────────────────────────────

    def record(self, key: str, value: float) -> None:
        """Append a numeric measurement."""
        self._metrics.setdefault(key, []).append(value)

    def increment(self, key: str, amount: int = 1) -> None:
        """Increment an event counter."""
        self._counters[key] = self._counters.get(key, 0) + amount

    # ── Timers ───────────────────────────────────────────────

    def start_timer(self, key: str) -> None:
        """Start a named timer."""
        self._timers[key] = time.perf_counter()

    def stop_timer(self, key: str) -> float:
        """Stop a named timer; record and return elapsed seconds."""
        if key not in self._timers:
            return 0.0
        elapsed = time.perf_counter() - self._timers.pop(key)
        self.record(f"{key}_latency_s", elapsed)
        return elapsed

    # ── Reporting ────────────────────────────────────────────

    def get_summary(self) -> Dict[str, Any]:
        """Return a dict summarising all recorded metrics."""
        summary: Dict[str, Any] = {}
        for key, values in self._metrics.items():
            summary[key] = {
                "mean": round(sum(values) / len(values), 4),
                "min": round(min(values), 4),
                "max": round(max(values), 4),
                "count": len(values),
            }
        summary["counters"] = dict(self._counters)
        return summary

    def log_summary(self) -> None:
        """Write the metrics summary to the logger."""
        summary = self.get_summary()
        logger.info("=== Pipeline Metrics Summary ===")
        for key, stats in summary.items():
            if key == "counters":
                for k, v in stats.items():
                    logger.info(f"  [{k}] count = {v}")
            else:
                logger.info(
                    f"  [{key}] mean={stats['mean']:.4f}  "
                    f"min={stats['min']:.4f}  max={stats['max']:.4f}  "
                    f"n={stats['count']}"
                )

    def reset(self) -> None:
        """Clear all recorded values."""
        self._metrics.clear()
        self._counters.clear()
        self._timers.clear()


# ─── ROUGE Evaluation ────────────────────────────────────────────────────────

def compute_rouge_scores(
    predictions: List[str], references: List[str]
) -> Dict[str, float]:
    """
    Compute ROUGE-1, ROUGE-2 and ROUGE-L F1 scores.

    Args:
        predictions: Generated summaries
        references:  Reference / source texts

    Returns:
        {"rouge1": float, "rouge2": float, "rougeL": float}
    """
    try:
        from rouge_score import rouge_scorer  # type: ignore

        scorer = rouge_scorer.RougeScorer(
            ["rouge1", "rouge2", "rougeL"], use_stemmer=True
        )
        scores: Dict[str, List[float]] = {"rouge1": [], "rouge2": [], "rougeL": []}

        for pred, ref in zip(predictions, references):
            result = scorer.score(ref, pred)
            scores["rouge1"].append(result["rouge1"].fmeasure)
            scores["rouge2"].append(result["rouge2"].fmeasure)
            scores["rougeL"].append(result["rougeL"].fmeasure)

        return {
            k: round(sum(v) / len(v), 4) if v else 0.0
            for k, v in scores.items()
        }
    except ImportError:
        logger.warning("rouge-score not installed; skipping ROUGE evaluation.")
        return {"rouge1": 0.0, "rouge2": 0.0, "rougeL": 0.0}


# ── Singleton available for import everywhere ─────────────────────────────────
pipeline_metrics = PipelineMetrics()

"""
Embedding agent using SentenceTransformers.

Model: all-MiniLM-L6-v2
  - 384-dimensional dense vectors
  - Very fast on CPU (~14 000 sentences/minute @ batch_size=32)
  - Well-balanced between quality and speed for semantic search

All embeddings are returned as float32 numpy arrays ready for FAISS.
"""

from typing import List, Optional

import numpy as np

from utils.logger import get_logger
from utils.metrics import pipeline_metrics

logger = get_logger(__name__)


class EmbeddingAgent:
    """
    Converts text to dense vector embeddings via SentenceTransformers.

    Lazy-loads the model on first use so that importing this module
    does not trigger a large model download at startup.

    Args:
        config: Top-level pipeline config dict.
    """

    def __init__(self, config: dict):
        model_cfg       = config.get("models", {})
        self.model_name = model_cfg.get("embedder", "all-MiniLM-L6-v2")
        self.batch_size = int(model_cfg.get("embedding_batch_size", 32))
        self._model     = None

    # ── Lazy loading ──────────────────────────────────────────

    def _get_model(self):
        if self._model is None:
            logger.info(f"Loading embedding model: {self.model_name} (CPU) ...")
            from sentence_transformers import SentenceTransformer  # type: ignore
            self._model = SentenceTransformer(self.model_name)
            dim = self._model.get_sentence_embedding_dimension()
            logger.info(f"Embedding model ready (dim={dim}).")
        return self._model

    # ── Public API ────────────────────────────────────────────

    def embed(self, text: str) -> Optional[np.ndarray]:
        """
        Embed a single text string.

        Returns:
            1-D float32 ndarray of shape (dim,), or None on failure.
        """
        if not text or not text.strip():
            return None
        try:
            model = self._get_model()
            vec   = model.encode(text, convert_to_numpy=True, normalize_embeddings=False)
            return vec.astype(np.float32)
        except Exception as exc:
            logger.error(f"[Embedder] Single embed failed: {exc}")
            return None

    def embed_batch(self, texts: List[str]) -> np.ndarray:
        """
        Embed a list of texts.

        Args:
            texts: Non-empty list of strings.

        Returns:
            2-D float32 ndarray of shape (N, dim).
            Returns an empty array if texts is empty or an error occurs.
        """
        if not texts:
            return np.array([], dtype=np.float32)

        pipeline_metrics.start_timer("embedding")
        try:
            model      = self._get_model()
            embeddings = model.encode(
                texts,
                batch_size         = self.batch_size,
                show_progress_bar  = True,
                convert_to_numpy   = True,
                normalize_embeddings = False,
            )
            elapsed = pipeline_metrics.stop_timer("embedding")
            pipeline_metrics.increment("articles_embedded", len(texts))
            logger.info(
                f"[Embedder] {len(texts)} texts embedded in {elapsed:.1f}s "
                f"(batch_size={self.batch_size})."
            )
            return embeddings.astype(np.float32)

        except Exception as exc:
            pipeline_metrics.stop_timer("embedding")
            logger.error(f"[Embedder] Batch embed failed: {exc}")
            return np.array([], dtype=np.float32)

    # ── Info ──────────────────────────────────────────────────

    @property
    def embedding_dim(self) -> int:
        """Embedding dimension of the loaded model."""
        return self._get_model().get_sentence_embedding_dimension()

"""
Semantic deduplication using FAISS cosine similarity.

Before saving a new article to the database, check if a semantically
similar article (cosine similarity > threshold) already exists in the
in-memory FAISS index of articles seen in this pipeline run.

This is run-level deduplication (not cross-run). Cross-run deduplication
is handled at URL level by the database's url_hash unique constraint.
"""

from typing import Any, Dict, List, Optional
import numpy as np

from utils.logger import get_logger

logger = get_logger(__name__)

_DEFAULT_THRESHOLD = 0.92   # Similarity above this = duplicate


class SemanticDeduplicator:
    """
    Deduplicates a list of article dicts using embedding cosine similarity.

    Args:
        embedder  : EmbeddingAgent instance (already loaded)
        threshold : Cosine similarity threshold (0-1). Default 0.92.
    """

    def __init__(self, embedder, threshold: float = _DEFAULT_THRESHOLD):
        self.embedder  = embedder
        self.threshold = threshold

    def deduplicate(
        self, articles: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Remove semantically duplicate articles from the list.
        Keeps the first occurrence; removes subsequent near-duplicates.

        Returns the deduplicated list.
        """
        if len(articles) <= 1:
            return articles

        texts = [
            f"{a.get('title', '')} {a.get('summary', '') or a.get('cleaned_content', '')}"
            for a in articles
        ]

        try:
            embeddings = self.embedder.embed_batch(texts)   # (N, dim) float32
            if embeddings is None or embeddings.size == 0:
                return articles

            # Normalize for cosine similarity
            norms = np.linalg.norm(embeddings, axis=1, keepdims=True) + 1e-10
            normed = embeddings / norms

            kept_indices = []
            kept_vectors: List[np.ndarray] = []

            for i, vec in enumerate(normed):
                if not kept_vectors:
                    kept_indices.append(i)
                    kept_vectors.append(vec)
                    continue

                # Cosine similarity against all kept vectors
                sims = np.dot(np.stack(kept_vectors), vec)
                if sims.max() < self.threshold:
                    kept_indices.append(i)
                    kept_vectors.append(vec)
                # else: duplicate — skip

            removed = len(articles) - len(kept_indices)
            if removed > 0:
                logger.info(
                    f"[Deduplication] Removed {removed} semantic duplicates "
                    f"(threshold={self.threshold})."
                )

            return [articles[i] for i in kept_indices]

        except Exception as exc:
            logger.warning(f"[Deduplication] Failed, skipping: {exc}")
            return articles

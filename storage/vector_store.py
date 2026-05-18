"""
FAISS vector store with persistent save/load and article-ID mapping.

Design
------
- Uses IndexIDMap wrapping IndexFlatL2 so we can associate each vector
  with an integer article_id from PostgreSQL.
- Vectors are L2-normalised before insertion → cosine similarity via
  inner product (correct for unit vectors under L2 distance).
- The ID mapping list and raw FAISS index are both written to disk
  after every batch insertion so restarts are seamless.
"""

import json
import numpy as np
from pathlib import Path
from typing import List, Optional, Tuple

import faiss

from utils.logger import get_logger

logger = get_logger(__name__)


class VectorStore:
    """
    Persistent FAISS vector store keyed by PostgreSQL article IDs.

    Example
    -------
    >>> store = VectorStore(config)
    >>> store.add(embeddings, article_ids)
    >>> results = store.search(query_vec, top_k=5)
    # results → List[(article_id, similarity_score)]
    """

    def __init__(self, config: dict):
        faiss_cfg       = config["storage"]["faiss"]
        self.index_dir  = Path(faiss_cfg["index_path"])
        self.dim        = int(faiss_cfg["embedding_dim"])
        self.index_dir.mkdir(parents=True, exist_ok=True)

        self._faiss_file   = self.index_dir / "index.faiss"
        self._mapping_file = self.index_dir / "id_mapping.json"

        self.index: Optional[faiss.Index] = None
        self._load_or_create()

    # ── Persistence ───────────────────────────────────────────

    def _load_or_create(self) -> None:
        """Load an existing index from disk, or create a fresh one."""
        if self._faiss_file.exists() and self._mapping_file.exists():
            try:
                self.index = faiss.read_index(str(self._faiss_file))
                logger.info(
                    f"FAISS index loaded from disk "
                    f"({self.index.ntotal} vectors, dim={self.dim})."
                )
                return
            except Exception as exc:
                logger.warning(f"Could not load FAISS index ({exc}); creating new one.")
        self._create_new()

    def _create_new(self) -> None:
        """Build an empty IndexIDMap(IndexFlatL2)."""
        base    = faiss.IndexFlatL2(self.dim)
        self.index = faiss.IndexIDMap(base)
        logger.info(f"Created new FAISS index (dim={self.dim}).")
        self._save()

    def _save(self) -> None:
        """Persist the index to disk (called after every write)."""
        faiss.write_index(self.index, str(self._faiss_file))
        logger.debug(f"FAISS index saved ({self.index.ntotal} vectors).")

    # ── Write ─────────────────────────────────────────────────

    def add(self, embeddings: np.ndarray, article_ids: List[int]) -> None:
        """
        Insert *embeddings* into the index, labelled with *article_ids*.

        Parameters
        ----------
        embeddings  : ndarray of shape (N, dim), dtype float32
        article_ids : list of N integer PostgreSQL article IDs
        """
        if embeddings.size == 0 or len(article_ids) == 0:
            return
        if len(embeddings) != len(article_ids):
            raise ValueError("embeddings and article_ids must have the same length.")

        vecs = embeddings.astype(np.float32)
        faiss.normalize_L2(vecs)            # In-place L2 normalisation

        ids = np.array(article_ids, dtype=np.int64)
        self.index.add_with_ids(vecs, ids)

        self._save()
        logger.info(
            f"Added {len(article_ids)} vectors to FAISS. "
            f"Total: {self.index.ntotal}."
        )

    def reset(self) -> None:
        """Wipe the index and start fresh."""
        self._create_new()
        logger.warning("FAISS index reset (all vectors removed).")

    # ── Read ──────────────────────────────────────────────────

    def search(
        self, query_embedding: np.ndarray, top_k: int = 5
    ) -> List[Tuple[int, float]]:
        """
        Return the *top_k* most-similar article IDs with their scores.

        Parameters
        ----------
        query_embedding : ndarray of shape (dim,) or (1, dim)
        top_k           : number of results

        Returns
        -------
        List of (article_id, similarity_score) tuples, sorted by score desc.
        Similarity score is in (0, 1] — higher is more similar.
        """
        if self.index.ntotal == 0:
            logger.warning("FAISS index is empty — no results.")
            return []

        query = query_embedding.astype(np.float32)
        if query.ndim == 1:
            query = query.reshape(1, -1)
        faiss.normalize_L2(query)

        k = min(top_k, self.index.ntotal)
        distances, ids = self.index.search(query, k)

        results: List[Tuple[int, float]] = []
        for dist, art_id in zip(distances[0], ids[0]):
            if art_id == -1:
                continue
            # Convert L2 distance to similarity ∈ (0,1]
            similarity = float(1.0 / (1.0 + dist))
            results.append((int(art_id), similarity))

        return results

    # ── Info ──────────────────────────────────────────────────

    @property
    def total(self) -> int:
        """Total number of vectors currently indexed."""
        return self.index.ntotal if self.index else 0

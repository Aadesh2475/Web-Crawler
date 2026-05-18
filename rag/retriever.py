"""
Retrieval-Augmented Generation (RAG) pipeline.

Flow
----
User query (str)
  │
  ▼
EmbeddingAgent.embed(query)                 → (384,) float32 vector
  │
  ▼
VectorStore.search(query_vec, top_k)        → [(article_id, score), ...]
  │
  ▼
DatabaseManager.get_articles_by_ids(ids)    → List[Article]
  │
  ▼
Build context string from summaries
  │
  ▼
Flan-T5 answer generation                   → final answer (str)
"""

from typing import Any, Dict, List, Optional, Tuple

from embedding.embedder import EmbeddingAgent
from storage.db import DatabaseManager
from storage.vector_store import VectorStore
from utils.logger import get_logger
from utils.metrics import pipeline_metrics

logger = get_logger(__name__)


class RAGRetriever:
    """
    Full RAG query pipeline.

    Args:
        config       : Top-level pipeline config dict
        embedder     : Shared EmbeddingAgent instance
        vector_store : Shared VectorStore instance
        db           : Shared DatabaseManager instance
    """

    def __init__(
        self,
        config:       dict,
        embedder:     EmbeddingAgent,
        vector_store: VectorStore,
        db:           DatabaseManager,
    ):
        self.config       = config
        self.embedder     = embedder
        self.vector_store = vector_store
        self.db           = db

        api_cfg             = config.get("api", {})
        self.default_top_k  = int(api_cfg.get("rag_top_k", 5))

        model_cfg            = config.get("models", {})
        self.generator_model = model_cfg.get("rag_generator", "google/flan-t5-base")
        self._generator      = None   # Lazy load

    # ── Public API ────────────────────────────────────────────

    def retrieve(
        self, query: str, top_k: Optional[int] = None, start_date=None, end_date=None
    ) -> List[Dict[str, Any]]:
        """
        Retrieve the *top_k* most relevant documents for *query*.

        Returns a list of article dicts (from DB) with an added
        `similarity_score` field, sorted by score descending.
        """
        k = top_k or self.default_top_k

        # 1. Embed query
        query_vec = self.embedder.embed(query)
        if query_vec is None:
            logger.warning("[RAG] Could not embed query — returning empty results.")
            return []

        # 2. FAISS search - oversample if filtering by date
        search_k = (k * 5) if (start_date or end_date) else k
        hits = self.vector_store.search(query_vec, top_k=search_k)
        if not hits:
            return []

        # 3. Fetch from DB
        ids       = [art_id for art_id, _ in hits]
        score_map = {art_id: score for art_id, score in hits}
        articles  = self.db.get_articles_by_ids(ids)

        # 3.5 Date filtering
        filtered_articles = []
        for art in articles:
            if start_date and getattr(art, 'published_at', None):
                if art.published_at < start_date: continue
            if end_date and getattr(art, 'published_at', None):
                if art.published_at > end_date: continue
            filtered_articles.append(art)

        # 4. Enrich with similarity scores
        docs = [
            {**art.to_dict(), "similarity_score": score_map.get(art.id, 0.0)}
            for art in filtered_articles
        ]
        docs.sort(key=lambda d: d["similarity_score"], reverse=True)
        return docs[:k]

    def query(
        self, question: str, top_k: Optional[int] = None, start_date=None, end_date=None
    ) -> Dict[str, Any]:
        """
        Full RAG query: retrieve relevant docs → generate a grounded answer.

        Args:
            question : Natural-language question from the user
            top_k    : Override the default number of retrieved docs

        Returns a dict::
            {
                "answer":        str,
                "sources":       List[{title, url, source, similarity}],
                "retrieved_docs": List[article dicts],
                "query":         str,
            }
        """
        pipeline_metrics.start_timer("rag_query")

        docs = self.retrieve(question, top_k=top_k, start_date=start_date, end_date=end_date)

        if not docs:
            pipeline_metrics.stop_timer("rag_query")
            return {
                "answer": (
                    "I don't have enough information to answer this question. "
                    "The knowledge base may be empty or this topic has not been "
                    "indexed yet. Try running the ingestion pipeline first."
                ),
                "sources":        [],
                "retrieved_docs": [],
                "query":          question,
            }

        # Build context block from top summaries
        context_parts = []
        for i, doc in enumerate(docs, start=1):
            text = doc.get("summary") or (doc.get("cleaned_content") or "")[:400]
            if text:
                context_parts.append(
                    f"[{i}] {doc.get('source', 'unknown').upper()} — "
                    f"{doc.get('title', 'Untitled')}\n{text}"
                )

        context = "\n\n".join(context_parts)
        answer  = self._generate(question, context)

        elapsed = pipeline_metrics.stop_timer("rag_query")
        logger.info(
            f"[RAG] '{question[:60]}' answered in {elapsed:.2f}s "
            f"(docs={len(docs)})."
        )

        return {
            "answer": answer,
            "sources": [
                {
                    "title":      d.get("title"),
                    "url":        d.get("url"),
                    "source":     d.get("source"),
                    "similarity": round(d.get("similarity_score", 0.0), 4),
                }
                for d in docs
            ],
            "retrieved_docs": docs,
            "query": question,
        }

    # ── Answer generation ─────────────────────────────────────

    def _generate(self, question: str, context: str) -> str:
        """
        Generate a grounded answer with Flan-T5.

        Falls back to a context excerpt if generation fails.
        """
        prompt = (
            "Based on the information provided below, answer the question "
            "as clearly and concisely as possible.\n\n"
            f"Information:\n{context[:2_500]}\n\n"
            f"Question: {question}\n\n"
            "Answer:"
        )
        try:
            gen    = self._get_generator()
            result = gen(
                prompt,
                max_new_tokens = 300,
                do_sample      = False,
                truncation     = True,
            )
            return result[0]["generated_text"].strip()
        except Exception as exc:
            logger.error(f"[RAG] Generation failed: {exc}")
            # Graceful degradation: summarise top context excerpt
            return (
                "Based on retrieved information:\n"
                + context[:600]
                + "\n\n(Full generation unavailable.)"
            )

    def _get_generator(self):
        """Lazy-load Flan-T5 generation pipeline (CPU)."""
        if self._generator is None:
            logger.info(f"Loading RAG generator: {self.generator_model} (CPU) ...")
            from transformers import pipeline  # type: ignore
            self._generator = pipeline(
                "text2text-generation",
                model          = self.generator_model,
                device         = -1,         # CPU
                max_new_tokens = 300,
            )
            logger.info("RAG generator ready.")
        return self._generator

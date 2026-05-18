"""
Dossier processing, chunking, and real-time FAISS indexing engine.
Features:
- PDF / TXT parsing.
- Overlapping sliding-window chunking.
- Real-time DB saving & vector storage indexing.
- Gemini-powered premium RAG canvas.
"""

import io
import math
from datetime import datetime
from typing import List, Dict, Any, Optional
from pypdf import PdfReader

from storage.db import DatabaseManager, Article, url_to_hash
from embedding.embedder import EmbeddingAgent
from storage.vector_store import VectorStore
from rag.gemini_client import GeminiClient
from utils.logger import get_logger

logger = get_logger(__name__)

class DossierEngine:
    def __init__(self, db: DatabaseManager):
        self.db = db
        self.gemini = GeminiClient()

    def parse_pdf(self, file_bytes: bytes) -> str:
        """Extract plain text from a raw PDF byte stream."""
        try:
            reader = PdfReader(io.BytesIO(file_bytes))
            text_parts = []
            for i, page in enumerate(reader.pages):
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
            return "\n\n".join(text_parts)
        except Exception as e:
            logger.error(f"Failed to parse PDF: {e}")
            raise ValueError(f"Failed to parse PDF: {str(e)}")

    def parse_txt(self, file_bytes: bytes) -> str:
        """Extract plain text from raw TXT bytes."""
        try:
            return file_bytes.decode("utf-8", errors="ignore")
        except Exception as e:
            logger.error(f"Failed to parse TXT: {e}")
            raise ValueError(f"Failed to parse TXT: {str(e)}")

    def chunk_text(self, text: str, chunk_size: int = 800, overlap: int = 150) -> List[str]:
        """Split text into overlapping semantic blocks based on words."""
        if not text or not text.strip():
            return []
            
        words = text.split()
        chunks = []
        
        i = 0
        while i < len(words):
            # Form chunk
            chunk_words = words[i:i + chunk_size]
            chunk_text = " ".join(chunk_words)
            if chunk_text.strip():
                chunks.append(chunk_text)
            
            # Step forward by chunk_size - overlap
            i += (chunk_size - overlap)
            
        return chunks

    def index_dossier(
        self, 
        file_bytes: bytes, 
        filename: str, 
        mime_type: str,
        embedder: EmbeddingAgent,
        vector_store: VectorStore
    ) -> Dict[str, Any]:
        """
        Parses, chunks, saves to PostgreSQL, generates dense embeddings, 
        and adds to persistent FAISS in real time.
        """
        # 1. Parse content
        if "pdf" in mime_type.lower() or filename.lower().endswith(".pdf"):
            full_text = self.parse_pdf(file_bytes)
        else:
            full_text = self.parse_txt(file_bytes)

        if not full_text.strip():
            raise ValueError("No text could be extracted from this dossier.")

        # 2. Chunk text
        chunks = self.chunk_text(full_text)
        if not chunks:
            raise ValueError("Document was empty or too small to chunk.")

        logger.info(f"Indexing dossier '{filename}' into {len(chunks)} chunks.")

        articles_to_save = []
        timestamp = datetime.utcnow()
        
        # 3. Create articles records with 'dossier' source
        for idx, chunk in enumerate(chunks):
            unique_url = f"dossier://{filename}/{idx}_{math.floor(timestamp.timestamp())}"
            articles_to_save.append({
                "url": unique_url,
                "title": f"{filename} [Part {idx + 1}/{len(chunks)}]",
                "source": "dossier",
                "topic": "private",
                "raw_content": chunk,
                "cleaned_content": chunk,
                "summary": chunk[:300] + "..." if len(chunk) > 300 else chunk,
                "relevance_score": 1.0,
                "is_relevant": True,
                "published_at": timestamp,
                "metadata": {
                    "filename": filename,
                    "chunk_index": idx,
                    "total_chunks": len(chunks)
                },
                "keywords": ["dossier", filename.split(".")[0]]
            })

        # Save to database
        saved_count = self.db.save_articles(articles_to_save)
        logger.info(f"Saved {saved_count} chunks to PostgreSQL.")

        # 4. Fetch the newly created records to obtain their primary keys
        saved_records = []
        with self.db.SessionFactory() as session:
            for art in articles_to_save:
                h = url_to_hash(art["url"])
                rec = session.query(Article).filter_by(url_hash=h).first()
                if rec:
                    saved_records.append(rec)

        if not saved_records:
            raise RuntimeError("Database insertion failed: could not fetch primary keys.")

        # 5. Embed and add to FAISS index immediately
        texts_to_embed = [rec.raw_content for rec in saved_records]
        embeddings = embedder.embed_batch(texts_to_embed)
        
        ids = [rec.id for rec in saved_records]
        vector_store.add(embeddings, ids)
        
        # 6. Flag database records as embedded
        self.db.mark_as_embedded(ids)

        return {
            "filename": filename,
            "chunks_count": len(chunks),
            "total_characters": len(full_text),
            "indexing_status": "success",
            "first_id": ids[0] if ids else None
        }

    def query_dossiers(
        self,
        question: str,
        embedder: EmbeddingAgent,
        vector_store: VectorStore,
        private_only = True
    ) -> Dict[str, Any]:
        """
        Query private dossiers specifically using RAG.
        If private_only=False, merges dossiers with crawled news.
        """
        # 1. Embed question
        query_vec = embedder.embed(question)
        if query_vec is None:
            return {"answer": "Error: Could not embed search query.", "sources": []}

        # 2. Search FAISS for hits
        hits = vector_store.search(query_vec, top_k=15)
        if not hits:
            return {
                "answer": "No matching concepts or topics found in your private dossiers.",
                "sources": []
            }

        ids = [art_id for art_id, _ in hits]
        score_map = {art_id: score for art_id, score in hits}
        
        # 3. Retrieve from DB
        articles = self.db.get_articles_by_ids(ids)
        
        # 4. Filter sources
        filtered_docs = []
        for art in articles:
            is_dossier = art.source == "dossier"
            if private_only and not is_dossier:
                continue
            filtered_docs.append(art)

        if not filtered_docs:
            return {
                "answer": "Matches were found in crawled news, but no matching segments were found in your private uploaded dossiers.",
                "sources": []
            }

        # 5. Sort by relevance
        docs = [
            {**art.to_dict(), "similarity_score": score_map.get(art.id, 0.0)}
            for art in filtered_docs
        ]
        docs.sort(key=lambda d: d["similarity_score"], reverse=True)
        top_docs = docs[:6]

        # 6. Construct Context for Gemini
        context_parts = []
        sources = []
        for i, doc in enumerate(top_docs, start=1):
            source_name = doc.get("meta", {}).get("filename", doc.get("source", "dossier"))
            context_parts.append(
                f"SOURCE [{i}]: File '{source_name}' (Part {doc.get('meta', {}).get('chunk_index', 0) + 1})\n"
                f"Content Segment:\n{doc.get('raw_content')}"
            )
            sources.append({
                "title": doc.get("title"),
                "source": source_name,
                "similarity": round(doc.get("similarity_score", 0.0), 3),
                "url": doc.get("url")
            })

        context = "\n\n=== SEGMENT ===\n".join(context_parts)

        # 7. Ask Gemini
        prompt = (
            f"You are the Advanced Intelligence Analyst Assistant at the Predictive Risk Desk.\n"
            f"Analyze the private uploaded dossier segments provided below and answer the question "
            f"based strictly on this information.\n\n"
            f"Provided Dossier Information:\n"
            f"=================================\n"
            f"{context}\n"
            f"=================================\n\n"
            f"User Question: {question}\n\n"
            f"Draft a meticulous, highly detailed executive analysis. Use numbered footnotes or square bracket references "
            f"(e.g. [1]) when citing specific statements from the sources. Highlight critical risk profiles and market hedging takeaways."
        )

        answer = self.gemini.ask(prompt)
        
        return {
            "answer": answer,
            "sources": sources,
            "query": question
        }

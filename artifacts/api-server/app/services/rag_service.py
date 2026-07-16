"""RAG service — orchestrates chunking, embedding, storage and retrieval.

Deliberately separate from ai_service.py: this module handles
*document understanding*; ai_service.py handles *LLM communication*.

Vector storage uses plain JSON arrays in PostgreSQL (no pgvector required).
The vector_store layer is intentionally thin so it can be replaced with
Qdrant / Weaviate / Milvus without touching the rest of the application.
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.models import Document, DocumentChunk, ProcessingStatus
from app.services.document_service import chunk_text, extract_text, validate_file
from app.services.embedding_service import cosine_similarity, embed_text


# ── Vector-store abstraction ──────────────────────────────────────────────────

STOP_WORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "arent", "as", "at",
    "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "cant", "cannot", "could",
    "couldnt", "did", "didnt", "do", "does", "doesnt", "doing", "dont", "down", "during", "each", "few", "for", "from",
    "further", "had", "hadnt", "has", "hasnt", "have", "havent", "having", "he", "hed", "hell", "hes", "her", "here",
    "heres", "hers", "herself", "him", "himself", "his", "how", "hows", "i", "id", "ill", "im", "ive", "if", "in",
    "into", "is", "isnt", "it", "its", "itself", "lets", "me", "more", "most", "mustnt", "my", "myself", "no", "nor",
    "not", "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours", "ourselves", "out", "over", "own",
    "same", "shant", "she", "shed", "shell", "shes", "should", "shouldnt", "so", "some", "such", "than", "that", "thats",
    "the", "their", "theirs", "them", "themselves", "then", "there", "theres", "these", "they", "theyd", "theyll",
    "theyre", "theyve", "this", "those", "through", "to", "too", "under", "until", "up", "very", "was", "wasnt", "we",
    "wed", "well", "were", "weve", "werent", "what", "whats", "when", "whens", "where", "wheres", "which", "while",
    "who", "whos", "whom", "why", "whys", "with", "wont", "would", "wouldnt", "you", "youd", "youll", "youre", "youve",
    "your", "yours", "yourself", "yourselves", "give", "please", "show", "tell", "find"
}

def _get_keywords(text: str) -> set[str]:
    import re
    words = re.findall(r"\w+", text.lower())
    return {w for w in words if w not in STOP_WORDS}

def _keyword_overlap(query: str, chunk_text: str) -> float:
    import re
    import difflib
    q_words = _get_keywords(query)
    if not q_words:
        return 0.0
    c_words = set(re.findall(r"\w+", chunk_text.lower()))
    
    matches = 0
    for qw in q_words:
        if qw in c_words:
            matches += 1
            continue
        found = False
        for cw in c_words:
            if len(cw) >= 4 and len(qw) >= 4:
                if difflib.SequenceMatcher(None, qw, cw).ratio() >= 0.75:
                    found = True
                    break
        if found:
            matches += 1
            
    return matches / len(q_words)

def compute_hybrid_score(query_text: str, query_embedding: list[float], chunk_text: str, chunk_embedding: list[float]) -> float:
    cos_sim = cosine_similarity(query_embedding, chunk_embedding)
    overlap = _keyword_overlap(query_text, chunk_text)
    return 0.4 * cos_sim + 0.6 * overlap


class _PostgresJsonVectorStore:
    """Simple cosine-similarity search over JSON-stored embeddings."""

    def search(
        self,
        db: Session,
        knowledge_base_id: int,
        query_embedding: list[float],
        top_k: int,
        user_id: int,
        query_text: str = "",
    ) -> list[tuple[DocumentChunk, float]]:
        # Enforce ownership: only chunks from KBs the user owns
        chunks = (
            db.query(DocumentChunk)
            .filter(DocumentChunk.knowledge_base_id == knowledge_base_id)
            .filter(DocumentChunk.embedding.isnot(None))
            .all()
        )
        scored: list[tuple[DocumentChunk, float]] = []
        for chunk in chunks:
            sim = compute_hybrid_score(query_text, query_embedding, chunk.chunk_text, chunk.embedding)
            scored.append((chunk, sim))
        scored.sort(key=lambda x: x[1], reverse=True)
        return scored[:top_k]


_vector_store = _PostgresJsonVectorStore()


# ── Public dataclasses ────────────────────────────────────────────────────────

@dataclass
class ChunkSource:
    document_id: int
    file_name: str
    chunk_index: int
    chunk_text: str
    similarity_score: float


@dataclass
class RAGContext:
    context_text: str
    sources: list[ChunkSource]


# ── Processing pipeline ───────────────────────────────────────────────────────

async def process_document(db: Session, document: Document, raw_bytes: bytes) -> None:
    """Extract, chunk and embed a document.  Updates processing_status in-place."""
    document.processing_status = ProcessingStatus.processing
    db.commit()

    try:
        ext = document.file_type.lower()
        text = extract_text(raw_bytes, ext)

        chunks = chunk_text(
            text,
            chunk_size=settings.rag_chunk_size,
            overlap=settings.rag_chunk_overlap,
        )
        if not chunks:
            raise ValueError("No text chunks could be produced from this document.")

        # Delete any existing chunks (re-processing scenario)
        db.query(DocumentChunk).filter(DocumentChunk.document_id == document.id).delete()
        db.flush()

        for idx, chunk_text_str in enumerate(chunks):
            embedding = await embed_text(chunk_text_str)
            chunk = DocumentChunk(
                document_id=document.id,
                knowledge_base_id=document.knowledge_base_id,
                chunk_text=chunk_text_str,
                chunk_index=idx,
                embedding=embedding,
                chunk_metadata={"source": document.file_name, "chunk_index": idx},
            )
            db.add(chunk)

        document.processing_status = ProcessingStatus.ready
        document.error_message = None
        db.commit()

    except Exception as exc:
        document.processing_status = ProcessingStatus.failed
        document.error_message = str(exc)[:500]
        db.commit()
        raise


# ── Retrieval ─────────────────────────────────────────────────────────────────

async def retrieve_context(
    db: Session,
    knowledge_base_id: int,
    question: str,
    user_id: int,
    top_k: int | None = None,
) -> RAGContext:
    """Embed *question* and return the most relevant chunks + assembled context."""
    k = top_k if top_k is not None else settings.rag_top_k
    query_embedding = await embed_text(question)
    results = _vector_store.search(db, knowledge_base_id, query_embedding, k, user_id, query_text=question)

    sources: list[ChunkSource] = []
    context_parts: list[str] = []

    for chunk, score in results:
        doc = db.get(Document, chunk.document_id)
        file_name = doc.file_name if doc else "Unknown"
        sources.append(
            ChunkSource(
                document_id=chunk.document_id,
                file_name=file_name,
                chunk_index=chunk.chunk_index,
                chunk_text=chunk.chunk_text,
                similarity_score=round(score, 4),
            )
        )
        context_parts.append(
            f"[Source: {file_name}, chunk {chunk.chunk_index}]\n{chunk.chunk_text}"
        )

    context_text = "\n\n---\n\n".join(context_parts)
    return RAGContext(context_text=context_text, sources=sources)


async def retrieve_context_multi(
    db: Session,
    kb_ids: list[int],
    question: str,
    top_k: int | None = None,
) -> RAGContext:
    """Embed *question* and return relevant chunks + context searching across multiple KBs."""
    if not kb_ids:
        return RAGContext(context_text="", sources=[])
        
    k = top_k if top_k is not None else settings.rag_top_k
    query_embedding = await embed_text(question)
    
    # Simple search over all chunks from the specified KBs
    chunks = (
        db.query(DocumentChunk)
        .filter(DocumentChunk.knowledge_base_id.in_(kb_ids))
        .filter(DocumentChunk.embedding.isnot(None))
        .all()
    )
    scored: list[tuple[DocumentChunk, float]] = []
    for chunk in chunks:
        sim = compute_hybrid_score(question, query_embedding, chunk.chunk_text, chunk.embedding)
        scored.append((chunk, sim))
    scored.sort(key=lambda x: x[1], reverse=True)
    results = scored[:k]

    sources: list[ChunkSource] = []
    context_parts: list[str] = []

    for chunk, score in results:
        doc = db.get(Document, chunk.document_id)
        file_name = doc.file_name if doc else "Unknown"
        sources.append(
            ChunkSource(
                document_id=chunk.document_id,
                file_name=file_name,
                chunk_index=chunk.chunk_index,
                chunk_text=chunk.chunk_text,
                similarity_score=round(score, 4),
            )
        )
        context_parts.append(
            f"[Source: {file_name}, chunk {chunk.chunk_index}]\n{chunk.chunk_text}"
        )

    context_text = "\n\n---\n\n".join(context_parts)
    return RAGContext(context_text=context_text, sources=sources)



def build_rag_prompt(question: str, context: RAGContext, allow_general: bool = False) -> str:
    """Assemble the prompt that will be sent to the LLM."""
    general_note = (
        "You may supplement with general knowledge when relevant."
        if allow_general
        else "Do not use general knowledge outside the provided documents."
    )
    return (
        "You are a QA expert assistant. Answer the user's question using ONLY "
        "the document context provided below.\n\n"
        "Rules:\n"
        "- Answer using the provided document context.\n"
        "- Do not invent information that is not available in the provided context.\n"
        f"- {general_note}\n"
        "- If the answer cannot be found in the provided documents, say exactly: "
        "'I could not find enough information in the available documents to answer this question.'\n\n"
        f"Document Context:\n{context.context_text}\n\n"
        f"Question: {question}"
    )

"""Knowledge Base router.

Provides CRUD for knowledge bases and documents, document upload with async
processing, and RAG question-answering.

Security: every endpoint filters by the current user's ownership.
A user can only see and query their own knowledge bases.
"""

import asyncio

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.db import get_db
from app.models.models import Document, DocumentChunk, KnowledgeBase, ProcessingStatus, User
from app.schemas.schemas import (
    DocumentOut,
    KnowledgeBaseCreate,
    KnowledgeBaseOut,
    RAGAnswerResponse,
    RAGQuestionRequest,
    ChunkSourceOut,
)
from app.services.document_service import DocumentProcessingError, validate_file
from app.services.rag_service import build_rag_prompt, process_document, retrieve_context
from app.services.ai_service import AIServiceError, ai_service

router = APIRouter(prefix="/knowledge-bases", tags=["knowledge-bases"])

MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20 MB


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_owned_kb(db: Session, kb_id: int, user: User) -> KnowledgeBase:
    kb = (
        db.query(KnowledgeBase)
        .filter(KnowledgeBase.id == kb_id, KnowledgeBase.created_by == user.id)
        .first()
    )
    if kb is None:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    return kb


def _kb_to_out(kb: KnowledgeBase, db: Session) -> KnowledgeBaseOut:
    count = db.query(Document).filter(Document.knowledge_base_id == kb.id).count()
    return KnowledgeBaseOut(
        id=kb.id,
        name=kb.name,
        description=kb.description,
        created_by=kb.created_by,
        created_at=kb.created_at,
        document_count=count,
    )


# ── Knowledge Base CRUD ───────────────────────────────────────────────────────

@router.get("", response_model=list[KnowledgeBaseOut])
def list_knowledge_bases(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[KnowledgeBaseOut]:
    kbs = (
        db.query(KnowledgeBase)
        .filter(KnowledgeBase.created_by == user.id)
        .order_by(KnowledgeBase.created_at.desc())
        .all()
    )
    return [_kb_to_out(kb, db) for kb in kbs]


@router.post("", response_model=KnowledgeBaseOut, status_code=status.HTTP_201_CREATED)
def create_knowledge_base(
    payload: KnowledgeBaseCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> KnowledgeBaseOut:
    kb = KnowledgeBase(
        name=payload.name,
        description=payload.description,
        created_by=user.id,
    )
    db.add(kb)
    db.commit()
    db.refresh(kb)
    return _kb_to_out(kb, db)


@router.get("/{kb_id}", response_model=KnowledgeBaseOut)
def get_knowledge_base(
    kb_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> KnowledgeBaseOut:
    kb = _get_owned_kb(db, kb_id, user)
    return _kb_to_out(kb, db)


@router.delete("/{kb_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_knowledge_base(
    kb_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    kb = _get_owned_kb(db, kb_id, user)
    db.delete(kb)
    db.commit()


# ── Document management ───────────────────────────────────────────────────────

@router.get("/{kb_id}/documents", response_model=list[DocumentOut])
def list_documents(
    kb_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[DocumentOut]:
    _get_owned_kb(db, kb_id, user)
    docs = (
        db.query(Document)
        .filter(Document.knowledge_base_id == kb_id)
        .order_by(Document.created_at.desc())
        .all()
    )
    return [DocumentOut.model_validate(d) for d in docs]


@router.post(
    "/{kb_id}/documents",
    response_model=DocumentOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(
    kb_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DocumentOut:
    _get_owned_kb(db, kb_id, user)

    raw = await file.read()
    file_size = len(raw)

    try:
        ext = validate_file(file.filename or "upload.bin", file_size, file.content_type)
    except DocumentProcessingError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    doc = Document(
        knowledge_base_id=kb_id,
        file_name=file.filename or "upload",
        file_type=ext,
        file_size=file_size,
        uploaded_by=user.id,
        processing_status=ProcessingStatus.uploaded,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Process in background (fire and forget) — status visible via GET /documents
    asyncio.create_task(_process_in_background(doc.id, raw))

    return DocumentOut.model_validate(doc)


async def _process_in_background(doc_id: int, raw: bytes) -> None:
    """Run document processing in a background task."""
    from app.database.db import SessionLocal

    db = SessionLocal()
    try:
        doc = db.get(Document, doc_id)
        if doc is None:
            return
        await process_document(db, doc, raw)
    except Exception:
        pass  # Error is already recorded on the Document row
    finally:
        db.close()


@router.delete("/{kb_id}/documents/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    kb_id: int,
    doc_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    _get_owned_kb(db, kb_id, user)
    doc = (
        db.query(Document)
        .filter(Document.id == doc_id, Document.knowledge_base_id == kb_id)
        .first()
    )
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    db.delete(doc)
    db.commit()


# ── RAG Q&A ───────────────────────────────────────────────────────────────────

@router.post("/{kb_id}/ask", response_model=RAGAnswerResponse)
async def ask_knowledge_base(
    kb_id: int,
    payload: RAGQuestionRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RAGAnswerResponse:
    _get_owned_kb(db, kb_id, user)

    # Ensure at least one ready document exists
    ready_count = (
        db.query(Document)
        .filter(
            Document.knowledge_base_id == kb_id,
            Document.processing_status == ProcessingStatus.ready,
        )
        .count()
    )
    if ready_count == 0:
        raise HTTPException(
            status_code=422,
            detail="No ready documents in this knowledge base. Upload and wait for processing to complete.",
        )

    try:
        context = await retrieve_context(
            db, kb_id, payload.question, user.id
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Vector search failed: {exc}") from exc

    if not context.sources:
        return RAGAnswerResponse(
            answer="I could not find enough information in the available documents to answer this question.",
            sources=[],
            knowledge_base_used=True,
        )

    prompt = build_rag_prompt(payload.question, context, payload.allow_general_knowledge)

    try:
        history = [{"role": "user", "content": prompt}]
        answer = await ai_service.chat_reply(history)
    except AIServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    sources_out = [
        ChunkSourceOut(
            document_id=s.document_id,
            file_name=s.file_name,
            chunk_index=s.chunk_index,
            chunk_text=s.chunk_text[:300] + ("..." if len(s.chunk_text) > 300 else ""),
            similarity_score=s.similarity_score,
        )
        for s in context.sources
    ]

    return RAGAnswerResponse(
        answer=answer,
        sources=sources_out,
        knowledge_base_used=True,
    )

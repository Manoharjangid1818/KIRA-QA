from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_accessible_kbs_query
from app.database.db import get_db
from app.models.models import ChatAttachment, Conversation, Message, User
from app.schemas.schemas import (
    ConversationCreate,
    ConversationDetailOut,
    ConversationOut,
    ConversationUpdate,
    MessageOut,
    SendMessageRequest,
    SendMessageResponse,
)
from app.services.ai_service import AIServiceError, ai_service
from app.services.rag_service import retrieve_context_multi


router = APIRouter(prefix="/conversations", tags=["conversations"])


def _get_owned_conversation(db: Session, conversation_id: int, user: User) -> Conversation:
    conversation = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.user_id == user.id)
        .first()
    )
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


@router.get("", response_model=list[ConversationOut])
def list_conversations(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[ConversationOut]:
    rows = (
        db.query(Conversation, func.count(Message.id))
        .outerjoin(Message, Message.conversation_id == Conversation.id)
        .filter(Conversation.user_id == user.id)
        .group_by(Conversation.id)
        .order_by(Conversation.updated_at.desc())
        .all()
    )
    return [
        ConversationOut(
            id=c.id,
            title=c.title,
            created_at=c.created_at,
            updated_at=c.updated_at,
            message_count=count,
        )
        for c, count in rows
    ]


@router.post("", response_model=ConversationOut, status_code=status.HTTP_201_CREATED)
def create_conversation(
    payload: ConversationCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ConversationOut:
    conversation = Conversation(user_id=user.id, title=payload.title or "New conversation")
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return ConversationOut(
        id=conversation.id,
        title=conversation.title,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
        message_count=0,
    )


@router.get("/{conversation_id}", response_model=ConversationDetailOut)
def get_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ConversationDetailOut:
    conversation = _get_owned_conversation(db, conversation_id, user)
    return ConversationDetailOut.model_validate(conversation)


@router.patch("/{conversation_id}", response_model=ConversationOut)
def update_conversation(
    conversation_id: int,
    payload: ConversationUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ConversationOut:
    conversation = _get_owned_conversation(db, conversation_id, user)
    conversation.title = payload.title
    db.commit()
    db.refresh(conversation)
    message_count = (
        db.query(func.count(Message.id))
        .filter(Message.conversation_id == conversation.id)
        .scalar()
    )
    return ConversationOut(
        id=conversation.id,
        title=conversation.title,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
        message_count=message_count or 0,
    )


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    conversation = _get_owned_conversation(db, conversation_id, user)
    db.delete(conversation)
    db.commit()


@router.post("/{conversation_id}/messages", response_model=SendMessageResponse, status_code=status.HTTP_201_CREATED)
async def send_message(
    conversation_id: int,
    payload: SendMessageRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SendMessageResponse:
    conversation = _get_owned_conversation(db, conversation_id, user)

    # ── Load & validate attachments ──────────────────────────────────────────
    attachments: list[ChatAttachment] = []
    if payload.attachment_ids:
        for att_id in payload.attachment_ids:
            att = (
                db.query(ChatAttachment)
                .filter(ChatAttachment.id == att_id, ChatAttachment.user_id == user.id)
                .first()
            )
            if att is None:
                raise HTTPException(status_code=404, detail=f"Attachment {att_id} not found")
            attachments.append(att)
        # Link attachments to this conversation for audit trail
        for att in attachments:
            if att.conversation_id is None:
                att.conversation_id = conversation.id
        db.commit()

    # ── Save user message ─────────────────────────────────────────────────────
    user_message = Message(
        conversation_id=conversation.id, role="user", content=payload.content
    )
    db.add(user_message)
    db.commit()
    db.refresh(user_message)

    history = [{"role": m.role, "content": m.content} for m in conversation.messages]
    rag_sources: list[dict] | None = None

    # ── Route request based on attachment types ───────────────────────────────
    image_attachments = [a for a in attachments if a.file_category == "image" and a.file_data_b64]
    doc_attachments = [a for a in attachments if a.file_category == "document" and a.extracted_text]
    failed_attachments = [a for a in attachments if a.status == "failed"]

    # CASE 1: images present → vision model handles everything
    if image_attachments:
        from app.services.vision_service import VisionServiceError, analyze_image

        # Build question: include document context if also present
        question = payload.content
        if doc_attachments:
            doc_context = "\n\n".join(
                f"[Document: {a.file_name}]\n{a.extracted_text[:3000]}" for a in doc_attachments
            )
            question = f"{payload.content}\n\nAdditional context from uploaded documents:\n{doc_context}"
        if failed_attachments:
            question += "\n\n(Note: some attachments failed to process: " + ", ".join(a.file_name for a in failed_attachments) + ")"

        # Use first image for vision; if multiple, describe all
        img = image_attachments[0]
        if len(image_attachments) > 1:
            question += f"\n\n(There are {len(image_attachments)} images; analyzing the first: {img.file_name})"

        try:
            reply = await analyze_image(
                file_data_b64=img.file_data_b64,
                file_type=img.file_type,
                question=question,
                file_name=img.file_name,
            )
        except VisionServiceError as exc:
            raise HTTPException(status_code=502, detail=f"Vision model error: {exc}") from exc

    # CASE 2: documents only → inject text into prompt, send to text LLM
    elif doc_attachments:
        doc_blocks = []
        for att in doc_attachments:
            # Truncate very large documents to avoid context overflows
            text = att.extracted_text or ""
            if len(text) > 12000:
                text = text[:12000] + f"\n\n[… document truncated at 12 000 chars. Full length: {len(att.extracted_text)} chars]"
            doc_blocks.append(f"=== Uploaded document: {att.file_name} ===\n{text}")

        doc_context = "\n\n".join(doc_blocks)
        augmented_content = (
            f"{payload.content}\n\n"
            f"The following document(s) have been uploaded for your analysis:\n\n"
            f"{doc_context}\n\n"
            f"Please answer the user's question using the content of the uploaded document(s). "
            f"If the information is not present in the documents, clearly say so."
        )
        # Replace the last user turn with augmented content
        if history:
            history[-1] = {"role": "user", "content": augmented_content}
        if failed_attachments:
            note = "\n\n(Note: some attachments failed to process: " + ", ".join(a.file_name for a in failed_attachments) + ")"
            history[-1]["content"] += note

        # RAG still applies if KB selected
        if payload.knowledge_base_id is not None:
            from app.models.models import KnowledgeBase
            from app.services.rag_service import build_rag_prompt, retrieve_context
            kb = (
                db.query(KnowledgeBase)
                .filter(KnowledgeBase.id == payload.knowledge_base_id, KnowledgeBase.created_by == user.id)
                .first()
            )
            if kb:
                try:
                    context = await retrieve_context(db, payload.knowledge_base_id, payload.content, user.id)
                    if context.sources:
                        rag_prompt = build_rag_prompt(payload.content, context)
                        history[-1]["content"] += f"\n\nAdditional RAG context:\n{rag_prompt}"
                        rag_sources = [
                            {"document_id": s.document_id, "file_name": s.file_name,
                             "chunk_index": s.chunk_index, "similarity_score": s.similarity_score}
                            for s in context.sources
                        ]
                except Exception:
                    pass

        try:
            reply = await ai_service.chat_reply(history)
        except AIServiceError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

    # CASE 3: no attachments → normal chat (with optional RAG)
    else:
        from app.services.rag_service import build_rag_prompt, retrieve_context

        # If a specific KB is requested:
        if payload.knowledge_base_id is not None:
            from app.models.models import KnowledgeBase
            kb = (
                get_accessible_kbs_query(db, user)
                .filter(KnowledgeBase.id == payload.knowledge_base_id)
                .first()
            )
            if kb is None:
                raise HTTPException(status_code=404, detail="Knowledge base not found")
            try:
                context = await retrieve_context(db, payload.knowledge_base_id, payload.content, user.id)
                if context.sources:
                    rag_prompt = build_rag_prompt(payload.content, context)
                    history[-1] = {"role": "user", "content": rag_prompt}
                    rag_sources = [
                        {"document_id": s.document_id, "file_name": s.file_name,
                         "chunk_index": s.chunk_index, "similarity_score": s.similarity_score}
                        for s in context.sources
                    ]
            except Exception:
                pass

        # If NO specific KB is requested, automatically check all accessible KBs for relevant documents:
        else:
            try:
                from app.models.models import KnowledgeBase
                accessible_kb_ids = [kb.id for kb in get_accessible_kbs_query(db, user).all()]
                if accessible_kb_ids:
                    context = await retrieve_context_multi(db, accessible_kb_ids, payload.content)
                    # Use a similarity threshold of 0.25 to check if the question matches any document
                    if context.sources and any(s.similarity_score >= 0.25 for s in context.sources):
                        rag_prompt = build_rag_prompt(payload.content, context, allow_general=True)
                        history[-1] = {"role": "user", "content": rag_prompt}
                        rag_sources = [
                            {"document_id": s.document_id, "file_name": s.file_name,
                             "chunk_index": s.chunk_index, "similarity_score": s.similarity_score}
                            for s in context.sources
                        ]
            except Exception:
                pass

        try:
            reply = await ai_service.chat_reply(history)
        except AIServiceError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc


    # ── Save assistant message ────────────────────────────────────────────────
    assistant_message = Message(
        conversation_id=conversation.id, role="assistant", content=reply
    )
    db.add(assistant_message)

    if conversation.title == "New conversation":
        conversation.title = payload.content.strip()[:60] or conversation.title

    db.commit()
    db.refresh(assistant_message)

    return SendMessageResponse(
        user_message=MessageOut.model_validate(user_message),
        assistant_message=MessageOut.model_validate(assistant_message),
        rag_sources=rag_sources,
    )

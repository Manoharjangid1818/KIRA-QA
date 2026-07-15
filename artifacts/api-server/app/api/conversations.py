from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.db import get_db
from app.models.models import Conversation, Message, User
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

    user_message = Message(
        conversation_id=conversation.id, role="user", content=payload.content
    )
    db.add(user_message)
    db.commit()
    db.refresh(user_message)

    history = [
        {"role": m.role, "content": m.content}
        for m in conversation.messages
    ]

    rag_sources: list[dict] | None = None

    if payload.knowledge_base_id is not None:
        from app.models.models import KnowledgeBase, ProcessingStatus
        from app.services.rag_service import build_rag_prompt, retrieve_context

        kb = (
            db.query(KnowledgeBase)
            .filter(
                KnowledgeBase.id == payload.knowledge_base_id,
                KnowledgeBase.created_by == user.id,
            )
            .first()
        )
        if kb is None:
            raise HTTPException(status_code=404, detail="Knowledge base not found")

        try:
            context = await retrieve_context(
                db, payload.knowledge_base_id, payload.content, user.id
            )
            if context.sources:
                rag_prompt = build_rag_prompt(payload.content, context)
                history[-1] = {"role": "user", "content": rag_prompt}
                rag_sources = [
                    {
                        "document_id": s.document_id,
                        "file_name": s.file_name,
                        "chunk_index": s.chunk_index,
                        "similarity_score": s.similarity_score,
                    }
                    for s in context.sources
                ]
        except Exception:
            pass  # Degrade gracefully: fall back to normal chat if RAG fails

    try:
        reply = await ai_service.chat_reply(history)
    except AIServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

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

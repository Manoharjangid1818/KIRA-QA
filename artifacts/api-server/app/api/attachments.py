"""Chat Attachment router.

Handles temporary file uploads for in-chat document and image analysis.
Files are stored per-user and never shared across users.
They are not added to the permanent Knowledge Base automatically.
"""

import base64

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.database.db import get_db
from app.models.models import ChatAttachment, User
from app.schemas.schemas import ChatAttachmentOut
from app.services.document_service import DocumentProcessingError, extract_text, validate_file

router = APIRouter(prefix="/attachments", tags=["attachments"])

# Supported image extensions
IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "gif"}
DOCUMENT_EXTENSIONS = {"pdf", "docx", "txt", "csv", "md", "markdown"}
ALL_ALLOWED = IMAGE_EXTENSIONS | DOCUMENT_EXTENSIONS


def _validate_attachment(file_name: str, file_size: int) -> tuple[str, str]:
    """Returns (extension, category). Raises HTTPException on invalid input."""
    if not settings.attachments_enabled:
        raise HTTPException(status_code=403, detail="File attachments are disabled by admin.")

    max_bytes = settings.attachment_max_file_size_mb * 1024 * 1024
    ext = file_name.rsplit(".", 1)[-1].lower() if "." in file_name else ""

    if ext not in ALL_ALLOWED:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported file type '.{ext}'. Allowed: {', '.join(sorted(ALL_ALLOWED))}.",
        )
    if file_size > max_bytes:
        raise HTTPException(
            status_code=422,
            detail=f"File too large ({file_size // (1024*1024)} MB). Max is {settings.attachment_max_file_size_mb} MB.",
        )

    category = "image" if ext in IMAGE_EXTENSIONS else "document"

    if category == "image" and not settings.image_analysis_enabled:
        raise HTTPException(status_code=403, detail="Image analysis is disabled by admin.")

    return ext, category


@router.post("", response_model=ChatAttachmentOut, status_code=status.HTTP_201_CREATED)
async def upload_attachment(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ChatAttachmentOut:
    raw = await file.read()
    file_size = len(raw)
    file_name = file.filename or "upload"

    ext, category = _validate_attachment(file_name, file_size)

    attachment = ChatAttachment(
        user_id=user.id,
        file_name=file_name,
        file_type=ext,
        file_category=category,
        file_size=file_size,
        status="processing",
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)

    # Process synchronously (files are small; users expect immediate feedback)
    try:
        if category == "document":
            text = extract_text(raw, ext)
            attachment.extracted_text = text
        else:
            # Store base64 for vision API calls
            attachment.file_data_b64 = base64.b64encode(raw).decode("utf-8")
        attachment.status = "ready"
    except DocumentProcessingError as exc:
        attachment.status = "failed"
        attachment.error_message = str(exc)
    except Exception as exc:
        attachment.status = "failed"
        attachment.error_message = f"Processing error: {str(exc)[:200]}"

    db.commit()
    db.refresh(attachment)
    return ChatAttachmentOut.model_validate(attachment)


@router.get("/{attachment_id}", response_model=ChatAttachmentOut)
def get_attachment(
    attachment_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ChatAttachmentOut:
    att = _get_owned_attachment(db, attachment_id, user)
    return ChatAttachmentOut.model_validate(att)


@router.delete("/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_attachment(
    attachment_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    att = _get_owned_attachment(db, attachment_id, user)
    db.delete(att)
    db.commit()


def _get_owned_attachment(db: Session, attachment_id: int, user: User) -> ChatAttachment:
    att = (
        db.query(ChatAttachment)
        .filter(ChatAttachment.id == attachment_id, ChatAttachment.user_id == user.id)
        .first()
    )
    if att is None:
        raise HTTPException(status_code=404, detail="Attachment not found")
    return att

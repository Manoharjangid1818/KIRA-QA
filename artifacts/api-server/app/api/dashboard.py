from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.database.db import get_db
from app.models.models import ArtifactType, Conversation, GeneratedArtifact, User
from app.schemas.schemas import AiProviderStatus, DashboardSummary, RecentActivityItem

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def summary(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> DashboardSummary:
    total_conversations = (
        db.query(func.count(Conversation.id)).filter(Conversation.user_id == user.id).scalar()
        or 0
    )
    total_artifacts = (
        db.query(func.count(GeneratedArtifact.id))
        .filter(GeneratedArtifact.user_id == user.id)
        .scalar()
        or 0
    )

    counts_by_type = dict(
        db.query(GeneratedArtifact.artifact_type, func.count(GeneratedArtifact.id))
        .filter(GeneratedArtifact.user_id == user.id)
        .group_by(GeneratedArtifact.artifact_type)
        .all()
    )
    artifacts_by_type = {t.value: counts_by_type.get(t.value, 0) for t in ArtifactType}

    recent_rows = (
        db.query(GeneratedArtifact)
        .filter(GeneratedArtifact.user_id == user.id)
        .order_by(GeneratedArtifact.created_at.desc())
        .limit(8)
        .all()
    )
    recent_activity = [
        RecentActivityItem(
            type=row.artifact_type, id=row.id, title=row.title, created_at=row.created_at
        )
        for row in recent_rows
    ]

    return DashboardSummary(
        total_conversations=total_conversations,
        total_artifacts=total_artifacts,
        artifacts_by_type=artifacts_by_type,
        recent_activity=recent_activity,
        ai_provider=AiProviderStatus(configured=settings.ai_configured, model=settings.llm_model),
    )

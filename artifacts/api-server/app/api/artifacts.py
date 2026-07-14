from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.db import get_db
from app.models.models import GeneratedArtifact, User
from app.schemas.schemas import (
    GeneratedArtifactCreate,
    GeneratedArtifactListItem,
    GeneratedArtifactOut,
)

router = APIRouter(prefix="/artifacts", tags=["artifacts"])


@router.post("", response_model=GeneratedArtifactOut, status_code=status.HTTP_201_CREATED)
def create_artifact(
    payload: GeneratedArtifactCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> GeneratedArtifactOut:
    artifact = GeneratedArtifact(
        user_id=user.id,
        artifact_type=payload.artifact_type,
        title=payload.title,
        input_data=payload.input_data,
        output_data=payload.output_data,
    )
    db.add(artifact)
    db.commit()
    db.refresh(artifact)
    return GeneratedArtifactOut.model_validate(artifact)


@router.get("", response_model=list[GeneratedArtifactListItem])
def list_artifacts(
    artifact_type: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[GeneratedArtifactListItem]:
    query = db.query(GeneratedArtifact).filter(GeneratedArtifact.user_id == user.id)
    if artifact_type:
        query = query.filter(GeneratedArtifact.artifact_type == artifact_type)
    rows = query.order_by(GeneratedArtifact.created_at.desc()).all()
    return [GeneratedArtifactListItem.model_validate(row) for row in rows]


@router.get("/{artifact_id}", response_model=GeneratedArtifactOut)
def get_artifact(
    artifact_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> GeneratedArtifactOut:
    artifact = (
        db.query(GeneratedArtifact)
        .filter(GeneratedArtifact.id == artifact_id, GeneratedArtifact.user_id == user.id)
        .first()
    )
    if artifact is None:
        raise HTTPException(status_code=404, detail="Artifact not found")
    return GeneratedArtifactOut.model_validate(artifact)


@router.delete("/{artifact_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_artifact(
    artifact_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    artifact = (
        db.query(GeneratedArtifact)
        .filter(GeneratedArtifact.id == artifact_id, GeneratedArtifact.user_id == user.id)
        .first()
    )
    if artifact is None:
        raise HTTPException(status_code=404, detail="Artifact not found")
    db.delete(artifact)
    db.commit()

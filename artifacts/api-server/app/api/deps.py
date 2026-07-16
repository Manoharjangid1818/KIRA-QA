from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.database.db import get_db
from app.models.models import User, UserRole

bearer_scheme = HTTPBearer(auto_error=False)

ADMIN_ROLES = {UserRole.super_admin, UserRole.admin}


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )

    user_id_str = decode_access_token(credentials.credentials)
    if user_id_str is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token"
        )

    user = db.get(User, int(user_id_str))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
        )
    if user.status == "inactive":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated"
        )
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ADMIN_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


def get_accessible_kbs_query(db: Session, user: User):
    from app.models.models import KnowledgeBase
    
    # Admins see everything
    if user.role in ("super_admin", "admin"):
        return db.query(KnowledgeBase)
    
    # Standard user check
    project_ids = [up.project_id for up in user.user_projects]
    return db.query(KnowledgeBase).filter(
        (KnowledgeBase.kb_type == "company") |
        (KnowledgeBase.created_by == user.id) |
        ((KnowledgeBase.kb_type == "department") & (KnowledgeBase.department_id == user.department_id)) |
        ((KnowledgeBase.kb_type == "project") & (KnowledgeBase.project_id.in_(project_ids) if project_ids else False))
    )


"""Admin API — all management endpoints for Super Admin / Admin roles only."""

from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin
from app.core.security import hash_password
from app.models.models import (
    AIModelConfig, ChatAttachment, Conversation, Department, Document,
    DocumentChunk, KnowledgeBase, Message, ProcessingStatus, Project,
    PromptTemplate, RAGConfig, SystemLog, SystemSettings, User,
    UserPermission, UserProject, VisionModelConfig,
)
from app.schemas.schemas import (
    AdminDashboardStats, AdminPasswordReset, AdminUserCreate,
    AdminUserOut, AdminUserProjectAssign, AdminUserUpdate,
    AIModelConfigOut, AIModelConfigUpdate, ConversationAuditOut,
    DepartmentCreate, DepartmentOut, DepartmentUpdate,
    GeneralSettingsOut, GeneralSettingsUpdate, KnowledgeBaseCreate,
    KnowledgeBaseOut, ProjectCreate, ProjectMemberAssign, ProjectOut,
    ProjectUpdate, PromptTemplateCreate, PromptTemplateOut,
    PromptTemplateUpdate, RAGConfigOut, RAGConfigUpdate,
    StorageStats, SystemLogOut, UserPermissionOut, UserPermissionUpdate,
    VisionModelConfigOut, VisionModelConfigUpdate,
)

router = APIRouter(prefix="/admin", tags=["admin"])

ADMIN_ROLE_VALUES = {"super_admin", "admin"}

# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_setting(db: Session, key: str, default: str = "") -> str:
    row = db.query(SystemSettings).filter(SystemSettings.key == key).first()
    return row.value if row else default


def _set_setting(db: Session, key: str, value: str) -> None:
    row = db.query(SystemSettings).filter(SystemSettings.key == key).first()
    if row:
        row.value = value
    else:
        db.add(SystemSettings(key=key, value=value))


def _log(db: Session, level: str, category: str, message: str, details: dict | None = None) -> None:
    db.add(SystemLog(level=level, category=category, message=message, details=details))


def _build_admin_user_out(user: User, db: Session) -> AdminUserOut:
    conv_count = db.query(func.count(Conversation.id)).filter(Conversation.user_id == user.id).scalar() or 0
    project_ids = [up.project_id for up in user.user_projects]
    return AdminUserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        status=user.status,
        department_id=user.department_id,
        last_login=user.last_login,
        created_at=user.created_at,
        conversation_count=conv_count,
        project_ids=project_ids,
    )


# ── Dashboard ─────────────────────────────────────────────────────────────────

@router.get("/dashboard", response_model=AdminDashboardStats)
def admin_dashboard(db: Session = Depends(get_db), _: User = Depends(require_admin)) -> AdminDashboardStats:
    total_users = db.query(func.count(User.id)).scalar() or 0
    active_users = db.query(func.count(User.id)).filter(User.status == "active").scalar() or 0
    total_conversations = db.query(func.count(Conversation.id)).scalar() or 0
    total_kbs = db.query(func.count(KnowledgeBase.id)).scalar() or 0
    total_docs = db.query(func.count(Document.id)).scalar() or 0
    total_projects = db.query(func.count(Project.id)).scalar() or 0
    total_departments = db.query(func.count(Department.id)).scalar() or 0
    failed_docs = db.query(func.count(Document.id)).filter(
        Document.processing_status == ProcessingStatus.failed
    ).scalar() or 0
    return AdminDashboardStats(
        total_users=total_users,
        active_users=active_users,
        total_conversations=total_conversations,
        total_messages=db.query(func.count(Message.id)).scalar() or 0,
        total_knowledge_bases=total_kbs,
        total_documents=total_docs,
        total_projects=total_projects,
        total_departments=total_departments,
        failed_documents=failed_docs,
        system_status="ok",
    )


@router.get("/dashboard/recent-activity")
def admin_recent_activity(db: Session = Depends(get_db), _: User = Depends(require_admin)) -> dict:
    recent_users = (
        db.query(User).order_by(User.created_at.desc()).limit(5).all()
    )
    recent_docs = (
        db.query(Document).order_by(Document.created_at.desc()).limit(5).all()
    )
    recent_errors = (
        db.query(SystemLog)
        .filter(SystemLog.level == "error")
        .order_by(SystemLog.created_at.desc())
        .limit(5)
        .all()
    )
    recent_kb_updates = (
        db.query(KnowledgeBase).order_by(KnowledgeBase.created_at.desc()).limit(5).all()
    )
    return {
        "recent_users": [{"id": u.id, "email": u.email, "full_name": u.full_name, "created_at": u.created_at} for u in recent_users],
        "recent_documents": [{"id": d.id, "file_name": d.file_name, "processing_status": d.processing_status, "created_at": d.created_at} for d in recent_docs],
        "recent_errors": [{"id": e.id, "message": e.message, "category": e.category, "created_at": e.created_at} for e in recent_errors],
        "recent_kb_updates": [{"id": kb.id, "name": kb.name, "created_at": kb.created_at} for kb in recent_kb_updates],
    }


# ── Users ─────────────────────────────────────────────────────────────────────

@router.get("/users", response_model=list[AdminUserOut])
def list_users(db: Session = Depends(get_db), _: User = Depends(require_admin)) -> list[AdminUserOut]:
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [_build_admin_user_out(u, db) for u in users]


@router.post("/users", response_model=AdminUserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: AdminUserCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> AdminUserOut:
    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already in use")
    user = User(
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        role=payload.role,
        status=payload.status,
        department_id=payload.department_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    _log(db, "info", "auth", f"Admin {admin.email} created user {user.email}")
    db.commit()
    return _build_admin_user_out(user, db)


@router.get("/users/{user_id}", response_model=AdminUserOut)
def get_user(user_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)) -> AdminUserOut:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _build_admin_user_out(user, db)


@router.patch("/users/{user_id}", response_model=AdminUserOut)
def update_user(
    user_id: int,
    payload: AdminUserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> AdminUserOut:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.role is not None:
        user.role = payload.role
    if payload.department_id is not None:
        user.department_id = payload.department_id
    if payload.status is not None:
        user.status = payload.status
    db.commit()
    db.refresh(user)
    _log(db, "info", "auth", f"Admin {admin.email} updated user {user.email}")
    db.commit()
    return _build_admin_user_out(user, db)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> None:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    db.delete(user)
    _log(db, "info", "auth", f"Admin {admin.email} deleted user {user.email}")
    db.commit()


@router.post("/users/{user_id}/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def reset_user_password(
    user_id: int,
    payload: AdminPasswordReset,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> None:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.password_hash = hash_password(payload.new_password)
    _log(db, "info", "auth", f"Admin {admin.email} reset password for {user.email}")
    db.commit()


@router.post("/users/{user_id}/assign-projects", status_code=status.HTTP_204_NO_CONTENT)
def assign_projects(
    user_id: int,
    payload: AdminUserProjectAssign,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> None:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.query(UserProject).filter(UserProject.user_id == user_id).delete()
    for pid in payload.project_ids:
        db.add(UserProject(user_id=user_id, project_id=pid))
    db.commit()


# ── Departments ───────────────────────────────────────────────────────────────

@router.get("/departments", response_model=list[DepartmentOut])
def list_departments(db: Session = Depends(get_db), _: User = Depends(require_admin)) -> list[DepartmentOut]:
    depts = db.query(Department).order_by(Department.name).all()
    result = []
    for d in depts:
        count = db.query(func.count(User.id)).filter(User.department_id == d.id).scalar() or 0
        result.append(DepartmentOut(
            id=d.id, name=d.name, description=d.description,
            manager_id=d.manager_id, created_at=d.created_at, member_count=count,
        ))
    return result


@router.post("/departments", response_model=DepartmentOut, status_code=status.HTTP_201_CREATED)
def create_department(
    payload: DepartmentCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> DepartmentOut:
    existing = db.query(Department).filter(Department.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Department name already exists")
    dept = Department(name=payload.name, description=payload.description, manager_id=payload.manager_id)
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return DepartmentOut(id=dept.id, name=dept.name, description=dept.description,
                         manager_id=dept.manager_id, created_at=dept.created_at, member_count=0)


@router.patch("/departments/{dept_id}", response_model=DepartmentOut)
def update_department(
    dept_id: int,
    payload: DepartmentUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> DepartmentOut:
    dept = db.get(Department, dept_id)
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    if payload.name is not None:
        dept.name = payload.name
    if payload.description is not None:
        dept.description = payload.description
    if payload.manager_id is not None:
        dept.manager_id = payload.manager_id
    db.commit()
    db.refresh(dept)
    count = db.query(func.count(User.id)).filter(User.department_id == dept.id).scalar() or 0
    return DepartmentOut(id=dept.id, name=dept.name, description=dept.description,
                         manager_id=dept.manager_id, created_at=dept.created_at, member_count=count)


@router.delete("/departments/{dept_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_department(dept_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)) -> None:
    dept = db.get(Department, dept_id)
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    db.delete(dept)
    db.commit()


@router.post("/departments/{dept_id}/assign-users", status_code=status.HTTP_204_NO_CONTENT)
def assign_department_users(
    dept_id: int,
    user_ids: list[int],
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> None:
    dept = db.get(Department, dept_id)
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    db.query(User).filter(User.department_id == dept_id).update({"department_id": None})
    if user_ids:
        db.query(User).filter(User.id.in_(user_ids)).update({"department_id": dept_id})
    db.commit()


# ── Projects ──────────────────────────────────────────────────────────────────

@router.get("/projects", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db), _: User = Depends(require_admin)) -> list[ProjectOut]:
    projects = db.query(Project).order_by(Project.name).all()
    result = []
    for p in projects:
        count = db.query(func.count(UserProject.id)).filter(UserProject.project_id == p.id).scalar() or 0
        result.append(ProjectOut(
            id=p.id, name=p.name, description=p.description, status=p.status,
            manager_id=p.manager_id, created_at=p.created_at, member_count=count,
        ))
    return result


@router.post("/projects", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> ProjectOut:
    project = Project(name=payload.name, description=payload.description, manager_id=payload.manager_id)
    db.add(project)
    db.commit()
    db.refresh(project)
    return ProjectOut(id=project.id, name=project.name, description=project.description,
                      status=project.status, manager_id=project.manager_id,
                      created_at=project.created_at, member_count=0)


@router.patch("/projects/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> ProjectOut:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if payload.name is not None:
        project.name = payload.name
    if payload.description is not None:
        project.description = payload.description
    if payload.status is not None:
        project.status = payload.status
    if payload.manager_id is not None:
        project.manager_id = payload.manager_id
    db.commit()
    db.refresh(project)
    count = db.query(func.count(UserProject.id)).filter(UserProject.project_id == project.id).scalar() or 0
    return ProjectOut(id=project.id, name=project.name, description=project.description,
                      status=project.status, manager_id=project.manager_id,
                      created_at=project.created_at, member_count=count)


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)) -> None:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(project)
    db.commit()


@router.post("/projects/{project_id}/members", status_code=status.HTTP_204_NO_CONTENT)
def assign_project_members(
    project_id: int,
    payload: ProjectMemberAssign,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> None:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    db.query(UserProject).filter(UserProject.project_id == project_id).delete()
    for uid in payload.user_ids:
        db.add(UserProject(user_id=uid, project_id=project_id))
    db.commit()


# ── Knowledge Bases (admin view — all, not just own) ─────────────────────────

@router.get("/knowledge-bases", response_model=list[KnowledgeBaseOut])
def list_all_kbs(db: Session = Depends(get_db), _: User = Depends(require_admin)) -> list[KnowledgeBaseOut]:
    kbs = db.query(KnowledgeBase).order_by(KnowledgeBase.created_at.desc()).all()
    result = []
    for kb in kbs:
        doc_count = db.query(func.count(Document.id)).filter(Document.knowledge_base_id == kb.id).scalar() or 0
        result.append(KnowledgeBaseOut(
            id=kb.id, name=kb.name, description=kb.description, kb_type=kb.kb_type,
            department_id=kb.department_id, project_id=kb.project_id,
            created_by=kb.created_by, created_at=kb.created_at, document_count=doc_count,
        ))
    return result


@router.post("/knowledge-bases", response_model=KnowledgeBaseOut, status_code=status.HTTP_201_CREATED)
def admin_create_kb(
    payload: KnowledgeBaseCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> KnowledgeBaseOut:
    kb = KnowledgeBase(
        name=payload.name, description=payload.description,
        kb_type=payload.kb_type, department_id=payload.department_id,
        project_id=payload.project_id, created_by=admin.id,
    )
    db.add(kb)
    db.commit()
    db.refresh(kb)
    return KnowledgeBaseOut(id=kb.id, name=kb.name, description=kb.description,
                            kb_type=kb.kb_type, department_id=kb.department_id,
                            project_id=kb.project_id, created_by=kb.created_by,
                            created_at=kb.created_at, document_count=0)


@router.delete("/knowledge-bases/{kb_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_kb(kb_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)) -> None:
    kb = db.get(KnowledgeBase, kb_id)
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    db.delete(kb)
    db.commit()


# ── Documents ─────────────────────────────────────────────────────────────────

@router.get("/documents")
def list_all_documents(db: Session = Depends(get_db), _: User = Depends(require_admin)) -> list[dict]:
    docs = db.query(Document).order_by(Document.created_at.desc()).all()
    result = []
    for d in docs:
        uploader = db.get(User, d.uploaded_by)
        kb = db.get(KnowledgeBase, d.knowledge_base_id)
        result.append({
            "id": d.id,
            "knowledge_base_id": d.knowledge_base_id,
            "knowledge_base_name": kb.name if kb else None,
            "file_name": d.file_name,
            "file_type": d.file_type,
            "file_size": d.file_size,
            "uploaded_by": d.uploaded_by,
            "uploader_email": uploader.email if uploader else None,
            "processing_status": d.processing_status,
            "error_message": d.error_message,
            "created_at": d.created_at,
        })
    return result


@router.delete("/documents/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_document(doc_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)) -> None:
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    db.delete(doc)
    db.commit()


@router.post("/documents/{doc_id}/reprocess", status_code=status.HTTP_204_NO_CONTENT)
def reprocess_document(doc_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)) -> None:
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    doc.processing_status = ProcessingStatus.uploaded
    doc.error_message = None
    db.query(DocumentChunk).filter(DocumentChunk.document_id == doc_id).delete()
    db.commit()


# ── Access Control ────────────────────────────────────────────────────────────

@router.get("/access-control/{user_id}", response_model=UserPermissionOut)
def get_user_permissions(user_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)) -> UserPermissionOut:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    perms = user.permissions
    if not perms:
        perms = UserPermission(user_id=user_id)
        db.add(perms)
        db.commit()
        db.refresh(perms)
    return UserPermissionOut.model_validate(perms)


@router.patch("/access-control/{user_id}", response_model=UserPermissionOut)
def update_user_permissions(
    user_id: int,
    payload: UserPermissionUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> UserPermissionOut:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    perms = user.permissions
    if not perms:
        perms = UserPermission(user_id=user_id)
        db.add(perms)
        db.flush()
    if payload.can_upload_files is not None:
        perms.can_upload_files = payload.can_upload_files
    if payload.can_use_image_analysis is not None:
        perms.can_use_image_analysis = payload.can_use_image_analysis
    if payload.can_access_company_knowledge is not None:
        perms.can_access_company_knowledge = payload.can_access_company_knowledge
    if payload.can_use_restricted_knowledge is not None:
        perms.can_use_restricted_knowledge = payload.can_use_restricted_knowledge
    db.commit()
    db.refresh(perms)
    return UserPermissionOut.model_validate(perms)


# ── AI Model Config ───────────────────────────────────────────────────────────

def _get_or_create_ai_config(db: Session) -> AIModelConfig:
    cfg = db.query(AIModelConfig).first()
    if not cfg:
        cfg = AIModelConfig()
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg


@router.get("/ai-config", response_model=AIModelConfigOut)
def get_ai_config(db: Session = Depends(get_db), _: User = Depends(require_admin)) -> AIModelConfigOut:
    cfg = _get_or_create_ai_config(db)
    return AIModelConfigOut(
        provider=cfg.provider, model_name=cfg.model_name, base_url=cfg.base_url,
        has_api_key=bool(cfg.api_key_hash), temperature=cfg.temperature,
        max_tokens=cfg.max_tokens, timeout=cfg.timeout, updated_at=cfg.updated_at,
    )


@router.put("/ai-config", response_model=AIModelConfigOut)
def update_ai_config(
    payload: AIModelConfigUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> AIModelConfigOut:
    cfg = _get_or_create_ai_config(db)
    if payload.provider is not None:
        cfg.provider = payload.provider
    if payload.model_name is not None:
        cfg.model_name = payload.model_name
    if payload.base_url is not None:
        cfg.base_url = payload.base_url
    if payload.api_key is not None and payload.api_key.strip():
        cfg.api_key_hash = payload.api_key  # store as-is; used by LLM service
    if payload.temperature is not None:
        cfg.temperature = payload.temperature
    if payload.max_tokens is not None:
        cfg.max_tokens = payload.max_tokens
    if payload.timeout is not None:
        cfg.timeout = payload.timeout
    db.commit()
    db.refresh(cfg)
    return AIModelConfigOut(
        provider=cfg.provider, model_name=cfg.model_name, base_url=cfg.base_url,
        has_api_key=bool(cfg.api_key_hash), temperature=cfg.temperature,
        max_tokens=cfg.max_tokens, timeout=cfg.timeout, updated_at=cfg.updated_at,
    )


@router.post("/ai-config/test-connection")
async def test_ai_connection(db: Session = Depends(get_db), _: User = Depends(require_admin)) -> dict:
    from app.services.ai_service import ai_service, AIServiceError
    try:
        reply = await ai_service.chat_reply([{"role": "user", "content": "ping"}])
        return {"status": "ok", "message": f"Connection successful. Sample reply: {reply[:80]}"}
    except AIServiceError as e:
        return {"status": "error", "message": str(e)}
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ── Vision Model Config ───────────────────────────────────────────────────────

def _get_or_create_vision_config(db: Session) -> VisionModelConfig:
    cfg = db.query(VisionModelConfig).first()
    if not cfg:
        cfg = VisionModelConfig()
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg


@router.get("/vision-config", response_model=VisionModelConfigOut)
def get_vision_config(db: Session = Depends(get_db), _: User = Depends(require_admin)) -> VisionModelConfigOut:
    cfg = _get_or_create_vision_config(db)
    return VisionModelConfigOut(
        provider=cfg.provider, model_name=cfg.model_name, base_url=cfg.base_url,
        has_api_key=bool(cfg.api_key_hash), timeout=cfg.timeout,
        enabled=cfg.enabled, updated_at=cfg.updated_at,
    )


@router.put("/vision-config", response_model=VisionModelConfigOut)
def update_vision_config(
    payload: VisionModelConfigUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> VisionModelConfigOut:
    cfg = _get_or_create_vision_config(db)
    if payload.provider is not None:
        cfg.provider = payload.provider
    if payload.model_name is not None:
        cfg.model_name = payload.model_name
    if payload.base_url is not None:
        cfg.base_url = payload.base_url
    if payload.api_key is not None and payload.api_key.strip():
        cfg.api_key_hash = payload.api_key
    if payload.timeout is not None:
        cfg.timeout = payload.timeout
    if payload.enabled is not None:
        cfg.enabled = payload.enabled
    db.commit()
    db.refresh(cfg)
    return VisionModelConfigOut(
        provider=cfg.provider, model_name=cfg.model_name, base_url=cfg.base_url,
        has_api_key=bool(cfg.api_key_hash), timeout=cfg.timeout,
        enabled=cfg.enabled, updated_at=cfg.updated_at,
    )


@router.post("/vision-config/test-connection")
async def test_vision_connection(db: Session = Depends(get_db), _: User = Depends(require_admin)) -> dict:
    cfg = _get_or_create_vision_config(db)
    if not cfg.base_url:
        return {"status": "error", "message": "Vision model base URL not configured"}
    return {"status": "ok", "message": "Vision model configuration saved"}


# ── RAG Config ────────────────────────────────────────────────────────────────

def _get_or_create_rag_config(db: Session) -> RAGConfig:
    cfg = db.query(RAGConfig).first()
    if not cfg:
        cfg = RAGConfig()
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg


@router.get("/rag-config", response_model=RAGConfigOut)
def get_rag_config(db: Session = Depends(get_db), _: User = Depends(require_admin)) -> RAGConfigOut:
    cfg = _get_or_create_rag_config(db)
    return RAGConfigOut.model_validate(cfg)


@router.put("/rag-config", response_model=RAGConfigOut)
def update_rag_config(
    payload: RAGConfigUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> RAGConfigOut:
    cfg = _get_or_create_rag_config(db)
    for field, val in payload.model_dump(exclude_none=True).items():
        setattr(cfg, field, val)
    db.commit()
    db.refresh(cfg)
    return RAGConfigOut.model_validate(cfg)


# ── Prompt Templates ──────────────────────────────────────────────────────────

@router.get("/prompts", response_model=list[PromptTemplateOut])
def list_prompts(db: Session = Depends(get_db), _: User = Depends(require_admin)) -> list[PromptTemplateOut]:
    return db.query(PromptTemplate).order_by(PromptTemplate.category, PromptTemplate.name).all()


@router.post("/prompts", response_model=PromptTemplateOut, status_code=status.HTTP_201_CREATED)
def create_prompt(
    payload: PromptTemplateCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> PromptTemplateOut:
    if payload.is_default:
        db.query(PromptTemplate).filter(
            PromptTemplate.category == payload.category
        ).update({"is_default": False})
    p = PromptTemplate(**payload.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return PromptTemplateOut.model_validate(p)


@router.patch("/prompts/{prompt_id}", response_model=PromptTemplateOut)
def update_prompt(
    prompt_id: int,
    payload: PromptTemplateUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> PromptTemplateOut:
    p = db.get(PromptTemplate, prompt_id)
    if not p:
        raise HTTPException(status_code=404, detail="Prompt not found")
    if payload.is_default and payload.is_default is True:
        db.query(PromptTemplate).filter(
            PromptTemplate.category == p.category, PromptTemplate.id != prompt_id
        ).update({"is_default": False})
    for field, val in payload.model_dump(exclude_none=True).items():
        setattr(p, field, val)
    db.commit()
    db.refresh(p)
    return PromptTemplateOut.model_validate(p)


@router.delete("/prompts/{prompt_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_prompt(prompt_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)) -> None:
    p = db.get(PromptTemplate, prompt_id)
    if not p:
        raise HTTPException(status_code=404, detail="Prompt not found")
    db.delete(p)
    db.commit()


# ── Usage Analytics ───────────────────────────────────────────────────────────

@router.get("/analytics")
def get_analytics(db: Session = Depends(get_db), _: User = Depends(require_admin)) -> dict:
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    total_messages = db.query(func.count(Message.id)).scalar() or 0
    recent_messages = db.query(func.count(Message.id)).filter(Message.created_at >= seven_days_ago).scalar() or 0
    total_attachments = db.query(func.count(ChatAttachment.id)).scalar() or 0
    image_count = db.query(func.count(ChatAttachment.id)).filter(ChatAttachment.file_category == "image").scalar() or 0
    doc_count = db.query(func.count(ChatAttachment.id)).filter(ChatAttachment.file_category == "document").scalar() or 0
    error_count = db.query(func.count(SystemLog.id)).filter(SystemLog.level == "error").scalar() or 0
    return {
        "total_ai_requests": total_messages // 2,  # approx: pairs of user+assistant
        "recent_ai_requests_7d": recent_messages // 2,
        "active_users_7d": db.query(func.count(func.distinct(Conversation.user_id))).filter(
            Conversation.updated_at >= seven_days_ago
        ).scalar() or 0,
        "total_document_uploads": doc_count,
        "total_image_analyses": image_count,
        "total_failed_requests": error_count,
        "total_conversations": db.query(func.count(Conversation.id)).scalar() or 0,
        "avg_messages_per_conversation": round(total_messages / max(db.query(func.count(Conversation.id)).scalar() or 1, 1), 1),
    }


# ── System Logs ───────────────────────────────────────────────────────────────

@router.get("/logs", response_model=list[SystemLogOut])
def get_system_logs(
    limit: int = 100,
    level: str | None = None,
    category: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[SystemLogOut]:
    q = db.query(SystemLog).order_by(SystemLog.created_at.desc())
    if level:
        q = q.filter(SystemLog.level == level)
    if category:
        q = q.filter(SystemLog.category == category)
    return q.limit(limit).all()


# ── Conversation Audit ────────────────────────────────────────────────────────

@router.get("/conversations", response_model=list[ConversationAuditOut])
def audit_conversations(db: Session = Depends(get_db), _: User = Depends(require_admin)) -> list[ConversationAuditOut]:
    rows = (
        db.query(Conversation, func.count(Message.id), User)
        .outerjoin(Message, Message.conversation_id == Conversation.id)
        .join(User, User.id == Conversation.user_id)
        .group_by(Conversation.id, User.id)
        .order_by(Conversation.updated_at.desc())
        .limit(200)
        .all()
    )
    return [
        ConversationAuditOut(
            id=c.id, user_id=c.user_id, user_email=u.email, user_name=u.full_name,
            title=c.title, message_count=cnt, created_at=c.created_at, updated_at=c.updated_at,
        )
        for c, cnt, u in rows
    ]


# ── Storage ───────────────────────────────────────────────────────────────────

@router.get("/storage", response_model=StorageStats)
def storage_stats(db: Session = Depends(get_db), _: User = Depends(require_admin)) -> StorageStats:
    total_docs = db.query(func.count(Document.id)).scalar() or 0
    total_doc_size = db.query(func.sum(Document.file_size)).scalar() or 0
    total_att = db.query(func.count(ChatAttachment.id)).scalar() or 0
    total_att_size = db.query(func.sum(ChatAttachment.file_size)).scalar() or 0
    failed_docs = db.query(func.count(Document.id)).filter(
        Document.processing_status == ProcessingStatus.failed
    ).scalar() or 0
    return StorageStats(
        total_documents=total_docs,
        total_document_size_bytes=total_doc_size,
        total_attachments=total_att,
        total_attachment_size_bytes=total_att_size,
        failed_documents=failed_docs,
    )


@router.post("/storage/cleanup-temp", status_code=status.HTTP_204_NO_CONTENT)
def cleanup_temp_files(db: Session = Depends(get_db), _: User = Depends(require_admin)) -> None:
    cutoff = datetime.utcnow() - timedelta(hours=24)
    db.query(ChatAttachment).filter(ChatAttachment.created_at < cutoff).delete()
    db.commit()


# ── General Settings ──────────────────────────────────────────────────────────

_DEFAULT_SETTINGS: dict[str, str] = {
    "app_name": "KIRA AI Assistant",
    "max_file_size_mb": "20",
    "max_attachments_per_message": "5",
    "allowed_file_types": "pdf,docx,txt,csv,md,png,jpg,jpeg,webp",
    "temp_file_retention_hours": "24",
    "enable_file_upload": "true",
    "enable_image_upload": "true",
    "enable_general_knowledge": "true",
    "maintenance_mode": "false",
}


@router.get("/settings", response_model=GeneralSettingsOut)
def get_settings(db: Session = Depends(get_db), _: User = Depends(require_admin)) -> GeneralSettingsOut:
    def _get(key: str) -> str:
        return _get_setting(db, key, _DEFAULT_SETTINGS.get(key, ""))

    return GeneralSettingsOut(
        app_name=_get("app_name"),
        max_file_size_mb=int(_get("max_file_size_mb")),
        max_attachments_per_message=int(_get("max_attachments_per_message")),
        allowed_file_types=_get("allowed_file_types"),
        temp_file_retention_hours=int(_get("temp_file_retention_hours")),
        enable_file_upload=_get("enable_file_upload") == "true",
        enable_image_upload=_get("enable_image_upload") == "true",
        enable_general_knowledge=_get("enable_general_knowledge") == "true",
        maintenance_mode=_get("maintenance_mode") == "true",
    )


@router.put("/settings", response_model=GeneralSettingsOut)
def update_settings(
    payload: GeneralSettingsUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> GeneralSettingsOut:
    updates: dict[str, Any] = {}
    if payload.app_name is not None:
        updates["app_name"] = payload.app_name
    if payload.max_file_size_mb is not None:
        updates["max_file_size_mb"] = str(payload.max_file_size_mb)
    if payload.max_attachments_per_message is not None:
        updates["max_attachments_per_message"] = str(payload.max_attachments_per_message)
    if payload.allowed_file_types is not None:
        updates["allowed_file_types"] = payload.allowed_file_types
    if payload.temp_file_retention_hours is not None:
        updates["temp_file_retention_hours"] = str(payload.temp_file_retention_hours)
    if payload.enable_file_upload is not None:
        updates["enable_file_upload"] = "true" if payload.enable_file_upload else "false"
    if payload.enable_image_upload is not None:
        updates["enable_image_upload"] = "true" if payload.enable_image_upload else "false"
    if payload.enable_general_knowledge is not None:
        updates["enable_general_knowledge"] = "true" if payload.enable_general_knowledge else "false"
    if payload.maintenance_mode is not None:
        updates["maintenance_mode"] = "true" if payload.maintenance_mode else "false"

    for key, value in updates.items():
        _set_setting(db, key, value)
    db.commit()
    return get_settings(db, _)

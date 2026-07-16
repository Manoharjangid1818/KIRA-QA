from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import admin, artifacts, attachments, auth, bug_reports, conversations, dashboard, knowledge_base, requirement_analyzer, test_cases, test_scenarios
from app.database.db import Base, engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _seed_users()
    _seed_default_prompts()
    yield


def _seed_users() -> None:
    """Ensure seed accounts exist with correct roles."""
    from app.database.db import SessionLocal
    from app.models.models import User
    from app.core.security import hash_password

    db = SessionLocal()
    try:
        # Seed admin
        admin_user = db.query(User).filter(User.email == "admin@gmail.com").first()
        if admin_user is None:
            db.add(User(
                email="admin@gmail.com",
                password_hash=hash_password("Admin123"),
                full_name="Admin",
                role="super_admin",
                status="active",
            ))
        else:
            # Ensure existing admin has super_admin role
            if admin_user.role not in ("super_admin", "admin"):
                admin_user.role = "super_admin"

        # Seed employee user
        user_user = db.query(User).filter(User.email == "user@gmail.com").first()
        if user_user is None:
            db.add(User(
                email="user@gmail.com",
                password_hash=hash_password("User123"),
                full_name="User",
                role="employee",
                status="active",
            ))

        db.commit()
    finally:
        db.close()


def _seed_default_prompts() -> None:
    """Seed default prompt templates if none exist."""
    from app.database.db import SessionLocal
    from app.models.models import PromptTemplate

    db = SessionLocal()
    try:
        if db.query(PromptTemplate).count() == 0:
            defaults = [
                ("Default Assistant", "default", "You are KIRA, a helpful AI assistant for KiwiQA. You help employees with questions, document analysis, and general tasks. Be concise, accurate, and professional.", True, True),
                ("QA Expert", "qa", "You are KIRA, a senior QA engineer AI assistant. You help with test case design, bug analysis, requirement review, and quality assurance processes. Provide structured, actionable QA guidance.", True, False),
                ("Development", "development", "You are KIRA, a software development AI assistant. You help with code review, architecture decisions, debugging, and technical documentation.", True, False),
                ("HR", "hr", "You are KIRA, an HR AI assistant. You help with HR policies, employee queries, and general people-management topics. Always be empathetic and professional.", True, False),
                ("Management", "management", "You are KIRA, a management AI assistant. You help managers with reporting, decision-making frameworks, and team communication.", True, False),
                ("Document Summarization", "document_summary", "You are a document summarization assistant. Analyze the provided document and give clear, structured summaries with key points, action items, and important dates.", True, False),
                ("Image Analysis", "image_analysis", "You are an image and screenshot analysis assistant. Describe what you see, identify UI issues, extract text, and provide actionable insights about the visual content.", True, False),
            ]
            for name, category, content, is_active, is_default in defaults:
                db.add(PromptTemplate(
                    name=name, category=category, content=content,
                    is_active=is_active, is_default=is_default,
                ))
            db.commit()
    finally:
        db.close()


app = FastAPI(title="KIRA API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/healthz")
def healthz() -> dict:
    return {"status": "ok"}


app.include_router(auth.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(conversations.router, prefix="/api")
app.include_router(requirement_analyzer.router, prefix="/api")
app.include_router(test_scenarios.router, prefix="/api")
app.include_router(test_cases.router, prefix="/api")
app.include_router(bug_reports.router, prefix="/api")
app.include_router(artifacts.router, prefix="/api")
app.include_router(knowledge_base.router, prefix="/api")
app.include_router(attachments.router, prefix="/api")

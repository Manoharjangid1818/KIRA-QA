from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import artifacts, auth, bug_reports, conversations, dashboard, knowledge_base, requirement_analyzer, test_cases, test_scenarios
from app.database.db import Base, engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    # First-build MVP: create tables directly from the SQLAlchemy models if
    # they don't exist yet. There is no separate migration tool in this
    # service -- future schema changes should be applied deliberately
    # (e.g. Alembic) rather than relying on this at scale.
    Base.metadata.create_all(bind=engine)
    _seed_admin()
    yield


def _seed_admin() -> None:
    """Ensure the Admin@gmail.com seed account exists."""
    from app.database.db import SessionLocal
    from app.models.models import User
    from app.core.security import hash_password

    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == "admin@gmail.com").first()
        if existing is None:
            admin = User(
                email="admin@gmail.com",
                password_hash=hash_password("Admin123"),
                full_name="Admin",
            )
            db.add(admin)
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
app.include_router(dashboard.router, prefix="/api")
app.include_router(conversations.router, prefix="/api")
app.include_router(requirement_analyzer.router, prefix="/api")
app.include_router(test_scenarios.router, prefix="/api")
app.include_router(test_cases.router, prefix="/api")
app.include_router(bug_reports.router, prefix="/api")
app.include_router(artifacts.router, prefix="/api")
app.include_router(knowledge_base.router, prefix="/api")

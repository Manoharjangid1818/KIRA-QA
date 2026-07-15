"""Centralized configuration read from environment variables.

Nothing here is hard-coded: the AI provider connection details are fully
configurable so this service can be pointed at a private Qwen3 deployment
(or any other OpenAI-compatible endpoint) later without code changes.
"""

import os


class Settings:
    # Database
    database_url: str = os.environ.get("DATABASE_URL", "")

    # Auth
    # SESSION_SECRET is a Replit-managed secret already provisioned for this
    # project; we reuse it as the JWT signing key so no extra secret is needed.
    jwt_secret: str = os.environ.get("SESSION_SECRET", "")
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = int(
        os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "1440")
    )

    # AI provider (OpenAI-compatible). Left unset -> mock provider is used.
    llm_base_url: str | None = os.environ.get("LLM_BASE_URL") or None
    llm_api_key: str | None = os.environ.get("LLM_API_KEY") or None
    llm_model: str | None = os.environ.get("LLM_MODEL") or None

    # Embedding provider (OpenAI-compatible /embeddings endpoint).
    # If unset, falls back to a simple local hash-based embedding.
    embedding_provider: str | None = os.environ.get("EMBEDDING_PROVIDER") or None
    embedding_model: str | None = os.environ.get("EMBEDDING_MODEL") or None

    # RAG chunking / retrieval settings
    rag_chunk_size: int = int(os.environ.get("RAG_CHUNK_SIZE", "500"))
    rag_chunk_overlap: int = int(os.environ.get("RAG_CHUNK_OVERLAP", "50"))
    rag_top_k: int = int(os.environ.get("RAG_TOP_K", "5"))

    # Vision / multimodal provider — separate from the text LLM.
    # Falls back to a graceful text-only description when unset.
    vision_provider: str | None = os.environ.get("VISION_PROVIDER") or None
    vision_model: str | None = os.environ.get("VISION_MODEL") or None
    vision_base_url: str | None = os.environ.get("VISION_BASE_URL") or None
    vision_api_key: str | None = os.environ.get("VISION_API_KEY") or None

    # Chat attachment limits
    attachment_max_file_size_mb: int = int(os.environ.get("ATTACHMENT_MAX_FILE_SIZE_MB", "20"))
    attachment_max_per_message: int = int(os.environ.get("ATTACHMENT_MAX_PER_MESSAGE", "5"))
    attachments_enabled: bool = os.environ.get("ATTACHMENTS_ENABLED", "true").lower() == "true"
    image_analysis_enabled: bool = os.environ.get("IMAGE_ANALYSIS_ENABLED", "true").lower() == "true"

    @property
    def ai_configured(self) -> bool:
        return bool(self.llm_base_url and self.llm_model)

    @property
    def embedding_configured(self) -> bool:
        return bool(self.embedding_provider and self.embedding_model and self.llm_base_url)

    @property
    def vision_configured(self) -> bool:
        return bool(self.vision_provider and self.vision_model and self.vision_base_url)


settings = Settings()

if not settings.database_url:
    raise RuntimeError("DATABASE_URL must be set. Did you forget to provision a database?")

if not settings.jwt_secret:
    raise RuntimeError(
        "SESSION_SECRET must be set to sign JWTs. It should already exist as a project secret."
    )

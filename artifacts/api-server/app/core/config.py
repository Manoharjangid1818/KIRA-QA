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

    @property
    def ai_configured(self) -> bool:
        return bool(self.llm_base_url and self.llm_model)


settings = Settings()

if not settings.database_url:
    raise RuntimeError("DATABASE_URL must be set. Did you forget to provision a database?")

if not settings.jwt_secret:
    raise RuntimeError(
        "SESSION_SECRET must be set to sign JWTs. It should already exist as a project secret."
    )

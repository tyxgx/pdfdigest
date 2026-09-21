from __future__ import annotations

from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Global app settings.
    Loaded from environment variables or backend/.env.
    """

    groq_api_key: Optional[str] = None
    groq_model: str = "openai/gpt-oss-20b"

    # Comma-separated list of extra allowed CORS origins (e.g. a preview deploy).
    extra_cors_origins: str = ""
    max_upload_mb: int = 10
    # Oldest documents are evicted once the in-memory store holds this many.
    max_documents: int = 50
    max_pages: int = 300
    # Per client IP per minute; the demo spends a shared Groq key.
    upload_rate_per_min: int = 10
    ask_rate_per_min: int = 30

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()

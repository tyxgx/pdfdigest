from __future__ import annotations

from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Global app settings.
    Loaded from environment variables or backend/.env.
    """

    # Groq
    groq_api_key: Optional[str] = None
    # ✅ OLD: "llama3-8b-8192" (decommissioned)
    # ✅ NEW: a supported Llama 3.1 model
    groq_model: str = "llama-3.1-8b-instant"

    # Vector DB (Chroma)
    chroma_persist_directory: str = "chroma_db"
    chroma_collection_name: str = "pdf_documents"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
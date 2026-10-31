"""
Application settings loaded from environment variables via pydantic-settings.
All fields have defaults so the app can start without a .env file (for testing).
"""
from __future__ import annotations

from typing import List

from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Database
    DATABASE_URL: str = "sqlite:///./subsentry.db"

    # JWT
    SECRET_KEY: str = "insecure-dev-secret-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    ALGORITHM: str = "HS256"

    # CORS
    FRONTEND_URL: str = "http://localhost:5173"
    # Stored as a comma-separated string in the env file; parsed to a list below.
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    # Email
    EMAIL_MODE: str = "console"  # console | smtp
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "noreply@subsentry.com"

    @property
    def cors_origins_list(self) -> List[str]:
        """Return CORS_ORIGINS as a Python list, trimming whitespace."""
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


# Singleton – import this everywhere instead of instantiating Settings() again.
settings = Settings()

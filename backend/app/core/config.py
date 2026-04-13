from __future__ import annotations
import secrets
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "Gridwolf"
    DEBUG: bool = False
    DATABASE_URL: str = "sqlite+aiosqlite:///./gridwolf.db"
    REDIS_URL: str = "redis://localhost:6379/0"
    SECRET_KEY: str = ""
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 720
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173", "http://localhost:5174"]
    NVD_API_KEY: str = ""
    UPLOAD_DIR: str = "./uploads"
    REPORTS_DIR: str = "./reports"

    def model_post_init(self, __context) -> None:
        # Auto-generate SECRET_KEY if not provided via env
        if not self.SECRET_KEY:
            self.SECRET_KEY = secrets.token_urlsafe(64)

    model_config = {"env_prefix": "GRIDWOLF_", "env_file": ".env"}


settings = Settings()

from __future__ import annotations
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "Gridwolf"
    DEBUG: bool = True
    DATABASE_URL: str = "sqlite+aiosqlite:///./gridwolf.db"
    REDIS_URL: str = "redis://localhost:6379/0"
    SECRET_KEY: str = "gridwolf-dev-secret-key-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:5174", "http://localhost:1420"]
    NVD_API_KEY: str = ""
    UPLOAD_DIR: str = "./uploads"
    REPORTS_DIR: str = "./reports"

    model_config = {"env_prefix": "GRIDWOLF_", "env_file": ".env"}


settings = Settings()

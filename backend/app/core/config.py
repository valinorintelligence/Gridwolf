from __future__ import annotations
import logging
import secrets
import sys
from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    APP_NAME: str = "Gridwolf"
    APP_VERSION: str = "1.1.0"
    DEBUG: bool = False
    DATABASE_URL: str = "sqlite+aiosqlite:///./gridwolf.db"
    REDIS_URL: str = "redis://localhost:6379/0"
    SECRET_KEY: str = ""
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 720
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173", "http://localhost:5174"]
    NVD_API_KEY: str = ""
    UPLOAD_DIR: str = "./uploads"
    REPORTS_DIR: str = "./reports"

    # First-run admin account (created automatically if no users exist)
    ADMIN_USERNAME: str = "admin"
    ADMIN_EMAIL: str = "admin@gridwolf.local"
    # If left blank a random password is generated and printed to stdout once
    ADMIN_PASSWORD: str = ""

    def model_post_init(self, __context) -> None:
        if not self.SECRET_KEY:
            if not self.DEBUG:
                # Production: refuse to start with an auto-generated key.
                # Sessions would be invalidated every restart and the key
                # provides no real security if never explicitly set.
                print(
                    "\n[GRIDWOLF] FATAL: GRIDWOLF_SECRET_KEY is not set.\n"
                    "  Generate one with:  python -c \"import secrets; print(secrets.token_urlsafe(64))\"\n"
                    "  Then set it in your .env file or environment before starting.\n",
                    file=sys.stderr,
                )
                sys.exit(1)
            # Development only: auto-generate and warn loudly.
            self.SECRET_KEY = secrets.token_urlsafe(64)
            logger.warning(
                "GRIDWOLF_SECRET_KEY not set — auto-generated for this process only. "
                "All sessions will be invalidated on restart. "
                "Set GRIDWOLF_SECRET_KEY explicitly for any persistent deployment."
            )

    model_config = {"env_prefix": "GRIDWOLF_", "env_file": ".env"}


settings = Settings()

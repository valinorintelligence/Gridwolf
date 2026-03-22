from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "Gridwolf"
    DEBUG: bool = True
    DATABASE_URL: str = "postgresql+asyncpg://gridwolf:gridwolf@localhost:5432/gridwolf"
    REDIS_URL: str = "redis://localhost:6379/0"
    SECRET_KEY: str = "gridwolf-dev-secret-key-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:1420"]

    model_config = {"env_prefix": "GRIDWOLF_", "env_file": ".env"}


settings = Settings()

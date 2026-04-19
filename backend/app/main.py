import logging
import time
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Query, Request, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse

from app.api.v1.router import api_v1_router
from app.core.config import settings
from app.core.security import verify_token

logger = logging.getLogger("gridwolf")

# Track process start time for uptime reporting in /health
_START_TIME = time.time()


# ── WebSocket connection manager ─────────────────────────────────────────────

class ConnectionManager:
    """Manages active WebSocket connections for real-time updates."""

    def __init__(self) -> None:
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict) -> None:
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                pass


ws_manager = ConnectionManager()


# ── Application lifespan ─────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("Gridwolf %s starting up", settings.APP_VERSION)
    from app.core.database import init_db
    await init_db()
    logger.info("Database initialised")
    yield
    logger.info("Gridwolf shutting down")
    for conn in list(ws_manager.active_connections):
        try:
            await conn.close()
        except Exception:
            pass
    ws_manager.active_connections.clear()


# ── FastAPI app ───────────────────────────────────────────────────────────────

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "Gridwolf — Passive ICS/SCADA Network Discovery, Vulnerability Intelligence "
        "& Security Assessment Platform"
    ),
    default_response_class=ORJSONResponse,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_v1_router, prefix="/api/v1")


# ── Health check ─────────────────────────────────────────────────────────────

@app.get("/health", tags=["health"])
async def health_check():
    """
    Liveness + readiness probe.

    Returns HTTP 200 when the application and database are reachable.
    Returns HTTP 503 when the database is unavailable.
    Used by Docker health checks, AWS ELB target group checks, and Azure
    load-balancer probes.
    """
    from app.core.database import engine
    from sqlalchemy import text

    db_ok = False
    db_error: str | None = None
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        db_ok = True
    except Exception as exc:
        db_error = str(exc)
        logger.warning("Health check: DB unavailable — %s", exc)

    uptime_seconds = int(time.time() - _START_TIME)
    payload = {
        "status": "ok" if db_ok else "degraded",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "uptime_seconds": uptime_seconds,
        "database": "ok" if db_ok else "unavailable",
    }
    if db_error and settings.DEBUG:
        payload["db_error"] = db_error

    http_status = status.HTTP_200_OK if db_ok else status.HTTP_503_SERVICE_UNAVAILABLE
    return ORJSONResponse(content=payload, status_code=http_status)


@app.get("/version", tags=["health"])
async def version():
    """Return application version. Used by the OVA first-boot script and marketplace AMIs."""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }


# ── WebSocket ─────────────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(default="")):
    if token:
        payload = verify_token(token)
        if payload is None:
            await websocket.close(code=4001, reason="Invalid token")
            return
    else:
        await websocket.close(code=4001, reason="Authentication required")
        return

    await ws_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            await websocket.send_json({"type": "ack", "data": data})
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)


# ── Exception handlers ────────────────────────────────────────────────────────

@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    return ORJSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={"detail": "Resource not found"},
    )


@app.exception_handler(500)
async def internal_error_handler(request: Request, exc):
    logger.exception("Internal server error")
    return ORJSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )

import asyncio
import logging
import time
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse

from app.api.v1.router import api_v1_router
from app.core.config import settings

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
    from app.core.database import async_session_factory
    from app.services.sessions import purge_expired

    async with async_session_factory() as db:
        await purge_expired(db)
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
    # The interactive API documentation would list every route to anyone who can reach the port.
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url=None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "X-CSRF-Token", "X-Gridwolf-Site"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "same-origin")
    if request.url.path.startswith("/api/"):
        response.headers.setdefault("Cache-Control", "no-store")
    return response

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
async def websocket_endpoint(websocket: WebSocket):
    """Authenticated with the same session cookie as the API (never a token in the URL), from a trusted
    Origin, and re-validated every 30 s so logout, expiry and revocation end the connection. It carries no
    site data today; anything broadcast later must be filtered by the principal's sites."""
    from app.core.authz import principal_from_token, principal_from_websocket
    from app.core.database import async_session_factory

    async with async_session_factory() as db:
        try:
            await principal_from_websocket(websocket, db)
        except HTTPException as exc:
            await websocket.close(code=4001 if exc.status_code == 401 else 4003)
            return
    cookie = websocket.cookies.get(settings.SESSION_COOKIE_NAME, "")

    await ws_manager.connect(websocket)
    try:
        while True:
            try:
                message = await asyncio.wait_for(websocket.receive_json(), timeout=30)
            except asyncio.TimeoutError:
                message = None
            async with async_session_factory() as db:
                try:
                    principal = await principal_from_token(db, cookie, touch=False)
                    if not principal.can("view"):
                        raise HTTPException(status_code=403)
                except HTTPException:
                    await websocket.close(code=4001)
                    break
            if isinstance(message, dict) and message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.debug("websocket closed", exc_info=False)
        try:
            await websocket.close(code=1003)           # malformed frame: end the connection, do not leave it open
        except Exception:
            pass
    finally:
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

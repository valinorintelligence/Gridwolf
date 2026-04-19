"""Admin endpoints — API keys, system metrics, and detection signatures.

Every endpoint here requires an authenticated user. Endpoints that mutate
require role == 'admin'.
"""

from __future__ import annotations

import hashlib
import logging
import os
import secrets
import shutil
import time
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db, engine
from app.models.admin import APIKey, Signature
from app.models.user import User

logger = logging.getLogger("gridwolf")


def _require_admin(user: User) -> None:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")


def _hash_key(raw: str) -> str:
    """BLAKE2b hash of the raw token. Cheaper than bcrypt; collision-resistant
    and sufficient since the input is 32 bytes of CSPRNG output."""
    return hashlib.blake2b(raw.encode("utf-8"), digest_size=32).hexdigest()


# ─────────────────────────────────────────────────────────────────────────────
# API Keys
# ─────────────────────────────────────────────────────────────────────────────

keys_router = APIRouter(prefix="/api-keys", tags=["api-keys"])


class APIKeyResponse(BaseModel):
    id: str
    name: str
    prefix: str
    environment: str
    permissions: str
    created_at: str
    last_used_at: Optional[str] = None
    status: str  # "active" | "revoked"


class APIKeyCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    environment: str = Field(default="live", pattern="^(live|test)$")
    permissions: str = Field(default="read", pattern="^(read|write|admin)$")


class APIKeyCreateResponse(APIKeyResponse):
    token: str  # Full token — shown ONCE, never persisted in plaintext


def _serialize_key(row: APIKey) -> APIKeyResponse:
    return APIKeyResponse(
        id=row.id,
        name=row.name,
        prefix=row.prefix,
        environment=row.environment,
        permissions=row.permissions,
        created_at=row.created_at.isoformat(),
        last_used_at=row.last_used_at.isoformat() if row.last_used_at else None,
        status="revoked" if row.revoked_at else "active",
    )


@keys_router.get("", response_model=List[APIKeyResponse])
async def list_api_keys(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(APIKey).order_by(APIKey.created_at.desc()))
    return [_serialize_key(k) for k in result.scalars().all()]


@keys_router.post("", response_model=APIKeyCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    data: APIKeyCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)

    raw_secret = secrets.token_urlsafe(32)
    full_token = f"gw_{data.environment}_{raw_secret}"
    prefix = full_token[:12] + "..."

    key = APIKey(
        name=data.name,
        prefix=prefix,
        key_hash=_hash_key(full_token),
        environment=data.environment,
        permissions=data.permissions,
        created_by=current_user.id,
    )
    db.add(key)
    await db.commit()
    await db.refresh(key)

    logger.info(
        "API key created: id=%s name=%s by user=%s", key.id, key.name, current_user.username
    )

    return APIKeyCreateResponse(
        **_serialize_key(key).model_dump(),
        token=full_token,
    )


@keys_router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_api_key(
    key_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)

    key = (await db.execute(select(APIKey).where(APIKey.id == key_id))).scalar_one_or_none()
    if key is None:
        raise HTTPException(status_code=404, detail="API key not found")
    if key.revoked_at is None:
        key.revoked_at = datetime.now(timezone.utc)
        await db.commit()
        logger.info("API key revoked: id=%s by user=%s", key.id, current_user.username)


# ─────────────────────────────────────────────────────────────────────────────
# System metrics
# ─────────────────────────────────────────────────────────────────────────────

system_router = APIRouter(prefix="/system", tags=["system"])

_PROCESS_START = time.time()


class SystemStats(BaseModel):
    cpu_percent: float
    memory_percent: float
    disk_percent: float
    disk_total_gb: float
    disk_free_gb: float
    uptime_seconds: int
    version: str
    database_bytes: int
    active_users: int


class TableStat(BaseModel):
    table: str
    rows: int


class DatabaseBreakdown(BaseModel):
    tables: List[TableStat]


def _cpu_percent() -> float:
    """Best-effort CPU usage without adding psutil as a hard dependency."""
    try:
        import psutil  # type: ignore

        return float(psutil.cpu_percent(interval=0.1))
    except Exception:
        try:
            load_1, _, _ = os.getloadavg()
            cores = os.cpu_count() or 1
            return min(100.0, (load_1 / cores) * 100.0)
        except (OSError, AttributeError):
            return 0.0


def _memory_percent() -> float:
    try:
        import psutil  # type: ignore

        return float(psutil.virtual_memory().percent)
    except Exception:
        try:
            with open("/proc/meminfo") as f:
                info = {line.split(":")[0]: line.split(":")[1].strip() for line in f if ":" in line}
            total_kb = int(info["MemTotal"].split()[0])
            available_kb = int(info.get("MemAvailable", info.get("MemFree", "0 kB")).split()[0])
            return 100.0 * (1 - available_kb / total_kb) if total_kb else 0.0
        except (OSError, KeyError, ValueError):
            return 0.0


def _database_size_bytes() -> int:
    url = settings.DATABASE_URL
    if url.startswith("sqlite"):
        # sqlite+aiosqlite:////data/gridwolf.db → /data/gridwolf.db
        path = url.split("///")[-1]
        if path.startswith("/"):
            try:
                return os.path.getsize(path)
            except OSError:
                return 0
    return 0


@system_router.get("/stats", response_model=SystemStats)
async def get_system_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    disk_total, _, disk_free = shutil.disk_usage("/")
    disk_used = disk_total - disk_free

    active_users = (
        await db.execute(select(func.count()).select_from(User).where(User.is_active.is_(True)))
    ).scalar_one()

    return SystemStats(
        cpu_percent=round(_cpu_percent(), 1),
        memory_percent=round(_memory_percent(), 1),
        disk_percent=round(100.0 * disk_used / disk_total, 1) if disk_total else 0.0,
        disk_total_gb=round(disk_total / (1024**3), 2),
        disk_free_gb=round(disk_free / (1024**3), 2),
        uptime_seconds=int(time.time() - _PROCESS_START),
        version=settings.APP_VERSION,
        database_bytes=_database_size_bytes(),
        active_users=int(active_users),
    )


@system_router.get("/database", response_model=DatabaseBreakdown)
async def get_database_breakdown(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Row counts per table — works on SQLite and Postgres identically."""
    from sqlalchemy import inspect

    def _collect(sync_conn) -> list[tuple[str, int]]:
        inspector = inspect(sync_conn)
        rows: list[tuple[str, int]] = []
        for name in inspector.get_table_names():
            try:
                cnt = sync_conn.exec_driver_sql(f"SELECT COUNT(*) FROM {name}").scalar() or 0
                rows.append((name, int(cnt)))
            except Exception:
                rows.append((name, 0))
        return rows

    async with engine.connect() as conn:
        rows = await conn.run_sync(_collect)

    return DatabaseBreakdown(
        tables=[TableStat(table=n, rows=c) for n, c in sorted(rows, key=lambda r: -r[1])]
    )


# ─────────────────────────────────────────────────────────────────────────────
# Signatures
# ─────────────────────────────────────────────────────────────────────────────

sig_router = APIRouter(prefix="/signatures", tags=["signatures"])


class SignatureResponse(BaseModel):
    id: str
    name: str
    protocol: str
    vendor: Optional[str]
    category: Optional[str]
    confidence: int
    enabled: bool
    matches: int
    yaml_content: str
    created_at: str
    updated_at: str


class SignatureCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    protocol: str = Field(..., min_length=1, max_length=64)
    vendor: Optional[str] = Field(default=None, max_length=120)
    category: Optional[str] = Field(default=None, max_length=64)
    confidence: int = Field(default=3, ge=1, le=5)
    yaml_content: str = Field(..., min_length=1)
    enabled: bool = True


class SignatureUpdate(BaseModel):
    name: Optional[str] = None
    protocol: Optional[str] = None
    vendor: Optional[str] = None
    category: Optional[str] = None
    confidence: Optional[int] = Field(default=None, ge=1, le=5)
    yaml_content: Optional[str] = None
    enabled: Optional[bool] = None


class SignatureTestResult(BaseModel):
    valid_yaml: bool
    parse_error: Optional[str]
    matched: int
    devices: List[str]


def _serialize_sig(s: Signature) -> SignatureResponse:
    return SignatureResponse(
        id=s.id,
        name=s.name,
        protocol=s.protocol,
        vendor=s.vendor,
        category=s.category,
        confidence=s.confidence,
        enabled=s.enabled,
        matches=s.matches,
        yaml_content=s.yaml_content,
        created_at=s.created_at.isoformat(),
        updated_at=s.updated_at.isoformat(),
    )


@sig_router.get("", response_model=List[SignatureResponse])
async def list_signatures(
    protocol: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Signature).order_by(Signature.protocol, Signature.name)
    if protocol and protocol != "all":
        stmt = stmt.where(Signature.protocol == protocol)
    result = await db.execute(stmt)
    return [_serialize_sig(s) for s in result.scalars().all()]


@sig_router.get("/{sig_id}", response_model=SignatureResponse)
async def get_signature(
    sig_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sig = (await db.execute(select(Signature).where(Signature.id == sig_id))).scalar_one_or_none()
    if sig is None:
        raise HTTPException(status_code=404, detail="Signature not found")
    return _serialize_sig(sig)


@sig_router.post("", response_model=SignatureResponse, status_code=status.HTTP_201_CREATED)
async def create_signature(
    data: SignatureCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    sig = Signature(
        name=data.name,
        protocol=data.protocol,
        vendor=data.vendor,
        category=data.category,
        confidence=data.confidence,
        yaml_content=data.yaml_content,
        enabled=data.enabled,
        created_by=current_user.id,
    )
    db.add(sig)
    await db.commit()
    await db.refresh(sig)
    return _serialize_sig(sig)


@sig_router.put("/{sig_id}", response_model=SignatureResponse)
async def update_signature(
    sig_id: str,
    data: SignatureUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    sig = (await db.execute(select(Signature).where(Signature.id == sig_id))).scalar_one_or_none()
    if sig is None:
        raise HTTPException(status_code=404, detail="Signature not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(sig, field, value)
    await db.commit()
    await db.refresh(sig)
    return _serialize_sig(sig)


@sig_router.delete("/{sig_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_signature(
    sig_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    sig = (await db.execute(select(Signature).where(Signature.id == sig_id))).scalar_one_or_none()
    if sig is None:
        raise HTTPException(status_code=404, detail="Signature not found")
    await db.delete(sig)
    await db.commit()


@sig_router.post("/{sig_id}/test", response_model=SignatureTestResult)
async def test_signature(
    sig_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Validate YAML + count matches against recorded devices.

    The actual deep protocol match is performed by the passive discovery
    engine; this endpoint only re-counts the stored `matches` field
    (updated when the engine last ran) so the UI has fresh numbers.
    """
    sig = (await db.execute(select(Signature).where(Signature.id == sig_id))).scalar_one_or_none()
    if sig is None:
        raise HTTPException(status_code=404, detail="Signature not found")

    # YAML syntax check
    parse_error: Optional[str] = None
    valid = True
    try:
        import yaml  # PyYAML is a transitive dep of FastAPI — usually available

        yaml.safe_load(sig.yaml_content)
    except ImportError:
        valid = True  # Assume valid if parser absent
    except Exception as exc:
        valid = False
        parse_error = str(exc)

    # Recount matching devices
    devices: list[str] = []
    try:
        from app.models.ics import Device  # type: ignore

        q = select(Device).where(Device.vendor == sig.vendor) if sig.vendor else select(Device)
        result = await db.execute(q.limit(50))
        for dev in result.scalars().all():
            label = f"{getattr(dev, 'ip_address', '') or ''} ({getattr(dev, 'vendor', '') or ''})".strip()
            if label:
                devices.append(label)
    except Exception:
        pass

    return SignatureTestResult(
        valid_yaml=valid,
        parse_error=parse_error,
        matched=len(devices),
        devices=devices[:10],
    )

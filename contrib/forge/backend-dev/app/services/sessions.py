"""Backend-managed sessions, cookies and the authentication audit trail."""
from __future__ import annotations

import logging
from datetime import timedelta
from typing import Optional

from fastapi import Response
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.authz import utcnow
from app.core.config import settings
from app.core.security import new_token, token_hash
from app.models.auth import AuthEvent, AuthSession, OidcTransaction

logger = logging.getLogger("gridwolf.auth")
OIDC_COOKIE = "gw_oidc"
OIDC_COOKIE_PATH = "/api/v1/auth/oidc"


async def audit(db: AsyncSession, kind: str, outcome: str, username: Optional[str] = None,
                user_id: Optional[str] = None, detail: str = "") -> None:
    """Record an authentication event. Never put a password, token, code or provider body in `detail`."""
    db.add(AuthEvent(kind=kind, outcome=outcome, username=(username or "")[:255] or None, user_id=user_id,
                     detail=detail[:255]))
    await db.commit()
    logger.info("auth event kind=%s outcome=%s user=%s detail=%s", kind, outcome, username or "-", detail[:120])


async def create_session(db: AsyncSession, user, method: str, role: str, sites, groups, mfa: bool) -> tuple[str, AuthSession]:
    token = new_token()
    now = utcnow()
    life = settings.SESSION_ABSOLUTE_MINUTES
    if method == "oidc":
        life = min(life, max(1, settings.OIDC_CLAIMS_MAX_AGE_MINUTES))     # claims are only as fresh as the sign-in
    absolute = now + timedelta(minutes=life)
    sess = AuthSession(
        id=token_hash(token), user_id=user.id, auth_method=method, role=role, sites=sorted(sites),
        groups=list(groups), mfa=mfa, csrf_token=new_token(), created_at=now, last_seen_at=now,
        idle_expires_at=min(now + timedelta(minutes=settings.SESSION_IDLE_MINUTES), absolute),
        absolute_expires_at=absolute)
    db.add(sess)
    await db.commit()
    return token, sess


async def revoke_session(db: AsyncSession, key: str, reason: str) -> None:
    await db.execute(update(AuthSession).where(AuthSession.id == key, AuthSession.revoked_at.is_(None))
                     .values(revoked_at=utcnow(), revoked_reason=reason))
    await db.commit()


async def revoke_user_sessions(db: AsyncSession, user_id: str, reason: str) -> int:
    res = await db.execute(update(AuthSession).where(AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None))
                           .values(revoked_at=utcnow(), revoked_reason=reason))
    await db.commit()
    return res.rowcount or 0


async def purge_expired(db: AsyncSession) -> None:
    cutoff = utcnow() - timedelta(days=7)
    await db.execute(delete(AuthSession).where(AuthSession.absolute_expires_at < cutoff))
    await db.execute(delete(OidcTransaction).where(OidcTransaction.expires_at < utcnow() - timedelta(hours=1)))
    await db.commit()


async def recent_failures(db: AsyncSession, username: str) -> int:
    since = utcnow() - timedelta(minutes=settings.LOCAL_LOGIN_LOCKOUT_MINUTES)
    q = select(func.count()).select_from(AuthEvent).where(
        AuthEvent.kind == "login_failed", AuthEvent.username == username[:255], AuthEvent.ts >= since)
    return (await db.execute(q)).scalar_one()


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(settings.SESSION_COOKIE_NAME, token, max_age=settings.SESSION_ABSOLUTE_MINUTES * 60,
                        httponly=True, secure=settings.COOKIE_SECURE, samesite="lax", path="/")


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(settings.SESSION_COOKIE_NAME, path="/", secure=settings.COOKIE_SECURE,
                           httponly=True, samesite="lax")

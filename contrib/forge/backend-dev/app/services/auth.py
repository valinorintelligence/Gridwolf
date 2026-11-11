"""Local (password) authentication for the accounts that existed before OIDC."""
from __future__ import annotations

import re
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import verify_password
from app.models.user import User
from app.services.sessions import audit, recent_failures

_LOGGABLE = re.compile(r"^[A-Za-z0-9_.@-]{1,100}$")


async def authenticate_local(db: AsyncSession, username: str, password: str) -> User:
    """Return the active user for a correct password. Failures are uniform (401) so the response does not
    reveal whether the account exists; repeated failures lock the name out for a while (429)."""
    if not settings.LOCAL_LOGIN_ENABLED:
        raise HTTPException(status_code=403, detail="Local sign-in is disabled; use FORGE single sign-on")
    # A password typed into the username box must not reach the audit trail.
    logged: Optional[str] = username if _LOGGABLE.match(username or "") else "(invalid)"
    if await recent_failures(db, logged) >= settings.LOCAL_LOGIN_MAX_FAILURES:
        await audit(db, "login_failed", "denied", logged, detail="locked out")
        raise HTTPException(status_code=429, detail="Too many failed attempts; try again later")
    user = (await db.execute(select(User).where(User.username == username))).scalar_one_or_none()
    ok = verify_password(password, user.hashed_password if user else None)
    if user is None or not ok or not user.is_active:
        await audit(db, "login_failed", "denied", logged, user.id if user else None, "local credentials rejected")
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return user

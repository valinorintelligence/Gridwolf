"""Account registration and OIDC identity binding.

An account is an administrator's decision: nobody can create one by signing in. A registered account can
sign in with authentik in two ways:
  * it was registered with the authentik subject (`oidc_subject`): the link exists from the start, or
  * it was registered without one: the first successful sign-in whose `preferred_username` AND `email`
    both match binds that authentik subject to the account. After that only the subject is used, so a
    later change of username or e-mail at authentik can neither take over nor lock out the account.
"""
from __future__ import annotations

import re
from typing import Iterable, Optional

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.authz import ADMINISTRATOR, ROLES, SITE_ROLES, utcnow, valid_site
from app.core.config import settings
from app.core.security import UNUSABLE_PASSWORD, hash_password
from app.models.auth import IdentityLink
from app.models.user import User

USERNAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.@-]{2,99}$")
EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,190}$")


def _clean_sites(sites: Iterable[str]) -> list[str]:
    out = sorted({s for s in sites})
    for s in out:
        if not valid_site(s):
            raise HTTPException(status_code=422, detail="Invalid site id: %r" % s[:64])
    return out


async def register_user(db: AsyncSession, *, username: str, email: str, role: str, full_name: str = "",
                        sites: Iterable[str] = (), oidc_subject: Optional[str] = None,
                        password: Optional[str] = None) -> User:
    if role not in ROLES:
        raise HTTPException(status_code=422, detail="role must be one of: " + ", ".join(ROLES))
    if not USERNAME_RE.match(username):
        raise HTTPException(status_code=422, detail="Invalid username")
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=422, detail="Invalid e-mail address")
    sites = _clean_sites(sites)
    clash = await db.execute(select(User).where((User.username == username) | (User.email == email)))
    if clash.first():
        raise HTTPException(status_code=409, detail="Username or e-mail already registered")
    user = User(username=username, email=email, full_name=full_name or None, role=role, is_active=True,
                hashed_password=hash_password(password) if password else UNUSABLE_PASSWORD)
    db.add(user)
    await db.flush()
    if oidc_subject:
        if not settings.OIDC_ISSUER:
            raise HTTPException(status_code=422, detail="OIDC issuer is not configured")
        db.add(IdentityLink(user_id=user.id, issuer=settings.OIDC_ISSUER, subject=oidc_subject[:255]))
    await db.commit()
    if sites and role != ADMINISTRATOR:
        # `role` is held at each named (registered) site; it is not a global role.
        await set_user_sites(db, user.id, sites, role, actor="registration")
    return user


async def set_user_sites(db: AsyncSession, user_id: str, sites: Iterable[str], role: str, actor: str = "admin") -> list[str]:
    """Hold `role` at exactly `sites` (registered ids or their source aliases) for the user."""
    from app.services.sites import set_user_site_role
    if role not in SITE_ROLES:
        raise HTTPException(status_code=422, detail="a site role must be one of: " + ", ".join(SITE_ROLES))
    return await set_user_site_role(db, user_id, _clean_sites(sites), role, actor)


class IdentityDenied(Exception):
    def __init__(self, code: str, username: Optional[str] = None):
        super().__init__(code)
        self.code = code
        self.username = username


async def resolve_oidc_user(db: AsyncSession, claims: dict) -> User:
    """Registered account for these claims, or IdentityDenied. Never creates an account."""
    issuer, sub = settings.OIDC_ISSUER, claims["sub"]
    name = claims.get("preferred_username") if isinstance(claims.get("preferred_username"), str) else None
    link = (await db.execute(select(IdentityLink).where(IdentityLink.issuer == issuer,
                                                       IdentityLink.subject == sub))).scalar_one_or_none()
    if link is not None:
        user = await db.get(User, link.user_id)
        if user is None:
            raise IdentityDenied("unregistered", name)
        if not user.is_active:
            raise IdentityDenied("disabled", user.username)
        link.last_login_at = utcnow()
        await db.commit()
        return user
    email = claims.get("email") if isinstance(claims.get("email"), str) else None
    if not name or not email:
        raise IdentityDenied("unregistered", name)
    user = (await db.execute(select(User).where(User.username == name))).scalar_one_or_none()
    if user is None or user.email.lower() != email.lower():
        raise IdentityDenied("unregistered", name)
    if not user.is_active:
        raise IdentityDenied("disabled", user.username)
    already = (await db.execute(select(IdentityLink).where(IdentityLink.user_id == user.id,
                                                          IdentityLink.issuer == issuer))).first()
    if already:
        raise IdentityDenied("unregistered", name)          # bound to a different authentik subject
    db.add(IdentityLink(user_id=user.id, issuer=issuer, subject=sub, last_login_at=utcnow()))
    await db.commit()
    return user

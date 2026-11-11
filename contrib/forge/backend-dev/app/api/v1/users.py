"""Account administration (administrators only): registration, role/site grants, deactivation, session
revocation and the authentication audit trail. There is no self-service registration anywhere."""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.authz import Principal, ROLES, SITE_ROLES, require
from app.core.database import get_db
from app.core.security import hash_password
from app.models.auth import AuthEvent, IdentityLink
from app.models.user import User
from app.services.identity import register_user, set_user_sites
from app.services.sessions import audit, revoke_user_sessions
from app.services.sites import user_bindings

router = APIRouter(prefix="/admin/users", tags=["admin-users"])


class UserOut(BaseModel):
    id: str
    username: str
    email: str
    full_name: Optional[str]
    role: str
    is_active: bool
    oidc_linked: bool
    sites: List[str]
    site_roles: dict = {}


class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=100)
    email: str = Field(..., max_length=255)
    full_name: str = Field(default="", max_length=255)
    role: str
    sites: List[str] = []
    oidc_subject: Optional[str] = Field(default=None, max_length=255)
    password: Optional[str] = Field(default=None, min_length=12, max_length=128)   # local sign-in only


class UserPatch(BaseModel):
    is_active: Optional[bool] = None
    role: Optional[str] = None
    sites: Optional[List[str]] = None
    password: Optional[str] = Field(default=None, min_length=12, max_length=128)


async def _out(db: AsyncSession, u: User) -> UserOut:
    linked = (await db.execute(select(func.count()).select_from(IdentityLink).where(IdentityLink.user_id == u.id))
              ).scalar_one() > 0
    held = await user_bindings(db, u.id)
    return UserOut(id=u.id, username=u.username, email=u.email, full_name=u.full_name, role=u.role,
                   is_active=u.is_active, oidc_linked=linked, sites=sorted(held), site_roles=held)


@router.get("", response_model=List[UserOut])
async def list_users(db: AsyncSession = Depends(get_db), principal: Principal = Depends(require("admin"))):
    users = (await db.execute(select(User).order_by(User.username))).scalars().all()
    return [await _out(db, u) for u in users]


@router.post("", response_model=UserOut, status_code=201)
async def register(data: UserRegister, db: AsyncSession = Depends(get_db),
                   principal: Principal = Depends(require("admin"))):
    user = await register_user(db, username=data.username, email=data.email, role=data.role,
                               full_name=data.full_name, sites=data.sites, oidc_subject=data.oidc_subject,
                               password=data.password)
    await audit(db, "user_registered", "ok", principal.username, principal.user_id,
                "registered %s role=%s" % (user.username, user.role))
    return await _out(db, user)


@router.patch("/{user_id}", response_model=UserOut)
async def update(user_id: str, data: UserPatch, db: AsyncSession = Depends(get_db),
                 principal: Principal = Depends(require("admin"))):
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(404, "User not found")
    if data.is_active is False and user.id == principal.user_id:
        raise HTTPException(422, "An administrator cannot deactivate their own account")
    changes = []
    role_changed = False
    if data.role is not None:
        if data.role not in ROLES:
            raise HTTPException(422, "role must be one of: " + ", ".join(ROLES))
        if user.id == principal.user_id and data.role != "administrator":
            raise HTTPException(422, "An administrator cannot remove their own administrator role")
        role_changed = user.role != data.role
        user.role = data.role
        changes.append("role")
    if data.password is not None:
        user.hashed_password = hash_password(data.password)
        changes.append("password")
    if data.is_active is not None:
        user.is_active = data.is_active
        changes.append("active=%s" % data.is_active)
    await db.commit()
    if data.sites is None and role_changed and data.role in SITE_ROLES:
        # a role change without a site list re-roles the sites the account already holds
        data.sites = sorted(await user_bindings(db, user.id))
    if data.sites is not None:
        if data.role == "administrator" or (data.role is None and user.role == "administrator"):
            raise HTTPException(422, "A Platform Administrator is global; sites apply to site roles")
        await set_user_sites(db, user.id, data.sites, data.role or user.role, actor=principal.username)
        changes.append("sites")
    if data.is_active is False or role_changed or data.password is not None:
        await revoke_user_sessions(db, user.id, "account changed")
    await audit(db, "user_updated", "ok", principal.username, principal.user_id,
                "%s: %s" % (user.username, ",".join(changes) or "no change"))
    return await _out(db, user)


@router.post("/{user_id}/revoke-sessions")
async def revoke_sessions(user_id: str, db: AsyncSession = Depends(get_db),
                          principal: Principal = Depends(require("admin"))):
    """End every session of a user now (use after changing their authentik groups)."""
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(404, "User not found")
    n = await revoke_user_sessions(db, user.id, "revoked by administrator")
    await audit(db, "session_revoked", "ok", principal.username, principal.user_id,
                "%s: %d session(s)" % (user.username, n))
    return {"revoked": n}


@router.get("/events/recent")
async def recent_events(limit: int = Query(100, ge=1, le=500), db: AsyncSession = Depends(get_db),
                        principal: Principal = Depends(require("admin"))):
    rows = (await db.execute(select(AuthEvent).order_by(AuthEvent.ts.desc()).limit(limit))).scalars().all()
    return [{"ts": r.ts.isoformat() if r.ts else None, "kind": r.kind, "outcome": r.outcome,
             "username": r.username, "detail": r.detail} for r in rows]

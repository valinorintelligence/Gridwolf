"""Sign-in, session and sign-out.

Browser sign-in is authentik OIDC (authorization code + PKCE). The server keeps the session; the browser
holds an opaque HttpOnly cookie and a per-session CSRF token it must echo on state-changing requests.
"""
from __future__ import annotations

import re
from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import oidc
from app.core.authz import (ADMINISTRATOR, PERMISSIONS, ROLE_LABELS, ROLE_RANK, Principal, aware, get_user_principal,
                            utcnow)
from app.core.config import settings
from app.core.database import get_db
from app.core.security import new_token, safe_equal, token_hash
from app.models.auth import AuthSession, OidcTransaction
from app.models.user import User
from app.schemas.user import UserLogin
from app.services.auth import authenticate_local
from app.services.identity import IdentityDenied, resolve_oidc_user
from app.services.sites import resolve_access
from app.services.sessions import (OIDC_COOKIE, OIDC_COOKIE_PATH, audit, clear_session_cookie, create_session,
                                   revoke_session, set_session_cookie)

router = APIRouter(prefix="/auth", tags=["auth"])
NEXT_RE = re.compile(r"^/[A-Za-z0-9/_\-.~%?=&]{0,254}$")
ERRORS = {"denied", "unregistered", "norole", "mfa_required", "expired", "provider_error", "token_invalid",
          "exchange_failed", "disabled", "state"}


def safe_next(value: Optional[str]) -> str:
    return value if value and NEXT_RE.match(value) and not value.startswith("//") and "\\" not in value else "/"


def _login_redirect(code: str) -> RedirectResponse:
    code = code if code in ERRORS else "denied"
    r = RedirectResponse("/login?error=" + code, status_code=302)
    r.delete_cookie(OIDC_COOKIE, path=OIDC_COOKIE_PATH)
    r.headers["Cache-Control"] = "no-store"
    return r


def summary(p: Principal) -> dict:
    now = utcnow()
    held = sorted(p.active_sites) if p.is_platform else sorted(s for s in p.site_roles if s in p.active_sites)
    site_list = []
    for s in held:
        roles = sorted(p.roles_at(s), key=lambda r: ROLE_RANK[r])
        site_list.append({"id": s, "name": p.site_names.get(s, s), "roles": roles,
                          "permissions": sorted(frozenset().union(*(PERMISSIONS[r] for r in roles)))})
    perms = frozenset().union(*(frozenset(x["permissions"]) for x in site_list)) if site_list else frozenset()
    if p.is_platform:
        perms = PERMISSIONS[ADMINISTRATOR]
    return {
        "user": {"id": p.user_id, "username": p.username, "email": p.email, "full_name": p.full_name,
                 "role": p.role or "none", "is_active": True},
        "role": p.role, "role_label": ROLE_LABELS.get(p.role or "", "No role"), "is_platform": p.is_platform,
        "permissions": sorted(perms), "all_sites": p.is_platform, "sites": held, "site_list": site_list,
        "selected_site": p.scope_site,
        "auth_method": p.auth_method, "mfa": p.mfa, "csrf_token": p.csrf_token,
        "idle_expires_in": max(0, int((p.idle_expires_at - now).total_seconds())) if p.idle_expires_at else None,
        "expires_in": max(0, int((p.absolute_expires_at - now).total_seconds())) if p.absolute_expires_at else None}


@router.get("/config")
async def auth_config():
    """What the sign-in page may offer. Reveals no secret and no provider detail."""
    return {"oidc": oidc.configured(), "local_login": settings.LOCAL_LOGIN_ENABLED}


@router.get("/oidc/login")
async def oidc_login(next: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    if not oidc.configured():
        raise HTTPException(status_code=404, detail="Single sign-on is not configured")
    state, nonce, binder = new_token(), new_token(), new_token()
    verifier, challenge = oidc.pkce_pair()
    try:
        url = await oidc.authorization_url(state, nonce, challenge)
    except oidc.OidcError:
        await audit(db, "login_failed", "error", detail="oidc discovery failed")
        return _login_redirect("provider_error")
    db.add(OidcTransaction(state_hash=token_hash(state), binder_hash=token_hash(binder), nonce=nonce,
                           code_verifier=verifier, next_path=safe_next(next),
                           expires_at=utcnow() + timedelta(minutes=10)))
    await db.commit()
    r = RedirectResponse(url, status_code=302)
    r.set_cookie(OIDC_COOKIE, binder, max_age=600, httponly=True, secure=settings.COOKIE_SECURE, samesite="lax",
                 path=OIDC_COOKIE_PATH)
    r.headers["Cache-Control"] = "no-store"
    return r


@router.get("/oidc/callback")
async def oidc_callback(request: Request, code: Optional[str] = None, state: Optional[str] = None,
                        error: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    if not oidc.configured():
        raise HTTPException(status_code=404, detail="Single sign-on is not configured")
    binder = request.cookies.get(OIDC_COOKIE)
    tx = await db.get(OidcTransaction, token_hash(state)) if state else None
    # The transaction is single use and bound to the browser that started it (login CSRF / fixation).
    if (tx is None or tx.used_at is not None or not binder or not safe_equal(token_hash(binder), tx.binder_hash)
            or aware(tx.expires_at) <= utcnow()):
        await audit(db, "login_failed", "denied", detail="oidc state invalid or expired")
        return _login_redirect("state")
    tx.used_at = utcnow()
    await db.commit()
    if error or not code:
        await audit(db, "login_failed", "denied", detail="provider returned an error")
        return _login_redirect("denied")
    try:
        tokens = await oidc.exchange_code(code, tx.code_verifier)
        claims = await oidc.validate_id_token(tokens["id_token"], tx.nonce, tokens.get("access_token"))
    except oidc.OidcError as exc:
        await audit(db, "login_failed", "denied" if exc.code != "provider_error" else "error", detail=exc.code)
        return _login_redirect(exc.code)
    grants = oidc.map_grants(claims)
    name = claims.get("preferred_username") if isinstance(claims.get("preferred_username"), str) else None
    try:
        user = await resolve_oidc_user(db, claims)
    except IdentityDenied as exc:
        await audit(db, "login_failed", "denied", exc.username, detail=exc.code)
        return _login_redirect(exc.code)
    access = await resolve_access(db, user, "oidc", list(grants.groups))
    if access.label is None:
        await audit(db, "login_failed", "denied", user.username, user.id, "no Gridwolf role group")
        return _login_redirect("norole")
    if settings.OIDC_REQUIRE_MFA and not grants.mfa:
        await audit(db, "login_failed", "denied", user.username, user.id, "mfa not asserted")
        return _login_redirect("mfa_required")
    token, _ = await create_session(db, user, "oidc", access.label, access.sites, grants.groups, grants.mfa)
    await audit(db, "login", "ok", user.username, user.id,
                "oidc role=%s sites=%d mfa=%s" % (access.label, len(access.sites), grants.mfa))
    r = RedirectResponse(tx.next_path or "/", status_code=302)
    set_session_cookie(r, token)
    r.delete_cookie(OIDC_COOKIE, path=OIDC_COOKIE_PATH)
    r.headers["Cache-Control"] = "no-store"
    return r


@router.post("/login")
async def login(data: UserLogin, response: Response, db: AsyncSession = Depends(get_db)):
    user = await authenticate_local(db, data.username, data.password)
    access = await resolve_access(db, user, "local", [])
    token, sess = await create_session(db, user, "local", access.label or "none", access.sites, [], False)
    await audit(db, "login", "ok", user.username, user.id, "local role=%s sites=%d" % (access.label or "none", len(access.sites)))
    set_session_cookie(response, token)
    response.headers["Cache-Control"] = "no-store"
    return {"status": "ok", "csrf_token": sess.csrf_token}


@router.get("/session")
async def session_info(response: Response, principal: Principal = Depends(get_user_principal)):
    response.headers["Cache-Control"] = "no-store"
    return summary(principal)


@router.get("/me")
async def me(principal: Principal = Depends(get_user_principal)):
    return summary(principal)["user"]


@router.post("/logout")
async def logout(response: Response, principal: Principal = Depends(get_user_principal), db: AsyncSession = Depends(get_db)):
    await revoke_session(db, principal.session_key, "logout")
    await audit(db, "logout", "ok", principal.username, principal.user_id)
    clear_session_cookie(response)
    logout_url = None
    if principal.auth_method == "oidc" and oidc.configured() and settings.OIDC_END_SESSION_ON_LOGOUT:
        try:
            logout_url = (await oidc.discovery()).get("end_session_endpoint")
        except oidc.OidcError:
            logout_url = None
    return {"status": "signed_out", "logout_url": logout_url}

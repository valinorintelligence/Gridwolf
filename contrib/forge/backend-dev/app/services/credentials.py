"""Service credentials: bearer tokens for non-browser callers (scripts, collectors).

A credential is created by an administrator (API or CLI), is shown once, and is stored only as a SHA-256.
It holds explicit permissions (view, export, ingest; never admin or platform), explicit sites (never all
sites) and always expires. Revocation applies on the next request. Every creation, revocation and rejected
use of a known credential is recorded in the authentication audit trail (no token is ever written).
"""
from __future__ import annotations

import re
from datetime import timedelta
from typing import Iterable, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.authz import (SERVICE_MAX_DAYS, SERVICE_PERMISSIONS, SERVICE_TOKEN_PREFIX, utcnow, valid_site)
from app.core.security import new_token, token_hash
from app.models.auth import ServiceCredential
from app.services.sessions import audit

NAME_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{1,78}$")


class CredentialError(ValueError):
    """A request that must be refused (the message is safe to return to the administrator)."""


async def create_credential(db: AsyncSession, *, name: str, permissions: Iterable[str], sites: Iterable[str],
                            lifetime_days: int, created_by: str) -> tuple[str, ServiceCredential]:
    name = (name or "").strip()
    if not NAME_RE.match(name):
        raise CredentialError("name must be 2-79 characters: lower-case letters, digits, '.', '_' or '-'")
    perms = sorted(set(permissions))
    if not perms or not set(perms) <= SERVICE_PERMISSIONS:
        raise CredentialError("permissions must be a non-empty subset of: " + ", ".join(sorted(SERVICE_PERMISSIONS)))
    site_list = sorted(set(sites))
    if not site_list or not all(valid_site(s) for s in site_list):
        raise CredentialError("at least one valid site is required; a service credential never covers all sites")
    if not 1 <= int(lifetime_days) <= SERVICE_MAX_DAYS:
        raise CredentialError("lifetime must be between 1 and %d days" % SERVICE_MAX_DAYS)
    if (await db.execute(select(ServiceCredential.id).where(ServiceCredential.name == name))).first():
        raise CredentialError("a credential with this name already exists (revoke it and choose another name)")
    token = SERVICE_TOKEN_PREFIX + new_token()
    cred = ServiceCredential(name=name, token_hash=token_hash(token), token_prefix=token[len(SERVICE_TOKEN_PREFIX):][:8],
                             permissions=perms, sites=site_list, created_by=created_by[:255],
                             expires_at=utcnow() + timedelta(days=int(lifetime_days)))
    db.add(cred)
    await db.commit()
    await audit(db, "service_credential_created", "ok", created_by, None,
                "%s perms=%s sites=%s days=%d" % (name, ",".join(perms), ",".join(site_list), lifetime_days))
    return token, cred


async def revoke_credential(db: AsyncSession, credential_id: str, by: str, reason: str = "revoked") -> Optional[ServiceCredential]:
    cred = await db.get(ServiceCredential, credential_id)
    if cred is None:
        return None
    if cred.revoked_at is None:
        cred.revoked_at = utcnow()
        cred.revoked_reason = reason[:64]
        await db.commit()
        await audit(db, "service_credential_revoked", "ok", by, None, cred.name)
    return cred


def describe(cred: ServiceCredential) -> dict:
    now = utcnow()
    from app.core.authz import aware
    state = "revoked" if cred.revoked_at is not None else "expired" if aware(cred.expires_at) <= now else "active"
    return {"id": cred.id, "name": cred.name, "token_prefix": cred.token_prefix, "state": state,
            "permissions": list(cred.permissions or []), "sites": list(cred.sites or []),
            "created_by": cred.created_by, "created_at": cred.created_at.isoformat() if cred.created_at else None,
            "expires_at": aware(cred.expires_at).isoformat(), "last_used_at":
                aware(cred.last_used_at).isoformat() if cred.last_used_at else None,
            "use_count": cred.use_count or 0}

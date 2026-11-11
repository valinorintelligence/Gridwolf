"""Service credentials for non-browser callers (administrators only; see app.services.credentials)."""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.authz import Principal, require
from app.core.database import get_db
from app.models.auth import ServiceCredential
from app.services.credentials import CredentialError, create_credential, describe, revoke_credential

router = APIRouter(prefix="/admin/service-credentials", tags=["admin-service-credentials"])


class CredentialCreate(BaseModel):
    name: str = Field(..., max_length=80)
    permissions: List[str] = Field(default_factory=lambda: ["view"])
    sites: List[str]
    lifetime_days: int = Field(default=30, ge=1, le=90)


@router.get("")
async def list_credentials(db: AsyncSession = Depends(get_db), principal: Principal = Depends(require("admin"))):
    rows = (await db.execute(select(ServiceCredential).order_by(ServiceCredential.created_at.desc()))).scalars().all()
    return [describe(c) for c in rows]


@router.post("", status_code=201)
async def create(data: CredentialCreate, db: AsyncSession = Depends(get_db),
                 principal: Principal = Depends(require("admin"))):
    """The token is returned once, in this response only."""
    try:
        token, cred = await create_credential(db, name=data.name, permissions=data.permissions, sites=data.sites,
                                              lifetime_days=data.lifetime_days, created_by=principal.username)
    except CredentialError as exc:
        raise HTTPException(422, str(exc))
    return {**describe(cred), "token": token}


@router.delete("/{credential_id}")
async def revoke(credential_id: str, db: AsyncSession = Depends(get_db),
                 principal: Principal = Depends(require("admin"))):
    cred = await revoke_credential(db, credential_id, principal.username, "revoked by administrator")
    if cred is None:
        raise HTTPException(404, "Credential not found")
    return describe(cred)

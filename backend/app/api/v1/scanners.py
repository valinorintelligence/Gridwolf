import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.ontology import AuditLog, ObjectInstance, ObjectType
from app.models.user import User
from app.services.scanner_parsers import parse_generic, parse_sarif, parse_semgrep, parse_trivy

router = APIRouter(prefix="/scanners", tags=["scanners"])


class ScannerImportRequest(BaseModel):
    data: dict[str, Any]
    type_name: str = "Vulnerability"


class ScannerImportResponse(BaseModel):
    imported: int
    type_id: str
    message: str


async def _import_findings(
    db: AsyncSession,
    user: User,
    findings: list[dict[str, Any]],
    type_name: str,
    source: str,
) -> ScannerImportResponse:
    """Common logic to import parsed findings into the database."""
    # Find or error on the object type
    result = await db.execute(select(ObjectType).where(ObjectType.name == type_name))
    obj_type = result.scalar_one_or_none()
    if obj_type is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Object type '{type_name}' not found. Run the seed script first.",
        )

    created = 0
    for finding in findings:
        obj = ObjectInstance(
            type_id=obj_type.id,
            title=finding["title"][:500],
            properties=finding.get("properties"),
            severity=finding.get("severity"),
            status=finding.get("status", "open"),
        )
        db.add(obj)
        created += 1

    if created > 0:
        audit = AuditLog(
            user_id=user.id,
            action=f"import:{source}",
            details={"count": created, "type": type_name},
        )
        db.add(audit)
        await db.commit()

    return ScannerImportResponse(
        imported=created,
        type_id=str(obj_type.id),
        message=f"Successfully imported {created} findings from {source}",
    )


@router.post("/import/semgrep", response_model=ScannerImportResponse)
async def import_semgrep(
    request: ScannerImportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    findings = parse_semgrep(request.data)
    return await _import_findings(db, current_user, findings, request.type_name, "semgrep")


@router.post("/import/trivy", response_model=ScannerImportResponse)
async def import_trivy(
    request: ScannerImportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    findings = parse_trivy(request.data)
    return await _import_findings(db, current_user, findings, request.type_name, "trivy")


@router.post("/import/sarif", response_model=ScannerImportResponse)
async def import_sarif(
    request: ScannerImportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    findings = parse_sarif(request.data)
    return await _import_findings(db, current_user, findings, request.type_name, "sarif")


@router.post("/import/generic", response_model=ScannerImportResponse)
async def import_generic(
    request: ScannerImportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    findings = parse_generic(request.data)
    return await _import_findings(db, current_user, findings, request.type_name, "generic")

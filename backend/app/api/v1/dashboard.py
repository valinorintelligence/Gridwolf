from __future__ import annotations
from typing import Optional, List

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.ontology import Link, ObjectInstance, ObjectType, SavedDashboard
from app.models.user import User

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


class DashboardStats(BaseModel):
    total_objects: int
    total_types: int
    total_links: int
    objects_by_type: List[dict]
    objects_by_severity: List[dict]
    objects_by_status: List[dict]
    recent_objects: List[dict]


class SavedDashboardCreate(BaseModel):
    name: str
    layout: Optional[dict] = None
    is_default: bool = False


class SavedDashboardResponse(BaseModel):
    id: str
    name: str
    user_id: str
    layout: Optional[dict]
    is_default: bool
    created_at: str

    model_config = {"from_attributes": True}


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Total counts
    total_objects = (await db.execute(select(func.count(ObjectInstance.id)))).scalar() or 0
    total_types = (await db.execute(select(func.count(ObjectType.id)))).scalar() or 0
    total_links = (await db.execute(select(func.count(Link.id)))).scalar() or 0

    # Objects by type
    type_counts = await db.execute(
        select(ObjectType.name, func.count(ObjectInstance.id))
        .outerjoin(ObjectInstance, ObjectInstance.type_id == ObjectType.id)
        .group_by(ObjectType.name)
    )
    objects_by_type = [{"type": name, "count": count} for name, count in type_counts.all()]

    # Objects by severity
    severity_counts = await db.execute(
        select(ObjectInstance.severity, func.count(ObjectInstance.id))
        .where(ObjectInstance.severity.isnot(None))
        .group_by(ObjectInstance.severity)
    )
    objects_by_severity = [
        {"severity": sev, "count": count} for sev, count in severity_counts.all()
    ]

    # Objects by status
    status_counts = await db.execute(
        select(ObjectInstance.status, func.count(ObjectInstance.id))
        .where(ObjectInstance.status.isnot(None))
        .group_by(ObjectInstance.status)
    )
    objects_by_status = [{"status": s, "count": count} for s, count in status_counts.all()]

    # Recent objects
    recent_result = await db.execute(
        select(ObjectInstance).order_by(ObjectInstance.created_at.desc()).limit(10)
    )
    recent = recent_result.scalars().all()
    recent_objects = [
        {
            "id": str(obj.id),
            "title": obj.title,
            "status": obj.status,
            "severity": obj.severity,
            "created_at": obj.created_at.isoformat(),
        }
        for obj in recent
    ]

    return DashboardStats(
        total_objects=total_objects,
        total_types=total_types,
        total_links=total_links,
        objects_by_type=objects_by_type,
        objects_by_severity=objects_by_severity,
        objects_by_status=objects_by_status,
        recent_objects=recent_objects,
    )


@router.get("/saved", response_model=List[SavedDashboardResponse])
async def list_saved_dashboards(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(SavedDashboard)
        .where(SavedDashboard.user_id == current_user.id)
        .order_by(SavedDashboard.created_at.desc())
    )
    dashboards = result.scalars().all()
    return [
        SavedDashboardResponse(
            id=d.id,
            name=d.name,
            user_id=d.user_id,
            layout=d.layout,
            is_default=d.is_default,
            created_at=d.created_at.isoformat(),
        )
        for d in dashboards
    ]


@router.post("/saved", response_model=SavedDashboardResponse, status_code=status.HTTP_201_CREATED)
async def save_dashboard(
    data: SavedDashboardCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # If this is set as default, unset other defaults for this user
    if data.is_default:
        existing = await db.execute(
            select(SavedDashboard).where(
                SavedDashboard.user_id == current_user.id,
                SavedDashboard.is_default.is_(True),
            )
        )
        for dash in existing.scalars().all():
            dash.is_default = False

    dashboard = SavedDashboard(
        name=data.name,
        user_id=current_user.id,
        layout=data.layout,
        is_default=data.is_default,
    )
    db.add(dashboard)
    await db.commit()
    await db.refresh(dashboard)

    return SavedDashboardResponse(
        id=dashboard.id,
        name=dashboard.name,
        user_id=dashboard.user_id,
        layout=dashboard.layout,
        is_default=dashboard.is_default,
        created_at=dashboard.created_at.isoformat(),
    )

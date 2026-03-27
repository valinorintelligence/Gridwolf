from __future__ import annotations
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.ontology import Action, AuditLog, ObjectInstance
from app.models.user import User
from app.schemas.ontology import (
    LinkResponse,
    ObjectCreate,
    ObjectListResponse,
    ObjectResponse,
    ObjectUpdate,
)
from app.services.ontology import (
    create_object,
    delete_object,
    get_object,
    get_object_links,
    list_objects,
    search_objects,
    update_object,
)

router = APIRouter(prefix="/objects", tags=["objects"])


@router.get("/", response_model=ObjectListResponse)
async def list_objects_endpoint(
    type_id: Optional[str] = Query(None, description="Filter by object type"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    severity: Optional[str] = Query(None, description="Filter by severity"),
    search: Optional[str] = Query(None, description="Search in title"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if search:
        return await search_objects(db, search, page=page, page_size=page_size)
    return await list_objects(
        db,
        type_id=type_id,
        status_filter=status_filter,
        severity=severity,
        page=page,
        page_size=page_size,
    )


@router.get("/{object_id}", response_model=ObjectResponse)
async def get_object_endpoint(
    object_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await get_object(db, object_id)


@router.post("/", response_model=ObjectResponse, status_code=status.HTTP_201_CREATED)
async def create_object_endpoint(
    data: ObjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    obj = await create_object(db, data)

    # Audit log
    audit = AuditLog(
        object_id=obj.id,
        user_id=current_user.id,
        action="create",
        details={"title": obj.title},
    )
    db.add(audit)
    await db.commit()

    return obj


@router.put("/{object_id}", response_model=ObjectResponse)
async def update_object_endpoint(
    object_id: str,
    data: ObjectUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    obj = await update_object(db, object_id, data)

    audit = AuditLog(
        object_id=obj.id,
        user_id=current_user.id,
        action="update",
        details=data.model_dump(exclude_unset=True),
    )
    db.add(audit)
    await db.commit()

    return obj


@router.delete("/{object_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_object_endpoint(
    object_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    audit = AuditLog(
        object_id=object_id,
        user_id=current_user.id,
        action="delete",
    )
    db.add(audit)

    await delete_object(db, object_id)


@router.get("/{object_id}/links", response_model=List[LinkResponse])
async def get_object_links_endpoint(
    object_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await get_object_links(db, object_id)


@router.post("/{object_id}/actions/{action_id}")
async def execute_action_endpoint(
    object_id: str,
    action_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify object exists
    result = await db.execute(
        select(ObjectInstance).where(ObjectInstance.id == object_id)
    )
    obj = result.scalar_one_or_none()
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Object not found")

    # Verify action exists
    action_result = await db.execute(select(Action).where(Action.id == action_id))
    action = action_result.scalar_one_or_none()
    if action is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action not found")

    # Log the action execution
    audit = AuditLog(
        object_id=object_id,
        user_id=current_user.id,
        action=f"execute:{action.name}",
        details={"action_id": str(action_id), "action_type": action.action_type},
    )
    db.add(audit)
    await db.commit()

    return {
        "status": "executed",
        "action": action.name,
        "object_id": str(object_id),
        "message": f"Action '{action.name}' executed on object",
    }

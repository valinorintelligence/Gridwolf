from __future__ import annotations
from typing import Optional, List

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.ontology import (
    GraphResponse,
    ObjectTypeCreate,
    ObjectTypeResponse,
)
from app.services.ontology import (
    create_object_type,
    get_graph,
    get_object_type,
    list_object_types,
)

router = APIRouter(prefix="/ontology", tags=["ontology"])


@router.get("/types", response_model=List[ObjectTypeResponse])
async def list_types(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await list_object_types(db)


@router.get("/types/{type_id}", response_model=ObjectTypeResponse)
async def get_type(
    type_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await get_object_type(db, type_id)


@router.post("/types", response_model=ObjectTypeResponse, status_code=status.HTTP_201_CREATED)
async def create_type(
    data: ObjectTypeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await create_object_type(db, data)


@router.get("/graph", response_model=GraphResponse)
async def get_graph_data(
    type_id: Optional[str] = Query(None, description="Filter graph by object type"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await get_graph(db, type_id=type_id)

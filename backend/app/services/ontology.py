import math
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.ontology import Action, Link, ObjectInstance, ObjectType
from app.schemas.ontology import (
    ActionCreate,
    ActionResponse,
    GraphEdge,
    GraphNode,
    GraphResponse,
    LinkCreate,
    LinkResponse,
    ObjectCreate,
    ObjectListResponse,
    ObjectResponse,
    ObjectTypeCreate,
    ObjectTypeResponse,
    ObjectTypeUpdate,
    ObjectUpdate,
)


# --- ObjectType CRUD ---


async def list_object_types(db: AsyncSession) -> list[ObjectTypeResponse]:
    result = await db.execute(select(ObjectType).order_by(ObjectType.name))
    types = result.scalars().all()
    return [ObjectTypeResponse.model_validate(t) for t in types]


async def get_object_type(db: AsyncSession, type_id: uuid.UUID) -> ObjectTypeResponse:
    result = await db.execute(select(ObjectType).where(ObjectType.id == type_id))
    obj_type = result.scalar_one_or_none()
    if obj_type is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Object type not found")
    return ObjectTypeResponse.model_validate(obj_type)


async def create_object_type(db: AsyncSession, data: ObjectTypeCreate) -> ObjectTypeResponse:
    existing = await db.execute(select(ObjectType).where(ObjectType.name == data.name))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Object type '{data.name}' already exists",
        )
    obj_type = ObjectType(**data.model_dump())
    db.add(obj_type)
    await db.commit()
    await db.refresh(obj_type)
    return ObjectTypeResponse.model_validate(obj_type)


async def update_object_type(
    db: AsyncSession, type_id: uuid.UUID, data: ObjectTypeUpdate
) -> ObjectTypeResponse:
    result = await db.execute(select(ObjectType).where(ObjectType.id == type_id))
    obj_type = result.scalar_one_or_none()
    if obj_type is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Object type not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(obj_type, key, value)

    await db.commit()
    await db.refresh(obj_type)
    return ObjectTypeResponse.model_validate(obj_type)


async def delete_object_type(db: AsyncSession, type_id: uuid.UUID) -> None:
    result = await db.execute(select(ObjectType).where(ObjectType.id == type_id))
    obj_type = result.scalar_one_or_none()
    if obj_type is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Object type not found")
    await db.delete(obj_type)
    await db.commit()


# --- Object CRUD ---


async def list_objects(
    db: AsyncSession,
    type_id: uuid.UUID | None = None,
    status_filter: str | None = None,
    severity: str | None = None,
    page: int = 1,
    page_size: int = 50,
) -> ObjectListResponse:
    query = select(ObjectInstance).options(selectinload(ObjectInstance.object_type))

    if type_id:
        query = query.where(ObjectInstance.type_id == type_id)
    if status_filter:
        query = query.where(ObjectInstance.status == status_filter)
    if severity:
        query = query.where(ObjectInstance.severity == severity)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Paginate
    query = query.order_by(ObjectInstance.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    objects = result.scalars().all()

    items = []
    for obj in objects:
        resp = ObjectResponse.model_validate(obj)
        resp.type_name = obj.object_type.name if obj.object_type else None
        items.append(resp)

    return ObjectListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 0,
    )


async def get_object(db: AsyncSession, object_id: uuid.UUID) -> ObjectResponse:
    result = await db.execute(
        select(ObjectInstance)
        .options(selectinload(ObjectInstance.object_type))
        .where(ObjectInstance.id == object_id)
    )
    obj = result.scalar_one_or_none()
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Object not found")
    resp = ObjectResponse.model_validate(obj)
    resp.type_name = obj.object_type.name if obj.object_type else None
    return resp


async def create_object(db: AsyncSession, data: ObjectCreate) -> ObjectResponse:
    # Verify type exists
    type_result = await db.execute(select(ObjectType).where(ObjectType.id == data.type_id))
    obj_type = type_result.scalar_one_or_none()
    if obj_type is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Object type not found")

    obj = ObjectInstance(**data.model_dump())
    db.add(obj)
    await db.commit()
    await db.refresh(obj)

    resp = ObjectResponse.model_validate(obj)
    resp.type_name = obj_type.name
    return resp


async def update_object(
    db: AsyncSession, object_id: uuid.UUID, data: ObjectUpdate
) -> ObjectResponse:
    result = await db.execute(
        select(ObjectInstance)
        .options(selectinload(ObjectInstance.object_type))
        .where(ObjectInstance.id == object_id)
    )
    obj = result.scalar_one_or_none()
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Object not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(obj, key, value)
    obj.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(obj)

    resp = ObjectResponse.model_validate(obj)
    resp.type_name = obj.object_type.name if obj.object_type else None
    return resp


async def delete_object(db: AsyncSession, object_id: uuid.UUID) -> None:
    result = await db.execute(select(ObjectInstance).where(ObjectInstance.id == object_id))
    obj = result.scalar_one_or_none()
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Object not found")
    await db.delete(obj)
    await db.commit()


async def search_objects(
    db: AsyncSession, query: str, page: int = 1, page_size: int = 50
) -> ObjectListResponse:
    search_query = (
        select(ObjectInstance)
        .options(selectinload(ObjectInstance.object_type))
        .where(ObjectInstance.title.ilike(f"%{query}%"))
    )

    count_query = select(func.count()).select_from(search_query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    search_query = search_query.order_by(ObjectInstance.created_at.desc())
    search_query = search_query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(search_query)
    objects = result.scalars().all()

    items = []
    for obj in objects:
        resp = ObjectResponse.model_validate(obj)
        resp.type_name = obj.object_type.name if obj.object_type else None
        items.append(resp)

    return ObjectListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 0,
    )


# --- Link CRUD ---


async def create_link(db: AsyncSession, data: LinkCreate) -> LinkResponse:
    # Verify both objects exist
    for oid in [data.source_id, data.target_id]:
        result = await db.execute(select(ObjectInstance).where(ObjectInstance.id == oid))
        if result.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Object {oid} not found",
            )

    link = Link(**data.model_dump())
    db.add(link)
    await db.commit()
    await db.refresh(link)
    return LinkResponse.model_validate(link)


async def get_object_links(db: AsyncSession, object_id: uuid.UUID) -> list[LinkResponse]:
    result = await db.execute(
        select(Link).where((Link.source_id == object_id) | (Link.target_id == object_id))
    )
    links = result.scalars().all()
    return [LinkResponse.model_validate(link) for link in links]


# --- Graph ---


async def get_graph(
    db: AsyncSession, type_id: uuid.UUID | None = None
) -> GraphResponse:
    obj_query = select(ObjectInstance).options(selectinload(ObjectInstance.object_type))
    if type_id:
        obj_query = obj_query.where(ObjectInstance.type_id == type_id)

    result = await db.execute(obj_query)
    objects = result.scalars().all()
    object_ids = {obj.id for obj in objects}

    nodes = [
        GraphNode(
            id=obj.id,
            type_id=obj.type_id,
            type_name=obj.object_type.name if obj.object_type else None,
            title=obj.title,
            status=obj.status,
            severity=obj.severity,
        )
        for obj in objects
    ]

    link_result = await db.execute(
        select(Link).where(Link.source_id.in_(object_ids) | Link.target_id.in_(object_ids))
    )
    links = link_result.scalars().all()

    edges = [
        GraphEdge(
            id=link.id,
            source_id=link.source_id,
            target_id=link.target_id,
            link_type=link.link_type,
        )
        for link in links
        if link.source_id in object_ids and link.target_id in object_ids
    ]

    return GraphResponse(nodes=nodes, edges=edges)


# --- Actions ---


async def create_action(db: AsyncSession, data: ActionCreate) -> ActionResponse:
    action = Action(**data.model_dump())
    db.add(action)
    await db.commit()
    await db.refresh(action)
    return ActionResponse.model_validate(action)


async def list_actions(
    db: AsyncSession, object_type_id: uuid.UUID | None = None
) -> list[ActionResponse]:
    query = select(Action)
    if object_type_id:
        query = query.where(Action.object_type_id == object_type_id)
    result = await db.execute(query)
    actions = result.scalars().all()
    return [ActionResponse.model_validate(a) for a in actions]

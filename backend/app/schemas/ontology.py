import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# --- ObjectType schemas ---


class ObjectTypeCreate(BaseModel):
    name: str = Field(..., max_length=100)
    icon: str | None = None
    color: str | None = None
    description: str | None = None
    properties_schema: dict | None = None


class ObjectTypeUpdate(BaseModel):
    name: str | None = None
    icon: str | None = None
    color: str | None = None
    description: str | None = None
    properties_schema: dict | None = None


class ObjectTypeResponse(BaseModel):
    id: uuid.UUID
    name: str
    icon: str | None
    color: str | None
    description: str | None
    properties_schema: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Object (ObjectInstance) schemas ---


class ObjectCreate(BaseModel):
    type_id: uuid.UUID
    title: str = Field(..., max_length=500)
    properties: dict | None = None
    status: str | None = None
    severity: str | None = None


class ObjectUpdate(BaseModel):
    title: str | None = None
    properties: dict | None = None
    status: str | None = None
    severity: str | None = None


class ObjectResponse(BaseModel):
    id: uuid.UUID
    type_id: uuid.UUID
    type_name: str | None = None
    title: str
    properties: dict | None
    status: str | None
    severity: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ObjectListResponse(BaseModel):
    items: list[ObjectResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# --- Link schemas ---


class LinkCreate(BaseModel):
    source_id: uuid.UUID
    target_id: uuid.UUID
    link_type: str = Field(..., max_length=100)
    properties: dict | None = None


class LinkResponse(BaseModel):
    id: uuid.UUID
    source_id: uuid.UUID
    target_id: uuid.UUID
    link_type: str
    properties: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Action schemas ---


class ActionCreate(BaseModel):
    name: str = Field(..., max_length=100)
    object_type_id: uuid.UUID
    action_type: str | None = None
    config: dict | None = None


class ActionResponse(BaseModel):
    id: uuid.UUID
    name: str
    object_type_id: uuid.UUID
    action_type: str | None
    config: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ActionExecuteRequest(BaseModel):
    object_id: uuid.UUID


# --- Graph schemas ---


class GraphNode(BaseModel):
    id: uuid.UUID
    type_id: uuid.UUID
    type_name: str | None = None
    title: str
    status: str | None = None
    severity: str | None = None


class GraphEdge(BaseModel):
    id: uuid.UUID
    source_id: uuid.UUID
    target_id: uuid.UUID
    link_type: str


class GraphResponse(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]

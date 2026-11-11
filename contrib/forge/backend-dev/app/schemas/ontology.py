from __future__ import annotations
from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field


# --- ObjectType schemas ---


class ObjectTypeCreate(BaseModel):
    name: str = Field(..., max_length=100)
    icon: Optional[str] = None
    color: Optional[str] = None
    description: Optional[str] = None
    properties_schema: Optional[dict] = None


class ObjectTypeUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    description: Optional[str] = None
    properties_schema: Optional[dict] = None


class ObjectTypeResponse(BaseModel):
    id: str
    name: str
    icon: Optional[str]
    color: Optional[str]
    description: Optional[str]
    properties_schema: Optional[dict]
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Object (ObjectInstance) schemas ---


class ObjectCreate(BaseModel):
    type_id: str
    title: str = Field(..., max_length=500)
    properties: Optional[dict] = None
    status: Optional[str] = None
    severity: Optional[str] = None


class ObjectUpdate(BaseModel):
    title: Optional[str] = None
    properties: Optional[dict] = None
    status: Optional[str] = None
    severity: Optional[str] = None


class ObjectResponse(BaseModel):
    id: str
    type_id: str
    type_name: Optional[str] = None
    title: str
    properties: Optional[dict]
    status: Optional[str]
    severity: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ObjectListResponse(BaseModel):
    items: List[ObjectResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# --- Link schemas ---


class LinkCreate(BaseModel):
    source_id: str
    target_id: str
    link_type: str = Field(..., max_length=100)
    properties: Optional[dict] = None


class LinkResponse(BaseModel):
    id: str
    source_id: str
    target_id: str
    link_type: str
    properties: Optional[dict]
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Action schemas ---


class ActionCreate(BaseModel):
    name: str = Field(..., max_length=100)
    object_type_id: str
    action_type: Optional[str] = None
    config: Optional[dict] = None


class ActionResponse(BaseModel):
    id: str
    name: str
    object_type_id: str
    action_type: Optional[str]
    config: Optional[dict]
    created_at: datetime

    model_config = {"from_attributes": True}


class ActionExecuteRequest(BaseModel):
    object_id: str


# --- Graph schemas ---


class GraphNode(BaseModel):
    id: str
    type_id: str
    type_name: Optional[str] = None
    title: str
    status: Optional[str] = None
    severity: Optional[str] = None


class GraphEdge(BaseModel):
    id: str
    source_id: str
    target_id: str
    link_type: str


class GraphResponse(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]

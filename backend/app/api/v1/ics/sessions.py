from __future__ import annotations
"""Session & Project Management API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.ics import Session, Project

router = APIRouter(prefix="/sessions", tags=["Sessions & Projects"])


class SessionCreate(BaseModel):
    name: str
    description: Optional[str] = None
    project_id: Optional[str] = None


class ProjectCreate(BaseModel):
    name: str
    client_name: Optional[str] = None
    assessor_name: Optional[str] = None
    description: Optional[str] = None


@router.get("/")
async def list_sessions(
    project_id: str = None,
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List all sessions."""
    query = select(Session).order_by(Session.created_at.desc())
    if project_id:
        query = query.where(Session.project_id == project_id)
    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    sessions = result.scalars().all()

    return [
        {
            "id": s.id,
            "name": s.name,
            "description": s.description,
            "project_id": s.project_id,
            "status": s.status,
            "drift_score": s.drift_score,
            "device_count": s.device_count,
            "connection_count": s.connection_count,
            "finding_count": s.finding_count,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "updated_at": s.updated_at.isoformat() if s.updated_at else None,
        }
        for s in sessions
    ]


@router.post("/")
async def create_session(data: SessionCreate, db: AsyncSession = Depends(get_db)):
    """Create a new assessment session."""
    session = Session(name=data.name, description=data.description, project_id=data.project_id)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return {"id": session.id, "name": session.name, "status": session.status}


@router.get("/{session_id}")
async def get_session(session_id: str, db: AsyncSession = Depends(get_db)):
    """Get session details with summary stats."""
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")

    return {
        "id": session.id,
        "name": session.name,
        "description": session.description,
        "status": session.status,
        "device_count": session.device_count,
        "connection_count": session.connection_count,
        "finding_count": session.finding_count,
        "drift_score": session.drift_score,
        "created_at": session.created_at.isoformat() if session.created_at else None,
    }


@router.delete("/{session_id}")
async def delete_session(session_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a session and all associated data."""
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")
    await db.delete(session)
    await db.commit()
    return {"message": f"Session {session_id} deleted"}


# ─── Projects ──────────────────────────────────────────

@router.get("/projects/list")
async def list_projects(
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List all projects."""
    result = await db.execute(
        select(Project).order_by(Project.created_at.desc()).offset(offset).limit(limit)
    )
    projects = result.scalars().all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "client_name": p.client_name,
            "assessor_name": p.assessor_name,
            "description": p.description,
            "status": p.status,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in projects
    ]


@router.post("/projects")
async def create_project(data: ProjectCreate, db: AsyncSession = Depends(get_db)):
    """Create a new project."""
    project = Project(
        name=data.name,
        client_name=data.client_name,
        assessor_name=data.assessor_name,
        description=data.description,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return {"id": project.id, "name": project.name}

"""Session & Project Management API endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.authz import (Principal, apply_scope, assign_project_site, assign_session_site, get_visible_project,
                            get_visible_session, project_site, require, resolve_new_session_site,
                            session_site)
from app.core.database import get_db
from app.models.auth import ProjectSite, SessionSite
from app.models.ics import Session, Project

router = APIRouter(prefix="/sessions", tags=["Sessions & Projects"])


async def _visible_project_ids(db: AsyncSession, principal: Principal, ids) -> set:
    """Of these project ids, the ones the caller may see (a session never reveals an out-of-scope project)."""
    ids = {i for i in ids if i}
    if not ids or principal.all_sites:
        return ids
    sites = principal.expanded_sites()
    rows = await db.execute(select(ProjectSite.project_id).where(ProjectSite.project_id.in_(ids),
                                                                 ProjectSite.site_id.in_(sites)))
    return set(rows.scalars())


class SessionCreate(BaseModel):
    name: str
    description: Optional[str] = None
    project_id: Optional[str] = None
    site_id: Optional[str] = None


class SiteAssign(BaseModel):
    site_id: Optional[str] = None      # null = unassigned (administrators only)


class ProjectCreate(BaseModel):
    name: str
    client_name: Optional[str] = None
    assessor_name: Optional[str] = None
    description: Optional[str] = None
    site_id: Optional[str] = None


@router.get("/")
async def list_sessions(
    project_id: str = None,
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require("view")),
):
    """List the sessions the caller may see."""
    query = apply_scope(select(Session), Session.id, principal).order_by(Session.created_at.desc())
    if project_id:
        query = query.where(Session.project_id == project_id)
    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    sessions = result.scalars().all()
    sites = {}
    if sessions:
        rows = await db.execute(select(SessionSite).where(SessionSite.session_id.in_([s.id for s in sessions])))
        sites = {r.session_id: principal.canon(r.site_id) for r in rows.scalars()}
    visible_projects = await _visible_project_ids(db, principal, [s.project_id for s in sessions])

    return [
        {
            "id": s.id,
            "name": s.name,
            "description": s.description,
            "project_id": s.project_id if s.project_id in visible_projects else None,
            "site_id": sites.get(s.id),
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
async def create_session(data: SessionCreate, db: AsyncSession = Depends(get_db),
                         principal: Principal = Depends(require("ingest"))):
    """Create a new assessment session in a site the caller holds."""
    site = await resolve_new_session_site(db, principal, data.site_id)
    if data.project_id:
        # The project must be visible to the caller and belong to the same site as the session.
        project = await get_visible_project(db, principal, data.project_id)
        psite = await project_site(db, project.id)
        if site is None:
            site = psite
        elif principal.canon(psite) != site:
            raise HTTPException(422, "The project belongs to a different site than this session")
    session = Session(name=data.name, description=data.description, project_id=data.project_id)
    db.add(session)
    await db.flush()
    await assign_session_site(db, session.id, site, principal.user_id)
    await db.commit()
    await db.refresh(session)
    return {"id": session.id, "name": session.name, "status": session.status, "site_id": site}


_DEVICE_FIELDS = ("hostname", "vendor", "model", "firmware_version", "device_type", "purdue_level")


@router.get("/compare")
async def compare_sessions(
    baseline: str = Query(..., description="Session id of the earlier capture"),
    current: str = Query(..., description="Session id of the later capture"),
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require("view")),
):
    """Compare two sessions: devices, communication pairs and findings.

    AUDIT-29: the stock Baseline Drift page listed every device in the database, with a made-up drift
    percentage and a note that no comparison endpoint existed. A difference here means the two captures
    differ, not necessarily that the environment changed.
    """
    from app.models.ics import Device, Connection, Finding

    if baseline == current:
        raise HTTPException(422, "Choose two different sessions")
    sess = {}
    for key, sid in (("baseline", baseline), ("current", current)):
        sess[key] = await get_visible_session(db, principal, sid)      # 404 when absent or out of scope

    async def load(model, sid):
        return (await db.execute(select(model).where(model.session_id == sid))).scalars().all()

    out = {k: {"id": v.id, "name": v.name, "created_at": v.created_at.isoformat() if v.created_at else None}
           for k, v in sess.items()}
    dev = {k: {d.ip_address: d for d in await load(Device, sid)} for k, sid in (("baseline", baseline), ("current", current))}
    b, c = dev["baseline"], dev["current"]

    def brief(d):
        return {"ip_address": d.ip_address, "hostname": d.hostname, "vendor": d.vendor, "model": d.model,
                "device_type": d.device_type, "purdue_level": d.purdue_level, "protocols": sorted(d.protocols or [])}

    changed = []
    for ip in sorted(set(b) & set(c)):
        diffs = []
        for f in _DEVICE_FIELDS:
            if (getattr(b[ip], f) or None) != (getattr(c[ip], f) or None):
                diffs.append({"field": f, "before": getattr(b[ip], f), "after": getattr(c[ip], f)})
        if set(b[ip].protocols or []) != set(c[ip].protocols or []):
            diffs.append({"field": "protocols", "before": sorted(b[ip].protocols or []), "after": sorted(c[ip].protocols or [])})
        if diffs:
            changed.append({"ip_address": ip, "changes": diffs})
    out["devices"] = {
        "added": [brief(c[ip]) for ip in sorted(set(c) - set(b))],
        "removed": [brief(b[ip]) for ip in sorted(set(b) - set(c))],
        "changed": changed,
        "unchanged": len(set(b) & set(c)) - len(changed),
    }

    def pairs(rows):
        return {(r.src_ip, r.dst_ip, r.protocol or "unclassified") for r in rows}

    cb, cc = pairs(await load(Connection, baseline)), pairs(await load(Connection, current))
    fmt = lambda s: [{"src_ip": a, "dst_ip": d, "protocol": p} for a, d, p in sorted(s)]
    out["connections"] = {"added": fmt(cc - cb), "removed": fmt(cb - cc), "unchanged": len(cb & cc)}

    def fkey(f):
        return (f.finding_type, f.title)

    fb = {fkey(f): f for f in await load(Finding, baseline)}
    fc = {fkey(f): f for f in await load(Finding, current)}
    brief_f = lambda f: {"finding_type": f.finding_type, "severity": f.severity, "title": f.title, "status": f.status}
    out["findings"] = {"new": [brief_f(fc[k]) for k in sorted(set(fc) - set(fb))],
                       "not_observed": [brief_f(fb[k]) for k in sorted(set(fb) - set(fc))],
                       "unchanged": len(set(fb) & set(fc))}
    out["note"] = ("Differences reflect what each capture contained. A device or flow absent from a capture may simply "
                   "not have transmitted during it.")
    return out


@router.get("/{session_id}")
async def get_session(session_id: str, db: AsyncSession = Depends(get_db),
                      principal: Principal = Depends(require("view"))):
    """Get session details with summary stats."""
    session = await get_visible_session(db, principal, session_id)
    visible_projects = await _visible_project_ids(db, principal, [session.project_id])

    return {
        "id": session.id,
        "site_id": principal.canon(await session_site(db, session)),
        "project_id": session.project_id if session.project_id in visible_projects else None,
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
async def delete_session(session_id: str, db: AsyncSession = Depends(get_db),
                         principal: Principal = Depends(require("admin"))):
    """Delete a session and all associated data (administrators only)."""
    session = await get_visible_session(db, principal, session_id)
    link = await db.get(SessionSite, session.id)
    if link is not None:
        await db.delete(link)
    await db.delete(session)
    await db.commit()
    return {"message": f"Session {session_id} deleted"}


@router.put("/{session_id}/site")
async def set_session_site(session_id: str, data: SiteAssign, db: AsyncSession = Depends(get_db),
                           principal: Principal = Depends(require("admin"))):
    """Assign (or clear) the site a session belongs to. Until assigned, only administrators see it."""
    session = await get_visible_session(db, principal, session_id)
    site = None
    if data.site_id is not None:
        site = await resolve_new_session_site(db, principal, data.site_id)
    await assign_session_site(db, session.id, site, principal.user_id)
    await db.commit()
    return {"id": session.id, "site_id": site}


# ─── Projects ──────────────────────────────────────────


@router.get("/projects/list")
async def list_projects(
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require("view")),
):
    """List the projects of the caller's sites (administrators: all, including unassigned ones)."""
    query = select(Project).order_by(Project.created_at.desc()).offset(offset).limit(limit)
    if not principal.all_sites:
        sites = principal.expanded_sites()
        query = query.where(Project.id.in_(select(ProjectSite.project_id).where(ProjectSite.site_id.in_(sites))))
    result = await db.execute(query)
    projects = result.scalars().all()
    links = {}
    if projects:
        rows = await db.execute(select(ProjectSite).where(ProjectSite.project_id.in_([p.id for p in projects])))
        links = {r.project_id: principal.canon(r.site_id) for r in rows.scalars()}
    return [
        {
            "id": p.id,
            "site_id": links.get(p.id),
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
async def create_project(data: ProjectCreate, db: AsyncSession = Depends(get_db),
                         principal: Principal = Depends(require("ingest"))):
    """Create a new project in a site the caller holds (an administrator may leave it unassigned)."""
    site = await resolve_new_session_site(db, principal, data.site_id)
    project = Project(
        name=data.name,
        client_name=data.client_name,
        assessor_name=data.assessor_name,
        description=data.description,
    )
    db.add(project)
    await db.flush()
    await assign_project_site(db, project.id, site, principal.user_id)
    await db.commit()
    await db.refresh(project)
    return {"id": project.id, "name": project.name, "site_id": site}


@router.put("/projects/{project_id}/site")
async def set_project_site(project_id: str, data: SiteAssign, db: AsyncSession = Depends(get_db),
                           principal: Principal = Depends(require("admin"))):
    """Assign (or clear) a project's site. Sessions already in the project keep their own site."""
    project = await get_visible_project(db, principal, project_id)
    site = None
    if data.site_id is not None:
        site = await resolve_new_session_site(db, principal, data.site_id)
    await assign_project_site(db, project.id, site, principal.user_id)
    await db.commit()
    return {"id": project.id, "site_id": site}

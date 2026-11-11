"""Site administration: the registry, who holds which role at which site, and which Sensors/data sources a
site has been associated with.

- Platform Administrators manage every site and the registry itself (create, disable, retire, aliases, team
  profiles, Site Administrator assignments).
- A Site Administrator manages only the sites where that role is held: description, role assignments up to
  Security Analyst/OT Engineer level, source associations and the access review.
Creating a site, associating a source or applying a team profile never enables a Sensor or opens a network.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth import summary
from app.core.authz import Principal, get_user_principal, require
from app.core.database import get_db
from app.models.sites import Site, SiteSource
from app.services import sites as svc
from app.services.sessions import audit
from sqlalchemy import select

router = APIRouter(prefix="/sites", tags=["sites"])


class SiteCreate(BaseModel):
    id: str = Field(..., max_length=42)
    name: str = Field(..., max_length=120)
    description: str = Field(default="", max_length=500)
    template: str = "site"
    aliases: list[str] = []


class SitePatch(BaseModel):
    name: Optional[str] = Field(default=None, max_length=120)
    description: Optional[str] = Field(default=None, max_length=500)


class StatusChange(BaseModel):
    status: str


class AliasAdd(BaseModel):
    alias: str = Field(..., max_length=64)
    note: str = Field(default="", max_length=255)


class AssignmentAdd(BaseModel):
    subject_type: str                 # user | group
    subject: str = Field(..., max_length=255)
    role: str


class SourceAdd(BaseModel):
    source_type: str                  # sensor | datasource
    source_id: str = Field(..., max_length=120)
    note: str = Field(default="", max_length=255)


class SourceEnable(BaseModel):
    enabled: bool


class SensorLocationSet(BaseModel):
    location: str = Field(default="", max_length=120)


async def _managed(db: AsyncSession, principal: Principal, site_id: str) -> Site:
    """The site, if the caller administers it. A site the caller may not administer is reported as absent."""
    site = await svc.get_site(db, site_id)
    if not (principal.is_platform or principal.can_at("site_admin", site.id)):
        raise HTTPException(404, "Site not found")
    return site


@router.get("/mine")
async def my_sites(principal: Principal = Depends(get_user_principal)):
    """The caller's sites, roles and permissions (what the site selector offers)."""
    s = summary(principal)
    return {"sites": s["site_list"], "all_sites": s["all_sites"], "selected": principal.scope_site}


@router.get("/templates")
async def templates(principal: Principal = Depends(require("site_admin"))):
    return {k: {"label": v["label"], "description": v["description"], "roles": v["roles"],
                "teams": {svc.team_group(t): r for t, r in v["teams"].items()}} for k, v in svc.TEMPLATES.items()}


@router.get("")
async def list_sites(db: AsyncSession = Depends(get_db), principal: Principal = Depends(require("site_admin"))):
    if principal.is_platform:
        return await svc.list_sites(db, include_all=True)
    return await svc.list_sites(db, visible=principal.sites)


@router.post("", status_code=201)
async def create_site(data: SiteCreate, db: AsyncSession = Depends(get_db),
                      principal: Principal = Depends(require("admin"))):
    site = await svc.create_site(db, principal.username, site_id=data.id, name=data.name,
                                 description=data.description, template=data.template, aliases=data.aliases)
    await audit(db, "site_created", "ok", principal.username, principal.user_id, "site %s" % site.id)
    return (await svc.list_sites(db, visible=[site.id]))[0]


@router.get("/{site_id}")
async def get_site(site_id: str, db: AsyncSession = Depends(get_db),
                   principal: Principal = Depends(require("site_admin"))):
    site = await _managed(db, principal, site_id)
    out = (await svc.list_sites(db, visible=[site.id]))[0]
    out["status_summary"] = await svc.site_status(db, site)
    return out


@router.patch("/{site_id}")
async def update_site(site_id: str, data: SitePatch, db: AsyncSession = Depends(get_db),
                      principal: Principal = Depends(require("site_admin"))):
    site = await _managed(db, principal, site_id)
    if site.status == "retired":
        raise HTTPException(409, "A retired site cannot be edited")
    await svc.update_site(db, site, name=data.name, description=data.description)
    await audit(db, "site_updated", "ok", principal.username, principal.user_id, "site %s" % site.id)
    return (await svc.list_sites(db, visible=[site.id]))[0]


@router.post("/{site_id}/status")
async def change_status(site_id: str, data: StatusChange, db: AsyncSession = Depends(get_db),
                        principal: Principal = Depends(require("admin"))):
    """Disable (reversible; access ends, data is kept), re-enable (`active`) or retire (final) a site."""
    site = await svc.get_site(db, site_id)
    await svc.set_status(db, site, data.status)
    await audit(db, "site_status", "ok", principal.username, principal.user_id, "site %s -> %s" % (site.id, site.status))
    return (await svc.list_sites(db, visible=[site.id]))[0]


@router.post("/{site_id}/aliases", status_code=201)
async def add_alias(site_id: str, data: AliasAdd, db: AsyncSession = Depends(get_db),
                    principal: Principal = Depends(require("admin"))):
    site = await svc.get_site(db, site_id)
    await svc.add_alias(db, site, data.alias, principal.username, data.note)
    await audit(db, "site_alias", "ok", principal.username, principal.user_id, "%s -> %s" % (data.alias, site.id))
    return (await svc.list_sites(db, visible=[site.id]))[0]


@router.get("/{site_id}/status")
async def status(site_id: str, db: AsyncSession = Depends(get_db),
                 principal: Principal = Depends(require("site_admin"))):
    return await svc.site_status(db, await _managed(db, principal, site_id))


@router.get("/{site_id}/access")
async def access_review(site_id: str, db: AsyncSession = Depends(get_db),
                        principal: Principal = Depends(require("site_admin"))):
    """Review of everything that grants access to the site."""
    return await svc.access_review(db, await _managed(db, principal, site_id))


@router.post("/{site_id}/assignments", status_code=201)
async def add_assignment(site_id: str, data: AssignmentAdd, db: AsyncSession = Depends(get_db),
                         principal: Principal = Depends(require("site_admin"))):
    site = await _managed(db, principal, site_id)
    b = await svc.add_binding(db, principal, site, data.subject_type, data.subject, data.role)
    await audit(db, "site_assignment", "ok", principal.username, principal.user_id,
                "site %s +%s %s=%s" % (site.id, data.role, data.subject_type, data.subject[:60]))
    return {"id": b.id, "site": site.id, "role": b.role}


@router.delete("/{site_id}/assignments/{binding_id}")
async def remove_assignment(site_id: str, binding_id: str, db: AsyncSession = Depends(get_db),
                            principal: Principal = Depends(require("site_admin"))):
    site = await _managed(db, principal, site_id)
    b = await svc.remove_binding(db, principal, site, binding_id)
    await audit(db, "site_assignment", "ok", principal.username, principal.user_id,
                "site %s -%s %s" % (site.id, b.role, b.subject_type))
    return {"removed": binding_id}


@router.post("/{site_id}/team-profiles")
async def apply_team_profiles(site_id: str, db: AsyncSession = Depends(get_db),
                              principal: Principal = Depends(require("admin"))):
    """Record the template's suggested team -> role assignments as explicit, reviewable assignments."""
    site = await svc.get_site(db, site_id)
    out = await svc.apply_team_profiles(db, principal, site)
    await audit(db, "site_team_profiles", "ok", principal.username, principal.user_id, "site %s" % site.id)
    return {"site": site.id, "applied": out}


@router.get("/{site_id}/sources")
async def list_sources(site_id: str, db: AsyncSession = Depends(get_db),
                       principal: Principal = Depends(require("site_admin"))):
    site = await _managed(db, principal, site_id)
    rows = (await db.execute(select(SiteSource).where(SiteSource.site_id == site.id))).scalars().all()
    return [svc.source_out(r) for r in rows]


@router.post("/{site_id}/sources", status_code=201)
async def add_source(site_id: str, data: SourceAdd, db: AsyncSession = Depends(get_db),
                     principal: Principal = Depends(require("site_admin"))):
    """Associate an approved Sensor or data source with the site. It is NOT enabled by this call."""
    site = await _managed(db, principal, site_id)
    row = await svc.add_source(db, principal, site, data.source_type, data.source_id, data.note)
    await audit(db, "site_source", "ok", principal.username, principal.user_id,
                "site %s associated %s %s" % (site.id, data.source_type, data.source_id[:60]))
    return svc.source_out(row)


@router.patch("/{site_id}/sources/{source_pk}")
async def set_source(site_id: str, source_pk: str, data: SourceEnable, db: AsyncSession = Depends(get_db),
                     principal: Principal = Depends(require("site_admin"))):
    site = await _managed(db, principal, site_id)
    row = await svc.set_source_enabled(db, principal, site, source_pk, data.enabled)
    await audit(db, "site_source", "ok", principal.username, principal.user_id,
                "site %s source %s enabled=%s" % (site.id, row.source_id[:60], row.enabled))
    return svc.source_out(row)


@router.put("/{site_id}/sensors/{sensor_id}/location")
async def set_sensor_location(site_id: str, sensor_id: str, data: SensorLocationSet,
                              db: AsyncSession = Depends(get_db),
                              principal: Principal = Depends(require("site_admin"))):
    """Label where a Sensor is (for example Paint line, Fab). Display only; a blank value clears it."""
    site = await _managed(db, principal, site_id)
    value = await svc.set_sensor_location(db, principal, site, sensor_id, data.location)
    await audit(db, "site_sensor_location", "ok", principal.username, principal.user_id,
                "site %s sensor %s location %s" % (site.id, sensor_id[:60], "set" if value else "cleared"))
    return {"site": site.id, "sensor": sensor_id, "location": value}


@router.delete("/{site_id}/sources/{source_pk}")
async def remove_source(site_id: str, source_pk: str, db: AsyncSession = Depends(get_db),
                        principal: Principal = Depends(require("site_admin"))):
    site = await _managed(db, principal, site_id)
    await svc.remove_source(db, site, source_pk)
    await audit(db, "site_source", "ok", principal.username, principal.user_id, "site %s source removed" % site.id)
    return {"removed": source_pk}

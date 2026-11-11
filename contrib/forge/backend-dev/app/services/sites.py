"""Site registry, per-site role resolution and site administration.

The registry (`sites`, `site_aliases`) is the one place a site is defined. Authorization always uses the
canonical site id; an alias (for example the Sensor/ingest identity `legacy-example-lab`) only translates an identifier
to its site. Roles at a site come from explicit bindings (`site_bindings`, per user or per authentik group)
and from the `FORGE-GW-<site>-<Role>` group convention. Membership of a team group (`FORGE-Team-*`) grants
nothing by itself; a team's suggested role is applied only by an explicit administrator action.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Iterable, Optional

from fastapi import HTTPException
from sqlalchemy import and_, delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.authz import (ADMINISTRATOR, HEALTH_VIEWER, OT_ENGINEER, PERMISSIONS, REPORT_VIEWER, ROLE_LABELS,
                            ROLE_RANK, ROLES, SECURITY_ANALYST, SITE_ADMIN, SITE_ROLES, VIEWER, Principal,
                            normalize_role, utcnow, valid_site)
from app.core.config import settings
from app.models.auth import ProjectSite, SessionSite, UserSite
from app.models.ics import Device, Finding, Project, Report, Session
from app.models.sites import SensorLocation, Site, SiteAlias, SiteBinding, SiteSource
from app.models.user import User

logger = logging.getLogger("gridwolf.sites")

SITE_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,40}[a-z0-9]$")
RESERVED_IDS = {"all", "overview", "none", "mine", "platform", "admin", "new"}
# Name of the session the live feed writes (forge_live.ingest.SESSION_PREFIX). Used only to give the
# pre-existing session its explicit site row once; authorization never reads names.
LIVE_SESSION_PREFIX = "FORGE live ICS flows - "
STATUSES = ("active", "disabled", "retired")

# authentik group suffix <-> role. `FORGE-GW-<site>-<suffix>`; the suffix is the text after the last hyphen.
ROLE_SUFFIX = {"SiteAdmin": SITE_ADMIN, "Analyst": SECURITY_ANALYST, "OTEngineer": OT_ENGINEER, "Viewer": VIEWER,
               "ReportViewer": REPORT_VIEWER, "HealthViewer": HEALTH_VIEWER}
SUFFIX_OF = {v: k for k, v in ROLE_SUFFIX.items()}

# Teams are organisational groups. They grant nothing. A template may *suggest* the role a team usually holds
# at a site; an administrator applies the suggestion explicitly and the result is recorded as ordinary
# bindings that can be reviewed and removed.
TEAMS = {"Desktop": HEALTH_VIEWER, "Networking": VIEWER, "Datacenter": HEALTH_VIEWER, "Security": SECURITY_ANALYST,
         "Engineering": OT_ENGINEER, "PlantManagement": REPORT_VIEWER, "DigitalManagement": REPORT_VIEWER}
TEMPLATES = {
    "lab": {"label": "Lab environment",
            "description": "Development or reference lab. Same roles and group convention as a production site.",
            "roles": list(SITE_ROLES), "teams": TEAMS},
    "site": {"label": "Operational site",
             "description": "A plant or facility. Roles and group convention are identical; only the label differs.",
             "roles": list(SITE_ROLES), "teams": TEAMS},
}

# Built-in registration of the example lab. The source identity `legacy-example-lab` (the Sensor/ingest
# identifier and historical session name) is kept as an alias; other sites are registered separately.
LAB_SITE = {"id": "example-lab", "name": "Example Lab", "template": "lab", "aliases": ["legacy-example-lab"],
            "description": "Example development and reference lab (source identity legacy-example-lab)."}


def group_name(site: str, role: str) -> str:
    return "%s%s-%s" % (settings.GROUP_PREFIX, site, SUFFIX_OF[role])


def team_group(team: str) -> str:
    return settings.TEAM_GROUP_PREFIX + team


def parse_group(name: str):
    """('platform', None) for the platform group, (site, role) for a site entitlement group, else None."""
    if not isinstance(name, str) or not name.startswith(settings.GROUP_PREFIX):
        return None
    rest = name[len(settings.GROUP_PREFIX):]
    if rest == settings.PLATFORM_GROUP[len(settings.GROUP_PREFIX):]:
        return ("platform", None)
    site, _, suffix = rest.rpartition("-")
    role = ROLE_SUFFIX.get(suffix)
    return (site, role) if role and valid_site(site) else None


def keep_groups(groups: Iterable[str], limit: int = 50) -> list[str]:
    """The groups worth storing with a session: the FORGE entitlement and team groups first."""
    groups = [g for g in groups if isinstance(g, str)]
    forge = [g for g in groups if g.startswith(settings.GROUP_PREFIX) or g.startswith(settings.TEAM_GROUP_PREFIX)]
    return (forge + [g for g in groups if g not in forge])[:limit]


# ---- registry reads -----------------------------------------------------------------------------------

async def registry_maps(db: AsyncSession):
    """(active site ids, alias -> canonical id for every site, id -> display name)."""
    sites = (await db.execute(select(Site))).scalars().all()
    aliases = {a.alias: a.site_id for a in (await db.execute(select(SiteAlias))).scalars().all()}
    aliases.update({s.id: s.id for s in sites})
    return (frozenset(s.id for s in sites if s.status == "active"), aliases, {s.id: s.name for s in sites})


@dataclass(frozen=True)
class Access:
    platform: bool
    label: Optional[str]
    sites: frozenset
    site_roles: dict
    aliases: dict
    active_sites: frozenset
    site_names: dict


async def resolve_access(db: AsyncSession, user, auth_method: str, groups: list) -> Access:
    """Rights of a user, per site. Local accounts are Platform Administrators through `users.role`; directory
    accounts through the platform group. Everything else is a per-site role from a binding or a convention
    group at an active, registered site."""
    active, aliases, names = await registry_maps(db)
    groups = [g for g in groups if isinstance(g, str)]
    platform = settings.PLATFORM_GROUP in groups or (auth_method == "local" and normalize_role(user.role) == ADMINISTRATOR)
    roles: dict[str, set] = {}
    for g in groups:
        parsed = parse_group(g)
        if parsed and parsed[0] != "platform" and parsed[0] in active:
            roles.setdefault(parsed[0], set()).add(parsed[1])
    cond = [and_(SiteBinding.subject_type == "user", SiteBinding.subject == user.id)]
    if groups:
        cond.append(and_(SiteBinding.subject_type == "group", SiteBinding.subject.in_(groups)))
    rows = (await db.execute(select(SiteBinding).where(SiteBinding.site_id.in_(active), or_(*cond)))).scalars().all()
    for b in rows:
        if b.role in SITE_ROLES:
            roles.setdefault(b.site_id, set()).add(b.role)
    site_roles = {s: frozenset(r) for s, r in roles.items()}
    top = None
    if platform:
        top = ADMINISTRATOR
    elif site_roles:
        top = min((r for rs in site_roles.values() for r in rs), key=lambda r: ROLE_RANK[r])
    sites = active if platform else frozenset(site_roles)
    return Access(platform=platform, label=top, sites=sites, site_roles=site_roles, aliases=aliases,
                  active_sites=active, site_names=names)


def role_label(role: Optional[str]) -> str:
    return ROLE_LABELS.get(role or "", "No role")


# ---- site CRUD ---------------------------------------------------------------------------------------

def _site_out(s: Site, aliases: Iterable[str] = ()) -> dict:
    return {"id": s.id, "name": s.name, "description": s.description, "status": s.status, "template": s.template,
            "aliases": sorted(aliases), "created_by": s.created_by,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "retired_at": s.retired_at.isoformat() if s.retired_at else None}


async def get_site(db: AsyncSession, site_id: str, *, canonical_only: bool = False) -> Site:
    site = await db.get(Site, site_id) if valid_site(site_id) else None
    if site is None and not canonical_only and valid_site(site_id):
        alias = await db.get(SiteAlias, site_id)
        site = await db.get(Site, alias.site_id) if alias else None
    if site is None:
        raise HTTPException(404, "Site not found")
    return site


async def list_sites(db: AsyncSession, visible: Optional[Iterable[str]] = None, include_all: bool = False) -> list[dict]:
    sites = (await db.execute(select(Site).order_by(Site.name))).scalars().all()
    aliases: dict[str, list] = {}
    for a in (await db.execute(select(SiteAlias))).scalars().all():
        aliases.setdefault(a.site_id, []).append(a.alias)
    allowed = None if include_all else set(visible or ())
    return [_site_out(s, aliases.get(s.id, ())) for s in sites if allowed is None or s.id in allowed]


async def create_site(db: AsyncSession, actor: str, *, site_id: str, name: str, description: str = "",
                      template: str = "site", aliases: Iterable[str] = ()) -> Site:
    site_id = (site_id or "").strip().lower()
    if not SITE_ID_RE.match(site_id) or site_id in RESERVED_IDS:
        raise HTTPException(422, "Site id must be 3-42 characters: lowercase letters, digits and hyphens")
    if template not in TEMPLATES:
        raise HTTPException(422, "template must be one of: " + ", ".join(TEMPLATES))
    name = (name or "").strip()
    if not name or len(name) > 120:
        raise HTTPException(422, "A site name of 1-120 characters is required")
    aliases = sorted({a.strip() for a in aliases if a and a.strip()})
    for a in aliases:
        if not valid_site(a) or a in RESERVED_IDS:
            raise HTTPException(422, "Invalid alias: %r" % a[:64])
    taken = await registry_maps(db)
    for ident in [site_id, *aliases]:
        if ident in taken[1]:
            raise HTTPException(409, "Identifier already registered: %s" % ident)
    site = Site(id=site_id, name=name, description=(description or "")[:500], status="active", template=template,
                created_by=actor)
    db.add(site)
    await db.flush()
    for a in aliases:
        db.add(SiteAlias(alias=a, site_id=site_id, kind="source", created_by=actor))
    await db.commit()
    return site


async def update_site(db: AsyncSession, site: Site, *, name: Optional[str], description: Optional[str]) -> Site:
    if name is not None:
        name = name.strip()
        if not name or len(name) > 120:
            raise HTTPException(422, "A site name of 1-120 characters is required")
        site.name = name
    if description is not None:
        site.description = description[:500]
    site.updated_at = utcnow()
    await db.commit()
    return site


async def set_status(db: AsyncSession, site: Site, status: str) -> Site:
    if status not in STATUSES:
        raise HTTPException(422, "status must be one of: " + ", ".join(STATUSES))
    if site.status == "retired" and status != "retired":
        raise HTTPException(409, "A retired site cannot be reactivated; register a new site")
    site.status = status
    site.updated_at = utcnow()
    if status == "retired":
        site.retired_at = utcnow()
        # Retiring ends every association: nothing from a retired site is treated as an enabled source.
        for src in (await db.execute(select(SiteSource).where(SiteSource.site_id == site.id))).scalars().all():
            src.enabled = False
    await db.commit()
    return site


async def add_alias(db: AsyncSession, site: Site, alias: str, actor: str, note: str = "") -> None:
    if not valid_site(alias) or alias in RESERVED_IDS:
        raise HTTPException(422, "Invalid alias")
    if alias in (await registry_maps(db))[1]:
        raise HTTPException(409, "Identifier already registered")
    db.add(SiteAlias(alias=alias, site_id=site.id, kind="source", note=note[:255], created_by=actor))
    await db.commit()


# ---- bindings ----------------------------------------------------------------------------------------

def _grantable(principal: Principal, site: str, role: str) -> None:
    if role not in SITE_ROLES:
        raise HTTPException(422, "role must be one of: " + ", ".join(SITE_ROLES))
    if principal.is_platform:
        return
    if not principal.can_at("site_admin", site):
        raise HTTPException(403, "Site administration of this site is required")
    if role == SITE_ADMIN:
        raise HTTPException(403, "Only a Platform Administrator can assign Site Administrators")


async def add_binding(db: AsyncSession, principal: Principal, site: Site, subject_type: str, subject: str,
                      role: str) -> SiteBinding:
    _grantable(principal, site.id, role)
    if subject_type not in ("user", "group"):
        raise HTTPException(422, "subject_type must be user or group")
    subject = (subject or "").strip()
    if not subject or len(subject) > 255:
        raise HTTPException(422, "subject is required")
    if site.status == "retired":
        raise HTTPException(409, "A retired site takes no new assignments")
    if subject_type == "user":
        user = await db.get(User, subject) or (await db.execute(select(User).where(User.username == subject))
                                              ).scalar_one_or_none()
        if user is None:
            raise HTTPException(404, "User not found")
        subject = user.id
    existing = (await db.execute(select(SiteBinding).where(
        SiteBinding.site_id == site.id, SiteBinding.subject_type == subject_type, SiteBinding.subject == subject,
        SiteBinding.role == role))).scalar_one_or_none()
    if existing:
        return existing
    b = SiteBinding(site_id=site.id, subject_type=subject_type, subject=subject, role=role, created_by=principal.username)
    db.add(b)
    await db.commit()
    return b


async def remove_binding(db: AsyncSession, principal: Principal, site: Site, binding_id: str) -> SiteBinding:
    b = await db.get(SiteBinding, binding_id)
    if b is None or b.site_id != site.id:
        raise HTTPException(404, "Assignment not found")
    _grantable(principal, site.id, b.role)
    if (b.subject_type == "user" and b.subject == principal.user_id and b.role == SITE_ADMIN
            and not principal.is_platform):
        raise HTTPException(422, "You cannot remove your own site administration")
    await db.delete(b)
    await db.commit()
    return b


async def apply_team_profiles(db: AsyncSession, principal: Principal, site: Site) -> list[dict]:
    """Record the template's suggested team -> role assignments as explicit bindings (admin action only)."""
    if not principal.is_platform:
        raise HTTPException(403, "Platform Administrator required")
    out = []
    for team, role in TEMPLATES[site.template]["teams"].items():
        b = await add_binding(db, principal, site, "group", team_group(team), role)
        out.append({"id": b.id, "group": b.subject, "role": b.role})
    return out


async def user_bindings(db: AsyncSession, user_id: str) -> dict:
    rows = (await db.execute(select(SiteBinding).where(SiteBinding.subject_type == "user",
                                                       SiteBinding.subject == user_id))).scalars().all()
    out: dict[str, list] = {}
    for b in rows:
        out.setdefault(b.site_id, []).append(b.role)
    return {s: sorted(r) for s, r in out.items()}


async def set_user_site_role(db: AsyncSession, user_id: str, sites: Iterable[str], role: str, actor: str) -> list[str]:
    """Hold exactly `role` at exactly `sites` for the user (replacing that user's other bindings)."""
    _, aliases, _ = await registry_maps(db)
    wanted = set()
    for s in sites:
        if not valid_site(s) or aliases.get(s) is None:
            raise HTTPException(422, "Unknown site: %r" % s[:64])
        wanted.add(aliases[s])
    await db.execute(delete(SiteBinding).where(SiteBinding.subject_type == "user", SiteBinding.subject == user_id))
    for s in sorted(wanted):
        db.add(SiteBinding(site_id=s, subject_type="user", subject=user_id, role=role, created_by=actor))
    await db.commit()
    return sorted(wanted)


# ---- sources -----------------------------------------------------------------------------------------

async def add_source(db: AsyncSession, principal: Principal, site: Site, source_type: str, source_id: str,
                     note: str = "") -> SiteSource:
    if source_type not in ("sensor", "datasource"):
        raise HTTPException(422, "source_type must be sensor or datasource")
    source_id = (source_id or "").strip()
    if not valid_site(source_id) and not re.match(r"^[A-Za-z0-9][A-Za-z0-9_. :/-]{0,119}$", source_id):
        raise HTTPException(422, "Invalid source id")
    if site.status == "retired":
        raise HTTPException(409, "A retired site takes no new associations")
    row = (await db.execute(select(SiteSource).where(SiteSource.site_id == site.id, SiteSource.source_type == source_type,
                                                     SiteSource.source_id == source_id))).scalar_one_or_none()
    if row:
        return row
    row = SiteSource(site_id=site.id, source_type=source_type, source_id=source_id, note=note[:255], enabled=False,
                     approved_by=principal.username)
    db.add(row)                          # associated but NOT enabled: enabling is its own explicit action
    await db.commit()
    return row


async def set_source_enabled(db: AsyncSession, principal: Principal, site: Site, source_pk: str, enabled: bool) -> SiteSource:
    row = await db.get(SiteSource, source_pk)
    if row is None or row.site_id != site.id:
        raise HTTPException(404, "Source not found")
    if enabled and site.status != "active":
        raise HTTPException(409, "Only an active site can enable a source")
    row.enabled = enabled
    row.enabled_by = principal.username if enabled else None
    row.enabled_at = utcnow() if enabled else None
    await db.commit()
    return row


async def remove_source(db: AsyncSession, site: Site, source_pk: str) -> None:
    row = await db.get(SiteSource, source_pk)
    if row is None or row.site_id != site.id:
        raise HTTPException(404, "Source not found")
    await db.delete(row)
    await db.commit()


SENSOR_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$")


async def sensor_locations(db: AsyncSession, site_id: Optional[str] = None) -> dict:
    """{(canonical site id, sensor id): location} for one site or all sites."""
    q = select(SensorLocation)
    if site_id:
        q = q.where(SensorLocation.site_id == site_id)
    return {(r.site_id, r.sensor_id): r.location for r in (await db.execute(q)).scalars()}


async def set_sensor_location(db: AsyncSession, principal: Principal, site: Site, sensor_id: str,
                              location: str) -> str:
    """Set (or, when blank, clear) the location label of a Sensor at a site. Returns the stored label."""
    if not SENSOR_ID_RE.match(sensor_id or ""):
        raise HTTPException(422, "Invalid Sensor id")
    if site.status == "retired":
        raise HTTPException(409, "A retired site cannot be edited")
    text = " ".join((location or "").split())
    if len(text) > 120 or not text.isprintable():
        raise HTTPException(422, "Location must be printable text of at most 120 characters")
    row = (await db.execute(select(SensorLocation).where(SensorLocation.site_id == site.id,
                                                        SensorLocation.sensor_id == sensor_id))).scalar_one_or_none()
    if not text:
        if row:
            await db.delete(row)
            await db.commit()
        return ""
    if row is None:
        db.add(SensorLocation(site_id=site.id, sensor_id=sensor_id, location=text, updated_by=principal.username))
    else:
        row.location, row.updated_by, row.updated_at = text, principal.username, utcnow()
    await db.commit()
    return text


def source_out(r: SiteSource) -> dict:
    return {"id": r.id, "type": r.source_type, "source_id": r.source_id, "note": r.note, "enabled": bool(r.enabled),
            "approved_by": r.approved_by, "approved_at": r.approved_at.isoformat() if r.approved_at else None,
            "enabled_by": r.enabled_by, "enabled_at": r.enabled_at.isoformat() if r.enabled_at else None}


# ---- status and review -------------------------------------------------------------------------------

async def site_identifiers(db: AsyncSession, site_id: str) -> list[str]:
    aliases = (await db.execute(select(SiteAlias.alias).where(SiteAlias.site_id == site_id))).scalars().all()
    return [site_id, *aliases]


async def site_status(db: AsyncSession, site: Site) -> dict:
    ids = await site_identifiers(db, site.id)
    sess_ids = select(SessionSite.session_id).where(SessionSite.site_id.in_(ids))
    sessions = (await db.execute(select(func.count()).select_from(Session).where(Session.id.in_(sess_ids)))).scalar_one()
    last = (await db.execute(select(func.max(Session.created_at)).where(Session.id.in_(sess_ids)))).scalar_one()
    devices = (await db.execute(select(func.count()).select_from(Device).where(Device.session_id.in_(sess_ids)))).scalar_one()
    findings = (await db.execute(select(func.count()).select_from(Finding).where(Finding.session_id.in_(sess_ids)))).scalar_one()
    sources = (await db.execute(select(SiteSource).where(SiteSource.site_id == site.id))).scalars().all()
    bindings = (await db.execute(select(func.count()).select_from(SiteBinding).where(SiteBinding.site_id == site.id))).scalar_one()
    return {"site": site.id, "status": site.status, "sessions": sessions, "devices": devices, "findings": findings,
            "last_session_at": last.isoformat() if last else None,
            "sensors_associated": sum(1 for s in sources if s.source_type == "sensor"),
            "sources_enabled": sum(1 for s in sources if s.enabled), "assignments": bindings}


async def access_review(db: AsyncSession, site: Site) -> dict:
    """Everything that can give someone access to the site: bindings, the group convention and the users they
    resolve to (locally registered accounts; directory users appear after their first sign-in)."""
    binds = (await db.execute(select(SiteBinding).where(SiteBinding.site_id == site.id)
                              .order_by(SiteBinding.role, SiteBinding.subject_type))).scalars().all()
    users = {u.id: u for u in (await db.execute(select(User))).scalars().all()}
    out = []
    for b in binds:
        label = b.subject
        if b.subject_type == "user":
            u = users.get(b.subject)
            label = u.username if u else b.subject + " (account removed)"
        out.append({"id": b.id, "subject_type": b.subject_type, "subject": label, "role": b.role,
                    "role_label": role_label(b.role), "created_by": b.created_by,
                    "created_at": b.created_at.isoformat() if b.created_at else None})
    platform_users = sorted(u.username for u in users.values() if normalize_role(u.role) == ADMINISTRATOR and u.is_active)
    return {"site": site.id, "assignments": out,
            "convention_groups": {role_label(r): group_name(site.id, r) for r in SITE_ROLES},
            "platform_group": settings.PLATFORM_GROUP, "local_platform_administrators": platform_users,
            "team_profiles": {team_group(t): role_label(r) for t, r in TEMPLATES[site.template]["teams"].items()}}


async def my_sites(db: AsyncSession, principal: Principal) -> list[dict]:
    rows = (await db.execute(select(Site).order_by(Site.name))).scalars().all()
    out = []
    for s in rows:
        if s.status != "active":
            continue
        roles = principal.roles_at(s.id)
        if not roles:
            continue
        out.append({"id": s.id, "name": s.name, "status": s.status,
                    "roles": sorted(roles, key=lambda r: ROLE_RANK[r]),
                    "permissions": sorted(frozenset().union(*(PERMISSIONS[r] for r in roles)))})
    return out


# ---- bootstrap ---------------------------------------------------------------------------------------

async def bootstrap(db: AsyncSession) -> None:
    """Idempotent startup reconciliation: register the lab, move identifiers that still use the source id to
    the canonical site, and carry the pre-registry local site grants over as explicit bindings. Registers no
    other site, grants nothing new and enables nothing."""
    if await db.get(Site, LAB_SITE["id"]) is None and await db.get(SiteAlias, LAB_SITE["id"]) is None:
        await create_site(db, "bootstrap", site_id=LAB_SITE["id"], name=LAB_SITE["name"], template=LAB_SITE["template"],
                          description=LAB_SITE["description"], aliases=[a for a in LAB_SITE["aliases"]
                                                                        if await db.get(SiteAlias, a) is None])
        logger.info("registered site %s", LAB_SITE["id"])
    _, aliases, _ = await registry_maps(db)
    # explicit identity for the live telemetry session that used to be tied to its site by name
    lab_name = LIVE_SESSION_PREFIX + "legacy-example-lab"
    live = (await db.execute(select(Session).where(Session.name == lab_name))).scalars().all()
    for sess in live:
        if await db.get(SessionSite, sess.id) is None and aliases.get("legacy-example-lab") == "example-lab":
            db.add(SessionSite(session_id=sess.id, site_id="example-lab", assigned_by="bootstrap"))
    for model in (SessionSite, ProjectSite):
        for row in (await db.execute(select(model).where(model.site_id.in_(list(aliases))))).scalars().all():
            if aliases.get(row.site_id) not in (None, row.site_id):
                row.site_id = aliases[row.site_id]
    # pre-registry local grants: role from users.role, sites from user_sites
    for grant in (await db.execute(select(UserSite))).scalars().all():
        user = await db.get(User, grant.user_id)
        role = normalize_role(user.role) if user else None
        site = aliases.get(grant.site_id)
        if user is None or site is None or role in (None, ADMINISTRATOR):
            continue
        has = (await db.execute(select(SiteBinding.id).where(
            SiteBinding.site_id == site, SiteBinding.subject_type == "user", SiteBinding.subject == user.id,
            SiteBinding.role == role))).first()
        if not has:
            db.add(SiteBinding(site_id=site, subject_type="user", subject=user.id, role=role, created_by="bootstrap"))
    await db.commit()

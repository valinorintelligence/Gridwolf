"""Server-side authorization: roles, permissions, the authenticated Principal and site scoping.

Deny by default:
- every protected route depends on `require(permission, ...)`; a role that is missing or unknown holds nothing;
- roles are held per site (`Principal.site_roles`); a permission is honoured only at the sites where a held
  role grants it, never combined across sites. Only the Platform Administrator is global;
- a non-administrator sees only sessions with an explicit `session_sites` row for a site it holds the
  route's permission at (display names and session names never authorize); an unassigned session is visible
  to Platform Administrators only;
- an unknown, malformed or ungranted site is refused (403 for an explicit site, 404 for an object that is
  outside the caller's scope, so existence is not revealed).
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field, replace
from datetime import datetime, timedelta, timezone
from typing import Iterable, Optional

from fastapi import Depends, HTTPException, Request, WebSocket
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import safe_equal, token_hash

PLATFORM_ADMIN = ADMINISTRATOR = "administrator"      # stored value kept from the single-role releases
SITE_ADMIN, OT_ENGINEER, SECURITY_ANALYST = "site_admin", "ot_engineer", "security_analyst"
VIEWER, REPORT_VIEWER, HEALTH_VIEWER = "viewer", "report_viewer", "health_viewer"
ROLES = (ADMINISTRATOR, SITE_ADMIN, OT_ENGINEER, SECURITY_ANALYST, VIEWER, REPORT_VIEWER, HEALTH_VIEWER)
SITE_ROLES = ROLES[1:]                                    # roles that can be held at a site
ROLE_LABELS = {ADMINISTRATOR: "Platform Administrator", SITE_ADMIN: "Site Administrator",
               OT_ENGINEER: "OT Engineer", SECURITY_ANALYST: "Security Analyst", VIEWER: "Viewer",
               REPORT_VIEWER: "Report Viewer", HEALTH_VIEWER: "Platform Health Viewer"}

# view         read sessions, devices, findings, topology, protocol intelligence and live telemetry in scope
# export       machine-readable exports of in-scope data
# report       generate reports
# report_view  list and download generated reports and read site summary counts (no raw evidence)
# triage       change finding status, advisory disposition; look up CVEs
# ingest       upload captures and create analysis sessions and projects
# health       Sensor and site platform health
# site_admin   manage a site's role assignments and associations (the site's own scope only)
# admin        global administration: users, API keys, signatures, session deletion, site registry
# platform     platform-wide health that spans sites
PERMISSIONS = {
    VIEWER: frozenset({"view", "report_view"}),
    REPORT_VIEWER: frozenset({"report_view"}),
    HEALTH_VIEWER: frozenset({"health"}),
    SECURITY_ANALYST: frozenset({"view", "export", "report", "report_view", "triage", "health"}),
    OT_ENGINEER: frozenset({"view", "export", "report", "report_view", "triage", "ingest", "health"}),
    SITE_ADMIN: frozenset({"view", "export", "report", "report_view", "triage", "ingest", "health", "site_admin"}),
    ADMINISTRATOR: frozenset({"view", "export", "report", "report_view", "triage", "ingest", "health", "site_admin",
                              "admin", "platform"}),
}
ALL_PERMISSIONS = frozenset().union(*PERMISSIONS.values())
# Accounts that predate RBAC carry the role strings "admin"/"analyst". Anything else maps to no role.
LEGACY_ROLES = {"admin": ADMINISTRATOR, "analyst": SECURITY_ANALYST}

# A service credential may hold only these permissions; admin and platform are never grantable to it, and it
# never reaches every site (its sites are listed explicitly).
SERVICE_PERMISSIONS = frozenset({"view", "export", "ingest"})
SERVICE_TOKEN_PREFIX = "gws_"
SERVICE_MAX_DAYS = 90

SITE_COOKIE = "gw_site"          # the selected site; narrows what the server returns, never widens it
SITE_HEADER = "x-gridwolf-site"
SITE_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$")
ROLE_RANK = {r: i for i, r in enumerate(ROLES)}


def normalize_role(value: Optional[str]) -> Optional[str]:
    if value in ROLES:
        return value
    return LEGACY_ROLES.get(value or "")


def valid_site(site: Optional[str]) -> bool:
    return bool(site) and SITE_RE.match(site) is not None


@dataclass(frozen=True)
class Principal:
    user_id: str
    username: str
    email: str
    full_name: str
    role: Optional[str]                              # label: platform role, else the highest site role
    sites: frozenset = field(default_factory=frozenset)         # canonical sites in force for this request
    auth_method: str = "local"
    mfa: bool = False
    session_key: str = ""
    csrf_token: str = ""
    idle_expires_at: Optional[datetime] = None
    absolute_expires_at: Optional[datetime] = None
    kind: str = "user"                               # user | service
    permissions: Optional[frozenset] = None          # set only for a service principal
    is_platform: bool = False                        # Platform Administrator
    site_roles: dict = field(default_factory=dict)   # canonical site -> frozenset of roles held there
    aliases: dict = field(default_factory=dict)      # source/legacy identifier -> canonical site
    active_sites: frozenset = field(default_factory=frozenset)  # every active registered site
    site_names: dict = field(default_factory=dict)
    scope_site: Optional[str] = None                 # the site selected in the UI (None = all authorized)

    @property
    def all_sites(self) -> bool:
        return self.kind == "user" and self.is_platform and self.scope_site is None

    def canon(self, site: Optional[str]) -> Optional[str]:
        return self.aliases.get(site, site) if site else site

    def roles_at(self, site: Optional[str]) -> frozenset:
        site = self.canon(site)
        if self.is_platform and site in self.active_sites:
            return frozenset({ADMINISTRATOR}) | self.site_roles.get(site, frozenset())
        return self.site_roles.get(site, frozenset())

    def sites_with(self, permission: str) -> frozenset:
        if self.kind == "service":
            held = self.sites if permission in (self.permissions or frozenset()) and permission in SERVICE_PERMISSIONS \
                else frozenset()
            return held
        if self.is_platform:
            held = self.active_sites
        else:
            held = frozenset(s for s, rs in self.site_roles.items()
                             if any(permission in PERMISSIONS.get(r, ()) for r in rs))
        return held if self.scope_site is None else held & {self.scope_site}

    def can(self, permission: str) -> bool:
        if self.kind == "service":
            return permission in SERVICE_PERMISSIONS and permission in (self.permissions or frozenset())
        if self.is_platform:
            return permission in PERMISSIONS[ADMINISTRATOR]
        return bool(self.sites_with(permission))

    def can_at(self, permission: str, site: Optional[str]) -> bool:
        return valid_site(site) and self.canon(site) in self.sites_with(permission)

    def with_permission(self, permissions) -> "Principal":
        """The principal as seen by a route that needs one of `permissions`: `sites` becomes the sites where
        any of them is held, so every scoped query below honours the per-site role."""
        held = frozenset().union(*(self.sites_with(p) for p in permissions))
        return replace(self, sites=held)

    def can_see_site(self, site: Optional[str]) -> bool:
        if not valid_site(site):
            return False
        return self.all_sites or self.canon(site) in self.sites

    def expanded_sites(self) -> list:
        """Canonical sites plus the source identifiers that resolve to them (for matching stored rows)."""
        out = {s for s in self.sites if valid_site(s)}
        out |= {a for a, c in self.aliases.items() if c in out}
        return sorted(out)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def aware(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _audit_denied(request: Request, principal: Optional[Principal], permission: str) -> None:
    import logging
    logging.getLogger("gridwolf.authz").warning(
        "denied method=%s path=%s user=%s role=%s need=%s", request.method, request.url.path,
        principal.username if principal else "-", principal.role if principal else "-", permission)


UNSAFE = {"POST", "PUT", "PATCH", "DELETE"}


def _origin_ok(request: Request) -> bool:
    origin = request.headers.get("origin")
    if origin is None:
        return True                      # non-browser client; the CSRF token below still applies
    return origin.rstrip("/") in settings.allowed_origins()


async def principal_from_token(db: AsyncSession, token: str, *, touch: bool = True) -> Principal:
    """Validate an opaque session token against the server-side store. Raises 401 on any failure."""
    from app.models.auth import AuthSession
    from app.models.user import User
    from app.services.sites import resolve_access

    denied = HTTPException(status_code=401, detail="Not authenticated")
    sess = await db.get(AuthSession, token_hash(token))
    if sess is None or sess.revoked_at is not None:
        raise denied
    now = utcnow()
    if aware(sess.idle_expires_at) <= now or aware(sess.absolute_expires_at) <= now:
        raise denied
    user = await db.get(User, sess.user_id)
    if user is None or not user.is_active:
        raise denied
    # Rights are resolved on every request from the registry, the bindings and the sign-in group snapshot, so
    # a removed binding, a disabled site or a demotion applies immediately. A change of authentik group
    # membership applies at the next sign-in (the session ends at the absolute lifetime at the latest).
    access = await resolve_access(db, user, sess.auth_method, list(sess.groups or []))
    if touch and (now - aware(sess.last_seen_at)).total_seconds() > 30:
        sess.last_seen_at = now
        sess.idle_expires_at = min(now + timedelta(minutes=settings.SESSION_IDLE_MINUTES),
                                   aware(sess.absolute_expires_at))
        await db.commit()
    return Principal(user_id=user.id, username=user.username, email=user.email, full_name=user.full_name or "",
                     role=access.label, sites=access.sites, auth_method=sess.auth_method, mfa=bool(sess.mfa),
                     session_key=sess.id, csrf_token=sess.csrf_token,
                     idle_expires_at=aware(sess.idle_expires_at), absolute_expires_at=aware(sess.absolute_expires_at),
                     is_platform=access.platform, site_roles=access.site_roles, aliases=access.aliases,
                     active_sites=access.active_sites, site_names=access.site_names)


async def principal_from_service_token(db: AsyncSession, token: str) -> Principal:
    """Validate a bearer service credential. Raises 401 on any failure; revocation and expiry apply at once."""
    from app.models.auth import ServiceCredential

    denied = HTTPException(status_code=401, detail="Not authenticated")
    if not token.startswith(SERVICE_TOKEN_PREFIX) or len(token) > 200:
        raise denied
    cred = (await db.execute(select(ServiceCredential).where(ServiceCredential.token_hash == token_hash(token))
                             )).scalar_one_or_none()
    if cred is None:
        import logging
        logging.getLogger("gridwolf.authz").warning("service credential not recognised")
        raise denied
    now = utcnow()
    if cred.revoked_at is not None or aware(cred.expires_at) <= now:
        from app.services.sessions import audit
        await audit(db, "service_auth_failed", "denied", cred.name, cred.id,
                    "revoked" if cred.revoked_at is not None else "expired")
        raise denied
    if cred.last_used_at is None or (now - aware(cred.last_used_at)).total_seconds() > 60:
        cred.last_used_at = now                      # at most one write a minute per credential
        cred.use_count = (cred.use_count or 0) + 1
        await db.commit()
    from app.services.sites import registry_maps

    perms = frozenset(p for p in (cred.permissions or []) if p in SERVICE_PERMISSIONS)
    active, aliases, names = await registry_maps(db)
    sites = frozenset(aliases.get(s, s) for s in (cred.sites or []) if valid_site(s))
    sites = frozenset(s for s in sites if s in active)             # a disabled or retired site grants nothing
    return Principal(user_id=cred.id, username="service:" + cred.name, email="", full_name=cred.name, role=None,
                     sites=sites, auth_method="service", kind="service", permissions=perms,
                     absolute_expires_at=aware(cred.expires_at), aliases=aliases, active_sites=active,
                     site_names=names)


def _apply_site_scope(request: Request, principal: Principal) -> Principal:
    """The site selected in the UI (cookie, or the X-Gridwolf-Site header) narrows every query to that site.
    It can never add a right: a site the caller does not hold is refused, except on the sign-in/session
    endpoints, which must still answer so the UI can recover from a stale selection."""
    raw = request.headers.get(SITE_HEADER) or request.cookies.get(SITE_COOKIE)
    if not raw or raw == "all":
        return principal
    site = principal.canon(raw)
    held = principal.active_sites if principal.is_platform else frozenset(principal.site_roles)
    if valid_site(site) and site in held:
        return replace(principal, scope_site=site)
    if request.url.path.startswith("/api/v1/auth/") or request.url.path == "/api/v1/sites/mine":
        return principal
    raise HTTPException(status_code=403, detail="Site not permitted")


async def get_principal(request: Request, db: AsyncSession = Depends(get_db)) -> Principal:
    """A service credential in `Authorization: Bearer gws_...` (scripts), otherwise the session cookie. The
    browser never holds a bearer token that script could read or replay. A request that carries an
    Authorization header is judged on that header alone; the cookie is not consulted as a fallback."""
    header = request.headers.get("authorization")
    if header is not None:
        scheme, _, value = header.partition(" ")
        if scheme.lower() != "bearer" or not value.strip():
            raise HTTPException(status_code=401, detail="Not authenticated")
        return await principal_from_service_token(db, value.strip())
    token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    principal = await principal_from_token(db, token)
    principal = _apply_site_scope(request, principal)
    if request.method in UNSAFE:
        # A cookie is sent automatically by the browser, so state-changing requests also need the
        # per-session CSRF token and a trusted Origin.
        supplied = request.headers.get("x-csrf-token", "")
        if not _origin_ok(request) or not supplied or not safe_equal(supplied, principal.csrf_token):
            raise HTTPException(status_code=403, detail="CSRF check failed")
    return principal


def require(*permissions: str):
    """Dependency factory: authenticated, holding any of `permissions` at one or more sites. The principal it
    returns lists only the sites where one of them is held (`principal.sites`), so the scoped helpers below
    apply the per-site role. The marker lets tests prove that no route is left without an explicit
    permission."""
    if not permissions or any(p not in ALL_PERMISSIONS for p in permissions):
        raise ValueError("unknown permission " + ",".join(permissions))

    async def dependency(request: Request, principal: Principal = Depends(get_principal)) -> Principal:
        if not any(principal.can(p) for p in permissions):
            _audit_denied(request, principal, "/".join(permissions))
            raise HTTPException(status_code=403, detail="Insufficient role for this action")
        return principal.with_permission(permissions)

    dependency.gw_permission = "/".join(permissions)
    return dependency


async def get_user_principal(principal: Principal = Depends(get_principal)) -> Principal:
    """A signed-in person (session cookie). A service credential has no session, profile or logout."""
    if principal.kind != "user":
        raise HTTPException(status_code=403, detail="Not available to a service credential")
    return principal


def require_authenticated():
    """A signed-in person with a valid role, no specific permission (own profile, own session). A service
    credential is not a person and is refused."""
    async def dependency(principal: Principal = Depends(get_principal)) -> Principal:
        if principal.kind != "user" or (principal.role is None and not principal.is_platform):
            raise HTTPException(status_code=403, detail="No role is assigned to this account")
        return principal

    dependency.gw_permission = "authenticated"
    return dependency


async def principal_from_websocket(websocket: WebSocket, db: AsyncSession) -> Principal:
    origin = websocket.headers.get("origin")
    if origin is not None and origin.rstrip("/") not in settings.allowed_origins():
        raise HTTPException(status_code=403, detail="Origin not allowed")
    token = websocket.cookies.get(settings.SESSION_COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    principal = await principal_from_token(db, token, touch=False)
    if not principal.can("view"):
        raise HTTPException(status_code=403, detail="Insufficient role for this action")
    return principal


# ---- site scoping ------------------------------------------------------------------------------------

def _scope_condition(principal: Principal):
    """SQL condition on Session that is true for sessions the principal may see (None = unrestricted).
    Authorization uses explicit site rows only: a session without a `session_sites` row is unassigned
    (Platform Administrators only), whatever its name says."""
    from app.models.auth import SessionSite
    from app.models.ics import Session

    if principal.all_sites:
        return None
    sites = principal.expanded_sites()
    if not sites:
        return Session.id.in_([])            # no grants: nothing is visible
    return Session.id.in_(select(SessionSite.session_id).where(SessionSite.site_id.in_(sites)))


def scoped_session_ids(principal: Principal):
    """A `select(Session.id)` of the visible sessions, or None for an unrestricted principal."""
    from app.models.ics import Session
    cond = _scope_condition(principal)
    return None if cond is None else select(Session.id).where(cond)


def apply_scope(query, column, principal: Principal):
    """Restrict `query` to rows whose session id `column` is visible to the principal."""
    ids = scoped_session_ids(principal)
    return query if ids is None else query.where(column.in_(ids))


async def session_site(db: AsyncSession, session) -> Optional[str]:
    """The site row of a session (the stored identifier, which may be a legacy source id), else None."""
    from app.models.auth import SessionSite
    row = await db.get(SessionSite, session.id)
    return row.site_id if row is not None else None


async def get_visible_session(db: AsyncSession, principal: Principal, session_id: str):
    """The Session if it exists and the principal may see it; otherwise 404 (existence is not revealed)."""
    from app.models.ics import Session
    sess = await db.get(Session, str(session_id)) if session_id else None
    if sess is not None and not principal.all_sites:
        site = await session_site(db, sess)
        if site is None or not principal.can_see_site(site):
            sess = None
    if sess is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return sess


async def default_session_id(db: AsyncSession, principal: Principal) -> Optional[str]:
    """Most recent visible session (what 'no session_id' meant before scoping)."""
    from app.models.ics import Session
    q = select(Session.id).order_by(Session.created_at.desc()).limit(1)
    cond = _scope_condition(principal)
    if cond is not None:
        q = q.where(cond)
    return (await db.execute(q)).scalar_one_or_none()


def require_site(principal: Principal, site: Optional[str]) -> str:
    """An explicit site named by the caller: well-formed and granted, otherwise 403. Returns the canonical id."""
    if not valid_site(site) or not principal.can_see_site(site):
        raise HTTPException(status_code=403, detail="Site not permitted")
    return principal.canon(site)


async def resolve_new_session_site(db: AsyncSession, principal: Principal, requested: Optional[str]) -> Optional[str]:
    """Site (canonical) for a session or project about to be created. A requested site must be registered,
    active and one where the caller holds the route's permission. Without a request: the caller's only site;
    several sites need an explicit choice (the selected site counts); a Platform Administrator with no
    selection may leave it unassigned (visible to Platform Administrators only)."""
    if requested:
        site = require_site(principal, requested)
        if site not in principal.active_sites:
            raise HTTPException(status_code=422, detail="Unknown or inactive site")
        return site
    if principal.all_sites:
        return None
    if len(principal.sites) == 1:
        return next(iter(principal.sites))
    raise HTTPException(status_code=422, detail="site_id is required; permitted sites: %s"
                        % (", ".join(sorted(principal.sites)) or "none"))


async def assign_session_site(db: AsyncSession, session_id: str, site: Optional[str], by: str) -> None:
    from app.models.auth import SessionSite
    row = await db.get(SessionSite, session_id)
    if site is None:
        if row is not None:
            await db.delete(row)
        return
    if row is None:
        db.add(SessionSite(session_id=session_id, site_id=site, assigned_by=by))
    else:
        row.site_id, row.assigned_by = site, by


async def project_site(db: AsyncSession, project_id: str) -> Optional[str]:
    from app.models.auth import ProjectSite
    row = await db.get(ProjectSite, str(project_id))
    return row.site_id if row is not None else None


async def get_visible_project(db: AsyncSession, principal: Principal, project_id: str):
    """The Project if it exists and the principal may see it; otherwise 404 (existence is not revealed).
    A project is visible to the holders of its site; an unassigned project to Platform Administrators only."""
    from app.models.ics import Project
    proj = await db.get(Project, str(project_id)) if project_id else None
    if proj is not None and not principal.all_sites:
        site = await project_site(db, proj.id)
        if site is None or not principal.can_see_site(site):
            proj = None
    if proj is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return proj


async def assign_project_site(db: AsyncSession, project_id: str, site: Optional[str], by: str) -> None:
    from app.models.auth import ProjectSite
    row = await db.get(ProjectSite, project_id)
    if site is None:
        if row is not None:
            await db.delete(row)
        return
    if row is None:
        db.add(ProjectSite(project_id=project_id, site_id=site, assigned_by=by))
    else:
        row.site_id, row.assigned_by = site, by


def filter_sites(principal: Principal, sites: Iterable[str]) -> list[str]:
    """Canonical ids of the given (canonical or source) site identifiers that the principal may see."""
    return sorted({principal.canon(s) for s in sites if principal.can_see_site(s)})

"""Authentication and authorization tables (AUDIT-35).

All tables are new: the existing `users` and `sessions` tables are not altered, so an existing deployment
needs no data migration (`Base.metadata.create_all` adds only what is missing).

- IdentityLink   binds one registered account to one OIDC subject (issuer + sub), never to an e-mail address.
- AuthSession    backend-managed login session; only a SHA-256 of the opaque token is stored.
- SessionSite    which site an analysis session belongs to. A session without a row (and not a live site
                 session) is "unassigned" and visible to administrators only.
- AuthEvent      audit trail of sign-ins, denials, logouts and administrative changes (no secrets).
- OidcTransaction one single-use authorization request (state, nonce, PKCE verifier, browser binder).
- ProjectSite    the site a project belongs to (a project without a row is administrators-only).
- ServiceCredential a revocable, expiring, site-limited bearer credential for non-browser callers.
"""
from __future__ import annotations

from sqlalchemy import JSON, Boolean, Column, ForeignKey, Index, Integer, String, UniqueConstraint

from app.core.database import Base
from app.models.ics import UtcDateTime, genuuid, utcnow


class IdentityLink(Base):
    __tablename__ = "identity_links"

    id = Column(String, primary_key=True, default=genuuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    issuer = Column(String(255), nullable=False)
    subject = Column(String(255), nullable=False)
    created_at = Column(UtcDateTime, default=utcnow)
    last_login_at = Column(UtcDateTime)

    __table_args__ = (UniqueConstraint("issuer", "subject", name="uq_identity_issuer_subject"),)


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    id = Column(String(64), primary_key=True)          # sha256(token) hex; the token itself is never stored
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    auth_method = Column(String(16), nullable=False)   # oidc | local
    role = Column(String(32), nullable=False)
    sites = Column(JSON, default=list)
    groups = Column(JSON, default=list)                # snapshot at sign-in, for audit only
    mfa = Column(Boolean, default=False)
    csrf_token = Column(String(64), nullable=False)
    created_at = Column(UtcDateTime, default=utcnow)
    last_seen_at = Column(UtcDateTime, default=utcnow)
    idle_expires_at = Column(UtcDateTime, nullable=False)
    absolute_expires_at = Column(UtcDateTime, nullable=False)
    revoked_at = Column(UtcDateTime)
    revoked_reason = Column(String(64))


class SessionSite(Base):
    __tablename__ = "session_sites"

    session_id = Column(String, ForeignKey("sessions.id", ondelete="CASCADE"), primary_key=True)
    site_id = Column(String(64), nullable=False, index=True)
    assigned_by = Column(String(36))
    assigned_at = Column(UtcDateTime, default=utcnow)


class ProjectSite(Base):
    """The one site a project belongs to. A project without a row is unassigned (administrators only)."""
    __tablename__ = "project_sites"

    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True)
    site_id = Column(String(64), nullable=False, index=True)
    assigned_by = Column(String(36))
    assigned_at = Column(UtcDateTime, default=utcnow)


class AuthEvent(Base):
    __tablename__ = "auth_events"

    id = Column(String, primary_key=True, default=genuuid)
    ts = Column(UtcDateTime, default=utcnow, index=True)
    kind = Column(String(40), nullable=False)          # login, login_failed, denied, logout, session_revoked, user_*
    outcome = Column(String(16), nullable=False)       # ok | denied | error
    username = Column(String(255))
    user_id = Column(String(36))
    detail = Column(String(255))

    __table_args__ = (Index("ix_auth_events_kind_user_ts", "kind", "username", "ts"),)


class OidcTransaction(Base):
    __tablename__ = "oidc_transactions"

    state_hash = Column(String(64), primary_key=True)
    binder_hash = Column(String(64), nullable=False)
    nonce = Column(String(64), nullable=False)
    code_verifier = Column(String(128), nullable=False)
    next_path = Column(String(255), default="/")
    created_at = Column(UtcDateTime, default=utcnow)
    expires_at = Column(UtcDateTime, nullable=False)
    used_at = Column(UtcDateTime)


class UserSite(Base):
    """Site grants for locally authenticated accounts. OIDC accounts get their sites from authentik groups
    at every sign-in, so this table is never consulted for them."""
    __tablename__ = "user_sites"

    user_id = Column(String(36), ForeignKey("users.id"), primary_key=True)
    site_id = Column(String(64), primary_key=True)


class ServiceCredential(Base):
    """A bearer credential for a non-browser caller (a script or collector). Only a SHA-256 of the token is
    stored. It carries explicit permissions (never admin or platform) and explicit sites (never all sites),
    always expires, and is revoked by setting revoked_at (effective on the next request)."""
    __tablename__ = "service_credentials"

    id = Column(String(36), primary_key=True, default=genuuid)
    name = Column(String(80), nullable=False, unique=True)
    token_hash = Column(String(64), nullable=False, unique=True)
    token_prefix = Column(String(8), nullable=False)    # first characters after "gws_", to recognise a credential
    permissions = Column(JSON, nullable=False, default=list)
    sites = Column(JSON, nullable=False, default=list)
    created_by = Column(String(255))
    created_at = Column(UtcDateTime, default=utcnow)
    expires_at = Column(UtcDateTime, nullable=False)
    revoked_at = Column(UtcDateTime)
    revoked_reason = Column(String(64))
    last_used_at = Column(UtcDateTime)
    use_count = Column(Integer, default=0)

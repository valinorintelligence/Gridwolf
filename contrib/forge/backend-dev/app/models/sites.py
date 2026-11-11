"""Site registry and per-site role bindings.

- Site          a managed site. `id` is the canonical, immutable slug used for authorization; `name` is only a
                display label. A site is active, disabled (no non-platform access, data kept) or retired.
- SiteAlias     a legacy or source identifier that resolves to a canonical site (for example the Sensor/ingest
                identity `legacy-example-lab` resolves to `example-lab`). Historical rows keep their original identifiers.
- SiteBinding   one role held at one site by one user (subject = user id) or one authentik group (subject =
                group name). A principal's rights at a site are the union of its bindings and of the
                `FORGE-GW-<site>-<Role>` group convention; nothing is combined across sites.
- SiteSource    a Sensor or data source an administrator associated with a site. Creating a site or an
                association never enables anything: `enabled` is a separate, explicit action.
"""
from __future__ import annotations

from sqlalchemy import Boolean, Column, ForeignKey, Index, String, UniqueConstraint

from app.core.database import Base
from app.models.ics import UtcDateTime, genuuid, utcnow


class Site(Base):
    __tablename__ = "sites"

    id = Column(String(64), primary_key=True)
    name = Column(String(120), nullable=False)
    description = Column(String(500), nullable=False, default="")
    status = Column(String(16), nullable=False, default="active")      # active | disabled | retired
    template = Column(String(32), nullable=False, default="lab")
    created_by = Column(String(255))
    created_at = Column(UtcDateTime, default=utcnow)
    updated_at = Column(UtcDateTime, default=utcnow)
    retired_at = Column(UtcDateTime)


class SiteAlias(Base):
    __tablename__ = "site_aliases"

    alias = Column(String(64), primary_key=True)
    site_id = Column(String(64), ForeignKey("sites.id"), nullable=False, index=True)
    kind = Column(String(16), nullable=False, default="source")
    note = Column(String(255), default="")
    created_by = Column(String(255))
    created_at = Column(UtcDateTime, default=utcnow)


class SiteBinding(Base):
    __tablename__ = "site_bindings"

    id = Column(String, primary_key=True, default=genuuid)
    site_id = Column(String(64), ForeignKey("sites.id"), nullable=False, index=True)
    subject_type = Column(String(8), nullable=False)                    # user | group
    subject = Column(String(255), nullable=False)
    role = Column(String(32), nullable=False)
    created_by = Column(String(255))
    created_at = Column(UtcDateTime, default=utcnow)

    __table_args__ = (UniqueConstraint("site_id", "subject_type", "subject", "role", name="uq_site_binding"),
                      Index("ix_site_bindings_subject", "subject_type", "subject"))


class SiteSource(Base):
    __tablename__ = "site_sources"

    id = Column(String, primary_key=True, default=genuuid)
    site_id = Column(String(64), ForeignKey("sites.id"), nullable=False, index=True)
    source_type = Column(String(16), nullable=False)                    # sensor | datasource
    source_id = Column(String(120), nullable=False)
    note = Column(String(255), default="")
    enabled = Column(Boolean, nullable=False, default=False)
    approved_by = Column(String(255))
    approved_at = Column(UtcDateTime, default=utcnow)
    enabled_by = Column(String(255))
    enabled_at = Column(UtcDateTime)

    __table_args__ = (UniqueConstraint("site_id", "source_type", "source_id", name="uq_site_source"),)


class SensorLocation(Base):
    """Where a Sensor physically is (for example `Paint line` or `Fab`): a free-text label an administrator sets.
    Keyed by canonical site id and Sensor id, independent of association and of the telemetry registry; it is
    display-only and grants or enables nothing."""
    __tablename__ = "sensor_locations"

    id = Column(String, primary_key=True, default=genuuid)
    site_id = Column(String(64), nullable=False, index=True)
    sensor_id = Column(String(120), nullable=False)
    location = Column(String(120), nullable=False)
    updated_by = Column(String(255))
    updated_at = Column(UtcDateTime, default=utcnow)

    __table_args__ = (UniqueConstraint("site_id", "sensor_id", name="uq_sensor_location"),)

"""
Database seeder for Gridwolf.
Creates default ObjectTypes only.

The first admin account is bootstrapped by `_seed_first_admin()` in
`app.core.database` at startup — it uses either the `ADMIN_PASSWORD`
env var or a one-time auto-generated random password (printed to stdout).
No hardcoded demo users are seeded by this script.

Usage:
    python -m app.seed
"""

import asyncio

from sqlalchemy import select

from app.core.database import async_session, engine
from app.core.database import Base
from app.models.ontology import ObjectType

# 10 default object types matching frontend OBJECT_TYPE_DEFINITIONS
DEFAULT_OBJECT_TYPES = [
    {
        "name": "Vulnerability",
        "icon": "Shield",
        "color": "#ef4444",
        "description": "Security vulnerabilities from scanners and assessments",
        "properties_schema": {
            "type": "object",
            "properties": {
                "cve_id": {"type": "string"},
                "cvss_score": {"type": "number"},
                "affected_component": {"type": "string"},
                "remediation": {"type": "string"},
                "source": {"type": "string"},
            },
        },
    },
    {
        "name": "Asset",
        "icon": "Server",
        "color": "#3b82f6",
        "description": "IT assets including servers, endpoints, and cloud resources",
        "properties_schema": {
            "type": "object",
            "properties": {
                "hostname": {"type": "string"},
                "ip_address": {"type": "string"},
                "os": {"type": "string"},
                "environment": {"type": "string"},
                "owner": {"type": "string"},
            },
        },
    },
    {
        "name": "Application",
        "icon": "AppWindow",
        "color": "#8b5cf6",
        "description": "Software applications and services",
        "properties_schema": {
            "type": "object",
            "properties": {
                "version": {"type": "string"},
                "language": {"type": "string"},
                "repository_url": {"type": "string"},
                "team": {"type": "string"},
                "tier": {"type": "string"},
            },
        },
    },
    {
        "name": "Finding",
        "icon": "Search",
        "color": "#f59e0b",
        "description": "Security findings from audits and assessments",
        "properties_schema": {
            "type": "object",
            "properties": {
                "finding_type": {"type": "string"},
                "evidence": {"type": "string"},
                "recommendation": {"type": "string"},
                "assessor": {"type": "string"},
            },
        },
    },
    {
        "name": "Risk",
        "icon": "AlertTriangle",
        "color": "#f97316",
        "description": "Business and operational risks",
        "properties_schema": {
            "type": "object",
            "properties": {
                "likelihood": {"type": "string"},
                "impact": {"type": "string"},
                "risk_score": {"type": "number"},
                "mitigation_plan": {"type": "string"},
                "risk_owner": {"type": "string"},
            },
        },
    },
    {
        "name": "Control",
        "icon": "Lock",
        "color": "#10b981",
        "description": "Security controls and safeguards",
        "properties_schema": {
            "type": "object",
            "properties": {
                "control_id": {"type": "string"},
                "framework": {"type": "string"},
                "implementation_status": {"type": "string"},
                "effectiveness": {"type": "string"},
            },
        },
    },
    {
        "name": "Policy",
        "icon": "FileText",
        "color": "#6366f1",
        "description": "Security policies and standards",
        "properties_schema": {
            "type": "object",
            "properties": {
                "policy_id": {"type": "string"},
                "version": {"type": "string"},
                "last_reviewed": {"type": "string"},
                "approver": {"type": "string"},
            },
        },
    },
    {
        "name": "Incident",
        "icon": "Siren",
        "color": "#dc2626",
        "description": "Security incidents and events",
        "properties_schema": {
            "type": "object",
            "properties": {
                "incident_id": {"type": "string"},
                "classification": {"type": "string"},
                "detected_at": {"type": "string"},
                "resolved_at": {"type": "string"},
                "root_cause": {"type": "string"},
            },
        },
    },
    {
        "name": "Compliance",
        "icon": "ClipboardCheck",
        "color": "#0ea5e9",
        "description": "Compliance requirements and audit items",
        "properties_schema": {
            "type": "object",
            "properties": {
                "framework": {"type": "string"},
                "requirement_id": {"type": "string"},
                "evidence_url": {"type": "string"},
                "audit_date": {"type": "string"},
            },
        },
    },
    {
        "name": "Team",
        "icon": "Users",
        "color": "#14b8a6",
        "description": "Teams and organizational units",
        "properties_schema": {
            "type": "object",
            "properties": {
                "department": {"type": "string"},
                "lead": {"type": "string"},
                "member_count": {"type": "integer"},
                "slack_channel": {"type": "string"},
            },
        },
    },
]


async def seed_database() -> None:
    # Import all models so Base.metadata is populated
    import app.models.ontology  # noqa: F401
    import app.models.user  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        created_types = 0
        for type_def in DEFAULT_OBJECT_TYPES:
            existing = await db.execute(
                select(ObjectType).where(ObjectType.name == type_def["name"])
            )
            if existing.scalar_one_or_none() is None:
                obj_type = ObjectType(**type_def)
                db.add(obj_type)
                created_types += 1

        await db.commit()

        print(f"Seeded {created_types} object types")
        print("Seed complete.")


if __name__ == "__main__":
    asyncio.run(seed_database())

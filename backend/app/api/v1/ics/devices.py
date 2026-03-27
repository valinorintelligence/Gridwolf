from __future__ import annotations
"""Device Inventory & Topology API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.models.ics import Device, Connection, Session

router = APIRouter(prefix="/devices", tags=["Devices"])


@router.get("/")
async def list_devices(
    session_id: str = None,
    device_type: str = None,
    purdue_level: str = None,
    protocol: str = None,
    search: str = None,
    db: AsyncSession = Depends(get_db),
):
    """List discovered devices with filters."""
    query = select(Device).order_by(Device.ip_address)

    if session_id:
        query = query.where(Device.session_id == session_id)
    if device_type:
        query = query.where(Device.device_type == device_type)
    if purdue_level:
        query = query.where(Device.purdue_level == purdue_level)
    if search:
        query = query.where(
            (Device.ip_address.ilike(f"%{search}%")) |
            (Device.hostname.ilike(f"%{search}%")) |
            (Device.vendor.ilike(f"%{search}%"))
        )

    result = await db.execute(query)
    devices = result.scalars().all()

    return [
        {
            "id": d.id,
            "session_id": d.session_id,
            "ip_address": d.ip_address,
            "mac_address": d.mac_address,
            "hostname": d.hostname,
            "vendor": d.vendor,
            "device_type": d.device_type,
            "purdue_level": d.purdue_level,
            "protocols": d.protocols or [],
            "open_ports": d.open_ports or [],
            "firmware_version": d.firmware_version,
            "model": d.model,
            "confidence": d.confidence,
            "packet_count": d.packet_count,
            "first_seen": d.first_seen.isoformat() if d.first_seen else None,
            "last_seen": d.last_seen.isoformat() if d.last_seen else None,
        }
        for d in devices
    ]


@router.get("/topology")
async def get_topology(session_id: str, db: AsyncSession = Depends(get_db)):
    """Get network topology (nodes + edges) for visualization."""
    # Get devices as nodes
    dev_result = await db.execute(select(Device).where(Device.session_id == session_id))
    devices = dev_result.scalars().all()

    # Get connections as edges
    conn_result = await db.execute(select(Connection).where(Connection.session_id == session_id))
    connections = conn_result.scalars().all()

    nodes = [
        {
            "id": d.ip_address,
            "label": d.hostname or d.ip_address,
            "ip": d.ip_address,
            "type": d.device_type,
            "vendor": d.vendor,
            "purdue_level": d.purdue_level,
            "protocols": d.protocols or [],
            "confidence": d.confidence,
        }
        for d in devices
    ]

    edges = [
        {
            "source": c.src_ip,
            "target": c.dst_ip,
            "protocol": c.protocol,
            "packet_count": c.packet_count,
            "byte_count": c.byte_count,
            "is_ics": c.is_ics,
        }
        for c in connections
    ]

    return {"nodes": nodes, "edges": edges}


@router.get("/stats")
async def device_stats(session_id: str = None, db: AsyncSession = Depends(get_db)):
    """Get device statistics."""
    query = select(Device)
    if session_id:
        query = query.where(Device.session_id == session_id)

    result = await db.execute(query)
    devices = result.scalars().all()

    type_counts = {}
    purdue_counts = {}
    vendor_counts = {}
    protocol_counts = {}

    for d in devices:
        type_counts[d.device_type] = type_counts.get(d.device_type, 0) + 1
        purdue_counts[d.purdue_level] = purdue_counts.get(d.purdue_level, 0) + 1
        if d.vendor:
            vendor_counts[d.vendor] = vendor_counts.get(d.vendor, 0) + 1
        for p in (d.protocols or []):
            protocol_counts[p] = protocol_counts.get(p, 0) + 1

    return {
        "total_devices": len(devices),
        "by_type": type_counts,
        "by_purdue_level": purdue_counts,
        "by_vendor": vendor_counts,
        "by_protocol": protocol_counts,
    }


@router.get("/{device_id}")
async def get_device(device_id: str, db: AsyncSession = Depends(get_db)):
    """Get device details."""
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(404, "Device not found")

    # Get connections involving this device
    conn_result = await db.execute(
        select(Connection).where(
            (Connection.src_ip == device.ip_address) |
            (Connection.dst_ip == device.ip_address)
        ).where(Connection.session_id == device.session_id)
    )
    connections = conn_result.scalars().all()

    return {
        "id": device.id,
        "ip_address": device.ip_address,
        "mac_address": device.mac_address,
        "hostname": device.hostname,
        "vendor": device.vendor,
        "device_type": device.device_type,
        "purdue_level": device.purdue_level,
        "protocols": device.protocols,
        "open_ports": device.open_ports,
        "firmware_version": device.firmware_version,
        "model": device.model,
        "confidence": device.confidence,
        "packet_count": device.packet_count,
        "properties": device.properties,
        "connections": [
            {
                "peer_ip": c.dst_ip if c.src_ip == device.ip_address else c.src_ip,
                "direction": "outbound" if c.src_ip == device.ip_address else "inbound",
                "protocol": c.protocol,
                "packet_count": c.packet_count,
                "is_ics": c.is_ics,
            }
            for c in connections
        ],
    }

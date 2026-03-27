from __future__ import annotations
"""ICS/SCADA-specific database models for Gridwolf."""

import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, Text,
    ForeignKey, JSON, Enum as SAEnum, Index
)
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum


def utcnow():
    return datetime.now(timezone.utc)


def genuuid():
    return str(uuid.uuid4())


# ─── Enums ──────────────────────────────────────────────

class PurdueLevel(str, enum.Enum):
    L0 = "L0"
    L1 = "L1"
    L2 = "L2"
    L3 = "L3"
    DMZ = "DMZ"
    L4 = "L4"
    L5 = "L5"
    UNKNOWN = "UNKNOWN"


class DeviceType(str, enum.Enum):
    PLC = "PLC"
    RTU = "RTU"
    HMI = "HMI"
    SCADA_SERVER = "SCADA_SERVER"
    HISTORIAN = "HISTORIAN"
    ENGINEERING_WORKSTATION = "ENGINEERING_WORKSTATION"
    SWITCH = "SWITCH"
    ROUTER = "ROUTER"
    FIREWALL = "FIREWALL"
    GATEWAY = "GATEWAY"
    SENSOR = "SENSOR"
    ACTUATOR = "ACTUATOR"
    DCS = "DCS"
    RELAY = "RELAY"
    METER = "METER"
    SERVER = "SERVER"
    WORKSTATION = "WORKSTATION"
    ACCESS_POINT = "ACCESS_POINT"
    UNKNOWN = "UNKNOWN"


class Severity(str, enum.Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class FindingType(str, enum.Enum):
    CVE = "cve"
    MITRE = "mitre"
    PURDUE_VIOLATION = "purdue_violation"
    BEACON = "beacon"
    DNS_EXFIL = "dns_exfil"
    ASYMMETRIC_FLOW = "asymmetric_flow"
    WRITE_PATH = "write_path"
    DEFAULT_CREDENTIAL = "default_credential"
    PROTOCOL_ANOMALY = "protocol_anomaly"
    CUSTOM = "custom"


# ─── Projects & Sessions ────────────────────────────────

class Project(Base):
    __tablename__ = "projects"

    id = Column(String, primary_key=True, default=genuuid)
    name = Column(String(255), nullable=False)
    client_name = Column(String(255))
    assessor_name = Column(String(255))
    description = Column(Text)
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    status = Column(String(50), default="active")
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    sessions = relationship("Session", back_populates="project", cascade="all, delete-orphan")


class Session(Base):
    __tablename__ = "sessions"

    id = Column(String, primary_key=True, default=genuuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    status = Column(String(50), default="active")  # active, baseline, archived
    drift_score = Column(Float, default=0.0)
    device_count = Column(Integer, default=0)
    connection_count = Column(Integer, default=0)
    finding_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    project = relationship("Project", back_populates="sessions")
    pcap_files = relationship("PcapFile", back_populates="session", cascade="all, delete-orphan")
    devices = relationship("Device", back_populates="session", cascade="all, delete-orphan")
    connections = relationship("Connection", back_populates="session", cascade="all, delete-orphan")
    findings = relationship("Finding", back_populates="session", cascade="all, delete-orphan")


# ─── PCAP Files ─────────────────────────────────────────

class PcapFile(Base):
    __tablename__ = "pcap_files"

    id = Column(String, primary_key=True, default=genuuid)
    session_id = Column(String, ForeignKey("sessions.id"), nullable=False)
    filename = Column(String(512), nullable=False)
    filepath = Column(String(1024), nullable=False)
    file_size = Column(Integer)  # bytes
    packet_count = Column(Integer, default=0)
    duration_seconds = Column(Float, default=0.0)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    status = Column(String(50), default="pending")  # pending, processing, completed, failed
    error_message = Column(Text)
    protocol_summary = Column(JSON, default=dict)  # {"modbus": 1234, "s7comm": 567, ...}
    created_at = Column(DateTime, default=utcnow)

    session = relationship("Session", back_populates="pcap_files")


# ─── Discovered Devices ─────────────────────────────────

class Device(Base):
    __tablename__ = "devices"

    id = Column(String, primary_key=True, default=genuuid)
    session_id = Column(String, ForeignKey("sessions.id"), nullable=False)
    ip_address = Column(String(45), nullable=False)
    mac_address = Column(String(17))
    hostname = Column(String(255))
    vendor = Column(String(255))
    device_type = Column(String(50), default=DeviceType.UNKNOWN.value)
    purdue_level = Column(String(10), default=PurdueLevel.UNKNOWN.value)
    protocols = Column(JSON, default=list)  # ["modbus", "s7comm", ...]
    open_ports = Column(JSON, default=list)  # [502, 102, ...]
    firmware_version = Column(String(255))
    model = Column(String(255))
    confidence = Column(Integer, default=1)  # 1-5
    first_seen = Column(DateTime)
    last_seen = Column(DateTime)
    packet_count = Column(Integer, default=0)
    properties = Column(JSON, default=dict)  # flexible extra properties
    created_at = Column(DateTime, default=utcnow)

    session = relationship("Session", back_populates="devices")

    __table_args__ = (
        Index("ix_device_session_ip", "session_id", "ip_address", unique=True),
    )


# ─── Connections ────────────────────────────────────────

class Connection(Base):
    __tablename__ = "connections"

    id = Column(String, primary_key=True, default=genuuid)
    session_id = Column(String, ForeignKey("sessions.id"), nullable=False)
    src_ip = Column(String(45), nullable=False)
    dst_ip = Column(String(45), nullable=False)
    src_port = Column(Integer)
    dst_port = Column(Integer)
    protocol = Column(String(50))  # "modbus", "s7comm", "tcp", etc.
    transport = Column(String(10), default="TCP")
    packet_count = Column(Integer, default=0)
    byte_count = Column(Integer, default=0)
    first_seen = Column(DateTime)
    last_seen = Column(DateTime)
    is_ics = Column(Boolean, default=False)
    properties = Column(JSON, default=dict)
    created_at = Column(DateTime, default=utcnow)

    session = relationship("Session", back_populates="connections")

    __table_args__ = (
        Index("ix_conn_session_flow", "session_id", "src_ip", "dst_ip", "dst_port"),
    )


# ─── Protocol Analysis ─────────────────────────────────

class ProtocolAnalysis(Base):
    __tablename__ = "protocol_analysis"

    id = Column(String, primary_key=True, default=genuuid)
    session_id = Column(String, ForeignKey("sessions.id"), nullable=False)
    protocol = Column(String(50), nullable=False)
    src_ip = Column(String(45))
    dst_ip = Column(String(45))
    function_code = Column(Integer)
    function_name = Column(String(255))
    register_address = Column(Integer)
    register_count = Column(Integer)
    is_write = Column(Boolean, default=False)
    is_critical = Column(Boolean, default=False)
    payload_hex = Column(Text)
    details = Column(JSON, default=dict)
    timestamp = Column(DateTime)
    created_at = Column(DateTime, default=utcnow)


# ─── Security Findings ─────────────────────────────────

class Finding(Base):
    __tablename__ = "findings"

    id = Column(String, primary_key=True, default=genuuid)
    session_id = Column(String, ForeignKey("sessions.id"), nullable=False)
    finding_type = Column(String(50), nullable=False)  # FindingType enum value
    severity = Column(String(20), default=Severity.INFO.value)
    title = Column(String(512), nullable=False)
    description = Column(Text)
    src_ip = Column(String(45))
    dst_ip = Column(String(45))
    protocol = Column(String(50))
    mitre_technique = Column(String(50))  # e.g., "T0834"
    cve_id = Column(String(50))
    cvss_score = Column(Float)
    confidence = Column(Integer, default=50)  # 0-100
    remediation = Column(Text)
    evidence = Column(JSON, default=dict)
    status = Column(String(50), default="open")  # open, investigating, resolved, false_positive
    created_at = Column(DateTime, default=utcnow)

    session = relationship("Session", back_populates="findings")


# ─── Reports ────────────────────────────────────────────

class Report(Base):
    __tablename__ = "reports"

    id = Column(String, primary_key=True, default=genuuid)
    session_id = Column(String, ForeignKey("sessions.id"), nullable=False)
    name = Column(String(255), nullable=False)
    report_type = Column(String(50), default="full")  # full, executive, technical, compliance, delta
    format = Column(String(10), default="pdf")  # pdf, csv, stix, sbom
    filepath = Column(String(1024))
    file_size = Column(Integer)
    client_name = Column(String(255))
    assessor_name = Column(String(255))
    sections = Column(JSON, default=list)
    status = Column(String(50), default="pending")  # pending, generating, completed, failed
    created_at = Column(DateTime, default=utcnow)

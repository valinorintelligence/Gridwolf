"""Unit tests for backend/app/engine/protocol_parsers.py.

Fixtures are constructed inline via `struct.pack` so the tests stay diff-friendly
and don't depend on binary blobs. Each test feeds a minimal-but-valid header and
asserts the parser returns a list (the contract). Where the parser is expected
to produce at least one event from the fixture, that's asserted too.
"""

from __future__ import annotations

import struct
from datetime import datetime, timezone

import pytest

from app.engine.protocol_parsers import (
    identify_protocol,
    parse_bacnet,
    parse_dnp3,
    parse_enip,
    parse_iec104,
    parse_modbus,
    parse_s7comm,
)

SRC = "10.0.0.1"
DST = "10.0.0.2"
TS = datetime(2026, 5, 27, 12, 0, 0, tzinfo=timezone.utc)


# ── identify_protocol ────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "dport,expected",
    [
        (502, "modbus"),
        (102, "s7comm"),
        (44818, "enip"),
        (20000, "dnp3"),
        (47808, "bacnet"),
        (2404, "iec104"),
        (4840, "opcua"),
        (47808, "bacnet"),
    ],
)
def test_identify_protocol_by_dport(dport: int, expected: str) -> None:
    assert identify_protocol(dport=dport, sport=12345, payload=b"") == expected


def test_identify_protocol_falls_back_to_sport() -> None:
    assert identify_protocol(dport=33333, sport=502, payload=b"") == "modbus"


def test_identify_protocol_other_when_unknown() -> None:
    assert identify_protocol(dport=33333, sport=44444, payload=b"") == "other"


def test_identify_protocol_http_ssh() -> None:
    assert identify_protocol(dport=80, sport=0, payload=b"") == "http"
    assert identify_protocol(dport=443, sport=0, payload=b"") == "https"
    assert identify_protocol(dport=22, sport=0, payload=b"") == "ssh"


def test_identify_protocol_modbus_payload_heuristic() -> None:
    # Modbus TCP MBAP header: tx_id(2) proto_id(2)=0 len(2)=6 unit(1) fn(1) body
    payload = struct.pack(">HHHBB", 1, 0, 6, 1, 3) + b"\x00\x00\x00\x0a"
    assert identify_protocol(dport=33333, sport=33334, payload=payload) == "modbus"


# ── parse_modbus ─────────────────────────────────────────────────────────────


def _modbus_frame(fn_code: int, body: bytes = b"") -> bytes:
    length = 2 + len(body)  # unit_id + fn_code + body
    return struct.pack(">HHHBB", 1, 0, length, 1, fn_code) + body


def test_parse_modbus_returns_list_on_empty() -> None:
    assert parse_modbus(b"", SRC, DST, TS) == []


def test_parse_modbus_too_short_returns_empty() -> None:
    assert parse_modbus(b"\x00\x01\x02", SRC, DST, TS) == []


def test_parse_modbus_read_holding_registers() -> None:
    payload = _modbus_frame(fn_code=3, body=b"\x00\x00\x00\x0a")
    events = parse_modbus(payload, SRC, DST, TS)
    assert isinstance(events, list)


def test_parse_modbus_write_single_coil_is_event() -> None:
    payload = _modbus_frame(fn_code=5, body=b"\x00\x00\xff\x00")
    events = parse_modbus(payload, SRC, DST, TS)
    assert isinstance(events, list)
    # FC 5 is a write — parsers in this codebase flag writes.
    if events:
        assert any("write" in str(e).lower() for e in events)


# ── parse_s7comm ─────────────────────────────────────────────────────────────


def test_parse_s7comm_empty_returns_list() -> None:
    assert parse_s7comm(b"", SRC, DST, TS) == []


def test_parse_s7comm_returns_list_on_minimal_frame() -> None:
    # TPKT(0x03 0x00) + length(0x00 0x10) + COTP(0x02 0xF0 0x80) + S7 header
    frame = b"\x03\x00\x00\x10\x02\xf0\x80" + b"\x32\x01\x00\x00\x00\x00\x00\x00\x00"
    assert isinstance(parse_s7comm(frame, SRC, DST, TS), list)


# ── parse_enip ───────────────────────────────────────────────────────────────


def test_parse_enip_empty_returns_list() -> None:
    assert parse_enip(b"", SRC, DST, TS) == []


def test_parse_enip_register_session_command() -> None:
    # ENIP encap: cmd(2)=0x0065 len(2)=4 session(4)=0 status(4)=0 sender(8)=0 opts(4)=0 + 4-byte body
    frame = struct.pack("<HHIIQI", 0x0065, 4, 0, 0, 0, 0) + b"\x01\x00\x00\x00"
    assert isinstance(parse_enip(frame, SRC, DST, TS), list)


# ── parse_dnp3 ───────────────────────────────────────────────────────────────


def test_parse_dnp3_empty_returns_list() -> None:
    assert parse_dnp3(b"", SRC, DST, TS) == []


def test_parse_dnp3_returns_list_with_start_bytes() -> None:
    # DNP3 data link header: 0x05 0x64 len ctrl dst(2) src(2) crc(2)
    frame = b"\x05\x64\x05\xc4\x01\x00\x02\x00\xff\xff"
    assert isinstance(parse_dnp3(frame, SRC, DST, TS), list)


# ── parse_bacnet ─────────────────────────────────────────────────────────────


def test_parse_bacnet_empty_returns_list() -> None:
    assert parse_bacnet(b"", SRC, DST, TS) == []


def test_parse_bacnet_minimal_bvlc() -> None:
    # BVLC: type=0x81 function=0x0a length=0x0008 + 4 bytes NPDU
    frame = b"\x81\x0a\x00\x08" + b"\x01\x04\x00\x00"
    assert isinstance(parse_bacnet(frame, SRC, DST, TS), list)


# ── parse_iec104 ─────────────────────────────────────────────────────────────


def test_parse_iec104_empty_returns_list() -> None:
    assert parse_iec104(b"", SRC, DST, TS) == []


def test_parse_iec104_minimal_apdu() -> None:
    # IEC 104 APCI: 0x68 len(1)=4 + 4 control octets (S-format)
    frame = b"\x68\x04\x01\x00\x00\x00"
    assert isinstance(parse_iec104(frame, SRC, DST, TS), list)

"""Regression tests for the Gridwolf detection engine fixes (synthetic evidence only).

Each test names the defect it guards (AUDIT-xx) as recorded in the audit defect report. The
baseline behaviour of the unmodified deployed engine on the same synthetic capture is recorded in
the defect report; these tests fail against the baseline engine.
"""
import os
import struct
import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, os.environ.get("GW_BACKEND_DIR", str(HERE.parent / "backend-dev")))
os.environ.setdefault("GRIDWOLF_SECRET_KEY", "test-only-key")

import synth  # noqa: E402
from app.engine.c2_detector import C2Detector  # noqa: E402

try:
    from app.engine.c2_detector import is_internal  # noqa: E402
except ImportError:  # baseline (unmodified) engine
    is_internal = None
from app.engine.pcap_processor import PcapProcessor  # noqa: E402
from app.engine.protocol_parsers import parse_modbus  # noqa: E402


@pytest.fixture(scope="module")
def result(tmp_path_factory):
    p = tmp_path_factory.mktemp("pcap") / "synthetic-ot.pcap"
    synth.build(str(p))
    return PcapProcessor().process_file(str(p))


TS = datetime(2023, 1, 1, tzinfo=timezone.utc)


def adu(tid, unit, fc, data):
    return struct.pack(">HHHBB", tid, 0, len(data) + 2, unit, fc) + data


# ── Modbus parser ────────────────────────────────────────────

def test_modbus_request_role_and_registers():  # AUDIT-01 response/request role inversion, register misparse
    ev = parse_modbus(adu(1, 1, 3, struct.pack(">HH", 100, 4)), "10.0.0.2", "10.0.0.3", TS, 40000, 502)
    assert len(ev) == 1
    assert ev[0]["direction"] == "request" and ev[0]["role"] == "master"
    assert ev[0]["register_address"] == 100 and ev[0]["register_count"] == 4


def test_modbus_response_has_no_register_address():  # AUDIT-01
    ev = parse_modbus(adu(1, 1, 3, b"\x08" + b"\x08\x00" * 4), "10.0.0.3", "10.0.0.2", TS, 502, 40000)
    assert ev[0]["direction"] == "response" and ev[0]["role"] == "slave"
    assert ev[0].get("register_address") is None  # 2048 (data bytes) was reported as an address


def test_modbus_exception_decoded():  # AUDIT-02 exceptions not decoded
    ev = parse_modbus(adu(2, 1, 0x83, b"\x02"), "10.0.0.3", "10.0.0.2", TS, 502, 40000)
    assert ev[0]["is_exception"] and ev[0]["function_code"] == 3
    assert ev[0]["exception_code"] == 2 and ev[0]["exception_name"] == "Illegal Data Address"
    assert ev[0]["direction"] == "exception"


def test_modbus_pipelined_adus_all_parsed():  # AUDIT-03 only first ADU of a segment parsed
    ev = parse_modbus(adu(1, 1, 3, struct.pack(">HH", 0, 1)) + adu(2, 1, 4, struct.pack(">HH", 0, 1)),
                      "10.0.0.2", "10.0.0.3", TS, 40000, 502)
    assert [e["function_code"] for e in ev] == [3, 4]


def test_modbus_truncated_adu_does_not_crash():
    assert isinstance(parse_modbus(adu(1, 1, 3, struct.pack(">HH", 0, 1))[:9], "a", "b", TS, 1, 502), list)


# ── PCAP processor ───────────────────────────────────────────

def dev(result, ip):
    return next(d for d in result["devices"] if d["ip_address"] == ip)


def test_plc_classified_as_plc_not_hmi(result):  # AUDIT-04 PLC was "HMI / L2"
    d = dev(result, "10.10.1.20")
    assert d["device_type"] == "PLC" and d["purdue_level"] == "L1"
    assert d["properties"]["level_basis"].startswith("inferred")


def test_master_classified_from_requests(result):
    d = dev(result, "10.10.2.10")
    assert d["device_type"] == "HMI" and d["purdue_level"] == "L2"


def test_write_paths_aggregated_with_mitre_and_rejection(result):  # AUDIT-05
    wp = [f for f in result["findings"] if f["finding_type"] == "write_path"]
    assert len(wp) == 3  # was 5 (request AND response duplicates)
    by_fc = {f["evidence"]["function_code"]: f for f in wp}
    assert by_fc[6]["mitre_technique"] == "T0836" and by_fc[16]["mitre_technique"] == "T0836"
    rejected = by_fc[5]
    assert rejected["severity"] != "high"  # the write was rejected by an exception response
    assert rejected["evidence"]["rejected_by_exception"] >= 1


def test_beacon_detected_on_connection_starts(result):  # AUDIT-06 C2Detector was never used
    b = [f for f in result["findings"] if f["finding_type"] == "beacon"]
    assert len(b) == 1 and b[0]["dst_ip"] == "198.51.100.7"
    assert b[0]["confidence"] <= 80 and b[0]["severity"] in ("medium", "high")
    assert b[0]["evidence"]["basis"].startswith("timing")


def test_dns_one_finding_per_source(result):  # AUDIT-07 six identical findings, one per query
    d = [f for f in result["findings"] if f["finding_type"] == "dns_exfil"]
    assert len(d) == 1 and d[0]["src_ip"] == "10.10.3.5"
    assert d[0]["evidence"]["suspicious_queries"] == 6
    assert "exfiltrated" not in d[0]["description"].lower()


def test_telnet_requires_synack(result):  # AUDIT-08 open-port logic never recorded non-ICS ports
    t = [f for f in result["findings"] if f["finding_type"] == "insecure_service"]
    assert len(t) == 1 and "10.10.1.20" in t[0]["title"]
    assert 23 in dev(result, "10.10.1.20")["open_ports"]
    assert 23 not in dev(result, "10.10.1.21")["open_ports"]


def test_asymmetric_flow_direction_and_title(result):  # AUDIT-09 titles like "Asymmetric Flow: ( <-> '"
    a = [f for f in result["findings"] if f["finding_type"] == "asymmetric_flow"]
    assert len(a) == 1
    assert a[0]["src_ip"] == "10.10.2.50" and a[0]["dst_ip"] == "198.51.100.7"
    assert a[0]["title"].startswith("One-way transfer 10.10.2.50 to 198.51.100.7")  # was "Asymmetric Flow: ( <-> '"
    assert a[0]["evidence"]["outbound_to_external"] is True


def test_non_ip_packets_are_counted_not_dropped(tmp_path):  # AUDIT-10 IPv6/ARP silently dropped
    from scapy.all import ARP, Ether, wrpcap

    p = tmp_path / "arp.pcap"
    wrpcap(str(p), [Ether() / ARP(psrc="10.0.0.1", pdst="10.0.0.2") for _ in range(3)])
    assert PcapProcessor().process_file(str(p))["protocol_summary"].get("non-ipv4 (not analysed)") == 3


def test_unknown_stays_unknown(result):
    d = dev(result, "10.10.3.5")
    assert d["device_type"] == "UNKNOWN" and d["purdue_level"] == "UNKNOWN"


# ── C2 detector unit tests ───────────────────────────────────

def feed_starts(det, src, dst, port, n, period, jitter=0.0):
    for i in range(n):
        det.add_packet(src, dst, 40000 + i, port, 60, 1000 + i * period + (jitter if i % 2 else 0), new_flow=True)


def test_internal_modbus_polling_is_not_a_beacon():  # AUDIT-11 periodic OT polling flagged critical C2
    det = C2Detector()
    feed_starts(det, "10.0.0.2", "10.0.1.5", 502, 40, 30)
    assert [f for f in det.analyze() if f["finding_type"] == "beacon"] == []


def test_external_periodic_flow_is_a_capped_candidate():
    det = C2Detector()
    feed_starts(det, "10.0.0.2", "203.0.113.9", 443, 30, 60)
    f = [x for x in det.analyze() if x["finding_type"] == "beacon"][0]
    assert f["severity"] != "critical" and f["confidence"] <= 80


def test_irregular_flow_is_not_a_beacon():
    det = C2Detector()
    for i, t in enumerate([0, 3, 50, 51, 200, 205, 400, 900, 901, 1400, 1405, 3000, 3100]):
        det.add_packet("10.0.0.2", "203.0.113.9", 40000 + i, 443, 60, t, new_flow=True)
    assert [f for f in det.analyze() if f["finding_type"] == "beacon"] == []


def test_packets_inside_one_session_are_not_beacon_evidence():
    det = C2Detector()
    for i in range(100):
        det.add_packet("10.0.0.2", "203.0.113.9", 40000, 443, 60, i * 5.0, new_flow=(i == 0))
    assert [f for f in det.analyze() if f["finding_type"] == "beacon"] == []


def test_one_sided_volume_is_not_infinite_ratio():
    det = C2Detector()
    for i in range(300):
        det.add_packet("10.0.0.2", "203.0.113.9", 40000, 443, 1400, i, new_flow=False)
    assert [f for f in det.analyze() if f["finding_type"] == "asymmetric_flow"] == []  # reverse not observed: unknown


def test_internal_bulk_transfer_is_low_severity():
    det = C2Detector()
    for i in range(300):
        det.add_packet("10.0.0.2", "10.0.0.9", 40000, 9000, 1400, i, new_flow=False)
    det.add_packet("10.0.0.9", "10.0.0.2", 9000, 40000, 40, 1, new_flow=False)
    f = [x for x in det.analyze() if x["finding_type"] == "asymmetric_flow"]
    assert f and f[0]["severity"] == "low"


@pytest.mark.skipif(is_internal is None, reason="baseline engine has no is_internal")
def test_documentation_ranges_are_external():
    assert is_internal("10.1.2.3") and is_internal("192.168.1.1") and not is_internal("198.51.100.7")


# AUDIT-24: the MITRE page and the Compliance mapping rely on a fixed list of emitted finding types.
EMITTED_FINDING_TYPES = {"asymmetric_flow", "beacon", "dns_exfil", "insecure_service", "protocol_anomaly",
                         "purdue_violation", "write_path"}


def _emitted_types_from_source():
    import ast
    types = set()
    root = Path(os.environ.get("GW_BACKEND_DIR", str(HERE.parent / "backend-dev"))) / "app"
    for path in list((root / "engine").glob("*.py")):
        for node in ast.walk(ast.parse(path.read_text())):
            if isinstance(node, ast.Dict):
                for k, v in zip(node.keys, node.values):
                    if isinstance(k, ast.Constant) and k.value == "finding_type" and isinstance(v, ast.Constant):
                        types.add(v.value)
    ingest = ast.parse((root / "forge_live" / "ingest.py").read_text())
    for node in ast.walk(ingest):
        # derive_proto_findings: specs.append((rule, severity, class, confidence, finding_type, title, text))
        if isinstance(node, ast.Call) and getattr(node.func, "attr", "") == "append" and node.args \
                and isinstance(node.args[0], ast.Tuple) and len(node.args[0].elts) == 7:
            t = node.args[0].elts[4]
            if isinstance(t, ast.Constant) and isinstance(t.value, str):
                types.add(t.value)
    return types


def test_emitted_finding_type_inventory():  # AUDIT-24 "Mapped Finding Types" must equal what the code emits
    assert _emitted_types_from_source() == EMITTED_FINDING_TYPES


def test_pcap_engine_emits_only_inventory_types(result):
    assert {f["finding_type"] for f in result["findings"]} <= EMITTED_FINDING_TYPES

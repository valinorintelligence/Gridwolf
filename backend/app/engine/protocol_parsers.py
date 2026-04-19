"""
ICS Protocol Parsers — Deep packet inspection for industrial protocols.

Supports: Modbus TCP, S7comm, EtherNet/IP (CIP), DNP3, BACnet, IEC 104
"""

import struct
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

# ─── ICS Port → Protocol Mapping ───────────────────────

ICS_PORTS = {
    502: "modbus",
    503: "modbus",
    802: "modbus",  # Modbus alternate
    102: "s7comm",
    5026: "s7comm",  # Siemens S7 routing / SIMATIC NET
    44818: "enip",
    2222: "enip",
    20000: "dnp3",
    19999: "dnp3",  # DNP3 alternate
    47808: "bacnet",
    2404: "iec104",
    4840: "opcua",
    4843: "opcua",
    161: "snmp",
    162: "snmp",
    34962: "profinet",  # PROFINET RT
    34963: "profinet",  # PROFINET RT
    34964: "profinet",  # PROFINET Context Manager
    1089: "ff-hsE",  # FOUNDATION Fieldbus HSE
    1090: "ff-hsE",
    1091: "ff-hsE",
    18245: "gdsf",  # GE SRTP / GDS
    789: "trivial-file",  # Trivial File Transfer (ICS firmware)
    2111: "dsatp",  # DSATP (Emerson/Fisher)
}

# ─── OUI Vendor Database (common ICS vendors) ──────────

OUI_VENDORS = {
    "00-0E-8C": "Siemens",
    "00-1B-1B": "Siemens",
    "00-0C-F1": "Intel (Siemens HMI)",
    "00-80-F4": "Siemens",
    "00-30-DE": "Wago",
    "00-01-05": "Beckhoff",
    "00-06-9D": "Moxa",
    "00-90-E8": "Moxa",
    "00-0A-E4": "ABB",
    "00-C0-C9": "ABB",
    "00-20-4A": "Prosoft / Allen-Bradley",
    "00-00-BC": "Rockwell / Allen-Bradley",
    "00-1D-9C": "Rockwell Automation",
    "00-0D-9D": "Hewlett-Packard",
    "00-40-9D": "Schneider Electric",
    "00-80-F0": "Schneider Electric",
    "00-0E-F4": "Kaspersky",
    "00-12-5C": "Green Hills",
    "00-60-35": "Dallas Semiconductor",
    "00-C0-7B": "Ascend / Lantronix",
    "00-20-85": "Eaton",
    "00-03-E0": "Cisco",
    "00-0D-BD": "Cisco",
    "00-1A-2F": "Cisco",
    "00-04-96": "Extreme Networks",
    "00-02-A5": "Hirschmann",
    "00-80-63": "Hirschmann",
    "00-26-2D": "Wistron (Advantech)",
    "00-D0-C9": "Advantech",
    "00-1C-06": "Phoenix Contact",
    "00-0B-6B": "Honeywell",
    "00-04-A5": "Honeywell",
    "28-63-36": "Siemens (SIMATIC)",
    "B8-2A-72": "Dell",
    "A4-1F-72": "Dell",
    "00-50-C2": "IEEE Registration Authority",
    "00-01-02": "3Com",
    "68-F7-28": "Fortinet",
}


# ─── Protocol Identification ───────────────────────────


def identify_protocol(dport: int, sport: int, payload: bytes) -> str:
    """Identify ICS protocol from port numbers and payload heuristics."""
    # Check destination port first
    if dport in ICS_PORTS:
        return ICS_PORTS[dport]
    if sport in ICS_PORTS:
        return ICS_PORTS[sport]

    # Payload-based heuristics for non-standard ports
    if len(payload) >= 7:
        # Modbus TCP: Transaction ID (2) + Protocol ID (2, always 0x0000) + Length (2) + Unit ID (1)
        if payload[2:4] == b"\x00\x00":
            # Validate length field matches actual payload
            try:
                modbus_len = struct.unpack_from(">H", payload, 4)[0]
                if 1 <= modbus_len <= 254 and len(payload) >= 6 + modbus_len:
                    return "modbus"
            except struct.error:
                pass

        # S7comm: TPKT header (0x03, 0x00) + valid length
        if payload[0:2] == b"\x03\x00" and len(payload) >= 4:
            try:
                tpkt_len = struct.unpack_from(">H", payload, 2)[0]
                if 7 <= tpkt_len <= len(payload):
                    return "s7comm"
            except struct.error:
                pass

        # EtherNet/IP: encapsulation header with valid command
        if len(payload) >= 24:
            try:
                cmd = struct.unpack_from("<H", payload, 0)[0]
                if cmd in (0x0004, 0x0063, 0x0065, 0x0066, 0x006F, 0x0070):
                    return "enip"
            except struct.error:
                pass

        # DNP3: start bytes 0x0564
        if payload[0:2] == b"\x05\x64":
            return "dnp3"

        # IEC 104: start byte 0x68 with valid APDU length
        if payload[0] == 0x68 and len(payload) >= 6:
            apdu_len = payload[1]
            if 4 <= apdu_len <= 253:
                return "iec104"

        # BACnet/IP: BVLC type 0x81
        if payload[0] == 0x81 and len(payload) >= 4:
            try:
                bvlc_len = struct.unpack_from(">H", payload, 2)[0]
                if bvlc_len <= len(payload):
                    return "bacnet"
            except struct.error:
                pass

    # HTTP/HTTPS
    if dport in (80, 8080):
        return "http"
    if dport in (443, 8443):
        return "https"
    if dport == 22:
        return "ssh"

    return "other"


# ─── Modbus TCP Parser ─────────────────────────────────

MODBUS_FUNCTION_CODES = {
    1: ("Read Coils", False),
    2: ("Read Discrete Inputs", False),
    3: ("Read Holding Registers", False),
    4: ("Read Input Registers", False),
    5: ("Write Single Coil", True),
    6: ("Write Single Register", True),
    7: ("Read Exception Status", False),
    8: ("Diagnostics", False),
    15: ("Write Multiple Coils", True),
    16: ("Write Multiple Registers", True),
    22: ("Mask Write Register", True),
    23: ("Read/Write Multiple Registers", True),
    43: ("Read Device Identification", False),
}


def parse_modbus(payload: bytes, src_ip: str, dst_ip: str, ts: datetime) -> list[dict]:
    """Parse Modbus TCP payload."""
    events = []
    if len(payload) < 8:
        return events

    try:
        transaction_id = struct.unpack_from(">H", payload, 0)[0]
        protocol_id = struct.unpack_from(">H", payload, 2)[0]
        length = struct.unpack_from(">H", payload, 4)[0]
        unit_id = payload[6]
        function_code = payload[7]

        if protocol_id != 0:  # Not Modbus
            return events

        fc_info = MODBUS_FUNCTION_CODES.get(function_code, (f"FC {function_code}", False))
        is_write = fc_info[1]
        is_response = function_code >= 0x80

        event = {
            "protocol": "modbus",
            "src_ip": src_ip,
            "dst_ip": dst_ip,
            "function_code": function_code,
            "function_name": fc_info[0],
            "is_write": is_write,
            "is_critical": is_write and function_code in (5, 6, 15, 16),
            "role": "slave" if is_response else "master",
            "timestamp": ts.isoformat(),
            "details": {
                "transaction_id": transaction_id,
                "unit_id": unit_id,
                "length": length,
            },
        }

        # Parse register addresses for read/write operations
        if len(payload) >= 12 and not is_response:
            if function_code in (1, 2, 3, 4, 5, 6, 15, 16):
                register_addr = struct.unpack_from(">H", payload, 8)[0]
                register_count = struct.unpack_from(">H", payload, 10)[0]
                event["register_address"] = register_addr
                event["register_count"] = register_count
                event["details"]["register_address"] = register_addr
                event["details"]["register_count"] = register_count

        events.append(event)
    except (struct.error, IndexError) as e:
        logger.debug(f"Modbus parse error: {e}")

    return events


# ─── S7comm Parser ──────────────────────────────────────

S7_FUNCTION_CODES = {
    0x04: ("Read Variable", False),
    0x05: ("Write Variable", True),
    0x1A: ("Request Download", True),
    0x1B: ("Download Block", True),
    0x1C: ("End Download", True),
    0x1D: ("Start Upload", False),
    0x1E: ("Upload Block", False),
    0x1F: ("End Upload", False),
    0x28: ("PLC Control", True),
    0x29: ("PLC Stop", True),
    0xF0: ("Setup Communication", False),
}


def parse_s7comm(payload: bytes, src_ip: str, dst_ip: str, ts: datetime) -> list[dict]:
    """Parse S7comm protocol (Siemens S7-300/400/1200/1500)."""
    events = []
    if len(payload) < 10:
        return events

    try:
        # TPKT header: version (1) + reserved (1) + length (2)
        if payload[0] != 0x03:
            return events

        tpkt_len = struct.unpack_from(">H", payload, 2)[0]  # noqa: F841 (parsed protocol field, kept for clarity)

        # COTP header: length (1) + PDU type (1)
        cotp_len = payload[4]
        cotp_pdu_type = payload[5]

        # S7comm starts after TPKT + COTP
        s7_offset = 4 + 1 + cotp_len
        if len(payload) <= s7_offset + 2:
            return events

        # S7 header: Protocol ID (1) + ROSCTR (1) + ...
        s7_protocol_id = payload[s7_offset]
        if s7_protocol_id != 0x32:  # Not S7comm
            return events

        rosctr = payload[s7_offset + 1]
        # 0x01 = Job (request), 0x02 = Ack, 0x03 = Ack-Data, 0x07 = Userdata

        if rosctr == 0x01 and len(payload) > s7_offset + 10:
            # Get function code from parameter area
            param_offset = s7_offset + 10
            if len(payload) > param_offset:
                func_code = payload[param_offset]
                fc_info = S7_FUNCTION_CODES.get(func_code, (f"FC 0x{func_code:02X}", False))

                event = {
                    "protocol": "s7comm",
                    "src_ip": src_ip,
                    "dst_ip": dst_ip,
                    "function_code": func_code,
                    "function_name": fc_info[0],
                    "is_write": fc_info[1],
                    "is_critical": func_code
                    in (0x1A, 0x1B, 0x28, 0x29),  # Download, PLC Control/Stop
                    "role": "master",
                    "timestamp": ts.isoformat(),
                    "details": {
                        "rosctr": rosctr,
                        "pdu_type": cotp_pdu_type,
                    },
                }
                events.append(event)

    except (struct.error, IndexError) as e:
        logger.debug(f"S7comm parse error: {e}")

    return events


# ─── EtherNet/IP (CIP) Parser ──────────────────────────

ENIP_COMMANDS = {
    0x0004: ("ListServices", False),
    0x0063: ("ListIdentity", False),
    0x0065: ("RegisterSession", False),
    0x0066: ("UnregisterSession", False),
    0x006F: ("SendRRData", False),
    0x0070: ("SendUnitData", False),
}


def parse_enip(payload: bytes, src_ip: str, dst_ip: str, ts: datetime) -> list[dict]:
    """Parse EtherNet/IP encapsulation header."""
    events = []
    if len(payload) < 24:
        return events

    try:
        command = struct.unpack_from("<H", payload, 0)[0]
        length = struct.unpack_from("<H", payload, 2)[0]
        session_handle = struct.unpack_from("<I", payload, 4)[0]
        status = struct.unpack_from("<I", payload, 8)[0]

        cmd_info = ENIP_COMMANDS.get(command, (f"Command 0x{command:04X}", False))

        event = {
            "protocol": "enip",
            "src_ip": src_ip,
            "dst_ip": dst_ip,
            "function_code": command,
            "function_name": cmd_info[0],
            "is_write": cmd_info[1],
            "is_critical": False,
            "role": "master" if command in (0x0065, 0x006F) else "server",
            "timestamp": ts.isoformat(),
            "details": {
                "session_handle": session_handle,
                "status": status,
                "data_length": length,
            },
        }

        # Check for CIP write services inside SendRRData/SendUnitData
        if command in (0x006F, 0x0070) and len(payload) > 30:
            # Look for CIP service codes
            cip_offset = 24 + 6  # Skip encap header + interface handle
            if len(payload) > cip_offset + 1:
                cip_service = payload[cip_offset] & 0x7F
                if cip_service in (0x4D, 0x4E, 0x52, 0x53):  # Write Tag, Write Tag Fragmented
                    event["is_write"] = True
                    event["is_critical"] = True
                    event["function_name"] += " (CIP Write)"

        events.append(event)
    except (struct.error, IndexError) as e:
        logger.debug(f"EtherNet/IP parse error: {e}")

    return events


# ─── DNP3 Parser ────────────────────────────────────────

DNP3_FUNCTION_CODES = {
    0x00: ("Confirm", False),
    0x01: ("Read", False),
    0x02: ("Write", True),
    0x03: ("Select", True),
    0x04: ("Operate", True),
    0x05: ("Direct Operate", True),
    0x06: ("Direct Operate No Ack", True),
    0x0D: ("Cold Restart", True),
    0x0E: ("Warm Restart", True),
    0x12: ("Stop Application", True),
    0x13: ("Save Configuration", True),
    0x14: ("Enable Unsolicited", False),
    0x15: ("Disable Unsolicited", False),
    0x81: ("Response", False),
    0x82: ("Unsolicited Response", False),
}


def parse_dnp3(payload: bytes, src_ip: str, dst_ip: str, ts: datetime) -> list[dict]:
    """Parse DNP3 transport frame."""
    events = []
    if len(payload) < 10:
        return events

    try:
        # DNP3 Data Link Layer: Start (2) + Length (1) + Control (1) + Dest (2) + Source (2) + CRC (2)
        start = struct.unpack_from("<H", payload, 0)[0]
        if start != 0x6405:  # 0x0564 little-endian
            return events

        length = payload[2]  # noqa: F841 (parsed protocol field, kept for clarity)
        control = payload[3]
        dest_addr = struct.unpack_from("<H", payload, 4)[0]
        source_addr = struct.unpack_from("<H", payload, 6)[0]

        is_from_master = (control & 0x80) != 0

        # Transport layer starts at offset 10 (after DLL + CRC)
        if len(payload) > 12:
            transport_byte = payload[10]  # noqa: F841 (parsed protocol field, kept for clarity)
            # Application layer
            if len(payload) > 13:
                app_control = payload[11]  # noqa: F841 (parsed protocol field, kept for clarity)
                func_code = payload[12]

                fc_info = DNP3_FUNCTION_CODES.get(func_code, (f"FC 0x{func_code:02X}", False))

                event = {
                    "protocol": "dnp3",
                    "src_ip": src_ip,
                    "dst_ip": dst_ip,
                    "function_code": func_code,
                    "function_name": fc_info[0],
                    "is_write": fc_info[1],
                    "is_critical": func_code in (0x04, 0x05, 0x0D, 0x0E, 0x12),
                    "role": "master" if is_from_master else "slave",
                    "timestamp": ts.isoformat(),
                    "details": {
                        "dest_address": dest_addr,
                        "source_address": source_addr,
                        "direction": "master→outstation" if is_from_master else "outstation→master",
                    },
                }
                events.append(event)

    except (struct.error, IndexError) as e:
        logger.debug(f"DNP3 parse error: {e}")

    return events


# ─── BACnet Parser ──────────────────────────────────────

BACNET_PDU_TYPES = {
    0x00: ("Confirmed-REQ", False),
    0x01: ("Unconfirmed-REQ", False),
    0x02: ("SimpleACK", False),
    0x03: ("ComplexACK", False),
    0x04: ("SegmentACK", False),
    0x05: ("Error", False),
    0x06: ("Reject", False),
    0x07: ("Abort", False),
}

BACNET_SERVICES = {
    0x00: ("AcknowledgeAlarm", False),
    0x06: ("ReadProperty", False),
    0x0E: ("ReadPropertyMultiple", False),
    0x0F: ("WriteProperty", True),
    0x10: ("WritePropertyMultiple", True),
    0x08: ("I-Am", False),
    0x09: ("I-Have", False),
    0x0B: ("Who-Is", False),
    0x0C: ("Who-Has", False),
}


def parse_bacnet(payload: bytes, src_ip: str, dst_ip: str, ts: datetime) -> list[dict]:
    """Parse BACnet/IP payload."""
    events = []
    if len(payload) < 4:
        return events

    try:
        # BACnet/IP: Type (1) + Function (1) + Length (2)
        bvlc_type = payload[0]
        bvlc_function = payload[1]
        bvlc_length = struct.unpack_from(">H", payload, 2)[0]  # noqa: F841 (parsed protocol field, kept for clarity)

        if bvlc_type != 0x81:  # Not BACnet/IP
            return events

        # NPDU starts after BVLC header
        npdu_offset = 4
        if len(payload) > npdu_offset + 2:
            npdu_version = payload[npdu_offset]  # noqa: F841 (parsed protocol field, kept for clarity)

            # APDU follows NPDU
            apdu_offset = npdu_offset + 2  # simplified
            if len(payload) > apdu_offset + 1:
                pdu_type = (payload[apdu_offset] >> 4) & 0x0F
                pdu_info = BACNET_PDU_TYPES.get(pdu_type, (f"PDU 0x{pdu_type:X}", False))

                service_choice = None
                if len(payload) > apdu_offset + 2:
                    service_choice = (
                        payload[apdu_offset + 2] if pdu_type == 0x00 else payload[apdu_offset + 1]
                    )

                svc_info = BACNET_SERVICES.get(
                    service_choice,
                    (f"Service 0x{service_choice:02X}" if service_choice else "Unknown", False),
                )

                event = {
                    "protocol": "bacnet",
                    "src_ip": src_ip,
                    "dst_ip": dst_ip,
                    "function_code": service_choice or pdu_type,
                    "function_name": svc_info[0],
                    "is_write": svc_info[1],
                    "is_critical": svc_info[1],
                    "role": "master" if pdu_type in (0x00, 0x01) else "slave",
                    "timestamp": ts.isoformat(),
                    "details": {
                        "pdu_type": pdu_info[0],
                        "bvlc_function": bvlc_function,
                    },
                }
                events.append(event)

    except (struct.error, IndexError) as e:
        logger.debug(f"BACnet parse error: {e}")

    return events


# ─── IEC 104 Parser ─────────────────────────────────────

IEC104_TYPE_IDS = {
    1: ("Single-point information", False),
    3: ("Double-point information", False),
    9: ("Measured value, normalized", False),
    11: ("Measured value, scaled", False),
    13: ("Measured value, short floating point", False),
    30: ("Single-point with time tag CP56", False),
    45: ("Single command", True),
    46: ("Double command", True),
    47: ("Regulating step command", True),
    48: ("Set-point, normalized", True),
    49: ("Set-point, scaled", True),
    50: ("Set-point, short floating point", True),
    58: ("Single command with time tag CP56", True),
    100: ("Interrogation command", False),
    101: ("Counter interrogation", False),
    103: ("Clock synchronization", False),
}


def parse_iec104(payload: bytes, src_ip: str, dst_ip: str, ts: datetime) -> list[dict]:
    """Parse IEC 60870-5-104 APDU."""
    events = []
    if len(payload) < 6:
        return events

    try:
        start_byte = payload[0]
        if start_byte != 0x68:
            return events

        apdu_length = payload[1]  # noqa: F841 (parsed protocol field, kept for clarity)

        # Determine APDU type from first control field byte
        cf1 = payload[2]

        if (cf1 & 0x01) == 0:
            # I-format (Information transfer)
            apdu_type = "I"
            if len(payload) > 6:
                type_id = payload[6]
                num_objects = payload[7] & 0x7F
                cause_of_tx = payload[8] & 0x3F

                type_info = IEC104_TYPE_IDS.get(type_id, (f"TypeID {type_id}", type_id >= 45))

                event = {
                    "protocol": "iec104",
                    "src_ip": src_ip,
                    "dst_ip": dst_ip,
                    "function_code": type_id,
                    "function_name": type_info[0],
                    "is_write": type_info[1],
                    "is_critical": type_id >= 45 and type_id <= 69,
                    "role": "master" if type_id >= 45 else "slave",
                    "timestamp": ts.isoformat(),
                    "details": {
                        "apdu_type": apdu_type,
                        "type_id": type_id,
                        "num_objects": num_objects,
                        "cause_of_transmission": cause_of_tx,
                    },
                }
                events.append(event)
        elif (cf1 & 0x03) == 0x01:
            apdu_type = "S"  # Supervisory
        else:
            apdu_type = "U"  # Unnumbered (STARTDT, STOPDT, TESTFR)

    except (struct.error, IndexError) as e:
        logger.debug(f"IEC 104 parse error: {e}")

    return events

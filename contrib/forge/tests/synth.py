"""Synthetic, isolated evidence for the Gridwolf audit. Never touches a network: it writes a classic
pcap file with scapy. Documentation-range addresses only (RFC 5737 / private lab ranges).

Topology
  10.10.2.10  HMI/engineering client (master)        10.10.1.20  Modbus server (PLC)
  10.10.1.21  second Modbus server                   10.10.2.50  workstation with a periodic external flow
  198.51.100.7 external beacon target                10.10.3.5   DNS client with high-entropy labels
"""
import random
import struct

from scapy.all import DNS, DNSQR, IP, TCP, UDP, Ether, Raw, wrpcap

CLI, PLC, PLC2, WS, EXT, DNSC = "10.10.2.10", "10.10.1.20", "10.10.1.21", "10.10.2.50", "198.51.100.7", "10.10.3.5"
MAC = {CLI: "02:00:00:00:02:10", PLC: "00:0e:8c:00:01:20", PLC2: "00:1b:1b:00:01:21", WS: "02:00:00:00:02:50",
       EXT: "02:00:00:00:99:07", DNSC: "02:00:00:00:03:05"}


def mbap(tid, unit, pdu):
    return struct.pack(">HHHB", tid, 0, len(pdu) + 1, unit) + pdu


def tcp(src, dst, sport, dport, payload, t, flags="PA", seq=1):
    p = Ether(src=MAC[src], dst=MAC[dst]) / IP(src=src, dst=dst) / TCP(sport=sport, dport=dport, flags=flags, seq=seq)
    if payload:
        p = p / Raw(payload)
    p.time = t
    return p


def build(path, beacon_period=30.0):
    pk, t, tid = [], 1_700_000_000.0, 0

    def exch(server, sport, req_pdu, resp_pdu, unit=1):
        nonlocal t, tid
        tid += 1
        pk.append(tcp(CLI, server, sport, 502, mbap(tid, unit, req_pdu), t))
        t += 0.01
        pk.append(tcp(server, CLI, 502, sport, mbap(tid, unit, resp_pdu), t))
        t += 0.5

    for i in range(6):                                                    # FC3 read holding registers
        exch(PLC, 40001, struct.pack(">BHH", 3, 100, 4), bytes([3, 8]) + bytes(8))
    exch(PLC, 40001, struct.pack(">BHH", 6, 200, 1), struct.pack(">BHH", 6, 200, 1))          # FC6 write
    exch(PLC, 40001, struct.pack(">BHHB", 16, 300, 2, 4) + bytes(4), struct.pack(">BHH", 16, 300, 2))  # FC16 write
    exch(PLC2, 40002, struct.pack(">BHH", 3, 9999, 2), bytes([0x83, 0x02]))                  # exception 02 on FC3
    exch(PLC2, 40002, struct.pack(">BHH", 5, 7, 1), bytes([0x85, 0x04]))                     # exception 04 on FC5
    # Two ADUs in one TCP segment (pipelined requests)
    tid += 1
    a, b = mbap(tid, 1, struct.pack(">BHH", 3, 0, 1)), mbap(tid + 1, 1, struct.pack(">BHH", 4, 0, 1))
    tid += 1
    pk.append(tcp(CLI, PLC, 40003, 502, a + b, t))
    t += 1
    # Periodic external flow: one short session every beacon_period seconds, 14 sessions
    for i in range(14):
        base = 1_700_000_100.0 + i * beacon_period
        pk.append(tcp(WS, EXT, 50000 + i, 8443, b"", base, "S"))
        pk.append(tcp(WS, EXT, 50000 + i, 8443, b"x" * 40, base + 0.1))
        pk.append(tcp(EXT, WS, 8443, 50000 + i, b"y" * 40, base + 0.2))
    # DNS with high-entropy labels (6 queries)
    rnd = random.Random(7)
    for i in range(6):
        label = "".join(rnd.choice("abcdefghijklmnopqrstuvwxyz0123456789") for _ in range(32))
        q = Ether(src=MAC[DNSC], dst=MAC[PLC]) / IP(src=DNSC, dst=PLC) / UDP(sport=5300 + i, dport=53) / DNS(
            rd=1, qd=DNSQR(qname=label + ".example.net"))
        q.time = 1_700_000_500.0 + i
        pk.append(q)
    # Telnet SYN to the PLC (service probe evidence only)
    pk.append(tcp(CLI, PLC, 41000, 23, b"", 1_700_000_600.0, "S"))
    pk.append(tcp(PLC, CLI, 23, 41000, b"", 1_700_000_600.01, "SA"))                 # PLC answers: port open
    # Bulk one-way upload from the workstation to the external host (150 x 1400 B vs 3 x 60 B)
    for i in range(150):
        pk.append(tcp(WS, EXT, 51000, 9000, b"z" * 1400, 1_700_000_700.0 + i * 0.01))
    for i in range(3):
        pk.append(tcp(EXT, WS, 9000, 51000, b"a" * 20, 1_700_000_701.0 + i))
    pk.sort(key=lambda p: p.time)
    wrpcap(path, pk)
    return path


if __name__ == "__main__":
    import sys
    print(build(sys.argv[1] if len(sys.argv) > 1 else "synthetic-ot.pcap"))

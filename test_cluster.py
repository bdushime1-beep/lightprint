#!/usr/bin/env python3
"""
LightPrint — Full Infrastructure & Application Test Suite
Performs end-to-end verification across all tiers:
  1. Localhost Server & API endpoints
  2. SSH Remote Diagnostics (Web01, Web02, Lb01)
  3. Direct Application Node Probes (Port 80)
  4. Load Balancer Round-Robin Traffic Rotation (HTTPS)
  5. CodeVibe Integrity & Compliance Check

Usage:
    python test_cluster.py
"""

import os
import sys
import json
import time
import socket
import ssl
import subprocess
import urllib.request
import urllib.error
import hashlib

# Colors
GREEN = "\033[32m"
RED = "\033[31m"
YELLOW = "\033[33m"
CYAN = "\033[36m"
BOLD = "\033[1m"
DIM = "\033[2m"
RESET = "\033[0m"

KEY_PATH = os.path.join(os.path.expanduser("~"), ".ssh", "school")
SERVERS = {
    "web-01": {"ip": "13.135.166.102", "role": "Application Node 01", "node_id": "Web01"},
    "web-02": {"ip": "35.179.145.213", "role": "Application Node 02", "node_id": "Web02"},
    "lb-01":  {"ip": "3.8.133.101",   "role": "HAProxy Load Balancer", "domain": "bdushime.tech"}
}

def print_banner(text):
    print(f"\n{BOLD}{CYAN}{'=' * 72}{RESET}")
    print(f"{BOLD}{CYAN} {text}{RESET}")
    print(f"{BOLD}{CYAN}{'=' * 72}{RESET}\n")

def pass_fail(condition, label, details=""):
    mark = f"{GREEN}✔ PASS{RESET}" if condition else f"{RED}✘ FAIL{RESET}"
    det = f" {DIM}({details}){RESET}" if details else ""
    print(f"  [{mark}] {label}{det}")
    return 1 if condition else 0

def run_ssh(ip, cmd):
    ssh_cmd = [
        "ssh", "-n", "-i", KEY_PATH,
        "-o", "StrictHostKeyChecking=no",
        "-o", "UserKnownHostsFile=/dev/null",
        "-o", "ConnectTimeout=8",
        "-o", "LogLevel=ERROR",
        f"ubuntu@{ip}", cmd
    ]
    try:
        res = subprocess.run(ssh_cmd, capture_output=True, text=True, timeout=15)
        return res.returncode == 0, res.stdout.strip()
    except Exception as e:
        return False, str(e)

# ---------------------------------------------------------------------------
# Suite 1: Local Application Server
# ---------------------------------------------------------------------------
def test_local_server():
    print(f"{BOLD}[1/5] LOCAL APPLICATION SERVER TESTS (http://localhost:3000){RESET}")
    score = 0
    total = 5

    endpoints = [
        ("/", "Root HTML Interface", "text/html"),
        ("/style.css", "Precision CSS Stylesheet", "text/css"),
        ("/app.js", "Frontend Logic Controller", "application/javascript"),
        ("/api/featured", "Pre-Seeded Platforms API", "application/json"),
        ("/health", "Node Health Check API", "application/json")
    ]

    for path, name, expected_ct in endpoints:
        url = f"http://127.0.0.1:3000{path}"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "LightPrint-Tester/1.0"})
            with urllib.request.urlopen(req, timeout=3) as resp:
                status = resp.status
                ct = resp.headers.get("Content-Type", "")
                node = resp.headers.get("X-Server-Node", "Unknown")
                ok = (status == 200)
                score += pass_fail(ok, f"Local {name:26} ({path})", f"Status: {status}, Node: {node}")
        except Exception as e:
            pass_fail(False, f"Local {name:26} ({path})", f"Error: {e}")

    return score, total

# ---------------------------------------------------------------------------
# Suite 2: SSH Remote Server Diagnostics
# ---------------------------------------------------------------------------
def test_ssh_diagnostics():
    print(f"\n{BOLD}[2/5] REMOTE SSH DIAGNOSTICS (Infrastructure Nodes){RESET}")
    score = 0
    total = 0

    if not os.path.exists(KEY_PATH):
        print(f"  {YELLOW}⚠ Warning: SSH key not found at {KEY_PATH}. Skipping remote SSH checks.{RESET}")
        return 0, 0

    # 1. Web-01
    total += 3
    ok, out = run_ssh(SERVERS["web-01"]["ip"], "hostname; sudo systemctl is-active lightprint; sudo systemctl is-active nginx")
    lines = out.split("\n") if ok else []
    hostname = lines[0] if len(lines) > 0 else "unreachable"
    lp_status = lines[1] if len(lines) > 1 else "inactive"
    nginx_status = lines[2] if len(lines) > 2 else "inactive"

    score += pass_fail(ok and "web-01" in hostname, f"Web01 SSH & Hostname ({SERVERS['web-01']['ip']})", f"Host: {hostname}")
    score += pass_fail(lp_status == "active", "Web01 LightPrint Systemd Service", f"State: {lp_status}")
    score += pass_fail(nginx_status == "active", "Web01 Nginx Reverse Proxy Service", f"State: {nginx_status}")

    # 2. Web-02
    total += 3
    ok2, out2 = run_ssh(SERVERS["web-02"]["ip"], "hostname; sudo systemctl is-active lightprint; sudo systemctl is-active nginx")
    lines2 = out2.split("\n") if ok2 else []
    hostname2 = lines2[0] if len(lines2) > 0 else "unreachable"
    lp_status2 = lines2[1] if len(lines2) > 1 else "inactive"
    nginx_status2 = lines2[2] if len(lines2) > 2 else "inactive"

    score += pass_fail(ok2 and "web-02" in hostname2, f"Web02 SSH & Hostname ({SERVERS['web-02']['ip']})", f"Host: {hostname2}")
    score += pass_fail(lp_status2 == "active", "Web02 LightPrint Systemd Service", f"State: {lp_status2}")
    score += pass_fail(nginx_status2 == "active", "Web02 Nginx Reverse Proxy Service", f"State: {nginx_status2}")

    # 3. Lb-01
    total += 2
    ok3, out3 = run_ssh(SERVERS["lb-01"]["ip"], "hostname; sudo systemctl is-active haproxy")
    lines3 = out3.split("\n") if ok3 else []
    hostname3 = lines3[0] if len(lines3) > 0 else "unreachable"
    haproxy_status = lines3[1] if len(lines3) > 1 else "inactive"

    score += pass_fail(ok3 and "lb-01" in hostname3, f"Lb01 SSH & Hostname ({SERVERS['lb-01']['ip']})", f"Host: {hostname3}")
    score += pass_fail(haproxy_status == "active", "Lb01 HAProxy Load Balancer Service", f"State: {haproxy_status}")

    return score, total

# ---------------------------------------------------------------------------
# Suite 3: Direct Node HTTP Responses
# ---------------------------------------------------------------------------
def test_direct_node_responses():
    print(f"\n{BOLD}[3/5] DIRECT APPLICATION NODE RESPONSES (Port 80){RESET}")
    score = 0
    total = 2

    # Web-01 direct
    try:
        url = f"http://{SERVERS['web-01']['ip']}/health"
        req = urllib.request.Request(url, headers={"User-Agent": "LightPrint-Tester/1.0"})
        with urllib.request.urlopen(req, timeout=4) as r:
            body = json.loads(r.read().decode())
            node = r.headers.get("X-Server-Node")
            served = r.headers.get("X-Served-By")
            ok = (r.status == 200 and body.get("status") == "healthy" and node == "Web01")
            score += pass_fail(ok, f"Web01 Direct Probe (http://{SERVERS['web-01']['ip']})", f"Node: {node}, Served-By: {served}")
    except Exception as e:
        pass_fail(False, f"Web01 Direct Probe ({SERVERS['web-01']['ip']})", f"Error: {e}")

    # Web-02 direct
    try:
        url = f"http://{SERVERS['web-02']['ip']}/health"
        req = urllib.request.Request(url, headers={"User-Agent": "LightPrint-Tester/1.0"})
        with urllib.request.urlopen(req, timeout=4) as r:
            body = json.loads(r.read().decode())
            node = r.headers.get("X-Server-Node")
            served = r.headers.get("X-Served-By")
            ok = (r.status == 200 and body.get("status") == "healthy" and node == "Web02")
            score += pass_fail(ok, f"Web02 Direct Probe (http://{SERVERS['web-02']['ip']})", f"Node: {node}, Served-By: {served}")
    except Exception as e:
        pass_fail(False, f"Web02 Direct Probe ({SERVERS['web-02']['ip']})", f"Error: {e}")

    return score, total

# ---------------------------------------------------------------------------
# Suite 4: Load Balancer & Round-Robin Rotation
# ---------------------------------------------------------------------------
def test_load_balancer_rotation():
    print(f"\n{BOLD}[4/5] LOAD BALANCER & SERVED-BY ROTATION TESTS (HTTPS){RESET}")
    score = 0
    total = 3

    target_url = "https://www.bdushime.tech/health"
    hits = {"Web01": 0, "Web02": 0}
    iterations = 6

    print(f"  {DIM}Sending {iterations} sequential requests to {target_url}...{RESET}")

    ctx = ssl.create_default_context()
    rotation_log = []

    for i in range(1, iterations + 1):
        try:
            req = urllib.request.Request(target_url, headers={"User-Agent": "LightPrint-Tester/1.0"})
            with urllib.request.urlopen(req, context=ctx, timeout=5) as r:
                node = r.headers.get("X-Server-Node") or r.headers.get("X-Served-By") or "Unknown"
                if "Web01" in node:
                    hits["Web01"] += 1
                    node_label = f"{CYAN}Web01{RESET}"
                elif "Web02" in node:
                    hits["Web02"] += 1
                    node_label = f"{YELLOW}Web02{RESET}"
                else:
                    node_label = f"{RED}{node}{RESET}"
                rotation_log.append(f"Req #{i}: {node_label}")
        except Exception as e:
            rotation_log.append(f"Req #{i}: {RED}ERR ({e}){RESET}")

    print(f"  Rotation Trace: {' → '.join(rotation_log)}")

    # 1. Did we get HTTP 200 responses?
    all_hits = hits["Web01"] + hits["Web02"]
    score += pass_fail(all_hits == iterations, "HTTPS Load Balancer Availability", f"{all_hits}/{iterations} requests succeeded")

    # 2. Did Web01 handle traffic?
    score += pass_fail(hits["Web01"] > 0, "Cluster Node Web01 Served Requests", f"{hits['Web01']} hit(s)")

    # 3. Did Web02 handle traffic?
    score += pass_fail(hits["Web02"] > 0, "Cluster Node Web02 Served Requests", f"{hits['Web02']} hit(s)")

    return score, total

# ---------------------------------------------------------------------------
# Suite 5: CodeVibe Academic Integrity Audit
# ---------------------------------------------------------------------------
def test_codevibe_integrity():
    print(f"\n{BOLD}[5/5] CODEVIBE ACADEMIC INTEGRITY & COMPLIANCE AUDIT{RESET}")
    score = 0
    total = 4

    report_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "codevibe-reports", "playing-around-with-apis.report.json")
    if not os.path.exists(report_path):
        pass_fail(False, "Report File Existence", f"Missing at {report_path}")
        return 0, 4

    try:
        with open(report_path, "r", encoding="utf-8") as f:
            rep = json.load(f)
    except Exception as e:
        pass_fail(False, "Report File JSON Parsing", str(e))
        return 0, 4

    # Canonicalize implementation
    def canonicalize(val):
        if val is None or isinstance(val, (int, float, str, bool)):
            return json.dumps(val, separators=(',', ':'), ensure_ascii=False)
        if isinstance(val, list):
            items = [canonicalize(x) for x in val]
            return '[' + ','.join('null' if x is None else x for x in items) + ']'
        if isinstance(val, dict):
            parts = []
            for k in sorted(val.keys()):
                v_can = canonicalize(val[k])
                if v_can is not None:
                    parts.append(json.dumps(k, separators=(',', ':'), ensure_ascii=False) + ':' + v_can)
            return '{' + ','.join(parts) + '}'
        return None

    payload = {k: v for k, v in rep.items() if k not in ("integrity", "generatedAt")}
    canon = canonicalize(payload) or ""
    expected_hash = hashlib.sha256(canon.encode("utf-8")).hexdigest()
    stored_hash = rep.get("integrity", {}).get("hash", "").lower()

    # 1. Cryptographic Hash
    hash_match = (expected_hash == stored_hash)
    score += pass_fail(hash_match, "SHA-256 Cryptographic Hash Match", f"{stored_hash[:16]}...")

    # 2. Authorship
    auth = rep.get("metrics", {}).get("authorship", {})
    auth_pct = auth.get("authorshipPercentage", 99.0)
    auth_ok = auth_pct <= rep.get("policy", {}).get("maxAuthorshipPercentage", 20.0)
    score += pass_fail(auth_ok, f"Authorship Threshold (<=20.0%)", f"{auth_pct:.1f}% AI authorship")

    # 3. Ownership
    own = rep.get("metrics", {}).get("ownership", {})
    own_score = own.get("score", 0.0)
    own_ok = own_score >= rep.get("policy", {}).get("minOwnershipScore", 100.0)
    score += pass_fail(own_ok, f"Ownership Score (>=100)", f"{own_score:.1f} / 100")

    # 4. Violations
    viols = rep.get("metrics", {}).get("violations", [])
    viols_ok = (len(viols) == 0)
    score += pass_fail(viols_ok, "Integrity Violations Count (0)", f"{len(viols)} detected")

    return score, total

# ---------------------------------------------------------------------------
# Main Runner
# ---------------------------------------------------------------------------
def main():
    print_banner("LIGHTPRINT END-TO-END CLUSTER & INTEGRITY TEST SUITE")

    s1, t1 = test_local_server()
    s2, t2 = test_ssh_diagnostics()
    s3, t3 = test_direct_node_responses()
    s4, t4 = test_load_balancer_rotation()
    s5, t5 = test_codevibe_integrity()

    total_score = s1 + s2 + s3 + s4 + s5
    total_tests = t1 + t2 + t3 + t4 + t5

    print(f"\n{BOLD}{CYAN}{'=' * 72}{RESET}")
    print(f"{BOLD} FINAL AUDIT SUMMARY SCORECARD{RESET}")
    print(f"{BOLD}{CYAN}{'=' * 72}{RESET}")
    print(f"  • Local Application Server:   {s1}/{t1} passed")
    print(f"  • Remote SSH Diagnostics:     {s2}/{t2} passed")
    print(f"  • Direct Node HTTP Probes:    {s3}/{t3} passed")
    print(f"  • Load Balancer Rotation:     {s4}/{t4} passed")
    print(f"  • CodeVibe Compliance Audit:  {s5}/{t5} passed")
    print(f"{BOLD}{CYAN}{'-' * 72}{RESET}")

    if total_score == total_tests:
        print(f"  {BOLD}{GREEN}OVERALL STATUS: ALL {total_tests}/{total_tests} AUDIT CHECKS PASSED (100% HEALTHY & COMPLIANT){RESET}")
        print(f"  {BOLD}Production Domain:{RESET}  https://www.bdushime.tech")
        print(f"  {BOLD}Load Balancer IP:{RESET}   3.8.133.101")
        print(f"  {BOLD}Web01 Instance:{RESET}     13.135.166.102")
        print(f"  {BOLD}Web02 Instance:{RESET}     35.179.145.213")
    else:
        print(f"  {BOLD}{RED}OVERALL STATUS: {total_tests - total_score} CHECK(S) FAILED. Review output above.{RESET}")

    print(f"{BOLD}{CYAN}{'=' * 72}{RESET}\n")
    sys.exit(0 if total_score == total_tests else 1)

if __name__ == "__main__":
    main()

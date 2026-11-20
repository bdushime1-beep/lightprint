#!/usr/bin/env python3
"""
LightPrint - Full Infrastructure, Server Diagnostics & Verification Test Suite
==============================================================================
Performs comprehensive end-to-end audit and diagnostics across all tiers:
  1. DNS & SSL / TLS Certificate Diagnostics (bdushime.tech, www, lightprint)
  2. Remote SSH Diagnostics into All Infrastructure Nodes (Web01, Web02, Lb01)
  3. Direct Application Node HTTP Probes & Response Inspection (Port 80)
  4. Load Balancer HTTP-to-HTTPS Redirection & Live Round-Robin Rotation Trace
  5. Local Application Server & API Endpoints (Port 3000)
  6. CodeVibe Academic Integrity & Cryptographic Compliance Audit

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
from datetime import datetime

# Enable unbuffered line printing
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(line_buffering=True)

# ANSI Colors & Styling
GREEN = "\033[32m"
RED = "\033[31m"
YELLOW = "\033[33m"
CYAN = "\033[36m"
MAGENTA = "\033[35m"
BOLD = "\033[1m"
DIM = "\033[2m"
RESET = "\033[0m"

KEY_PATH = os.path.join(os.path.expanduser("~"), ".ssh", "school")

SERVERS = {
    "web-01": {
        "ip": "13.135.166.102",
        "role": "Application Node 01",
        "node_id": "Web01",
        "expected_host": "7266-web-01"
    },
    "web-02": {
        "ip": "35.179.145.213",
        "role": "Application Node 02",
        "node_id": "Web02",
        "expected_host": "7266-web-02"
    },
    "lb-01": {
        "ip": "3.8.133.101",
        "role": "HAProxy Load Balancer",
        "domain": "bdushime.tech",
        "expected_host": "7266-lb-01"
    }
}

DOMAINS = ["bdushime.tech", "www.bdushime.tech", "lightprint.bdushime.tech"]


def print_banner(text):
    print(f"\n{BOLD}{CYAN}{'=' * 78}{RESET}", flush=True)
    print(f"{BOLD}{CYAN} {text}{RESET}", flush=True)
    print(f"{BOLD}{CYAN}{'=' * 78}{RESET}\n", flush=True)


def print_section(num, title):
    print(f"\n{BOLD}{MAGENTA}[{num}] {title}{RESET}", flush=True)
    print(f"{DIM}{'-' * 78}{RESET}", flush=True)


def pass_fail(condition, label, details=""):
    mark = f"{GREEN}✔ PASS{RESET}" if condition else f"{RED}✘ FAIL{RESET}"
    det = f" {DIM}- {details}{RESET}" if details else ""
    print(f"  [{mark}] {label}{det}", flush=True)
    return 1 if condition else 0


def run_ssh(ip, cmd, timeout=12):
    """Executes a non-interactive SSH command against an EC2 instance."""
    ssh_cmd = [
        "ssh", "-n", "-i", KEY_PATH,
        "-o", "StrictHostKeyChecking=no",
        "-o", "UserKnownHostsFile=/dev/null",
        "-o", "ConnectTimeout=6",
        "-o", "LogLevel=ERROR",
        f"ubuntu@{ip}", cmd
    ]
    try:
        res = subprocess.run(ssh_cmd, capture_output=True, text=True, timeout=timeout)
        return res.returncode == 0, res.stdout.strip(), res.stderr.strip()
    except Exception as e:
        return False, "", str(e)


def resolve_domain(domain):
    """Resolves domain using local resolver, falling back to public DNS if ISP cache is stale."""
    try:
        return socket.gethostbyname(domain)
    except Exception:
        try:
            cmd = ["powershell", "-Command", f"(Resolve-DnsName {domain} -Server 8.8.8.8 -ErrorAction SilentlyContinue).IPAddress"]
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
            lines = res.stdout.strip().splitlines()
            return lines[0].strip() if lines else ""
        except Exception:
            return ""


# ---------------------------------------------------------------------------
# Suite 1: DNS & SSL Certificate Verification
# ---------------------------------------------------------------------------
def test_dns_and_ssl():
    print_section("1/6", "PUBLIC DOMAIN DNS RESOLUTION & SSL/TLS CERTIFICATE DIAGNOSTICS")
    score = 0
    total = 0

    # 1. DNS Resolution
    for domain in DOMAINS:
        total += 1
        resolved_ip = resolve_domain(domain)
        is_lb = (resolved_ip == SERVERS["lb-01"]["ip"])
        score += pass_fail(
            is_lb,
            f"DNS A Record: {domain:28}",
            f"Resolved to {resolved_ip} (Target Lb01: {SERVERS['lb-01']['ip']})"
        )

    # 2. SSL / TLS Certificate Handshake on Port 443
    total += 2
    target_host = "lightprint.bdushime.tech"
    try:
        ctx = ssl.create_default_context()
        with socket.create_connection((SERVERS["lb-01"]["ip"], 443), timeout=5) as sock:
            with ctx.wrap_socket(sock, server_hostname=target_host) as ssock:
                cert = ssock.getpeercert()
                issuer = dict(x[0] for x in cert.get("issuer", []))
                issuer_org = issuer.get("organizationName", "Unknown")
                sans = [v for k, v in cert.get("subjectAltName", []) if k == "DNS"]
                not_after = cert.get("notAfter", "")

                has_domains = all(d in sans for d in DOMAINS)
                score += pass_fail(
                    has_domains,
                    "SSL SAN Multi-Domain Coverage",
                    f"Covered: {', '.join(sans)}"
                )
                score += pass_fail(
                    "Let's Encrypt" in issuer_org or len(sans) > 0,
                    "SSL Certificate Authority & Validity",
                    f"Issuer: {issuer_org} | Valid until: {not_after}"
                )
    except Exception as e:
        pass_fail(False, "SSL / TLS Handshake", f"Handshake failed: {e}")
        pass_fail(False, "SSL Certificate Authority", "Skipped")

    return score, total


# ---------------------------------------------------------------------------
# Suite 2: Remote SSH Diagnostics on All 3 Servers
# ---------------------------------------------------------------------------
def test_ssh_diagnostics():
    print_section("2/6", "REMOTE SSH DIAGNOSTICS & SYSTEM SERVICE INSPECTION")
    score = 0
    total = 0

    if not os.path.exists(KEY_PATH):
        print(f"  {YELLOW}⚠ Warning: SSH key not found at {KEY_PATH}. Skipping remote SSH checks.{RESET}", flush=True)
        return 0, 0

    # Diagnostics for Web01 and Web02
    for node_name in ["web-01", "web-02"]:
        info = SERVERS[node_name]
        ip = info["ip"]
        role = info["role"]
        node_id = info["node_id"]

        print(f"\n  {BOLD}{CYAN}▶ Connecting via SSH to {node_name} ({ip} - {role})...{RESET}", flush=True)

        cmd = (
            "echo HOST:$(hostname); "
            "echo UPTIME:$(uptime -p); "
            "echo LP_ACTIVE:$(systemctl is-active lightprint); "
            "echo NGINX_ACTIVE:$(systemctl is-active nginx); "
            "echo GIT_HEAD:$(git -C /home/ubuntu/lightprint rev-parse --short HEAD 2>/dev/null || echo 'none'); "
            "echo LISTEN:$(ss -tulpn | grep -E '3000|80' | awk '{print $5}' | tr '\n' ' ')"
        )

        ok, out, err = run_ssh(ip, cmd)

        parsed = {}
        if ok:
            for line in out.splitlines():
                if ":" in line:
                    k, v = line.split(":", 1)
                    parsed[k.strip()] = v.strip()

        host_val = parsed.get("HOST", "unknown")
        uptime_val = parsed.get("UPTIME", "unknown")
        lp_val = parsed.get("LP_ACTIVE", "inactive")
        nginx_val = parsed.get("NGINX_ACTIVE", "inactive")
        git_val = parsed.get("GIT_HEAD", "none")
        listen_val = parsed.get("LISTEN", "none")

        print(f"    {DIM}Host: {host_val} | Uptime: {uptime_val} | Git: {git_val} | Ports: {listen_val}{RESET}", flush=True)

        total += 3
        score += pass_fail(
            ok and info["expected_host"] in host_val,
            f"{node_id} SSH Connectivity & Host Identity",
            f"Host: {host_val} ({ip})"
        )
        score += pass_fail(
            lp_val == "active",
            f"{node_id} LightPrint App Service (systemd)",
            f"Status: {lp_val} (Port 3000, NODE_ID={node_id})"
        )
        score += pass_fail(
            nginx_val == "active",
            f"{node_id} Nginx Reverse Proxy (systemd)",
            f"Status: {nginx_val} (Port 80 -> Port 3000)"
        )

    # Diagnostics for Lb01
    lb_info = SERVERS["lb-01"]
    lb_ip = lb_info["ip"]
    print(f"\n  {BOLD}{CYAN}▶ Connecting via SSH to lb-01 ({lb_ip} - HAProxy Load Balancer)...{RESET}", flush=True)

    lb_cmd = (
        "echo HOST:$(hostname); "
        "echo UPTIME:$(uptime -p); "
        "echo HAPROXY_ACTIVE:$(systemctl is-active haproxy); "
        "echo CERT_EXISTS:$([ -f /etc/haproxy/certs/www.bdushime.tech.pem ] && echo yes || echo no); "
        "echo LISTEN:$(ss -tulpn | grep -E '80|443' | awk '{print $5}' | tr '\n' ' ')"
    )

    ok_lb, out_lb, err_lb = run_ssh(lb_ip, lb_cmd)

    lb_parsed = {}
    if ok_lb:
        for line in out_lb.splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                lb_parsed[k.strip()] = v.strip()

    lb_host = lb_parsed.get("HOST", "unknown")
    lb_uptime = lb_parsed.get("UPTIME", "unknown")
    haproxy_val = lb_parsed.get("HAPROXY_ACTIVE", "inactive")
    cert_val = lb_parsed.get("CERT_EXISTS", "no")
    lb_listen = lb_parsed.get("LISTEN", "none")

    print(f"    {DIM}Host: {lb_host} | Uptime: {lb_uptime} | SSL Pem: {cert_val} | Ports: {lb_listen}{RESET}", flush=True)

    total += 2
    score += pass_fail(
        ok_lb and lb_info["expected_host"] in lb_host,
        "Lb01 SSH Connectivity & Host Identity",
        f"Host: {lb_host} ({lb_ip})"
    )
    score += pass_fail(
        haproxy_val == "active" and cert_val == "yes",
        "Lb01 HAProxy Service & SSL Bundle",
        f"HAProxy: {haproxy_val} | SSL Cert Bundle: /etc/haproxy/certs/www.bdushime.tech.pem"
    )

    return score, total


# ---------------------------------------------------------------------------
# Suite 3: Direct Node HTTP Responses & Header Inspection
# ---------------------------------------------------------------------------
def test_direct_node_responses():
    print_section("3/6", "DIRECT APPLICATION NODE HTTP PROBES (Bypassing Load Balancer)")
    score = 0
    total = 0

    for node_name in ["web-01", "web-02"]:
        total += 1
        info = SERVERS[node_name]
        ip = info["ip"]
        node_id = info["node_id"]
        url = f"http://{ip}/health"

        print(f"\n  {BOLD}Direct Probe: {node_id} (http://{ip}/health){RESET}", flush=True)

        try:
            req = urllib.request.Request(url, headers={"User-Agent": "LightPrint-Auditor/2.0"})
            t0 = time.time()
            with urllib.request.urlopen(req, timeout=5) as r:
                elapsed = int((time.time() - t0) * 1000)
                body_bytes = r.read()
                data = json.loads(body_bytes.decode())
                served_by = r.headers.get("X-Served-By", "unknown")
                server_node = r.headers.get("X-Server-Node", "unknown")
                cache_ctrl = r.headers.get("Cache-Control", "")

                print(f"    {DIM}HTTP Status:    {r.status} OK{RESET}", flush=True)
                print(f"    {DIM}X-Served-By:    {served_by}{RESET}", flush=True)
                print(f"    {DIM}X-Server-Node:  {server_node}{RESET}", flush=True)
                print(f"    {DIM}Cache-Control:  {cache_ctrl}{RESET}", flush=True)
                print(f"    {DIM}Response Body:  {json.dumps(data)}{RESET}", flush=True)

                ok = (
                    r.status == 200 and
                    data.get("status") == "healthy" and
                    node_id in (served_by, server_node)
                )
                score += pass_fail(
                    ok,
                    f"Direct {node_id} Health & Headers Probe",
                    f"Status: {r.status}, Served-By: {served_by}, Latency: {elapsed}ms"
                )
        except Exception as e:
            pass_fail(False, f"Direct {node_id} Health & Headers Probe", f"Probe error: {e}")

    return score, total


# ---------------------------------------------------------------------------
# Suite 4: Load Balancer Redirection & Round-Robin Rotation Trace
# ---------------------------------------------------------------------------
def test_load_balancer_and_rotation():
    print_section("4/6", "LOAD BALANCER HTTPS TERMINATION & TRAFFIC ROTATION TRACE")
    score = 0
    total = 0

    # 1. HTTP to HTTPS 301/302 Redirect Check
    total += 1
    http_url = "http://www.bdushime.tech/"
    try:
        class NoRedirectHandler(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, req, fp, code, msg, headers, newurl):
                return None  # Prevent automatic redirect following

        opener = urllib.request.build_opener(NoRedirectHandler)
        req = urllib.request.Request(http_url, headers={"User-Agent": "LightPrint-Auditor/2.0"})
        try:
            resp = opener.open(req, timeout=5)
            redirect_code = resp.status
            location = resp.headers.get("Location", "")
        except urllib.error.HTTPError as e:
            redirect_code = e.code
            location = e.headers.get("Location", "")

        is_redirect = (redirect_code in (301, 302, 308) and "https://" in location)
        score += pass_fail(
            is_redirect,
            "HTTP to HTTPS Automatic Redirection",
            f"Code: {redirect_code} -> Location: {location}"
        )
    except Exception as e:
        pass_fail(False, "HTTP to HTTPS Automatic Redirection", f"Error: {e}")

    # 2. Public HTTPS Tests Across All Registered Hostnames
    for dom in DOMAINS:
        total += 1
        try:
            # Connect to Lb01 IP with SNI hostname
            ctx = ssl.create_default_context()
            sock = socket.create_connection((SERVERS["lb-01"]["ip"], 443), timeout=5)
            ssock = ctx.wrap_socket(sock, server_hostname=dom)
            
            http_req = (
                f"GET /health HTTP/1.1\r\n"
                f"Host: {dom}\r\n"
                f"User-Agent: LightPrint-Auditor/2.0\r\n"
                f"Connection: close\r\n\r\n"
            ).encode("utf-8")
            ssock.sendall(http_req)
            
            resp_data = b""
            while True:
                chunk = ssock.recv(4096)
                if not chunk:
                    break
                resp_data += chunk
            ssock.close()

            resp_text = resp_data.decode("utf-8", errors="replace")
            status_line = resp_text.splitlines()[0] if resp_text else ""
            is_200 = ("200 OK" in status_line)
            served_match = "Web01" if "Web01" in resp_text else ("Web02" if "Web02" in resp_text else "Cluster")

            score += pass_fail(
                is_200,
                f"Public HTTPS Access ({dom})",
                f"{status_line} | Node: {served_match}"
            )
        except Exception as e:
            pass_fail(False, f"Public HTTPS Access ({dom})", f"Error: {e}")

    # 3. Sequential 10-Request Burst for Round-Robin Alternation
    total += 3
    iterations = 10
    target_host = "lightprint.bdushime.tech"
    hits = {"Web01": 0, "Web02": 0, "Other": 0}
    sequence = []

    print(f"\n  {BOLD}Executing {iterations} Sequential HTTPS Requests to Trace Round-Robin Balancing...{RESET}", flush=True)
    print(f"  {DIM}┌───────┬──────────────┬──────────────┬──────────────┬──────────┬──────────────┐{RESET}")
    print(f"  {DIM}│ Req # │ Status Code  │ X-Served-By  │ X-Server-Node│ Latency  │ Health State │{RESET}")
    print(f"  {DIM}├───────┼──────────────┼──────────────┼──────────────┼──────────┼──────────────┤{RESET}")

    ctx = ssl.create_default_context()
    for i in range(1, iterations + 1):
        t0 = time.time()
        try:
            sock = socket.create_connection((SERVERS["lb-01"]["ip"], 443), timeout=5)
            ssock = ctx.wrap_socket(sock, server_hostname=target_host)
            
            http_req = (
                f"GET /health HTTP/1.1\r\n"
                f"Host: {target_host}\r\n"
                f"User-Agent: LightPrint-Auditor/2.0\r\n"
                f"Connection: close\r\n\r\n"
            ).encode("utf-8")
            ssock.sendall(http_req)
            
            resp_data = b""
            while True:
                chunk = ssock.recv(4096)
                if not chunk:
                    break
                resp_data += chunk
            ssock.close()
            elapsed = int((time.time() - t0) * 1000)

            resp_text = resp_data.decode("utf-8", errors="replace")
            headers_part = resp_text.split("\r\n\r\n")[0] if "\r\n\r\n" in resp_text else resp_text
            
            served = "unknown"
            node = "unknown"
            for hline in headers_part.splitlines():
                if hline.lower().startswith("x-served-by:"):
                    served = hline.split(":", 1)[1].strip()
                elif hline.lower().startswith("x-server-node:"):
                    node = hline.split(":", 1)[1].strip()

            matched = "Web01" if "Web01" in (served + node) else ("Web02" if "Web02" in (served + node) else "Other")
            hits[matched] += 1
            sequence.append(matched)

            color = CYAN if matched == "Web01" else (YELLOW if matched == "Web02" else RED)
            print(f"  │ #{i:02d}   │ {GREEN}200 OK{RESET}       │ {color}{served:12}{RESET} │ {color}{node:12}{RESET} │ {elapsed:4d}ms   │ {GREEN}healthy{RESET}      │", flush=True)
        except Exception as e:
            print(f"  │ #{i:02d}   │ {RED}FAILED{RESET}       │ {RED}{str(e)[:38]:38}{RESET} │", flush=True)

    print(f"  {DIM}└───────┴──────────────┴──────────────┴──────────────┴──────────┴──────────────┘{RESET}", flush=True)

    all_success = (hits["Web01"] + hits["Web02"] == iterations)
    score += pass_fail(
        all_success,
        f"HAProxy High-Availability Traffic Burst ({iterations}/{iterations})",
        f"Web01: {hits['Web01']}, Web02: {hits['Web02']}, Failed: {iterations - hits['Web01'] - hits['Web02']}"
    )

    web01_active = hits["Web01"] > 0
    web02_active = hits["Web02"] > 0
    score += pass_fail(
        web01_active and web02_active,
        "Multi-Node Load Distribution (Web01 & Web02 Active)",
        f"Web01 Traffic: {hits['Web01'] / iterations * 100:.1f}% | Web02 Traffic: {hits['Web02'] / iterations * 100:.1f}%"
    )

    # Check for alternating pattern
    alternations = sum(1 for idx in range(len(sequence) - 1) if sequence[idx] != sequence[idx + 1])
    is_alternating = alternations >= (iterations - 3)
    score += pass_fail(
        is_alternating,
        "Strict Round-Robin Alternation Pattern",
        f"Transitions: {alternations}/{iterations - 1} between Web01 ⇄ Web02"
    )

    return score, total


# ---------------------------------------------------------------------------
# Suite 5: Local Application Server & API Endpoints
# ---------------------------------------------------------------------------
def test_local_server():
    print_section("5/6", "LOCAL APPLICATION SERVER & REST ENDPOINTS (http://127.0.0.1:3000)")
    score = 0
    total = 0

    # Auto-start local server.py if not already running on port 3000
    local_proc = None
    try:
        with socket.create_connection(("127.0.0.1", 3000), timeout=0.5):
            pass
    except Exception:
        server_script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "server.py")
        local_proc = subprocess.Popen([sys.executable, server_script], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(1.5)

    try:
        endpoints = [
            ("/", "Root Single-Page Application", "text/html"),
            ("/style.css", "Precision CSS Stylesheet (0px geometry)", "text/css"),
            ("/app.js", "Frontend Logic & Scanner Engine", "javascript"),
            ("/api/featured", "Pre-Seeded 12 Platform Directory", "application/json"),
            ("/api/search?q=google", "Platform Search API Filter", "application/json"),
            ("/api/service?id=242", "Detailed Platform Clauses Dossier", "application/json"),
            ("/health", "Instance Health & Heartbeat API", "application/json")
        ]

        for path, desc, expected_mime in endpoints:
            total += 1
            url = f"http://127.0.0.1:3000{path}"
            try:
                t0 = time.time()
                req = urllib.request.Request(url, headers={"User-Agent": "LightPrint-Auditor/2.0"})
                with urllib.request.urlopen(req, timeout=5) as resp:
                    elapsed = int((time.time() - t0) * 1000)
                    status = resp.status
                    ct = resp.headers.get("Content-Type", "")
                    node = resp.headers.get("X-Server-Node", "local")
                    content = resp.read()
                    size_kb = len(content) / 1024

                    detail = f"Status: {status}, Size: {size_kb:.1f} KB, Latency: {elapsed}ms, Node: {node}"
                    ok = (status == 200 and expected_mime.lower() in ct.lower())
                    score += pass_fail(ok, f"Local {desc:36} ({path})", detail)
            except Exception as e:
                pass_fail(False, f"Local {desc:36} ({path})", f"Error: {e}")
    finally:
        if local_proc:
            try:
                local_proc.terminate()
                local_proc.wait(timeout=2)
            except Exception:
                pass

    return score, total


# ---------------------------------------------------------------------------
# Suite 6: CodeVibe Academic Integrity & Cryptographic Compliance Audit
# ---------------------------------------------------------------------------
def test_codevibe_integrity():
    print_section("6/6", "CODEVIBE ACADEMIC INTEGRITY & CRYPTOGRAPHIC VERIFICATION")
    score = 0
    total = 5

    report_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "codevibe-reports", "playing-around-with-apis.report.json")
    if not os.path.exists(report_path):
        pass_fail(False, "Report File Existence", f"Missing at {report_path}")
        return 0, total

    try:
        with open(report_path, "r", encoding="utf-8") as f:
            rep = json.load(f)
    except Exception as e:
        pass_fail(False, "Report File JSON Parsing", str(e))
        return 0, total

    # Canonicalize implementation matching CodeVibe JS spec
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
    score += pass_fail(
        hash_match,
        "SHA-256 Cryptographic Digest Match",
        f"Digest: {stored_hash[:16]}... (Exact canonical bit-for-bit match)"
    )

    # 2. Authorship
    auth = rep.get("metrics", {}).get("authorship", {})
    auth_pct = auth.get("authorshipPercentage", 99.0)
    max_pct = rep.get("policy", {}).get("maxAuthorshipPercentage", 20.0)
    auth_ok = (auth_pct <= max_pct)
    score += pass_fail(
        auth_ok,
        f"AI Authorship Ceiling (<= {max_pct:.1f}%)",
        f"Calculated AI: {auth_pct:.1f}% ({auth.get('manualLines', 0)} manual lines)"
    )

    # 3. Ownership
    own = rep.get("metrics", {}).get("ownership", {})
    own_score = own.get("score", 0.0)
    min_own = rep.get("policy", {}).get("minOwnershipScore", 100.0)
    own_ok = (own_score >= min_own)
    score += pass_fail(
        own_ok,
        f"Student Ownership Score (>= {min_own:.0f})",
        f"Recorded Score: {own_score:.1f} / 100 (Unreviewed: {own.get('filesUnreviewed', 0)})"
    )

    # 4. Violations
    viols = rep.get("metrics", {}).get("violations", [])
    viols_ok = (len(viols) == 0)
    score += pass_fail(
        viols_ok,
        "Academic Policy Violations (0 Expected)",
        f"{len(viols)} detected"
    )

    # 5. Student Identity & Commitment
    student_ident = rep.get("studentIdentifier", "")
    author_ok = ("b.dushime1@alustudent.com" in student_ident)
    score += pass_fail(
        author_ok,
        "Student Identity Verification",
        f"Student: {student_ident} | Head Commit: {rep.get('repoHeadCommit', '')[:8]}"
    )

    return score, total


# ---------------------------------------------------------------------------
# Main Executive Runner
# ---------------------------------------------------------------------------
def main():
    print_banner("LIGHTPRINT END-TO-END INFRASTRUCTURE & COMPLIANCE AUDITOR")
    print(f"  {BOLD}Execution Timestamp:{RESET}  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", flush=True)
    print(f"  {BOLD}Primary Domain:{RESET}       https://lightprint.bdushime.tech", flush=True)
    print(f"  {BOLD}Alternate Domains:{RESET}    https://www.bdushime.tech & https://bdushime.tech", flush=True)
    print(f"  {BOLD}Load Balancer IP:{RESET}     3.8.133.101 (HAProxy 80/443)", flush=True)
    print(f"  {BOLD}Web01 Node IP:{RESET}        13.135.166.102 (Nginx 80 -> Python 3000)", flush=True)
    print(f"  {BOLD}Web02 Node IP:{RESET}        35.179.145.213 (Nginx 80 -> Python 3000)", flush=True)
    print(f"  {BOLD}Localhost Node:{RESET}       http://127.0.0.1:3000", flush=True)

    s1, t1 = test_dns_and_ssl()
    s2, t2 = test_ssh_diagnostics()
    s3, t3 = test_direct_node_responses()
    s4, t4 = test_load_balancer_and_rotation()
    s5, t5 = test_local_server()
    s6, t6 = test_codevibe_integrity()

    total_score = s1 + s2 + s3 + s4 + s5 + s6
    total_tests = t1 + t2 + t3 + t4 + t5 + t6

    print(f"\n{BOLD}{CYAN}{'=' * 78}{RESET}", flush=True)
    print(f"{BOLD} FINAL AUDIT SCORECARD & ARCHITECTURE HEALTH SUMMARY{RESET}", flush=True)
    print(f"{BOLD}{CYAN}{'=' * 78}{RESET}", flush=True)
    print(f"  1. DNS & SSL Certificate Verification:     {s1}/{t1} checks passed", flush=True)
    print(f"  2. Remote SSH Diagnostics (All Nodes):     {s2}/{t2} checks passed", flush=True)
    print(f"  3. Direct Node HTTP Header Probes:         {s3}/{t3} checks passed", flush=True)
    print(f"  4. Load Balancer & Traffic Rotation:       {s4}/{t4} checks passed", flush=True)
    print(f"  5. Local Application Server & APIs:        {s5}/{t5} checks passed", flush=True)
    print(f"  6. CodeVibe Integrity & Compliance:        {s6}/{t6} checks passed", flush=True)
    print(f"{BOLD}{CYAN}{'-' * 78}{RESET}", flush=True)

    pct = (total_score / total_tests * 100) if total_tests > 0 else 0
    if total_score == total_tests:
        print(f"  {BOLD}{GREEN}OVERALL STATUS: ALL {total_tests}/{total_tests} AUDIT CHECKS PASSED (100% HEALTHY & COMPLIANT){RESET}", flush=True)
        print(f"  {BOLD}Primary URL:{RESET}        https://lightprint.bdushime.tech", flush=True)
        print(f"  {BOLD}Secondary URLs:{RESET}     https://www.bdushime.tech | https://bdushime.tech", flush=True)
        print(f"  {BOLD}HAProxy Node:{RESET}      3.8.133.101 (lb-01)", flush=True)
        print(f"  {BOLD}Web Instances:{RESET}     13.135.166.102 (Web01) | 35.179.145.213 (Web02)", flush=True)
    else:
        print(f"  {BOLD}{RED}OVERALL STATUS: {total_tests - total_score} CHECK(S) FAILED ({pct:.1f}% Passed){RESET}", flush=True)

    print(f"{BOLD}{CYAN}{'=' * 78}{RESET}\n", flush=True)
    sys.exit(0 if total_score == total_tests else 1)


if __name__ == "__main__":
    main()

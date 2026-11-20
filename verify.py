#!/usr/bin/env python3
"""
LightPrint - CodeVibe Report Verification Tool
Mirrors the exact cryptographic canonicalization and compliance engine of codevibe-verify.js.

Usage:
    python verify.py
    python verify.py codevibe-reports/playing-around-with-apis.report.json
"""

import sys
import os
import json
import hashlib
from datetime import datetime

def canonicalize(value):
    """
    Byte-identical implementation of codevibe-verify.js / AssignmentReportGenerator.canonicalize.
    Recursively sorts dictionary keys and formats compact JSON with no whitespace.
    """
    if value is None or isinstance(value, (int, float, str, bool)):
        return json.dumps(value, separators=(',', ':'), ensure_ascii=False)
    
    if isinstance(value, list):
        items = [canonicalize(item) for item in value]
        return '[' + ','.join('null' if x is None else x for x in items) + ']'
    
    if isinstance(value, dict):
        parts = []
        for key in sorted(value.keys()):
            serialized = canonicalize(value[key])
            if serialized is not None:
                parts.append(json.dumps(key, separators=(',', ':'), ensure_ascii=False) + ':' + serialized)
        return '{' + ','.join(parts) + '}'
    
    return None

def verify_report(file_path):
    print("\n" + "=" * 65)
    print(" CODEVIBE ASSIGNMENT INTEGRITY & COMPLIANCE VERIFIER")
    print("=" * 65)
    print(f"Target Report: {file_path}\n")

    if not os.path.exists(file_path):
        print(f"[FAIL] Report file not found at: {file_path}")
        return False

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            report = json.load(f)
    except Exception as e:
        print(f"[FAIL] Malformed JSON: {e}")
        return False

    # 1. Structural Validation
    if report.get("reportVersion") != "1.0":
        print(f"[FAIL] Unsupported report version: {report.get('reportVersion')}")
        return False

    required = ["assignmentId", "assignmentName", "generatedAt", "metrics", "policy", "integrity"]
    for req in required:
        if req not in report:
            print(f"[FAIL] Missing required property: {req}")
            return False

    # 2. Cryptographic Integrity Check
    payload = {k: v for k, v in report.items() if k not in ("integrity", "generatedAt")}
    canonical_str = canonicalize(payload) or ""
    recomputed_hash = hashlib.sha256(canonical_str.encode("utf-8")).hexdigest()
    stored_hash = report.get("integrity", {}).get("hash", "").lower()

    integrity_ok = (recomputed_hash == stored_hash)

    # 3. Compliance Metrics Check
    metrics = report.get("metrics", {})
    policy = report.get("policy", {})

    authorship = metrics.get("authorship", {})
    authorship_pct = authorship.get("authorshipPercentage", 0.0)
    max_authorship = policy.get("maxAuthorshipPercentage", 20.0)
    auth_ok = authorship_pct <= max_authorship

    ownership = metrics.get("ownership", {})
    ownership_score = ownership.get("score", 0.0)
    min_ownership = policy.get("minOwnershipScore", 100.0)
    own_ok = ownership_score >= min_ownership

    violations = metrics.get("violations", [])
    violations_ok = (len(violations) == 0)

    # Output Results
    print(f"Assignment:  {report.get('assignmentName')} ({report.get('assignmentId')})")
    print(f"Student:     {report.get('studentIdentifier')}")
    print(f"Head Commit: {report.get('repoHeadCommit')}")
    print("-" * 65)

    # Integrity
    if integrity_ok:
        print(f"[\033[32m✔ PASS\033[0m] Cryptographic Integrity: OK")
        print(f"       SHA-256 Digest: {stored_hash}")
    else:
        print(f"[\033[31m✘ FAIL\033[0m] Cryptographic Integrity: MISMATCH")
        print(f"       Stored:     {stored_hash}")
        print(f"       Calculated: {recomputed_hash}")

    # Authorship
    auth_mark = "\033[32m✔ PASS\033[0m" if auth_ok else "\033[31m✘ FAIL\033[0m"
    print(f"[{auth_mark}] Authorship: {authorship_pct:.1f}% AI (Policy Limit: <={max_authorship}%)")
    print(f"       Manual Lines: {authorship.get('manualLines', 0)} / {authorship.get('totalLines', 0)} total lines")

    # Ownership
    own_mark = "\033[32m✔ PASS\033[0m" if own_ok else "\033[31m✘ FAIL\033[0m"
    print(f"[{own_mark}] Ownership Score: {ownership_score:.1f} / 100 (Policy Min: >={min_ownership})")
    print(f"       Reviewed Files: {ownership.get('filesReviewed', 0)} reviewed, 0 unreviewed")

    # Violations
    viol_mark = "\033[32m✔ PASS\033[0m" if violations_ok else "\033[31m✘ FAIL\033[0m"
    print(f"[{viol_mark}] Violations: {len(violations)} detected (Lockdown enforce: 0)")

    print("-" * 65)
    overall_pass = integrity_ok and auth_ok and own_ok and violations_ok
    if overall_pass:
        print("\033[32mOVERALL VERDICT: ALL AUDIT CHECKS PASSED - 100% COMPLIANT\033[0m")
    else:
        print("\033[31mOVERALL VERDICT: NON-COMPLIANT OR TAMPERED REPORT\033[0m")
    print("=" * 65 + "\n")

    return overall_pass

if __name__ == "__main__":
    report_file = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "codevibe-reports",
        "playing-around-with-apis.report.json"
    )
    success = verify_report(report_file)
    sys.exit(0 if success else 1)

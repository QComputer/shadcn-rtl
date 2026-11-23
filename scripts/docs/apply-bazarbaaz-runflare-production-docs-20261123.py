#!/usr/bin/env python3
"""Apply an explicitly authorized, idempotent, docs-only Runflare production topology notice.

No Git commands, network, credentials, database, shell subprocesses or external libraries.
This cannot override an agent/tool command policy denial. Never attempt to bypass it.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[2]
MARKER_A = "<!-- BAZARBAAZ_CURRENT_PRODUCTION_TOPOLOGY_20261123: START -->"
MARKER_B = "<!-- BAZARBAAZ_CURRENT_PRODUCTION_TOPOLOGY_20261123: END -->"
REF = "docs/BAZARBAAZ-PRODUCTION-TOPOLOGY-2026-11-23.md"
BACKUP = ROOT / ".tmp" / "bazarbaaz-prod-topology-20261123-backup"

ACTIVE = [
    "docs/hotel/damoon/README.md",
    "docs/hotel/damoon/CURRENT-STATE-2026-11-23.md",
    "docs/hotel/damoon/NEXT-AGENT-HANDOFF-2026-11-23.md",
    "docs/hotel/damoon/ARCHITECTURE-AND-CONTRACTS-2026-11-23.md",
    "docs/hotel/damoon/RUNFLARE-RELEASE-AND-EVIDENCE-2026-11-23.md",
    "docs/hotel/damoon/PRODUCTION-BOOKING-AND-DB-GATES-2026-11-23.md",
    "docs/hotel/damoon/EXECUTION-ROADMAP-2026-11-23.md",
    "docs/hotel/damoon/ACCOMMODATION-ADMIN-AND-CONTENT-CONTRACT-2026-11-23.md",
    "docs/hotel/damoon/READ-ONLY-PRODUCTION-PREFLIGHT-RUNBOOK.md",
    "docs/hotel/damoon/REQUEST-TO-RECEPTION-ACCEPTANCE-2026-11-23.md",
    "docs/hotel/damoon/OWNER-DECISION-DELTA-2026-11-23.md",
    "docs/hotel/damoon/evidence/DOC-AUDIT-INDEX-2026-11-23.json", # Optional JSON handled separately
]
HISTORICAL = [
    "docs/CURRENT_SOURCE_OF_TRUTH.md",
    "docs/NEXT_PHASE_ROADMAP.md",
    "docs/INCIDENT_REPORT_20260815.md",
    "docs/migration/runflare/DATABASE-TOPOLOGY-VERIFICATION-REPORT.md",
    "docs/BB_PRODUCTION_READONLY_INSPECTION_PLAN.md",
    "docs/hotel/F5-CLOUD-ACCEPTANCE-PLAN.md",
    "docs/hotel/F5-NEON-MIGRATION-BASELINE.md",
]
PROD_IDENTITY_MD = "docs/hotel/damoon/OWNER-DECISION-PRODUCTION-DATABASE-RUNFLARE-PRODUCT-2026-11-23.md"
CMS_MD = "docs/hotel/damoon/CMS-PRODUCTION-503-READ-ONLY-RUNBOOK-2026-11-23.md"
REMOTE_DB_CONTRACT_MD = "docs/BAZARBAAZ-REMOTE-DB-CONNECTION-CONTRACT-2026-11-23.md"

def notice(kind: str, rel: str) -> str:
    link = "/" + REF
    if kind == "active":
        body = (
            "> **CURRENT PRODUCTION INFRASTRUCTURE — OWNER CONFIRMED, 2026-11-23:** "
            "Runflare project `product` (ID `37622`); application service `87432`; "
            "**Production PostgreSQL-PostGIS 17.3 `maindb` service `87429` (active, console observed)**. "
            "The application's actual database target/binding is still **UNVERIFIED**. "
            "**Neon is NOT Production; Render is unrelated.** "
            "All authorized remote DB connection URIs must come only from `DB_REMOTE_URI`, "
            "fail closed if missing, never log the value; this does not authorize a connection. "
            "Static Damoon 3/17/6/3/2 fallback is verified, but dynamic CMS GET returned "
            "Nginx HTML HTTP 503 and Production CMS publication remains unaccepted. "
            "PR140, Production writes/migrations, booking/payment and unapproved feature changes remain ON HOLD. "
            f"Current reference: `{REF}`. Historical Neon documents are not current operational authority."
        )
    else:
        body = (
            "> **HISTORICAL / NON-OPERATIONAL NEON CONTEXT — SUPERSEDED FOR CURRENT PRODUCTION (2026-11-23).** "
            "Older Neon-as-Production statements reflect their original dates and must NOT "
            "be used as current deployment/database identity or execution instructions. "
            "Current Production: Runflare project `product` / `37622`, app `87432`, "
            "active PostgreSQL-PostGIS `maindb` / `87429`; runtime binding unverified. "
            "Neon NOT Production; Render unrelated. "
            "Remote DB URI source is `DB_REMOTE_URI` only (never print its value); "
            "do not run obsolete Neon-attestation scripts. "
            f"Use `{REF}`. "
            "**Especially do not execute the older Neon-attested Production inspection tooling against current Production.**"
        )
    return f"{MARKER_A}\n{body}\n{MARKER_B}"

def change_md(content: str, kind: str, rel: str) -> str:
    marker = notice(kind, rel)
    if MARKER_A in content or MARKER_B in content:
        if content.count(MARKER_A) != 1 or content.count(MARKER_B) != 1:
            raise ValueError("broken or repeated protected markers: " + rel)
        updated = re.sub(
            re.escape(MARKER_A) + r".*?" + re.escape(MARKER_B),
            lambda _: marker, content, count=1, flags=re.S
        )
    else:
        updated = marker + "\n\n" + content
    if rel == "docs/hotel/damoon/NEXT-AGENT-HANDOFF-2026-11-23.md":
        # Exact old false positive only; do not broad-replace accepted test states.
        updated = updated.replace(
            "public read کاتالوگ پس از انتشار روی Production نیز فقطخواندنی پذیرفته شده.",
            "فقط نمایش **static fallback** کاتالوگ در Production پذیرفته شده؛ "
            "**dynamic CMS public read/edit/publish** به دلیل HTML HTTP 503 هنوز پذیرفته نشده است."
        )
    return updated

def merge_json(content: str, rel: str) -> str:
    obj = json.loads(content)
    if not isinstance(obj, dict):
        raise ValueError("expected root JSON object: " + rel)
    value = {
        "source": REF,
        "decisionDate": "2026-11-23",
        "authority": "OWNER_EXPLICIT_CORRECTION_AND_RUNFLARE_CONSOLE_OBSERVATION",
        "runflareProject": {"name": "product", "id": "37622"},
        "appServiceId": "87432",
        "databaseService": {"name": "maindb", "id": "87429", "engine": "PostgreSQL-PostGIS", "version": "17.3", "status": "ACTIVE_OBSERVED"},
        "actualApplicationDatabaseTarget": "UNVERIFIED",
        "neonProduction": False,
        "renderRelated": False,
        "remoteDatabaseConnection": {
            "environmentVariable": "DB_REMOTE_URI",
            "exclusiveUriSource": True,
            "failClosedIfMissing": True,
            "secretValueDisclosed": False,
            "connectionAuthorizedByThisRecord": False,
            "appRuntimeBindingProvenByThisVariable": False,
            "prohibitedFallbacks": ["DATABASE_URL", "DIRECT_URL", "BB_PRODUCTION_READONLY_URL", "NEON_URI", "HARDCODED_URI"],
        },
        "cmsPublicApi": {"http": 503, "body": "NGINX_HTML", "origin": "UNCONFIRMED", "dynamicProductionAccepted": False},
        "productionMigrationAllowed": False,
        "productionWritesAllowed": False,
        "pr140MergeAllowed": False,
    }
    if rel.endswith("RELEASE-REGISTER-2026-11-23.json"):
        key = "productionTopologyOwnerVerified20261123"
    else:
        key = "productionTopologyReferenceOwnerVerified20261123"
    if obj.get(key) == value:
        return content
    if key in obj and obj[key] != value:
        # Only allow the exact earlier v1 payload (same data, no remote-URI field)
        # to upgrade without overwriting unrelated new evidence or drift.
        previous = dict(value)
        previous.pop("remoteDatabaseConnection")
        if obj[key] != previous:
            raise ValueError("existing topology statement has drifted, reconcile manually: " + rel)
    obj[key] = value
    return json.dumps(obj, ensure_ascii=False, indent=2) + "\n"

def guarded_path(rel: str) -> Path:
    p = (ROOT / rel).resolve()
    if not p.is_relative_to(ROOT.resolve()):
        raise ValueError("unsafe path " + rel)
    return p

def main() -> int:
    cli = argparse.ArgumentParser()
    cli.add_argument("--apply", action="store_true", help="write docs after explicit tool-policy authorization")
    args = cli.parse_args()
    for mandatory in [REF, PROD_IDENTITY_MD, CMS_MD, REMOTE_DB_CONTRACT_MD]:
        if not guarded_path(mandatory).is_file():
            print("BLOCKED missing required source:", mandatory, file=sys.stderr)
            return 3
    if not guarded_path("docs/hotel/damoon/evidence/RELEASE-REGISTER-2026-11-23.json").is_file():
        print("BLOCKED missing release register", file=sys.stderr)
        return 3
    targets = [(x, "active") for x in ACTIVE if not x.endswith(".json")]
    targets += [(x, "historic") for x in HISTORICAL]
    targets += [(str(p.relative_to(ROOT)), "historic") for p in sorted((ROOT / "docs/database").glob("NEON_*.md"))]
    jobs, missing = [], []
    for rel, kind in targets:
        p = guarded_path(rel)
        if not p.exists():
            missing.append(rel)
            continue
        old = p.read_bytes()
        new = change_md(old.decode("utf-8"), kind, rel).encode("utf-8")
        if old != new:
            jobs.append((p, old, new))
    # JSON files are strict and separately scoped to status evidence.
    for rel in [
        "docs/hotel/damoon/evidence/RELEASE-REGISTER-2026-11-23.json",
        "docs/hotel/damoon/evidence/PRODUCTION-DATABASE-RUNFLARE-PRODUCT-OWNER-2026-11-23.json",
    ]:
        p = guarded_path(rel)
        if not p.exists():
            missing.append(rel)
            continue
        old = p.read_bytes()
        new = merge_json(old.decode("utf-8"), rel).encode("utf-8")
        if old != new:
            jobs.append((p, old, new))
    for p, _, _ in jobs:
        print(("APPLY " if args.apply else "WOULD_APPLY ") + str(p.relative_to(ROOT)))
    for rel in missing:
        print("SKIP_MISSING " + rel)
    if args.apply:
        for p, old, new in jobs:
            backup = BACKUP / p.relative_to(ROOT)
            backup.parent.mkdir(parents=True, exist_ok=True)
            if backup.exists() and backup.read_bytes() != old:
                backup = backup.with_name(backup.name + "." + hashlib.sha256(old).hexdigest()[:12])
            if not backup.exists():
                backup.write_bytes(old)
            p.write_bytes(new)
    print(f"{'Applied' if args.apply else 'Dry-run'}: {len(jobs)} files; {len(missing)} missing optional docs.")
    print("NO network, DB, SQL, credentials, runtime code, Git commits or Production changes.")
    return 0

if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, UnicodeError, ValueError, json.JSONDecodeError) as exc:
        print("BLOCKED: " + str(exc), file=sys.stderr)
        sys.exit(3)

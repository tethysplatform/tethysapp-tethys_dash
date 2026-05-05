#!/usr/bin/env python
"""Audit persisted GridItem rows for ESRI Image and Map Service `params.LAYERS` shapes.

Categorizes every persisted ESRI Image and Map Service layer's `params.LAYERS`
value as one of:

  - canonical: starts with a recognized directive prefix (show:/hide:/include:/exclude:)
  - bare: bare integer or comma-separated integers (e.g. "0", "0,1,2")
  - other: anything else (suspicious; warrants human review before R3 ships)

Run before plan 2026-05-05-001 Unit 4 lands. See:
docs/plans/2026-05-05-001-fix-esri-layers-directive-parsing-plan.md (Unit 1)

Usage:
    python audit_esri_layers.py [path-to-sqlite-db]

Defaults to ~/.tethys/e2e-test/tethysdash_primary_db.sqlite if no path given.

Scope: this script connects to a SQLite tethysdash persistent store directly
via the sqlite3 stdlib module. It does NOT support Postgres production
deployments — running against Postgres would require rewriting the connection
path to use the SQLAlchemy session pattern documented in
tethysapp-tethys_dash/CLAUDE.md (which depends on a running Tethys app
context). For a production-store audit, the per-row categorization logic in
this file (the categorize() and audit() functions) can be reused; replace the
sqlite3.connect() call with a SQLAlchemy session and adapt the SELECT.
"""
import json
import os
import re
import sqlite3
import sys

DIRECTIVE_PREFIXES = ("show:", "hide:", "include:", "exclude:")
BARE_RE = re.compile(r"^[0-9]+(,[0-9]+)*$")
ESRI_TYPE = "ESRI Image and Map Service"


def categorize(value):
    if not isinstance(value, str):
        return "other"
    stripped = value.strip()
    if any(stripped.startswith(p) for p in DIRECTIVE_PREFIXES):
        return "canonical"
    if BARE_RE.match(stripped):
        return "bare"
    return "other"


def audit(db_path):
    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    cur.execute("SELECT id, args_string FROM griditems WHERE source = 'Map'")

    counts = {"canonical": 0, "bare": 0, "other": 0}
    samples = {"bare": [], "other": []}
    total_esri_layers = 0
    total_map_griditems = 0

    for row in cur:
        total_map_griditems += 1
        if not row["args_string"]:
            continue
        try:
            args = json.loads(row["args_string"])
        except json.JSONDecodeError:
            continue

        for layer in args.get("layers", []):
            source = layer.get("configuration", {}).get("props", {}).get("source", {})
            if source.get("type") != ESRI_TYPE:
                continue
            params = source.get("props", {}).get("params", {})
            if "LAYERS" not in params:
                continue
            value = params["LAYERS"]
            total_esri_layers += 1
            cat = categorize(value)
            counts[cat] += 1
            if cat in ("bare", "other") and len(samples[cat]) < 5:
                samples[cat].append({"griditem_id": row["id"], "value": value})

    con.close()
    return {
        "db_path": db_path,
        "total_map_griditems": total_map_griditems,
        "total_esri_layers": total_esri_layers,
        "counts": counts,
        "samples": samples,
    }


def main():
    default_db = os.path.expanduser("~/.tethys/e2e-test/tethysdash_primary_db.sqlite")
    db_path = sys.argv[1] if len(sys.argv) > 1 else default_db

    if not os.path.exists(db_path):
        print(f"Database not found: {db_path}", file=sys.stderr)
        sys.exit(2)

    result = audit(db_path)
    print(json.dumps(result, indent=2))

    if result["counts"]["other"] > 0:
        print("\nESCALATE: 'other' values present; review samples before proceeding with R3.", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

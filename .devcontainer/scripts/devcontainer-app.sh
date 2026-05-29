#!/usr/bin/env bash
# TethysDash app-specific setup. Bash equivalent of the agwa pattern in
# tethys_portal_firo/docker/salt/init_apps.sls — provisions the SQLite
# persistent store, links it to the tethysdash app, syncs stores. Runs
# AFTER scripts/tethyscore.sh; assumes the database is migrated and the
# tethysdash app row exists.
#
# Touches the shared marker
# (${TETHYS_PERSIST}/tethysdash_devcontainer_setup_complete) at the end
# so subsequent runs of init.sh become no-ops.

set -euo pipefail

: "${TETHYS_PERSIST:?TETHYS_PERSIST must be set}"
MARKER="${TETHYS_PERSIST}/tethysdash_devcontainer_setup_complete"

if [ -f "${MARKER}" ]; then
    echo "[devcontainer-app] setup marker present, skipping"
    exit 0
fi

# Resolve the tethysdash app workspace path. `tethys paths get` returns a
# path inside the source tree (e.g.
#   /workspaces/tethysapp-tethys_dash/tethysapp/tethysdash/workspaces/app_workspace/
# ), with ANSI color codes embedded. Strip them — same regex as
# tethysapp/tethysdash/cli.py:156. The path is git-ignored at
# .gitignore:11 (`tethysapp/tethysdash/workspaces/`).
echo "[devcontainer-app] resolving tethysdash app workspace..."
WORKSPACE=$(tethys paths get -t app_workspace -a tethysdash \
    | sed -e 's/\x1b\[[0-9;]*m//g' \
    | tail -n 1 \
    | tr -d '\n')

if [ -z "${WORKSPACE}" ]; then
    echo "[devcontainer-app] ERROR: could not resolve tethysdash app workspace" >&2
    exit 1
fi

echo "[devcontainer-app] workspace = ${WORKSPACE}"
mkdir -p "${WORKSPACE}"

# `tethys services create persistent` is non-idempotent — fails if the
# service already exists. Guard with a list-then-create pattern so a
# mid-chain rerun (marker absent because devcontainer-app.sh failed
# earlier) doesn't trip on this step.
echo "[devcontainer-app] creating SQLite persistent store (if absent)..."
if tethys services list -p 2>/dev/null | grep -q "tethysdash_sqlite"; then
    echo "[devcontainer-app] tethysdash_sqlite service already exists; skipping create"
else
    tethys services create persistent \
        -n tethysdash_sqlite \
        -t sqlite \
        -d "${WORKSPACE}"
fi

# `tethys link` may also fail if the link already exists. Same defensive
# pattern. If it fails for a real reason, the marker isn't touched and
# the next init.sh run hits this script again.
echo "[devcontainer-app] linking persistent store to primary_db..."
tethys link persistent:tethysdash_sqlite tethysdash:ps_database:primary_db || {
    echo "[devcontainer-app] tethys link returned non-zero (likely already linked); continuing"
}

echo "[devcontainer-app] syncing app persistent stores..."
tethys syncstores tethysdash

echo "[devcontainer-app] flagging setup complete: ${MARKER}"
touch "${MARKER}"

echo "[devcontainer-app] tethysdash setup complete."

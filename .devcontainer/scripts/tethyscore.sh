#!/usr/bin/env bash
# Portal-level Tethys setup. Bash equivalent of the agwa pattern in
# tethys_portal_firo/docker/tethyscore.sls — generates portal_config,
# applies dev-mode settings, migrates the database, creates the default
# superuser. Runs FIRST, before scripts/devcontainer-app.sh.
#
# Idempotence: ${TETHYS_PERSIST}/tethysdash_devcontainer_setup_complete is
# the shared marker. If it exists, this script exits without doing
# anything. The marker is touched by devcontainer-app.sh after the full
# chain succeeds — so a partial failure leaves the marker absent and
# init.sh reruns this script from the top.
#
# All commands here are idempotent: `tethys gen portal_config --overwrite`
# tolerates a pre-existing config; `tethys settings --set` is set-not-add;
# `tethys db migrate` is Django's standard idempotent migrate; and
# `tethys db createsuperuser --pn ...` exits 0 with "already exists" when
# the user is present.

set -euo pipefail

: "${TETHYS_PERSIST:?TETHYS_PERSIST must be set}"
MARKER="${TETHYS_PERSIST}/tethysdash_devcontainer_setup_complete"

if [ -f "${MARKER}" ]; then
    echo "[tethyscore] setup marker present, skipping"
    exit 0
fi

mkdir -p "${TETHYS_PERSIST}"

echo "[tethyscore] generating portal_config.yml..."
tethys gen portal_config --overwrite

echo "[tethyscore] applying dev settings (DEBUG, ALLOWED_HOSTS, SQLite engine)..."
tethys settings \
    --set DEBUG True \
    --set ALLOWED_HOSTS "['*']" \
    --set DATABASES.default.ENGINE django.db.backends.sqlite3 \
    --set DATABASES.default.NAME "${TETHYS_PERSIST}/tethysdash.sqlite"

echo "[tethyscore] migrating database..."
tethys db migrate

echo "[tethyscore] creating default superuser (admin / admin)..."
tethys db createsuperuser \
    --pn admin \
    --pp admin \
    --pe admin@example.com

echo "[tethyscore] portal-level setup complete."

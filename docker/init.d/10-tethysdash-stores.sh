#!/usr/bin/env bash
#
# Provision hook (run by tethys-uvx provision.sh, after migrate + superuser).
# Creates the tethysdash `primary_db` persistent store on SQLite - no Postgres.
#
# A Tethys persistent store needs a persistent-store SERVICE assigned to it
# (get_value() raises otherwise). For SQLite that service is a directory, and
# `syncstores` then creates <TETHYS_PERSIST>/tethysdash_primary_db.sqlite via
# the SQLiteDatabaseHandler. All three steps are idempotent.
set -euo pipefail

PS_SERVICE="${TETHYSDASH_PS_SERVICE:-tethysdash_sqlite}"
PS_DIR="${TETHYS_PERSIST:-/home/tethys/persist}"

# The image symlinks the app's in-package workspaces/media onto the persist
# volume; create the targets here (on a fresh volume they don't exist yet) so
# TethysWorkspace's mkdir doesn't trip over a dangling symlink during syncstores.
echo "[tethysdash-stores] preparing workspace + media dirs on the volume"
mkdir -p "${PS_DIR}/app/tethysdash/workspaces" "${PS_DIR}/app/tethysdash/media"

echo "[tethysdash-stores] registering apps"
tethys db sync

echo "[tethysdash-stores] ensuring SQLite persistent-store service '${PS_SERVICE}'"
tethys services create persistent -n "${PS_SERVICE}" -t sqlite -d "${PS_DIR}" \
  || echo "  (service '${PS_SERVICE}' already exists)"

echo "[tethysdash-stores] linking service to tethysdash:ps_database:primary_db"
tethys link "persistent:${PS_SERVICE}" "tethysdash:ps_database:primary_db" \
  || echo "  (link already present)"

echo "[tethysdash-stores] syncing persistent stores (creates the sqlite file + init_primary_db)"
tethys syncstores all

echo "[tethysdash-stores] done"

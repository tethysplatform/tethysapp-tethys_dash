#!/usr/bin/env bash
# Devcontainer postCreateCommand. Runs the two-stage idempotent setup:
#   scripts/tethyscore.sh       — portal-level Tethys setup
#   scripts/devcontainer-app.sh — tethysdash app-specific setup
#
# The two-script split mirrors the workspace pattern at
# tethys_portal_firo/docker/tethyscore.sls + ./salt/init_apps.sls —
# implemented in bash because pip-installed Salt has incomplete
# transitive deps and the SaltProject apt repo isn't reliably reachable
# from all build environments.
#
# Idempotence: every step is gated by
# ${TETHYS_PERSIST}/tethysdash_devcontainer_setup_complete. Re-running
# after first-time setup is a no-op until the marker is removed (see
# .devcontainer/README.md > Troubleshooting).

set -euo pipefail

cd "$(dirname "$0")"

bash scripts/tethyscore.sh
bash scripts/devcontainer-app.sh

#!/usr/bin/env bash
# Start the TethysDash dev server inside the devcontainer.
# Bind to 0.0.0.0 so the host's forwarded port reaches it.

set -euo pipefail

echo "Starting Tethys dev server on 0.0.0.0:8000 (DEBUG=True)..."
exec tethys manage start -p 0.0.0.0:8000

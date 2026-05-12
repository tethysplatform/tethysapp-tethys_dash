# Backend-only devcontainer for TethysDash.
# Pip-only environment, SQLite persistent store, no Node/Webpack.
# See .devcontainer/README.md for usage; docs/plans/2026-05-06-001-feat-backend-only-devcontainer-plan.md for design.

FROM python:3.11-slim

# Tethys path conventions, used by Salt states under .devcontainer/salt/.
# Same value in v1; structured so a future iteration can repoint TETHYS_PERSIST
# to a volume-mounted path without touching Salt code.
ENV TETHYS_HOME=/root/.tethys
ENV TETHYS_PERSIST=/root/.tethys

ENV VIRTUAL_ENV=/opt/venv
ENV PATH="${VIRTUAL_ENV}/bin:${PATH}"
ENV PYTHONDONTWRITEBYTECODE=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1

# OS deps:
#   build-essential + libpq-dev — psycopg2-binary fallback if no manylinux wheel matches
#   git, curl, ca-certificates — devcontainer hygiene
# No GDAL/proj/geos: tethys-platform 4.5.1 PyPI deps include none, and tethysdash
# imports nothing from osgeo/gdal/fiona/shapely/geopandas (verified 2026-05-06).
# No Salt: pip-distributed Salt has incomplete install_requires on slim Python
# images (missing looseversion, distro, more), and the SaltProject apt repo
# isn't reliably reachable from all build environments. Provisioning is bash
# scripts under .devcontainer/scripts/ instead — same idempotence semantics
# as the agwa .sls pattern, no install footprint.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        git \
        curl \
        ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Isolated venv. Tethysdash + its deps land here; system pip stays clean.
RUN python -m venv "${VIRTUAL_ENV}"

WORKDIR /workspaces/tethysapp-tethys_dash

# Build context is the subrepo root (.devcontainer/.. via devcontainer.json `build.context`).
# At runtime, the host workspace bind-mounts over this path; the editable install
# from build time still resolves because absolute paths match.
COPY . .

# Editable install with the [test] extra.
RUN pip install --no-cache-dir -e ".[test]"

# (MCP contract test build gate removed: the embedded MCP server was extracted
# into the standalone repo Aquaveo/tethysdash_mcps and is now published as
# ghcr.io/aquaveo/tethysdash-mcps. The contract suite lives there; this image
# no longer ships the MCP server, so no contract test runs at build time.)

EXPOSE 8000

# No CMD: the devcontainer host (VS Code / Codex) keeps the container alive via
# overrideCommand. Contributor runs `bash .devcontainer/run.sh` to start the server.

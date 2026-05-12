# TethysDash devcontainer.
#
# Multi-stage build:
#   Stage 1 (frontend-builder): node:20-slim runs `npm ci` + `npm run build`
#     to produce the React production bundle at
#     tethysapp/tethysdash/public/frontend/. Node and node_modules live
#     ONLY in this stage and are discarded.
#   Stage 2 (runtime): python:3.11-slim with the editable pip install,
#     pulling the built bundle in via `COPY --from=frontend-builder`.
#
# Why baked at build time: the image always ships a bundle that matches the
# source at the COPYed commit. Eliminates the "remember to npm run build &&
# git add public/frontend/main.js" trap that produced silent UI drift on
# stale-commit workshop deploys. See docs/solutions/integration-issues/...
# and the workshop's setup.sh which asserts public/frontend/main.js exists.
#
# History: this Dockerfile was previously backend-only (pip-only, no Node)
# per docs/plans/2026-05-06-001-feat-backend-only-devcontainer-plan.md. The
# multi-stage refactor preserves the backend-only RUNTIME image (no Node in
# the final layers) while restoring fresh-bundle guarantee at build time.
# See .devcontainer/README.md for usage.

# ---------------------------------------------------------------------------
# Stage 1: frontend bundle
# ---------------------------------------------------------------------------
FROM node:20-slim AS frontend-builder

WORKDIR /build

COPY package.json package-lock.json ./

# Swap the `@chatbox/core` file: link → published npm alias before install.
# package.json declares `"@chatbox/core": "file:../lib/chatbox-core"` for
# co-evolution in the firoh workspace, but that path is NOT inside this
# Docker build context — npm would fail to resolve it. `npm:` alias keeps
# the consumer import paths (`@chatbox/core/components`, `.../messages`)
# unchanged. Bump the version when chatbox-core ships a new release.
RUN sed -i \
        's|"@chatbox/core": "file:\.\./lib/chatbox-core"|"@chatbox/core": "npm:@aquaveo/chatbox-core@0.6.0"|' \
        package.json \
    && rm package-lock.json \
    && npm install --no-audit --no-fund

# Source + configs webpack needs. Listed explicitly (not `COPY . .`) so a
# Python-only change doesn't invalidate the npm cache layer above.
COPY babel.config.json jsconfig.json ./
COPY reactapp/ ./reactapp/
COPY tethysapp/tethysdash/public/ ./tethysapp/tethysdash/public/

# Produces /build/tethysapp/tethysdash/public/frontend/main.js + sibling chunks.
# webpack's `--mode production` reads ./reactapp/config/production.env if
# present (gitignored; falls back to default tethys_prefix_url when absent —
# verified safe via the webpack config's `process.env.TETHYS_PREFIX_URL`
# fallback branch).
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2: runtime (python:3.11-slim, pip-only)
# ---------------------------------------------------------------------------
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

# Overwrite the (possibly stale) committed bundle with the fresh one produced
# in stage 1. Must come AFTER `COPY . .` to clobber any stale main.js that
# rode in via the broad copy. Placed after pip install so reactapp-source
# changes don't bust the pip layer cache.
COPY --from=frontend-builder \
     /build/tethysapp/tethysdash/public/frontend/ \
     /workspaces/tethysapp-tethys_dash/tethysapp/tethysdash/public/frontend/

# (MCP contract test build gate removed: the embedded MCP server was extracted
# into the standalone repo Aquaveo/tethysdash_mcps and is now published as
# ghcr.io/aquaveo/tethysdash-mcps. The contract suite lives there; this image
# no longer ships the MCP server, so no contract test runs at build time.)

EXPOSE 8000

# No CMD: the devcontainer host (VS Code / Codex) keeps the container alive via
# overrideCommand. Contributor runs `bash .devcontainer/run.sh` to start the server.

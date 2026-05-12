# TethysDash devcontainer. Multi-stage: node:20-slim builds the React bundle;
# python:3.11-slim runtime pulls it in. Node lives only in stage 1.

# Stage 1: frontend bundle
FROM node:20-slim AS frontend-builder

WORKDIR /build

COPY package.json package-lock.json ./

# Swap `@chatbox/core` file: link → published npm alias; the sibling source
# isn't in this build context. Bump version when chatbox-core releases.
RUN sed -i \
        's|"@chatbox/core": "file:\.\./lib/chatbox-core"|"@chatbox/core": "npm:@aquaveo/chatbox-core@0.6.0"|' \
        package.json \
    && rm package-lock.json \
    && npm install --no-audit --no-fund

# Explicit COPYs (not `COPY . .`) so Python-only changes don't bust the npm layer.
COPY babel.config.json jsconfig.json ./
COPY reactapp/ ./reactapp/
COPY tethysapp/tethysdash/public/ ./tethysapp/tethysdash/public/

RUN npm run build

# Stage 2: runtime (python:3.11-slim, pip-only)
FROM python:3.11-slim

ENV TETHYS_HOME=/root/.tethys
ENV TETHYS_PERSIST=/root/.tethys
ENV VIRTUAL_ENV=/opt/venv
ENV PATH="${VIRTUAL_ENV}/bin:${PATH}"
ENV PYTHONDONTWRITEBYTECODE=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1

# build-essential + libpq-dev for psycopg2-binary source fallback; rest is dev hygiene.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        git \
        curl \
        ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv "${VIRTUAL_ENV}"

WORKDIR /workspaces/tethysapp-tethys_dash

COPY . .

RUN pip install --no-cache-dir -e ".[test]"

# Overlay the fresh bundle from stage 1, clobbering any stale main.js from `COPY . .`.
COPY --from=frontend-builder \
     /build/tethysapp/tethysdash/public/frontend/ \
     /workspaces/tethysapp-tethys_dash/tethysapp/tethysdash/public/frontend/

EXPOSE 8000

# No CMD: devcontainer host keeps the container alive via overrideCommand;
# contributor runs `bash .devcontainer/run.sh` to start the server.

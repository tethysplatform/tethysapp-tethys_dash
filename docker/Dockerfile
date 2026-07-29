# syntax=docker/dockerfile:1
#
# TethysDash portal image, built on the tethys-uvx base (uv, no conda, uvicorn).
#
#   frontend : builds the React bundle (Node 20 lives in tethys-uvx:builder).
#   build    : installs tethysdash + the user's chosen plugins into the venv,
#              overlaying the freshly built bundle.
#   runtime  : tethys-uvx:runtime-base + the app-augmented venv + portal config
#              + the one provisioning hook (sqlite persistent store).
#
# Build context is the repo root:  docker build -f docker/Dockerfile .
ARG TETHYS_UVX_BUILDER=ghcr.io/aquaveo/tethys-uvx:builder
ARG TETHYS_UVX_RUNTIME=ghcr.io/aquaveo/tethys-uvx:runtime-base

###############################################################################
# frontend - React bundle -> tethysapp/tethysdash/public/frontend/
# Kept separate so node_modules never enters the Python build context.
###############################################################################
FROM ${TETHYS_UVX_BUILDER} AS frontend

WORKDIR /build
# babel config travels inside package.json (the "babel" key), so package.json
# alone is enough for the toolchain.
COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund
COPY jsconfig.json ./
COPY reactapp/ ./reactapp/
COPY tethysapp/tethysdash/public/ ./tethysapp/tethysdash/public/
RUN npm run build

###############################################################################
# build - install tethysdash + plugins into the venv
###############################################################################
FROM ${TETHYS_UVX_BUILDER} AS build

WORKDIR /src
COPY . /src
# Overlay the built bundle (the source tree ships it empty).
COPY --from=frontend /build/tethysapp/tethysdash/public/frontend/ \
     /src/tethysapp/tethysdash/public/frontend/

# tethysdash pulls in channels_redis, django-redis, pydantic-ai, tethys, etc.
# Plugins are user-chosen (docker/plugins.txt) and self-register via intake
# entry-points - no code change needed to add or drop one.
RUN uv pip install --no-cache . \
  && if [ -s docker/plugins.txt ]; then uv pip install --no-cache -r docker/plugins.txt; fi

# Tethys writes the app workspace/media INSIDE the installed package
# (project_directory/"workspaces"), which is root-owned and read-only for the
# uid-1000 runtime user, and would be lost on container recreation anyway.
# Redirect both onto the persist volume so they are writable and durable.
RUN for d in /opt/conda/envs/tethys/lib/python*/site-packages/tethysapp/tethysdash; do \
      rm -rf "$d/workspaces" "$d/media"; \
      ln -sfn /home/tethys/persist/app/tethysdash/workspaces "$d/workspaces"; \
      ln -sfn /home/tethys/persist/app/tethysdash/media "$d/media"; \
      mkdir -p "$d/resources" && chmod a+rX "$d/resources"; \
    done

###############################################################################
# runtime - slim base + the app-augmented venv
###############################################################################
FROM ${TETHYS_UVX_RUNTIME} AS runtime

COPY --from=build /opt/python /opt/python
COPY --from=build /opt/conda  /opt/conda

# Declarative portal config (valkey channels/cache, chat env) and the sqlite
# persistent-store provisioning hook that provision.sh runs.
COPY --chown=1000:1000 docker/portal_config.yml /config/portal_config.yml
COPY --chmod=0755 docker/init.d/ /opt/portal/init.d/

# serve.sh CMD is inherited from the base.

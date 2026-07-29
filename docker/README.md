# TethysDash — Docker (SQLite + Valkey + Ollama)

A self-contained TethysDash stack you can bring up with one command. No Postgres:
both the Tethys portal DB and the tethysdash `primary_db` persistent store run on
SQLite. The chatbot talks to a local Ollama model. Built on the
[`tethys-uvx`](https://github.com/aquaveo/tethys-uvx) base image.

## Services

| Service | Role |
|---|---|
| `valkey` | Channels layer (visualization-progress WebSocket) + chatbot cache |
| `ollama` | Serves the local chat model |
| `ollama-pull` | One-shot: pulls the model, then exits |
| `tethysdash-provision` | One-shot: migrate → SQLite persistent store → superuser |
| `tethysdash` | The web app; waits for the above, serves on `:8000` |

## Quick start

```bash
cp docker/.env.example docker/.env
# edit docker/.env — set TETHYS_SECRET_KEY at minimum
docker compose -f docker/docker-compose.yml up --build
```

Then open http://localhost:8000 (log in with `PORTAL_SUPERUSER_NAME` /
`PORTAL_SUPERUSER_PASSWORD` from `.env`). The first run downloads the model
(~5.6 GB for `ornith:9b`), cached in the `ollama-models` volume.

## Choosing plugins

Edit **`docker/plugins.txt`** — one pip requirement per line (PyPI name or
`git+https://…`). Each plugin self-registers via intake entry-points, so no code
changes are needed. Rebuild to apply:

```bash
docker compose -f docker/docker-compose.yml build tethysdash
```

## Common tweaks

- **Different model:** set `TETHYSDASH_CHAT_LOCAL_MODEL` in `.env` (must exist on ollama.com).
- **GPU for Ollama:** uncomment the `deploy.resources` block on the `ollama` service.
- **Production server (uvicorn instead of the dev server):** set `TETHYS_DEBUG=false` in `.env`.
- **Port already in use** (e.g. a local `tethys manage start` on 8000): set
  `TETHYSDASH_HOST_PORT` in `.env` to a free port.

## Troubleshooting

- **`ollama-pull` fails with `412: requires a newer version of Ollama`:** your
  locally-cached `ollama/ollama:latest` image is stale (Docker does not re-pull
  `:latest` on its own). Refresh it and bring the stack back up:
  ```bash
  docker pull ollama/ollama:latest
  docker compose -f docker/docker-compose.yml up -d --force-recreate ollama
  ```

## Data & reset

All state lives in named volumes (`tethys-persist`, `ollama-models`, `valkey-data`).
Wipe everything with:

```bash
docker compose -f docker/docker-compose.yml down -v
```

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

## Chat performance

The dominant chat latency is Ollama loading the ~5.6 GB model, so the stack is
tuned to pay that cost once, up front:

- **GPU** is the biggest lever. If the host has an NVIDIA GPU, uncomment the
  `deploy.resources` block on the `ollama` service (needs the NVIDIA Container
  Toolkit). Everything below helps on CPU too.
- **Keep the model resident:** `OLLAMA_KEEP_ALIVE` (default `24h`) stops Ollama
  from unloading the model between prompts, which otherwise re-adds the ~8 s cold
  load. Set `-1` to never unload.
- **Warm start:** the `ollama-pull` step runs one throwaway generation after the
  pull, so the model is already in memory before the first real prompt.
- **Capped context:** `OLLAMA_CONTEXT_LENGTH` (default `8192`) avoids sizing the
  KV cache to `ornith`'s 256K default, a big memory/compute saving. Raise it only
  if a prompt needs more room.
- **Flash attention + quantized KV cache:** `OLLAMA_FLASH_ATTENTION=1` and
  `OLLAMA_KV_CACHE_TYPE=q8_0` (the latter needs flash attention) speed attention
  and shrink cache memory, which helps most on CPU.
- **Smaller / more quantized model:** set `TETHYSDASH_CHAT_LOCAL_MODEL` to a
  lighter tag (e.g. a smaller `ornith`/`qwen` build) for faster tokens on CPU.

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

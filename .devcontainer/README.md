# Backend-only devcontainer for TethysDash

A self-contained dev environment for working on the Python / Django / Tethys side of TethysDash. Pip-only (no conda), SQLite (no Postgres), no Node / Webpack. The frontend is served from the bundled `tethysapp/tethysdash/public/frontend/` assets that are committed to the repo.

If you need to do React work, use the conda-based workflow described in the top-level `README.md` instead — that path runs `npm start` and `tethys manage start` together.

## Open in dev container

**VS Code**: install the *Dev Containers* extension, open the `tethysapp-tethys_dash/` folder, then run **Dev Containers: Reopen in Container** from the command palette.

**Codex / other devcontainer-aware editors**: open the same folder and accept the rebuild prompt.

The first build runs `apt install`, creates an `/opt/venv` Python venv, `pip install -e .[test]`, and runs the MCP contract suite as a build-time gate (so dep-resolution regressions surface before you ever open a shell). Expect a few minutes on first build; subsequent rebuilds are fast.

## What `postCreateCommand` does

After the image builds, the host fires `bash .devcontainer/init.sh`, which runs two bash scripts in order:

- `scripts/tethyscore.sh` — generates `portal_config.yml`, sets dev-mode settings (`DEBUG=True`, `ALLOWED_HOSTS=['*']`, SQLite ENGINE), runs `tethys db migrate`, and creates the default superuser. Mirrors the role of `tethys_portal_firo/docker/tethyscore.sls`.
- `scripts/devcontainer-app.sh` — provisions the SQLite persistent store at the tethysdash app workspace, links it to `tethysdash:ps_database:primary_db`, runs `tethys syncstores tethysdash`, and finally touches the marker file. Mirrors the role of `tethys_portal_firo/docker/salt/init_apps.sls`.

Both scripts gate on `${TETHYS_PERSIST}/tethysdash_devcontainer_setup_complete`. If the marker exists, they exit without doing anything. The marker is touched only after `devcontainer-app.sh` reaches its end, so a partial failure leaves the marker absent and `init.sh` reruns cleanly.

**Why bash instead of Salt?** The `.sls` pattern is the canonical Aquaveo provisioning style, and we initially planned to use it here. In practice, pip-distributed Salt has incomplete install_requires on slim Python base images (missing `looseversion`, `distro`, and others), and the SaltProject apt repo isn't reliably reachable from all build environments. Bash gives us identical idempotence semantics (marker-file gating, ordered execution, env-var-driven settings) without any of the install fragility — at the cost of losing Salt's declarative DSL. The two-tier split (portal vs app) and the marker-file pattern are preserved 1:1 from the `.sls` precedent.

## Start the server

After `postCreateCommand` finishes, open a terminal in the container and:

```bash
bash .devcontainer/run.sh
```

That runs `tethys manage start -p 0.0.0.0:8000`. The forwarded port lands at `http://localhost:8000/` on your host. Log in with `admin` / `admin`, then the app is at:

```
http://localhost:8000/apps/tethysdash/
```

(Tethys mounts all apps under `/apps/<app_name>/`. Bare `/tethysdash/` will 404.)

## Edit-and-reload

The app is installed editable (`pip install -e .[test]`). Editing any `.py` file under `tethysapp/tethysdash/` triggers Django's autoreload — just save and refresh the browser.

If you change `pyproject.toml` (e.g., add a Python dep), run `pip install -e .[test]` again in the container terminal to refresh the venv.

## Run tests

The MCP contract suite:

```bash
python -m pytest tethysapp/tethysdash/tests/mcp/ --no-cov -q
```

Other backend tests:

```bash
python -m pytest --reuse-db
```

The Jest / Playwright frontend suites are NOT run from this container by design — see "Out of scope" below.

## Out of scope

This devcontainer intentionally does **not**:

- Install Node, npm, or Webpack — frontend rebuilds happen on your host.
- Provision Postgres, Redis, GeoServer, or any other service container.
- Mount your host's `~/.tethys/` directory — container state is isolated.
- Persist `~/.tethys/` or the SQLite store across `Rebuild Container Without Cache`. (The SQLite store is under `tethysapp/tethysdash/workspaces/`, which IS bind-mounted, so it does survive plain `Rebuild Container`. The portal_config and the marker file live in the container's `/root/.tethys/` and get wiped on full rebuilds.)

If you need any of these, fall back to the conda-based workflow in the top-level `README.md`.

## Frontend bundle staleness

The dev server serves whatever is in `tethysapp/tethysdash/public/frontend/` — the bundle committed to the repo. If you're reviewing a frontend PR, that bundle may not reflect the React changes.

Quick check on your host (NOT inside the container):

```bash
git log -1 --format=%h -- tethysapp/tethysdash/public/frontend/
git log -1 --format=%h -- reactapp/
```

If the second commit is newer than the first, run `npm run build` on your host to refresh the bundle before opening the devcontainer.

The devcontainer cannot detect or fix this for you — it's intentionally backend-only.

## Troubleshooting

### Re-bootstrap from a half-broken state

If something inside Tethys gets into an inconsistent state (schema mismatch, deleted persistent store, etc.):

```bash
rm -f $TETHYS_PERSIST/tethysdash_devcontainer_setup_complete
bash .devcontainer/init.sh
```

That removes the marker and re-runs all Salt states. Note this re-creates the SQLite store from scratch — any dashboards you saved will be gone.

### `DisallowedHost (400)` after `bash run.sh`

The Salt state's `tethys settings --set ALLOWED_HOSTS "['*']"` must have run. If you started the server before `init.sh` finished, restart the server.

### `tethys gen portal_config --overwrite` prompt

Should not happen — `--overwrite` is the explicit flag for this case. If you somehow hit a prompt (Ctrl-C and re-run), the marker-gate prevents this state from re-running anyway.

### Don't run `git clean -fdx` casually

The bundled frontend (`tethysapp/tethysdash/public/frontend/`) is committed and ignored by `.gitignore` patterns (it's exempted), and the SQLite dev store sits under `tethysapp/tethysdash/workspaces/`. A wide `git clean -fdx` can nuke either; prefer `git clean -fd` and review what's about to be removed.

### Don't push this image to a registry

The image bakes in `admin / admin` superuser credentials. It is dev-only. Pushing to a registry leaks those defaults — and the image is otherwise unhardened (DEBUG=True, ALLOWED_HOSTS=['*'], remoteUser=root).

## Reference

- Plan: `docs/plans/2026-05-06-001-feat-backend-only-devcontainer-plan.md` (workspace-level, outside this subrepo).
- Brainstorm: `docs/brainstorms/2026-05-06-backend-only-devcontainer-requirements.md`.
- Pattern source: `tethysapp-agwa/.devcontainer/` (sibling Aquaveo repo, conda-based; we adopted the file layout but diverged on env mgmt).

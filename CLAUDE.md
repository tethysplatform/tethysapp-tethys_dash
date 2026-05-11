# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is TethysDash?

TethysDash is a no-code/low-code dashboard builder built as a [Tethys Platform](https://www.tethysplatform.org/) app. Users create dashboards composed of draggable visualization widgets powered by an Intake-based plugin system. It supports charts, maps, tables, images, text, variable inputs, live chat, and custom components.

## Commands

### Backend (Python/Django)

```bash
python -m pytest --reuse-db                          # Run all backend tests
python -m pytest --reuse-db path/to/test_file.py    # Run a single test file
python -m pytest --reuse-db path/to/test_file.py::TestClass::test_method  # Run a single test
tethys manage start             # Start Django dev server (port 8000)
```

### Frontend (React)

```bash
npm start                       # Start webpack dev server (port 3000, proxies to Django)
npm run build                   # Production build → tethysapp/tethysdash/public/frontend/
npm run test                    # Run all Jest tests with coverage
npm test -- path/to/test.js    # Run a single test file
npm run test:serial             # Run tests sequentially (use if parallel causes issues)
npm run lint                    # ESLint
npm run pretty                  # Prettier formatting
```

### Development Setup

Both servers must run simultaneously for full-stack development. The webpack dev server proxies `/tethysdash/` requests to Django on port 8000.

### Test skills (`.claude/skills/test-*`)

Two project-level Claude Code skills run the test suites:

- **`test-backend`** — Python pytest only (MCP contracts + integrated + unit), in a self-contained venv at `.venv-test/`. Use while iterating on Python changes.
- **`test-all`** — full sweep: Python pytest + Jest, with the React bundle rebuilt first. Use before pushing a branch. Uses the same `.venv-test/` for Python.

`test-backend` and `test-all` create or reuse `.venv-test/` via `pip install -e .`, keyed on a SHA-256 of `pyproject.toml`. Edit `pyproject.toml` and the next run rebuilds the venv automatically; otherwise the venv is reused. To force a rebuild: `rm -rf .venv-test`. Reports land in `test-results/reports/<ISO-timestamp>-<skill>.md` (gitignored).

There is no dedicated front-end test skill — `npm test` is the canonical Jest runner. The previous `test-frontend` skill (Jest + mocked Playwright) was removed when the Playwright E2E suite was archived (see "Playwright suite — archived" below).

### Playwright suite — archived

The Playwright E2E suite (36 mocked tests + 4 skipped, plus `playwright.config.js`, `setup-test-db.py`, and the `@playwright/test` / `better-sqlite3` / `pg` devDeps) was removed in May 2026 to trim maintenance churn ahead of upstreaming. The full state is preserved on the `aquaveo` remote at branch `archive/playwright-suite-2026-05-11` if any of the tests need to be brought back.

The charter that governs **re-introducing** Playwright (R2.1 unique-coverage criteria + R2.2 stability bar + R4 forward-going reviewer gate) lives at `docs/brainstorms/2026-05-11-tethysdash-playwright-smoke-charter-requirements.md` in the firoh workspace. Any future Playwright PR should reference and clear that charter before merging.

## Architecture

TethysDash is a Django + React hybrid. The React SPA is compiled into `tethysapp/tethysdash/public/frontend/` and served by Django. A catch-all route (`home`) enables React Router to handle client-side navigation.

### Backend (`tethysapp/tethysdash/`)

- **`app.py`** — Tethys app config; defines persistent store (PostgreSQL), custom settings, permissions
- **`controllers.py`** — All REST API endpoints (using `@controller` decorator) and WebSocket consumers (using `@consumer` decorator)
- **`model.py`** — SQLAlchemy ORM models: `Dashboard`, `GridItem`, `DashboardPermission`, `VisualizationPermission`, `PermissionGroup`, `PermissionGroupUser`, `Message`
- **`visualizations.py`** — Intake plugin registry; discovers plugins via `intake.source.registry`
- **`plugin_helpers.py`** — `TethysDashPlugin` base class (extends `intake.source.base.DataSource`); WebSocket messaging helpers
- **`alembic/`** — Database migrations

**Database sessions pattern:**

```python
Session = App.get_persistent_store_database("primary_db", as_sessionmaker=True)
session = Session()
try:
    # queries
finally:
    session.close()
```

### Frontend (`reactapp/`)

- **`index.js` / `App.js`** — Entry point; wraps app in ErrorBoundary, ModalPriority context, Loader, AppTour, Layout
- **`components/visualizations/Base.js`** — Universal visualization wrapper: fetches data, handles variable substitution, WebSocket progress updates, error boundaries, retry logic
- **`components/contexts/Contexts.js`** — All React contexts (no Redux): `AppContext`, `EditingContext`, `VariableInputsContext`, `LayoutContext`, `MapContext`, `TabContext`, `GridItemContext`, etc.
- **`services/api/app.js`** — Axios-based API client for all backend endpoints
- **`services/api/client.js`** — Axios instance with CSRF token support

### Plugin System

Plugins are **external packages** (not in this repo) that subclass `TethysDashPlugin`. TethysDash discovers them via Intake's registry. Each plugin implements `run()` → returns visualization data, and optionally `send_update()` for WebSocket progress messages. Plugin type (`plotly`, `map`, `table`, `card`, `text`, `variable_input`, `custom`) determines which frontend renderer is used.

### Data Flow (per visualization)

1. Frontend loads dashboard UUID → `GET /tethysdash/dashboards/get/` → list of `GridItem` configs
2. For each GridItem: `GET /tethysdash/visualizations/get/` with `viz_source`, `viz_args`
3. Backend instantiates plugin: `getattr(intake, f"open_{source}")(**args).run()`
4. WebSocket at `/tethysdash/visualizations/notifications/` streams `percentage_complete` progress
5. Frontend renderer (Plotly/OpenLayers/etc.) displays the returned data

### Permissions

Three-layer system: (1) Dashboard-level (admin/editor/viewer per user or group), (2) Visualization-level (plugin type access per user or group), (3) Permission groups (owner-managed user groups with admin/editor/member roles).

## Variable Inputs

Variable inputs are a core interactivity mechanism. Dashboard creators add a `variable_input` plugin to a dashboard, name it, and then connect that name to arguments in other visualizations. When a user changes the variable input, all connected visualizations re-fetch with the new value.

**Input types**: `text`, `number`, `checkbox`, `date`, `dropdown`, `date-range`, `slider`, `csv-uploader`, and auto-generated inputs from existing plugin args.

**Connecting a variable input to a visualization arg**:
- For dropdown-type args: select the variable input name from the "Variable Inputs" section at the bottom of the arg dropdown
- For text-type args: use template syntax `${Variable Input Name}` as the value

**React data flow**:
1. User changes input → `VariableInputsContext` updated via `setVariableInputValues()`
2. `updateObjectWithVariableInputs()` interpolates new values into visualization args
3. Dependent visualizations re-fetch data with the updated args

When writing React components that depend on variable inputs, consume `VariableInputsContext` and call `updateObjectWithVariableInputs()` to get the interpolated args. Do not read raw args directly from props if they may contain `${...}` references.

## Plugin Visualization Return Types

Each plugin `run()` must return data in the format expected by its `type`:

| type | return shape |
|------|-------------|
| `plotly` | `{"data": [...traces], "layout": {...}, "config": {...}}` |
| `table` | `{"title": str, "data": [dicts], "subtitle": str (optional)}` |
| `image` | URL string |
| `card` | `{"title": str, "data": [{color, label, value, icon}, ...]}` |
| `text` | `{"text": str}` |
| `variable_input` | `{"variable_name": str, "initial_value": any, "variable_options_source": list or str}` |
| `map` | `{"baseMap": str, "viewConfig": {...}, "mapConfig": {...}, "layers": [...]}` |
| `custom` | `{"url": str, "scope": str, "module": str, "props": {...}}` (Module Federation) |

For long-running plugins, call `self.send_update(message, percentage_complete)` during `run()` to stream progress via WebSocket.

## MCP Server (`tethysapp/tethysdash/mcp/`)

TethysDash includes an MCP (Model Context Protocol) server that allows LLMs to create dashboard visualizations via tool calls. The ChatSidebar (`reactapp/components/sidebar/ChatSidebar.js`) connects to this server through the `@chatbox/core` engine.

### MCP Server Architecture

- **`tethysdash_mcp_server.py`** — FastMCP server. Default transport is **Streamable HTTP at `http://localhost:9001/mcp`** (`MCP_TRANSPORT=streamable-http`); legacy SSE at `/sse` is opt-in via `MCP_TRANSPORT=sse` for users with `/sse`-suffixed localStorage configs migrating to the new endpoint. Default host is `127.0.0.1` (loopback only); set `MCP_HOST=0.0.0.0` for deployments behind an authenticated reverse proxy. CORS is env-driven via `ALLOWED_ORIGINS` (default `*`); `ALLOW_CREDENTIALS` is auto-derived (`False` on wildcard, `True` otherwise — coupling prevents the `allow_credentials=True` + `allow_origins=["*"]` spec violation). **Tool discovery**: as of 2026-05-10 the server returns its full 25-tool catalog without server-side filtering (BM25SearchTransform was removed in commit `a739750`). Tool selection happens entirely in `chatbox-core/engine/embeddings.js` (per-prompt cosine-similarity ranking) capped by `TOOL_BUDGET=50` in `chatbox-core/engine/index.js`. See `docs/solutions/best-practices/mcp-server-vs-client-tool-selection-2026-05-10.md` for the architectural rationale.
- **Engine** (`lib/chatbox-core/engine/index.js`) — Generic tool-use conversation loop that connects to MCP servers, streams LLM responses, and accumulates tool results.
- **Chatbox** (`lib/chatbox-core/components/Chatbox.jsx`) — Dispatches visualization specs as DOM events that `DashboardLayout.js` handles.

> **Note (2026-05-02):** chatbox-core moved from `plugins/nextgen_plugins/packages/chatbox-core/` to `lib/chatbox-core/` and is published as `@aquaveo/chatbox-core` on npm. The `package.json` `"@chatbox/core"` file: link is the dev-mode consumption path and lets tethysdash co-evolve with chatbox-core. For stable consumption (e.g., a downstream consumer who isn't editing chatbox-core), use `npm install @aquaveo/chatbox-core@^0.2.0` and update import paths from `@chatbox/core/...` to `@aquaveo/chatbox-core/...`.

### MCP Tools

The server exposes **25 tools** across four families. The slash-command
popover in the chatbox mirrors each tool with a corresponding
`@mcp.prompt` (also 25 prompts total after Phase 3a/3b/3c shipped on
2026-05-10 — see `docs/plans/2026-05-10-005/006/007-feat-tethysdash-mcp-*`).

**Discovery** (zero-arg):
| Tool | Purpose |
|------|---------|
| `list_intake_plugins` | List installed backend intake plugins (compact format) |
| `list_available_visualizations` | List all registered visualization types |

**Visualization create** (inline data):
| Tool | Purpose |
|------|---------|
| `create_plotly_chart` | Plotly chart with inline `data` (trace array) |
| `create_data_table` | Data table with inline row data |
| `create_card` | Stat-card tile with title and (optional) data entries |
| `create_text` | Plain text tile |
| `create_custom_image` | Image tile from URL / data URI / S3 |
| `create_map_visualization` | Map with base layer + drawing tools. Returns a UUID for layer additions |
| `create_variable_input` | Interactive variable input (text, number, checkbox, date, dropdown, slider, date-range, csv-uploader) |

**Render** (plugin / MFE):
| Tool | Purpose |
|------|---------|
| `render_plugin` | Render a registered backend intake plugin (source name from `list_intake_plugins`) |
| `render_custom_visualization` | Render a registered client-side custom plugin |
| `register_runtime_plugin` | Register a runtime Module Federation plugin (url + scope + module + label) |

**Modify**:
| Tool | Purpose |
|------|---------|
| `patch_visualization` | Apply RFC 6902-style operations to an existing tile by UUID |

**Layer-add** (each accepts a `map_uuid` returned by `create_map_visualization`):
| Tool | Purpose |
|------|---------|
| `add_wms_layer` | WMS GetMap layer with `wms_layers` + optional `params` (STYLES/TIME/FORMAT/TRANSPARENT) |
| `add_esri_image_layer` | ArcGIS Image / Map Service layer with optional `layer_id` + `params` |
| `add_esri_feature_layer` | ArcGIS Feature Service layer with `layer_id` + optional WHERE / TIME `params` |
| `add_geojson_layer` | GeoJSON layer (inline `geojson` or `geojson_url`) |
| `add_kml_layer` | KML layer from URL |
| `add_image_tile_layer` | Raster XYZ tile layer |
| `add_vector_tile_layer` | Vector tile layer (style typically required) |
| `add_pmtiles_vector_layer` | PMTiles vector archive |
| `add_pmtiles_raster_layer` | PMTiles raster archive |
| `add_geotiff_layer` | Cloud-Optimized GeoTIFF with optional `bands`/`nodata`/`min`/`max`/`ramp_name` |
| `add_static_image_layer` | Non-georeferenced image pinned to an `image_extent` in a given `projection` |
| `add_dynamic_map_layer` | Backend-intake-plugin-backed map layer (`source` from `list_intake_plugins`) |

### MCP Visualization Data Flow

1. LLM calls MCP tools → returns `{visualization: {...}}` or `{layer_update: {...}}`
2. Engine accumulates results in `state.pendingVisualizations` and `state.pendingLayerUpdates`
3. Engine returns both arrays when the LLM finishes (no early returns — the LLM decides when it's done)
4. Chatbox merges same-conversation layer updates into matching visualization specs by UUID before dispatch
5. Chatbox dispatches `tethysdash:add-visualization` event (single batch for all panels)
6. For pre-existing maps only: dispatches `tethysdash:update-visualization` via `requestAnimationFrame`
7. `DashboardLayout.js` handles both events, creates/updates grid items, auto-saves

### MCP Data Contract Rules

When building or modifying MCP tools, follow these rules (documented in `docs/solutions/best-practices/`):

1. **Match the rendering path**: Map, Text, Custom Image use flat `args` (not `inlineData`). Plotly, Table, Card use `inlineData`.
2. **Use registry source names**: Exact strings from the Default visualization registry (`"Map"`, `"Text"`, `"Custom Image"`, `"Variable Input"`).
3. **Split complex tools**: Creation tool returns `{visualization}` with UUID. Modifier tool returns `{layer_update}`. Engine accumulates both.
4. **Validate per source type**: Enforce required fields (WMS needs `url` + `wms_layers`; ESRI Feature needs `url` + `layer_id`).
5. **ESRI attributeVariables key**: Use the ESRI service's actual layer name (fetched from `{url}?f=json`), not the client display name.
6. **GeoJSON source placement**: GeoJSON data goes at `source.geojson` (top-level on source object), NOT `source.props.geojson`. The `props` is empty `{}`.
7. **Dict parameter coercion**: Some LLMs pass dict arguments as JSON strings. Accept `Union[Dict, str]` and coerce with `json.loads` at the top of the function.

### ChatSidebar

The ChatSidebar (`reactapp/components/sidebar/ChatSidebar.js`) is a VS Code-style collapsible right sidebar that wraps the generic `<Chatbox>` component from `@chatbox/core`. It uses a generic system prompt (not the NRDS-specific one) and passes no `engineExtensions` — the engine runs with default settings.

Users configure LLM providers and MCP server connections via the sidebar's settings panel. The sidebar publishes variable input values to `VariableInputsContext` so MCP-created variable inputs integrate with the existing dashboard interactivity system.

## Documented Solutions

`docs/solutions/` contains documented solutions to past problems (bugs, best practices, workflow patterns), organized by category with YAML frontmatter (`module`, `tags`, `problem_type`). Relevant when implementing or debugging in documented areas.

```
docs/solutions/
├── best-practices/     # Data contract rules, tool design patterns
├── logic-errors/       # Stale-ref bugs, early returns, dispatch timing
├── (other categories as documented)
```

Search these before implementing features or fixing bugs in the MCP integration, map layer tools, or chatbox dispatch chain — past investigations and their resolutions are recorded here.

## Plans and Brainstorms

`docs/plans/` contains implementation plans with YAML frontmatter, checkbox-tracked implementation units, and requirements tracing. Plans are living documents — checkboxes are updated during implementation.

`docs/brainstorms/` contains requirements documents that define WHAT to build before plans define HOW. Each brainstorm produces a `-requirements.md` file that a plan references via its `origin:` frontmatter field.

## Key Conventions

- **HTML sanitization**: Use `nh3` (backend) for any user-supplied HTML. Never use `bleach` for new code.
- **Frontend state**: React Context API throughout — no Redux. Add new state to the appropriate existing context before creating a new one.
- **Backend endpoints**: Use Tethys `@controller` decorator; CSRF tokens required on all POST requests.
- **Variable inputs**: Dashboard filters are passed through `VariableInputsContext`; visualization args support `{variable_name}` substitution syntax.
- **Date args**: `TethysDashPlugin` automatically formats date arguments into datetimes before setting them as class properties.
- **No early returns in the engine loop**: The LLM is the only reliable authority on when a conversation is complete. Never return early based on individual tool result types (visualization, query, list). This is a three-time-proven anti-pattern.
- **Batch dispatch**: Never dispatch N events in a loop when a single batch event exists. Use `{batch: true, panels: [...]}` for `tethysdash:add-visualization`. Individual events cause stale-ref bugs.
- **MCP tool descriptions**: Never include concrete example values in tool descriptions — LLMs copy them verbatim instead of using actual data.
- **Per-tile error boundary**: Each grid tile wraps its `BaseVisualization` in `components/error/ErrorBoundary` with a `TileErrorFallback`. Renderer crashes degrade to a single-tile fallback — the rest of the dashboard keeps rendering. When adding new viz types, rely on this boundary for render-error safety; avoid top-level try/catch in the renderers themselves.
- **LLM-editability of plugin args**: Intake plugin args are LLM-editable by default via the chatbox's `patch_visualization` tool. Matches the edit-modal permission model — editors can set any arg there too. Plugin authors opt out per-arg via the `llm_non_editable_args` class attribute when they need to protect a specific arg (e.g., hardcoded credential). See `docs/source/plugins.rst` "LLM-editability" section and `tethysdash inspect_editable_paths <source>` for author-facing inspection. (Runtime/remote MFE plugins are not editable via `patch_visualization`; users edit via the Edit Visualization modal.)
- **Chatbox is an editor tool**: `<ChatSidebar>` mounts only for users with `editor` / `admin` permission on the active dashboard (read from `LayoutContext.editable`). Viewers see no chatbox at all — matches the edit modal's visibility. The MCP server on port 9001 must run localhost-bound or behind an authenticated reverse proxy; the browser's session + the chatbox mount gate are the authorization boundary.

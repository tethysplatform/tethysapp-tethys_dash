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

## Key Conventions

- **HTML sanitization**: Use `nh3` (backend) for any user-supplied HTML. Never use `bleach` for new code.
- **Frontend state**: React Context API throughout — no Redux. Add new state to the appropriate existing context before creating a new one.
- **Backend endpoints**: Use Tethys `@controller` decorator; CSRF tokens required on all POST requests.
- **Variable inputs**: Dashboard filters are passed through `VariableInputsContext`; visualization args support `{variable_name}` substitution syntax.
- **Date args**: `TethysDashPlugin` automatically formats date arguments into datetimes before setting them as class properties.

# TethysDash Chatbox Integration — Architecture Document

Covers all tethysdash-side changes for the chatbox integration. For chatbox MFE internals (engine, panels, MCP), see `plugins/nextgen_plugins/nextgen_plugins/chatbox/frontend/chatbox/SESSION_CONTEXT.md`.

---

## 1. Overview

TethysDash is a dashboard platform built on **react-grid-layout** (100 columns). Users compose dashboards from visualization panels arranged in a responsive grid.

Two chatbox integration points:

| Integration | Scope | Location | How it loads |
|---|---|---|---|
| **Sidebar** | Global — every dashboard | Right edge, outside the grid | Native `<Chatbox>` from `@chatbox/core/components` |
| **Grid item** | Per-dashboard — via dynamic panel creation | Inside react-grid-layout | Module Federation MFE (`remoteEntry.js`) |

---

## 2. Chatbox Sidebar

VS Code-style collapsible right panel, available on ALL dashboards.

### Component Tree

```
AppLoader (ChatSidebarProvider wraps all children)
  └── DashboardView
        ├── DashboardHeader (toggle button: BsChatDots)
        ├── DashboardLayoutAlerts
        └── div (flex-row, flex: 1, overflow: hidden)
              ├── div (flex: 1, minWidth: 0)  ← wrapper for DashboardTabs
              │     └── DashboardTabs (React-Bootstrap Tabs)
              └── ChatSidebar (width: 360px or 0px, CSS transition)
```

### Key Files

| File | Purpose |
|------|---------|
| `reactapp/views/Dashboard.js` | Flex-row wrapper around DashboardTabs + ChatSidebar |
| `reactapp/components/sidebar/ChatSidebar.js` | Renders native `<Chatbox>` from `@chatbox/core/components`. Stays mounted when closed (`width: 0; overflow: hidden`) to preserve conversation |
| `reactapp/components/contexts/ChatSidebarContext.js` | Context + provider for `{ isOpen, setIsOpen, toggle }` |
| `reactapp/components/layout/Header.js` | `BsChatDots` toggle button in DashboardHeader. Always visible — users can add MCP servers without Ollama config |

### Reflow

`WidthProvider(RGL)` uses ResizeObserver — when the sidebar opens/closes and the grid container width changes, items reflow automatically.

### React-Bootstrap Tabs Wrapper

React-Bootstrap's `<Tabs>` renders nav and content as **siblings** (no wrapper div). In a flex-row, they become 3 columns: nav | content | sidebar. Fix: wrap `<DashboardTabs>` in its own `<div>` so tabs UI is one flex item.

---

## 3. Backend Configuration

### Custom Settings (`app.py`)

| Setting | Type | Purpose |
|---------|------|---------|
| `chatbox_ollama_host` | string | Ollama host URL (e.g., `https://ollama.com` or `http://localhost:11434`). Leave empty to use default localhost. |
| `chatbox_ollama_key` | string | Ollama API key for authenticated endpoints (e.g., Ollama Cloud). Leave empty for local Ollama. |

### Django Ollama Proxy (`controllers.py`)

The sidebar cannot call Ollama directly from the browser due to CORS (Ollama Cloud returns no CORS headers). A Django proxy forwards requests server-side:

```
Browser → POST /apps/tethysdash/ollama-proxy/api/chat/ (same-origin, no CORS)
  → Django reads chatbox_ollama_host + chatbox_ollama_key from settings
  → Django forwards to Ollama with Bearer auth header
  → Django streams response back via StreamingHttpResponse
```

Three proxy endpoints:
- `GET /apps/tethysdash/ollama-proxy/api/tags/` — list models
- `POST /apps/tethysdash/ollama-proxy/api/show/` — model details
- `POST /apps/tethysdash/ollama-proxy/api/chat/` — streaming chat

The `dashboards()` controller always returns:
```python
response["chatbox_config"] = {"ollamaHost": "/apps/tethysdash/ollama-proxy"}
```

API key stays server-side — never sent to the browser. CSRF token is passed via `x-csrftoken` header (same pattern as all other POST endpoints).

### Frontend (`AppLoader.js`)

Stores `chatboxConfig` on `tethysApp` object in `AppContext`. `ChatSidebar` reads `ollamaHost` (proxy URL) and `csrf` token from context, passes both to `<Chatbox>`.

### Ollama SDK Integration

The Ollama npm SDK's `formatHost()` mangles relative paths (e.g., `/apps/...` → `http://apps:11434/...`). Fix: use `proxy: true` option (skips `formatHost`), then prepend the proxy path in a custom fetch wrapper. The wrapper also adds trailing slashes (Django `APPEND_SLASH`) and the CSRF token header.

---

## 4. Client Plugin System

### Runtime (`client_custom_remote`)

- User selects "Runtime Plugin" (catch-all manual-URL entry) or a registered runtime plugin from the visualization picker
- Provides `url`, `scope`, `module`, `remoteType` via DataViewer args (or persisted via `register_runtime_plugin` MCP tool / chatbox UI)
- Renders through `ModuleLoader` + `remoteLoader.js` (Module Federation)
- This is the only client plugin architecture; build-time npm scanning was removed in plan `2026-05-05-007`

### Rendering Pipeline

`utilities.js` → `getVisualization()`:
- `client_custom_remote` → `ModuleLoader` (runtime, Module Federation)
- Short-circuits before the backend API call

---

## 5. Dynamic Panel Creation

### Event Protocol

Any MFE can dispatch `tethysdash:add-visualization`:

```javascript
window.dispatchEvent(new CustomEvent("tethysdash:add-visualization", {
  detail: {
    source: "Client Custom",
    batch: true,
    panels: [
      { args: { url, scope, module, remoteType, initialData }, w: 50, h: 30 },
    ]
  }
}));
```

### Event Handler (`DashboardLayout.js`)

1. Detects batch vs single event
2. Deduplicates by `args.module`
3. Calls `computePanelLayout(newPanels, existingGridItems)` for positions
4. Creates all grid items in a single `updateTab()` call

### Layout Algorithm (`panelLayoutUtils.js`)

Slot-finding: for each new panel, scans grid top-to-bottom, left-to-right for the first position where the panel fits without overlapping any existing item. Generic — no knowledge of chatbox types.

---

## 6. TethysDash MCP Server (Session 6)

A FastMCP server (external — `Aquaveo/tethysdash_mcps` repo, image `ghcr.io/aquaveo/tethysdash-mcps:latest`, port 9001) that lets the LLM create native tethysdash visualizations with inline data — no backend API call needed. Reads runtime plugins from this app over HTTP via `/apps/tethysdash/runtime-plugins/list/`.

### Inline Data Path

Grid items with `args.inlineData` + `args.vizType` bypass the backend API entirely:

```
Base.js useEffect → args.inlineData detected → setVizType(args.vizType) + setVizData(args.inlineData)
  → Visualization switch renders native component (BasePlot, DataTable, Map, etc.)
  → No call to getVisualization() / setVariableDependentVisualizations()
```

Added in `utilities.js` as a safety backup, and in `Base.js` as the primary handler (prevents infinite re-render loop).

### Tools

| Tool | Returns | Renders as |
|------|---------|-----------|
| `create_plotly_chart` | `vizType: "plotly"`, `inlineData: {data, layout, config}` | Native BasePlot |
| `create_data_table` | `vizType: "table"`, `inlineData: {data, title}` | Native DataTable |
| `create_map_visualization` | `vizType: "map"`, `inlineData: {baseMap, layers, ...}` | Native MapVisualization (OpenLayers) |
| `create_card` | `vizType: "card"`, `inlineData: {title, description, data}` | Native Card |
| `create_text` | `vizType: "text"`, `inlineData: {text}` | Native Text |
| `create_custom_image` | `vizType: "image"`, `inlineData: {source, alt}` | Native Image |
| `render_mfe` | `source: "Client Custom"`, `args: {url, scope, module}` | ModuleLoader (Module Federation) |
| `list_available_visualizations` | All built-in types + MFE info | Discovery |

### Map tool — OpenLayers schema

The map tool accepts the full OpenLayers layer structure:
- Layer types: `ImageLayer`, `VectorLayer`, `WebGLTile`, `VectorTileLayer`
- Source types: `WMS`, `GeoJSON`, `KML`, `Image Tile`, `Vector Tile`, `ESRI Image and Map Service`, `ESRI Feature Service`, `PMTiles Raster`, `PMTiles Vector`
- Base maps: shorthand names (`light_gray`, `dark_gray`, `topo`, `imagery`, `streets`) or full ArcGIS URLs
- Extent: `"minX,minY,maxX,maxY"` or `"lon,lat,zoom"` wrapped in `{"extent": string}`

### BasePlot re-render fix

`BasePlot.js` had an infinite re-render loop: `const { plotlyVerticalLine = {} } = metadata` created a new empty object on every render, triggering the `useEffect` that depends on it. Fixed with a module-level `EMPTY_VERTICAL_LINE` constant.

### Files

| File | Role |
|------|------|
| `tethysapp/tethysdash/controllers.py::runtime_plugins_list` | Anonymous read endpoint that exposes the runtime-plugin registry to the standalone MCP server (`Aquaveo/tethysdash_mcps`, image `ghcr.io/aquaveo/tethysdash-mcps`) over HTTP |
| `reactapp/components/visualizations/utilities.js` | `inlineData` check (safety backup) |
| `reactapp/components/visualizations/Base.js` | `inlineData` handler in useEffect (primary, prevents loop) |
| `reactapp/components/visualizations/BasePlot.js` | `EMPTY_VERTICAL_LINE` fix |

---

## 7. Design Decisions

1. **Sidebar outside the grid** — doesn't compete for grid cells, doesn't affect saved layouts, always available
2. **WidthProvider handles reflow** — no manual resize logic needed
3. **Tabs wrapper div** — fixes React-Bootstrap's sibling rendering in flex-row
4. **Generic layout utility** — any MFE can use `tethysdash:add-visualization`
5. **Django Ollama proxy** — avoids CORS, keeps API key server-side, CSRF token for auth
6. **Sidebar stays mounted** — `width: 0` not conditional render, preserves state
7. **Inline data bypasses backend** — grid items with `inlineData` + `vizType` render directly using native components. No API call needed.
8. **Two MCP servers** — NRDS MCP (data/domain, port 9000) + TethysDash MCP (visualization, port 9001). LLM chains: query data → create visualization.

---

## 8. Open Questions

- **Panel cleanup** — no `tethysdash:remove-visualization` event. Panels persist when chatbox is removed
- **Mobile sidebar** — fixed 360px width may be too wide on narrow viewports

---

## 9. Future Work

### Chart rendering migration (Low effort, ~20 lines)
System prompt directs LLM to query data with NRDS, visualize with TethysDash MCP. Remove chart early return + ChartPanel auto-creation from chatbox engine. NRDS chart tools remain for backward compat.

### Hydrofabric map migration (Medium effort, ~150 lines)
Translate MapLibre config → OpenLayers format in TethysDash MCP. Helpers: `_maplibre_to_openlayers_layer()`, `_maplibre_camera_to_extent()`. Currently uses MFE MapPanel (MapLibre + PMTiles).

### Custom MFE discovery for LLM (3 levels)
- **Level 1 (Low)**: MCP reads `runtimePluginRegistry.json`, exposes in `list_available_visualizations()`
- **Level 2 (Medium)**: MCP calls `/visualizations/list/` API — includes user-imported MFEs dynamically
- **Level 3 (High)**: MFEs export tool metadata — auto-registered as LLM-accessible tools

### @chatbox/core shared library (Phase 1 + Phase 2 + Phase 2b complete)
Generic chatbox code extracted into `packages/chatbox-core/`. Engine has 8 strategy pattern extension points. 9 UI components + storage + theme in `@chatbox/core/components/`. Vite library mode builds to `dist/` — bundles all deps except react/styled-components.

TethysDash sidebar renders `<Chatbox>` from core natively (no Module Federation). Django Ollama proxy handles CORS + auth. NRDS MFE engine wrapper (`chatboxEngine.js`) is a 30-line thin wrapper injecting domain extensions.

Phase 3 (planned): Refactor NRDS MFE to use `<Chatbox>` from core for UI as well, not just the engine. Add `MessageRenderer` extension point for domain-specific content rendering (charts, maps, queries).

### Publish custom MFEs as runtime registry entries
Package chatbox panels (ChartPanel, MapPanel, QueryPanel, MarkdownPanel) as standalone Module Federation remotes. Register via `MCP register_runtime_plugin` (or the chatbox UI) so they appear in the visualization picker without an `npm install` step. Same pattern extensible to any custom MFE: build it, host the `remoteEntry.js`, register the URL.

---

## File Reference

| File | Role |
|------|------|
| `reactapp/views/Dashboard.js` | Flex-row layout: tabs + sidebar |
| `reactapp/components/sidebar/ChatSidebar.js` | Sidebar component |
| `reactapp/components/contexts/ChatSidebarContext.js` | Open/close state context |
| `reactapp/components/visualizations/useDynamicFederatedComponent.js` | Module Federation hook |
| `reactapp/components/layout/Header.js` | Toggle button |
| `tethysapp/tethysdash/app.py` | Custom settings (`chatbox_ollama_host`, `chatbox_ollama_key`) |
| `tethysapp/tethysdash/controllers.py` | Ollama proxy endpoints + chatbox_config (proxy URL) |
| `reactapp/components/loader/AppLoader.js` | Runtime registry merge, ChatSidebarProvider |
| `reactapp/components/visualizations/utilities.js` | Type routing |
| `reactapp/components/visualizations/Base.js` | Base visualization rendering |
| `reactapp/components/dashboard/DashboardLayout.js` | Event listener, panel creation |
| `reactapp/components/dashboard/panelLayoutUtils.js` | Slot-finding layout algorithm |

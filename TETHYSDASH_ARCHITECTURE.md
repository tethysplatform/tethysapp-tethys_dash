# TethysDash Chatbox Integration — Architecture Document

Covers all tethysdash-side changes for the chatbox integration. For chatbox MFE internals (engine, panels, MCP), see `plugins/nextgen_plugins/nextgen_plugins/chatbox/frontend/chatbox/SESSION_CONTEXT.md`.

---

## 1. Overview

TethysDash is a dashboard platform built on **react-grid-layout** (100 columns). Users compose dashboards from visualization panels arranged in a responsive grid. The chatbox is loaded as a **Module Federation microfrontend (MFE)**.

Two integration points:

| Integration | Scope | Location |
|---|---|---|
| **Sidebar** | Global — every dashboard | Right edge, outside the grid |
| **Grid item** | Per-dashboard — via dynamic panel creation | Inside react-grid-layout |

Both load the same MFE bundle (`remoteEntry.js`) but mount different components.

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
| `reactapp/components/sidebar/ChatSidebar.js` | Loads chatbox MFE via `useDynamicFederatedComponent`. Stays mounted when closed (`width: 0; overflow: hidden`) to preserve conversation |
| `reactapp/components/contexts/ChatSidebarContext.js` | Context + provider for `{ isOpen, setIsOpen, toggle }` |
| `reactapp/components/visualizations/useDynamicFederatedComponent.js` | Extracted Module Federation hook (shared with ModuleLoader) |
| `reactapp/components/layout/Header.js` | `BsChatDots` toggle button in DashboardHeader. Only shown when `chatboxConfig` exists |

### Reflow

`WidthProvider(RGL)` uses ResizeObserver — when the sidebar opens/closes and the grid container width changes, items reflow automatically.

### React-Bootstrap Tabs Wrapper

React-Bootstrap's `<Tabs>` renders nav and content as **siblings** (no wrapper div). In a flex-row, they become 3 columns: nav | content | sidebar. Fix: wrap `<DashboardTabs>` in its own `<div>` so tabs UI is one flex item.

---

## 3. Backend Configuration

### Custom Settings (`app.py`)

| Setting | Type | Purpose |
|---------|------|---------|
| `chatbox_api_host` | string | Base URL where chatbox MFE is served (e.g., `http://localhost:5001`) |
| `chatbox_api_key` | string | Optional Ollama API key |

### Controller URL Derivation (`controllers.py`)

```python
chatbox_config = {
    "mfeUrl": f"{host}/assets/remoteEntry.js",
    "ollamaHost": host,         # Vite proxy handles /api → Ollama
    "mcpServerUrl": f"{host}/sse",  # Vite proxy handles /sse → MCP
}
```

Single host URL — everything derived. The Vite preview server proxies:
- `/api` → Ollama API
- `/sse` → MCP server

### Frontend (`AppLoader.js`)

Stores `chatboxConfig` on `tethysApp` object in `AppContext`. The sidebar and header toggle button read from `tethysApp.chatboxConfig`.

---

## 4. Client Plugin System

### Build-Time (`client_custom`)

- npm packages declare plugins via `package.json` `tethysdash.clientPlugins` metadata
- `scripts/collectClientPlugins.js` runs at prebuild, generates registry
- `ClientModuleLoader.js` loads discovered plugins by source name
- No runtime fetching, no Module Federation

### Runtime (`client_custom_remote`)

- User selects "Client Custom" from visualization picker
- Provides `url`, `scope`, `module`, `remoteType` via DataViewer args
- Reuses existing `ModuleLoader` + `remoteLoader.js`
- Dynamic panels use this path

### Rendering Pipeline

`utilities.js` → `getVisualization()`:
- `client_custom` → `ClientModuleLoader` (build-time)
- `client_custom_remote` → `ModuleLoader` (runtime, Module Federation)
- Both short-circuit before the backend API call

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

## 6. Design Decisions

1. **Sidebar outside the grid** — doesn't compete for grid cells, doesn't affect saved layouts, always available
2. **WidthProvider handles reflow** — no manual resize logic needed
3. **Tabs wrapper div** — fixes React-Bootstrap's sibling rendering in flex-row
4. **Generic layout utility** — any MFE can use `tethysdash:add-visualization`
5. **Minimal backend config** — single host URL, everything derived
6. **Sidebar stays mounted** — `width: 0` not conditional render, preserves state

---

## 7. Open Questions

- **npm package for build-time plugins** — infrastructure exists, no published package yet
- **Panel cleanup** — no `tethysdash:remove-visualization` event. Panels persist when chatbox is removed
- **Mobile sidebar** — fixed 360px width may be too wide on narrow viewports. Consider overlay mode below a breakpoint

---

## File Reference

| File | Role |
|------|------|
| `reactapp/views/Dashboard.js` | Flex-row layout: tabs + sidebar |
| `reactapp/components/sidebar/ChatSidebar.js` | Sidebar component |
| `reactapp/components/contexts/ChatSidebarContext.js` | Open/close state context |
| `reactapp/components/visualizations/useDynamicFederatedComponent.js` | Module Federation hook |
| `reactapp/components/layout/Header.js` | Toggle button |
| `tethysapp/tethysdash/app.py` | Custom settings |
| `tethysapp/tethysdash/controllers.py` | chatbox_config derivation |
| `scripts/collectClientPlugins.js` | Build-time plugin discovery |
| `reactapp/components/visualizations/ClientModuleLoader.js` | Build-time plugin renderer |
| `reactapp/components/loader/AppLoader.js` | Registry merge, ChatSidebarProvider |
| `reactapp/components/visualizations/utilities.js` | Type routing |
| `reactapp/components/visualizations/Base.js` | Base visualization rendering |
| `reactapp/components/dashboard/DashboardLayout.js` | Event listener, panel creation |
| `reactapp/components/dashboard/panelLayoutUtils.js` | Slot-finding layout algorithm |

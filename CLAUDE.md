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
- **`model.py`** — SQLAlchemy ORM models: `Dashboard`, `GridItem`, `DashboardPermission`, `VisualizationPermission`, `PermissionGroup`, `PermissionGroupUser`, `Message`, `LayerFile`
- **`visualizations.py`** — Intake plugin registry; discovers plugins via `intake.source.registry`
- **`plugin_helpers.py`** — `TethysDashPlugin` base class (extends `intake.source.base.DataSource`); WebSocket messaging helpers
- **`paths.py`** — `canonical_dashboard_uuid` and the naming rules for storage names and workspace paths built from caller-supplied dashboard identifiers: a dashboard uuid must be canonical, a layer filename a single entry ending in `.json`. The workspace-folder rules remain only for moving old workspace files into the storage, since the workspace is shared with plugins.
- **`auth.py`** — `require_login`, the app's own login gate for every `login_required=True` controller
- **`alembic/`** — Database migrations

**Map layer files** (uploaded GeoJSON and style JSON) are stored through Django's default storage, like thumbnails, at `tethysdash/layers/<canonical dashboard uuid>/<filename>` (`layer_file_name` in `model.py`) — never on the app workspace, which a containerized portal loses with the container. The app serves them only through `download_json`, which takes the dashboard's view permission, and never hands out their storage URL — but a web-served media storage (nginx's `/media` alias, a public bucket) still answers anyone holding a file's exact name, the same exposure thumbnails have. The `layer_files` table indexes them (dashboard, filename, size, uploader), so copy, cleanup and quota checks read it instead of listing a remote storage. Each user's uploads count against the `layer_storage_quota_mb` app setting (default 500, 0 for no limit, superusers exempt); copying a dashboard counts its files against the copier. `upload_json` names every file itself, `<uuid4>.json`, and ignores any name the caller sends: a web-served media storage takes a file's content type from its name, so a caller-chosen `page.html` would be served as a page from the portal's own domain. For the same reason every layer file name must end in `.json` (`require_layer_filename`), which also keeps the workspace move from bringing over anything else. A name is stored once and never replaced (`store_layer_file` refuses a name the dashboard already holds), which is what lets the browser keep each downloaded file of the dashboard it is on (`map/layerFileCache.js`). The quota's per-user row lock (`with_for_update`) holds on PostgreSQL only; SQLite has no row locks, so concurrent stores there can each pass the check. A GeoJSON plugin layer's `source.geojson` is only a placeholder its plugin's features replace: it is kept inline, never stored or downloaded (`loadLayerJSONs` puts the placeholder back over any filename an older import saved), and the cleanup does not count it as in use. Unreferenced files are swept when a dashboard's tabs are saved (`clean_up_dashboard_files`), counting maps nested in layer popup layouts. `tethys syncstores tethysdash` (which runs `init_primary_db`; `tethys db sync` only migrates the portal's own database) moves any files still in `<workspace>/<uuid>/` into the storage (`move_workspace_layer_files`).

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

**Slices**: a reference may take part of the value with bash's substring syntax — `${Name:offset}` or `${Name:offset:length}`, a negative offset counting from the end (and needing a space, `${Name: -3}`, since `:-` is bash's default-value form and is left unsliced), a negative length being an end counted from the end. Token parsing lives in `reactapp/components/visualizations/variableTokens.js`, a table of transforms (`TRANSFORMS`) of which the slice is the only entry so far. Each entry gives regex source for its text `before` and `after` the name (either may be empty; the module builds the whole-token patterns, so `pre`/`name`/`post` always exist), a `params(groups)`, and an `apply(value, params)`. `value` is raw in args and settings but already formatted text for a `${feature.*}` in a popup title or label; return text unless a non-string result is really wanted, since date-typed args and tokens inside object args treat the result as text. `parseVariableToken` returns `{name, prefix, suffix, transform}` and `applyTransform` computes the value; `updateObjectWithVariableInputs` and `substituteTemplateString` (so `${feature.x:0:4}` in popup titles and labels too) call it, `findReferencedVariableInputNames` (the empty-input check, the preload and its cache key) and `findUnresolvedFeatureTokens` (the Base.js feature gate) read only `name`, and the DataViewer rename rebuilds `prefix + newName + suffix`. Callers find tokens with the generic `\$\{([^}]+)\}` and decide what a token refers to — `feature.*` included — by its parsed name, never its first characters, so a prefix form such as bash's `${#var}` needs no caller change either. **A new transform** (uppercase, replace, ...) is one `TRANSFORMS` entry plus docs and tests, no call-site change; follow bash's syntax where bash has a form, and keep `:-` free for bash's default value. One transform per token, as in bash. A token that is a name in its own right is never transformed, and among a transform's readings (shortest and longest name) one naming a known variable wins. A slice is always text; a date slices its formatted string, so the variable input's date format decides what `${Start:0:2}` is. `checkForVariable` (`dateUtils.js`) deliberately still returns the whole token, so a sliced date is not looked up as a date.

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
| `map` | `{"baseMap": str, "map_extent": {...}, "mapConfig": {...}, "layers": [...]}` |
| `custom` | `{"url": str, "scope": str, "module": str, "props": {...}}` (Module Federation) |

For long-running plugins, call `self.send_update(message, percentage_complete)` during `run()` to stream progress via WebSocket.

A `plotly` plugin may also return these **top-level keys alongside `data`/`layout`/`config`**, which are forwarded to `BasePlot` as metadata rather than to Plotly. Dashboard-authored grid-item metadata of the same name takes precedence, so a plugin's value is a default the dashboard can override.

| key | effect |
|-----|--------|
| `toggle_subplots` | `true` renders the overlay control that shows/hides individual subplots, the rest reflowing to fill the space. Panes and their labels are derived from the figure (axis title → first trace name → "Subplot N"); the control is hidden below two panes. |
| `subplot_toggle` | `{"labels": {...}}` names panes explicitly by pane id, `{"reflow": ...}` overrides the arrangement. Only needed for irregular layouts. |
| `min_plot_height` | Pixels. A plot is otherwise sized to its tile, whatever `layout.height` said, so a tall stack of subplots in a short tile leaves each one a sliver. Given a floor, the plot keeps that height and the tile scrolls. Ignored until the tile is measured, and whenever the tile is already at least that tall. Prefer `toggle_subplots`: trimming what is drawn beats scrolling, since hiding two of four panels gives the rest the full height rather than the same height with a scrollbar. |
| `min_plot_width` | Pixels, same contract on the other axis — for a long time axis or a wide heatmap that turns unreadable in a narrow tile. Without it a plot never scrolls horizontally, being fitted to the measured width. |

Note that `layout.height`/`layout.width` on their own do nothing — `BasePlot` always overrides the figure's size with the measured tile size. The two floors are the only way to make a plot larger than its tile. They compose: a scrollbar on one axis takes space from the other's measured content box, which settles rather than oscillating, because a scrollbar only ever shrinks the other axis and shrinking can only switch scrolling on, never off.

`map_extent` also carries the map's **view group**: `{"extent": "...", "viewGroup": "Group Name"}` puts the map in the dashboard's linked view group of that name, so every member pans, zooms, and shows the hovered position together. Group names are trimmed and matched case-sensitively; an empty name means "no group". A plugin-supplied map may *join* a group but can never supply its opening view — the plugin's extent does not exist until the plugin has run — so the `isGroupInitialExtent` flag is honored only on the built-in `Map` visualization and is settable only through its editor (Map Extent → "Use as the view group's initial extent"). At most one member per group may carry the flag; saving a flagged map clears it from every other member of that group. Maps inside a popup layout never join a group.

The view group is a **map-level** setting, not a per-layer one, so it deliberately does *not* live in the `layerPropertiesOptions` registry described below.

A layer's **coordinate reference system** resolves through `reactapp/components/map/projections.js`. OpenLayers natively handles EPSG:4326, EPSG:3857 and the WGS84 UTM zones; anything else comes from one of three places: the short curated table in that module (codes worth having on hand synchronously), a definition the layer carries with it (a shapefile's `.prj`, via `registerProjectionDefinition`), or the generated table at `reactapp/components/map/epsgDefinitions.json` (via `ensureProjectionAsync`) — ~5,500 EPSG codes, fetched as its own chunk the first time a layer names one. Regenerate it with `npm run generate:epsg`, which needs pyproj: `scripts/epsg/extract.py` pulls PROJ's definitions and reconstructs the `+towgs84` datum shifts `to_proj4()` drops, and `scripts/epsg/build.mjs` ships only the definitions proj4 reproduces to within 5 m of PROJ at five points spread across each CRS's area of use (one point is not enough: a Helmert approximation of a grid-based datum shift is accurate in one region and not in another). The ~630 it cannot are recorded in the artifact's `unsupported` map so a layer naming one fails with a message saying why, instead of drawing in the wrong place — mostly legacy datums whose accurate shift is an NTv2/NADCON grid the browser cannot read (NAD27 and its UTM zones, Pulkovo 1942, Beijing 1954), plus south- and west-orientated grids proj4 mis-orients and a few projection methods it lacks. Every path that can name a CRS resolves through that lookup before a source is constructed, because OpenLayers resolves a projection by exact string and an unregistered code fails silently rather than loudly: a raster builds a projection carrying no transforms (and throws from inside the renderer on every frame), a tile or image source falls back to the view projection, and a GeoJSON reader treats an unknown `dataProjection` as WGS 84. So `ModuleLoader` resolves an author-typed `projection` on any source type (`ensureAuthoredProjection`), a GeoTIFF's own GeoKeys, a Zarr's `crs` attr, a GeoParquet column's PROJJSON, and a GeoJSON's `crs.properties.name` — URN and URI spellings included. A GeoPackage names its CRS in a SQLite table, so its loader is asked to report an unresolvable SRS rather than throw, and the file is loaded a second time once that code is registered. A shapefile still registers the WKT in its `.prj`, and its fallback field now reaches the generated table too. Codes are handed on **as registered**, not as typed.

A ramp-styled raster's **value range** is resolved in `applyAutoRamp` (`ModuleLoader.js`), in this order: an author-pinned Min/Max wins, then the file's embedded `STATISTICS_*` tags, then its `.aux.xml` PAM sidecar, then a read of the pixels themselves. The scan reads band 1 at **full resolution** and is capped at `RANGE_SCAN_CELL_LIMIT` (4M cells) — deliberately not an overview, whose averaged pixels lose the extremes a ramp is defined by (measured: a 4000x4000 raster spanning -3.5 to 123.75 reports 18.7 to 31.5 from its 500x500 overview). A float raster that publishes nothing and is over the cap is recorded as `source.rampRangeUnavailable`, and `moduleLoader` fails the layer with a message naming the fix: OpenLayers' own fallback normalizes by the *data type's* range, so against a float32 ceiling of 3.4e38 every real value rounds to zero and the layer would draw blank while reporting no error. Integer rasters keep that fallback, where scaling by the type is still meaningful.

`map`-type layer configs also support per-layer props (`configuration.props` on each layer) beyond the base `layers` shape — opacity, min/max resolution, min/max zoom, `minZoomQuery`, `clickTolerance`, `snapToFeatures`, and `snapSublayer` — registered in `layerPropertiesOptions` (`reactapp/components/map/utilities.js`). That registry drives the MapLayer editor's "Layer Properties" GUI table, so any new layer prop must be added there to become editable in the GUI.

A layer's **popup fields**: `tablePopupType` is `"none"`, `"click"` (the default, left unsaved), `"hover"` or `"both"` — ask `isClickEnabled`/`isHoverEnabled` (`map/popupAttributes.js`) rather than comparing the value. The click table shows every field except `omittedPopupAttributes`, a deny-list so fields a source adds later still show. The hover tooltip resolves through `hoverFieldFilter`: `hoverPopupAttributes` (an allow-list, for layers whose fields the editor discovered) wins, then `omittedHoverAttributes` (a deny-list, for hand-entered fields), and a hover layer with neither — saved before hover had its own list — falls back to `omittedPopupAttributes`. Because the key's presence picks the mode, the editor writes the hover key whenever hover is on, every sublayer listed and empty lists included. The tooltip is its own non-interactive overlay and reads each feature's `__wrapperLayer`; it never writes the click list, the shared attribute refs, the pin or the outline. Clicks own a layer's variable inputs unless its type is exactly `"hover"`.

**Map Selection** is the map-level arg `mapSelection`, `{clickedLocation: {map, legend, layerControl}, selectedFeature: {map, legend, layerControl}}`, holding only deviations from the defaults (pin and outline drawn, neither in the legend, both listed in the layer control) and read through `resolveMapSelection` (`map/mapSelection.js`). A hidden mark is never created rather than created and hidden. The layer control lists a layer under its `title` property when it has one, and leaves out any layer whose `showInLayerControl` property (`SHOW_IN_LAYER_CONTROL`, `map/LayersControl.js`) is false; each click sets that property on the pin and outline from the setting. `onMapClick` reads the setting through a ref, because MapComponent rebinds its map handlers only when the layers change.

Per-layer **label** settings live at `configuration.labels` (`template`, `anchor`, `color`, `haloColor`, `size`, `minZoom`, `allowOverlap`) — a sibling of `configuration.style`, not a per-layer prop. They are a grouped, nested config edited in the MapLayer editor's own "Labels" tab rather than a flat key/value row, so `layerPropertiesOptions` is the wrong home twice over: that registry renders every registered key as a row on every layer including rasters, and supports only number and checkbox controls — neither fits a spatial anchor picker or a color swatch. Sitting beside `style` rather than inside `props` also keeps the template clear of `removeEmptyLayerProps` (whose pruning would drop a zero-like size or zoom floor) and of `convertType` (which coerces numeric-looking strings, so a template of `"2026"` would arrive as a number). It loads through its own line in `AddMapLayer`, exactly as `style` does. Note `labels.minZoom` is an authored **zoom level**, converted to a resolution through the live view at render time, whereas the flat `minResolution`/`maxResolution` props are literal resolutions. `labels.allowOverlap` turns the layer's decluttering *off* rather than exempting the label from it — enabling declutter on any one layer forces every vector layer on that map to rebuild its replay group — so colliding labels all draw, separated only by the halo behind each one. (A semi-opaque background box was tried here and read worse than the halo alone; OpenLayers also supports one only under point placement, so line labels could never have had it.) The applied-paint stamp (`appliedLabelConfig`) carries the whole label config, so toggling it repaints a preserved layer. `FEATURE_SCAN_SKIP_KEYS` (`reactapp/components/visualizations/utilities.js`) skips the key only at `layers[i].configuration.labels` — a `layers` ancestor *and* `configuration` as the immediate parent — so both token scanners ignore a label template there, and a label can never blank the map widget, while an ordinary `labels` key elsewhere (a plotly `subplot_toggle.labels`, a variable input's `metadata.labels`) is still scanned normally.

**Annotations** and **Linked Extents** are *decoration* layer types (`reactapp/components/map/decorationLayers.js`): plain `VectorLayer`s built from their config with no network read, excluded from click/hover queries by source type (not by popup settings, so a missing `tablePopupType` cannot default them in), and saved with `tablePopupType: "none"`. An Annotations layer stores `configuration.annotations = {defaults, items}` beside `style` -- not in `props`, for the same `convertType`/pruning reasons as labels -- with coordinates in EPSG:4326 so storage never depends on the live view projection; the style cascade, the "lines stay lines" arrowhead rule (the Line tool pins `arrowheads: "none"`, the layer default only ever offers start/end/both) and exact write-back of untouched items live in `map/annotations.js`. Annotation text is skipped by both token scanners (`FEATURE_SCAN_SKIP_KEYS`, scoped like `labels`) but still substituted. The map **keeps** a decoration layer across a reconcile while its whole config is deep-equal, and rebuilds it on any change -- unlike other vector layers, which always rebuild -- so a Linked Extents layer's live outlines survive time-slider frames. Annotations are edited only in an on-map session (`map/AnnotationEditor.js`) started from the layer editor; sessions live in `MapContext`, which only the DataViewer mounts, so a map on the dashboard never responds to annotations, and the hidden layer editor sets `keyboard={false}` so Escape stays with the map. A **linked extent group** is `map_extent.linkedExtentGroup`, a sibling of `viewGroup` read by `readLinkedExtentGroup` and stripped from popup maps by `clearViewGroupSettings`. It has its own registry (`contexts/LinkedExtentContext.js`), not the view-group one: members never move each other, each publishes a densified EPSG:4326 footprint ring from a map-level postrender (`map/useLinkedExtentPublisher.js`), or null while hidden, zero-sized or unable to express its view in lon/lat. `map/useLinkedExtentOutlines.js` fills every Linked Extents layer from the registry when the layer is added and on a view replacement; such layers are tagged `linkedExtentOutlines` so the hook can find them.

A **dynamic `map_layer` plugin** (`dynamic_map_layer = True`) declares the layer type it drives in `dynamic_map_layer_source`, `"GeoJSON"` (default; overrides `fetch_features()`) or `"GeoTIFF"` (overrides `fetch_source()`); `DYNAMIC_MAP_LAYER_METHODS` in `plugin_helpers.py` maps one to the other, `__init__` raises on a missing override, and the value travels in plugin metadata so the editor knows the layer type before calling the plugin. A GeoTIFF fetch returns a source description, `{"type": "GeoTIFF", "props": {"url", "projection"?, "mask_below"?}}` (`geotiff_source()` builds it; `validate_layer_source_description` checks it, and `is_allowed_layer_url` limits the URL to absolute http(s) or a single-slash root-relative path, re-checked by `normalizeLayerUrl` in the browser). The saved layer is a `WebGLTile` over a URL-less GeoTIFF source, built sourceless and repointed in place by `reactapp/components/map/runtimeRaster.js` only after the new file has opened — so a failed fetch never half-draws, and the layer is taken down to a null source rather than left showing the file the last good fetch returned. The OL layer itself survives, with its identity tags, z-order and opacity, so the next good fetch repoints it as usual. Keeping the old file would show data from a file the layer no longer names, which reads as current and is not.

**A fetch names a file; it never carries styling.** The layer's saved `configuration.style` is the style, always — for a dynamic layer exactly as for a static one, edited on the Style tab. A plugin offers its preferred styling once, through the scaffold `run()` returns — `set_raster_ramp()` for a continuous ramp, `set_raster_classes(style_mode, classes, ...)` for a Categorical or Ranges table, each replacing the other; the editor loads it when the plugin is picked and again when the author presses **Fetch defaults** on the Source tab, and from there the settings are the author's. A `style` key in a source description is rejected as an unknown key rather than ignored. `mask_below` is the one styling-adjacent value a fetch does carry, because it is a **source property** rather than a style one: it decides which values the file publishes as data rather than how they are coloured, the Zarr reader writes it into the slice's alpha band as it reads, and it is edited on the Source tab. **No raster sets the view projection**, dynamic or static: the map view is always EPSG:3857 at the author's saved extent, and every GeoTIFF and Zarr layer is reprojected into it, so a layer never overrides the saved extent and the basemap is published without waiting on any raster. (Rasters used to adopt their CRS as the view's and refit to their extent; zoom to layer replaces that.)

## Key Conventions

- **HTML sanitization**: Use `nh3` (backend) for any user-supplied HTML. Never use `bleach` for new code.
- **Frontend state**: React Context API throughout — no Redux. Add new state to the appropriate existing context before creating a new one.
- **Backend endpoints**: Use Tethys `@controller` decorator; CSRF tokens required on all POST requests.
- **Login-required endpoints**: Tethys does not enforce `@controller(login_required=True)` when the portal runs with `ENABLE_OPEN_PORTAL`, and `@api_view` above `@controller` is not in the request path. Put `@require_login` (`auth.py`) directly beneath `@controller` on every such endpoint; a test fails if one is missing.
- **Variable inputs**: Dashboard filters are passed through `VariableInputsContext`; visualization args support `{variable_name}` substitution syntax.
- **Date args**: `TethysDashPlugin` automatically formats date arguments into datetimes before setting them as class properties. **Exception — preset sentinels**: a `date` arg may instead arrive as the literal string `"latest"` when the user selects the "Latest" preset. The sentinel is passed through to `run()` unparsed (the auto-format is skipped); the plugin must detect it (e.g. `if self.DATETIME == "latest":`) and resolve it by discovering the newest available resource. The sentinel set lives in `DATE_PRESET_SENTINELS` (`plugin_helpers.py`) and must stay in sync with `DATE_PRESETS` in `reactapp/components/inputs/dateUtils.js`. There is intentionally no `"current"` sentinel — use `now` date-math for the present time.

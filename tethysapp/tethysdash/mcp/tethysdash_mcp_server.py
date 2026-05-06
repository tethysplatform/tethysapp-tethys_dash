"""
TethysDash MCP Server

Exposes tools for creating native TethysDash visualizations (Plotly charts,
tables, maps, cards, text) and rendering registered MFE components.

The LLM calls these tools to create dashboard grid items with inline data -
no backend API call needed. The chatbox dispatches the returned specs as
DOM events that DashboardLayout.js handles.

Usage:
    python -m tethysapp.tethysdash.mcp.tethysdash_mcp_server

Connects to chatbox via MCP SSE transport on port 9001.
"""

import logging
import os
import json
import re
import uuid
from typing import Optional, Dict, Any, List, Union
from typing_extensions import Annotated
from pydantic import Field
from fastmcp import FastMCP
from fastmcp.server.transforms.search import BM25SearchTransform
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import Response as StarletteResponse
import requests as http_requests

from tethysapp.tethysdash.plugin_helpers import (
    LAYER_PROPERTIES_ALLOWLIST,
    LayerConfigurationBuilder,
)
from tethysapp.tethysdash.editable_schemas import (
    LLM_EDITABLE_PATHS,
    is_path_allowed,
)
from tethysapp.tethysdash.editable_schemas_plugin import (
    is_path_allowed_plugin,
    resolve_editable_paths,
)
from tethysapp.tethysdash.plugin_registry_loader import (
    load_client_plugin_registry,
    load_runtime_plugin_registry,
)

mcp = FastMCP(
    "TethysDash MCP Server",
    transforms=[
        BM25SearchTransform(
            max_results=5,
            always_visible=[
                "create_plotly_chart",
                "create_data_table",
                "create_variable_input",
                "create_map_visualization",
                "add_map_service_layer",
                "patch_visualization",
                "render_plugin",
                "render_custom_visualization",
                "list_available_visualizations",
                "list_intake_plugins",
            ],
        ),
    ],
)
LOGGER = logging.getLogger("tethysdash.mcp")
TETHYSDASH_BASE_URL = os.getenv("TETHYSDASH_BASE_URL", "http://localhost:8080/apps/tethysdash")


def _patch_sse_transport_for_cors():
    """Monkey-patch SseServerTransport.handle_post_message to handle OPTIONS.

    MCP SDK v1.26+ validates Content-Type on all requests routed to
    handle_post_message, including CORS preflight OPTIONS (which have no
    Content-Type). This patch intercepts OPTIONS and returns 200 with
    CORS headers before the SDK's validation runs.
    """
    from mcp.server.sse import SseServerTransport

    original_handle = SseServerTransport.handle_post_message

    async def patched_handle(self, scope, receive, send):
        if scope.get("method") == "OPTIONS":
            origin = dict(scope.get("headers", [])).get(b"origin", b"").decode()
            headers = {
                "access-control-allow-origin": origin or "*",
                "access-control-allow-methods": "GET, POST, OPTIONS",
                "access-control-allow-headers": "content-type, x-csrftoken, authorization",
                "access-control-allow-credentials": "true",
                "access-control-max-age": "86400",
            }
            response = StarletteResponse(status_code=200, headers=headers)
            await response(scope, receive, send)
            return
        await original_handle(self, scope, receive, send)

    SseServerTransport.handle_post_message = patched_handle

_patch_sse_transport_for_cors()


CORS_MIDDLEWARE = [
    Middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    ),
]

# ---------------------------------------------------------------------------
# Client plugin registries (shared loaders live in plugin_registry_loader.py)
# ---------------------------------------------------------------------------

# Build-time client plugin registry is stable for the process lifetime;
# cache once at import. Runtime registry is re-read per call since the
# browser writes to it at runtime.
CLIENT_PLUGIN_REGISTRY = load_client_plugin_registry()


def _log_client_plugin_editability_audit() -> None:
    """Log each registered client_custom plugin's resolved editable paths.

    Runs once at module import. Gives operators a visible, log-grep-able
    audit of which args every installed client_custom plugin allows the
    LLM to edit — the trust boundary for npm supply-chain packages that
    ship ``llmEditableArgs`` / ``llmNonEditableArgs`` declarations.

    Resolved paths reflect the full composition: package.json declarations
    filtered by the mandatory project-wide sensitive-name pattern deny-list.
    """
    try:
        from tethysapp.tethysdash.editable_schemas_plugin import (
            resolve_editable_paths,
        )
    except ImportError:
        # During isolated MCP-only startup (e.g., early migrations) the
        # resolver may not import cleanly; skip the audit rather than fail.
        LOGGER.warning(
            "client_custom editability audit skipped: resolver not importable."
        )
        return

    client_custom_entries = [
        entry
        for entry in CLIENT_PLUGIN_REGISTRY
        if entry.get("type") == "client_custom"
    ]
    if not client_custom_entries:
        return
    LOGGER.info(
        "client_custom plugin editability audit (%d plugin(s)):",
        len(client_custom_entries),
    )
    for entry in client_custom_entries:
        source = entry.get("source", "<unknown>")
        package = entry.get("packageName", "<unknown>")
        paths = resolve_editable_paths(source)
        LOGGER.info(
            "  client_custom plugin %r (package: %s): editable paths = %s",
            source,
            package,
            paths,
        )


_log_client_plugin_editability_audit()


def _get_all_plugins() -> List[Dict[str, Any]]:
    """Return combined static + runtime registries, re-reading runtime from disk."""
    runtime = load_runtime_plugin_registry()
    combined = CLIENT_PLUGIN_REGISTRY + runtime
    LOGGER.info(
        "Plugin registries: %d static + %d runtime = %d total",
        len(CLIENT_PLUGIN_REGISTRY), len(runtime), len(combined),
    )
    return combined


def _convert_arg_to_schema(arg_name: str, arg_spec) -> Dict[str, Any]:
    """Convert a tethysdash plugin arg type to a structured schema."""
    if isinstance(arg_spec, list):
        return {"type": "string", "enum": arg_spec}
    if arg_spec == "text":
        return {"type": "string"}
    if arg_spec == "number":
        return {"type": "number"}
    if arg_spec == "checkbox":
        return {"type": "boolean", "default": False}
    if arg_spec == "object":
        return {"type": "object"}
    if arg_spec == "array":
        return {"type": "array"}
    if isinstance(arg_spec, dict):
        return arg_spec  # pass through rich declarations as-is
    return {"type": "string", "description": f"Input type: {arg_spec}"}


def _convert_plugin_args_to_schema(args: Dict) -> Dict[str, Any]:
    """Convert all args for a plugin to structured schemas."""
    return {name: _convert_arg_to_schema(name, spec) for name, spec in args.items()}


# ---------------------------------------------------------------------------
# Built-in visualization tools
# ---------------------------------------------------------------------------

@mcp.tool(
    name="create_plotly_chart",
    description=(
        "Create an interactive Plotly chart on the dashboard. "
        "Use this after fetching rows or series from a data-source tool — "
        "pass them in via `data` to render a chart tile."
    ),
    tags=["visualization", "chart"],
)
def create_plotly_chart(
    data: Annotated[Union[List[Dict[str, Any]], str], Field(description="Plotly trace objects. Each dict should have 'x', 'y', and optionally 'type', 'name', 'mode', etc. May be passed as a JSON-string array too.")],
    layout: Annotated[Optional[Dict[str, Any]], Field(description="Plotly layout object with title, axis labels, etc.")] = None,
    config: Annotated[Optional[Dict[str, Any]], Field(description="Plotly config object (responsive, displaylogo, etc.)")] = None,
    title: Annotated[Optional[str], Field(description="Chart title (shorthand - added to layout.title)")] = None,
    w: Annotated[int, Field(description="Grid width in columns (out of 100)")] = 50,
    h: Annotated[int, Field(description="Grid height in row units (each unit ~10px at 1920px)")] = 40,
) -> Dict[str, Any]:
    """Create a Plotly chart visualization on the dashboard.

    Returns a visualization spec that the chatbox dispatches as a grid item.
    The chart renders using TethysDash's native BasePlot component.
    """
    # Dict-coercion pattern (see docs/solutions/best-practices/mcp-tool-dict-parameter-coercion)
    if isinstance(data, str):
        try:
            data = json.loads(data)
        except json.JSONDecodeError as e:
            return {"error": f"invalid_args: `data` is not valid JSON: {e}"}

    final_layout = layout or {}
    if title and "title" not in final_layout:
        final_layout["title"] = title

    final_config = config or {"responsive": True, "displaylogo": False}

    return {
        "visualization": {
            "source": "Inline Plotly",
            "vizType": "plotly",
            "uuid": str(uuid.uuid4()),
            "inlineData": {
                "data": data,
                "layout": final_layout,
                "config": final_config,
            },
            "w": w,
            "h": h,
        }
    }


@mcp.tool(
    name="create_data_table",
    description=(
        "Create a data table on the dashboard. Use this after fetching "
        "rows from a data-source tool — pass them in via `data` to "
        "render a table tile."
    ),
    tags=["visualization", "table"],
)
def create_data_table(
    data: Annotated[Union[List[Dict[str, Any]], str], Field(description="Array of row objects. Each dict maps column names to cell values; all rows must share the same keys. May be passed as a JSON-string array too.")],
    title: Annotated[Optional[str], Field(description="Table title")] = None,
    subtitle: Annotated[Optional[str], Field(description="Table subtitle")] = None,
    w: Annotated[int, Field(description="Grid width in columns (out of 100)")] = 50,
    h: Annotated[int, Field(description="Grid height in row units (each unit ~10px at 1920px)")] = 35,
) -> Dict[str, Any]:
    """Create a data table visualization on the dashboard.

    Returns a visualization spec that renders using TethysDash's native DataTable component.
    """
    # Dict-coercion pattern (see docs/solutions/best-practices/mcp-tool-dict-parameter-coercion)
    if isinstance(data, str):
        try:
            data = json.loads(data)
        except json.JSONDecodeError as e:
            return {"error": f"invalid_args: `data` is not valid JSON: {e}"}

    return {
        "visualization": {
            "source": "Inline Table",
            "vizType": "table",
            "uuid": str(uuid.uuid4()),
            "inlineData": {
                "data": data,
                "title": title or "",
                "subtitle": subtitle or "",
            },
            "w": w,
            "h": h,
        }
    }


def _coerce_card_data(data: Any) -> List[Dict[str, Any]]:
    """Coerce LLM-provided card data into the shape the Card renderer expects.

    Card.js iterates `data` and reads `{label, value, color, icon}` per entry,
    so the renderer requires a list of dicts. But LLMs naturally pass scalars
    when the user says "card with value 42". This helper coerces at the tool
    boundary — matches the project's liberal dict-coercion convention (see
    ``docs/solutions/best-practices/mcp-tool-dict-parameter-coercion``).

    - None                  -> []                         (empty placeholder)
    - JSON string           -> parsed, then recursed      (LLM serialization)
    - scalar (int/str/etc.) -> [{"value": str(x)}]
    - dict                  -> [dict]
    - list of dicts         -> unchanged
    - list with scalars     -> each scalar wrapped in {"value": str(x)}
    """
    if data is None:
        return []
    if isinstance(data, str):
        stripped = data.strip()
        if stripped.startswith("[") or stripped.startswith("{"):
            # The string clearly looks like JSON — a leading `[` or `{` is
            # unambiguous LLM intent. Malformed JSON at that point is an
            # error, not a scalar label, per the project-wide dict-coercion
            # pattern used by add_map_service_layer and patch_visualization.
            try:
                return _coerce_card_data(json.loads(stripped))
            except json.JSONDecodeError as exc:
                raise ValueError(
                    f"`data` looks like JSON (starts with {stripped[0]!r}) "
                    f"but is malformed: {exc}"
                ) from exc
        # Plain strings like "42" or "Operational" were never intended as
        # JSON — treat as a scalar stat value.
        return [{"value": data}]
    if isinstance(data, dict):
        return [data]
    if isinstance(data, list):
        return [
            item if isinstance(item, dict) else {"value": str(item)}
            for item in data
        ]
    return [{"value": str(data)}]


@mcp.tool(
    name="create_card",
    description=(
        "Create a card visualization showing one or more key-value stats. "
        "Each data entry carries optional `label`, `value`, `color`, and "
        "`icon` fields. A bare scalar or single dict is auto-wrapped into a "
        "single-entry list; None renders an empty placeholder."
    ),
    tags=["visualization", "card"],
)
def create_card(
    title: Annotated[str, Field(description="Card title")],
    description: Annotated[Optional[str], Field(description="Card description text")] = None,
    data: Annotated[Optional[Any], Field(description=(
        "List of stat entries; each entry is a dict with optional `label`, "
        "`value`, `color`, and `icon`. Scalars, single dicts, and JSON-string "
        "payloads are coerced into list-of-dict form."
    ))] = None,
    w: Annotated[int, Field(description="Grid width in columns (out of 100)")] = 25,
    h: Annotated[int, Field(description="Grid height in row units")] = 15,
) -> Dict[str, Any]:
    """Create a card visualization on the dashboard.

    Cards display a title, description, and a list of stat entries.
    Renders using TethysDash's native Card component.

    The ``data`` parameter is typed ``Any`` because the tool accepts several
    LLM-friendly shapes (scalar, dict, list-of-dicts, JSON-string) and
    normalizes internally via :func:`_coerce_card_data` to the
    ``List[Dict]`` shape the renderer expects. Malformed JSON-looking
    strings raise and produce an ``{"error": ...}`` envelope rather than
    silently becoming a scalar label.
    """
    try:
        coerced_data = _coerce_card_data(data)
    except ValueError as exc:
        return {"error": f"invalid_args: {exc}"}
    return {
        "visualization": {
            "source": "Inline Card",
            "vizType": "card",
            "uuid": str(uuid.uuid4()),
            "inlineData": {
                "title": title,
                "description": description or "",
                "data": coerced_data,
            },
            "w": w,
            "h": h,
        }
    }


@mcp.tool(
    name="create_text",
    description="Create a text content block on the dashboard",
    tags=["visualization", "text"],
)
def create_text(
    text: Annotated[str, Field(description="Text content to display")],
    w: Annotated[int, Field(description="Grid width in columns (out of 100)")] = 50,
    h: Annotated[int, Field(description="Grid height in row units")] = 15,
) -> Dict[str, Any]:
    """Create a text visualization on the dashboard.

    Renders using TethysDash's native Text component.
    """
    return {
        "visualization": {
            "source": "Text",
            "uuid": str(uuid.uuid4()),
            "args": {
                "text": text,
            },
            "w": w,
            "h": h,
        }
    }


@mcp.tool(
    name="create_custom_image",
    description="Display an image from a URL on the dashboard",
    tags=["visualization", "image"],
)
def create_custom_image(
    image_url: Annotated[str, Field(description="URL of the image to display (http/https URL, data URI, or S3 path)")],
    alt_text: Annotated[Optional[str], Field(description="Alt text for accessibility")] = None,
    w: Annotated[int, Field(description="Grid width in columns (out of 100)")] = 50,
    h: Annotated[int, Field(description="Grid height in row units (each unit ~10px at 1920px)")] = 30,
) -> Dict[str, Any]:
    """Create a custom image visualization on the dashboard.

    Displays an image from a URL. Renders using TethysDash's native Image component.
    """
    return {
        "visualization": {
            "source": "Custom Image",
            "uuid": str(uuid.uuid4()),
            "args": {
                "image_source": image_url,
            },
            "w": w,
            "h": h,
        }
    }


BASE_MAPS = {
    "light_gray": "https://server.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer",
    "dark_gray": "https://server.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer",
    "topo": "https://server.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer",
    "imagery": "https://server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer",
    "streets": "https://server.arcgisonline.com/arcgis/rest/services/World_Street_Map/MapServer",
    "terrain": "https://server.arcgisonline.com/arcgis/rest/services/World_Terrain_Base/MapServer",
    "ocean": "https://server.arcgisonline.com/arcgis/rest/services/Ocean/World_Ocean_Base/MapServer",
}

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
NOMINATIM_USER_AGENT = "TethysDash/1.0 (tethysdash@aquaveo.com)"


def _geocode(place_name):
    """Geocode a place name to (lon, lat) via Nominatim."""
    resp = http_requests.get(
        NOMINATIM_URL,
        params={"q": place_name, "format": "json", "limit": 1},
        headers={"User-Agent": NOMINATIM_USER_AGENT},
        timeout=10,
    )
    resp.raise_for_status()
    results = resp.json()
    if not results:
        return None
    return float(results[0]["lon"]), float(results[0]["lat"])


def _build_markers_layer(markers):
    """Build a GeoJSON VectorLayer configuration from a list of marker dicts."""
    features = []
    for m in markers:
        props = {}
        if m.get("label"):
            props["label"] = m["label"]
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [m["lon"], m["lat"]],
            },
            "properties": props,
        })
    geojson = {
        "type": "FeatureCollection",
        "crs": {"type": "name", "properties": {"name": "EPSG:4326"}},
        "features": features,
    }
    return {
        "configuration": {
            "type": "VectorLayer",
            "props": {
                "name": "Markers",
                "source": {"type": "GeoJSON", "props": {}, "geojson": geojson},
            },
        }
    }


@mcp.tool(
    name="create_map_visualization",
    description=(
        "Create a geographic map visualization on the dashboard. "
        "Supports markers, drawing tools, and dashboard variable integration. "
        "Use 'center' for place names or 'map_extent' for explicit coordinates. "
        "When the user wants to focus on a specific feature, call a "
        "data-source feature-lookup tool first to obtain the bounding box "
        "and pass it via 'map_extent'. To add WMS, ESRI, GeoJSON, or other "
        "service layers, call add_map_service_layer with the returned map UUID."
    ),
    tags=["visualization", "map", "geographic", "location", "marker", "layer"],
)
def create_map_visualization(
    markers: Annotated[Optional[List[Dict[str, Any]]], Field(description=(
        "Simple point markers as [{\"lon\": <number>, \"lat\": <number>, \"label\": \"<text>\"}]. "
        "The server auto-builds a GeoJSON VectorLayer with correct CRS. "
        "Use this for quick markers instead of constructing full GeoJSON layer configs."
    ))] = None,
    center: Annotated[Optional[str], Field(description=(
        "Place name to center the map on (geocoded via Nominatim). "
        "Ignored when map_extent is provided."
    ))] = None,
    base_map: Annotated[Optional[str], Field(description=(
        "Base map shorthand or full ArcGIS MapServer URL. "
        "Shorthands: 'streets', 'imagery', 'topo', 'light_gray', 'dark_gray', 'terrain', 'ocean'. "
        "Any ArcGIS MapServer URL also works directly. Null for no base map."
    ))] = "streets",
    map_extent: Annotated[Optional[str], Field(description=(
        "Map extent as comma-separated coordinates in EPSG:4326 (lon/lat). "
        "Center+zoom: 'lon,lat,zoom'. Bounding box: 'minLon,minLat,maxLon,maxLat'. "
        "Takes precedence over 'center' when both are provided."
    ))] = None,
    zoom: Annotated[int, Field(description="Zoom level (1=world, 12=city, 18=street)")] = 12,
    layer_control: Annotated[bool, Field(description="Show layer visibility control panel")] = False,
    drawing_tools: Annotated[Optional[List[str]], Field(description=(
        "Drawing tool types to enable: 'Point', 'LineString', 'Polygon', 'Rectangle'. "
        "Null to disable drawing."
    ))] = None,
    drawing_limit: Annotated[int, Field(description="Max drawn features (0 = unlimited)")] = 0,
    drawing_variable: Annotated[Optional[str], Field(description=(
        "Dashboard variable name to publish drawn geometries to."
    ))] = None,
    extent_variable: Annotated[Optional[str], Field(description=(
        "Dashboard variable name to publish map extent on pan/zoom."
    ))] = None,
    w: Annotated[int, Field(description="Grid width in columns (out of 100)")] = 50,
    h: Annotated[int, Field(description="Grid height in row units")] = 45,
) -> Dict[str, Any]:
    """Create a geographic map on the dashboard.

    Simple usage: provide 'center' or 'markers' for a quick map.
    For service layers (WMS, ESRI, GeoJSON, KML): call add_map_service_layer
    with the returned map UUID after creating the map.
    """
    map_uuid = str(uuid.uuid4())
    LOGGER.info("create_map_visualization: uuid=%s, center=%s, markers=%s",
                map_uuid, center, markers is not None)

    # Resolve base map
    resolved_base_map = BASE_MAPS.get(base_map, base_map) if base_map else None

    # Build layers array from markers only (service layers added via add_map_service_layer)
    all_layers = []
    if markers:
        all_layers.append(_build_markers_layer(markers))

    # Resolve center via geocoding
    resolved_extent = None
    if map_extent:
        resolved_extent = {"extent": map_extent, "projection": "EPSG:4326"}
    elif center:
        coords = _geocode(center)
        if coords is None:
            return {"error": f"Could not geocode '{center}'. Try providing explicit coordinates via map_extent."}
        lon, lat = coords
        resolved_extent = {"extent": f"{lon},{lat},{zoom}", "projection": "EPSG:4326"}
    elif markers:
        # Auto-center on first marker
        lon, lat = markers[0]["lon"], markers[0]["lat"]
        resolved_extent = {"extent": f"{lon},{lat},{zoom}", "projection": "EPSG:4326"}

    # Add extent variable if requested
    if extent_variable and resolved_extent:
        resolved_extent["variable"] = extent_variable

    # Build drawing config
    map_drawing = None
    if drawing_tools:
        map_drawing = {"options": drawing_tools, "limit": drawing_limit}
        if drawing_variable:
            map_drawing["variable_name"] = drawing_variable

    # Build args matching the manual UI's format — only include keys with
    # actual values. The edit modal's checkAllInputs treats null as "unfilled"
    # and blocks save. mapConfig is not a registry arg (frontend generates it).
    args = {
        "baseMap": resolved_base_map,
        "layers": all_layers,
        "layerControl": layer_control,
    }
    if resolved_extent:
        args["map_extent"] = resolved_extent
    if map_drawing:
        args["mapDrawing"] = map_drawing

    return {
        "visualization": {
            "source": "Map",
            "uuid": map_uuid,
            "args": args,
            "w": w,
            "h": h,
        },
        "map_uuid": map_uuid,
        "message": f"Map created (uuid: {map_uuid}). Use add_map_service_layer with this UUID to add WMS, ESRI, GeoJSON, or other service layers.",
    }


# ---------------------------------------------------------------------------
# Map service layer tool
# ---------------------------------------------------------------------------

# Plan-005 S2 cap: cap inline GeoJSON payloads at the MCP boundary to
# prevent an LLM or chatbox user from persisting a multi-MB feature
# collection that gets re-served on every dashboard fetch. Operators
# can raise the limits via env vars (e.g. for legitimate large
# datasets); defaults are conservative.
GEOJSON_MAX_BYTES = int(
    os.environ.get("TETHYSDASH_MCP_GEOJSON_MAX_BYTES", str(5 * 1024 * 1024))
)
GEOJSON_MAX_FEATURES = int(
    os.environ.get("TETHYSDASH_MCP_GEOJSON_MAX_FEATURES", "10000")
)


VALID_SOURCE_TYPES = [
    "WMS",
    "ESRI Image and Map Service",
    "ESRI Feature Service",
    "GeoJSON",
    "KML",
    "Image Tile",
    "Vector Tile",
    "PMTiles Vector",
    "PMTiles Raster",
    "Static Image",
]

# Recognized directive prefixes for ESRI Image and Map Service `params.LAYERS`.
# Kept in sync with the JS constant in
# `reactapp/components/map/utilities.js` (the frontend `normalizeLayersParam`
# helper). The two values are duplicated by language but should never diverge —
# both name the ESRI directive vocabulary.
_RECOGNIZED_LAYERS_DIRECTIVES = ("show:", "hide:", "include:", "exclude:")


def _resolve_esri_layer_name(url: str, layer_id: Optional[str]) -> Optional[str]:
    """Fetch the ESRI service's actual layer name for the given layer index.

    The manual map editor uses the service's layer name as the
    attributeVariables key (via getImageArcGISRestLayerAttributes).  The ESRI
    /identify response also returns this name as ``layerName``.  Using the
    service name — not the client display name — ensures the click-time
    attribute variable lookup matches.

    Returns None on any failure so the caller can fall back to the display name.
    """
    if layer_id is None:
        return None

    # Parse numeric layer index from layer_id (e.g., "show:0" → 0, "0" → 0)
    index_str = layer_id.split(":")[-1] if ":" in layer_id else layer_id
    try:
        layer_index = int(index_str)
    except (ValueError, TypeError):
        return None

    try:
        resp = http_requests.get(f"{url}?f=json", timeout=5)
        resp.raise_for_status()
        service_info = resp.json()
        layers = service_info.get("layers", [])
        for layer in layers:
            if layer.get("id") == layer_index:
                return layer.get("name")
        return None
    except Exception as exc:
        LOGGER.warning(
            "Failed to resolve ESRI layer name from %s (layer_id=%s): %s",
            url, layer_id, exc,
        )
        return None


@mcp.tool(
    name="add_map_service_layer",
    description=(
        "Add a WMS, ESRI, GeoJSON, KML, or tile service layer to an existing "
        "map created by create_map_visualization. When the layer comes from "
        "a feature lookup, fetch the layer name and bounding box from a "
        "data-source tool first, then pass them through to this call."
    ),
    tags=["map", "layer", "geographic"],
)
def add_map_service_layer(
    map_uuid: Annotated[str, Field(description="UUID returned by create_map_visualization")],
    source_type: Annotated[str, Field(description=(
        "Layer source type. One of: WMS, ESRI Image and Map Service, "
        "ESRI Feature Service, GeoJSON, KML, Image Tile, Vector Tile, "
        "PMTiles Vector, PMTiles Raster, Static Image"
    ))],
    name: Annotated[str, Field(description="Display name for the layer in the layer control")],
    url: Annotated[Optional[str], Field(description=(
        "Service URL. Required for all source types except GeoJSON."
    ))] = None,
    layer_id: Annotated[Optional[str], Field(description=(
        "Layer identifier within the service. "
        "For ESRI Image and Map Service: a bare integer or "
        "comma-separated integer list is canonicalized to show: form on "
        "emit (regardless of whether the value comes from this parameter "
        "or from params.LAYERS). To use a different directive, prefix the "
        "integer list with the directive name and a colon (one of show, "
        "hide, include, exclude). Values that already carry a recognized "
        "directive prefix are passed through unchanged. "
        "For ESRI Feature Service: integer layer index as a string."
    ))] = None,
    wms_layers: Annotated[Optional[str], Field(description=(
        "WMS LAYERS parameter value in workspace:layer format. "
        "Required when source_type is WMS."
    ))] = None,
    geojson: Annotated[Optional[Union[Dict[str, Any], str]], Field(description=(
        "Inline GeoJSON FeatureCollection or Feature object. "
        "Required when source_type is GeoJSON and no geojson_url is provided. "
        "CRS is auto-assigned if missing."
    ))] = None,
    geojson_url: Annotated[Optional[str], Field(description=(
        "URL to a GeoJSON file. Use instead of inline geojson when the data "
        "is hosted externally. The frontend fetches the URL at render time."
    ))] = None,
    queryable: Annotated[bool, Field(description=(
        "Enable click-to-query on this layer"
    ))] = False,
    attribute_variables: Annotated[Optional[Union[Dict[str, str], str]], Field(description=(
        "Maps feature attribute names to dashboard variable names. "
        "When a feature is clicked, attribute values are published to the "
        "corresponding dashboard variables."
    ))] = None,
    params: Annotated[Optional[Union[Dict[str, Any], str]], Field(description=(
        "Additional source parameters merged into the source props. "
        "Supports ${variable_name} syntax for dashboard variable references. "
        "For Static Image source_type: must include both 'projection' and "
        "'imageExtent' keys (an EPSG code and a comma-separated bounding-box "
        "string, in that string form — not a numeric array)."
    ))] = None,
    opacity: Annotated[Optional[float], Field(description="Layer opacity from 0 (transparent) to 1 (opaque)")] = None,
    min_zoom: Annotated[Optional[int], Field(description="Minimum zoom level at which the layer is visible")] = None,
    max_zoom: Annotated[Optional[int], Field(description="Maximum zoom level at which the layer is visible")] = None,
    legend: Annotated[Optional[Union[str, Dict[str, Any]]], Field(description=(
        "Layer legend. Pass 'default' to use the source's default legend, a "
        "URL string for a hosted legend image, or a dict for a custom legend "
        "definition (the dict shape mirrors the UI's Legend tab)."
    ))] = None,
    style: Annotated[Optional[Union[str, Dict[str, Any]]], Field(description=(
        "Layer style. Pass a URL string (style JSON hosted externally) or "
        "a dict for an inline style definition."
    ))] = None,
    source_props: Annotated[Optional[Union[Dict[str, Any], str]], Field(description=(
        "Advanced source-side properties merged into source.props. Validated "
        "against the source-type's available_source_properties allowlist; "
        "unknown keys are rejected. Use this for source props beyond the "
        "first-class flat parameters (e.g., projection on Image Tile, "
        "tileSize on PMTiles)."
    ))] = None,
    layer_props: Annotated[Optional[Union[Dict[str, Any], str]], Field(description=(
        "Advanced layer-level properties (opacity, minResolution, "
        "maxResolution, minZoom, maxZoom, minZoomQuery). Validated against "
        "the LAYER_PROPERTIES_ALLOWLIST. Per-key value-type validation is "
        "applied. Conflicts with the corresponding flat parameter (e.g., "
        "opacity, min_zoom, max_zoom) are rejected — pick one path per prop."
    ))] = None,
    popup_options: Annotated[Optional[Union[Dict[str, Any], str]], Field(description=(
        "Click-popup options. Accepts {'aliases': {layer_name: {field: alias}}} "
        "and {'omit': {layer_name: [field, ...]}} sub-dicts. The 'aliases' "
        "shape mirrors the UI's attribute-aliases tab; 'omit' marks fields "
        "to hide from popups."
    ))] = None,
) -> Dict[str, Any]:
    """Add a service layer to an existing map.

    Constructs the OpenLayers layer configuration from flat, source-type-specific
    parameters and returns a layer_update result (not a visualization).
    The chatbox dispatches this as a tethysdash:update-visualization event.
    """
    LOGGER.info(
        "add_map_service_layer: map_uuid=%s, source_type=%s, name=%s",
        map_uuid, source_type, name,
    )

    # Coerce JSON strings to dicts — some LLM providers serialize object
    # arguments as strings instead of parsed objects.
    if isinstance(geojson, str):
        geojson = json.loads(geojson)
    if isinstance(attribute_variables, str):
        attribute_variables = json.loads(attribute_variables)
    if isinstance(params, str):
        params = json.loads(params)
    if isinstance(source_props, str):
        source_props = json.loads(source_props)
    if isinstance(layer_props, str):
        layer_props = json.loads(layer_props)
    if isinstance(popup_options, str):
        popup_options = json.loads(popup_options)

    # Plan-005 S2 cap: reject oversized inline GeoJSON before any further
    # processing. Cap is dynamically read from env vars at call time so
    # tests and operators can override without re-importing the module.
    # NB: only inline dict payloads are capped; geojson_url is unaffected
    # (the cost is borne by the browser at render time, not the server).
    if isinstance(geojson, dict):
        max_features = int(os.environ.get(
            "TETHYSDASH_MCP_GEOJSON_MAX_FEATURES", str(GEOJSON_MAX_FEATURES)
        ))
        max_bytes = int(os.environ.get(
            "TETHYSDASH_MCP_GEOJSON_MAX_BYTES", str(GEOJSON_MAX_BYTES)
        ))
        feature_count = len(geojson.get("features", []))
        if feature_count > max_features:
            return {
                "error": (
                    f"Inline GeoJSON has {feature_count} features; the "
                    f"limit is {max_features}. Use geojson_url for hosted "
                    f"large datasets, or raise "
                    f"TETHYSDASH_MCP_GEOJSON_MAX_FEATURES on the server."
                )
            }
        try:
            payload_size = len(json.dumps(geojson))
        except (TypeError, ValueError):
            payload_size = 0
        if payload_size > max_bytes:
            return {
                "error": (
                    f"Inline GeoJSON serializes to {payload_size} bytes; "
                    f"the limit is {max_bytes}. Use geojson_url for hosted "
                    f"large datasets, or raise "
                    f"TETHYSDASH_MCP_GEOJSON_MAX_BYTES on the server."
                )
            }

    # Validate source_type
    if source_type not in VALID_SOURCE_TYPES:
        return {
            "error": (
                f"Invalid source_type '{source_type}'. "
                f"Valid types: {', '.join(VALID_SOURCE_TYPES)}"
            )
        }

    extra_params = params or {}

    # Validate required fields per source type. Friendlier error messages
    # than the builder's generic "Missing required key 'X'" — the builder
    # raises ValueError after delegation as a secondary safety net.
    if source_type == "WMS":
        if not url or not wms_layers:
            return {"error": "source_type 'WMS' requires 'url' and 'wms_layers' parameters"}
    elif source_type == "ESRI Image and Map Service":
        if not url:
            return {"error": "source_type 'ESRI Image and Map Service' requires 'url' parameter"}
    elif source_type == "ESRI Feature Service":
        if not url or not layer_id:
            return {"error": "source_type 'ESRI Feature Service' requires 'url' and 'layer_id' parameters"}
    elif source_type == "GeoJSON":
        if not geojson and not geojson_url:
            return {"error": "source_type 'GeoJSON' requires 'geojson' or 'geojson_url' parameter"}
    elif source_type == "KML":
        if not url:
            return {"error": "source_type 'KML' requires 'url' parameter"}
    elif source_type == "Image Tile":
        if not url:
            return {"error": "source_type 'Image Tile' requires 'url' parameter"}
    elif source_type == "Vector Tile":
        if not url:
            return {"error": "source_type 'Vector Tile' requires 'url' parameter"}
    elif source_type == "PMTiles Vector":
        if not url:
            return {"error": "source_type 'PMTiles Vector' requires 'url' parameter"}
    elif source_type == "PMTiles Raster":
        if not url:
            return {"error": "source_type 'PMTiles Raster' requires 'url' parameter"}
    elif source_type == "Static Image":
        # Static Image needs url + projection + imageExtent; the latter two
        # come through the `params` kwarg today (no dedicated flat params yet
        # — that surface lives in plan 005's source_props extension).
        _params_dict = params if isinstance(params, dict) else {}
        if not url:
            return {
                "error": "source_type 'Static Image' requires 'url' parameter"
            }
        # Truthy check, not just key presence: an LLM passing
        # params={"projection": "EPSG:4326", "imageExtent": None} would otherwise
        # pass this guard AND _validate_required_fields, persisting None to
        # source.props.imageExtent and crashing the renderer at parse time.
        if not _params_dict.get("projection") or not _params_dict.get("imageExtent"):
            return {
                "error": (
                    "source_type 'Static Image' requires non-empty 'projection' "
                    "and 'imageExtent' supplied via the 'params' parameter (e.g. "
                    "params={'projection': 'EPSG:4326', "
                    "'imageExtent': 'minX,minY,maxX,maxY'})"
                )
            }

    # ------------------------------------------------------------------
    # Phase 1: MCP-side coercion. ESRI LAYERS canonicalization, JSON-string
    # dict coercion (above), and ESRI attribute-variable layer-name
    # resolution all stay MCP-side per plan 004 K3 — the builder receives
    # already-canonicalized inputs.
    # ------------------------------------------------------------------
    # Phase-1-local source props (assembled from flat params). Kept under a
    # different name from the user-facing `source_props` parameter (the
    # "advanced" dict) so the conflict check downstream can distinguish
    # the two. Both are merged before delegation to the builder.
    _flat_source_props: Dict[str, Any] = {}
    geojson_payload: Optional[Union[Dict[str, Any], str]] = None

    if source_type == "WMS":
        wms_params = {"LAYERS": wms_layers}
        wms_params.update(extra_params)
        _flat_source_props = {"url": url, "params": wms_params}

    elif source_type == "ESRI Image and Map Service":
        esri_params = {}
        if layer_id:
            esri_params["LAYERS"] = layer_id
        esri_params.update(extra_params)
        # Canonicalize LAYERS post-overlay so values from either input path
        # (layer_id parameter OR LLM-supplied params={"LAYERS": ...}) land
        # consistently in the persisted `show:` form. Bare ID lists ("0",
        # "0,1") get the implicit `show:` prefix; values that already begin
        # with a recognized directive are left unchanged. Narrow scope:
        # only `LAYERS` is canonicalized; other LLM-supplied params keys
        # continue to pass through verbatim per existing semantics.
        # See plan docs/plans/2026-05-05-001-fix-esri-layers-directive-parsing-plan.md.
        if "LAYERS" in esri_params:
            layers_value = esri_params["LAYERS"]
            # Coerce non-string LAYERS values (e.g. an LLM passing
            # `params={"LAYERS": 0}` as an integer) before the prefix check.
            if not isinstance(layers_value, str):
                layers_value = str(layers_value)
            layers_value = layers_value.strip()
            if layers_value and not layers_value.startswith(
                _RECOGNIZED_LAYERS_DIRECTIVES
            ):
                esri_params["LAYERS"] = "show:" + layers_value
            else:
                esri_params["LAYERS"] = layers_value
        _flat_source_props = {"url": url}
        if esri_params:
            _flat_source_props["params"] = esri_params

    elif source_type == "ESRI Feature Service":
        _flat_source_props = {"url": url, "layer": int(layer_id)}
        _flat_source_props.update(extra_params)

    elif source_type == "GeoJSON":
        # GeoJSON goes on the source object directly (not under props).
        # The builder's set_geojson method enforces this placement.
        if geojson_url:
            geojson_payload = geojson_url  # string URL; validate_geojson accepts strings with "/"
        else:
            geojson_payload = dict(geojson)
            if "crs" not in geojson_payload:
                geojson_payload["crs"] = {
                    "type": "name",
                    "properties": {"name": "EPSG:4326"},
                }

    elif source_type == "KML":
        _flat_source_props = {"url": url}

    elif source_type == "Image Tile":
        _flat_source_props = {"url": url}

    elif source_type == "Vector Tile":
        _flat_source_props = {"urls": url}

    elif source_type in ("PMTiles Vector", "PMTiles Raster"):
        _flat_source_props = {"url": url}

    elif source_type == "Static Image":
        _flat_source_props = {"url": url}
        # projection + imageExtent come through `params`; merge them
        # alongside `url` so they all land in source.props.
        _flat_source_props.update(extra_params)

    # ------------------------------------------------------------------
    # Phase 2: Resolve ESRI attribute-variable layer name BEFORE delegation,
    # so the builder gets the final attr_key. Uses the canonicalized LAYERS
    # value computed above (catches both input paths uniformly).
    # ------------------------------------------------------------------
    attr_key = name
    if attribute_variables and source_type == "ESRI Image and Map Service":
        effective_layer_id = _flat_source_props.get("params", {}).get("LAYERS")
        resolved = _resolve_esri_layer_name(url, effective_layer_id)
        if resolved:
            attr_key = resolved
        else:
            LOGGER.warning(
                "Could not resolve ESRI layer name; falling back to display name '%s'",
                name,
            )

    # ------------------------------------------------------------------
    # Phase 2.5: Validate the advanced dicts (source_props, layer_props,
    # popup_options) before delegation. Conflict-rejects flat-vs-dict
    # collisions per K1; rejects unknown layer-prop keys / wrong types.
    # ------------------------------------------------------------------
    # Conflict check: flat layer params vs layer_props dict. The same
    # prop must not arrive through both paths — silent winner would be
    # a quiet bug class. Surface the conflict to the LLM.
    _LAYER_PROP_FLAT_TO_DICT = {
        "opacity": ("opacity", opacity),
        "min_zoom": ("minZoom", min_zoom),
        "max_zoom": ("maxZoom", max_zoom),
    }
    if layer_props:
        if not isinstance(layer_props, dict):
            return {"error": "layer_props must be a dict (or JSON-string dict)."}
        # Allowlist: keys must be known.
        unknown = set(layer_props) - set(LAYER_PROPERTIES_ALLOWLIST)
        if unknown:
            return {
                "error": (
                    f"layer_props contains unknown keys: {sorted(unknown)}. "
                    f"Allowed: {sorted(LAYER_PROPERTIES_ALLOWLIST)}"
                )
            }
        # Per-key value-type validation.
        for key, val in layer_props.items():
            expected = LAYER_PROPERTIES_ALLOWLIST[key]
            if not isinstance(val, expected):
                return {
                    "error": (
                        f"layer_props[{key!r}] must be of type "
                        f"{expected!r}; got {type(val).__name__}."
                    )
                }
        # Conflict check.
        for flat_name, (dict_key, flat_value) in _LAYER_PROP_FLAT_TO_DICT.items():
            if flat_value is not None and dict_key in layer_props:
                return {
                    "error": (
                        f"Conflicting inputs: {flat_name!r} (flat parameter) "
                        f"and layer_props[{dict_key!r}] are both supplied. "
                        f"Pick one path per layer prop."
                    )
                }

    if popup_options is not None and not isinstance(popup_options, dict):
        return {"error": "popup_options must be a dict (or JSON-string dict)."}
    _popup_aliases = (popup_options or {}).get("aliases") or {}
    _popup_omit = (popup_options or {}).get("omit") or {}
    if not isinstance(_popup_aliases, dict):
        return {"error": "popup_options.aliases must be a dict."}
    if not isinstance(_popup_omit, dict):
        return {"error": "popup_options.omit must be a dict (layer_name -> [field, ...])."}

    if source_props is not None and not isinstance(source_props, dict):
        return {"error": "source_props must be a dict (or JSON-string dict)."}

    # ------------------------------------------------------------------
    # Phase 3: Delegate to LayerConfigurationBuilder. Builder owns
    # configuration.type, source.type, source.props placement, GeoJSON
    # placement at source.geojson, and required-field validation as a
    # secondary safety net.
    # ------------------------------------------------------------------
    try:
        builder = LayerConfigurationBuilder(name, source_type)
        # Merge flat source props with advanced source_props dict. Advanced
        # dict overrides flat where keys overlap — caller-supplied data
        # wins over derived defaults. (Conflict on layer-level scalars is
        # rejected above; source-level overlap is more often legitimate
        # — e.g., advanced `projection` on top of a default URL-only
        # source_props.)
        if _flat_source_props:
            builder.set_source_properties(**_flat_source_props)
        if source_props:
            builder.set_source_properties(**source_props)
        if geojson_payload is not None:
            builder.set_geojson(geojson_payload)
        if opacity is not None:
            builder.set_opacity(opacity)
        if min_zoom is not None:
            builder.set_min_zoom(min_zoom)
        if max_zoom is not None:
            builder.set_max_zoom(max_zoom)
        # Apply layer_props after the flat scalars so the conflict check
        # above is the only path through which both can be present.
        if layer_props:
            for key, val in layer_props.items():
                if key == "opacity":
                    builder.set_opacity(val)
                elif key == "minResolution":
                    builder.set_min_resolution(val)
                elif key == "maxResolution":
                    builder.set_max_resolution(val)
                elif key == "minZoom":
                    builder.set_min_zoom(val)
                elif key == "maxZoom":
                    builder.set_max_zoom(val)
                elif key == "minZoomQuery":
                    builder.set_min_zoom_query(val)
        if queryable:
            builder.set_queryable(True)
        if legend is not None:
            builder.set_legend(legend)
        if style is not None:
            builder.set_style(style)
        if attribute_variables:
            for key, variable in attribute_variables.items():
                builder.add_attribute_variable(key, variable, attr_key)
        # Popup options: aliases + omitted fields.
        for layer_name, alias_map in _popup_aliases.items():
            if not isinstance(alias_map, dict):
                return {
                    "error": (
                        f"popup_options.aliases[{layer_name!r}] must be a dict "
                        f"of field-name -> alias."
                    )
                }
            for field, alias in alias_map.items():
                builder.add_attribute_alias(field, alias, layer_name)
        for layer_name, fields in _popup_omit.items():
            if not isinstance(fields, list):
                return {
                    "error": (
                        f"popup_options.omit[{layer_name!r}] must be a list "
                        f"of field names."
                    )
                }
            for field in fields:
                builder.omit_popup_attribute(field, layer_name)
        layer_config = builder.build()
    except ValueError as err:
        return {"error": str(err)}

    return {
        "layer_update": {
            "map_uuid": map_uuid,
            "layer": layer_config,
        }
    }


# ---------------------------------------------------------------------------
# Generic update protocol — patch_visualization (R1–R10)
# ---------------------------------------------------------------------------
#
# Validates RFC 6902 JSON Patch envelopes and returns them for client-side
# apply. The server does NOT persist or apply patches — it enforces the
# envelope contract (shape, whitelist, layer-construction boundary) and
# emits a {patch_update} envelope the engine accumulates and the reducer
# applies in DashboardLayout.js.
#
# Non-goals here:
#   - Server-side state access (the server is stateless re: grid items).
#   - Server-side patch apply (the reducer owns that, using rfc6902).
#   - Runtime target-UUID existence check (the reducer returns target_missing
#     if the UUID isn't in current React state).

_ALLOWED_OPS = {"add", "replace", "remove", "move", "test"}
_BARE_LAYER_INDEX = re.compile(r"^/args/layers/\d+$")

# Paths where the persisted value must be a specific Python shape. Enforced
# at the MCP boundary so the LLM gets a clear structured error rather than
# crashing the renderer (e.g., Card.js / DataTable.js both assume
# ``data.length`` works, which blows up for non-array payloads). Keep the
# list tight — each entry is a CONTRACT with a specific renderer.
_VALUE_SHAPE_RULES: Dict[tuple, tuple] = {
    # (source, path) -> (expected_type_tuple, type_label)
    ("Inline Plotly", "/args/inlineData/data"): ((list,), "list"),
    ("Inline Plotly", "/args/inlineData/layout"): ((dict,), "object"),
    ("Inline Plotly", "/args/inlineData/config"): ((dict,), "object"),
    ("Inline Table", "/args/inlineData/data"): ((list,), "list"),
    ("Inline Card", "/args/inlineData/data"): ((list,), "list"),
}


def _validate_value_shapes(source: str, patches: List[Dict[str, Any]]) -> Optional[str]:
    """Reject ops whose value type would later crash the renderer.

    Only runs on ``add`` / ``replace`` / ``test`` (ops that carry a value).
    ``remove`` and ``move`` are skipped. Matches paths exactly — deeper
    ops inside a constrained subtree are left to RFC 6902 semantics.
    """
    for i, op in enumerate(patches):
        if op.get("op") not in ("add", "replace", "test"):
            continue
        rule = _VALUE_SHAPE_RULES.get((source, op.get("path")))
        if not rule:
            continue
        expected, label = rule
        if not isinstance(op.get("value"), expected):
            return (
                f"op {i} at {op['path']!r} requires value type {label}, "
                f"got {type(op.get('value')).__name__}. The renderer for "
                f"{source!r} depends on this shape."
            )
    return None


def _coerce_known_values(source: str, patches: List[Dict[str, Any]]) -> None:
    """Mirror create-tool value coercions on matching patch ops.

    Keeps patch-vs-create behavior symmetric: anything the LLM can pass to a
    create tool should land the same way via patch. Mutates ``patches``
    in-place (the envelope is about to be returned verbatim to the client).
    """
    for op in patches:
        if op.get("op") not in ("add", "replace", "test"):
            continue
        # Mirror create_map_visualization's BASE_MAPS shorthand resolution
        # so ``{"op":"replace","path":"/args/baseMap","value":"imagery"}``
        # becomes the full ArcGIS MapServer URL before the reducer sees it.
        if source == "Map" and op.get("path") == "/args/baseMap":
            value = op.get("value")
            if isinstance(value, str):
                op["value"] = BASE_MAPS.get(value, value)


def _validate_patch_envelope_shape(patches):
    """R1/R2: structural validation.

    Returns an error string or None.
    """
    if not isinstance(patches, list):
        return "`patches` must be a list of operations"
    if len(patches) == 0:
        return "`patches` list is empty — envelopes must contain at least one op"
    for i, op in enumerate(patches):
        if not isinstance(op, dict):
            return f"op {i} is not an object"
        if "op" not in op:
            return f"op {i} missing required field `op`"
        if op["op"] not in _ALLOWED_OPS:
            return (
                f"op {i} has unsupported op {op['op']!r} "
                f"(supported: {sorted(_ALLOWED_OPS)}; `copy` intentionally excluded)"
            )
        if "path" not in op:
            return f"op {i} missing required field `path`"
        if not isinstance(op["path"], str):
            return f"op {i} field `path` must be a string"
        if not op["path"].startswith("/"):
            return f"op {i} path {op['path']!r} must be an absolute JSON Pointer starting with `/`"
        # Op-type-specific field requirements per RFC 6902
        if op["op"] in {"add", "replace", "test"} and "value" not in op:
            return f"op {i} ({op['op']}) missing required field `value`"
        if op["op"] == "move":
            if "from" not in op:
                return f"op {i} (move) missing required field `from`"
            if not isinstance(op["from"], str):
                return f"op {i} (move) field `from` must be a string"
            if not op["from"].startswith("/"):
                return (
                    f"op {i} (move) `from` {op['from']!r} must be an absolute "
                    f"JSON Pointer starting with `/`"
                )
    return None


def _check_r5c_array_collision(patches):
    """R5c: reject multi-op envelopes with >1 index-shifting op targeting the
    same array parent.

    Sequential-index semantics shift indices after each op — LLMs get this
    wrong. The LLM's recovery path is a single `replace` on the parent array.

    Applies to any indexed array parent (not just /args/layers). `move` is
    treated as `remove + add` and participates in the collision check at both
    its `from` and `path`. `replace` at an index is index-stable and does NOT
    participate.

    Returns an error string or None.
    """
    add_remove_by_parent = {}

    def _add_collision_candidate(parent_path, op_index):
        """Register this op's parent path if it ends in an array-index segment."""
        segments = parent_path.split("/")
        if len(segments) < 2:
            return
        last = segments[-1]
        # Only group when the trailing segment is an array-index marker
        if last == "-" or last.isdigit():
            parent = "/".join(segments[:-1])
            add_remove_by_parent.setdefault(parent, []).append(op_index)

    for i, op in enumerate(patches):
        op_name = op.get("op")
        if op_name == "add" or op_name == "remove":
            _add_collision_candidate(op.get("path", ""), i)
        elif op_name == "move":
            # A `move` is semantically `remove(from) + add(path)`. Both endpoints
            # participate in index-shift problems.
            _add_collision_candidate(op.get("from", ""), i)
            _add_collision_candidate(op.get("path", ""), i)
    for parent, indices in add_remove_by_parent.items():
        if len(indices) > 1:
            return (
                f"multiple add/remove ops target the same array parent {parent!r} "
                f"(op indices {indices}). RFC 6902 applies ops sequentially so "
                f"array indices shift after each op — this produces incorrect "
                f"results. Emit a single `replace` on {parent!r} carrying the "
                f"intended final array instead."
            )
    return None


def _check_layer_construction_boundary(source, patches):
    """R9/R10: Map layer construction is reserved for add_map_service_layer.

    Reject `add` at /args/layers/- or /args/layers/N (creates new layer).
    Reject `replace` at /args/layers/N (replaces whole layer object).
    Allow field-level ops under an existing layer (e.g., /args/layers/N/visible).

    Returns an error string or None.
    """
    if source != "Map":
        return None
    for i, op in enumerate(patches):
        op_name = op.get("op")
        path = op.get("path", "")
        if op_name == "add":
            if path == "/args/layers/-" or _BARE_LAYER_INDEX.match(path):
                return (
                    f"op {i} `add` at {path!r} would construct a new map layer, "
                    f"which is not permitted via patch_visualization. Use the "
                    f"`add_map_service_layer` tool to add a new service layer "
                    f"(WMS, ESRI, GeoJSON, KML, tile, etc.) with its required "
                    f"flat parameters."
                )
        if op_name == "replace":
            if _BARE_LAYER_INDEX.match(path):
                return (
                    f"op {i} `replace` at {path!r} would replace a whole layer "
                    f"object, which is not permitted. Either patch individual "
                    f"fields within the existing layer (e.g., "
                    f"{path}/configuration/props/opacity or "
                    f"{path}/visible) or use `add_map_service_layer` to add a "
                    f"new layer."
                )
    return None


def _emit_rejection_telemetry(
    *,
    reason: str,
    source: str,
    path: str,
    op_index: Optional[int] = None,
    **extra: Any,
) -> None:
    """Emit a structured INFO log record for a patch_visualization rejection.

    Feeds a downstream dataset that informs future R10 pattern-deny-list
    extensions. Kept intentionally minimal: no arg values, no external
    sink. The log-aggregation side is out of scope for this iteration.

    Keys are stable for log-parser consumers:
      * event: "whitelist_rejected"
      * source: the viz source name
      * path: the rejected JSON Pointer
      * op_index: zero-based op index when applicable
      * reason: machine-readable cause category
    """
    payload = {
        "event": "whitelist_rejected",
        "source": source,
        "path": path,
        "reason": reason,
    }
    if op_index is not None:
        payload["op_index"] = op_index
    if extra:
        payload.update(extra)
    LOGGER.info("patch_rejection %s", payload)


@mcp.tool(
    name="patch_visualization",
    description=(
        "Update an existing visualization in place via RFC 6902 JSON Patch ops. "
        "Use this to change properties on a visualization the user has already created — "
        "e.g., rename a plot, toggle a map's legend, remove a layer, replace table data. "
        "DO NOT use this for a visualization created in the same turn; include the change "
        "in the create call, or patch in a subsequent turn once the new UUID appears in "
        "dashboard_state. "
        "Look up the target UUID and its source type from the dashboard_state injection in "
        "your system context. The same injection carries `editable_paths_by_source` — the "
        "whitelist of allowed path prefixes for each viz source. Every path MUST start with "
        "`/args/...` (the persisted viz wraps its configuration in an `args` object). Each "
        "whitelist entry is a PREFIX you can extend: if `/args/inlineData` is allowed, then "
        "`/args/inlineData/layout/title`, `/args/inlineData/data/0/x`, and similar deeper "
        "paths are all allowed. "
        "Paths use JSON Pointer syntax (RFC 6901): literal `.` in a segment is preserved "
        "as-is (do not escape). Supported ops: add, replace, remove, move, test. "
        "Copy is intentionally excluded. "
        "To CREATE a new map layer, use add_map_service_layer — this tool is for edits only."
    ),
    tags=["visualization", "patch", "update"],
)
def patch_visualization(
    target_uuid: Annotated[
        str,
        Field(description="UUID of the target visualization (from dashboard_state)."),
    ],
    source: Annotated[
        str,
        Field(description=(
            "Registry source name of the target visualization — must match the "
            "source shown in dashboard_state for this UUID."
        )),
    ],
    patches: Annotated[
        Union[List[Dict[str, Any]], str],
        Field(description=(
            "Array of RFC 6902 operations. Each operation is an object with "
            "`op` (one of: add, replace, remove, move, test), `path` (JSON "
            "Pointer string starting with '/'), and — depending on op — "
            "`value` (for add/replace/test) or `from` (for move). "
            "The server coerces a JSON-string payload to a list for callers "
            "that serialize arrays as strings."
        )),
    ],
    description: Annotated[
        Optional[str],
        Field(description=(
            "Optional natural-language summary of the change for audit + logging."
        )),
    ] = None,
) -> Dict[str, Any]:
    """Apply an RFC 6902 JSON Patch envelope against an existing visualization.

    Server-side validation only — envelope shape, R5c array-op collision,
    per-viz path whitelist, R9 layer-construction boundary. Returns
    `{patch_update: {uuid, source, ops}}` on success; the engine accumulates
    and the reducer applies client-side via rfc6902.

    Returns `{error: "..."}` with a structured error class prefix on failure:
    `invalid_envelope`, `whitelist_rejected`.
    """
    # Dict-coercion pattern (see docs/solutions/best-practices/mcp-tool-dict-parameter-coercion)
    if isinstance(patches, str):
        try:
            patches = json.loads(patches)
        except json.JSONDecodeError as e:
            return {"error": f"invalid_envelope: `patches` is not valid JSON: {e}"}

    # R1/R2: envelope shape
    shape_error = _validate_patch_envelope_shape(patches)
    if shape_error:
        return {"error": f"invalid_envelope: {shape_error}"}

    # R5c: multi-op array collision
    r5c_error = _check_r5c_array_collision(patches)
    if r5c_error:
        return {"error": f"invalid_envelope: {r5c_error}"}

    # R7 / R9: per-source path whitelist (fail-closed). Dispatch by source:
    # static built-in viz types use the JSON-backed whitelist; plugin-backed
    # viz types (Intake + client_custom) resolve at patch-time via
    # editable_schemas_plugin.resolve_editable_paths. Include the allowed
    # prefixes in the error so the LLM can recover in one round even if
    # the initial dashboard_state injection was dropped or truncated.
    if source in LLM_EDITABLE_PATHS:
        allowed_prefixes = LLM_EDITABLE_PATHS[source]
        def _path_allowed(path: str) -> bool:
            return is_path_allowed(source, path)
    else:
        allowed_prefixes = resolve_editable_paths(source)
        def _path_allowed(path: str) -> bool:
            return is_path_allowed_plugin(source, path)
    for i, op in enumerate(patches):
        if not _path_allowed(op["path"]):
            _emit_rejection_telemetry(
                reason=(
                    "pattern_or_author_denied" if allowed_prefixes
                    else "resolution_failure_or_unknown_source"
                ),
                source=source,
                path=op["path"],
                op_index=i,
            )
            return {"error": (
                f"whitelist_rejected: op {i} path {op['path']!r} is not editable "
                f"for viz source {source!r}. Every path must start with `/args/...` "
                f"and fall under one of the allowed prefixes for this source: "
                f"{allowed_prefixes}. Each entry is a prefix you can extend "
                f"(e.g., if `/args/inlineData` is allowed, then "
                f"`/args/inlineData/layout/title` is allowed too)."
            )}
        # `move` reads from a second pointer and removes the node there.
        # The `from` path must also be in the whitelist, otherwise a
        # whitelisted `path` would surface arbitrary internal fields.
        if op["op"] == "move" and not _path_allowed(op["from"]):
            _emit_rejection_telemetry(
                reason=(
                    "pattern_or_author_denied" if allowed_prefixes
                    else "resolution_failure_or_unknown_source"
                ),
                source=source,
                path=op["from"],
                op_index=i,
                op="move.from",
            )
            return {"error": (
                f"whitelist_rejected: op {i} `from` {op['from']!r} is not "
                f"editable for viz source {source!r}. A `move` op is a read "
                f"followed by a write; both ends must fall under one of the "
                f"allowed prefixes for this source: {allowed_prefixes}."
            )}

    # R9/R10: layer-construction boundary (Map only)
    layer_error = _check_layer_construction_boundary(source, patches)
    if layer_error:
        return {"error": f"whitelist_rejected: {layer_error}"}

    # Value-shape validation: enforce renderer contracts that create tools
    # already enforce via Pydantic. Prevents a valid-envelope patch from
    # silently crashing Card.js / DataTable.js with a non-array payload.
    shape_error = _validate_value_shapes(source, patches)
    if shape_error:
        return {"error": f"invalid_envelope: {shape_error}"}

    # Value coercions that mirror the create tools (e.g., baseMap shorthand).
    # Run AFTER validation so shape rules apply to the pre-coercion value.
    _coerce_known_values(source, patches)

    LOGGER.info(
        "patch_visualization: target_uuid=%s source=%s ops=%d description=%s",
        target_uuid, source, len(patches), description,
    )
    return {
        "patch_update": {
            "uuid": target_uuid,
            "source": source,
            "ops": patches,
        }
    }


# ---------------------------------------------------------------------------
# Variable input + intake plugin tools
# ---------------------------------------------------------------------------

@mcp.tool(
    name="create_variable_input",
    description="Create an interactive variable input that other visualizations can reference with ${variable_name} syntax",
    tags=["visualization", "dashboard", "variable"],
)
def create_variable_input(
    variable_name: Annotated[str, Field(description="Variable name used in ${...} references by other visualizations")],
    variable_type: Annotated[str, Field(description=(
        "Input type: 'text', 'number', 'checkbox', 'date', 'dropdown', "
        "'slider', 'date-range', or 'csv-uploader'"
    ))] = "text",
    initial_value: Annotated[str, Field(description="Default value for the variable input")] = "",
    options: Annotated[Optional[Union[List[str], str]], Field(description=(
        "Options for dropdown type. Provide as a comma-separated string "
        "or a list of strings."
    ))] = None,
    slider_min: Annotated[Optional[float], Field(description="Minimum value for slider type")] = None,
    slider_max: Annotated[Optional[float], Field(description="Maximum value for slider type")] = None,
    slider_step: Annotated[Optional[float], Field(description="Step increment for slider type")] = None,
    w: Annotated[int, Field(description="Grid width in columns (out of 100)")] = 25,
    h: Annotated[int, Field(description="Grid height in row units")] = 12,
) -> Dict[str, Any]:
    """Create a variable input on the dashboard.

    Variable inputs are interactive controls (text fields, dropdowns, sliders)
    that other visualizations can reference using ${variable_name} syntax.
    When the user changes the input, all linked visualizations auto-refresh.
    To link a plugin to this variable, call list_intake_plugins to get the source name,
    then render_plugin with args referencing ${variable_name}.
    """
    valid_types = [
        "text", "number", "checkbox", "date",
        "dropdown", "slider", "date-range", "csv-uploader",
    ]
    if variable_type not in valid_types:
        return {"error": f"Invalid variable_type '{variable_type}'. Must be one of: {valid_types}"}

    # Coerce string options to list (LLMs may pass "A,B,C" instead of ["A","B","C"])
    if isinstance(options, str):
        options = [o.strip() for o in options.split(",")]

    # Validate type-specific requirements
    if variable_type == "dropdown" and not options:
        return {"error": "variable_type 'dropdown' requires the 'options' parameter"}
    if variable_type == "slider" and (slider_min is None or slider_max is None):
        return {"error": "variable_type 'slider' requires 'slider_min' and 'slider_max' parameters"}

    LOGGER.info("create_variable_input: name=%s, type=%s, initial=%s", variable_name, variable_type, initial_value)

    args = {
        "variable_name": variable_name,
        "initial_value": initial_value,
    }

    if variable_type == "dropdown":
        # Dropdown: variable_options_source is the array of option strings.
        # The frontend renders a select/dropdown when it receives an array.
        args["variable_options_source"] = options
    elif variable_type == "slider":
        args["variable_options_source"] = "slider"
        # Slider metadata goes in the dotted key that Base.js reads at line 336:
        # metadata: args["variable_options_source.metadata"]
        try:
            initial_num = float(initial_value) if initial_value else slider_min
        except (ValueError, TypeError):
            initial_num = slider_min
        args["variable_options_source.metadata"] = {
            "min": slider_min,
            "max": slider_max,
            "step": slider_step or 1,
            "dataType": "Number",
            "initialValue": initial_num,
            "outputFormat": "{{n}}",
        }
    else:
        args["variable_options_source"] = variable_type

    return {
        "visualization": {
            "source": "Variable Input",
            "vizType": "variableInput",
            "uuid": str(uuid.uuid4()),
            "args": args,
            "w": w,
            "h": h,
        }
    }


@mcp.tool(
    name="list_intake_plugins",
    description="List all installed backend plugins. Returns source (intake driver name), label, type, and argument names for each plugin. Use the 'source' field when calling render_plugin.",
    tags=["discovery", "plugin"],
)
def list_intake_plugins() -> Dict[str, Any]:
    """List all installed Python intake-driver plugins available in TethysDash.

    Returns a compact list of plugins with:
    - source: the intake driver name (USE THIS in render_plugin)
    - label: display name
    - type: visualization type (plotly, table, map, etc.)
    - arg_names: list of argument names the plugin accepts

    IMPORTANT: When calling render_plugin, use the 'source' field,
    NOT the 'label' field. The source is the Python driver name that
    the backend uses to instantiate the plugin.

    Note: Requires the TethysDash Django server to be running.
    """
    try:
        response = http_requests.get(
            f"{TETHYSDASH_BASE_URL}/visualizations/list/",
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
        # Django API returns {"visualizations": [...groups...]}, not a bare list
        groups = data.get("visualizations", []) if isinstance(data, dict) else data if isinstance(data, list) else []
        LOGGER.info("list_intake_plugins: fetched %d groups with %d total plugins",
                     len(groups),
                     sum(len(g.get("options", [])) for g in groups if isinstance(g, dict)))

        # Return compact format: source + label + type + arg names only.
        # Full argument schemas are large (~10-100KB) and cause the result
        # to be truncated, preventing the LLM from seeing all plugins.
        compact = []
        for group in groups:
            options = group.get("options", []) if isinstance(group, dict) else []
            for opt in options:
                entry = {
                    "source": opt.get("source", ""),
                    "label": opt.get("label", ""),
                    "type": opt.get("type", ""),
                }
                # Extract just argument names from the args schema
                args = opt.get("args", {})
                if isinstance(args, dict):
                    entry["arg_names"] = list(args.keys())
                compact.append(entry)

        return {"intake_plugins": compact}
    except http_requests.RequestException as e:
        LOGGER.error("Failed to fetch intake plugins from Django: %s", e)
        return {"error": f"Failed to fetch intake plugins from TethysDash: {e}"}


def _resolve_dynamic_map_layer_plugin(source: str) -> Dict[str, Any]:
    """Look up a runtime map-layer plugin by source name.

    Returns a dict with one of:
      - {"plugin": <metadata_dict>}: the source resolved to a plugin
        flagged as a runtime map-layer plugin.
      - {"error": <message>}: source unknown OR resolved plugin is not
        a runtime map-layer (wrong type, or dynamic_map_layer=False).
    """
    try:
        response = http_requests.get(
            f"{TETHYSDASH_BASE_URL}/visualizations/list/",
            timeout=10,
        )
        response.raise_for_status()
    except http_requests.RequestException as exc:
        return {"error": f"Failed to fetch plugin metadata: {exc}"}

    data = response.json()
    groups = data.get("visualizations", []) if isinstance(data, dict) else []

    for group in groups:
        for opt in group.get("options", []) if isinstance(group, dict) else []:
            if opt.get("source") == source:
                if opt.get("type") != "map_layer":
                    return {
                        "error": (
                            f"Plugin {source!r} is type {opt.get('type')!r}; "
                            f"add_dynamic_map_layer requires type=='map_layer'."
                        )
                    }
                if not opt.get("dynamic_map_layer"):
                    return {
                        "error": (
                            f"Plugin {source!r} is a static map_layer plugin "
                            f"(dynamic_map_layer=False). Use add_map_service_layer "
                            f"with the plugin's pre-baked layer config instead."
                        )
                    }
                return {"plugin": opt}

    return {"error": f"Unknown plugin source: {source!r}"}


@mcp.tool(
    name="add_dynamic_map_layer",
    description=(
        "Add a runtime plugin-backed map layer to an existing map. The plugin "
        "must be installed and flagged as a runtime map-layer plugin "
        "(type='map_layer' AND dynamic_map_layer=True). The MCP tool persists "
        "a GeoJSON scaffold layer with a pluginSource block; the plugin's "
        "fetch_features method is invoked at render time. Use list_intake_plugins "
        "to discover available plugin source names; only plugins with type "
        "'map_layer' are accepted here."
    ),
    tags=["map", "layer", "plugin", "runtime"],
)
def add_dynamic_map_layer(
    map_uuid: Annotated[str, Field(description="UUID returned by create_map_visualization")],
    source: Annotated[str, Field(description=(
        "Intake plugin source name (the 'source' field from list_intake_plugins). "
        "Must resolve to a plugin with type=='map_layer' and "
        "dynamic_map_layer=True; other plugins are rejected."
    ))],
    name: Annotated[str, Field(description="Display name for the layer in the layer control")],
    args: Annotated[Optional[Union[Dict[str, Any], str]], Field(description=(
        "Plugin args dict passed to fetch_features at render time. Supports "
        "${variable_name} syntax for dashboard variable references — these "
        "are preserved verbatim at persist time. Pass None or omit when the "
        "plugin takes no args."
    ))] = None,
) -> Dict[str, Any]:
    """Add a runtime plugin-backed map layer.

    Builder constructs a GeoJSON scaffold (empty FeatureCollection if no
    inline data) with configuration.props.pluginSource set, matching the
    persisted shape the UI's runtime-plugin selector produces. Render-time
    fetch failures surface through Map.js's existing visualization-error
    path (no new error handling here).
    """
    LOGGER.info(
        "add_dynamic_map_layer: map_uuid=%s, source=%s, name=%s",
        map_uuid, source, name,
    )

    # Coerce JSON-string args (consistent with the existing dict-parameter
    # coercion pattern used across these tools).
    if isinstance(args, str):
        args = json.loads(args)
    # set_plugin_source raises on non-dict args; coerce None → {} at the
    # boundary so callers don't need to know that detail.
    if args is None:
        args = {}
    if not isinstance(args, dict):
        return {"error": "args must be a dict (or JSON-string dict) or None."}

    resolution = _resolve_dynamic_map_layer_plugin(source)
    if "error" in resolution:
        return resolution

    try:
        builder = LayerConfigurationBuilder(name, "GeoJSON")
        builder.set_plugin_source(source, args)
        layer_config = builder.build()
    except ValueError as err:
        return {"error": str(err)}

    return {
        "layer_update": {
            "map_uuid": map_uuid,
            "layer": layer_config,
        }
    }


@mcp.tool(
    name="render_plugin",
    description=(
        "Create a visualization using an installed backend plugin. "
        "Call list_intake_plugins first to discover available plugins and their args. "
        "Use the 'source' field from the results. "
        "To link to a dashboard variable input, use ${variable_name} syntax in arg values — "
        "the visualization auto-refreshes when the variable changes."
    ),
    tags=["visualization", "dashboard", "plugin"],
)
def render_plugin(
    source: Annotated[str, Field(description="Intake driver name from the 'source' field in list_intake_plugins results. Always call list_intake_plugins first to get the exact source name. Do NOT guess or invent source names — using a wrong name causes a 'not installed' error.")],
    args: Annotated[Dict[str, Any], Field(description="Plugin arguments. Use ${variable_name} syntax to reference dashboard variable inputs. Example: {\"gauge_id\": \"${my_gauge}\"}")],
    w: Annotated[int, Field(description="Grid width in columns (out of 100)")] = 50,
    h: Annotated[int, Field(description="Grid height in row units")] = 25,
) -> Dict[str, Any]:
    """Create a visualization using a Python intake-driver plugin.

    IMPORTANT: Always call list_intake_plugins first to get the exact source name.
    The source parameter must match the 'source' field from list_intake_plugins results.
    Using a wrong or guessed name causes a 'Visualization is not installed' error.

    Args can reference variable inputs using ${variable_name} syntax —
    when the referenced variable changes, the visualization auto-refreshes.
    """
    LOGGER.info("render_plugin: source=%s, args=%s", source, args)

    return {
        "visualization": {
            "source": source,
            "vizType": "intake_plugin",
            "uuid": str(uuid.uuid4()),
            "args": args,
            "w": w,
            "h": h,
        }
    }


# ---------------------------------------------------------------------------
# MFE rendering tools
# ---------------------------------------------------------------------------

# Hidden from LLM — not registered as an MCP tool.
# Kept as internal function for backward compatibility.
# Can be re-exposed later via BM25SearchTransform.
def render_mfe(
    url: Annotated[str, Field(description="URL to the MFE's remoteEntry.js")],
    scope: Annotated[str, Field(description="Module Federation scope name")],
    module: Annotated[str, Field(description="Module path starting with './' (e.g., './ChartPanel')")],
    remote_type: Annotated[str, Field(description="Federation type: 'vite-esm' or 'webpack'")] = "vite-esm",
    props: Annotated[Optional[Dict[str, Any]], Field(description="Props to pass to the MFE component")] = None,
    w: Annotated[int, Field(description="Grid width in columns (out of 100)")] = 50,
    h: Annotated[int, Field(description="Grid height in row units")] = 25,
) -> Dict[str, Any]:
    """Render a custom Module Federation microfrontend component on the dashboard.

    NOTE: This function is hidden from the LLM tool registry.
    Use render_custom_visualization for plugins listed in
    list_available_visualizations.
    """
    # Normalize module path — must start with './'
    normalized_module = module if module.startswith("./") else f"./{module.lstrip('/')}"

    return {
        "visualization": {
            "source": "Client Custom",
            "vizType": "custom",
            "args": {
                "url": url,
                "scope": scope,
                "module": normalized_module,
                "remoteType": remote_type,
                "initialData": props or {},
            },
            "w": w,
            "h": h,
        }
    }


# ---------------------------------------------------------------------------
# Client plugin rendering
# ---------------------------------------------------------------------------

def _validate_plugin_props(source: str, props: Dict) -> Optional[str]:
    """Validate props against a plugin's declared arg schema. Returns error string or None.

    When schema is non-empty:
    - Strips unknown props not in schema
    - Validates types for known props
    - Requires non-checkbox args

    When schema is empty: accepts any props (backward compat).
    """
    all_plugins = _get_all_plugins()
    plugin = next((p for p in all_plugins if p["source"] == source), None)
    if not plugin:
        available = [p["source"] for p in all_plugins]
        return f"Plugin '{source}' not found. Available: {available}"

    schema = plugin.get("args", {})

    # Empty schema: permissive mode (backward compat)
    if not schema:
        return None

    # Strip unknown props
    unknown = [k for k in props if k not in schema]
    if unknown:
        LOGGER.warning(
            "Stripping unknown props for '%s': %s (declared: %s)",
            source, unknown, list(schema.keys()),
        )
        for k in unknown:
            del props[k]

    # Validate declared args
    for arg_name, arg_spec in schema.items():
        value = props.get(arg_name)
        if value is None:
            continue
        if isinstance(arg_spec, list) and value not in arg_spec:
            return f"Invalid value '{value}' for '{arg_name}'. Must be one of: {arg_spec}"
        if isinstance(arg_spec, dict):
            # Rich schema: validate based on inner type field
            inner_type = arg_spec.get("type")
            if inner_type == "array" and not isinstance(value, list):
                return f"'{arg_name}' must be an array, got: {type(value).__name__}"
            if inner_type == "object" and not isinstance(value, dict):
                return f"'{arg_name}' must be an object, got: {type(value).__name__}"
            if inner_type == "string" and not isinstance(value, str):
                return f"'{arg_name}' must be a string, got: {type(value).__name__}"
            if inner_type == "number" and not isinstance(value, (int, float)):
                return f"'{arg_name}' must be a number, got: {type(value).__name__}"
            continue
        if arg_spec == "number" and not isinstance(value, (int, float)):
            return f"'{arg_name}' must be a number, got: {type(value).__name__}"
        if arg_spec == "text" and not isinstance(value, str):
            return f"'{arg_name}' must be a string, got: {type(value).__name__}"
        if arg_spec == "object" and not isinstance(value, dict):
            return f"'{arg_name}' must be an object, got: {type(value).__name__}"
        if arg_spec == "array" and not isinstance(value, list):
            return f"'{arg_name}' must be an array, got: {type(value).__name__}"

    # Check required args — rich schemas can declare required: false
    for arg_name, arg_spec in schema.items():
        if arg_name in props:
            continue
        # Rich schema objects: check required field (default: true)
        if isinstance(arg_spec, dict) and not arg_spec.get("required", True):
            continue
        # Simple type strings: checkbox is optional, everything else required
        if arg_spec == "checkbox":
            continue
        return f"Missing required arg: '{arg_name}'"

    return None


@mcp.tool(
    name="render_custom_visualization",
    description="Render a registered custom visualization component on the dashboard. Call list_available_visualizations first to see available custom plugins.",
    tags=["dashboard", "visualization", "custom"],
)
def render_custom_visualization(
    source: Annotated[str, Field(description="Client plugin source name from list_available_visualizations")],
    props: Annotated[Optional[Dict[str, Any]], Field(description="Props to pass to the plugin component. Check list_available_visualizations for each plugin's required args and valid values.")] = None,
    w: Annotated[int, Field(description="Grid width in columns (out of 100)")] = 50,
    h: Annotated[int, Field(description="Grid height in row units")] = 30,
) -> Dict[str, Any]:
    """Render a registered client plugin on the dashboard.

    ALWAYS use this tool for plugins listed in
    list_available_visualizations. This tool reads the correct URL, scope,
    module, and validates props against the plugin's declared arg schema.
    """
    safe_props = props or {}
    all_plugins = _get_all_plugins()

    LOGGER.info("render_custom_visualization called: source=%s, props=%s", source, safe_props)

    validation_error = _validate_plugin_props(source, safe_props)
    if validation_error:
        return {"error": validation_error}

    plugin = next((p for p in all_plugins if p["source"] == source), None)
    if plugin is None:
        available = [p["source"] for p in all_plugins]
        LOGGER.warning("Plugin '%s' not found. Available: %s", source, available)
        return {"error": f"Plugin '{source}' not found. Available: {available}"}

    # Runtime MFE plugins: return Module Federation coordinates.
    # The frontend resolves the remoteEntry.js URL (see chatbox.jsx handleResult).
    if plugin.get("type") == "client_custom_remote":
        viz_spec = {
            "source": "Client Custom",
            "vizType": "custom",
            "uuid": str(uuid.uuid4()),
            "scope": plugin.get("scope"),
            "module": plugin.get("module"),
            "remoteType": plugin.get("remoteType", "vite-esm"),
            "args": safe_props,
            "w": w,
            "h": h,
        }
        if plugin.get("url"):
            viz_spec["url"] = plugin["url"]
        if plugin.get("dataKey"):
            viz_spec["dataKey"] = plugin["dataKey"]
        return {"visualization": viz_spec}

    # Build-time npm plugins: render via ClientModuleLoader
    return {
        "visualization": {
            "source": source,
            "vizType": "client_custom",
            "uuid": str(uuid.uuid4()),
            "args": safe_props,
            "w": w,
            "h": h,
        }
    }


# ---------------------------------------------------------------------------
# Runtime plugin registration
# ---------------------------------------------------------------------------

@mcp.tool(
    name="register_runtime_plugin",
    description="Register a runtime MFE plugin so it appears in available visualizations and can be rendered with render_custom_visualization",
    tags=["dashboard", "plugin", "register"],
)
def register_runtime_plugin(
    url: Annotated[str, Field(description="URL to the remoteEntry.js file")],
    scope: Annotated[str, Field(description="Module Federation scope name")],
    module: Annotated[str, Field(description="Exposed module path (e.g., './MyPanel')")],
    label: Annotated[str, Field(description="Display name for the plugin")],
    remote_type: Annotated[str, Field(description="Remote type: 'vite-esm' or 'webpack'")] = "vite-esm",
    description: Annotated[str, Field(description="Human-readable description")] = "",
    group: Annotated[str, Field(description="Visualization group/category")] = "Custom",
    data_key: Annotated[str, Field(description="variableInputValues key this panel reads")] = "",
) -> Dict[str, Any]:
    """Register a runtime MFE plugin so it appears in available visualizations.

    The plugin is saved to the server-side registry and becomes immediately
    available via list_available_visualizations and render_custom_visualization.
    """
    LOGGER.info("register_runtime_plugin called: url=%s, scope=%s, module=%s, label=%s", url, scope, module, label)

    all_plugins = _get_all_plugins()
    key = f"{scope}/{module}"
    if any(f"{p.get('scope')}/{p.get('module')}" == key for p in all_plugins):
        LOGGER.warning("Plugin %s already registered, skipping", key)
        return {"error": f"Plugin {key} is already registered."}

    entry = {
        "id": str(uuid.uuid4()),
        "source": label.strip(),
        "url": url.strip(),
        "scope": scope.strip(),
        "module": module.strip(),
        "remoteType": remote_type,
        "label": label.strip(),
        "description": description,
        "group": group,
        "tags": [],
        "dataKey": data_key,
        "args": {},
        "type": "client_custom_remote",
    }

    registry_path = os.path.normpath(os.path.join(
        os.path.dirname(__file__), "..", "..", "..",
        "reactapp", "generated", "runtimePluginRegistry.json"
    ))
    runtime = load_runtime_plugin_registry()
    runtime.append(entry)
    os.makedirs(os.path.dirname(registry_path), exist_ok=True)
    with open(registry_path, "w") as f:
        json.dump(runtime, f, indent=2)

    LOGGER.info("Registered plugin %s → %s (total runtime: %d)", key, label, len(runtime))
    return {"status": "registered", "plugin": entry}


# ---------------------------------------------------------------------------
# Discovery tools
# ---------------------------------------------------------------------------

def _collect_intake_plugin_whitelists() -> Dict[str, List[str]]:
    """Return {source: resolved_paths} for every registered Intake plugin.

    Iterates ``intake.source.registry`` and resolves each source through the
    shared editable-paths resolver. Used by list_available_visualizations to
    feed the client-side dashboard_state injection with authoritative
    server-computed whitelists (see Unit C2 of the plan).
    """
    try:
        import intake
        registry = intake.source.registry
    except (ImportError, AttributeError):
        return {}
    results: Dict[str, List[str]] = {}
    try:
        source_names = list(registry)
    except TypeError:
        return {}
    for source in source_names:
        # Skip obvious non-plugin drivers. The canonical TethysDash plugin
        # signal is whether resolve_editable_paths returns a non-empty list
        # OR the plugin is in the TethysDashPlugin family. We surface every
        # source the resolver recognizes; those that are not TethysDashPlugin
        # subclasses will return empty lists, which we still emit so the
        # client can distinguish "known but no paths" from "unknown".
        results[source] = resolve_editable_paths(source)
    return results


@mcp.tool(
    name="list_available_visualizations",
    description="List all visualization types: native (charts, tables, maps), registered custom visualizations, and MFE components",
    tags=["discovery"],
)
def list_available_visualizations() -> Dict[str, Any]:
    """List all visualization types available for creating dashboard items.

    Returns built-in types (plotly, table, map, card, text, image),
    installed client plugins with argument schemas, and MFE rendering info.
    """
    return {
        "builtin": [
            {
                "type": "plotly",
                "name": "Plotly Chart",
                "tool": "create_plotly_chart",
                "description": "Interactive line/bar/scatter charts via Plotly.js",
                "prefer_native": True,
            },
            {
                "type": "table",
                "name": "Data Table",
                "tool": "create_data_table",
                "description": "Tabular data display with headers and rows",
                "prefer_native": True,
            },
            {
                "type": "map",
                "name": "Map",
                "tool": "create_map_visualization",
                "description": "OpenLayers map. Supports WMS, GeoJSON, KML, ESRI services, Image/Vector tiles, PMTiles, Static Image",
                "prefer_native": True,
            },
            {
                "type": "card",
                "name": "Card",
                "tool": "create_card",
                "description": "Simple card with title, description, and data value",
                "prefer_native": True,
            },
            {
                "type": "image",
                "name": "Custom Image",
                "tool": "create_custom_image",
                "description": "Display an image from a URL",
                "prefer_native": True,
            },
            {
                "type": "text",
                "name": "Text",
                "tool": "create_text",
                "description": "Static text content",
                "prefer_native": True,
            },
        ],
        "client_plugins": [
            {
                "source": plugin["source"],
                "label": plugin.get("label", plugin["source"]),
                "group": plugin.get("group", "Client Plugins"),
                "description": plugin.get("description", ""),
                "tags": plugin.get("tags", []),
                "args_schema": _convert_plugin_args_to_schema(plugin.get("args", {})),
                "tool": "render_custom_visualization",
                # Server-authoritative whitelist for LLM guidance. Reflects the
                # full composition: registered args filtered by author
                # declarations then by the R10 sensitive-name pattern deny-list.
                # Client-side dashboard_state injection consumes this to tell
                # the LLM which /args/* paths are actually patchable.
                "llm_editable_paths": resolve_editable_paths(plugin["source"]),
            }
            for plugin in _get_all_plugins()
        ],
        # Per-source whitelists for every registered Intake plugin. Same
        # composition as client_plugins above; separate field because
        # list_intake_plugins still proxies to Django for the full arg
        # spec, so we surface only the editable-paths information here.
        "intake_plugin_editable_paths": _collect_intake_plugin_whitelists(),
        "mfe": {
            "tool": "render_custom_visualization",
            "description": "Module Federation components are rendered via render_custom_visualization. Use register_runtime_plugin to add new MFE plugins, then render them with render_custom_visualization.",
            "note": "The legacy render_mfe tool is hidden. Use render_custom_visualization instead.",
        },
        "variable_inputs": {
            "tool": "create_variable_input",
            "description": "Create interactive variable inputs (text, number, date, slider, checkbox). Other visualizations reference them with ${variable_name} syntax.",
        },
        "intake_plugins": {
            "tool": "list_intake_plugins",
            "description": "Python backend plugins installed via intake. Call list_intake_plugins to discover available plugins and their args, then use render_plugin to create visualizations.",
        },
    }


# ---------------------------------------------------------------------------
# Logging + Entry Point
# ---------------------------------------------------------------------------

def _configure_logging():
    level = os.getenv("TETHYSDASH_LOG_LEVEL", "INFO").upper()
    logging.basicConfig(
        level=getattr(logging, level, logging.INFO),
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    )


if __name__ == "__main__":
    _configure_logging()
    port = int(os.getenv("TETHYSDASH_MCP_PORT", "9001"))
    LOGGER.info(f"Starting TethysDash MCP Server on 0.0.0.0:{port} with SSE transport")
    mcp.run(
        transport="sse",
        host="0.0.0.0",
        port=port,
        middleware=CORS_MIDDLEWARE,
    )

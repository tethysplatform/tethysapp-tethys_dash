"""Dashboard-manipulation tools for the chat agent."""
from typing import Any

from pydantic_ai import RunContext 

from ..geocode import geocode
from ..pending import store_pending
from ..streaming import emit_progress
from ..validation import ChatDeps


# ArcGIS base map shorthand → full MapServer URL. Mirrors the
# tethysdash-MCP's BASE_MAPS dict. If a caller passes an already-resolved
# URL it falls through unchanged.
BASE_MAPS = {
    "streets": "https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer",
    "imagery": "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
    "topo": "https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer",
    "light_gray": "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer",
    "dark_gray": "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer",
    "terrain": "https://services.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer",
    "ocean": "https://services.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer",
}

def _resolve_map_extent(center: str | None, zoom: int) -> dict[str, str] | str | None:
    """Return an extent dict for the composed args, or an error string, or None.

    Returned string means geocoding failed and the tool should short-circuit
    with that message. None means no center was requested. A dict is the
    composed extent ready to attach to args.
    """
    if not center:
        return None
    coords = geocode(center)
    if coords is None:
        return (
            f"Could not geocode {center!r}. Try a more specific place "
            "name or provide coordinates via a different tool call."
        )
    lon, lat = coords
    return {"extent": f"{lon},{lat},{int(zoom)}", "projection": "EPSG:4326"}


def _stage_map_proposal(
    ctx: RunContext[ChatDeps],
    layer: dict[str, Any],
    resolved_base_map: str,
    extent: dict[str, str] | None,
    preview_body: str,
) -> str:
    """Stash the pending map proposal and return the user-visible preview.

    Shared between per-source-type map tools so the compose + stash step
    stays identical regardless of layer type.
    """
    args: dict[str, Any] = {
        "baseMap": resolved_base_map,
        "layers": [layer],
        "layerControl": True,
    }
    if extent:
        args["map_extent"] = extent

    store_pending(
        ctx.deps.chat_id,
        {
            "kind": "add_map_tile",
            "dashboard_id": ctx.deps.dashboard_id,
            "args": args,
            "w": 60,
            "h": 45,
        },
    )

    return (
        f"I'd like to add this map to dashboard {ctx.deps.dashboard_id}:\n\n"
        f"{preview_body}\n\n"
        f"Reply **yes** to confirm, or say what to change."
    )


def add_wms_map(
    ctx: RunContext[ChatDeps],
    name: str,
    wms_url: str,
    wms_layers: str,
    center: str | None = None,
    base_map: str = "streets",
    zoom: int = 8,
) -> str:
    """Stage a Map tile with a WMS layer for user approval.

    This tool does NOT write to the dashboard. It composes the map
    configuration, stashes it under the caller's chat_id via
    ``store_pending``, and returns a preview string. The controller
    detects a bare ``yes``/``confirm`` on the next chat turn and
    commits via ``actions.commit_proposal``.

    Use this when the user wants a MAP with a WMS SERVICE layer
    (workspace:layer syntax, WMS URL, e.g. GeoServer, MapServer).

    Args:
        name: Layer display name shown in the map's layer control.
        wms_url: The WMS service URL.
        wms_layers: The WMS LAYERS parameter value (e.g. workspace:layer).
        center: Optional place name to center the map on. Server-side
            geocoded via Nominatim; if unresolvable the tool returns a
            helpful error instead of composing a proposal.
        base_map: Base map shorthand or a full ArcGIS MapServer URL.
            Recognized shorthands: streets, imagery, topo, light_gray,
            dark_gray, terrain, ocean.
        zoom: Zoom level used when centering by place name (1=world,
            8=regional, 12=city, 18=street).

    Returns:
        A Markdown preview message that will be shown to the user. Reply
        ``yes`` on the next turn to commit the tile.
    """
    emit_progress(ctx.deps.chat_id, "Composing WMS map proposal...")

    resolved_base_map = BASE_MAPS.get(base_map, base_map)
    extent_or_error = _resolve_map_extent(center, zoom)
    if isinstance(extent_or_error, str):
        return extent_or_error
    extent = extent_or_error

    # WMS layer JSON shape mirrors what the frontend tests treat as
    # canonical (AddMapLayer.test.js). Nested configuration.props with
    # source.type='WMS' + source.props.{url, params.LAYERS}.
    layer = {
        "configuration": {
            "type": "ImageLayer",
            "props": {
                "name": name,
                "source": {
                    "type": "WMS",
                    "props": {
                        "url": wms_url,
                        "params": {"LAYERS": wms_layers},
                    },
                },
                "zIndex": 1,
            },
        },
    }

    center_line = (
        f"- **Center**: {center} (lon={extent['extent'].split(',')[0]}, "
        f"lat={extent['extent'].split(',')[1]}, zoom={zoom})"
        if extent
        else "- **Center**: (none specified)"
    )
    preview_body = (
        f"{center_line}\n"
        f"- **Base map**: {base_map}\n"
        f"- **Layer**: **{name}** (WMS)\n"
        f"    - URL: `{wms_url}`\n"
        f"    - Layers: `{wms_layers}`"
    )
    return _stage_map_proposal(ctx, layer, resolved_base_map, extent, preview_body)


def _add_url_map(
    ctx: RunContext[ChatDeps],
    *,
    name: str,
    url: str,
    layer_class: str,
    source_type: str,
    layer_label: str,
    center: str | None,
    base_map: str,
    zoom: int,
    progress_msg: str,
) -> str:
    """Shared implementation for URL-only per-source-type map tools.

    Every Tier 1 map tool boils down to "wrap a URL in a source of a
    specific type inside a specific layer class". Only the four caps-lock
    args change per tool; the compose + geocode + stash logic is shared
    here to avoid four near-identical function bodies.
    """
    emit_progress(ctx.deps.chat_id, progress_msg)

    resolved_base_map = BASE_MAPS.get(base_map, base_map)
    extent_or_error = _resolve_map_extent(center, zoom)
    if isinstance(extent_or_error, str):
        return extent_or_error
    extent = extent_or_error

    layer = {
        "configuration": {
            "type": layer_class,
            "props": {
                "name": name,
                "source": {
                    "type": source_type,
                    "props": {"url": url},
                },
                "zIndex": 1,
            },
        },
    }

    center_line = (
        f"- **Center**: {center} (lon={extent['extent'].split(',')[0]}, "
        f"lat={extent['extent'].split(',')[1]}, zoom={zoom})"
        if extent
        else "- **Center**: (none specified)"
    )
    preview_body = (
        f"{center_line}\n"
        f"- **Base map**: {base_map}\n"
        f"- **Layer**: **{name}** ({layer_label})\n"
        f"    - URL: `{url}`"
    )
    return _stage_map_proposal(ctx, layer, resolved_base_map, extent, preview_body)


def add_geojson_map(
    ctx: RunContext[ChatDeps],
    name: str,
    geojson_url: str,
    center: str | None = None,
    base_map: str = "streets",
    zoom: int = 8,
) -> str:
    """Stage a Map tile with a GeoJSON layer for user approval.

    Same approval-gated shape as ``add_wms_map`` - stashes the proposal
    and returns a preview; commits on the user's next-turn ``yes``.

    Use this when the user wants a MAP with a GEOJSON layer served from
    a URL (e.g. a FeatureCollection endpoint). Inline GeoJSON dicts are
    NOT accepted in this v1 - pass a URL string. Only VectorLayer
    (feature geometry) rendering is produced.

    Args:
        name: Layer display name shown in the map's layer control.
        geojson_url: The URL to a GeoJSON FeatureCollection document.
        center: Optional place name to center the map on. Same
            Nominatim-geocode behavior as ``add_wms_map``.
        base_map: Base map shorthand or a full ArcGIS MapServer URL.
        zoom: Zoom level used when centering by place name.

    Returns:
        A Markdown preview message. Reply ``yes`` to commit.
    """
    return _add_url_map(
        ctx,
        name=name,
        url=geojson_url,
        layer_class="VectorLayer",
        source_type="GeoJSON",
        layer_label="GeoJSON",
        center=center,
        base_map=base_map,
        zoom=zoom,
        progress_msg="Composing GeoJSON map proposal...",
    )


def add_esri_image_map(
    ctx: RunContext[ChatDeps],
    name: str,
    service_url: str,
    center: str | None = None,
    base_map: str = "streets",
    zoom: int = 8,
) -> str:
    """Stage a Map tile with an ESRI Image/Map Service layer for user approval.

    Use this for ArcGIS MapServer or ImageServer endpoints that serve
    raster imagery (e.g. NOAA MapServer forecasts, USGS elevation
    services). Not for feature layers - use ``add_esri_feature_map``.

    Args:
        name: Layer display name.
        service_url: The ESRI service URL (typically ends in ``/MapServer``
            or ``/ImageServer``).
        center: Optional place name to center on.
        base_map: Base map shorthand.
        zoom: Zoom level for centered maps.
    """
    return _add_url_map(
        ctx,
        name=name,
        url=service_url,
        layer_class="ImageLayer",
        source_type="ESRI Image and Map Service",
        layer_label="ESRI Image/Map Service",
        center=center,
        base_map=base_map,
        zoom=zoom,
        progress_msg="Composing ESRI Image map proposal...",
    )


def add_esri_feature_map(
    ctx: RunContext[ChatDeps],
    name: str,
    service_url: str,
    center: str | None = None,
    base_map: str = "streets",
    zoom: int = 8,
) -> str:
    """Stage a Map tile with an ESRI Feature Service layer for user approval.

    Use this for ArcGIS FeatureServer endpoints - points/lines/polygons
    served as vector features (e.g. USGS gauge locations, boundary
    layers). Not for imagery - use ``add_esri_image_map``.

    Args:
        name: Layer display name.
        service_url: The ESRI FeatureServer URL (typically ends in a
            layer index like ``/FeatureServer/0``).
        center: Optional place name to center on.
        base_map: Base map shorthand.
        zoom: Zoom level for centered maps.
    """
    return _add_url_map(
        ctx,
        name=name,
        url=service_url,
        layer_class="VectorLayer",
        source_type="ESRI Feature Service",
        layer_label="ESRI Feature Service",
        center=center,
        base_map=base_map,
        zoom=zoom,
        progress_msg="Composing ESRI Feature map proposal...",
    )


def add_kml_map(
    ctx: RunContext[ChatDeps],
    name: str,
    kml_url: str,
    center: str | None = None,
    base_map: str = "streets",
    zoom: int = 8,
) -> str:
    """Stage a Map tile with a KML layer for user approval.

    Use this for KML/KMZ documents served over HTTP (e.g. Google Earth
    exports, project-boundary KMLs).

    Args:
        name: Layer display name.
        kml_url: The URL to a KML document.
        center: Optional place name to center on.
        base_map: Base map shorthand.
        zoom: Zoom level for centered maps.
    """
    return _add_url_map(
        ctx,
        name=name,
        url=kml_url,
        layer_class="VectorLayer",
        source_type="KML",
        layer_label="KML",
        center=center,
        base_map=base_map,
        zoom=zoom,
        progress_msg="Composing KML map proposal...",
    )


def add_geotiff_map(
    ctx: RunContext[ChatDeps],
    name: str,
    geotiff_url: str,
    center: str | None = None,
    base_map: str = "streets",
    zoom: int = 8,
) -> str:
    """Stage a Map tile with a GeoTIFF layer for user approval.

    Use this for georeferenced raster imagery served as GeoTIFF files
    (DEMs, satellite imagery, orthophotos). The file must be a
    web-accessible URL.

    Args:
        name: Layer display name.
        geotiff_url: The URL to a GeoTIFF file.
        center: Optional place name to center on.
        base_map: Base map shorthand.
        zoom: Zoom level for centered maps.
    """
    return _add_url_map(
        ctx,
        name=name,
        url=geotiff_url,
        layer_class="ImageLayer",
        source_type="GeoTIFF",
        layer_label="GeoTIFF",
        center=center,
        base_map=base_map,
        zoom=zoom,
        progress_msg="Composing GeoTIFF map proposal...",
    )

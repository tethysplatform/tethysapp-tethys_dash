"""Specialist agent: build a Map tile with any of several per-source-type layer tools.

Same shape as ``grid_item_builder_agent`` in ``viz_agent.py`` — one-tool-per-
candidate ``NativeOutput``. Every candidate STAGES the tile via
``pending.store_pending`` and returns a preview; commit happens on the next
chat turn when the user replies ``yes`` (see ``controllers.chat_message``).

Adding a new layer type: write the tool in ``tools.py`` following the
``_add_url_map`` template and append it to the ``NativeOutput`` candidate
list below. Watch the total candidate count — small models get worse at
picking as the list grows past ~6 candidates.
"""
from __future__ import annotations

from pydantic_ai import Agent, ModelSettings, NativeOutput

from .config import model
from .tools import (
    add_esri_feature_map,
    add_esri_image_map,
    add_geojson_map,
    add_geotiff_map,
    add_kml_map,
    add_wms_map,
)
from .validation import ChatDeps


map_builder_agent = Agent(
    model,
    output_type=NativeOutput([
        add_wms_map,
        add_geojson_map,
        add_esri_image_map,
        add_esri_feature_map,
        add_kml_map,
        add_geotiff_map,
    ]),
    deps_type=ChatDeps,
    retries=3,
    model_settings=ModelSettings(
        max_tokens=600,
        extra_body={"chat_template_kwargs": {"enable_thinking": False}},
    ),
    instructions=(
        "The user wants to add a MAP tile to their dashboard. Pick the "
        "candidate that matches the layer type in the prompt. Use these "
        "keyword signals:\n"
        "  - add_wms_map: 'WMS', 'workspace:layer' syntax, GeoServer, "
        "MapServer with 'wms' in the URL path.\n"
        "  - add_geojson_map: 'GeoJSON', URL ending '.geojson', "
        "FeatureCollection.\n"
        "  - add_esri_image_map: 'ESRI' or 'ArcGIS' Image/Map Service; "
        "URL ending '/MapServer' or '/ImageServer' — for RASTER imagery.\n"
        "  - add_esri_feature_map: 'ESRI' or 'ArcGIS' Feature Service; "
        "URL ending '/FeatureServer/<n>' — for FEATURE geometry.\n"
        "  - add_kml_map: 'KML', 'KMZ', URL ending '.kml'.\n"
        "  - add_geotiff_map: 'GeoTIFF', 'DEM', 'raster', URL ending "
        "'.tif' or '.tiff'.\n"
        "\n"
        "Common args across all candidates:\n"
        "  - name: short display name for the layer.\n"
        "  - center: optional place name to center the map on.\n"
        "  - base_map: optional shorthand — streets, imagery, topo, "
        "light_gray, dark_gray, terrain, ocean (defaults to streets).\n"
        "  - zoom: optional integer zoom level (defaults to 8).\n"
        "\n"
        "Candidate-specific URL args are documented on each function. "
        "add_wms_map also takes wms_layers (the LAYERS param).\n"
        "\n"
        "The tool composes a preview and asks the user for confirmation — "
        "do NOT confirm on the user's behalf, do NOT invent values the "
        "prompt doesn't provide. If a required URL is missing from the "
        "prompt, ask the user for it rather than guessing."
    ),
)

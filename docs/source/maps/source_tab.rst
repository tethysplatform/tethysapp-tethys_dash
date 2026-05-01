.. _source_tab:

----------
Source Tab
----------


The source tab defines the data source for the layer and its properties. After selecting a source type, relevant properties will appear for further customization. Some properties are required for the layer to render, while others are optional. The available source types and their properties are listed below.

------------------------------------------------------------------------------------------------------------------------

++++++++++++++++++++++++++
ESRI Image and Map Service
++++++++++++++++++++++++++

**Openlayers Class:** `ImageArcGISRest <https://openlayers.org/en/latest/apidoc/module-ol_source_ImageArcGISRest-ImageArcGISRest.html>`_

**Layer Properties:**
    - **url:** (required) ArcGIS Rest service URL for a Map Service or Image Service. The url should include /MapServer or /ImageServer.
    - **attributions:** (optional) Attributions.
    - **params - LAYERS:** (optional) Determines which layers appear on the exported map. Syntax is in the form of "[show | hide | include | exclude]:layerId1,layerId2". See `ESRI documentation <https://developers.arcgis.com/rest/services-reference/enterprise/export-map/>`_ for more information.
    - **params - TIME:** (optional) The time instant or time extent of the exported map image. Syntax is in the form of "<timeInstant>" or "<startTime>, <endTime>". See `ESRI documentation <https://developers.arcgis.com/rest/services-reference/enterprise/export-map/>`_ for more information.
    - **params - LAYERDEFS:** (optional) Allows you to filter the features of individual layers in the exported map by specifying definition expressions for those layers. Syntax is in the form of "{"<layerId1>": "<layerDef1>", "<layerId2>": "<layerDef2>"}". See `ESRI documentation <https://developers.arcgis.com/rest/services-reference/enterprise/export-map/>`_ for more information.
    - **params - mosaicRule:** (optional) Allows you to set a mosaic rule for image services.
    - **projection:** (optional) Projection of the source data. Default is the view projection (EPSG:3857).

------------------------------------------------------------------------------------------------------------------------

++++++++++++++++++++
ESRI Feature Service
++++++++++++++++++++

**Openlayers Class:** `EsriJSON <https://openlayers.org/en/latest/apidoc/module-ol_format_EsriJSON-EsriJSON.html>`_

**Layer Properties:**
    - **url:** (required) ArcGIS Rest service URL for the feature service.
    - **layer:** (required) Layer index to use.
    - **attributions:** (optional) Attributions.
    - **params - TIME:** (optional) The time instant or time extent of the exported map image. Syntax is in the form of "<timeInstant>" or "<startTime>, <endTime>". See `ESRI documentation <https://developers.arcgis.com/rest/services-reference/enterprise/export-map/>`_ for more information.
    - **params - WHERE:** (optional) A query filter for the feature service. e.g. confidence='high'.
    - **projection:** (optional) Projection of the source data. Default is the view projection (EPSG:3857).

------------------------------------------------------------------------------------------------------------------------

+++
WMS
+++

**Openlayers Class:** `ImageWMS <https://openlayers.org/en/latest/apidoc/module-ol_source_ImageWMS-ImageWMS.html>`_

**Layer Properties:**
    - **url:** (required) WMS service URL.
    - **params - LAYERS:** (required) A comma delimited list of layers within the WMS service. Syntax is in the form of "<workspace>:<layerName>,<workspace>:<layerName>".
    - **attributions:** (optional) Attributions.
    - **params - STYLES:** (optional) The name of a preloaded SLD (Styled Layer Descriptor). For additional custom styling, see the style tab.
    - **params - TIME:** (optional) Time value of layer desired.  Syntax is in the form of "yyyy-MM-ddThh:mm:ss.SSSZ".
    - **projection:** (optional) Projection. Default is the view projection (EPSG:3857).

------------------------------------------------------------------------------------------------------------------------

++++++++++
Image Tile
++++++++++

**Openlayers Class:** `ImageTileSource <https://openlayers.org/en/latest/apidoc/module-ol_source_ImageTile-ImageTileSource.html>`_

**Layer Properties:**
    - **url:** (required) Image Tile URL.
    - **attributions:** (optional) Attributions.
    - **projection:** (optional) Projection. Default is the view projection (EPSG:3857).

------------------------------------------------------------------------------------------------------------------------

++++++++
GeoJSON
++++++++


The GeoJSON source is different from the other options. It provides a text area and a button to upload your GeoJSON file. GeoJSONs must follow the `GeoJSON specification <https://datatracker.ietf.org/doc/html/rfc7946>`_ and include a "crs.properties.name" value for projection information. Example of a valid GeoJSON::

    {
        "type": "FeatureCollection",
        "crs": {
            "properties": {
                "name": "EPSG:3857"
            }
        },
        "features": [{
            "type": "Feature",
            "geometry": {
                "type": "Point",
            "coordinates": [0, 0]
            }
        }]
    }

------------------------------------------------------------------------------------------------------------------------

+++++++++++
Vector Tile
+++++++++++

**Openlayers Class:** `VectorTile <https://openlayers.org/en/latest/apidoc/module-ol_source_VectorTile-VectorTile.html>`_

**Layer Properties:**
    - **urls:** (required) A comma delimited list of URL templates. Must include {x}, {y} or {-y}, and {z} placeholders. A {?-?} template pattern, for example subdomain{a-f}.domain.com, may be used instead of defining each one separately in the urls option.
    - **attributions:** (optional) Attributions.
    - **projection:** (optional) Projection. Default is the view projection (EPSG:3857).

------------------------------------------------------------------------------------------------------------------------

+++
KML
+++

**Openlayers Class:** `KML <https://openlayers.org/en/latest/apidoc/module-ol_format_KML-KML.html>`_

**Layer Properties:**
    - **urls:** (required) KML file URL. Must be publicly accessible.
    - **attributions:** (optional) Attributions.
    - **projection:** (optional) Projection. Default is the view projection (EPSG:3857).

------------------------------------------------------------------------------------------------------------------------

++++++++++++++
PMTiles Vector
++++++++++++++

**Layer Properties:**
    - **urls:** (required) PMTiles Vector Tile URL. Must be publicly accessible and include {x}, {y} or {-y}, and {z} placeholders.
    - **attributions:** (optional) Attributions.
    - **tileSize:** (optional) Tile size. Default is 256.

------------------------------------------------------------------------------------------------------------------------

++++++++++++++
PMTiles Raster
++++++++++++++

**Layer Properties:**
    - **urls:** (required) PMTiles Raster Tile URL. Must be publicly accessible and include {x}, {y} or {-y}, and {z} placeholders.
    - **attributions:** (optional) Attributions.
    - **tileSize:** (optional) Tile size. Default is 256.

------------------------------------------------------------------------------------------------------------------------

++++++++++++
Static Image
++++++++++++

**Openlayers Class:** `ImageStatic <https://openlayers.org/en/latest/apidoc/module-ol_source_ImageStatic-ImageStatic.html>`_

The Static Image source overlays a georeferenced image (PNG, GIF, JPG, etc.) on the map at a specific location defined by a bounding extent. This is useful for displaying weather radar imagery, historical maps, satellite captures, or any image that needs to be positioned at a specific geographic location.

**Layer Properties:**
    - **url:** (required) URL of the image to display. Must be publicly accessible.
    - **projection:** (required) Projection of the image extent coordinates (e.g. ``EPSG:3857``, ``EPSG:4326``).
    - **imageExtent:** (required) Bounding extent of the image as a comma-separated string in the format ``minX, minY, maxX, maxY``, using coordinates in the specified projection.
    - **attributions:** (optional) Attributions.

**Interactive Placement:**

Instead of manually entering the ``imageExtent`` coordinates, you can use the **Draw Extent on Map** button to visually place the image:

1. Enter the image URL in the source properties.
2. Click the **Draw Extent on Map** button. The layer configuration modal will temporarily hide, revealing the map.
3. Click and drag on the map to draw a rectangle where the image should appear. A semi-transparent preview of the image will display over the drawn area.
4. Adjust the rectangle corners to resize or reposition the image as needed.
5. Click **Confirm** to accept the placement. The modal will reappear with the ``imageExtent`` and ``projection`` fields automatically populated.
6. Click **Cancel** to return to the modal without changes.

.. note::
    When editing an existing Static Image layer, the original layer is temporarily hidden during placement so the preview is clearly visible.

**Example JSON Configuration:**

::

    {
        "type": "ImageLayer",
        "props": {
            "name": "Weather Radar",
            "source": {
                "type": "Static Image",
                "props": {
                    "url": "https://example.com/radar.png",
                    "projection": "EPSG:3857",
                    "imageExtent": "-14070864.27, 5265423.09, -12936622.21, 6254376.58"
                }
            }
        }
    }

------------------------------------------------------------------------------------------------------------------------

+++++++
GeoTIFF
+++++++

**Openlayers Class:** `WebGLTile <https://openlayers.org/en/latest/apidoc/module-ol_layer_WebGLTile-WebGLTileLayer.html>`_

The GeoTIFF source overlays a Cloud-Optimized GeoTIFF (COG) on the map at its native projection; the dashboard view re-projects on the fly. Files **must** be Cloud-Optimized GeoTIFFs — plain GeoTIFFs will not render. A single GeoTIFF layer accepts one or more sources (one per band channel) which are combined in the Style tab.

**Per-source Properties:**
    - **url:** (required) URL to the COG file. Must be publicly accessible.
    - **bands:** (optional) Comma-separated 1-based band indices to read from this source. Defaults to all bands.
    - **min:** (optional) Minimum sample value used for normalization.
    - **max:** (optional) Maximum sample value used for normalization.
    - **nodata:** (optional) Sample value to treat as transparent.
    - **projection:** (optional) Source projection (e.g. ``EPSG:4326``). Defaults to the file's embedded metadata.
    - **overviews:** (optional) One overview URL per line, used for lower-zoom rendering.

**Adding GeoTIFF sources:**

1. Choose ``GeoTIFF`` as the source type. The Source tab will show an empty sources list and an **Add GeoTIFF Source** button.
2. Click **Add GeoTIFF Source** to open the entry modal, fill in the URL (and any optional fields), and click **Save**.
3. Repeat to add additional sources (for example one per R/G/B band). Each row in the sources list can be edited or removed independently.
4. Configure per-band color (R/G/B/Alpha or single-band ramp) on the :ref:`style_tab`.

**Example JSON Configuration:**

::

    {
        "type": "WebGLTile",
        "props": {
            "name": "Elevation",
            "source": {
                "type": "GeoTIFF",
                "props": {
                    "sources": [
                        {
                            "url": "https://example.com/elevation.tif",
                            "bands": "1",
                            "min": 0,
                            "max": 4000,
                            "nodata": -9999,
                            "projection": "EPSG:4326",
                            "overviews": []
                        }
                    ]
                }
            }
        }
    }

------------------------------------------------------------------------------------------------------------------------

+++++++++++++
Custom Layers
+++++++++++++

Custom Layers are GeoJSON layers backed by a Python plugin that opts into runtime behavior by setting ``dynamic_map_layer = True``. The plugin's ``run()`` method produces the configure-time scaffold (source, style, legend, attribute metadata) and its ``fetch_features()`` method returns a GeoJSON ``FeatureCollection`` at view time — including each time a bound variable input changes.

**Where it appears:**

When adding a layer, dynamic plugins are listed under the **Custom Layers** group in the source-type dropdown.

**Configure-time behavior:**
    - **Required arguments:** rendered automatically from the plugin's ``args`` schema. Variable inputs may be bound to args using the same syntax as other visualizations.
    - **Style, legend, and attributes:** snapshot at save time so author edits are never silently overwritten by plugin updates. Click **Reset to plugin defaults** to pick up updated defaults on demand.

**Render-time behavior:**
    - Features refresh in place — the underlying OpenLayers ``VectorLayer`` is preserved across updates, so popups and highlight selections survive re-fetches.
    - Re-fetches on variable-input change are debounced and the older in-flight request is cancelled when a new one starts.
    - Per-layer progress messages from ``self.send_update(...)`` are routed to the layer's progress indicator.
    - If the backing plugin is missing on the server (e.g. uninstalled), the layer renders with a "Plugin not available" banner rather than failing the whole map.

For the plugin-author contract — ``dynamic_map_layer``, ``fetch_features``, ``LayerConfigurationBuilder.set_plugin_source``, the return-shape validator, and progress streaming — see :ref:`visualizationplugins`.




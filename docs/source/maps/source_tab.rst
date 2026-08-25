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

+++++++++
Shapefile
+++++++++


The Shapefile source draws an ESRI Shapefile that is already published on the web. The browser fetches and reads it directly — nothing is uploaded to TethysDash, and the saved layer keeps only the URL, so the file stays wherever it already lives and stays current when it is replaced there.

Two forms are accepted, and the same **url** field takes either:

- A **zipped shapefile**, whose path ends in ``.zip``.
- The **.shp component** of an unzipped set. The sibling ``.dbf``, ``.prj`` and ``.shx`` files are requested from the same path automatically, so only the ``.shp`` URL is entered. Any query string on the URL is preserved on each request, which keeps signed links working.

    - **url:** *(required)* URL of a zipped shapefile, or of its ``.shp`` component. Must be ``http`` or ``https``.
    - **projection:** *(optional)* Used only when the shapefile carries no ``.prj``. Accepts a code such as ``EPSG:5070``, or a full WKT or proj4 definition for a coordinate system the map does not already know.
    - **attributions:** *(optional)* Attribution text for the layer.

The coordinate system comes from the shapefile's own ``.prj`` and does not need to be entered. If the file has no ``.prj``, the **projection** property is used instead; if neither is present the layer reports that its coordinates cannot be placed rather than guessing at them.

Attribute values come from the ``.dbf``. If that component is missing, the geometry still draws but the layer offers no fields for style rules or popups.

Styling, popups, attribute variables and snapping all behave as they do for a :ref:`GeoJSON <source_tab>` layer — see the :ref:`style_tab` and :ref:`attributes_and_popups_tab`.

**Reading the fields.** The Style and Attributes tabs need the ``.dbf`` field names, which means reading the source. Because that can be a large download, it happens when you ask for it: use **Read shapefile fields** on this tab. One read serves both tabs. If the saved style rules, popup settings or attribute variables name a field the source no longer has — after the file is republished with a renamed column, for instance — the field is listed so the affected rules can be corrected. Those rules will not match anything until then, and the layer will still draw.

**Size limit.** A shapefile is read in one piece, so the components are limited to 25 MB once decompressed. A source above the limit is refused before it is expanded, and the message states both the observed and the permitted size. Clip or simplify the data, or serve a reduced copy.

.. note::

    The browser must be allowed to fetch the file, which means the host has to send permissive `CORS <https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS>`_ headers. Most agency open-data portals do — ArcGIS Hub and AWS-hosted government buckets among them — but some widely used sources do not. Census TIGER files, for example, cannot be read from a browser at all. When a fetch is refused, the layer says so and suggests converting the shapefile to GeoJSON and using the :ref:`GeoJSON <source_tab>` source instead, which stores the data with the dashboard rather than fetching it.

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

The GeoTIFF source overlays a Cloud-Optimized GeoTIFF (COG) on the map at its native projection; the dashboard view re-projects on the fly. Files **must** be Cloud-Optimized GeoTIFFs — plain strip-based GeoTIFFs, and some compression/predictor combinations, may fail silently. Convert with::

    gdal_translate -of COG -co COMPRESS=DEFLATE -co PREDICTOR=YES input.tif output.tif

**Properties:**
    - **url:** (required) URL to the COG file. Must be publicly accessible. Supports variable inputs, e.g. ``https://example.com/${Storm}/depth.tif`` — the layer reloads and its color ramp refits whenever the variable changes.
    - **projection:** (optional) Source projection (e.g. ``EPSG:4326``). Defaults to the file's embedded metadata.
    - **mask_below:** (optional) Cells at or below this value render transparent. See :ref:`raster_color_ramp` for how it interacts with the ramp.

There is no nodata setting. A raster's nodata value is its own business and is read from the
file's ``GDAL_NODATA`` tag automatically; ``NaN`` cells are masked even when the file declares
nothing. Use **mask_below** to hide a range of real values, such as zero-probability cells.

Pick a color ramp for the layer on the :ref:`style_tab`.

**Example JSON Configuration:**

::

    {
        "type": "WebGLTile",
        "props": {
            "name": "Elevation",
            "source": {
                "type": "GeoTIFF",
                "props": {
                    "url": "https://example.com/elevation.tif",
                    "nodata": "-9999",
                    "projection": "EPSG:4326"
                },
                "rampName": "turbo"
            }
        }
    }

.. note::
    A GeoTIFF layer reads one file. OpenLayers can composite several files as separate band channels, but that is not exposed here — if you need it, the layer JSON can still be authored by hand.

Zarr
++++

The Zarr source renders a raster layer from a public `Zarr <https://zarr.dev/>`_ store with no pre-processing. TethysDash reads the chosen variable slice on demand, converts it to a Cloud-Optimized GeoTIFF in memory, and draws it — so you supply a store URL and a variable rather than a prepared COG. It is styled and queried like a GeoTIFF layer: pick a color ramp on the :ref:`style_tab` and click the map for pixel values.

**Layer Properties:**
    - **url:** (required) Public URL of the Zarr store (an ``https`` bucket or ``s3://`` URL).
    - **variable:** (required) Array name to read (e.g. ``depth``).
    - **index:** (optional) Slice index along the store's leading dimension for stacked ``[n, y, x]`` data (default ``0``). Bind it to a :ref:`variable input <variableinputs>` with ``${Variable Name}`` to switch slices on the fly — for example, drive it with a slider to animate.
    - **mask_below:** (optional) Sample values at or below this number render transparent. Leave blank to use the store's own threshold, if it declares one.

**Example JSON Configuration:**

::

    {
        "type": "WebGLTile",
        "props": {
            "name": "Flood Depth",
            "source": {
                "type": "Zarr",
                "props": {
                    "url": "https://example.com/floodmaps.zarr",
                    "variable": "depth",
                    "index": "${Storm}"
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




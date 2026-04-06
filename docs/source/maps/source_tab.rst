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




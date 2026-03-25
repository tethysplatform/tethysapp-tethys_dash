.. _style_tab:

---------
Style Tab
---------


The style tab lets you apply custom styles to map layers. Styling follows the `MapLibre Style Spec <https://maplibre.org/maplibre-style-spec/>`_ and uses the `ol-mapbox-style applyStyle <https://openlayers.org/ol-mapbox-style/functions/applyStyle.html>`_ function. Refer to these resources to ensure your layers render correctly.

+++++++
Example
+++++++

GeoJSON::

    {
        "type": "FeatureCollection",
        "crs": {
            "properties": {
                "name": "EPSG:3857"
            }
        },
        "features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [
                        0,
                        0
                    ]
                }
            }
        ]
    }

.. figure:: ../../images/geojson.png
    :align: center

    GeoJSON layer without custom styling

Style JSON::

    {
        "version": 8,
        "sources": {
            "my-geojson-source": {
                "type": "geojson"
            }
        },
        "layers": [
            {
                "id": "points-layer",
                "type": "circle",
                "source": "my-geojson-source",
                "filter": [
                    "==",
                    "$type",
                    "Point"
                ],
                "paint": {
                    "circle-radius": 8,
                    "circle-color": "#FF0000",
                    "circle-stroke-width": 2,
                    "circle-stroke-color": "#FFFFFF"
                }
            }
        ]
    }

.. figure:: ../../images/styled_geojson.png
    :align: center

    GeoJSON layer with custom styling


.. warning::
    For styling to work, the "sources" key in the JSON object must match the layer name from the layer tab. For example, if your layer is named "My Beautiful Layer", the styling JSON should look like::

        {
            "version": 8,
            "name": ...,
            "sprite": ...,
            "glyphs": ...,
            "sources": { 
                "My Beautiful Layer": {...}
            },
            "layers": [...]
        }

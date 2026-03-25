.. _layer_tab:

---------
Layer Tab
---------


The layer tab is used to configure the overall layer, including its name and properties. These properties are based on the `OpenLayers Layer class <https://openlayers.org/en/latest/apidoc/module-ol_layer_Layer-Layer.html>`_.


**Name:** The name of the map layer. This appears in the layer control menu and summary table.


**Default Visibility:** Choose whether the layer is visible by default when the map loads.


**Layer Properties:**
    - **Opacity:** Transparency of the layer (0 to 1).
    - **minResolution:** Minimum resolution (inclusive) for layer visibility.
    - **maxResolution:** Maximum resolution (exclusive) for layer visibility.
    - **minZoom:** Minimum zoom level (exclusive) for layer visibility.
    - **maxZoom:** Maximum zoom level (inclusive) for layer visibility.
    - **minZoomQuery:** Minimum zoom level (inclusive) at which the layer can be queried. If the map is clicked beyond this zoom, it will zoom in to minZoomQuery.


**Layer Template:** At the bottom of all tabs, you can choose a layer template. This loads a preconfigured layer. Use the dropdown menu to select from available options.

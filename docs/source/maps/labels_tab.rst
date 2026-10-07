.. _labels_tab:

----------
Labels Tab
----------



The labels tab draws text on the map next to each feature of a vector layer. The text comes from a template you write, so a layer of gauges can print each gauge's station name, and a layer of basins can print each basin's name, without anyone clicking a feature to find out.

Labels are available for the same vector layers that support custom styling — GeoJSON, ESRI Feature Service, PMTiles Vector, Shapefile, GeoPackage, GeoParquet, and layers produced by a plugin. Raster, tile, and WMS layers have no features to read text from, so the tab is hidden for them.


.. _label_template:

++++++++++++++
Label Template
++++++++++++++

The template is ordinary text with references to feature attributes mixed in. A reference looks like ``${feature.station}``, using the same syntax as a popup title.

For a layer whose features carry a ``station`` attribute:

.. code-block:: text

   ${feature.station}

draws each feature's own station name. Literal text and several references can be combined:

.. code-block:: text

   Station ${feature.station} — ${feature.elevation} ft

A template may also reference a dashboard variable input, which resolves once for the whole layer rather than per feature:

.. code-block:: text

   ${feature.station} as of ${Selected Date}

If a feature is missing an attribute the template names, the rest of the template still draws for that feature and the other features are unaffected. Nothing reports the mistake, so a blank label usually means a misspelled attribute name.


.. _label_placement:

+++++++++
Placement
+++++++++

Placement is chosen from a grid of nine positions — the eight compass directions plus center — and applies to every feature on the layer. The label offsets itself from the feature's symbol so it does not cover it, and the offset grows with the symbol, so a layer whose point sizes vary by attribute keeps its labels clear.

Placement behaves differently by geometry, and the layer decides this for you rather than asking:

* **Points** sit at the chosen compass position.
* **Polygons** place their label inside the shape, at a point guaranteed to fall within it even when the outline is concave.
* **Lines** follow the line itself, so a river name bends along the river. The compass positions have no effect on a line, which is why they are ignored rather than applied.

A feature made of several parts — a basin with islands, or a reach in several segments — draws one label, not one per part.


.. _label_appearance:

++++++++++
Appearance
++++++++++

Text color and size are set per layer. An outline is always drawn behind the text, sized in proportion to the text, so labels stay readable over satellite imagery, terrain, and street basemaps alike without being configured for each.


.. _label_density:

+++++++++++++++++++
Crowding and Zoom
+++++++++++++++++++

Labels that would overlap are thinned automatically: some are not drawn so the rest stay readable, and the hidden ones reappear as you zoom in. Layers are thinned independently, so a busy layer never suppresses labels on another one.

Thinning is all or nothing for a given label — it is drawn or it is not, and nothing says which label lost. On a layer where every label matters, check **Allow Overlapping Labels** in the Placement section. Thinning is then switched off for that layer and every label draws, relying on the outline behind each one to keep it legible where two land on top of each other.

For a layer dense enough that thinning is not enough, set a **Minimum Display Zoom**. Below that zoom the layer draws its geometry with no labels at all; at or above it the labels return. Leaving the field empty means the labels always draw.

.. note::

   Thinning applies to labels, not to the features themselves. A layer's points, lines and polygons always draw, and stay clickable, whether or not their labels fit.


.. _label_plugins:

++++++++++++++++++
Labels From Plugins
++++++++++++++++++

A plugin that returns map layers can supply label settings with them. They are stored exactly as the editor stores them, so a plugin-supplied label opens in this tab and can be edited or overridden like any other.


.. _label_popups:

++++++++++++++++++++++
Labels and Popup Modals
++++++++++++++++++++++

The labels tab is hidden for layers on a map inside a popup modal. Inside a popup, a ``${feature.*}`` reference means the feature that was clicked to open the popup, not each feature of the inner layer, so a label there would resolve to something other than what it appears to say.

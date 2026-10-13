.. _labels_tab:

----------
Labels Tab
----------


The labels tab draws text on the map beside each feature of a vector layer. The text comes from a template you write, so a layer of gauges can print each gauge's station name, and a layer of basins can print each basin's name, without anyone clicking a feature to find out.

Labels are available for the same vector layers that support custom styling — GeoJSON, ESRI Feature Service, PMTiles Vector, Shapefile, GeoPackage, GeoParquet, and layers produced by a plugin. Raster, tile, and WMS layers have no features to read text from, so the tab is hidden for them.

.. Screenshot slot: the Labels tab with a template filled in. Add
   docs/images/labels_tab.png, then replace this comment with:
   .. figure:: ../../images/labels_tab.png
       :align: center


.. _label_template:

++++++++
Template
++++++++

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

If a feature is missing an attribute the template names, the rest of the template still draws for that feature and the other features are unaffected. Nothing reports the mistake, so a blank label usually means a misspelled attribute name — the **Attributes** tab lists the names a layer actually carries.

Leaving the template empty draws no labels at all.


.. _label_placement:

+++++++++
Placement
+++++++++

Placement is chosen from a grid of nine positions — the eight compass directions plus center — and applies to every feature on the layer. The label offsets itself from the feature's symbol so it does not cover it, and the offset grows with the symbol, so a layer whose point sizes vary by attribute keeps its labels clear.

.. Screenshot slot: the 3x3 placement grid in the editor. Add
   docs/images/label_placement.png, then replace this comment with:
   .. figure:: ../../images/label_placement.png
       :align: center

Placement behaves differently by geometry, and the layer decides this for you rather than asking:

* **Points** sit at the chosen compass position.
* **Polygons** place their label inside the shape, at a point guaranteed to fall within it even when the outline is concave.
* **Lines** follow the line itself, so a river name bends along the river. Only the vertical half of the placement applies: the top row draws the name above the line, the bottom row below it, and the middle row along the line itself the way a street map labels a road. Above and below clear the line by its own width, so a thicker line pushes its name further away. Left and right have no meaning once the text is following a curve.

A feature made of several parts — a basin with islands, or a reach in several segments — draws one label, not one per part.

.. Screenshot slot: a line layer labelled above, along, and below the line. Add
   docs/images/label_line_placement.png, then replace this comment with:
   .. figure:: ../../images/label_line_placement.png
       :align: center

       The same reaches labelled above the line, along it, and below it.


.. _label_appearance:

+++++++++++++++++++
Text Color and Size
+++++++++++++++++++

**Text Color**, **Text Outline Color** and **Text Size** are set per layer.

An outline is always drawn behind the text and sized in proportion to it, which is what keeps a label readable over satellite imagery, terrain and street basemaps alike. The two colors work together: light text wants a dark outline, and dark text a light one. The default is dark text with a light outline, so a layer labelled over imagery usually wants both changed rather than only the text.


.. _label_density:

+++++++++++++++++
Crowding and Zoom
+++++++++++++++++

Labels that would overlap are thinned automatically: some are not drawn so the rest stay readable, and the hidden ones reappear as you zoom in. Layers are thinned independently, so a busy layer never suppresses labels on another one.

Thinning is all or nothing for a given label — it is drawn or it is not, and nothing says which label lost. On a layer where every label matters, check **Allow Overlapping Labels**. Thinning is then switched off for that layer and every label draws, relying on the outline behind each one to keep it legible where two land on top of each other.

.. Screenshot slot: the same crowded layer thinned, then with overlap allowed.
   Add docs/images/label_overlap.png, then replace this comment with:
   .. figure:: ../../images/label_overlap.png
       :align: center

       The same gauges with thinning on, and with Allow Overlapping Labels checked.

For a layer dense enough that thinning is not enough, set a **Minimum Display Zoom**. Below that zoom the layer draws its geometry with no labels at all; at or above it the labels return. Leaving the field empty means the labels always draw.

.. note::

   Thinning applies to labels, not to the features themselves. A layer's points, lines and polygons always draw, and stay clickable, whether or not their labels fit.


.. _label_plugins:

+++++++++++++++++++
Labels From Plugins
+++++++++++++++++++

A plugin that returns map layers can supply label settings with them. They are stored exactly as the editor stores them, so a plugin-supplied label opens in this tab and can be edited or overridden like any other.


.. _label_popups:

+++++++++++++++++++++++
Labels and Popup Modals
+++++++++++++++++++++++

The labels tab is hidden for layers on a map inside a popup modal. Inside a popup, a ``${feature.*}`` reference means the feature that was clicked to open the popup, not each feature of the inner layer, so a label there would resolve to something other than what it appears to say.

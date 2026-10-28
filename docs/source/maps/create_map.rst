.. _create_map:

Create a Map
============


To create a map in the dashboard, add or edit a dashboard item (:doc:`../dashboard_editing`).

In the visualization editor, open the **Visualization Type** dropdown and select **Map**.

   .. image:: ../../images/create_map.png
      :align: center

|


The following options are available to configure the map:

--------
Base Map
--------


A list of available basemaps for the map.

-------------------
Layer Controls
-------------------


Determines whether a layer control panel is shown. Each layer in the panel has a checkbox to toggle its visibility and a magnifier button to zoom to it.

**Zoom to layer.** Clicking a layer's magnifier fits the map to that layer's extent, with a small margin on every side. It works whether or not the layer is currently visible. A map in a view group moves the rest of its group with it, as any pan or zoom would.

- **Vector layers** (GeoJSON, KML, Shapefile, annotations) zoom to their features. A layer that fetches its features from a URL loads them only when it is first drawn, so one that is hidden or outside its zoom range loads them when its magnifier is clicked, and the map moves once they arrive. An **ESRI Feature Service** loads only the part of the service in the current view, so it zooms to what has arrived for that view. A layer with no features does not move the map.
- **Raster layers** (GeoTIFF, Zarr, static image) zoom to the extent of the file or image, whatever its coordinate system. A raster whose file failed to open has its button disabled.
- **Tile layers**, including the basemap, zoom to their full tile coverage, which for a basemap is the whole world.
- **ESRI Image and Map Service** and **WMS** layers cannot be zoomed to, and their button is disabled: the server draws them one view at a time, so the map never learns where their data is.

A layer that is a single point, or very small, is zoomed to no closer than zoom level 16, the deepest the gray Canvas basemaps have tiles for.

-----------------
Layers
-----------------


A table summarizes the configured layers for the map. To add a new layer, click "Add Layer" and complete the necessary configurations. Once saved, layers appear in the table, where they can also be deleted or edited. See the :ref:`layer_configuration` section for more details.

You can also reorder layers in this table to change their rendering order.

----------------
Map Extent
----------------


Choose either **"Use the Previewed Map Extent"** (the map zooms to the current view) or **"Use a Custom Extent"** (enter minimum and maximum latitude/longitude values and optionally an extent variable name).

Below the extent, two more settings link this map to others on the dashboard:

- **View Group**: The name of the linked view group this map belongs to. Leave it blank for an independent map. See `Linked Map View Groups`_ below.
- **Use as the view group's initial extent**: This map's extent becomes the view the whole group opens at. Available only once a view group name is entered, and only for an extent that is not built from a variable template — a templated extent has no value until the variable does, so it cannot supply an opening view.
- **Linked Extent Group**: The name of the linked extent group this map belongs to. Members keep their own views; a Linked Extents layer on any member outlines where the others are looking. See `Linked Extent Groups`_ below.

.. _view_groups:

-----------------------
Linked Map View Groups
-----------------------

Maps that share a **View Group** name pan and zoom together. Move one and every other member follows; the position the cursor is hovering over on one map is marked on the others, so the same location can be compared across a satellite view, a model output and a basemap side by side.

**Joining a group.** Type the same name into **View Group** on each map that should be linked. Names are trimmed of surrounding spaces and matched exactly, including case — ``Basin`` and ``basin`` are two different groups. An empty name means the map is not in a group.

**The opening view.** By default a group opens wherever its first member happens to start. To control it, tick **Use as the view group's initial extent** on one member; that map's extent then becomes the view every member opens at. At most one map per group can carry the flag — saving a map with it set clears it from any other member of the same group, so the last one saved is the one that wins.

**Projections.** A group is pinned to the projection of its first member. A map in a different projection cannot be synced with it — its coordinates mean something else — so it stays independent and shows a warning naming both projections rather than jumping somewhere the user did not ask for.

**Plugin-supplied maps.** A map returned by a plugin can join a group by including ``viewGroup`` in its ``map_extent`` (see :ref:`visualizationplugins`), but it cannot supply the group's opening view: the plugin's extent does not exist until the plugin has run. The initial-extent flag is honored only on the built-in **Map** visualization and is set only from this editor.

**Popup layouts.** Maps inside a map's popup layout never join a view group. The setting is hidden there, and any group membership on an imported or copied popup map is dropped.

.. _linked_extent_groups:

---------------------
Linked Extent Groups
---------------------

Maps that share a **Linked Extent Group** name do not move together. Each keeps its own view and reports where it is looking, so a map with a :ref:`Linked Extents layer <linked_extents_layer>` can outline the others. That is how an inset is made: a small map showing the whole region, with a rectangle marking the area a larger, zoomed-in map is showing.

**Making an inset.**

1. Give the zoomed-in map and the zoomed-out map the same **Linked Extent Group** name, for example ``Basin``.
2. Add a **Linked Extents** layer to the zoomed-out map.
3. Save. As viewers pan and zoom the detail map, its outline moves on the inset.

Every member of a group can carry a Linked Extents layer, and a group can have any number of members. An inset tracking three detail maps draws three outlines.

**Names** are trimmed and matched exactly, as view group names are. A map can be in a view group and a linked extent group at once; members of both groups never outline each other, since they always share a view.

**Hidden tabs.** Only maps on the tab being viewed are outlined. A map on another tab drops out of its group's outlines until its tab is shown again.

**Plugin-supplied maps** join by including ``linkedExtentGroup`` in their ``map_extent``. **Popup layouts** never join, and a group name on an imported or copied popup map is dropped.

**Limitations.** A map whose view crosses the antimeridian (180° longitude), or contains a pole, may draw a wrong outline or none at all.


----------------
Map Drawing
----------------


Map drawing lets you add features directly to the map:

- **Drawn Feature Limit**: Maximum number of items that can be drawn.
- **Allowed Types**: Select which shapes can be drawn: **Point**, **LineString**, **Polygon**, **Rectangle**.
- **Variable Name**: Save drawings under a variable name for use in other visualizations.





   .. image:: ../../images/create_map_completed.png
      :align: center

|

-------------------------
Map Status and Alerts
-------------------------

Maps report what they are doing in a stack of messages in the corner of the map itself, rather than leaving a layer that is still working — or has failed — looking like an empty map.

- **Loading** (informational): Names every layer currently loading, e.g. ``Loading Flowlines, Depth Grid…``. A plugin layer that reports progress with ``self.send_update(...)`` shows its percentage alongside its name. The message clears itself when the layers settle.
- **Failure** (red): Names each layer that failed and why — an unreachable host, an unreadable coordinate system, a file over the size limit, a plugin that is not installed. Dismiss it to get it out of the way; it returns if a later load fails differently. The same message is repeated inside the layer control next to the layer it belongs to.
- **View group projection mismatch** (amber): Shown when this map's projection differs from the one its view group is pinned to, naming both. See `Linked Map View Groups`_.

The layer control lists each layer's failure message beside its visibility checkbox. Loading is reported only by the map's alert stack, since the layer control is collapsed by default.



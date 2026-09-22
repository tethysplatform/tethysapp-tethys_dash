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


Determines whether a layer control panel is shown, allowing users to toggle layer visibility.

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



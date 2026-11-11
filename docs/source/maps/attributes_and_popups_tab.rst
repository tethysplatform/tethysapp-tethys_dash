.. _attributes_and_popups_tab:

--------------------------
Attributes/Table Popup Tab
--------------------------


The Attributes/Table Popup tab configures what a layer shows when one of its features is clicked or hovered:

    - **Click** opens an attribute table at the feature. When a click lands on several features, the table pages between them.
    - **Hover** shows a small tooltip beside the cursor with the fields of the feature under it. The tooltip has no title, paging or close button. It appears once the cursor rests on a feature for about a quarter of a second and disappears as soon as the cursor moves.

A layer can use either, both, or neither. A separate Custom Modal Popup can be configured on its own tab; it always opens on click. See :ref:`popup_modal`.

**After configuring the layer name and required source properties**, a table of layers and their attributes will appear.


Choosing fields for click and hover
===================================

The table has a **Show on Click** column and a **Show on Hover** column. Check a field in a column to show it for that event. The checkbox in each column's header checks or unchecks every field of that layer at once.

    - An event is on while at least one field is checked for it. Unchecking every field in a column turns that event off for the layer.
    - **Click** shows every field except the ones unchecked under Show on Click. That includes fields the table does not list, such as extra columns a source returns.
    - **Hover** shows only the fields checked under Show on Hover. Keep it to a few fields so the tooltip stays small.
    - A new layer starts with every field checked for click and none for hover, which is how layers have always behaved.
    - The field order and the aliases apply to both the click table and the hover tooltip.

.. note::
    A layer that links a field to a variable input keeps answering clicks even with every field unchecked, as long as no field is checked for hover. The click updates the variable inputs, and no table opens. This is useful for a layer that only drives a chart.

.. note::
    Hover asks the layer what is under the cursor only once the cursor settles, so a remote ESRI or WMS layer receives one request per pause rather than several per second. A layer set to zoom in when clicked beyond a zoom level (**minZoomQuery**) shows no tooltip until the map is zoomed in that far.


Layers whose fields cannot be listed
------------------------------------

Some layers, such as GeoTIFF rasters and WMS or ESRI image services, only report their fields when they are queried, so the table cannot list them in advance. These layers get **Click** and **Hover** switches above a table where fields are entered by hand.

    - **Click** starts on and **Hover** starts off.
    - An event that is switched on shows every field the layer returns, except rows you add and uncheck for that event.
    - While a switch is off, its column is greyed out and keeps its checks, so switching it back on restores them.


Configuring attribute fields
============================

Within this table, fields can be configured in three ways:

    1. Choose which fields the click table and the hover tooltip show, as described above.

    2. The click table and the tooltip list fields in the same order as this table. Use the **↑** and **↓** buttons in the "Order" column to move a field up or down. Hidden fields keep their place, so showing one again puts it back where it was.

    3. Fields can be linked to variable inputs. See the :ref:`variableinputs` section for details. In the "Variable Input Name" column, add the desired variable input for the field whose value will be set when a feature is selected.

        - On a layer that shows fields on click, clicking a feature updates its variable inputs. Hovering does not, so moving the cursor across the map does not reload every connected chart.
        - On a layer that shows fields only on hover, hovering a feature updates its variable inputs. A click that opens the layer's Custom Modal Popup updates them too.


.. note::
    You can configure a variable input in the attributes table without adding a separate variable input visualization to the dashboard. For example, a chart can reference a new variable input, and a map field can update that variable. When a map feature is interacted with, the chart updates automatically with the field value—no need to change a dropdown or text input. See the example below.

    .. video:: ../../videos/map_variable_input.mp4
        :autoplay:
        :loop:
        :class: variable-input-video

.. note::
    A feature can carry fields the table does not list — a source that returns more columns than were discovered, features whose properties differ, or a source that has changed since the layer was configured. The popup still shows those fields, after the ordered ones, in the order the source returned them.

|


If the layer loads correctly, a static table will display the available attributes.

.. figure:: ../../images/attribute_successful.png
    :align: center

|


If the layer loads incorrectly, a dynamic table will appear, allowing you to add fields manually. New rows can be created by tabbing through the inputs.

.. figure:: ../../images/attribute_unsuccessful.png
    :align: center

|


If the layer loads correctly but no attributes are found, no table will be shown and a warning will indicate that no attributes were found.


Paging Through Several Features
===============================

A single click often lands on more than one feature — overlapping layers, a gauge inside a basin, rivers meeting at a confluence. The popup gathers all of them and pages between them, and the order is chosen so the feature that was most likely aimed at comes first.

**Ordering.** Features are ranked before the popup opens:

    1. A **snapped** feature first. A snap is a deliberate pick (see :ref:`feature_snapping`), so it keeps the first slot.
    2. Then features with real geometry, **nearest to the click first**. At equal distance, points come before lines, and lines before polygons — a polygon containing the click is zero distance away, so without this rule a basin covering the whole map would outrank the gauge inside it on every click.
    3. Then **raster pixel readouts** (GeoTIFF, Zarr and similar), whose coordinates are the click point itself and so carry no proximity information. These keep their layer order.
    4. Anything whose geometry cannot be measured sorts last rather than being dropped, so no feature is silently lost.

**Paging.** Use the popup's arrows to step through the gathered features. The list wraps in both directions: stepping past the last feature returns to the first, and back from the first goes to the last.

**With a Custom Modal Popup.** The modal is a view of the *currently selected* feature, not a separate list. Stepping onto a feature whose layer has no modal configured closes it, and stepping back reopens it.

The table and the modal close independently. Closing the table leaves the modal open on its feature, and closing the modal leaves the table open. Once both are closed, the next map click opens them again. While the table is closed, paging the modal onto a feature that has no modal reopens the table on that feature, so the selection stays on screen. See :ref:`popup_modal`.


Backward compatibility
======================

Dashboards saved before these columns existed keep working without being re-saved:

    - A layer whose table opened on **click** shows the same fields on click, and nothing on hover.
    - A layer whose table opened on **hover** now shows those fields in the hover tooltip instead of a table, and opens no table on click. Its Custom Modal Popup, if any, still opens on click, and it still updates its variable inputs on hover.
    - A layer set to **None** (or with the older **Allow Layer Query** checkbox unchecked) responds to neither.

Opening such a layer in the editor shows its fields checked in the matching column.

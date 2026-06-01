.. _popup_modal:

----------------------
Custom Modal Popup Tab
----------------------


The Custom Modal Popup tab is a separate tab in the map layer configuration modal. It is **independent** of the default :ref:`attributes_and_popups_tab` table popup — enabling one does not force the other on or off. When a user clicks a feature, what appears depends on the layer's :ref:`attributes_and_popups_tab` Table Popup Type setting:

    - **Table Popup Type = Click** + modal enabled → **both** the default attribute table popup (anchored at the click point) and the custom modal open together.
    - **Table Popup Type = None** + modal enabled → only the custom modal opens. The table overlay stays suppressed. Useful when the modal is the entire intended drill-down and the attribute table would be redundant.
    - **Table Popup Type = Hover** + modal enabled → the table popup follows the cursor (opens on hover, closes on empty); the modal opens on click.

The custom popup modal is a configurable mini-dashboard of visualizations driven by the clicked feature's attributes (charts, text, images, cards, tables, etc.). Use this tab when a single click on the map should surface a richer drill-down view than a list of fields can provide (for example: a time-series chart for a station, a photo for a site, or a multi-stat summary card for an administrative region).


Enabling the custom popup modal
===============================

1. Open a map layer for editing and go to the **Custom Modal Popup** tab.
2. Check the **Enable Custom Popup Modal** checkbox.

The position, size, title, and layout controls appear below the checkbox. Unchecking the box hides those controls but does not delete the configuration — you can flip the checkbox off and back on without losing the layout you authored.

.. note::
    The custom modal is click-driven only. Hover never opens it — even on a layer whose :ref:`attributes_and_popups_tab` Table Popup Type is set to **Hover**. (The hover trigger is intentionally limited to the small overlay table popup; full-modal hover would be too aggressive a UX.)


Default Position
================

The modal opens at a fixed position and size set by the dashboard editor. Position and size are expressed in viewport percentages so the same configuration works across different display sizes.

The tab provides two ways to set the position and size:

    - **Drag preview canvas:** a small rectangle preview lets you drag to move the modal and drag a handle to resize it. The numeric fields update as you drag.
    - **Numeric fields:**

        - **Left (%):** distance from the left edge of the viewport.
        - **Top (%):** distance from the top edge of the viewport.
        - **Width (%):** width of the modal as a percentage of the viewport width.
        - **Height (%):** height of the modal as a percentage of the viewport height.

For example, ``left=20, top=20, width=60, height=60`` opens a centered modal that covers 60% of the screen in both directions.

.. note::
    On small viewports (below 768px wide), the modal ignores these values and opens near-fullscreen with insets so the contents remain readable on phones and small tablets.


Title Template
==============

The **Title Template** field controls the text shown in the modal's header. It supports the same ``${...}`` interpolation syntax used elsewhere in TethysDash, plus a reserved ``feature`` namespace that resolves to the currently active feature's attributes.

Examples:

    - ``Site details: ${feature.station_name}`` — shows the clicked station's name in the header.
    - ``${feature.station_id} — ${feature.river}`` — combines multiple feature attributes.
    - ``Selected feature`` — a plain static title.

If the active feature lacks an attribute referenced in the template, that placeholder resolves to an empty string.


Editing the popup layout
========================

The visualizations inside the modal are configured in a sub-dashboard editor reached from the Custom Modal Popup tab:

1. With **Enable Custom Popup Modal** checked, click **Edit popup layout**.
2. A sub-editor opens with the same grid system used on the main dashboard.
3. Add and arrange visualizations exactly as you would on a regular dashboard — add an item, choose a visualization type, configure its arguments, drag/resize tiles into the layout you want.
4. Wire each visualization's arguments to the clicked feature using ``${feature.<attribute_name>}`` (see the next section).
5. Click **Save** to persist the popup layout back onto the map layer. Click **Cancel** to discard changes made in the sub-editor.

.. note::
    The popup layout editor has its own save/cancel boundary. Saving the popup layout does not save the host dashboard — you still need to save the dashboard when you're done editing the map layer.


The ``feature`` namespace
=========================

Inside the popup layout editor, you can reference attributes of the clicked feature using template syntax under the reserved ``feature`` namespace:

.. code-block:: text

    ${feature.<attribute_name>}

The ``feature.*`` namespace is **separate** from the dashboard's regular variable inputs. A dashboard variable input named ``state_id`` and a feature attribute named ``state_id`` coexist as ``${state_id}`` (host variable input) and ``${feature.state_id}`` (modal-scoped) — there is no name collision.

Examples:

    - Time-series chart whose ``site_id`` argument is ``${feature.usgs_site_no}``.
    - Image visualization whose URL is ``https://example.com/photos/${feature.site_id}.jpg``.
    - Text visualization whose body is ``Drainage area: ${feature.drainage_area_sq_km} km²``.

Attribute keys are passed through unchanged. Names that contain spaces or punctuation (for example ``${feature.Site Name}`` or ``${feature.Population (2020)}``) are valid template references.

.. note::
    If an inner visualization references ``${feature.X}`` and the active feature does not have attribute ``X``, the substitution resolves to an empty string. The visualization is responsible for its own empty/error rendering (the modal does not insert a placeholder).


Runtime behavior
================

When a user clicks a feature on a layer that has the custom popup modal enabled:

    - The custom modal opens at the editor's configured position and size.
    - The modal header displays the interpolated title and a close button (**×**).
    - The visualizations inside the modal load with ``feature.*`` resolved to the clicked feature's attributes.
    - The default attribute table popup also appears anchored to the click point **iff** the layer's Table Popup Type is **Click**. With Table Popup Type set to **None** or **Hover**, the table overlay does not open on the click (the click only opens the modal). See :ref:`attributes_and_popups_tab` for the full matrix.

The underlying map remains pannable, zoomable, and clickable while the modal is open. Clicking a different feature replaces the active feature in the existing modal — a second modal is not stacked. Clicking on empty space on the map does not close or change the modal.

The modal can be closed with the **×** button in its header or by pressing **Esc**. Clicking outside the modal does not close it.


Multi-feature carousel
======================

If a click hits multiple queryable features at once (for example, overlapping points or a polygon click that intersects several features), the modal opens with a feature carousel:

    - Prev/next arrows appear in the modal's header.
    - A counter shows the current position, for example ``Feature 2 of 7``.
    - Visualizations load only for the **currently active feature**. Switching to a different feature with the arrows triggers that feature's visualizations to load.

Switching the active feature clears the previous feature's ``feature.*`` values, sets the new feature's, and re-fetches the inner visualizations. The modal stays open across switches.


No visualizations configured
============================

If **Enable Custom Popup Modal** is checked but no visualizations have been added to the popup layout, the modal still opens on click and displays the message *"No visualizations have been configured for this popup."* The default attribute table popup behaves according to its Table Popup Type setting (Click/Hover/None) — independently of the modal.

To stop the empty modal from appearing, either add at least one visualization to the popup layout, or uncheck **Enable Custom Popup Modal**.

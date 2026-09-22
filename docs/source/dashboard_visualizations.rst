.. _dashboard_visualizations:

.. |search_visualizations_button| image:: ../images/search_visualizations_button.png
   :scale: 10%

Configuring Visualizations
==========================

Each dashboard item is a visualization that can be configured and customized. To edit a visualization, open the item's context menu and select "Edit." A popup appears with configuration options on the left and a live preview on the right.

.. image:: ../images/dashboard_edit_visualization.png
   :align: center
   :width: 800px

Visualization Tab
-----------------

- Select the type of visualization from a dropdown or use the search (|search_visualizations_button|) button.
- Hover over visualization cards to see descriptions, tags, and types.
- Type in dropdowns to filter options or add new ones.

.. image:: ../images/dropdown_search.png
   :align: center

After selecting a visualization type, additional arguments may appear, specific to that visualization. For example, a chart may require you to select a location.

Most visualizations are custom, based on installed plugins. For more information, see the :doc:`../plugins` section.

Default Visualization Types
---------------------------

- **Map**: Add a map with configurable basemaps, layers, extent, and drawing tools.
- **Custom Image**: Display a publicly accessible image.
- **Text**: Display formatted text.
- **Variable Input**: Create a variable for use in other visualizations. See :doc:`../variable_inputs` for details.
- **Live Chat**: Display a chat box for users to communicate in real time. Websocket must be configured for this visualization to work. See :doc:`../installation` for details.

.. _settings_tab:

Settings Tab
------------

- **Refresh Rate (Minutes)**: How often the visualization updates automatically (0 = no auto-refresh).
- **Border**: Style all or individual borders.
- **Background Color**: Set the background color and opacity.
- **Box Shadow**: Add a box shadow using border colors.
- **Show Attribution**: Display an attribution icon if available.
- **Fill Viewport**: The item fills the screen below the navigation bar when the dashboard is viewed, on any screen size. See `Fill Viewport`_ below.
- **Enforce Aspect Ratio**: For image visualizations only — keep the image's natural aspect ratio instead of stretching it to the item. Disabled while **Fill Viewport** is set.
- **Custom Messaging**: Set custom error or empty-value messages.

.. tip::
   Settings may vary by visualization type. See the visualization's options for details.

Fill Viewport
-------------

**Fill Viewport** turns one dashboard item into a full-screen panel: rather than occupying its grid cell, it fills the browser area below the navigation bar at whatever size the screen happens to be. It is the setting to use for a dashboard whose point is a single map or plot, with the remaining items layered over it.

- Stacking follows item order. Items placed in front of the filling item stay visible on top of it; reorder from the item's context menu where available.
- The setting applies while editing as well as while viewing, so the result is visible as it is configured — and the item holds its final size for the automatic thumbnail capture.
- Only one item fills the viewport. If more than one item on a tab has the setting, the first in item order wins and the others fall back to their grid cells. While editing, every item that requested the setting carries a **Fill Viewport** badge, and the ones that lost out are marked *inactive — another item fills*.
- The setting applies on the dashboard surface itself, not to items inside a map's popup layout.

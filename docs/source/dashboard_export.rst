.. _dashboard_export:

Exporting a Dashboard as an Image
=================================

Anyone who can view a dashboard can save it as a PNG image, including visitors to a public dashboard who are not signed in. Use it to drop a dashboard into a slide, an email, a report or a chat.

Click the camera button in the dashboard header and pick one of these:

- **Download whole tab**: the full active tab, top to bottom, including dashboard items scrolled out of view.
- **Download visible area**: only the part of the active tab currently on screen.
- **Copy whole tab** / **Copy visible area**: the same images, copied to the clipboard instead of downloaded. They appear only when the browser can copy images, which requires the dashboard to be served over HTTPS.

Downloaded files are named after the dashboard and the date and time of the export, for example ``River Forecast_2026-10-16_1432.png``.

What the image shows
--------------------

The export captures the dashboard exactly as it is when you click. Maps keep their current pan and zoom, hidden subplots stay hidden and toggled layers stay as you left them. Wait for dashboard items to finish loading before exporting; an item still loading appears in the image with its loading spinner.

Interactive controls are left out of the image: dashboard item menus and borders shown while editing, map buttons, loading spinners and the Plotly toolbar. Legends stay in, and so does a clicked feature's attribute table, without its close button. Scrollbars are hidden. The image is rendered at twice screen density so it stays sharp in slides. A very tall tab is scaled down if it would exceed the browser's image size limit, and the export says so.

Every open map popup modal is included in both modes, drawn where it sits on screen. With **Download whole tab**, it is placed against the part of the tab currently in view. Close a popup first to leave it out.

With **Download visible area**, only images and map layers on screen are fetched, so content scrolled out of view never triggers a warning.

When an item on the tab is set to fill the viewport, **Download whole tab** captures the same area as **Download visible area**, since the tab is then the size of the screen.

Images and maps from other servers
----------------------------------

Images and map layers from other servers are fetched through TethysDash so they can be included, even when that server does not allow other sites to read its content. This covers ArcGIS image, WMS and static image map layers.

If something that displays on screen still cannot be included, the export completes and a message names the dashboard item it affects, for example ``Map (a map layer)``. Common causes are a server that refused the request, an image too large to fetch, or a map point symbol loaded from another server. The number of images anyone can fetch per minute is limited, and the limit is lower for visitors who are not signed in. Several exports in quick succession may therefore leave content out; wait a minute and export again.

See also :ref:`landing_page` for the dashboard thumbnails shown on the landing page, which are captured the same way.

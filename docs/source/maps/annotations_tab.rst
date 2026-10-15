.. _annotations_tab:

-------------------------------------
Annotations and Linked Extents Layers
-------------------------------------

Two layer types hold content you place yourself rather than data read from a source. Both are added from the layer editor like any other layer, and both appear in the map's layer control so viewers can turn them on and off.

- An **Annotations** layer holds lines, arrows and text that you draw on the map.
- A **Linked Extents** layer outlines where other maps on the dashboard are looking. It turns a zoomed-out map into an inset for a zoomed-in one.

Neither layer type opens popups, takes part in map click or hover queries, or snaps the cursor. Their layer editors therefore leave out the Style, Labels, Legend and popup tabs. The **Layer** tab omits the query, snapping and image-rendering properties, and keeps opacity and the zoom and resolution limits.


.. _annotations_layer:

++++++++++++++++++
Annotations Layers
++++++++++++++++++

An Annotations layer is a set of lines, arrows and text pinned to places on the map. They stay where you drew them as viewers pan and zoom. Lines, arrowheads and text keep the same size on screen at every zoom level, while the distance a line covers stays the same on the ground.

To make several sets that viewers can show and hide separately, such as one for gauge callouts and one for basin notes, add one Annotations layer per set.

**Drawing.** Choose **Annotations** as the layer's source type, open the **Annotations** tab, and click **Edit on map**. The editor steps aside to show only the map, with a toolbar over it; the visualization settings and its Save and Close buttons come back when you finish:

- **Select** — click an annotation to select it. Drag it to move it, or drag one of its points to reshape it. Alt+click a point to remove it, and double-click text to edit it. Selected text shows a round handle; drag it around the text to rotate it, holding Shift to snap to 15° steps. A side panel opens on the right of the map for the selection: see *Default styles and overrides* below. **Delete** (or the Delete key) removes the selection.
- **Line** and **Arrow** — click to add points, then double-click or press Enter to finish. Escape abandons the line being drawn. An arrow's head goes on its last point.
- **Text** — click the map to place text, or click existing text to edit it. Enter saves, Shift+Enter starts a new line, and Escape reverts.

Dragging anywhere that is not an annotation pans the map in every tool, and the mouse wheel zooms. Click **Save** to keep your changes, or **Cancel** to discard them. Either returns you to the layer editor; nothing is saved to the dashboard until you save the layer and then the visualization.

Annotations can only be edited this way, from the layer editor while the dashboard is being edited. Clicking an annotation on the dashboard itself does nothing.

**Default styles and overrides.** The Annotations tab sets the styles every annotation in the layer starts from, in two collapsible sections. **Line/Arrow Default Styles** holds the line color and width and the arrowheads; **Text Default Styles** holds the text color, size, outline color, placement and rotation. Rotation is in degrees clockwise, may be zero or negative, and stays relative to the map.

One annotation can override any of those properties for itself. Select it on the map with **Edit on map**, and the side panel lists the properties that apply to it, plus its text for a text annotation. An overridden property shows **Reset to default**; every other property shows **Layer default** and keeps following the default when it changes. A text field left blank in the panel returns to its previous text: delete the annotation to remove it. Overrides, like everything else edited on the map, are kept by **Save** and discarded by **Cancel**.

Arrowheads belong to arrows: a plain line never draws them, whatever the default says. Setting an arrow's own arrowheads to **None** turns it into a line.

**Text placement.** Text is drawn beside the point you clicked, on the side its placement names, so a callout can sit next to the end of an arrow. Text never hides behind other text; overlapping annotations are separated only by the outline drawn around each one.

**Variable inputs in text.** Text may include a variable input with the usual ``${Variable Name}`` syntax and updates when the variable changes. A variable with no value draws as empty text rather than holding back the map. Each change of such a variable rebuilds the map's other vector layers, so prefer fixed text on maps with large GeoJSON layers.

An Annotations layer can be saved with no annotations; the tab says so. The tab does not list the layer's annotations: select them on the map instead.


.. _linked_extents_layer:

+++++++++++++++++++++
Linked Extents Layers
+++++++++++++++++++++

A Linked Extents layer draws the current view of every other map in its map's linked extent group as an outline, updated live as those maps pan and zoom. See :ref:`linked_extent_groups` for how maps join a group.

The **Outline** tab sets the outline color, the outline width, and an optional fill color. All of the layer's outlines share this style. When the map is in no linked extent group, the tab says so: the layer then draws nothing.

What gets outlined:

- Every other member of the group whose map is on the tab being viewed. A map on a hidden tab, or one that has not loaded yet, is not outlined until it is shown.
- Never the map that carries the layer, and never a member that also shares its **View Group**. Those maps always show the same view, so the outline would only trace the map's own edges.
- An outline follows the other map's true footprint. Between maps in different projections it may draw as a slightly skewed shape rather than a rectangle.

Outlines are for display only: dragging or clicking one does not move the map it stands for. While you edit a map in the visualization editor, its preview shows the outlines of the dashboard's other group members, so you can see the result before saving.

Linked Extents layers are not offered for maps inside a popup layout, which never join a group.

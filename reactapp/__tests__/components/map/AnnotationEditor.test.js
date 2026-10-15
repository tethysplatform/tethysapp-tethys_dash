import { useEffect, useRef } from "react";
import PropTypes from "prop-types";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { Map, MapBrowserEvent, View } from "ol";
import VectorLayer from "ol/layer/Vector.js";
import VectorSource from "ol/source/Vector.js";
import Draw from "ol/interaction/Draw.js";
import Select from "ol/interaction/Select.js";
import DoubleClickZoom from "ol/interaction/DoubleClickZoom.js";
import { transform } from "ol/proj.js";
import MapContextProvider, {
  useMapContext,
} from "components/contexts/MapContext";
import AnnotationEditor from "components/map/AnnotationEditor";
import { rotateHandleCoordinate } from "components/map/textRotateInteraction";

// ol/Map observes its target's size; jsdom has no ResizeObserver.
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
afterAll(() => {
  delete global.ResizeObserver;
});

const line = {
  id: "a1",
  kind: "line",
  coordinates: [
    [-123.1, 44.05],
    [-123.0, 44.1],
  ],
};
const text = {
  id: "a2",
  kind: "text",
  coordinates: [-123.05, 44.0],
  text: "Old",
};

let olMap;
let target;
let context;
let editorLayer;
const realSetMap = VectorLayer.prototype.setMap;

// Mirrors map/Map.js: the editor mounts only while a session is open.
const Host = ({ session, mapRef }) => {
  context = useMapContext();
  const ownRef = useRef(olMap);
  const ref = mapRef ?? ownRef;
  const started = useRef(false);
  useEffect(() => {
    if (!started.current && session) {
      started.current = true;
      context.setAnnotationEditSession(session);
    }
  });
  return context.annotationEditSession ? (
    <AnnotationEditor visualizationRef={ref} />
  ) : null;
};
Host.propTypes = { session: PropTypes.object, mapRef: PropTypes.object };

const mount = (session, mapRef) =>
  render(
    <MapContextProvider>
      <Host session={session} mapRef={mapRef} />
    </MapContextProvider>,
  );

const session = (overrides = {}) => ({
  layerName: "Callouts",
  defaults: {},
  items: [],
  ...overrides,
});

const interaction = (Type) =>
  olMap
    .getInteractions()
    .getArray()
    .find((i) => i instanceof Type);

const workingFeatures = () => editorLayer.getSource().getFeatures();

const save = () =>
  fireEvent.click(screen.getByRole("button", { name: "Save" }));

beforeEach(() => {
  target = document.createElement("div");
  document.body.appendChild(target);
  olMap = new Map({
    target,
    view: new View({ center: [0, 0], resolution: 1000 }),
  });
  olMap.setSize([400, 300]);
  editorLayer = null;
  // Capture the editor's unmanaged working layer.
  jest.spyOn(VectorLayer.prototype, "setMap").mockImplementation(function (m) {
    if (m && this.getClassName() === "ol-layer annotation-editor") {
      editorLayer = this;
    }
    return realSetMap.call(this, m);
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  olMap.setTarget(null);
  target.remove();
});

test("opens on Arrow for an empty layer and on Select when it has items", () => {
  const { unmount } = mount(session());
  expect(screen.getByRole("button", { name: "Arrow" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  unmount();

  mount(session({ items: [line] }));
  expect(screen.getByRole("button", { name: "Select" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByText(/Editing annotations: Callouts/)).toBeInTheDocument();
});

test("loads the items onto an unmanaged working layer", () => {
  mount(session({ items: [line, text] }));

  expect(workingFeatures()).toHaveLength(2);
  // Outside the map's layer collection.
  expect(olMap.getLayers().getArray()).not.toContain(editorLayer);
});

test("hides the saved layer for the session, including a rebuild of it", () => {
  const saved = new VectorLayer({ source: new VectorSource() });
  saved.set("name", "Callouts");
  olMap.addLayer(saved);
  mount(session({ items: [line] }));

  expect(saved.getVisible()).toBe(false);
  const rebuilt = new VectorLayer({ source: new VectorSource() });
  rebuilt.set("name", "Callouts");
  act(() => olMap.addLayer(rebuilt));
  expect(rebuilt.getVisible()).toBe(false);

  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(saved.getVisible()).toBe(true);
  expect(rebuilt.getVisible()).toBe(true);
});

test("the Arrow tool draws a line that follows the layer's arrowheads", () => {
  mount(session());

  act(() => {
    const draw = interaction(Draw);
    draw.appendCoordinates([
      [0, 0],
      [10000, 0],
      [20000, 10000],
    ]);
    draw.finishDrawing();
  });
  save();

  const [item] = context.editedAnnotations;
  expect(item).toMatchObject({ id: "a1", kind: "line" });
  expect(item).not.toHaveProperty("style");
  expect(item.coordinates).toHaveLength(3);
  expect(context.annotationEditSession).toBeNull();
});

test("the Line tool pins its line to no arrowheads", () => {
  mount(session());
  fireEvent.click(screen.getByRole("button", { name: "Line" }));

  act(() => {
    const draw = interaction(Draw);
    draw.appendCoordinates([
      [0, 0],
      [10000, 0],
    ]);
    draw.finishDrawing();
  });
  save();

  expect(context.editedAnnotations[0].style).toEqual({ arrowheads: "none" });
});

test("Escape abandons only the line being drawn", () => {
  mount(session({ items: [line] }));
  fireEvent.click(screen.getByRole("button", { name: "Arrow" }));

  act(() => {
    interaction(Draw).appendCoordinates([
      [0, 0],
      [10000, 0],
    ]);
  });
  fireEvent.keyDown(document, { key: "Escape" });
  save();

  expect(context.editedAnnotations).toEqual([line]);
});

test("Save finishes a line in progress that has two points", () => {
  mount(session());

  act(() => {
    interaction(Draw).appendCoordinates([
      [0, 0],
      [10000, 0],
      [10000, 0],
    ]);
  });
  save();

  expect(context.editedAnnotations).toHaveLength(1);
});

test("a one-point line is dropped", () => {
  mount(session());

  act(() => {
    interaction(Draw).appendCoordinates([[0, 0]]);
  });
  save();

  expect(context.editedAnnotations).toEqual([]);
});

test("double-click zoom is off while drawing and back on after", () => {
  mount(session());
  expect(interaction(DoubleClickZoom).getActive()).toBe(false);

  fireEvent.click(screen.getByRole("button", { name: "Select" }));
  expect(interaction(DoubleClickZoom).getActive()).toBe(true);
});

const singleClick = (coordinate) =>
  act(() => {
    olMap.dispatchEvent({
      type: "singleclick",
      coordinate,
      pixel: [200, 150],
      originalEvent: {},
    });
  });

test("the Text tool places text where clicked and Enter commits it", () => {
  mount(session());
  fireEvent.click(screen.getByRole("button", { name: "Text" }));

  singleClick([5000, 5000]);
  const box = screen.getByLabelText("Annotation text");
  expect(box).toHaveFocus();
  fireEvent.change(box, { target: { value: "Gauge 1" } });
  fireEvent.keyDown(box, { key: "Enter" });
  expect(screen.queryByLabelText("Annotation text")).not.toBeInTheDocument();
  save();

  const [item] = context.editedAnnotations;
  expect(item).toMatchObject({ kind: "text", text: "Gauge 1" });
  const [x, y] = transform(item.coordinates, "EPSG:4326", "EPSG:3857");
  expect(x).toBeCloseTo(5000, 0);
  expect(y).toBeCloseTo(5000, 0);
});

test("Shift+Enter adds a line break instead of committing", () => {
  mount(session());
  fireEvent.click(screen.getByRole("button", { name: "Text" }));

  singleClick([0, 0]);
  const box = screen.getByLabelText("Annotation text");
  fireEvent.keyDown(box, { key: "Enter", shiftKey: true });

  expect(screen.getByLabelText("Annotation text")).toBeInTheDocument();
});

test("committing empty text removes the new item", () => {
  mount(session());
  fireEvent.click(screen.getByRole("button", { name: "Text" }));

  singleClick([0, 0]);
  fireEvent.keyDown(screen.getByLabelText("Annotation text"), {
    key: "Enter",
  });
  save();

  expect(context.editedAnnotations).toEqual([]);
});

test("clicking existing text in Text mode edits it, and Escape reverts", () => {
  mount(session({ items: [text] }));
  fireEvent.click(screen.getByRole("button", { name: "Text" }));
  const [existing] = workingFeatures();
  hitReturns(existing);

  singleClick([0, 0]);
  const box = screen.getByLabelText("Annotation text");
  expect(box).toHaveValue("Old");
  fireEvent.change(box, { target: { value: "New" } });
  fireEvent.keyDown(box, { key: "Escape" });
  save();

  // No second item, and the text is back to what it was.
  expect(context.editedAnnotations).toEqual([text]);
});

test("a click that closes the text box does not start another one", () => {
  mount(session());
  fireEvent.click(screen.getByRole("button", { name: "Text" }));

  singleClick([0, 0]);
  const box = screen.getByLabelText("Annotation text");
  fireEvent.change(box, { target: { value: "One" } });
  fireEvent.blur(box);
  singleClick([9000, 9000]);
  save();

  expect(context.editedAnnotations.map((i) => i.text)).toEqual(["One"]);
});

test("Delete removes the selected annotation", () => {
  mount(session({ items: [line, text] }));
  const select = interaction(Select);
  const [first] = workingFeatures();

  act(() => {
    select.getFeatures().push(first);
    select.dispatchEvent({ type: "select", selected: [first], deselected: [] });
  });
  expect(
    screen.getByRole("button", { name: "Delete selected annotation" }),
  ).toBeEnabled();
  fireEvent.keyDown(document, { key: "Delete" });
  save();

  expect(context.editedAnnotations).toEqual([text]);
});

test("Delete is disabled with nothing selected", () => {
  mount(session({ items: [line] }));

  expect(
    screen.getByRole("button", { name: "Delete selected annotation" }),
  ).toBeDisabled();
});

test("item order survives a session, past the spatial index's bulk-load size", () => {
  const items = Array.from({ length: 12 }, (_, i) => ({
    id: `a${i + 1}`,
    kind: "text",
    // Spread so a spatial index would order them differently.
    coordinates: [-123 + ((11 - i) % 4) * 0.1, 44 + (i % 3) * 0.1],
    text: `T${i + 1}`,
  }));
  mount(session({ items }));

  // Move the first one, the way Translate would.
  act(() => {
    const [first] = workingFeatures();
    const [x, y] = first.getGeometry().getCoordinates();
    first.getGeometry().setCoordinates([x + 50000, y]);
  });
  save();

  expect(context.editedAnnotations.map((i) => i.id)).toEqual(
    items.map((i) => i.id),
  );
});

test("the saved layer stays hidden when the layer control re-shows it", () => {
  const saved = new VectorLayer({ source: new VectorSource() });
  saved.set("name", "Callouts");
  olMap.addLayer(saved);
  mount(session({ items: [line] }));

  // What LayersControl does when it re-syncs its stored visibility.
  act(() => saved.setVisible(true));
  expect(saved.getVisible()).toBe(false);

  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(saved.getVisible()).toBe(true);
  // And the guard is gone once the session ends.
  act(() => saved.setVisible(false));
  act(() => saved.setVisible(true));
  expect(saved.getVisible()).toBe(true);
});

test("untouched items are handed back exactly as stored", () => {
  const stored = { ...line, style: { lineColor: "#ff0000" } };
  mount(session({ items: [stored, text] }));
  save();

  expect(context.editedAnnotations).toEqual([stored, text]);
});

test("a view replacement keeps the session and the items over the same ground", () => {
  mount(session({ items: [line] }));
  fireEvent.click(screen.getByRole("button", { name: "Arrow" }));

  act(() => {
    olMap.setView(
      new View({
        projection: "EPSG:4326",
        center: [-123, 44],
        resolution: 0.01,
      }),
    );
  });
  // Still open, and drawing now happens in the new projection.
  expect(screen.getByRole("toolbar")).toBeInTheDocument();
  act(() => {
    const draw = interaction(Draw);
    draw.appendCoordinates([
      [-122, 45],
      [-121, 45],
    ]);
    draw.finishDrawing();
  });
  save();

  const [kept, drawn] = context.editedAnnotations;
  expect(kept).toEqual(line);
  expect(drawn.coordinates[0][0]).toBeCloseTo(-122, 6);
  expect(drawn.coordinates[0][1]).toBeCloseTo(45, 6);
});

test("Cancel hands nothing back", () => {
  mount(session({ items: [line] }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

  expect(context.editedAnnotations).toBeNull();
  expect(context.annotationEditSession).toBeNull();
  expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
});

test("a drag that starts away from every annotation pans the map", () => {
  const map = olMap;
  // jsdom reports a zero-size viewport, which OpenLayers divides by.
  map.getViewport().getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: 400,
    height: 300,
  });
  // Pointer events need a frame state. Rendered before the editor mounts:
  // jsdom's canvas stub cannot draw the editor's vector layer.
  map.renderSync();
  mount(session({ items: [line] }));
  const pointer = (type, x, y) => {
    const originalEvent = {
      type,
      pointerId: 1,
      isPrimary: true,
      button: 0,
      clientX: x,
      clientY: y,
      preventDefault: () => {},
      target: map.getViewport(),
    };
    return {
      type,
      map: map,
      pixel: [x, y],
      coordinate: map.getCoordinateFromPixel([x, y]),
      dragging: type === "pointerdrag",
      originalEvent,
      activePointers: type === "pointerup" ? [] : [originalEvent],
    };
  };

  for (const tool of ["Select", "Line", "Arrow", "Text"]) {
    fireEvent.click(screen.getByRole("button", { name: tool }));
    const before = map.getView().getCenter().slice();
    act(() => {
      // Far from the line, which sits near the view center.
      map.handleMapBrowserEvent(pointer("pointerdown", 20, 20));
      map.handleMapBrowserEvent(pointer("pointerdrag", 40, 30));
      map.handleMapBrowserEvent(pointer("pointerdrag", 60, 40));
      map.handleMapBrowserEvent(pointer("pointerup", 60, 40));
    });
    expect(map.getView().getCenter()).not.toEqual(before);
  }
});

// Selects (or, with no feature, deselects) the way a click on the map would.
const selectFeature = (feature) =>
  act(() => {
    const select = interaction(Select);
    select.getFeatures().clear();
    if (feature) select.getFeatures().push(feature);
    select.dispatchEvent({
      type: "select",
      selected: feature ? [feature] : [],
      deselected: [],
    });
  });

const deleteButton = () =>
  screen.getByRole("button", { name: "Delete selected annotation" });

const featureById = (id) =>
  workingFeatures().find((f) => f.get("annotationId") === id);

// The handle style the working layer adds to the selected feature, if any.
const handlesFor = (feature) => {
  const styles = editorLayer.getStyleFunction()(feature, 1000);
  return styles.filter((s) => s.getImage()?.getRadius?.() === 5);
};

// Map browser events need a frame state and a viewport size. Rendered before
// the editor mounts: jsdom's canvas stub cannot draw the editor's layer.
const prepareForPointerEvents = () => {
  olMap.getViewport().getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: 400,
    height: 300,
  });
  olMap.renderSync();
};

const dblClick = () => {
  const event = new MapBrowserEvent("dblclick", olMap, {
    type: "dblclick",
    clientX: 200,
    clientY: 150,
    preventDefault: () => {},
    target: olMap.getViewport(),
  });
  act(() => olMap.handleMapBrowserEvent(event));
  return event;
};

// Stands in for a hit test (jsdom cannot render the layer to hit-test it),
// checking on the way that only the working layer is ever queried.
const hitReturns = (feature) =>
  jest
    .spyOn(olMap, "forEachFeatureAtPixel")
    .mockImplementation((pixel, callback, options) => {
      expect(options.layerFilter(editorLayer)).toBe(true);
      expect(
        options.layerFilter(new VectorLayer({ source: new VectorSource() })),
      ).toBe(false);
      return feature ? callback(feature) : undefined;
    });

test("renders nothing and installs nothing without a session", () => {
  const before = olMap.getInteractions().getLength();
  const { container } = render(
    <MapContextProvider>
      <AnnotationEditor visualizationRef={{ current: olMap }} />
    </MapContextProvider>,
  );

  expect(container).toBeEmptyDOMElement();
  expect(editorLayer).toBeNull();
  expect(olMap.getOverlays().getLength()).toBe(0);
  expect(olMap.getInteractions().getLength()).toBe(before);
});

test("without a map the toolbar is inert and Save hands the items back", () => {
  const mapRef = { current: null };
  mount(session({ items: [line] }), mapRef);

  expect(screen.getByRole("toolbar")).toBeInTheDocument();
  expect(editorLayer).toBeNull();
  // Neither tool has an interaction to act on.
  fireEvent.keyDown(document, { key: "Escape" });
  fireEvent.click(screen.getByRole("button", { name: "Arrow" }));
  fireEvent.keyDown(document, { key: "Enter" });
  fireEvent.keyDown(document, { key: "Escape" });

  // A map arriving later still has no working copy to draw into.
  mapRef.current = olMap;
  fireEvent.click(screen.getByRole("button", { name: "Line" }));
  expect(interaction(Draw)).toBeUndefined();

  save();
  expect(context.editedAnnotations).toEqual([line]);
  expect(context.annotationEditSession).toBeNull();
});

test("only the named, visible layer is hidden", () => {
  const other = new VectorLayer({ source: new VectorSource() });
  other.set("name", "Other");
  const alreadyHidden = new VectorLayer({
    source: new VectorSource(),
    visible: false,
  });
  alreadyHidden.set("name", "Callouts");
  olMap.addLayer(other);
  olMap.addLayer(alreadyHidden);
  mount(session({ items: [line] }));

  expect(other.getVisible()).toBe(true);
  expect(alreadyHidden.getVisible()).toBe(false);

  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  // A layer the user had hidden is not re-shown when the session ends.
  expect(alreadyHidden.getVisible()).toBe(false);
  expect(other.getVisible()).toBe(true);
});

test("a layer not saved yet hides nothing and has no name in the title", () => {
  const unnamed = new VectorLayer({ source: new VectorSource() });
  olMap.addLayer(unnamed);
  mount(session({ layerName: null, items: [line] }));

  expect(unnamed.getVisible()).toBe(true);
  expect(screen.getByText("Editing annotations")).toBeInTheDocument();
});

test("a view change in the same projection leaves the items where they are", () => {
  mount(session({ items: [line] }));
  const [feature] = workingFeatures();
  const before = feature.getGeometry().getCoordinates();
  const revision = feature.getGeometry().getRevision();

  act(() => {
    olMap.setView(new View({ center: [1000, 1000], resolution: 500 }));
  });

  expect(feature.getGeometry().getCoordinates()).toEqual(before);
  expect(feature.getGeometry().getRevision()).toBe(revision);
  save();
  expect(context.editedAnnotations).toEqual([line]);
});

test("the selected line and the selected text show a handle on each point", () => {
  mount(session({ items: [line, text] }));
  const lineFeature = featureById("a1");
  const textFeature = featureById("a2");
  expect(handlesFor(lineFeature)).toHaveLength(0);

  selectFeature(lineFeature);
  const [lineHandles] = handlesFor(lineFeature);
  expect(
    lineHandles.getGeometryFunction()(lineFeature).getCoordinates(),
  ).toEqual(lineFeature.getGeometry().getCoordinates());
  expect(handlesFor(textFeature)).toHaveLength(0);

  selectFeature(textFeature);
  expect(handlesFor(lineFeature)).toHaveLength(0);
  const [textHandles] = handlesFor(textFeature);
  expect(
    textHandles.getGeometryFunction()(textFeature).getCoordinates(),
  ).toEqual([textFeature.getGeometry().getCoordinates()]);
});

test("clicking away from every annotation clears the selection", () => {
  mount(session({ items: [line] }));
  selectFeature(featureById("a1"));
  expect(deleteButton()).toBeEnabled();

  selectFeature(null);
  expect(deleteButton()).toBeDisabled();
  expect(handlesFor(featureById("a1"))).toHaveLength(0);
});

test("Escape in Select mode clears the selection without deleting", () => {
  mount(session({ items: [line] }));
  selectFeature(featureById("a1"));

  fireEvent.keyDown(document, { key: "Escape" });

  expect(deleteButton()).toBeDisabled();
  expect(interaction(Select).getFeatures().getLength()).toBe(0);
  // Delete now has nothing to act on.
  fireEvent.keyDown(document, { key: "Delete" });
  save();
  expect(context.editedAnnotations).toEqual([line]);
});

test("Backspace deletes the selection, and the Delete button does too", () => {
  mount(session({ items: [line, text] }));
  selectFeature(featureById("a1"));
  const backspace = fireEvent.keyDown(document, { key: "Backspace" });
  // Handled: the browser does not also navigate back.
  expect(backspace).toBe(false);
  expect(featureById("a1")).toBeUndefined();

  selectFeature(featureById("a2"));
  fireEvent.click(deleteButton());
  expect(workingFeatures()).toHaveLength(0);
  expect(deleteButton()).toBeDisabled();
});

test("keys pressed while typing in an input are left alone", () => {
  mount(session({ items: [line] }));
  selectFeature(featureById("a1"));
  const input = document.createElement("input");
  document.body.appendChild(input);
  input.focus();

  fireEvent.keyDown(input, { key: "Backspace" });
  fireEvent.keyDown(input, { key: "Escape" });

  expect(featureById("a1")).toBeDefined();
  expect(deleteButton()).toBeEnabled();
  input.remove();
});

test("keys that mean nothing to the current tool do nothing", () => {
  mount(session({ items: [line] }));
  selectFeature(featureById("a1"));
  fireEvent.keyDown(document, { key: "a" });
  expect(deleteButton()).toBeEnabled();

  fireEvent.click(screen.getByRole("button", { name: "Text" }));
  fireEvent.keyDown(document, { key: "Delete" });
  fireEvent.keyDown(document, { key: "Escape" });

  fireEvent.click(screen.getByRole("button", { name: "Line" }));
  act(() => {
    interaction(Draw).appendCoordinates([
      [0, 0],
      [10000, 0],
    ]);
  });
  fireEvent.keyDown(document, { key: "a" });
  // Still drawing: the sketch was neither finished nor abandoned.
  expect(workingFeatures()).toHaveLength(1);
  fireEvent.keyDown(document, { key: "Enter" });
  expect(workingFeatures()).toHaveLength(2);
});

test("Enter finishing a one-point line drops it once Draw has added it", async () => {
  mount(session());
  act(() => {
    interaction(Draw).appendCoordinates([[0, 0]]);
  });
  fireEvent.keyDown(document, { key: "Enter" });
  expect(workingFeatures()).toHaveLength(1);

  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
  expect(workingFeatures()).toHaveLength(0);
});

test("switching to a drawing tool or Text clears the selection", () => {
  mount(session({ items: [line] }));
  for (const tool of ["Line", "Text"]) {
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    selectFeature(featureById("a1"));
    expect(handlesFor(featureById("a1"))).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: tool }));
    expect(handlesFor(featureById("a1"))).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    expect(deleteButton()).toBeDisabled();
    expect(interaction(Select).getFeatures().getLength()).toBe(0);
  }
});

test("double-clicking text in Select mode edits it instead of zooming", () => {
  prepareForPointerEvents();
  mount(session({ items: [line, text] }));
  hitReturns(featureById("a2"));

  const event = dblClick();

  expect(event.defaultPrevented).toBe(true);
  expect(olMap.getView().getAnimating()).toBe(false);
  const box = screen.getByLabelText("Annotation text");
  expect(box).toHaveValue("Old");
  fireEvent.change(box, { target: { value: "New" } });
  fireEvent.keyDown(box, { key: "Enter" });
  save();
  expect(context.editedAnnotations[1]).toEqual({ ...text, text: "New" });
});

test("double-clicking a line or empty map in Select mode still zooms", () => {
  prepareForPointerEvents();
  mount(session({ items: [line, text] }));
  const hit = hitReturns(featureById("a1"));

  let event = dblClick();
  expect(event.defaultPrevented).toBeFalsy();
  expect(olMap.getView().getAnimating()).toBe(true);
  expect(screen.queryByLabelText("Annotation text")).not.toBeInTheDocument();

  act(() => olMap.getView().cancelAnimations());
  hit.mockRestore();
  hitReturns(null);
  event = dblClick();
  expect(event.defaultPrevented).toBeFalsy();
  expect(olMap.getView().getAnimating()).toBe(true);
  expect(screen.queryByLabelText("Annotation text")).not.toBeInTheDocument();
});

test("emptying selected text removes it and its selection", () => {
  prepareForPointerEvents();
  mount(session({ items: [line, text] }));
  selectFeature(featureById("a2"));
  hitReturns(featureById("a2"));
  dblClick();

  const box = screen.getByLabelText("Annotation text");
  fireEvent.change(box, { target: { value: "  " } });
  fireEvent.keyDown(box, { key: "Enter" });

  expect(featureById("a2")).toBeUndefined();
  expect(deleteButton()).toBeDisabled();
  save();
  expect(context.editedAnnotations).toEqual([line]);
});

test("a text box whose item was deleted closes without bringing it back", () => {
  prepareForPointerEvents();
  mount(session({ items: [line, text] }));
  selectFeature(featureById("a2"));
  hitReturns(featureById("a2"));
  dblClick();

  // fireEvent does not move focus, so the box is still open here.
  fireEvent.click(deleteButton());
  fireEvent.keyDown(screen.getByLabelText("Annotation text"), {
    key: "Escape",
  });

  expect(screen.queryByLabelText("Annotation text")).not.toBeInTheDocument();
  save();
  expect(context.editedAnnotations).toEqual([line]);
});

test("switching tool while text is open commits it", () => {
  mount(session());
  fireEvent.click(screen.getByRole("button", { name: "Text" }));
  singleClick([0, 0]);
  fireEvent.change(screen.getByLabelText("Annotation text"), {
    target: { value: "Kept" },
  });

  fireEvent.click(screen.getByRole("button", { name: "Select" }));

  expect(screen.queryByLabelText("Annotation text")).not.toBeInTheDocument();
  save();
  expect(context.editedAnnotations.map((i) => i.text)).toEqual(["Kept"]);
});

test("a map click while text is open commits it rather than placing more", () => {
  mount(session());
  fireEvent.click(screen.getByRole("button", { name: "Text" }));
  singleClick([0, 0]);
  fireEvent.change(screen.getByLabelText("Annotation text"), {
    target: { value: "First" },
  });

  // No blur first: the click is not the one that closed the box.
  singleClick([9000, 9000]);

  expect(screen.queryByLabelText("Annotation text")).not.toBeInTheDocument();
  expect(workingFeatures()).toHaveLength(1);
  save();
  expect(context.editedAnnotations.map((i) => i.text)).toEqual(["First"]);
});

test("a replaced session keeps a selection it still holds", () => {
  mount(session({ items: [line, text] }));
  selectFeature(featureById("a1"));
  const firstLayer = editorLayer;

  act(() => context.setAnnotationEditSession(session({ items: [line, text] })));

  expect(editorLayer).not.toBe(firstLayer);
  const [restored] = interaction(Select).getFeatures().getArray();
  expect(restored).toBe(featureById("a1"));
  expect(deleteButton()).toBeEnabled();
});

test("Delete with a selection the session no longer holds removes nothing", () => {
  mount(session({ items: [line, text] }));
  selectFeature(featureById("a1"));

  act(() => context.setAnnotationEditSession(session({ items: [text] })));
  expect(interaction(Select).getFeatures().getLength()).toBe(0);
  fireEvent.click(deleteButton());

  expect(deleteButton()).toBeDisabled();
  save();
  expect(context.editedAnnotations).toEqual([text]);
});

describe("rotating text with its handle", () => {
  // A pointer event at a map coordinate, the way OpenLayers would deliver it.
  const pointerAt = (type, coordinate, { shiftKey = false } = {}) => {
    const pixel = olMap.getPixelFromCoordinate(coordinate);
    const originalEvent = {
      type,
      pointerId: 1,
      isPrimary: true,
      button: 0,
      shiftKey,
      clientX: pixel[0],
      clientY: pixel[1],
      preventDefault: () => {},
      target: olMap.getViewport(),
    };
    return {
      type,
      map: olMap,
      pixel,
      coordinate,
      dragging: type === "pointerdrag",
      originalEvent,
      activePointers: type === "pointerup" ? [] : [originalEvent],
    };
  };

  it("draws a rotate handle on selected text only", () => {
    mount(session({ items: [line, text] }));
    const rotateHandles = (feature) =>
      editorLayer
        .getStyleFunction()(feature, 1000)
        .filter((s) => s.getImage()?.getRadius?.() === 6);

    selectFeature(featureById("a2"));
    expect(rotateHandles(featureById("a2"))).toHaveLength(1);

    selectFeature(featureById("a1"));
    expect(rotateHandles(featureById("a1"))).toHaveLength(0);
    expect(rotateHandles(featureById("a2"))).toHaveLength(0);
  });

  it("drags the handle to rotate the text, saved as its override", () => {
    prepareForPointerEvents();
    mount(session({ items: [text] }));
    const feature = featureById("a2");
    selectFeature(feature);

    const point = feature.getGeometry().getCoordinates();
    const resolution = olMap.getView().getResolution();
    const handle = rotateHandleCoordinate(point, 0, resolution);
    const east = [point[0] + 40 * resolution, point[1]];

    act(() => {
      olMap.handleMapBrowserEvent(pointerAt("pointerdown", handle));
      olMap.handleMapBrowserEvent(pointerAt("pointerdrag", east));
      olMap.handleMapBrowserEvent(pointerAt("pointerup", east));
    });
    save();

    const [item] = context.editedAnnotations;
    expect(item.style).toEqual({ textRotation: 90 });
    // Rotated, not moved: the stored point is untouched.
    expect(item.coordinates).toEqual(text.coordinates);
  });

  it("snaps to 15 degrees while Shift is held", () => {
    prepareForPointerEvents();
    mount(session({ items: [text] }));
    const feature = featureById("a2");
    selectFeature(feature);

    const point = feature.getGeometry().getCoordinates();
    const resolution = olMap.getView().getResolution();
    const handle = rotateHandleCoordinate(point, 0, resolution);
    const radians = (50 * Math.PI) / 180;
    const fifty = [
      point[0] + 40 * resolution * Math.sin(radians),
      point[1] + 40 * resolution * Math.cos(radians),
    ];

    act(() => {
      olMap.handleMapBrowserEvent(pointerAt("pointerdown", handle));
      olMap.handleMapBrowserEvent(
        pointerAt("pointerdrag", fifty, { shiftKey: true }),
      );
      olMap.handleMapBrowserEvent(pointerAt("pointerup", fifty));
    });
    save();

    expect(context.editedAnnotations[0].style).toEqual({ textRotation: 45 });
  });
});

describe("the selected annotation's side panel", () => {
  const panel = () =>
    screen.queryByRole("region", { name: "Selected annotation" });

  it("shows only while something is selected in Select mode", () => {
    mount(session({ items: [line, text] }));
    expect(panel()).not.toBeInTheDocument();

    selectFeature(featureById("a1"));
    expect(panel()).toBeInTheDocument();
    expect(within(panel()).getByText("Arrow 1")).toBeInTheDocument();

    selectFeature(null);
    expect(panel()).not.toBeInTheDocument();

    selectFeature(featureById("a2"));
    fireEvent.click(screen.getByRole("button", { name: "Arrow" }));
    expect(panel()).not.toBeInTheDocument();
  });

  it("offers a line only its line properties, all following the default", () => {
    mount(session({ defaults: { lineWidth: 3 }, items: [line] }));
    selectFeature(featureById("a1"));

    const width = within(panel()).getByLabelText("Line Width");
    expect(width).toHaveValue("");
    expect(width).toHaveAttribute("placeholder", "3");
    expect(within(panel()).getAllByText("Layer default")).toHaveLength(3);
    expect(
      within(panel()).queryByLabelText("Text Size"),
    ).not.toBeInTheDocument();
    expect(
      within(panel()).queryByLabelText("Selected annotation text"),
    ).not.toBeInTheDocument();
  });

  it("an override redraws the working copy, is kept by Save, and reset removes it (AE1)", () => {
    mount(session({ items: [line, text] }));
    const feature = featureById("a1");
    selectFeature(feature);

    fireEvent.change(within(panel()).getByLabelText("Line Width"), {
      target: { value: "6" },
    });
    expect(feature.get("annotationStyle")).toEqual({ lineWidth: 6 });
    expect(within(panel()).getByLabelText("Line Width")).toHaveValue("6");

    fireEvent.change(within(panel()).getByLabelText("Arrowheads"), {
      target: { value: "none" },
    });
    // An arrow with no arrowheads is a line.
    expect(within(panel()).getByText("Line 1")).toBeInTheDocument();

    fireEvent.click(
      within(panel()).getByRole("button", { name: "Reset Line Width" }),
    );
    expect(feature.get("annotationStyle")).toEqual({ arrowheads: "none" });
    expect(within(panel()).getByLabelText("Line Width")).toHaveValue("");

    save();
    expect(context.editedAnnotations).toEqual([
      { ...line, style: { arrowheads: "none" } },
      text,
    ]);
  });

  it("resetting the last override leaves the item with no style at all", () => {
    mount(session({ items: [{ ...line, style: { lineWidth: 5 } }] }));
    selectFeature(featureById("a1"));

    fireEvent.click(
      within(panel()).getByRole("button", { name: "Reset Line Width" }),
    );
    save();

    expect(context.editedAnnotations).toEqual([line]);
  });

  it("edits text and its text properties, and the rotation follows a drag", () => {
    mount(session({ defaults: { textRotation: 10 }, items: [text] }));
    const feature = featureById("a2");
    selectFeature(feature);

    const field = within(panel()).getByLabelText("Selected annotation text");
    expect(field).toHaveValue("Old");
    fireEvent.change(field, { target: { value: "Gauge 7" } });
    expect(within(panel()).getByText("Text: Gauge 7")).toBeInTheDocument();
    expect(
      within(panel()).queryByLabelText("Line Width"),
    ).not.toBeInTheDocument();

    fireEvent.change(within(panel()).getByLabelText("Text Placement"), {
      target: { value: "ne" },
    });
    expect(within(panel()).getByLabelText("Text Rotation")).toHaveAttribute(
      "placeholder",
      "10",
    );

    // A rotation made with the handle shows up in the panel.
    act(() => {
      feature.set("annotationStyle", {
        ...feature.get("annotationStyle"),
        textRotation: -30,
      });
      feature.changed();
    });
    expect(within(panel()).getByLabelText("Text Rotation")).toHaveValue("-30");

    save();
    expect(context.editedAnnotations).toEqual([
      {
        ...text,
        text: "Gauge 7",
        style: { textAnchor: "ne", textRotation: -30 },
      },
    ]);
  });

  it("text left blank in the panel goes back to what it was", () => {
    mount(session({ items: [text] }));
    selectFeature(featureById("a2"));

    const field = within(panel()).getByLabelText("Selected annotation text");
    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: "  " } });
    fireEvent.blur(field);
    expect(field).toHaveValue("Old");

    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: "New" } });
    fireEvent.blur(field);
    expect(field).toHaveValue("New");
  });

  it("closes when its annotation is deleted", () => {
    mount(session({ items: [line] }));
    selectFeature(featureById("a1"));
    expect(panel()).toBeInTheDocument();

    fireEvent.click(deleteButton());

    expect(panel()).not.toBeInTheDocument();
    expect(workingFeatures()).toHaveLength(0);
  });

  it("picks a color override from the panel", async () => {
    // The picker commits after a short debounce; no map frame may be drawn
    // while waiting for it, since jsdom's canvas stub cannot draw one.
    jest.spyOn(window, "requestAnimationFrame").mockImplementation(() => 0);
    olMap.renderSync();
    mount(session({ items: [text] }));
    const feature = featureById("a2");
    selectFeature(feature);

    fireEvent.click(
      within(panel()).getByLabelText("Text Outline Color color popover square"),
    );
    fireEvent.change(screen.getByRole("textbox", { name: "HEX" }), {
      target: { value: "#00ffff" },
    });

    await waitFor(() =>
      expect(feature.get("annotationStyle")).toEqual({ haloColor: "#00ffff" }),
    );
  });
});

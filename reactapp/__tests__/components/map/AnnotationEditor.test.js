import { useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Map, View } from "ol";
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
const Host = ({ session }) => {
  context = useMapContext();
  const ref = useRef(olMap);
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
Host.propTypes = { session: PropTypes.object };

const mount = (session) =>
  render(
    <MapContextProvider>
      <Host session={session} />
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

const done = () =>
  fireEvent.click(screen.getByRole("button", { name: "Done" }));

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
  done();

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
  done();

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
  done();

  expect(context.editedAnnotations).toEqual([line]);
});

test("Done finishes a line in progress that has two points", () => {
  mount(session());

  act(() => {
    interaction(Draw).appendCoordinates([
      [0, 0],
      [10000, 0],
      [10000, 0],
    ]);
  });
  done();

  expect(context.editedAnnotations).toHaveLength(1);
});

test("a one-point line is dropped", () => {
  mount(session());

  act(() => {
    interaction(Draw).appendCoordinates([[0, 0]]);
  });
  done();

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
  done();

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
  done();

  expect(context.editedAnnotations).toEqual([]);
});

test("clicking existing text in Text mode edits it, and Escape reverts", () => {
  mount(session({ items: [text] }));
  fireEvent.click(screen.getByRole("button", { name: "Text" }));
  const [existing] = workingFeatures();
  jest
    .spyOn(olMap, "forEachFeatureAtPixel")
    .mockImplementation((pixel, callback) => callback(existing));

  singleClick([0, 0]);
  const box = screen.getByLabelText("Annotation text");
  expect(box).toHaveValue("Old");
  fireEvent.change(box, { target: { value: "New" } });
  fireEvent.keyDown(box, { key: "Escape" });
  done();

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
  done();

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
  done();

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
  done();

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
  done();

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
  done();

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

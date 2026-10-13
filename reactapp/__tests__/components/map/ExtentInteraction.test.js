import { useEffect } from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import Map from "ol/Map";
import View from "ol/View";
import ImageLayer from "ol/layer/Image";
import VectorLayer from "ol/layer/Vector";
import RenderEvent from "ol/render/Event";
import { create as createTransform } from "ol/transform";
import Static from "ol/source/ImageStatic";
import { addProjection, transformExtent, get as getProjection } from "ol/proj";
import Projection from "ol/proj/Projection";
import ExtentInteraction, {
  reprojectSavedExtent,
} from "components/map/ExtentInteraction";
import ImageExtentInteraction from "components/map/imageExtentInteraction";
import MapContextProvider, {
  useMapContext,
} from "components/contexts/MapContext";
import { ensureProjectionAsync } from "components/map/projections";
import PropTypes from "prop-types";

jest.mock("components/map/projections", () => {
  const actual = jest.requireActual("components/map/projections");
  return { ...actual, ensureProjectionAsync: jest.fn() };
});

// jsdom loads no images; capture each one so a test can finish its load.
let images = [];
class FakeImage {
  constructor() {
    this.naturalWidth = 0;
    this.naturalHeight = 0;
    images.push(this);
  }
}

function finishImageLoad(width, height) {
  const image = images[images.length - 1];
  image.naturalWidth = width;
  image.naturalHeight = height;
  act(() => image.onload());
}

let map;
let target;
let capturedBoxLayer;
const realImage = global.Image;
const realSetMap = VectorLayer.prototype.setMap;

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

beforeEach(() => {
  images = [];
  capturedBoxLayer = null;
  jest
    .spyOn(VectorLayer.prototype, "setMap")
    .mockImplementation(function (nextMap) {
      if (nextMap) capturedBoxLayer = this;
      return realSetMap.call(this, nextMap);
    });
  global.Image = FakeImage;
  ensureProjectionAsync.mockImplementation(async (code) => ({
    projection: getProjection(code),
  }));
  target = document.createElement("div");
  document.body.appendChild(target);
  map = new Map({
    target,
    view: new View({ center: [0, 0], zoom: 2 }),
  });
});

afterEach(() => {
  global.Image = realImage;
  map.setTarget(null);
  target.remove();
});

const IMAGE_URL = "https://example.com/image.png";

const Harness = ({ drawMode }) => {
  const { extentDrawMode, setExtentDrawMode, drawnExtent } = useMapContext();
  useEffect(() => {
    setExtentDrawMode(drawMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      {extentDrawMode && (
        <ExtentInteraction visualizationRef={{ current: map }} />
      )}
      <p data-testid="drawnExtent">
        {drawnExtent ? JSON.stringify(drawnExtent) : "null"}
      </p>
      <p data-testid="extentDrawMode">{extentDrawMode ? "active" : "null"}</p>
    </>
  );
};

Harness.propTypes = { drawMode: PropTypes.object };

// Open the editor before the map exists.
const NoMapHarness = () => {
  const { extentDrawMode, setExtentDrawMode } = useMapContext();
  useEffect(() => {
    setExtentDrawMode({ imageUrl: IMAGE_URL, initialExtent: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return extentDrawMode ? (
    <ExtentInteraction visualizationRef={{ current: null }} />
  ) : null;
};

function renderEditor(drawMode = {}) {
  return render(
    <MapContextProvider>
      <Harness
        drawMode={{
          imageUrl: IMAGE_URL,
          projection: "EPSG:3857",
          initialExtent: null,
          ...drawMode,
        }}
      />
    </MapContextProvider>,
  );
}

function editorInteraction() {
  return map
    .getInteractions()
    .getArray()
    .find((i) => i instanceof ImageExtentInteraction);
}

// Wait for the async projection resolution on open.
async function settle() {
  await act(() => Promise.resolve());
}

test("adds the extent interaction on open and removes it on close", async () => {
  renderEditor();
  await settle();
  expect(editorInteraction()).toBeDefined();
  // The editor's layer is unmanaged: it is not in the map's layer collection.
  expect(map.getLayers().getLength()).toBe(0);

  fireEvent.click(screen.getByText("Cancel"));
  expect(editorInteraction()).toBeUndefined();
  expect(screen.getByTestId("extentDrawMode")).toHaveTextContent("null");
});

test("an extent saved in the view projection opens unchanged", async () => {
  renderEditor({ initialExtent: [1, 2, 3, 4] });
  await settle();
  expect(editorInteraction().getExtent()).toEqual([1, 2, 3, 4]);
  expect(screen.getByText("Confirm")).not.toBeDisabled();
  expect(
    screen.getByText(/Shift\+drag to start a new box/),
  ).toBeInTheDocument();
});

test("an extent saved in EPSG:4326 opens transformed into the view projection", async () => {
  renderEditor({ initialExtent: [-10, 40, 10, 50], projection: "EPSG:4326" });
  await settle();
  const expected = transformExtent([-10, 40, 10, 50], "EPSG:4326", "EPSG:3857");
  editorInteraction()
    .getExtent()
    .forEach((v, i) => expect(v).toBeCloseTo(expected[i]));
});

test("an unresolvable projection opens with no box and a note", async () => {
  ensureProjectionAsync.mockResolvedValue({
    error: { reason: "unknown", detail: "EPSG:99999 is not known." },
  });
  renderEditor({ initialExtent: [1, 2, 3, 4], projection: "EPSG:99999" });
  await settle();
  expect(editorInteraction().getExtent()).toBeNull();
  expect(screen.getByRole("status")).toHaveTextContent(
    "EPSG:99999 is not known.",
  );
  expect(screen.getByText("Confirm")).toBeDisabled();
  expect(
    screen.getByText("Drag on the map to draw a box for the image."),
  ).toBeInTheDocument();
});

test("a failed projection definition load is treated as unresolvable", async () => {
  ensureProjectionAsync.mockRejectedValue(new Error("chunk failed"));
  renderEditor({ initialExtent: [1, 2, 3, 4], projection: "EPSG:5629" });
  await settle();
  expect(editorInteraction().getExtent()).toBeNull();
  expect(screen.getByRole("status")).toHaveTextContent("could not be loaded");
});

test("a projection resolving after the author drew a box is ignored", async () => {
  let resolve;
  ensureProjectionAsync.mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  renderEditor({ initialExtent: [-10, 40, 10, 50], projection: "EPSG:4326" });
  act(() => editorInteraction().setExtent([5, 5, 6, 6]));
  await act(async () => resolve({ projection: getProjection("EPSG:4326") }));
  expect(editorInteraction().getExtent()).toEqual([5, 5, 6, 6]);
});

test("a projection resolving after close does not throw", async () => {
  let resolve;
  ensureProjectionAsync.mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  renderEditor({ initialExtent: [-10, 40, 10, 50], projection: "EPSG:4326" });
  fireEvent.click(screen.getByText("Cancel"));
  await act(async () => resolve({ projection: getProjection("EPSG:4326") }));
  expect(screen.getByTestId("extentDrawMode")).toHaveTextContent("null");
});

// A box a few hundred pixels across at the test view's zoom.
const BIG_BOX = [0, 0, 1e7, 1e7];
const BIG_BOX_AT_2_TO_1 = [0, 2.5e6, 1e7, 7.5e6];

test("a lock set on the Source tab takes hold once the image loads", async () => {
  renderEditor({ initialExtent: BIG_BOX, keepAspectRatio: true });
  await settle();
  expect(
    screen.getByText("Loading image to keep its aspect ratio…"),
  ).toBeInTheDocument();
  expect(editorInteraction().getAspectRatio()).toBeNull();

  finishImageLoad(200, 100);
  expect(
    screen.queryByText("Loading image to keep its aspect ratio…"),
  ).not.toBeInTheDocument();
  expect(editorInteraction().getAspectRatio()).toBe(2);
  expect(editorInteraction().getExtent()).toEqual(BIG_BOX_AT_2_TO_1);
});

test("without the lock the box stays free and no image status shows", async () => {
  renderEditor({ initialExtent: [0, 0, 100, 100] });
  await settle();
  expect(screen.queryByText(/aspect ratio/)).not.toBeInTheDocument();
  finishImageLoad(200, 100);
  expect(editorInteraction().getAspectRatio()).toBeNull();
  expect(editorInteraction().getExtent()).toEqual([0, 0, 100, 100]);
});

test("a requested lock reports an image that fails to load", async () => {
  renderEditor({ keepAspectRatio: true });
  await settle();
  act(() => images[0].onerror());
  expect(
    screen.getByText(
      "Image could not be loaded, so its aspect ratio can't be kept",
    ),
  ).toBeInTheDocument();
});

test("an image with no intrinsic size counts as a failed load", async () => {
  renderEditor({ keepAspectRatio: true });
  await settle();
  finishImageLoad(0, 0);
  expect(editorInteraction().getAspectRatio()).toBeNull();
  expect(
    screen.getByText(
      "Image could not be loaded, so its aspect ratio can't be kept",
    ),
  ).toBeInTheDocument();
});

test("confirming a modified box sets drawnExtent", async () => {
  renderEditor({ initialExtent: BIG_BOX, keepAspectRatio: true });
  await settle();
  // The lock snapping the box counts as a modification.
  finishImageLoad(200, 100);
  fireEvent.click(screen.getByText("Confirm"));
  expect(screen.getByTestId("drawnExtent")).toHaveTextContent(
    JSON.stringify(BIG_BOX_AT_2_TO_1),
  );
  expect(screen.getByTestId("extentDrawMode")).toHaveTextContent("null");
});

test("reopening a box saved under the lock is not an edit", async () => {
  // Saved at 2:1 and then rounded, as MapLayer's toFixed(2) does.
  renderEditor({
    initialExtent: [0, 2500000.01, 1e7, 7499999.99],
    keepAspectRatio: true,
  });
  await settle();
  finishImageLoad(200, 100);
  fireEvent.click(screen.getByText("Confirm"));
  expect(screen.getByTestId("drawnExtent")).toHaveTextContent("null");
});

test("confirming an untouched box writes nothing", async () => {
  renderEditor({ initialExtent: [-10, 40, 10, 50], projection: "EPSG:4326" });
  await settle();
  fireEvent.click(screen.getByText("Confirm"));
  expect(screen.getByTestId("drawnExtent")).toHaveTextContent("null");
  expect(screen.getByTestId("extentDrawMode")).toHaveTextContent("null");
});

test("confirm is disabled until a box exists", async () => {
  renderEditor();
  await settle();
  expect(screen.getByText("Confirm")).toBeDisabled();
});

test("same-URL layers are hidden while editing and restored after", async () => {
  const matching = new ImageLayer({
    source: new Static({ url: IMAGE_URL, imageExtent: [0, 0, 1, 1] }),
  });
  const other = new ImageLayer({
    source: new Static({
      url: "https://example.com/other.png",
      imageExtent: [0, 0, 1, 1],
    }),
  });
  map.addLayer(matching);
  map.addLayer(other);

  renderEditor();
  await settle();
  expect(matching.getVisible()).toBe(false);
  expect(other.getVisible()).toBe(true);

  fireEvent.click(screen.getByText("Cancel"));
  expect(matching.getVisible()).toBe(true);
});

test("a view swap ends the editor as Cancel", async () => {
  renderEditor({ initialExtent: [1, 2, 3, 4] });
  await settle();
  act(() => map.setView(new View({ center: [0, 0], zoom: 3 })));
  expect(screen.getByTestId("extentDrawMode")).toHaveTextContent("null");
  expect(screen.getByTestId("drawnExtent")).toHaveTextContent("null");
});

test("the preview draws the image and the configured border", async () => {
  renderEditor({
    initialExtent: [0, 0, 100, 100],
    borderColor: "#ff0000",
    borderWidth: 4,
  });
  await settle();
  finishImageLoad(200, 100);

  const context = {
    save: jest.fn(),
    restore: jest.fn(),
    transform: jest.fn(),
    drawImage: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
    clip: jest.fn(),
    stroke: jest.fn(),
  };
  const frameState = {
    pixelRatio: 1,
    coordinateToPixelTransform: createTransform(),
    viewState: { projection: getProjection("EPSG:3857") },
  };
  // The editor's layer is unmanaged, so it was captured as it attached.
  capturedBoxLayer.dispatchEvent(
    new RenderEvent("prerender", createTransform(), frameState, context),
  );
  expect(context.drawImage).toHaveBeenCalledWith(images[0], 0, 0);
  expect(context.stroke).toHaveBeenCalled();
  expect(context.strokeStyle).toBe("#ff0000");
  expect(context.lineWidth).toBe(8);
});

test("a lock in force before the saved extent arrives is applied to it", async () => {
  let resolve;
  ensureProjectionAsync.mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  renderEditor({
    initialExtent: [-10, 40, 10, 50],
    projection: "EPSG:4326",
    keepAspectRatio: true,
  });
  finishImageLoad(200, 100);
  await act(() => resolve({ projection: getProjection("EPSG:4326") }));

  const [minX, minY, maxX, maxY] = editorInteraction().getExtent();
  expect((maxX - minX) / (maxY - minY)).toBeCloseTo(2);
});

test("the box is drawn with handles at its four corners", async () => {
  renderEditor();
  await settle();
  const style = capturedBoxLayer.getStyleFunction();
  const [box] = capturedBoxLayer.getSource().getFeatures();
  // No box yet: nothing to draw.
  expect(style(box)).toBeNull();

  act(() => editorInteraction().setExtent([0, 0, 10, 20]));
  const [outline, handles] = style(box);
  expect(outline.getStroke()).toBeTruthy();
  // fromExtent's ring order: bottom-left, top-left, top-right, bottom-right.
  expect(handles.getGeometryFunction()(box).getCoordinates()).toEqual([
    [0, 0],
    [0, 20],
    [10, 20],
    [10, 0],
  ]);
});

// A prerender on the editor's layer, with a recording 2D context.
function firePrerender(context) {
  const frameState = {
    pixelRatio: 1,
    coordinateToPixelTransform: createTransform(),
    viewState: { projection: getProjection("EPSG:3857") },
  };
  capturedBoxLayer.dispatchEvent(
    new RenderEvent("prerender", createTransform(), frameState, context),
  );
}

function recordingContext() {
  return {
    save: jest.fn(),
    restore: jest.fn(),
    transform: jest.fn(),
    drawImage: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
    clip: jest.fn(),
    stroke: jest.fn(),
  };
}

test("before the image loads, a border still draws without the image", async () => {
  renderEditor({ initialExtent: [0, 0, 100, 100], borderColor: "#ff0000" });
  await settle();
  const context = recordingContext();
  firePrerender(context);
  expect(context.drawImage).not.toHaveBeenCalled();
  expect(context.stroke).toHaveBeenCalled();
});

test("with no image, no border or no box, the preview draws nothing", async () => {
  renderEditor({ initialExtent: [0, 0, 100, 100] });
  await settle();
  // No image loaded and no border.
  const bare = recordingContext();
  firePrerender(bare);
  expect(bare.save).not.toHaveBeenCalled();

  // No canvas to draw on.
  expect(() => firePrerender(null)).not.toThrow();

  // No box.
  finishImageLoad(200, 100);
  act(() => editorInteraction().setExtent([0, 0, 0, 0]));
  const noBox = recordingContext();
  firePrerender(noBox);
  expect(noBox.drawImage).not.toHaveBeenCalled();
});

test("clearing the box removes its outline and disables Confirm", async () => {
  renderEditor({ initialExtent: [0, 0, 100, 100] });
  await settle();
  expect(screen.getByText("Confirm")).not.toBeDisabled();
  act(() => editorInteraction().setExtent([0, 0, 0, 0]));
  expect(screen.getByText("Confirm")).toBeDisabled();
  const [box] = capturedBoxLayer.getSource().getFeatures();
  expect(box.getGeometry()).toBeUndefined();
});

test("with no image URL, a requested lock reports it can't be kept", async () => {
  renderEditor({ imageUrl: "", keepAspectRatio: true });
  await settle();
  expect(images).toHaveLength(0);
  expect(
    screen.getByText(
      "Image could not be loaded, so its aspect ratio can't be kept",
    ),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByText("Cancel"));
});

test("without a map yet, the overlay shows but nothing is attached", () => {
  render(
    <MapContextProvider>
      <NoMapHarness />
    </MapContextProvider>,
  );
  expect(screen.getByText("Cancel")).toBeInTheDocument();
  expect(editorInteraction()).toBeUndefined();
});

test("with no draw mode the editor renders nothing", () => {
  render(
    <MapContextProvider>
      <ExtentInteraction visualizationRef={{ current: map }} />
    </MapContextProvider>,
  );
  expect(screen.queryByText("Cancel")).not.toBeInTheDocument();
});

describe("reprojectSavedExtent", () => {
  test("clamps a polar extent to the view projection's bounds", async () => {
    const view = getProjection("EPSG:3857");
    const result = await reprojectSavedExtent(
      [-10, 0, 10, 90],
      "EPSG:4326",
      view,
    );
    expect(result.extent.every(Number.isFinite)).toBe(true);
    expect(result.extent[3]).toBeCloseTo(view.getExtent()[3]);
  });

  test("keeps the full width of an extent crossing the antimeridian", async () => {
    const view = getProjection("EPSG:3857");
    const result = await reprojectSavedExtent(
      [170, -10, 190, 10],
      "EPSG:4326",
      view,
    );
    const expected = transformExtent(
      [170, -10, 190, 10],
      "EPSG:4326",
      "EPSG:3857",
    );
    expect(result.extent[0]).toBeCloseTo(expected[0]);
    expect(result.extent[2]).toBeCloseTo(expected[2]);
    expect(result.extent[2]).toBeGreaterThan(view.getExtent()[2]);
  });

  test("reports an extent wholly outside the view's bounds", async () => {
    const result = await reprojectSavedExtent(
      [0, 3e7, 10, 4e7],
      "EPSG:3857",
      getProjection("EPSG:3857"),
    );
    expect(result.error).toMatch(/does not fall within the map's EPSG:3857/);
  });

  test("a view projection with no valid extent is not clamped", async () => {
    const local = new Projection({ code: "LOCAL:1", units: "m" });
    addProjection(local);
    ensureProjectionAsync.mockResolvedValue({ projection: local });
    const result = await reprojectSavedExtent(
      [0, 0, 5e7, 5e7],
      "LOCAL:1",
      local,
    );
    expect(result.extent).toEqual([0, 0, 5e7, 5e7]);
  });

  test("returns the registry's error detail for an unknown code", async () => {
    ensureProjectionAsync.mockResolvedValue({
      error: { reason: "unknown", detail: "nope" },
    });
    const result = await reprojectSavedExtent(
      [0, 0, 1, 1],
      "EPSG:1",
      getProjection("EPSG:3857"),
    );
    expect(result).toEqual({ error: "nope" });
  });
});

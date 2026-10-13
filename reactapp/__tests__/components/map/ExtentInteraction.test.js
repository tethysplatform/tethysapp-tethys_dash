import { useEffect } from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import Map from "ol/Map";
import View from "ol/View";
import ImageLayer from "ol/layer/Image";
import VectorLayer from "ol/layer/Vector";
import RenderEvent from "ol/render/Event";
import { create as createTransform } from "ol/transform";
import Static from "ol/source/ImageStatic";
import { transformExtent, get as getProjection } from "ol/proj";
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

test("the aspect checkbox waits for the image and locks to its ratio", async () => {
  renderEditor({ initialExtent: [0, 0, 100, 100] });
  await settle();
  const checkbox = screen.getByLabelText("Keep aspect ratio");
  expect(checkbox).toBeDisabled();
  expect(checkbox).not.toBeChecked();
  expect(screen.getByText("Loading image…")).toBeInTheDocument();

  finishImageLoad(200, 100);
  expect(checkbox).not.toBeDisabled();
  expect(screen.queryByText("Loading image…")).not.toBeInTheDocument();

  fireEvent.click(checkbox);
  expect(editorInteraction().getAspectRatio()).toBe(2);
  expect(editorInteraction().getExtent()).toEqual([0, 25, 100, 75]);
});

test("the aspect checkbox stays disabled when the image fails to load", async () => {
  renderEditor();
  await settle();
  act(() => images[0].onerror());
  expect(screen.getByLabelText("Keep aspect ratio")).toBeDisabled();
  expect(
    screen.getByText("Image could not be loaded; aspect ratio unavailable"),
  ).toBeInTheDocument();
});

test("an image with no intrinsic size counts as a failed load", async () => {
  renderEditor();
  await settle();
  finishImageLoad(0, 0);
  expect(screen.getByLabelText("Keep aspect ratio")).toBeDisabled();
});

test("confirming a modified box sets drawnExtent", async () => {
  renderEditor({ initialExtent: [0, 0, 100, 100] });
  await settle();
  finishImageLoad(200, 100);
  // Checking the lock reshapes the box, which counts as a modification.
  fireEvent.click(screen.getByLabelText("Keep aspect ratio"));
  fireEvent.click(screen.getByText("Confirm"));
  expect(screen.getByTestId("drawnExtent")).toHaveTextContent(
    JSON.stringify([0, 25, 100, 75]),
  );
  expect(screen.getByTestId("extentDrawMode")).toHaveTextContent("null");
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

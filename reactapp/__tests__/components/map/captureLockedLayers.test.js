import { Map as OlMap } from "ol";
import moduleLoader from "components/map/ModuleLoader";
import {
  captureLockedMapLayers,
  registerCaptureMap,
  LOCKED_LAYER_RENDER_TIMEOUT,
} from "components/map/captureLockedLayers";
import { createCaptureSession } from "components/layout/captureDashboard";

jest.mock("ol", () => ({ Map: jest.fn(), View: jest.fn() }));
jest.mock("components/map/ModuleLoader", () => ({
  __esModule: true,
  default: jest.fn(),
  // Proxiable exactly when the layer has a WMS source, as the real one decides.
  isProxiableImageLayer: (config) => config?.props?.source?.type === "WMS",
  withProxiedImages: (config, proxiedUrl) => ({
    ...config,
    proxied: proxiedUrl("https://maps.test/wms"),
  }),
}));
jest.mock("services/utilities", () => ({
  getTethysAppRoot: () => "/apps/tethysdash/",
}));

const proxiedUrl = (url) => `/proxy/?url=${encodeURIComponent(url)}`;

function readableCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 300;
  canvas.toDataURL = () => "data:image/png;base64,RENDERED";
  return canvas;
}

function taintedCanvas() {
  const canvas = readableCanvas();
  canvas.getContext = () => ({
    getImageData: () => {
      throw new DOMException("tainted", "SecurityError");
    },
  });
  return canvas;
}

function webglCanvas() {
  const canvas = readableCanvas();
  canvas.getContext = () => null;
  return canvas;
}

/* A grid holding one registered map whose viewport holds the given canvases,
   each belonging to a layer whose config is given alongside it. */
function addMap(layers, { register = true, size = [400, 300] } = {}) {
  const grid = document.createElement("div");
  const element = document.createElement("div");
  element.setAttribute("aria-label", "Map Div");
  const viewport = document.createElement("div");
  element.appendChild(viewport);
  grid.appendChild(element);
  document.body.appendChild(grid);

  const olLayers = layers.map(({ canvas, config, visible = true }, index) => {
    viewport.appendChild(canvas);
    return {
      config,
      getRenderer: () => ({ context: { canvas } }),
      getVisible: () => visible,
      get: () => config?.props?.name ?? `layer-${index}`,
    };
  });

  const map = {
    getSize: () => size,
    getView: () => ({
      getProjection: () => ({ getCode: () => "EPSG:3857" }),
      getCenter: () => [0, 0],
      getResolution: () => 10,
      getRotation: () => 0,
    }),
    getLayers: () => ({ getArray: () => olLayers }),
    getViewport: () => viewport,
  };
  if (register) {
    registerCaptureMap(element, map, (layer) => layer.config);
  }
  return { grid, element, viewport, map };
}

const wmsConfig = {
  type: "ImageLayer",
  props: { name: "Radar", source: { type: "WMS", props: {} } },
};
const vectorConfig = { type: "VectorLayer", props: { name: "Points" } };

let offscreen;
let renderedCanvas;
let sourceListeners;

beforeEach(() => {
  document.body.innerHTML = "";
  jest.spyOn(console, "warn").mockImplementation(() => {});
  renderedCanvas = readableCanvas();
  renderedCanvas.style.cssText = "position: absolute; left: 0px;";
  sourceListeners = {};
  offscreen = {
    addLayer: jest.fn(),
    setTarget: jest.fn(),
    renderSync: jest.fn(),
    once: jest.fn((event, callback) => callback()),
  };
  OlMap.mockImplementation(() => offscreen);
  moduleLoader.mockResolvedValue({
    setVisible: jest.fn(),
    getSource: () => ({
      on: (event, listener) => {
        sourceListeners[event] = listener;
      },
    }),
    getRenderer: () => ({ context: { canvas: renderedCanvas } }),
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe("captureLockedMapLayers", () => {
  it("leaves a map whose canvases are all readable alone", async () => {
    const { grid } = addMap([{ canvas: readableCanvas(), config: wmsConfig }]);

    const incomplete = await captureLockedMapLayers(
      grid,
      createCaptureSession(),
      proxiedUrl,
    );

    expect(incomplete).toEqual([]);
    expect(moduleLoader).not.toHaveBeenCalled();
  });

  it("never probes a WebGL canvas", async () => {
    const { grid } = addMap([{ canvas: webglCanvas(), config: wmsConfig }]);

    await expect(
      captureLockedMapLayers(grid, createCaptureSession(), proxiedUrl),
    ).resolves.toEqual([]);
    expect(moduleLoader).not.toHaveBeenCalled();
  });

  it("stands a proxied re-render in for a locked image layer until teardown", async () => {
    const live = taintedCanvas();
    const { grid, viewport } = addMap([{ canvas: live, config: wmsConfig }]);
    const session = createCaptureSession();

    const incomplete = await captureLockedMapLayers(grid, session, proxiedUrl);

    expect(incomplete).toEqual([]);
    // Built from the live config, through the proxy, at the live view.
    expect(moduleLoader).toHaveBeenCalledWith(
      expect.objectContaining({ proxied: proxiedUrl("https://maps.test/wms") }),
      "EPSG:3857",
      expect.any(Function),
    );
    expect(offscreen.renderSync).toHaveBeenCalled();
    // The offscreen map is gone as soon as its pixels are copied.
    expect(offscreen.setTarget).toHaveBeenCalledWith(undefined);

    const standIn = viewport.querySelector("img");
    expect(viewport.contains(live)).toBe(false);
    expect(standIn.getAttribute("src")).toBe("data:image/png;base64,RENDERED");
    expect(standIn.style.position).toBe("absolute");

    session.teardown();
    expect(viewport.contains(live)).toBe(true);
    expect(viewport.querySelector("img")).toBeNull();
  });

  it("reports a locked canvas with no image source behind it", async () => {
    // A vector layer drawing a cross-origin point icon.
    const { grid, element } = addMap([
      { canvas: taintedCanvas(), config: vectorConfig },
    ]);

    const incomplete = await captureLockedMapLayers(
      grid,
      createCaptureSession(),
      proxiedUrl,
    );

    expect(incomplete).toEqual([element]);
    expect(moduleLoader).not.toHaveBeenCalled();
  });

  it("reports the map and leaves the live canvas when the proxied image fails", async () => {
    offscreen.once.mockImplementation((event, callback) => {
      sourceListeners.imageloaderror?.();
      callback();
    });
    const live = taintedCanvas();
    const { grid, element, viewport } = addMap([
      { canvas: live, config: wmsConfig },
    ]);

    const incomplete = await captureLockedMapLayers(
      grid,
      createCaptureSession(),
      proxiedUrl,
    );

    expect(incomplete).toEqual([element]);
    expect(viewport.contains(live)).toBe(true);
    expect(offscreen.setTarget).toHaveBeenCalledWith(undefined);
  });

  it("gives up on a re-render that never completes", async () => {
    jest.useFakeTimers();
    offscreen.once.mockImplementation(() => {});
    const { grid, element } = addMap([
      { canvas: taintedCanvas(), config: wmsConfig },
    ]);

    const pending = captureLockedMapLayers(
      grid,
      createCaptureSession(),
      proxiedUrl,
    );
    // Let the layer build and the render wait start before the clock moves.
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
    jest.advanceTimersByTime(LOCKED_LAYER_RENDER_TIMEOUT);

    await expect(pending).resolves.toEqual([element]);
  });

  it("treats a canvas that cannot give a 2D context as readable", async () => {
    const canvas = readableCanvas();
    canvas.getContext = () => {
      throw new Error("context lost");
    };
    const { grid } = addMap([{ canvas, config: wmsConfig }]);

    await expect(
      captureLockedMapLayers(grid, createCaptureSession(), proxiedUrl),
    ).resolves.toEqual([]);
    expect(moduleLoader).not.toHaveBeenCalled();
  });

  it("reports a locked layer on a map that has no size yet", async () => {
    const { grid, element } = addMap(
      [{ canvas: taintedCanvas(), config: wmsConfig }],
      { size: [0, 0] },
    );

    const incomplete = await captureLockedMapLayers(
      grid,
      createCaptureSession(),
      proxiedUrl,
    );

    expect(incomplete).toEqual([element]);
    expect(moduleLoader).not.toHaveBeenCalled();
  });

  it("builds the copy in the live map's projection, however late it is read", async () => {
    const { grid } = addMap([{ canvas: taintedCanvas(), config: wmsConfig }]);

    await captureLockedMapLayers(grid, createCaptureSession(), proxiedUrl);

    const getMapProjection = moduleLoader.mock.calls[0][2];
    expect(getMapProjection()).toBe("EPSG:3857");
  });

  it("reports a layer whose re-render is not readable either", async () => {
    renderedCanvas = taintedCanvas();
    const live = taintedCanvas();
    const { grid, element, viewport } = addMap([
      { canvas: live, config: wmsConfig },
    ]);

    const incomplete = await captureLockedMapLayers(
      grid,
      createCaptureSession(),
      proxiedUrl,
    );

    expect(incomplete).toEqual([element]);
    expect(viewport.contains(live)).toBe(true);
  });

  it("skips a map element nothing registered", async () => {
    const { grid } = addMap([{ canvas: taintedCanvas(), config: wmsConfig }], {
      register: false,
    });

    await expect(
      captureLockedMapLayers(grid, createCaptureSession(), proxiedUrl),
    ).resolves.toEqual([]);
  });

  it("stops finding a map once it unregisters", async () => {
    const element = document.createElement("div");
    element.setAttribute("aria-label", "Map Div");
    const grid = document.createElement("div");
    grid.appendChild(element);
    const map = { getLayers: jest.fn() };

    const unregister = registerCaptureMap(element, map, () => null);
    unregister();
    await captureLockedMapLayers(grid, createCaptureSession(), proxiedUrl);

    expect(map.getLayers).not.toHaveBeenCalled();
    // A missing element registers nothing and unregisters harmlessly.
    const noop = registerCaptureMap(null, map, () => null);
    expect(noop).toEqual(expect.any(Function));
    expect(noop()).toBeUndefined();
  });

  it("leaves a newer map's registration alone when an older one unregisters", async () => {
    const live = taintedCanvas();
    const { grid, element } = addMap([{ canvas: live, config: wmsConfig }], {
      register: false,
    });
    const stale = { getLayers: jest.fn() };
    const unregisterStale = registerCaptureMap(element, stale, () => null);
    // The element is reused by a newer map before the old one cleans up.
    const current = addMap([{ canvas: taintedCanvas(), config: wmsConfig }]);
    registerCaptureMap(element, current.map, (layer) => layer.config);

    unregisterStale();
    await captureLockedMapLayers(grid, createCaptureSession(), proxiedUrl);

    expect(stale.getLayers).not.toHaveBeenCalled();
    expect(moduleLoader).toHaveBeenCalled();
  });

  it("does not probe a canvas with no size, a layer with no canvas, or a hidden layer", async () => {
    const empty = taintedCanvas();
    empty.width = 0;
    const hidden = taintedCanvas();
    const { grid, map } = addMap([
      { canvas: empty, config: wmsConfig },
      { canvas: hidden, config: wmsConfig, visible: false },
    ]);
    map
      .getLayers()
      .getArray()
      .push({
        getRenderer: () => ({}),
        getVisible: () => true,
        get: () => "no canvas",
      });

    const incomplete = await captureLockedMapLayers(
      grid,
      createCaptureSession(),
      proxiedUrl,
    );

    // The hidden layer's canvas still reads as tainted, but with no visible
    // layer behind it there is nothing to re-fetch - it is reported.
    expect(incomplete).toHaveLength(1);
    expect(moduleLoader).not.toHaveBeenCalled();
  });
});

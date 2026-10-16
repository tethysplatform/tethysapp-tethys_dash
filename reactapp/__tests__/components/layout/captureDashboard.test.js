import { snapdom } from "@zumer/snapdom";
import { captureLockedMapLayers } from "components/map/captureLockedLayers";
import {
  captureDashboard,
  captureDashboardCanvas,
  CaptureBusyError,
  CAPTURE_PROBLEM,
  CAPTURING_CLASS,
  clampDensity,
  exportFilename,
  NothingToCaptureError,
} from "components/layout/captureDashboard";

jest.mock("@zumer/snapdom", () => ({ snapdom: jest.fn() }));
jest.mock("components/map/captureLockedLayers", () => ({
  captureLockedMapLayers: jest.fn(),
}));
jest.mock("services/utilities", () => ({
  getTethysAppRoot: () => "/apps/tethysdash/",
}));

const DASHBOARD = "8a1d6a8e-0c8e-4c43-9b1e-5d2f7f0e1a11";

function rect({ top = 0, left = 0, width, height }) {
  return {
    top,
    left,
    width,
    height,
    bottom: top + height,
    right: left + width,
    toJSON: () => ({}),
  };
}

function capturedCanvas({ width = 2400, height = 1800, blob = true } = {}) {
  return {
    width,
    height,
    toBlob: jest.fn((done) =>
      done(blob ? new Blob(["png"], { type: "image/png" }) : null),
    ),
  };
}

const snapdomReturns = (canvas = capturedCanvas()) =>
  snapdom.mockResolvedValue({ toCanvas: jest.fn().mockResolvedValue(canvas) });

/* A laid-out grid with one tile in it, positioned in the viewport. */
function addGrid({
  top = 56,
  width = 1200,
  height = 900,
  label = "Image",
  fill = false,
} = {}) {
  const grid = document.createElement("div");
  grid.className = "react-grid-layout";
  jest
    .spyOn(grid, "getBoundingClientRect")
    .mockReturnValue(rect({ top, width, height }));
  const tile = document.createElement("div");
  tile.setAttribute("data-tile-label", label);
  if (fill) tile.setAttribute("data-fill-viewport", "true");
  grid.appendChild(tile);
  document.body.appendChild(grid);
  return { grid, tile };
}

function addImage(parent, src, { size = 100 } = {}) {
  const image = document.createElement("img");
  image.setAttribute("src", src);
  jest
    .spyOn(image, "getBoundingClientRect")
    .mockReturnValue(rect({ width: size, height: size }));
  parent.appendChild(image);
  return image;
}

const imageResponse = () => ({
  ok: true,
  status: 200,
  headers: { get: () => "image/png" },
  blob: async () => new Blob(["png-bytes"], { type: "image/png" }),
});

// msw restores the real fetch when the shared server closes, so put it back
// rather than delete it.
const originalFetch = global.fetch;

beforeEach(() => {
  document.body.innerHTML = "";
  document.documentElement.style.setProperty("--ts-header-height", "56px");
  window.innerWidth = 1200;
  window.innerHeight = 800;
  window.scrollX = 0;
  window.scrollY = 0;
  jest.spyOn(console, "warn").mockImplementation(() => {});
  captureLockedMapLayers.mockResolvedValue([]);
  snapdomReturns();
});

afterEach(() => {
  document.documentElement.style.removeProperty("--ts-header-height");
  global.fetch = originalFetch;
});

describe("captureDashboardCanvas", () => {
  it("refuses when there is no laid-out grid, or no tile in it", async () => {
    await expect(captureDashboardCanvas()).rejects.toBeInstanceOf(
      NothingToCaptureError,
    );

    const empty = document.createElement("div");
    empty.className = "react-grid-layout";
    jest
      .spyOn(empty, "getBoundingClientRect")
      .mockReturnValue(rect({ width: 100, height: 100 }));
    document.body.appendChild(empty);
    await expect(captureDashboardCanvas()).rejects.toBeInstanceOf(
      NothingToCaptureError,
    );
    expect(snapdom).not.toHaveBeenCalled();
  });

  it("captures the whole grid, unclipped, at twice screen density", async () => {
    const { grid } = addGrid();

    const { canvas, problems, downscaled } = await captureDashboardCanvas({
      mode: "whole",
      dashboardUuid: DASHBOARD,
    });

    expect(snapdom).toHaveBeenCalledWith(
      grid,
      expect.objectContaining({
        dpr: 2,
        excludeMode: "remove",
        backgroundColor: "#ffffff",
        exclude: expect.arrayContaining([
          ".dashboard-item-menu",
          ".modebar-container",
          ".ol-overlay-container",
        ]),
      }),
    );
    expect(snapdom.mock.calls[0][1]).not.toHaveProperty("clip");
    expect(canvas.width).toBe(2400);
    expect(problems).toEqual([]);
    expect(downscaled).toBe(false);
  });

  it("covers AE1: a whole tab taller than the window, scrolled, is captured whole without scrolling", async () => {
    const { grid } = addGrid({ top: -1500, height: 4000 });
    window.scrollY = 1556;
    const scrollTo = jest.spyOn(window, "scrollTo").mockImplementation();

    await captureDashboardCanvas({ mode: "whole" });

    expect(snapdom.mock.calls[0][0]).toBe(grid);
    expect(snapdom.mock.calls[0][1]).not.toHaveProperty("clip");
    expect(window.scrollY).toBe(1556);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("clips visible mode to the grid on screen below the header, in page coordinates", async () => {
    addGrid({ top: -300, height: 3000 });
    window.scrollY = 356;

    await captureDashboardCanvas({ mode: "visible" });

    expect(snapdom.mock.calls[0][1].clip).toEqual({
      x: 0,
      y: 56 + 356,
      width: 1200,
      height: 800 - 56,
    });
  });

  it("captures what is on screen when a fill-viewport tile is active", async () => {
    addGrid({ fill: true, height: 2000 });

    await captureDashboardCanvas({ mode: "whole" });

    expect(snapdom.mock.calls[0][1].clip).toEqual(
      expect.objectContaining({ y: 56, height: 800 - 56 }),
    );
  });

  it("refuses visible mode when none of the grid is on screen", async () => {
    addGrid({ top: 900, height: 400 });
    await expect(
      captureDashboardCanvas({ mode: "visible" }),
    ).rejects.toBeInstanceOf(NothingToCaptureError);
  });

  it("reduces the density for a grid too large for one canvas, and says so", async () => {
    addGrid({ height: 20000 });

    const { downscaled } = await captureDashboardCanvas({ mode: "whole" });

    expect(snapdom.mock.calls[0][1].dpr).toBeLessThan(1);
    expect(downscaled).toBe(true);
  });

  it("marks the grid as capturing only while the capture runs", async () => {
    const { grid } = addGrid();
    let classDuringCapture;
    snapdom.mockImplementation(async () => {
      classDuringCapture = grid.classList.contains(CAPTURING_CLASS);
      return { toCanvas: async () => capturedCanvas() };
    });

    await captureDashboardCanvas();

    expect(classDuringCapture).toBe(true);
    expect(grid.classList.contains(CAPTURING_CLASS)).toBe(false);
  });

  it("undoes everything and frees the lock when the capture throws", async () => {
    const { grid, tile } = addGrid();
    const image = addImage(tile, "https://elsewhere.test/logo.png");
    global.fetch = jest.fn().mockResolvedValue(imageResponse());
    snapdom.mockRejectedValue(new Error("snapdom exploded"));

    await expect(captureDashboardCanvas()).rejects.toThrow("snapdom exploded");

    expect(grid.classList.contains(CAPTURING_CLASS)).toBe(false);
    expect(image.getAttribute("src")).toBe("https://elsewhere.test/logo.png");
    // The lock is free again.
    snapdomReturns();
    await expect(captureDashboardCanvas()).resolves.toBeDefined();
  });

  it("runs one capture at a time", async () => {
    addGrid();
    let finish;
    snapdom.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ toCanvas: async () => capturedCanvas() });
        }),
    );

    const first = captureDashboardCanvas();
    await expect(captureDashboardCanvas()).rejects.toBeInstanceOf(
      CaptureBusyError,
    );
    while (!finish) await Promise.resolve();
    finish();
    await first;

    snapdomReturns();
    await expect(captureDashboardCanvas()).resolves.toBeDefined();
  });

  it("reports each map with a layer that could not be included", async () => {
    const { tile } = addGrid({ label: "Rain Map" });
    const mapElement = document.createElement("div");
    tile.appendChild(mapElement);
    captureLockedMapLayers.mockResolvedValue([mapElement]);

    const { problems } = await captureDashboardCanvas({
      dashboardUuid: DASHBOARD,
    });

    expect(problems).toEqual([
      { tile: "Rain Map", kind: CAPTURE_PROBLEM.mapLayer },
    ]);
    // Proxied URLs for the re-fetch carry the dashboard.
    const proxiedUrl = captureLockedMapLayers.mock.calls[0][2];
    expect(proxiedUrl("https://maps.test/wms?a=1")).toBe(
      `/apps/tethysdash/images/proxy/?url=${encodeURIComponent(
        "https://maps.test/wms?a=1",
      )}&dashboard=${DASHBOARD}`,
    );
  });
});

describe("cross-origin images", () => {
  it("covers AE2: inlines an image through the proxy for the named dashboard, then puts it back", async () => {
    const { tile } = addGrid();
    const image = addImage(tile, "https://elsewhere.test/logo.png");
    global.fetch = jest.fn().mockResolvedValue(imageResponse());
    let srcDuringCapture;
    snapdom.mockImplementation(async () => {
      srcDuringCapture = image.getAttribute("src");
      return { toCanvas: async () => capturedCanvas() };
    });

    const { problems } = await captureDashboardCanvas({
      dashboardUuid: DASHBOARD,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      `/apps/tethysdash/images/proxy/?url=${encodeURIComponent(
        "https://elsewhere.test/logo.png",
      )}&dashboard=${DASHBOARD}`,
      { credentials: "include" },
    );
    expect(srcDuringCapture).toMatch(/^data:/);
    expect(image.getAttribute("src")).toBe("https://elsewhere.test/logo.png");
    expect(problems).toEqual([]);
  });

  it.each([
    [
      "throttled",
      { ok: false, status: 429, headers: { get: () => "text/plain" } },
    ],
    [
      "refused",
      { ok: false, status: 403, headers: { get: () => "text/plain" } },
    ],
    ["not an image", { ok: true, status: 200, headers: { get: () => null } }],
  ])(
    "reports an image the proxy answers %s, and leaves it as it was",
    async (_, response) => {
      const { tile } = addGrid({ label: "Logo" });
      const image = addImage(tile, "https://elsewhere.test/logo.png");
      global.fetch = jest.fn().mockResolvedValue(response);

      const { problems } = await captureDashboardCanvas();

      expect(image.getAttribute("src")).toBe("https://elsewhere.test/logo.png");
      expect(problems).toEqual([{ tile: "Logo", kind: CAPTURE_PROBLEM.image }]);
    },
  );

  it("reports an image whose fetch throws", async () => {
    const { tile } = addGrid({ label: "Logo" });
    addImage(tile, "https://elsewhere.test/logo.png");
    global.fetch = jest
      .fn()
      .mockRejectedValue(new TypeError("Failed to fetch"));

    const { problems } = await captureDashboardCanvas();

    expect(problems).toEqual([{ tile: "Logo", kind: CAPTURE_PROBLEM.image }]);
  });

  it("skips hidden image-sequence frames and images outside the grid", async () => {
    const { tile } = addGrid();
    addImage(tile, "https://elsewhere.test/hidden.png", { size: 0 });
    const invisible = addImage(tile, "https://elsewhere.test/invisible.png");
    invisible.style.visibility = "hidden";
    addImage(document.body, "https://elsewhere.test/outside.png");
    global.fetch = jest.fn();

    await captureDashboardCanvas();

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("leaves same-origin, data and blob images untouched", async () => {
    const { tile } = addGrid();
    addImage(tile, "/local/logo.png");
    addImage(tile, "data:image/png;base64,AAA");
    addImage(tile, "blob:http://localhost/abc");
    addImage(tile, "http://[bad");
    global.fetch = jest.fn();

    await captureDashboardCanvas();

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("fetches a repeated image once", async () => {
    const { tile } = addGrid();
    const first = addImage(tile, "https://elsewhere.test/logo.png");
    const second = addImage(tile, "https://elsewhere.test/logo.png");
    global.fetch = jest.fn().mockResolvedValue(imageResponse());
    let sources;
    snapdom.mockImplementation(async () => {
      sources = [first.getAttribute("src"), second.getAttribute("src")];
      return { toCanvas: async () => capturedCanvas() };
    });

    await captureDashboardCanvas();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(sources[0]).toMatch(/^data:/);
    expect(sources[1]).toBe(sources[0]);
  });

  it("removes the attribute again for an image that never had one", async () => {
    const { tile } = addGrid();
    const image = document.createElement("img");
    Object.defineProperty(image, "currentSrc", {
      value: "https://elsewhere.test/only-current.png",
    });
    jest
      .spyOn(image, "getBoundingClientRect")
      .mockReturnValue(rect({ width: 10, height: 10 }));
    tile.appendChild(image);
    global.fetch = jest.fn().mockResolvedValue(imageResponse());

    await captureDashboardCanvas();

    expect(image.hasAttribute("src")).toBe(false);
  });
});

describe("captureDashboard", () => {
  it("returns a png blob and the problems, each named once", async () => {
    const { tile } = addGrid({ label: "Logo" });
    addImage(tile, "https://elsewhere.test/a.png");
    addImage(tile, "https://elsewhere.test/b.png");
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      headers: { get: () => "text/plain" },
    });

    const result = await captureDashboard({ mode: "whole" });

    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.problems).toEqual([
      { tile: "Logo", kind: CAPTURE_PROBLEM.image },
    ]);
    expect(result.downscaled).toBe(false);
  });

  it("halves the capture it already has when the browser cannot encode it", async () => {
    const { tile } = addGrid();
    addImage(tile, "https://elsewhere.test/logo.png");
    global.fetch = jest.fn().mockResolvedValue(imageResponse());
    snapdomReturns(capturedCanvas({ blob: false }));
    jest
      .spyOn(HTMLCanvasElement.prototype, "toBlob")
      .mockImplementation((done) => done(new Blob(["png"])));

    const result = await captureDashboard();

    // Not captured again: no second snapdom pass, no second proxy fetch.
    expect(snapdom).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.downscaled).toBe(true);
  });

  it("fails when the canvas cannot be encoded at all", async () => {
    addGrid();
    snapdomReturns(capturedCanvas({ blob: false }));
    jest
      .spyOn(HTMLCanvasElement.prototype, "toBlob")
      .mockImplementation((done) => done(null));

    await expect(captureDashboard()).rejects.toThrow(
      "The browser could not encode the image.",
    );
  });
});

describe("clampDensity", () => {
  it("keeps the requested density when the canvas fits", () => {
    expect(clampDensity(1200, 900, 2)).toEqual({ dpr: 2, reduced: false });
  });

  it("holds the longest side within the browser limit", () => {
    const { dpr, reduced } = clampDensity(1200, 20000, 2);
    expect(20000 * dpr).toBeLessThanOrEqual(16384);
    expect(reduced).toBe(true);
  });

  it("holds the area within the browser limit", () => {
    const { dpr } = clampDensity(4000, 4000, 2);
    expect(4000 * dpr * 4000 * dpr).toBeLessThanOrEqual(16777216 + 1);
  });

  it("leaves an unmeasured size alone", () => {
    expect(clampDensity(0, 0, 2)).toEqual({ dpr: 2, reduced: false });
  });
});

describe("exportFilename", () => {
  const when = new Date(2026, 9, 16, 9, 5);

  it("is the dashboard name and the local date and time", () => {
    expect(exportFilename("River Forecast", when)).toBe(
      "River Forecast_2026-10-16_0905.png",
    );
  });

  it("drops characters no filesystem accepts and caps the length", () => {
    expect(exportFilename('a/b\\c:d*e?f"g<h>i|j', when)).toBe(
      "a b c d e f g h i j_2026-10-16_0905.png",
    );
    expect(exportFilename("x".repeat(200), when)).toBe(
      `${"x".repeat(80)}_2026-10-16_0905.png`,
    );
  });

  it("falls back to a generic name", () => {
    expect(exportFilename("   ", when)).toBe("dashboard_2026-10-16_0905.png");
    expect(exportFilename(undefined, when)).toBe(
      "dashboard_2026-10-16_0905.png",
    );
  });
});

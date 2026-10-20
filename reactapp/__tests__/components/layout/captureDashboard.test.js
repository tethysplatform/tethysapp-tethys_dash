import { snapdom } from "@zumer/snapdom";
import { captureLockedMapLayers } from "components/map/captureLockedLayers";
import {
  captureDashboard,
  captureDashboardCanvas,
  CaptureBusyError,
  CAPTURE_PROBLEM,
  CaptureTimeoutError,
  IMAGE_FETCH_TIMEOUT,
  RENDER_TIMEOUT,
  CAPTURING_CLASS,
  clampDensity,
  createCaptureSession,
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
  const context = { drawImage: jest.fn() };
  return {
    width,
    height,
    context,
    getContext: () => context,
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
          ".ol-popup-closer",
          ".map-query-spinner",
          ".linked-cursor-marker",
        ]),
      }),
    );
    expect(snapdom.mock.calls[0][1]).not.toHaveProperty("clip");
    // A clicked feature's attribute table is content, kept while it is open.
    expect(snapdom.mock.calls[0][1].exclude).not.toContain(
      ".ol-overlay-container",
    );
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

  it("covers a fill-viewport tile that reaches past a shorter grid", async () => {
    // The grid's own box ends at 600px; the fixed fill tile spans the content
    // area to the bottom of the window.
    const { tile } = addGrid({ fill: true, top: 56, height: 544 });
    jest
      .spyOn(tile, "getBoundingClientRect")
      .mockReturnValue(rect({ top: 56, width: 1200, height: 744 }));

    await captureDashboardCanvas({ mode: "visible" });

    expect(snapdom.mock.calls[0][1].clip).toEqual({
      x: 0,
      y: 56,
      width: 1200,
      height: 744,
    });
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

  it("lets a caller wait its turn instead, then hands the lock on cleanly", async () => {
    addGrid();
    let finish;
    snapdom.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ toCanvas: async () => capturedCanvas() });
        }),
    );
    let finishWaiter;
    snapdom.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishWaiter = () =>
            resolve({ toCanvas: async () => capturedCanvas() });
        }),
    );

    const first = captureDashboardCanvas();
    const waiter = captureDashboardCanvas({ waitForTurn: true });
    while (!finish) await Promise.resolve();
    expect(snapdom).toHaveBeenCalledTimes(1);

    finish();
    await first;
    while (!finishWaiter) await Promise.resolve();
    // The waiter now holds the lock: the first capture's ending did not free it.
    await expect(captureDashboardCanvas()).rejects.toBeInstanceOf(
      CaptureBusyError,
    );

    finishWaiter();
    await expect(waiter).resolves.toBeDefined();
    snapdomReturns();
    await expect(captureDashboardCanvas()).resolves.toBeDefined();
  });

  it("waits out a capture that fails, too", async () => {
    addGrid();
    let fail;
    snapdom.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          fail = () => reject(new Error("snapdom exploded"));
        }),
    );

    const first = captureDashboardCanvas();
    const waiter = captureDashboardCanvas({ waitForTurn: true });
    while (!fail) await Promise.resolve();
    fail();

    await expect(first).rejects.toThrow("snapdom exploded");
    await expect(waiter).resolves.toBeDefined();
  });

  it("gives up on a capture that never finishes and frees the lock", async () => {
    jest.useFakeTimers();
    try {
      addGrid();
      snapdom.mockReturnValue(new Promise(() => {}));

      const pending = captureDashboardCanvas();
      for (let i = 0; i < 10; i += 1) await Promise.resolve();
      jest.advanceTimersByTime(RENDER_TIMEOUT);

      await expect(pending).rejects.toBeInstanceOf(CaptureTimeoutError);
    } finally {
      jest.useRealTimers();
    }
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

/* A map popup as PopupModal renders it: portaled to the page root, with an
   optional grid of its own inside. */
function addPopup({ left = 100, top = 200, width = 400, height = 300 } = {}) {
  const popup = document.createElement("div");
  popup.setAttribute("data-testid", "popup-modal");
  jest
    .spyOn(popup, "getBoundingClientRect")
    .mockReturnValue(rect({ top, left, width, height }));
  const close = document.createElement("button");
  close.setAttribute("data-testid", "popup-modal-close");
  popup.appendChild(close);
  document.body.appendChild(popup);
  return popup;
}

describe("map popup", () => {
  /* The popup is drawn onto a new canvas holding a copy of the grid's - never
     onto snapdom's, whose context keeps snapdom's own density scale. */
  const popupSnapdom = () => {
    const gridCanvas = capturedCanvas();
    const popupCanvas = { width: 800, height: 600 };
    snapdom
      .mockResolvedValueOnce({ toCanvas: async () => gridCanvas })
      .mockResolvedValueOnce({ toCanvas: async () => popupCanvas });
    const composite = { drawImage: jest.fn() };
    jest
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(composite);
    return { gridCanvas, popupCanvas, composite };
  };

  it("draws an open popup onto a whole-tab capture where it sits on screen", async () => {
    addGrid({ top: 56, width: 1200, height: 900 });
    const popup = addPopup({ left: 100, top: 200, width: 400, height: 300 });
    const { gridCanvas, popupCanvas, composite } = popupSnapdom();

    const { canvas } = await captureDashboardCanvas({ mode: "whole" });

    // A new canvas the grid's size, holding the grid's capture first.
    expect(canvas).not.toBe(gridCanvas);
    expect([canvas.width, canvas.height]).toEqual([2400, 1800]);
    expect(composite.drawImage).toHaveBeenNthCalledWith(1, gridCanvas, 0, 0);
    expect(gridCanvas.context.drawImage).not.toHaveBeenCalled();
    // Captured on its own at the same density, without its close button and
    // without a background, so its rounded corners show the dashboard.
    expect(snapdom.mock.calls[1][0]).toBe(popup);
    expect(snapdom.mock.calls[1][1]).toEqual(
      expect.objectContaining({
        dpr: 2,
        exclude: expect.arrayContaining(['[data-testid="popup-modal-close"]']),
      }),
    );
    expect(snapdom.mock.calls[1][1]).not.toHaveProperty("backgroundColor");
    // 2400px of capture over a 1200px grid: two capture pixels per CSS pixel,
    // measured from the grid's corner at (0, 56).
    expect(composite.drawImage).toHaveBeenNthCalledWith(
      2,
      popupCanvas,
      100 * 2,
      (200 - 56) * 2,
      400 * 2,
      300 * 2,
    );
  });

  it("places the popup against the part of a scrolled tab in view", async () => {
    addGrid({ top: -444, width: 1200, height: 3000 });
    window.scrollY = 500;
    addPopup({ left: 100, top: 200 });
    const { popupCanvas, composite } = popupSnapdom();

    await captureDashboardCanvas({ mode: "whole" });

    // The grid starts 444px above the window, so the popup is 644px down it.
    expect(composite.drawImage).toHaveBeenNthCalledWith(
      2,
      popupCanvas,
      200,
      (200 + 444) * 2,
      800,
      600,
    );
  });

  it("draws the popup into a visible-area capture relative to the clip", async () => {
    addGrid({ top: -300, width: 1200, height: 3000 });
    window.scrollY = 356;
    addPopup({ left: 100, top: 200 });
    const { popupCanvas, composite } = popupSnapdom();

    await captureDashboardCanvas({ mode: "visible" });

    // The clip starts at the header's bottom edge, 56px down the window.
    expect(composite.drawImage).toHaveBeenNthCalledWith(
      2,
      popupCanvas,
      200,
      (200 - 56) * 2,
      800,
      600,
    );
  });

  it("captures the dashboard grid, not the grid inside the popup", async () => {
    const popup = addPopup();
    const inner = document.createElement("div");
    inner.className = "react-grid-layout";
    jest
      .spyOn(inner, "getBoundingClientRect")
      .mockReturnValue(rect({ width: 400, height: 300 }));
    popup.appendChild(inner);
    document.body.prepend(popup);
    const { grid } = addGrid();
    popupSnapdom();

    await captureDashboardCanvas();

    expect(snapdom.mock.calls[0][0]).toBe(grid);
  });

  it("leaves the popup out when asked to", async () => {
    addGrid();
    addPopup();

    await captureDashboardCanvas({ includePopup: false });

    expect(snapdom).toHaveBeenCalledTimes(1);
  });

  it("fetches the popup's cross-origin images through the proxy and names it in problems", async () => {
    addGrid();
    const popup = addPopup();
    const image = addImage(popup, "https://elsewhere.test/inside.png");
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      headers: { get: () => "text/plain" },
    });
    popupSnapdom();

    const { problems } = await captureDashboardCanvas({
      dashboardUuid: DASHBOARD,
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(image.getAttribute("src")).toBe("https://elsewhere.test/inside.png");
    expect(problems).toEqual([
      { tile: "Map popup", kind: CAPTURE_PROBLEM.image },
    ]);
    // The popup's maps get the locked-layer pass too.
    expect(captureLockedMapLayers).toHaveBeenCalledWith(
      popup,
      expect.anything(),
      expect.any(Function),
      undefined,
    );
  });

  it("keeps the dashboard image when the popup cannot be drawn", async () => {
    addGrid();
    addPopup();
    const gridCanvas = capturedCanvas();
    snapdom
      .mockResolvedValueOnce({ toCanvas: async () => gridCanvas })
      .mockRejectedValueOnce(new Error("popup exploded"));

    const { canvas, problems } = await captureDashboardCanvas();

    expect(canvas).toBe(gridCanvas);
    expect(problems).toEqual([
      { tile: "Map popup", kind: CAPTURE_PROBLEM.popup },
    ]);
  });

  it("draws every open popup, in page order, and reports only the one that fails", async () => {
    addGrid({ top: 56 });
    const first = addPopup({ left: 100, top: 200 });
    addPopup({ left: 300, top: 100 });
    const third = addPopup({ left: 600, top: 400 });
    const gridCanvas = capturedCanvas();
    const firstCanvas = { width: 800, height: 600 };
    const thirdCanvas = { width: 800, height: 600 };
    snapdom
      .mockResolvedValueOnce({ toCanvas: async () => gridCanvas })
      .mockResolvedValueOnce({ toCanvas: async () => firstCanvas })
      .mockRejectedValueOnce(new Error("second exploded"))
      .mockResolvedValueOnce({ toCanvas: async () => thirdCanvas });
    const composite = { drawImage: jest.fn() };
    jest
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(composite);

    const { problems } = await captureDashboardCanvas();

    expect(snapdom.mock.calls[1][0]).toBe(first);
    expect(snapdom.mock.calls[3][0]).toBe(third);
    expect(composite.drawImage.mock.calls).toEqual([
      [gridCanvas, 0, 0],
      [firstCanvas, 200, (200 - 56) * 2, 800, 600],
      [thirdCanvas, 1200, (400 - 56) * 2, 800, 600],
    ]);
    expect(problems).toEqual([
      { tile: "Map popup", kind: CAPTURE_PROBLEM.popup },
    ]);
  });

  it("leaves out a popup closed while the capture ran", async () => {
    addGrid();
    const popup = addPopup();
    const gridCanvas = capturedCanvas();
    snapdom.mockImplementationOnce(async () => {
      popup.remove();
      return { toCanvas: async () => gridCanvas };
    });

    const { canvas, problems } = await captureDashboardCanvas();

    expect(snapdom).toHaveBeenCalledTimes(1);
    expect(canvas).toBe(gridCanvas);
    expect(problems).toEqual([]);
  });

  it.each(["whole", "visible"])(
    "places the popup as the page stood at the click, in %s mode, when it scrolls during the capture",
    async (mode) => {
      const { grid } = addGrid({ top: -444, width: 1200, height: 3000 });
      window.scrollY = 500;
      addPopup({ left: 100, top: 200 });
      const { popupCanvas, composite } = popupSnapdom();
      // The page scrolls 300px further once the capture is under way; the
      // popup is fixed to the window and stays put.
      captureLockedMapLayers.mockImplementation(async () => {
        window.scrollY = 800;
        grid.getBoundingClientRect.mockReturnValue(
          rect({ top: -744, width: 1200, height: 3000 }),
        );
        return [];
      });

      await captureDashboardCanvas({ mode });

      // Whole: 644px down the grid, as at the click. Visible: 144px down the
      // clip, which starts below the header.
      const top = mode === "whole" ? 200 + 444 : 200 - 56;
      expect(composite.drawImage).toHaveBeenNthCalledWith(
        2,
        popupCanvas,
        200,
        top * 2,
        800,
        600,
      );
    },
  );

  it("pins each table to its on-screen width only while the capture runs", async () => {
    const { tile } = addGrid();
    const table = document.createElement("table");
    table.style.width = "100%";
    jest
      .spyOn(table, "getBoundingClientRect")
      .mockReturnValue(rect({ width: 320, height: 200 }));
    tile.appendChild(table);
    const popup = addPopup();
    const popupTable = document.createElement("table");
    jest
      .spyOn(popupTable, "getBoundingClientRect")
      .mockReturnValue(rect({ width: 280, height: 100 }));
    popup.appendChild(popupTable);
    let during;
    snapdom.mockImplementation(async () => {
      during ??= [
        table.style.width,
        table.style.maxWidth,
        popupTable.style.width,
      ];
      return { toCanvas: async () => capturedCanvas() };
    });

    await captureDashboardCanvas();

    expect(during).toEqual(["320px", "320px", "280px"]);
    expect(table.style.width).toBe("100%");
    expect(table.style.maxWidth).toBe("");
    expect(popupTable.style.width).toBe("");
  });

  it("hides scrollbars in captured content only while the capture runs", async () => {
    addGrid();
    let styleDuring;
    snapdom.mockImplementation(async () => {
      styleDuring = document.querySelector(
        "style[data-capture-style]",
      )?.textContent;
      return { toCanvas: async () => capturedCanvas() };
    });

    await captureDashboardCanvas();

    expect(styleDuring).toContain("scrollbar-width: none");
    expect(styleDuring).toContain(`.${CAPTURING_CLASS}`);
    expect(document.querySelector("style[data-capture-style]")).toBeNull();
  });

  it("marks the popup as capturing only while the capture runs", async () => {
    addGrid();
    const popup = addPopup();
    let classDuringCapture;
    snapdom.mockImplementation(async () => {
      classDuringCapture = popup.classList.contains(CAPTURING_CLASS);
      return { toCanvas: async () => capturedCanvas() };
    });

    await captureDashboardCanvas();

    expect(classDuringCapture).toBe(true);
    expect(popup.classList.contains(CAPTURING_CLASS)).toBe(false);
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
      expect.objectContaining({ credentials: "include" }),
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

  it("fetches and checks maps only for what is on screen in visible mode", async () => {
    const { tile } = addGrid({ top: -300, height: 3000 });
    window.scrollY = 356;
    const onScreen = addImage(tile, "https://elsewhere.test/on.png");
    onScreen.getBoundingClientRect.mockReturnValue(
      rect({ top: 300, width: 100, height: 100 }),
    );
    // Wholly under the header, and wholly below the window.
    const underHeader = addImage(tile, "https://elsewhere.test/under.png");
    underHeader.getBoundingClientRect.mockReturnValue(
      rect({ top: -50, width: 100, height: 100 }),
    );
    const below = addImage(tile, "https://elsewhere.test/below.png");
    below.getBoundingClientRect.mockReturnValue(
      rect({ top: 1500, width: 100, height: 100 }),
    );
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      headers: { get: () => "text/plain" },
    });

    const { problems } = await captureDashboardCanvas({ mode: "visible" });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toContain(
      encodeURIComponent("https://elsewhere.test/on.png"),
    );
    expect(problems).toEqual([{ tile: "Image", kind: CAPTURE_PROBLEM.image }]);

    // The map pass gets the same test of what is on screen.
    const include = captureLockedMapLayers.mock.calls[0][3];
    expect(include(onScreen)).toBe(true);
    expect(include(below)).toBe(false);
  });

  it("prepares the whole grid in whole mode", async () => {
    const { tile } = addGrid({ top: -300, height: 3000 });
    window.scrollY = 356;
    addImage(
      tile,
      "https://elsewhere.test/below.png",
    ).getBoundingClientRect.mockReturnValue(
      rect({ top: 1500, width: 100, height: 100 }),
    );
    global.fetch = jest.fn().mockResolvedValue(imageResponse());

    await captureDashboardCanvas({ mode: "whole" });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(captureLockedMapLayers.mock.calls[0][3]).toBeUndefined();
  });

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

  it("keeps a src React changed while the capture ran", async () => {
    const { tile } = addGrid();
    const image = addImage(tile, "https://elsewhere.test/a.png");
    global.fetch = jest.fn().mockResolvedValue(imageResponse());
    snapdom.mockImplementation(async () => {
      image.setAttribute("src", "https://elsewhere.test/b.png");
      return { toCanvas: async () => capturedCanvas() };
    });

    await captureDashboardCanvas();

    expect(image.getAttribute("src")).toBe("https://elsewhere.test/b.png");
  });

  it("gives up on an image fetch that never answers", async () => {
    jest.useFakeTimers();
    try {
      const { tile } = addGrid({ label: "Logo" });
      addImage(tile, "https://elsewhere.test/slow.png");
      global.fetch = jest.fn(
        (url, { signal }) =>
          new Promise((resolve, reject) =>
            signal.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError")),
            ),
          ),
      );

      const pending = captureDashboardCanvas();
      for (let i = 0; i < 10; i += 1) await Promise.resolve();
      jest.advanceTimersByTime(IMAGE_FETCH_TIMEOUT);

      await expect(pending).resolves.toEqual(
        expect.objectContaining({
          problems: [{ tile: "Logo", kind: CAPTURE_PROBLEM.image }],
        }),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it("sets a responsive image's srcset, and its picture's, aside while the capture runs", async () => {
    const { tile } = addGrid();
    const picture = document.createElement("picture");
    const source = document.createElement("source");
    source.setAttribute("srcset", "https://elsewhere.test/wide.webp 2x");
    picture.appendChild(source);
    tile.appendChild(picture);
    const image = addImage(picture, "https://elsewhere.test/small.png");
    image.setAttribute("srcset", "https://elsewhere.test/large.png 2x");
    global.fetch = jest.fn().mockResolvedValue(imageResponse());
    let during;
    snapdom.mockImplementation(async () => {
      during = [image.getAttribute("srcset"), source.getAttribute("srcset")];
      return { toCanvas: async () => capturedCanvas() };
    });

    await captureDashboardCanvas();

    expect(during).toEqual([null, null]);
    expect(image.getAttribute("srcset")).toBe(
      "https://elsewhere.test/large.png 2x",
    );
    expect(source.getAttribute("srcset")).toBe(
      "https://elsewhere.test/wide.webp 2x",
    );
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

  it("halves the capture when encoding throws rather than returning nothing", async () => {
    addGrid();
    const canvas = capturedCanvas();
    canvas.toBlob = () => {
      throw new DOMException("too large", "SecurityError");
    };
    snapdomReturns(canvas);
    jest
      .spyOn(HTMLCanvasElement.prototype, "toBlob")
      .mockImplementation((done) => done(new Blob(["png"])));

    const result = await captureDashboard();

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

describe("edges of the page", () => {
  it("skips a grid that has no size for the next one", async () => {
    const hidden = document.createElement("div");
    hidden.className = "react-grid-layout";
    jest
      .spyOn(hidden, "getBoundingClientRect")
      .mockReturnValue(rect({ width: 0, height: 0 }));
    document.body.appendChild(hidden);
    const { grid } = addGrid();

    await captureDashboardCanvas();

    expect(snapdom.mock.calls[0][0]).toBe(grid);
  });

  it("measures from the top of the window when no header height is declared", async () => {
    document.documentElement.style.removeProperty("--ts-header-height");
    addGrid({ top: 0, height: 600 });

    await captureDashboardCanvas({ mode: "visible" });

    expect(snapdom.mock.calls[0][1].clip).toEqual(
      expect.objectContaining({ y: 0, height: 600 }),
    );
  });

  it("ignores a popup that has no size", async () => {
    addGrid();
    addPopup({ width: 0, height: 0 });

    await captureDashboardCanvas();

    expect(snapdom).toHaveBeenCalledTimes(1);
  });

  it("leaves a table with no size unpinned", async () => {
    const { tile } = addGrid();
    const table = document.createElement("table");
    tile.appendChild(table);
    let during;
    snapdom.mockImplementation(async () => {
      during = table.style.width;
      return { toCanvas: async () => capturedCanvas() };
    });

    await captureDashboardCanvas();

    expect(during).toBe("");
  });

  it("labels a problem outside any tile or popup generically", async () => {
    const { grid } = addGrid();
    const loose = document.createElement("div");
    grid.appendChild(loose);
    captureLockedMapLayers.mockResolvedValue([loose]);

    const { problems } = await captureDashboardCanvas();

    expect(problems).toEqual([
      { tile: "A tile", kind: CAPTURE_PROBLEM.mapLayer },
    ]);
  });

  it("reports an image whose fetched bytes cannot be read", async () => {
    const { tile } = addGrid({ label: "Logo" });
    const image = addImage(tile, "https://elsewhere.test/logo.png");
    global.fetch = jest.fn().mockResolvedValue(imageResponse());
    const RealFileReader = global.FileReader;
    global.FileReader = class {
      readAsDataURL() {
        this.onerror(new Error("unreadable"));
      }
    };
    try {
      const { problems } = await captureDashboardCanvas();
      expect(problems).toEqual([{ tile: "Logo", kind: CAPTURE_PROBLEM.image }]);
      expect(image.getAttribute("src")).toBe("https://elsewhere.test/logo.png");
    } finally {
      global.FileReader = RealFileReader;
    }
  });
});

describe("createCaptureSession", () => {
  it("undoes in reverse and carries on past an undo that throws", () => {
    const order = [];
    const session = createCaptureSession();
    session.record(() => order.push("first"));
    session.record(() => {
      throw new Error("could not undo");
    });
    session.record(() => order.push("last"));

    session.teardown();
    session.teardown();

    expect(order).toEqual(["last", "first"]);
    expect(console.warn).toHaveBeenCalledWith(
      "Capture: could not undo a change:",
      expect.any(Error),
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

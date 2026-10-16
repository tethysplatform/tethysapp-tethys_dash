import { snapdom } from "@zumer/snapdom";
import { getTethysAppRoot } from "services/utilities";
import { captureLockedMapLayers } from "components/map/captureLockedLayers";

/* Interactive chrome that must not land in a capture. Everything portaled to
   the page root - modals, dropdown menus, the layout alerts - is already outside
   the grid this captures, so only what renders inside a tile is listed. */
export const CAPTURE_EXCLUDED_SELECTORS = [
  // Tile chrome: the edit menu, the fill-viewport badge and the attribution icon.
  ".dashboard-item-menu",
  '[aria-label="fill-viewport-indicator"]',
  '[aria-label="attribution-info-icon"]',
  ".react-resizable-handle",
  // Plotly's hover toolbar and the subplot toggle.
  ".modebar-container",
  '[data-testid="subplot-toggle-control"]',
  // On-map controls. The legend itself stays; its show button and the layer
  // switcher do not. Overlays are the feature popup, the query spinner and the
  // linked cursor - all transient.
  '[aria-label="Show Legend Control"]',
  '[aria-label="Show Layers Control"]',
  '[aria-label="Layers Control"]',
  '[aria-label="Map Alerts"]',
  ".ol-overlay-container",
];

// Set on the grid for the length of a capture, so tile styling can drop the
// editing border and fill (see DashboardItem).
export const CAPTURING_CLASS = "td-capturing";

/* Browsers cap a canvas by side and by area, and fail by handing back nothing
   rather than throwing. Safari's area limit is the tightest. */
const MAX_CANVAS_SIDE = 16384;
const MAX_CANVAS_AREA = 16777216;

/* A fetch or a capture that never settles would hold the one-capture lock, and
   every later export and thumbnail would be refused until the page reloads. The
   proxy gives up on its own upstream after 10 s. */
export const IMAGE_FETCH_TIMEOUT = 20000;
export const RENDER_TIMEOUT = 60000;

export class CaptureTimeoutError extends Error {
  constructor() {
    super("The capture took too long.");
    this.name = "CaptureTimeoutError";
  }
}

function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new CaptureTimeoutError()), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

export const CAPTURE_MODE = {
  // The full grid, including tiles scrolled out of view.
  whole: "whole",
  // Only the part of the grid on screen.
  visible: "visible",
};

export const CAPTURE_PROBLEM = {
  image: "image",
  mapLayer: "mapLayer",
};

export class CaptureBusyError extends Error {
  constructor() {
    super("Another capture is already running.");
    this.name = "CaptureBusyError";
  }
}

export class NothingToCaptureError extends Error {
  constructor() {
    super("There is nothing on this tab to capture.");
    this.name = "NothingToCaptureError";
  }
}

/** Failures that are a state of the page rather than a fault worth logging. */
export function isExpectedCaptureFailure(error) {
  return (
    error instanceof CaptureBusyError || error instanceof NothingToCaptureError
  );
}

let captureInProgress = false;

export function proxiedImageUrl(url, dashboardUuid) {
  return (
    `${getTethysAppRoot()}images/proxy/?url=${encodeURIComponent(url)}` +
    `&dashboard=${encodeURIComponent(dashboardUuid ?? "")}`
  );
}

function isCrossOrigin(url) {
  if (!url || /^(data|blob):/i.test(url)) return false;
  try {
    return new URL(url, window.location.href).origin !== window.location.origin;
  } catch {
    return false;
  }
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the image"));
    reader.readAsDataURL(blob);
  });
}

export function tileLabelOf(element) {
  return (
    element?.closest?.("[data-tile-label]")?.getAttribute("data-tile-label") ||
    "A tile"
  );
}

/* Hidden image-sequence frames are <img>s too. Fetching each through the proxy
   would spend the caller's request budget, and the clone, on frames that never
   appear in the image. */
function isRendered(element) {
  const style = window.getComputedStyle(element);
  if (style.visibility === "hidden" || style.display === "none") return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/**
 * A record of the temporary changes a capture makes to the live page, undone
 * once, last first, however the capture ends.
 */
export function createCaptureSession() {
  const undo = [];
  return {
    record(restore) {
      undo.push(restore);
    },
    teardown() {
      while (undo.length) {
        const restore = undo.pop();
        try {
          restore();
        } catch (error) {
          console.warn("Capture: could not undo a change:", error);
        }
      }
    },
  };
}

/* One image through the proxy, as a data URL, or null when the proxy refused
   it, throttled the caller, or answered with something that is not an image. */
async function fetchThroughProxy(source, dashboardUuid) {
  const proxied = proxiedImageUrl(source, dashboardUuid);
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), IMAGE_FETCH_TIMEOUT);
  try {
    const response = await fetch(proxied, {
      credentials: "include",
      signal: abort.signal,
    });
    const contentType = response.headers.get("Content-Type") || "";
    if (!response.ok || !contentType.startsWith("image/")) {
      console.warn(
        `Capture: proxy returned ${response.status} ${contentType} for ${source}`,
      );
      return null;
    }
    return await blobToDataUrl(await response.blob());
  } catch (error) {
    console.warn(`Capture: could not fetch ${proxied}:`, error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Swap each rendered cross-origin <img> under root for an inline copy fetched
 * through the proxy, once per distinct URL. An image the proxy refuses is left
 * as it is. Returns the problems.
 */
export async function inlineCrossOriginImages(root, dashboardUuid, session) {
  const images = Array.from(root.querySelectorAll("img")).filter(
    (image) =>
      isCrossOrigin(image.currentSrc || image.src) && isRendered(image),
  );

  // A repeated logo costs one request against the caller's budget, not one each.
  const fetches = new Map();
  const problems = [];
  await Promise.all(
    images.map(async (image) => {
      const source = image.currentSrc || image.src;
      if (!fetches.has(source)) {
        fetches.set(source, fetchThroughProxy(source, dashboardUuid));
      }
      const dataUrl = await fetches.get(source);
      if (!dataUrl) {
        problems.push({
          tile: tileLabelOf(image),
          kind: CAPTURE_PROBLEM.image,
        });
        return;
      }

      const original = image.getAttribute("src");
      image.setAttribute("src", dataUrl);
      session.record(() => {
        // React may have pointed the image somewhere new mid-capture; that wins.
        if (image.getAttribute("src") !== dataUrl) return;
        if (original === null) image.removeAttribute("src");
        else image.setAttribute("src", original);
      });
    }),
  );
  return problems;
}

export function getHeaderHeight() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(
    "--ts-header-height",
  );
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getActiveGrid() {
  const grids = document.querySelectorAll(".react-grid-layout");
  for (const grid of grids) {
    const rect = grid.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return grid;
  }
  return null;
}

/**
 * The density to rasterize at: the one asked for, reduced until the canvas fits
 * the browser's limits.
 */
export function clampDensity(width, height, requested) {
  if (!(width > 0 && height > 0)) return { dpr: requested, reduced: false };
  const dpr = Math.min(
    requested,
    MAX_CANVAS_SIDE / width,
    MAX_CANVAS_SIDE / height,
    Math.sqrt(MAX_CANVAS_AREA / (width * height)),
  );
  return { dpr, reduced: dpr < requested };
}

/* The part of the grid on screen below the fixed header, in the page
   coordinates snapdom's clip takes. A fill-viewport item is position:fixed at
   that area, so whole-tab mode captures it the same way. */
function visibleClip(grid) {
  const rect = grid.getBoundingClientRect();
  const top = Math.max(rect.top, getHeaderHeight());
  const bottom = Math.min(rect.bottom, window.innerHeight);
  const left = Math.max(rect.left, 0);
  const right = Math.min(rect.right, window.innerWidth);
  if (bottom <= top || right <= left) return null;
  return {
    x: left + window.scrollX,
    y: top + window.scrollY,
    width: right - left,
    height: bottom - top,
  };
}

/**
 * Capture the active tab's grid to a canvas.
 *
 * mode "whole" captures the full grid, including tiles scrolled out of view;
 * "visible" captures only the part on screen. Returns the canvas, the problems
 * found along the way and whether the density had to be reduced. Throws
 * CaptureBusyError while another capture runs, and NothingToCaptureError when
 * there is no laid-out grid with tiles in it.
 */
export async function captureDashboardCanvas({
  mode = CAPTURE_MODE.whole,
  dpr = 2,
  dashboardUuid,
} = {}) {
  if (captureInProgress) throw new CaptureBusyError();

  const grid = getActiveGrid();
  if (!grid || !grid.querySelector("[data-tile-label]")) {
    throw new NothingToCaptureError();
  }

  captureInProgress = true;
  const session = createCaptureSession();

  try {
    const clipToScreen =
      mode === CAPTURE_MODE.visible ||
      !!grid.querySelector('[data-fill-viewport="true"]');
    const clip = clipToScreen ? visibleClip(grid) : null;
    if (clipToScreen && !clip) throw new NothingToCaptureError();

    const size = clip ?? grid.getBoundingClientRect();
    const density = clampDensity(size.width, size.height, dpr);

    // Independent: map layer canvases and <img> elements. A layer's stand-in is
    // a data URL, so the image pass never picks it up.
    const [incompleteMaps, imageProblems] = await Promise.all([
      captureLockedMapLayers(grid, session, (url) =>
        proxiedImageUrl(url, dashboardUuid),
      ),
      inlineCrossOriginImages(grid, dashboardUuid, session),
    ]);
    const problems = [
      ...incompleteMaps.map((element) => ({
        tile: tileLabelOf(element),
        kind: CAPTURE_PROBLEM.mapLayer,
      })),
      ...imageProblems,
    ];

    grid.classList.add(CAPTURING_CLASS);
    session.record(() => grid.classList.remove(CAPTURING_CLASS));

    const canvas = await withTimeout(
      snapdom(grid, {
        ...(clip ? { clip } : {}),
        dpr: density.dpr,
        exclude: CAPTURE_EXCLUDED_SELECTORS,
        excludeMode: "remove",
        backgroundColor: "#ffffff",
        embedFonts: false,
        // Safe to read back: everything in it came from snapdom's own inlined SVG.
      }).then((result) => result.toCanvas()),
      RENDER_TIMEOUT,
    );
    return {
      canvas,
      problems,
      dpr: density.dpr,
      downscaled: density.reduced,
    };
  } finally {
    session.teardown();
    captureInProgress = false;
  }
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => {
    try {
      canvas.toBlob(resolve, "image/png");
    } catch {
      resolve(null);
    }
  });
}

function halved(canvas) {
  const smaller = document.createElement("canvas");
  smaller.width = Math.max(1, Math.round(canvas.width / 2));
  smaller.height = Math.max(1, Math.round(canvas.height / 2));
  smaller
    .getContext("2d")
    .drawImage(canvas, 0, 0, smaller.width, smaller.height);
  return smaller;
}

/**
 * Capture the active tab as a PNG blob for export. A canvas the browser could
 * not encode is halved and tried once more - from the capture already taken, so
 * the proxied fetches are not spent twice.
 */
export async function captureDashboard({
  mode = CAPTURE_MODE.whole,
  dashboardUuid,
} = {}) {
  const capture = await captureDashboardCanvas({ mode, dashboardUuid });
  let downscaled = capture.downscaled;
  let blob = await canvasToBlob(capture.canvas);
  if (!blob) {
    downscaled = true;
    blob = await canvasToBlob(halved(capture.canvas));
  }
  if (!blob) throw new Error("The browser could not encode the image.");

  return { blob, problems: dedupeProblems(capture.problems), downscaled };
}

function dedupeProblems(problems) {
  const seen = new Set();
  return problems.filter(({ tile, kind }) => {
    const key = `${kind}:${tile}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const UNSAFE_FILENAME_CHARACTERS = /[/\\:*?"<>|]+/g;
const MAX_FILENAME_STEM = 80;

/** "Dashboard Name_2026-10-16_1432.png", in local time. */
export function exportFilename(dashboardName, now = new Date()) {
  const stem =
    String(dashboardName ?? "")
      .replace(UNSAFE_FILENAME_CHARACTERS, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_FILENAME_STEM)
      .trim() || "dashboard";
  const pad = (value) => String(value).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `${stem}_${date}_${time}.png`;
}

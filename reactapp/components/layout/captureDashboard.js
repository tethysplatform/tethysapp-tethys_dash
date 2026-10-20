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
  // switcher do not. A clicked feature's attribute table stays, without its
  // close button - like the popup modal, it is shown only while open. The query
  // spinner and a linked map's cursor marker are transient and do not.
  '[aria-label="Show Legend Control"]',
  // The collapsed legend's box, which would otherwise stay as an empty square.
  '.legend-control:has([aria-label="Show Legend Control"])',
  '[aria-label="Show Layers Control"]',
  '[aria-label="Layers Control"]',
  '[aria-label="Map Alerts"]',
  ".ol-popup-closer",
  ".map-query-spinner",
  ".linked-cursor-marker",
];

// Set on the grid for the length of a capture, so tile styling can drop the
// editing border and fill (see DashboardItem).
export const CAPTURING_CLASS = "td-capturing";

/* A map's popup modal. It is portaled to the page root, outside the grid, so
   an export captures it on its own and draws it onto the dashboard image where
   it sits on screen. It is only in the page while it is open. */
export const POPUP_SELECTOR = '[data-testid="popup-modal"]';
const POPUP_EXCLUDED_SELECTORS = [
  ...CAPTURE_EXCLUDED_SELECTORS,
  '[data-testid="popup-modal-close"]',
];

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
  popup: "popup",
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

// The capture running now, if any.
let activeCapture = null;

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
    (element?.closest?.(POPUP_SELECTOR) ? "Map popup" : "A tile")
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
 * as it is, and one include(image) turns down is not touched. Returns the
 * problems.
 */
export async function inlineCrossOriginImages(
  root,
  dashboardUuid,
  session,
  include = () => true,
) {
  const images = Array.from(root.querySelectorAll("img")).filter(
    (image) =>
      isCrossOrigin(image.currentSrc || image.src) &&
      isRendered(image) &&
      include(image),
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
      // A responsive image shows its srcset candidate - or a <picture>
      // source's - over src, so those step aside until the capture ends.
      const sources = image.parentElement?.matches("picture")
        ? image.parentElement.querySelectorAll("source[srcset]")
        : [];
      for (const element of [image, ...sources]) {
        const srcset = element.getAttribute("srcset");
        if (srcset === null) continue;
        element.removeAttribute("srcset");
        session.record(() => element.setAttribute("srcset", srcset));
      }
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
    // A popup lays out its own items in a grid of its own.
    if (grid.closest(POPUP_SELECTOR)) continue;
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
   coordinates snapdom's clip takes. An active fill-viewport item is
   position:fixed over the whole content area, reaching past the grid's own box
   when the grid is shorter than the screen, so the area it covers counts too -
   and whole-tab mode captures it the same way. */
function visibleClip(grid) {
  const rects = [grid.getBoundingClientRect()];
  const fill = grid.querySelector('[data-fill-viewport="true"]');
  if (fill) rects.push(fill.getBoundingClientRect());
  const top = Math.max(Math.min(...rects.map((r) => r.top)), getHeaderHeight());
  const bottom = Math.min(
    Math.max(...rects.map((r) => r.bottom)),
    window.innerHeight,
  );
  const left = Math.max(Math.min(...rects.map((r) => r.left)), 0);
  const right = Math.min(
    Math.max(...rects.map((r) => r.right)),
    window.innerWidth,
  );
  if (bottom <= top || right <= left) return null;
  return {
    x: left + window.scrollX,
    y: top + window.scrollY,
    width: right - left,
    height: bottom - top,
  };
}

/* Every open popup, in page order - the order they stack in - with where it
   sits on screen when the capture starts. */
function openPopups() {
  return Array.from(document.querySelectorAll(POPUP_SELECTOR))
    .map((element) => ({ element, rect: element.getBoundingClientRect() }))
    .filter(({ rect }) => rect.width > 0 && rect.height > 0);
}

function overlaps(element, area) {
  const rect = element.getBoundingClientRect();
  return (
    rect.right > area.left &&
    rect.left < area.right &&
    rect.bottom > area.top &&
    rect.top < area.bottom
  );
}

/* Make everything under root readable for the capture: map layers the browser
   will not let it read, and cross-origin images. Independent, so run together;
   a layer's stand-in is a data URL, so the image pass never picks it up.

   Given an area of the viewport, only what overlaps it is prepared: content
   the image leaves out would spend the caller's proxy budget and be warned
   about for nothing. */
async function prepareForCapture(root, dashboardUuid, session, area) {
  const include = area ? (element) => overlaps(element, area) : undefined;
  const [incompleteMaps, imageProblems] = await Promise.all([
    captureLockedMapLayers(
      root,
      session,
      (url) => proxiedImageUrl(url, dashboardUuid),
      include,
    ),
    inlineCrossOriginImages(root, dashboardUuid, session, include),
  ]);
  return [
    ...incompleteMaps.map((element) => ({
      tile: tileLabelOf(element),
      kind: CAPTURE_PROBLEM.mapLayer,
    })),
    ...imageProblems,
  ];
}

function markCapturing(element, session) {
  element.classList.add(CAPTURING_CLASS);
  session.record(() => element.classList.remove(CAPTURING_CLASS));
}

/* Scrollbars in a slide image are noise, and snapdom's copy can overflow its
   box by a pixel where the page does not, growing scrollbars the page never
   showed. Hidden in everything being captured. */
const CAPTURE_STYLE = `.${CAPTURING_CLASS}, .${CAPTURING_CLASS} * { scrollbar-width: none !important; }`;

function addCaptureStyle(session) {
  const style = document.createElement("style");
  style.setAttribute("data-capture-style", "");
  style.textContent = CAPTURE_STYLE;
  document.head.appendChild(style);
  session.record(() => style.remove());
}

/* snapdom leaves table cells at their natural width, so a fixed-layout table
   sized by its container - a map's attribute popup - grows to fit its longest
   value and overflows the box it fits on screen. Each table is pinned to its
   on-screen width for the length of the capture. */
function pinTableWidths(root, session) {
  for (const table of root.querySelectorAll("table")) {
    const { width } = table.getBoundingClientRect();
    if (!(width > 0)) continue;
    const original = {
      width: table.style.width,
      maxWidth: table.style.maxWidth,
    };
    table.style.width = `${width}px`;
    table.style.maxWidth = `${width}px`;
    session.record(() => {
      table.style.width = original.width;
      table.style.maxWidth = original.maxWidth;
    });
  }
}

function rasterize(element, options) {
  return withTimeout(
    snapdom(element, {
      excludeMode: "remove",
      embedFonts: false,
      // snapdom reuses an earlier capture it judges unchanged. Every export is
      // a single deliberate capture, and the page edits made just before it -
      // swapped image sources, pinned tables, the injected style - are not all
      // ones it can observe, so each capture starts fresh.
      invalidate: true,
      ...options,
      // Safe to read back: everything in it came from snapdom's own inlined SVG.
    }).then((result) => result.toCanvas()),
    RENDER_TIMEOUT,
  );
}

/* The dashboard capture with the open popups drawn over it, in stacking order,
   where each sat on screen when the capture started, as a new canvas. origin
   is where the capture's top-left corner was in the viewport then, and scale
   converts CSS pixels to the capture's pixels. Whatever falls outside the
   capture is clipped by the canvas. A popup that cannot be drawn is added to
   problems; the dashboard image is still worth having without it.

   A new canvas rather than drawing onto snapdom's: snapdom leaves its own
   density scale on that canvas's context, so a draw in capture pixels lands at
   twice the offset - off the canvas, silently. */
async function withPopupsDrawn(canvas, popups, origin, scale, dpr, problems) {
  const drawn = [];
  for (const { element, rect } of popups) {
    // Closed while the capture ran: the user no longer has it open.
    if (!element.isConnected) continue;
    try {
      // No background: the popup paints its own, and its rounded corners show
      // the dashboard behind them.
      const popupCanvas = await rasterize(element, {
        dpr,
        exclude: POPUP_EXCLUDED_SELECTORS,
      });
      drawn.push({ rect, popupCanvas });
    } catch (error) {
      console.warn("Capture: could not draw a map popup:", error);
      problems.push({ tile: "Map popup", kind: CAPTURE_PROBLEM.popup });
    }
  }
  if (!drawn.length) return canvas;

  const composite = document.createElement("canvas");
  composite.width = canvas.width;
  composite.height = canvas.height;
  const context = composite.getContext("2d");
  context.drawImage(canvas, 0, 0);
  for (const { rect, popupCanvas } of drawn) {
    context.drawImage(
      popupCanvas,
      (rect.left - origin.left) * scale,
      (rect.top - origin.top) * scale,
      rect.width * scale,
      rect.height * scale,
    );
  }
  return composite;
}

/**
 * Capture the active tab's grid to a canvas.
 *
 * mode "whole" captures the full grid, including tiles scrolled out of view;
 * "visible" captures only the part on screen, and prepares only what is on
 * screen. Each open map popup is drawn on top where it sits on screen, unless
 * includePopup is false. Returns the canvas,
 * the problems found along the way and whether the density had to be reduced.
 * Throws
 * CaptureBusyError while another capture runs - unless waitForTurn, which waits
 * for it instead - and NothingToCaptureError when there is no laid-out grid
 * with tiles in it.
 */
export async function captureDashboardCanvas({
  waitForTurn = false,
  ...options
} = {}) {
  // Waiting suits a caller nobody is watching, like the thumbnail after a save;
  // the export button refuses instead, since its user can see why.
  while (waitForTurn && activeCapture) {
    await activeCapture.catch(() => {});
  }
  if (activeCapture) throw new CaptureBusyError();

  const capture = runCapture(options);
  activeCapture = capture;
  try {
    return await capture;
  } finally {
    // istanbul ignore else -- a waiter resumes a tick after this does, so this
    // is still the active capture; the check keeps a change in that order from
    // freeing a lock the next capture holds.
    if (activeCapture === capture) activeCapture = null;
  }
}

async function runCapture({
  mode = CAPTURE_MODE.whole,
  dpr = 2,
  dashboardUuid,
  includePopup = true,
}) {
  const grid = getActiveGrid();
  if (!grid || !grid.querySelector("[data-tile-label]")) {
    throw new NothingToCaptureError();
  }

  const session = createCaptureSession();

  try {
    const clipToScreen =
      mode === CAPTURE_MODE.visible ||
      !!grid.querySelector('[data-fill-viewport="true"]');
    const clip = clipToScreen ? visibleClip(grid) : null;
    if (clipToScreen && !clip) throw new NothingToCaptureError();

    const gridRect = grid.getBoundingClientRect();
    const size = clip ?? gridRect;
    const density = clampDensity(size.width, size.height, dpr);
    // Measured together, now, so a scroll while the capture runs moves neither
    // the popups nor the corner they are placed against: the capture's top-left
    // corner in the viewport - the clip's, or the grid's, which, scrolled, can
    // be above the window.
    const origin = clip
      ? { left: clip.x - window.scrollX, top: clip.y - window.scrollY }
      : { left: gridRect.left, top: gridRect.top };
    const area = clip && {
      ...origin,
      right: origin.left + clip.width,
      bottom: origin.top + clip.height,
    };
    const popups = includePopup ? openPopups() : [];

    const problems = (
      await Promise.all(
        [grid, ...popups.map(({ element }) => element)].map((root) =>
          prepareForCapture(root, dashboardUuid, session, area),
        ),
      )
    ).flat();

    addCaptureStyle(session);
    for (const root of [grid, ...popups.map(({ element }) => element)]) {
      markCapturing(root, session);
      pinTableWidths(root, session);
    }

    let canvas = await rasterize(grid, {
      ...(clip ? { clip } : {}),
      dpr: density.dpr,
      exclude: CAPTURE_EXCLUDED_SELECTORS,
      backgroundColor: "#ffffff",
    });

    if (popups.length) {
      canvas = await withPopupsDrawn(
        canvas,
        popups,
        origin,
        canvas.width / size.width,
        density.dpr,
        problems,
      );
    }

    return {
      canvas,
      problems,
      dpr: density.dpr,
      downscaled: density.reduced,
    };
  } finally {
    session.teardown();
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

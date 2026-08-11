import { snapdom } from "@zumer/snapdom";

const THUMBNAIL_WIDTH = 640;

/* Fixed-position chrome that must not land in the thumbnail. The alerts in
   particular are raised by the very save that triggers this capture. */
const EXCLUDED_SELECTORS = [
  ".navbar.fixed-top",
  '[data-testid="layout-alerts"]',
];

function getHeaderHeight() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(
    "--ts-header-height",
  );
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getActiveGrid() {
  const grids = document.querySelectorAll(".react-grid-layout");
  for (const grid of grids) {
    const rect = grid.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return grid;
  }
  return null;
}

function cropAndScale(captured, topFraction) {
  const cropTop = Math.min(
    Math.round(captured.height * Math.min(Math.max(topFraction, 0), 1)),
    Math.max(0, captured.height - 1),
  );
  const cropHeight = captured.height - cropTop;
  if (cropHeight <= 0 || captured.width <= 0) return null;

  const width = THUMBNAIL_WIDTH;
  const height = Math.max(1, Math.round((cropHeight / captured.width) * width));

  const output = document.createElement("canvas");
  output.width = width;
  output.height = height;

  const context = output.getContext("2d");
  /* The dashboard background is not necessarily opaque, and a PNG with
     transparent regions reads as a broken thumbnail against the card. */
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(
    captured,
    0,
    cropTop,
    captured.width,
    cropHeight,
    0,
    0,
    width,
    height,
  );

  return output.toDataURL("image/png");
}

function getScrollContainer(element) {
  let node = element?.parentElement;
  while (node && node !== document.body) {
    if (node.scrollHeight > node.clientHeight) return node;
    node = node.parentElement;
  }
  return null;
}

export default async function captureThumbnail() {
  let scroller = null;
  let previousScrollTop = 0;

  try {
    const grid = getActiveGrid();
    if (!grid) return null;

    /* Otherwise the thumbnail reflects wherever the user happened to be
       scrolled when they hit save. */
    scroller = getScrollContainer(grid);
    if (scroller) {
      previousScrollTop = scroller.scrollTop;
      scroller.scrollTop = 0;
    }

    const result = await snapdom(document.body, {
      clip: "viewport",
      exclude: EXCLUDED_SELECTORS,
      excludeMode: "remove",
      backgroundColor: "#ffffff",
      embedFonts: false,
    });

    /* Safe to read back: everything in this canvas came from snapdom's own
       inlined SVG, so nothing in it is cross-origin. */
    const captured = await result.toCanvas();
    if (captured.width <= 0 || captured.height <= 0) return null;

    return cropAndScale(
      captured,
      getHeaderHeight() / (window.innerHeight || captured.height),
    );
  } catch (error) {
    console.error("Dashboard thumbnail capture failed:", error);
    return null;
  } finally {
    if (scroller) scroller.scrollTop = previousScrollTop;
  }
}

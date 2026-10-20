import {
  captureDashboardCanvas,
  CAPTURE_MODE,
  getHeaderHeight,
  isExpectedCaptureFailure,
} from "components/layout/captureDashboard";

const THUMBNAIL_WIDTH = 640;

/* The top of the tab as a visitor first sees it: one screen's height of the
   grid, taken from a capture of the whole grid so it never depends on where the
   author happened to be scrolled. */
function cropAndScale(captured, dpr) {
  const screenHeight = (window.innerHeight || 0) - getHeaderHeight();
  // Canvas pixels are CSS pixels times the density, which a very tall tab pushes
  // below 1. At least one row survives, and a window that reports no height
  // keeps everything.
  const cropHeight =
    screenHeight > 0
      ? Math.max(1, Math.min(captured.height, Math.round(screenHeight * dpr)))
      : captured.height;

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
    0,
    captured.width,
    cropHeight,
    0,
    0,
    width,
    height,
  );

  return output.toDataURL("image/png");
}

/**
 * Capture the active tab for the landing-page card, after any export already
 * running. Returns a PNG data URL, or null when there is nothing to capture or
 * the capture fails - a thumbnail must never cost the save that asked for it.
 */
export default async function captureThumbnail(dashboardUuid) {
  try {
    const { canvas, dpr = 1 } = await captureDashboardCanvas({
      mode: CAPTURE_MODE.whole,
      waitForTurn: true,
      dpr: 1,
      dashboardUuid,
      // A popup open at save time is passing state, not the dashboard.
      includePopup: false,
    });
    if (!canvas || canvas.width <= 0 || canvas.height <= 0) return null;
    return cropAndScale(canvas, dpr);
  } catch (error) {
    if (isExpectedCaptureFailure(error)) return null;
    console.error("Dashboard thumbnail capture failed:", error);
    return null;
  }
}

import {
  captureDashboardCanvas,
  CaptureBusyError,
  getHeaderHeight,
  NothingToCaptureError,
} from "components/layout/captureDashboard";

const THUMBNAIL_WIDTH = 640;

/* The top of the tab as a visitor first sees it: one screen's height of the
   grid, taken from a capture of the whole grid so it never depends on where the
   author happened to be scrolled. */
function cropAndScale(captured) {
  const screenHeight = (window.innerHeight || 0) - getHeaderHeight();
  // The capture is taken at density 1, so canvas pixels are CSS pixels. At least
  // one row survives, and a window that reports no height keeps everything.
  const cropHeight =
    screenHeight > 0
      ? Math.max(1, Math.min(captured.height, Math.round(screenHeight)))
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
 * Capture the active tab for the landing-page card. Returns a PNG data URL, or
 * null when there is nothing to capture, an export is running, or the capture
 * fails - a thumbnail must never cost the save that asked for it.
 */
export default async function captureThumbnail(dashboardUuid) {
  try {
    const { canvas } = await captureDashboardCanvas({
      mode: "whole",
      dpr: 1,
      dashboardUuid,
    });
    if (!canvas || canvas.width <= 0 || canvas.height <= 0) return null;
    return cropAndScale(canvas);
  } catch (error) {
    if (
      error instanceof NothingToCaptureError ||
      error instanceof CaptureBusyError
    ) {
      return null;
    }
    console.error("Dashboard thumbnail capture failed:", error);
    return null;
  }
}

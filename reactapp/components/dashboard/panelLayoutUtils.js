/**
 * panelLayoutUtils.js
 *
 * Generic layout utility for dynamically created dashboard panels.
 * Arranges panels using count-based tiling patterns (monocle, hsplit,
 * two-over-one, grid). Panel-type-specific knowledge (dimensions,
 * priority) is provided by the caller via the event payload — this
 * module has no knowledge of specific plugins or panel types.
 */

const COLS = 100;
const DEFAULT_W = 50;
const DEFAULT_H = 20;

/**
 * Compute layout positions for a batch of new panels.
 *
 * @param {Array<{w?: number, h?: number}>} panels
 *   Each entry may include `w` and `h` hints. Missing values fall back
 *   to DEFAULT_W / DEFAULT_H.
 * @param {Array<{x: number, y: number, w: number, h: number}>} existingGridItems
 *   Current grid items on the dashboard, used to find the floor.
 * @returns {Array<{x: number, y: number, w: number, h: number}>}
 *   Computed positions, one per input panel (same order).
 */
/**
 * Get distinct row start positions sorted bottom-to-top.
 * Each entry: { y, rightEdge } where rightEdge is the max x+w on that row.
 */
function getRowsSorted(existingGridItems) {
  if (existingGridItems.length === 0) return [];

  // Group items by their y (row start)
  const rowMap = new Map();
  for (const item of existingGridItems) {
    const y = item.y || 0;
    const edge = (item.x || 0) + (item.w || 0);
    rowMap.set(y, Math.max(rowMap.get(y) || 0, edge));
  }

  // Sort bottom-to-top (highest y first)
  return Array.from(rowMap.entries())
    .map(([y, rightEdge]) => ({ y, rightEdge }))
    .sort((a, b) => b.y - a.y);
}

export function computePanelLayout(panels, existingGridItems) {
  if (!panels || panels.length === 0) return [];

  // Find the bottom edge of existing content
  const floor = existingGridItems.reduce(
    (max, item) => Math.max(max, (item.y || 0) + (item.h || 0)),
    0,
  );

  // Resolve defaults
  const resolved = panels.map((p) => ({
    w: p.w ?? DEFAULT_W,
    h: p.h ?? DEFAULT_H,
  }));

  const count = resolved.length;

  if (count === 1) {
    const panelW = resolved[0].w;
    const panelH = resolved[0].h;

    // Scan rows bottom-to-top looking for horizontal space
    const rows = getRowsSorted(existingGridItems);
    for (const row of rows) {
      if (row.rightEdge + panelW <= COLS) {
        // Fits next to existing content — use hint width
        return [{ x: row.rightEdge, y: row.y, w: panelW, h: panelH }];
      }
    }

    // No space on any existing row — use full width so no space is wasted
    return [{ x: 0, y: floor, w: COLS, h: panelH }];
  }

  // Pack panels into rows, respecting each panel's w hint.
  // Fills each row left-to-right until the next panel doesn't fit,
  // then starts a new row. Panels alone on their row expand to full width.
  const positions = [];
  let rowY = floor;
  let rowX = 0;
  let rowMaxH = 0;
  let rowStartIdx = 0;

  for (let i = 0; i < count; i++) {
    const panel = resolved[i];

    // If this panel doesn't fit on the current row, wrap to a new row
    if (rowX + panel.w > COLS) {
      // If the previous row had only one panel, expand it to full width
      if (i - rowStartIdx === 1) {
        positions[rowStartIdx].w = COLS;
      }
      rowY += rowMaxH;
      rowX = 0;
      rowMaxH = 0;
      rowStartIdx = i;
    }

    positions.push({ x: rowX, y: rowY, w: panel.w, h: panel.h });
    rowX += panel.w;
    rowMaxH = Math.max(rowMaxH, panel.h);
  }

  // Expand the last panel if it's alone on its row
  if (count - rowStartIdx === 1) {
    positions[positions.length - 1].w = COLS;
  }

  return positions;
}

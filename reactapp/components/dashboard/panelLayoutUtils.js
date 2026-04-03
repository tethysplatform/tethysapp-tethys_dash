/**
 * panelLayoutUtils.js
 *
 * Generic tiling layout utility for dynamically created dashboard panels.
 * Uses a simple slot-based approach: scans the grid for the first available
 * horizontal slot that fits the panel, row by row from top to bottom.
 * Panel-type-specific knowledge (dimensions, priority) is provided by the
 * caller via the event payload — this module has no knowledge of specific
 * plugins or panel types.
 */

const COLS = 100;
const DEFAULT_W = 50;
const DEFAULT_H = 20;

/**
 * Build a list of occupied rectangles from existing grid items.
 */
function getOccupied(items) {
  return items.map((item) => ({
    x: item.x || 0,
    y: item.y || 0,
    w: item.w || 0,
    h: item.h || 0,
  }));
}

/**
 * Check if placing a panel at (x, y) with size (w, h) would overlap
 * any existing occupied rectangle.
 */
function overlaps(x, y, w, h, occupied) {
  for (const rect of occupied) {
    if (
      x < rect.x + rect.w &&
      x + w > rect.x &&
      y < rect.y + rect.h &&
      y + h > rect.y
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Find the first available slot for a panel of size (w, h).
 * Scans row by row (y increments by 1), and for each row scans
 * left to right in steps of `step` columns.
 * Returns { x, y } of the top-left corner of the slot.
 */
function findSlot(w, h, occupied, step = 1) {
  const maxY = occupied.reduce(
    (max, rect) => Math.max(max, rect.y + rect.h),
    0,
  );
  // Scan up to maxY + h to guarantee we find a slot (empty row below all content)
  for (let y = 0; y <= maxY + h; y++) {
    for (let x = 0; x <= COLS - w; x += step) {
      if (!overlaps(x, y, w, h, occupied)) {
        return { x, y };
      }
    }
  }
  // Fallback: place below everything
  return { x: 0, y: maxY };
}

/**
 * Compute layout positions for a batch of new panels.
 *
 * @param {Array<{w?: number, h?: number}>} panels
 *   Each entry may include `w` and `h` hints. Missing values fall back
 *   to DEFAULT_W / DEFAULT_H.
 * @param {Array<{x: number, y: number, w: number, h: number}>} existingGridItems
 *   Current grid items on the dashboard, used to find occupied space.
 * @returns {Array<{x: number, y: number, w: number, h: number}>}
 *   Computed positions, one per input panel (same order).
 */
export function computePanelLayout(panels, existingGridItems) {
  if (!panels || panels.length === 0) return [];

  // Start with all existing items as occupied
  const occupied = getOccupied(existingGridItems);

  // Resolve defaults
  const resolved = panels.map((p) => ({
    w: p.w ?? DEFAULT_W,
    h: p.h ?? DEFAULT_H,
  }));

  const positions = [];

  for (const panel of resolved) {
    // Find the first slot that fits this panel
    const slot = findSlot(panel.w, panel.h, occupied);

    const pos = { x: slot.x, y: slot.y, w: panel.w, h: panel.h };
    positions.push(pos);

    // Mark this slot as occupied so the next panel avoids it
    occupied.push(pos);
  }

  return positions;
}

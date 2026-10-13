import PointerInteraction from "ol/interaction/Pointer";
import { primaryAction } from "ol/events/condition";

// How close, in screen pixels, the pointer must be to an edge or corner of the
// box to grab it for resizing.
export const HIT_TOLERANCE_PX = 8;

// How far, in screen pixels, a draw gesture must travel before it replaces the
// existing box. A Shift+click without movement leaves the box alone.
const DRAW_THRESHOLD_PX = 3;

export function normalizeExtent([x1, y1, x2, y2]) {
  return [
    Math.min(x1, x2),
    Math.min(y1, y2),
    Math.max(x1, x2),
    Math.max(y1, y2),
  ];
}

function hasArea(extent) {
  return !!extent && extent[2] > extent[0] && extent[3] > extent[1];
}

// Classify a map coordinate against the box. Everything is measured in map
// units (tolerance = pixels x resolution), so the test holds on a rotated view.
// Corners win over edges, and edges over the interior, so a box smaller than
// twice the tolerance still resizes from its corners.
export function hitTestExtent(extent, coordinate, tolerance) {
  if (!extent) return { type: "outside" };
  const [minX, minY, maxX, maxY] = extent;
  const [x, y] = coordinate;

  const withinX = x >= minX - tolerance && x <= maxX + tolerance;
  const withinY = y >= minY - tolerance && y <= maxY + tolerance;
  if (!withinX || !withinY) return { type: "outside" };

  const dW = Math.abs(x - minX);
  const dE = Math.abs(x - maxX);
  const dS = Math.abs(y - minY);
  const dN = Math.abs(y - maxY);

  let horizontal = "";
  if (dW <= tolerance || dE <= tolerance) horizontal = dW <= dE ? "w" : "e";
  let vertical = "";
  if (dS <= tolerance || dN <= tolerance) vertical = dN <= dS ? "n" : "s";

  if (horizontal && vertical) {
    return { type: "corner", handle: vertical + horizontal };
  }
  if (horizontal || vertical) {
    return { type: "edge", handle: vertical || horizontal };
  }
  if (x > minX && x < maxX && y > minY && y < maxY) {
    return { type: "interior" };
  }
  return { type: "outside" };
}

export function moveExtent(extent, dx, dy) {
  return [extent[0] + dx, extent[1] + dy, extent[2] + dx, extent[3] + dy];
}

// A box anchored at `anchor` reaching toward `coordinate`. With a ratio
// (width / height), the axis that moved further relative to the ratio drives
// and the other is derived from it.
export function drawExtent(anchor, coordinate, ratio = null) {
  const dx = coordinate[0] - anchor[0];
  const dy = coordinate[1] - anchor[1];
  if (!ratio) {
    return normalizeExtent([
      anchor[0],
      anchor[1],
      coordinate[0],
      coordinate[1],
    ]);
  }
  let width = Math.abs(dx);
  let height = Math.abs(dy);
  if (width / ratio >= height) {
    height = width / ratio;
  } else {
    width = height * ratio;
  }
  const sx = dx < 0 ? -1 : 1;
  const sy = dy < 0 ? -1 : 1;
  return normalizeExtent([
    anchor[0],
    anchor[1],
    anchor[0] + sx * width,
    anchor[1] + sy * height,
  ]);
}

// Resize from a handle ("n", "se", ...). The opposite corner or edge stays
// put. Dragging past the opposite edge normalizes rather than inverting.
export function resizeExtent(extent, handle, coordinate, ratio = null) {
  const [minX, minY, maxX, maxY] = extent;
  const [x, y] = coordinate;
  const isCorner = handle.length === 2;

  if (!ratio) {
    const next = [...extent];
    if (handle.includes("w")) next[0] = x;
    if (handle.includes("e")) next[2] = x;
    if (handle.includes("s")) next[1] = y;
    if (handle.includes("n")) next[3] = y;
    return normalizeExtent(next);
  }

  if (isCorner) {
    const anchor = [
      handle.includes("w") ? maxX : minX,
      handle.includes("s") ? maxY : minY,
    ];
    return drawExtent(anchor, coordinate, ratio);
  }

  // Edge: the dragged axis drives, and the other axis is derived from the
  // ratio and kept centered on the box's current center.
  if (handle === "e" || handle === "w") {
    const anchorX = handle === "e" ? minX : maxX;
    const width = Math.abs(x - anchorX);
    const height = width / ratio;
    const centerY = (minY + maxY) / 2;
    return normalizeExtent([
      anchorX,
      centerY - height / 2,
      x,
      centerY + height / 2,
    ]);
  }
  const anchorY = handle === "n" ? minY : maxY;
  const height = Math.abs(y - anchorY);
  const width = height * ratio;
  const centerX = (minX + maxX) / 2;
  return normalizeExtent([
    centerX - width / 2,
    anchorY,
    centerX + width / 2,
    y,
  ]);
}

// Reshape a box to `ratio` (width / height), keeping its width and center.
export function lockExtentToRatio(extent, ratio) {
  const [minX, minY, maxX, maxY] = extent;
  const height = (maxX - minX) / ratio;
  const centerY = (minY + maxY) / 2;
  return [minX, centerY - height / 2, maxX, centerY + height / 2];
}

export function cursorForHit(hit, { shift = false } = {}) {
  if (shift) return "crosshair";
  switch (hit.type) {
    case "corner":
    case "edge":
      return `${hit.handle}-resize`;
    case "interior":
      return "move";
    case "none":
      return "crosshair";
    default:
      return "grab";
  }
}

/**
 * Pointer interaction that owns a static image's placement box, in view
 * coordinates.
 *
 * A pointerdown inside the box moves it; on an edge or corner it resizes; with
 * Shift held (or with no box yet) it draws a new one. Any other pointerdown is
 * declined so the map's own DragPan pans, and wheel events are never touched,
 * so MouseWheelZoom keeps working. Accepted gestures stop the event, which
 * keeps DragPan and DragZoom (Shift+drag by default) from also starting --
 * that relies on this interaction being added after the map's defaults, so it
 * sees events first.
 */
export default class ImageExtentInteraction extends PointerInteraction {
  constructor({ extent = null, aspectRatio = null, onChange } = {}) {
    super();
    this.extent_ = hasArea(extent) ? normalizeExtent(extent) : null;
    this.aspectRatio_ = aspectRatio;
    this.onChange_ = onChange;
    this.modified_ = false;
    this.gesture_ = null;
    this.lastCoordinate_ = null;
    this.shiftDown_ = false;
    this.cursorTarget_ = null;
    this.originalCursor_ = "";
    this.cursor_ = null;

    this.handleKey_ = (event) => {
      if (event.key !== "Shift") return;
      const shiftDown = event.type === "keydown";
      // A held key repeats keydown; only a change of state moves the cursor.
      if (shiftDown === this.shiftDown_) return;
      this.shiftDown_ = shiftDown;
      this.refreshCursor_();
    };
  }

  getExtent() {
    return this.extent_ ? [...this.extent_] : null;
  }

  // Programmatic placement (e.g. a reprojected saved extent arriving after
  // open). Does not count as an author modification.
  setExtent(extent) {
    this.extent_ = hasArea(extent) ? normalizeExtent(extent) : null;
    this.notify_();
  }

  hasExtent() {
    return !!this.extent_;
  }

  isModified() {
    return this.modified_;
  }

  getAspectRatio() {
    return this.aspectRatio_;
  }

  // Lock to `ratio` (width / height), or unlock with null. Locking reshapes an
  // existing box at once, keeping its width and center; when that changes the
  // box it counts as a modification, so Confirm saves the snapped box.
  setAspectRatio(ratio) {
    this.aspectRatio_ = ratio || null;
    if (this.aspectRatio_ && this.extent_) {
      const locked = lockExtentToRatio(this.extent_, this.aspectRatio_);
      // A box already at the ratio -- one saved under the lock, whose numbers
      // were then rounded -- moves by less than half a pixel. That is not a
      // change, so it must not count as an edit (Confirm would otherwise
      // rewrite the saved extent and projection).
      const height = this.extent_[3] - this.extent_[1];
      const resolution = this.getMap()?.getView().getResolution() ?? 0;
      const epsilon = Math.max(Math.abs(height) * 1e-9, resolution / 2);
      if (locked.some((v, i) => Math.abs(v - this.extent_[i]) > epsilon)) {
        this.modified_ = true;
      }
      this.extent_ = locked;
      this.notify_();
    }
  }

  notify_() {
    this.onChange_?.(this.getExtent());
  }

  hitAt_(coordinate) {
    if (!this.extent_) return { type: "none" };
    const resolution = this.getMap()?.getView().getResolution() ?? 1;
    return hitTestExtent(
      this.extent_,
      coordinate,
      HIT_TOLERANCE_PX * resolution,
    );
  }

  handleDownEvent(mapBrowserEvent) {
    if (!primaryAction(mapBrowserEvent)) return false;

    const shift = !!mapBrowserEvent.originalEvent?.shiftKey;
    const coordinate = mapBrowserEvent.coordinate;
    const base = {
      startCoordinate: coordinate,
      startPixel: mapBrowserEvent.pixel,
      startExtent: this.getExtent(),
    };

    if (shift || !this.extent_) {
      this.gesture_ = { ...base, type: "draw", started: false };
      return true;
    }

    const hit = this.hitAt_(coordinate);
    if (hit.type === "outside") return false;
    if (hit.type === "interior") {
      this.gesture_ = { ...base, type: "move" };
    } else {
      this.gesture_ = { ...base, type: "resize", handle: hit.handle };
    }
    return true;
  }

  handleDragEvent(mapBrowserEvent) {
    const gesture = this.gesture_;
    if (!gesture) return;
    const coordinate = mapBrowserEvent.coordinate;
    this.lastCoordinate_ = coordinate;

    if (gesture.type === "draw") {
      if (!gesture.started) {
        const [px, py] = mapBrowserEvent.pixel;
        const [sx, sy] = gesture.startPixel;
        if (Math.hypot(px - sx, py - sy) < DRAW_THRESHOLD_PX) return;
        gesture.started = true;
      }
      this.extent_ = drawExtent(
        gesture.startCoordinate,
        coordinate,
        this.aspectRatio_,
      );
    } else if (gesture.type === "move") {
      this.extent_ = moveExtent(
        gesture.startExtent,
        coordinate[0] - gesture.startCoordinate[0],
        coordinate[1] - gesture.startCoordinate[1],
      );
    } else {
      this.extent_ = resizeExtent(
        gesture.startExtent,
        gesture.handle,
        coordinate,
        this.aspectRatio_,
      );
    }
    gesture.changed = true;
    this.notify_();
  }

  handleUpEvent() {
    const gesture = this.gesture_;
    this.gesture_ = null;
    if (gesture?.changed) {
      if (hasArea(this.extent_)) {
        this.modified_ = true;
      } else {
        // A gesture that collapsed the box to zero area is undone.
        this.extent_ = gesture.startExtent;
        this.notify_();
      }
    }
    this.refreshCursor_();
    return false;
  }

  handleMoveEvent(mapBrowserEvent) {
    this.lastCoordinate_ = mapBrowserEvent.coordinate;
    this.shiftDown_ = !!mapBrowserEvent.originalEvent?.shiftKey;
    this.refreshCursor_();
  }

  refreshCursor_() {
    if (!this.getMap()) return;
    if (!this.lastCoordinate_ || !this.extent_) {
      this.applyCursor_(
        this.extent_ && !this.shiftDown_ ? "grab" : "crosshair",
      );
      return;
    }
    this.applyCursor_(
      cursorForHit(this.hitAt_(this.lastCoordinate_), {
        shift: this.shiftDown_,
      }),
    );
  }

  applyCursor_(cursor) {
    if (!this.cursorTarget_ || cursor === this.cursor_) return;
    this.cursor_ = cursor;
    this.cursorTarget_.style.cursor = cursor;
  }

  setMap(map) {
    if (this.cursorTarget_) {
      this.cursorTarget_.style.cursor = this.originalCursor_;
      this.cursorTarget_ = null;
      this.cursor_ = null;
    }
    if (typeof document !== "undefined") {
      document.removeEventListener("keydown", this.handleKey_);
      document.removeEventListener("keyup", this.handleKey_);
    }
    super.setMap(map);
    if (map) {
      this.cursorTarget_ = map.getTargetElement?.() ?? null;
      this.originalCursor_ = this.cursorTarget_?.style.cursor ?? "";
      if (typeof document !== "undefined") {
        document.addEventListener("keydown", this.handleKey_);
        document.addEventListener("keyup", this.handleKey_);
      }
      this.refreshCursor_();
    }
  }
}

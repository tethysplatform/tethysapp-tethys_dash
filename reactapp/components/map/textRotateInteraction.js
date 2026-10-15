import PointerInteraction from "ol/interaction/Pointer.js";
import { normalizeRotation } from "components/map/annotations";

// The rotate handle sits this far from the text's point, in the direction the
// text is rotated -- straight up when unrotated. Screen pixels, so it stays
// the same distance away at every zoom.
export const ROTATE_HANDLE_DISTANCE_PX = 28;
// How close a pointerdown must land to the handle to grab it.
const GRAB_TOLERANCE_PX = 8;
// Holding Shift while dragging snaps the angle to this step.
export const ROTATION_SNAP_DEGREES = 15;

/**
 * Where the rotate handle sits for text at `point`, rotated `degrees`
 * clockwise from north, at the given map resolution.
 */
export function rotateHandleCoordinate(point, degrees, resolution) {
  const radians = (degrees * Math.PI) / 180;
  const distance = ROTATE_HANDLE_DISTANCE_PX * resolution;
  return [
    point[0] + distance * Math.sin(radians),
    point[1] + distance * Math.cos(radians),
  ];
}

/**
 * The clockwise-from-north angle, in whole degrees, of the pointer as seen
 * from the text's point -- snapped to `ROTATION_SNAP_DEGREES` when asked.
 */
export function rotationFromPointer(point, pointer, snap) {
  const degrees =
    (Math.atan2(pointer[0] - point[0], pointer[1] - point[1]) * 180) / Math.PI;
  const step = snap ? ROTATION_SNAP_DEGREES : 1;
  return normalizeRotation(Math.round(degrees / step) * step);
}

/**
 * Drags the rotate handle of the selected text annotation.
 *
 * Added after the editor's Translate and Modify so it sees a pointerdown
 * first: a grab on the handle rotates instead of moving the text, and any
 * other pointerdown is declined and left to them (or to panning).
 */
export default class TextRotateInteraction extends PointerInteraction {
  /**
   * @param {object} options
   * @param {() => (import("ol/Feature").default|null)} options.getSelectedText
   *   the selected text feature, or null when no text is selected
   * @param {(feature) => number} options.getRotation its current rotation
   * @param {(feature, degrees: number) => void} options.onRotate
   */
  constructor({ getSelectedText, getRotation, onRotate }) {
    super();
    this.getSelectedText_ = getSelectedText;
    this.getRotation_ = getRotation;
    this.onRotate_ = onRotate;
    this.feature_ = null;
  }

  handleDownEvent(event) {
    const feature = this.getSelectedText_();
    if (!feature) return false;
    const map = event.map;
    const point = feature.getGeometry().getCoordinates();
    const handle = rotateHandleCoordinate(
      point,
      this.getRotation_(feature),
      map.getView().getResolution(),
    );
    const [hx, hy] = map.getPixelFromCoordinate(handle);
    const [px, py] = event.pixel;
    if (Math.hypot(hx - px, hy - py) > GRAB_TOLERANCE_PX) return false;
    this.feature_ = feature;
    return true;
  }

  handleDragEvent(event) {
    const point = this.feature_.getGeometry().getCoordinates();
    this.onRotate_(
      this.feature_,
      rotationFromPointer(
        point,
        event.coordinate,
        event.originalEvent.shiftKey,
      ),
    );
  }

  handleUpEvent() {
    this.feature_ = null;
    return false;
  }
}

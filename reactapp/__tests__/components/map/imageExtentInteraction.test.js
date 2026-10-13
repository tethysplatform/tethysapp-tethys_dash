import Map from "ol/Map";
import View from "ol/View";
import DragPan from "ol/interaction/DragPan";
import DragZoom from "ol/interaction/DragZoom";
import ImageExtentInteraction, {
  HIT_TOLERANCE_PX,
  cursorForHit,
  drawExtent,
  hitTestExtent,
  lockExtentToRatio,
  moveExtent,
  normalizeExtent,
  resizeExtent,
} from "components/map/imageExtentInteraction";

const BOX = [0, 0, 100, 100];

// ol/Map observes its target's size; jsdom has no ResizeObserver.
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterAll(() => {
  delete global.ResizeObserver;
});

describe("box geometry", () => {
  test("normalizeExtent orders min and max", () => {
    expect(normalizeExtent([10, 20, 0, 5])).toEqual([0, 5, 10, 20]);
  });

  test("hitTestExtent classifies corners, edges, interior and outside", () => {
    expect(hitTestExtent(BOX, [2, 98], 5)).toEqual({
      type: "corner",
      handle: "nw",
    });
    expect(hitTestExtent(BOX, [99, 1], 5)).toEqual({
      type: "corner",
      handle: "se",
    });
    expect(hitTestExtent(BOX, [100, 50], 5)).toEqual({
      type: "edge",
      handle: "e",
    });
    expect(hitTestExtent(BOX, [50, 3], 5)).toEqual({
      type: "edge",
      handle: "s",
    });
    expect(hitTestExtent(BOX, [50, 50], 5)).toEqual({ type: "interior" });
    expect(hitTestExtent(BOX, [200, 50], 5)).toEqual({ type: "outside" });
    expect(hitTestExtent(null, [50, 50], 5)).toEqual({ type: "outside" });
  });

  test("a box smaller than the tolerance resolves to a corner", () => {
    expect(hitTestExtent([0, 0, 4, 4], [2, 2], 5).type).toBe("corner");
  });

  test("moveExtent shifts every bound without resizing", () => {
    expect(moveExtent(BOX, 10, -5)).toEqual([10, -5, 110, 95]);
  });

  test("resizeExtent from an edge changes only that bound", () => {
    expect(resizeExtent(BOX, "e", [150, 999])).toEqual([0, 0, 150, 100]);
  });

  test("resizeExtent from a corner moves both bounds of that corner", () => {
    expect(resizeExtent(BOX, "sw", [-10, -20])).toEqual([-10, -20, 100, 100]);
  });

  test("resizing past the opposite edge normalizes", () => {
    expect(resizeExtent(BOX, "e", [-50, 0])).toEqual([-50, 0, 0, 100]);
  });

  test("drawExtent normalizes the anchor and current point", () => {
    expect(drawExtent([10, 10], [0, 30])).toEqual([0, 10, 10, 30]);
  });

  test("lockExtentToRatio keeps width and center", () => {
    // 2:1 image on a square box: height halves around the center.
    expect(lockExtentToRatio(BOX, 2)).toEqual([0, 25, 100, 75]);
  });

  test("a locked corner resize keeps the ratio and the opposite corner", () => {
    const next = resizeExtent([0, 0, 200, 100], "ne", [300, 120], 2);
    expect(next[0]).toBe(0);
    expect(next[1]).toBe(0);
    expect((next[2] - next[0]) / (next[3] - next[1])).toBeCloseTo(2);
    expect(next[2]).toBe(300);
  });

  test("a locked edge resize keeps the ratio with the height centered", () => {
    expect(resizeExtent([0, 0, 200, 100], "e", [400, 0], 2)).toEqual([
      0, -50, 400, 150,
    ]);
  });

  test("a locked north edge resize keeps the ratio with the width centered", () => {
    expect(resizeExtent([0, 0, 200, 100], "n", [0, 200], 2)).toEqual([
      -100, 0, 300, 200,
    ]);
  });

  test("an unlocked north edge resize changes only the top", () => {
    expect(resizeExtent(BOX, "n", [999, 150])).toEqual([0, 0, 100, 150]);
  });

  test("a locked resize from the south-west corner anchors the north-east", () => {
    expect(resizeExtent([0, 0, 200, 100], "sw", [-100, -100], 2)).toEqual([
      -200, -100, 200, 100,
    ]);
  });

  test("a locked west edge resize anchors the east edge", () => {
    expect(resizeExtent([0, 0, 200, 100], "w", [-200, 0], 2)).toEqual([
      -200, -50, 200, 150,
    ]);
  });

  test("a locked south edge resize anchors the north edge", () => {
    expect(resizeExtent([0, 0, 200, 100], "s", [0, -100], 2)).toEqual([
      -100, -100, 300, 100,
    ]);
  });

  test("a locked draw downward extends below the anchor", () => {
    expect(drawExtent([0, 0], [100, -10], 2)).toEqual([0, -50, 100, 0]);
  });

  test("a locked draw driven by the taller axis derives the width", () => {
    expect(drawExtent([0, 0], [10, 100], 2)).toEqual([0, 0, 200, 100]);
  });

  test("a locked draw holds the ratio from the anchor", () => {
    const next = drawExtent([0, 0], [-100, 10], 2);
    expect(next).toEqual([-100, 0, 0, 50]);
  });

  test("cursorForHit maps hits to cursors", () => {
    expect(cursorForHit({ type: "corner", handle: "nw" })).toBe("nw-resize");
    expect(cursorForHit({ type: "edge", handle: "e" })).toBe("e-resize");
    expect(cursorForHit({ type: "interior" })).toBe("move");
    expect(cursorForHit({ type: "outside" })).toBe("grab");
    expect(cursorForHit({ type: "interior" }, { shift: true })).toBe(
      "crosshair",
    );
  });
});

// A MapBrowserEvent-shaped object. Resolution is 1, so pixels and map units
// coincide and the hit tolerance is HIT_TOLERANCE_PX map units.
function mapEvent(map, type, coordinate, { shiftKey = false, target } = {}) {
  return {
    type,
    map,
    coordinate,
    pixel: coordinate,
    originalEvent: {
      type,
      isPrimary: true,
      button: 0,
      shiftKey,
      target,
      preventDefault: jest.fn(),
    },
  };
}

function makeMap() {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const map = new Map({
    target,
    view: new View({ center: [0, 0], resolution: 1 }),
  });
  return { map, target };
}

describe("ImageExtentInteraction routing", () => {
  let map;
  let target;

  beforeEach(() => {
    ({ map, target } = makeMap());
  });

  afterEach(() => {
    map.setTarget(null);
    target.remove();
  });

  function gesture(interaction, from, to, opts) {
    const down = interaction.handleEvent(
      mapEvent(map, "pointerdown", from, opts),
    );
    interaction.handleEvent(mapEvent(map, "pointerdrag", to, opts));
    interaction.handleEvent(mapEvent(map, "pointerup", to, opts));
    return down;
  }

  test("an interior drag moves the box and stops the event", () => {
    const onChange = jest.fn();
    const interaction = new ImageExtentInteraction({ extent: BOX, onChange });
    map.addInteraction(interaction);

    expect(gesture(interaction, [50, 50], [60, 70])).toBe(false);
    expect(interaction.getExtent()).toEqual([10, 20, 110, 120]);
    expect(interaction.isModified()).toBe(true);
    expect(onChange).toHaveBeenLastCalledWith([10, 20, 110, 120]);
  });

  test("a drag outside the box is declined so the map can pan", () => {
    const interaction = new ImageExtentInteraction({ extent: BOX });
    map.addInteraction(interaction);

    expect(gesture(interaction, [500, 500], [600, 600])).toBe(true);
    expect(interaction.getExtent()).toEqual(BOX);
    expect(interaction.isModified()).toBe(false);
  });

  test("a Shift+drag outside the box draws a new one", () => {
    const interaction = new ImageExtentInteraction({ extent: BOX });
    map.addInteraction(interaction);

    expect(
      gesture(interaction, [500, 500], [600, 650], { shiftKey: true }),
    ).toBe(false);
    expect(interaction.getExtent()).toEqual([500, 500, 600, 650]);
    expect(interaction.isModified()).toBe(true);
  });

  test("a Shift+click without movement keeps the existing box", () => {
    const interaction = new ImageExtentInteraction({ extent: BOX });
    map.addInteraction(interaction);

    gesture(interaction, [500, 500], [501, 501], { shiftKey: true });
    expect(interaction.getExtent()).toEqual(BOX);
    expect(interaction.isModified()).toBe(false);
  });

  test("with no box, a plain drag draws one", () => {
    const interaction = new ImageExtentInteraction();
    map.addInteraction(interaction);

    expect(gesture(interaction, [0, 0], [40, 30])).toBe(false);
    expect(interaction.getExtent()).toEqual([0, 0, 40, 30]);
  });

  test("an edge drag resizes", () => {
    const interaction = new ImageExtentInteraction({ extent: BOX });
    map.addInteraction(interaction);

    gesture(interaction, [100, 50], [150, 50]);
    expect(interaction.getExtent()).toEqual([0, 0, 150, 100]);
  });

  test("a resize that collapses the box to zero area is undone", () => {
    const interaction = new ImageExtentInteraction({ extent: BOX });
    map.addInteraction(interaction);

    gesture(interaction, [100, 50], [0, 50]);
    expect(interaction.getExtent()).toEqual(BOX);
    expect(interaction.isModified()).toBe(false);
  });

  test("a secondary-button pointerdown is declined", () => {
    const interaction = new ImageExtentInteraction({ extent: BOX });
    map.addInteraction(interaction);
    const event = mapEvent(map, "pointerdown", [50, 50]);
    event.originalEvent.button = 2;
    expect(interaction.handleEvent(event)).toBe(true);
  });

  test("setAspectRatio snaps an existing box and marks it modified", () => {
    const onChange = jest.fn();
    const interaction = new ImageExtentInteraction({ extent: BOX, onChange });
    interaction.setAspectRatio(2);
    expect(interaction.getExtent()).toEqual([0, 25, 100, 75]);
    expect(interaction.isModified()).toBe(true);
    expect(onChange).toHaveBeenCalledWith([0, 25, 100, 75]);
  });

  test("setAspectRatio on a box already at the ratio is not a modification", () => {
    const interaction = new ImageExtentInteraction({
      extent: [0, 0, 200, 100],
    });
    interaction.setAspectRatio(2);
    expect(interaction.isModified()).toBe(false);
  });

  test("setAspectRatio ignores float noise on a box already at the ratio", () => {
    const interaction = new ImageExtentInteraction({
      extent: [0.1, 0.2, 0.4, 0.3],
    });
    // 0.3 / 0.1 is not exactly 3 in floating point.
    interaction.setAspectRatio((0.4 - 0.1) / (0.3 - 0.2));
    expect(interaction.isModified()).toBe(false);
  });

  test("setExtent with a zero-area extent clears the box", () => {
    const interaction = new ImageExtentInteraction({ extent: BOX });
    interaction.setExtent([5, 5, 5, 10]);
    expect(interaction.getExtent()).toBeNull();
    expect(interaction.hasExtent()).toBe(false);
  });

  test("a draw keeps following the pointer after it passes the threshold", () => {
    const interaction = new ImageExtentInteraction();
    map.addInteraction(interaction);
    interaction.handleEvent(mapEvent(map, "pointerdown", [0, 0]));
    interaction.handleEvent(mapEvent(map, "pointerdrag", [20, 20]));
    interaction.handleEvent(mapEvent(map, "pointerdrag", [40, 30]));
    interaction.handleEvent(mapEvent(map, "pointerup", [40, 30]));
    expect(interaction.getExtent()).toEqual([0, 0, 40, 30]);
  });

  test("before the view has a resolution, hits are tested at one unit per pixel", () => {
    map.setView(new View());
    const interaction = new ImageExtentInteraction({ extent: BOX });
    map.addInteraction(interaction);
    expect(
      interaction.handleEvent(mapEvent(map, "pointerdown", [50, 50])),
    ).toBe(false);
  });

  test("setExtent places the box without counting as a modification", () => {
    const interaction = new ImageExtentInteraction();
    interaction.setExtent([5, 5, 10, 10]);
    expect(interaction.getExtent()).toEqual([5, 5, 10, 10]);
    expect(interaction.isModified()).toBe(false);
  });

  test("the hit tolerance scales with the view resolution", () => {
    map.getView().setResolution(10);
    const interaction = new ImageExtentInteraction({
      extent: [0, 0, 1000, 1000],
    });
    map.addInteraction(interaction);
    // 40 map units outside the east edge is within 8 px at resolution ~10.
    expect(HIT_TOLERANCE_PX * map.getView().getResolution()).toBeGreaterThan(
      40,
    );
    gesture(interaction, [1040, 500], [1200, 500]);
    expect(interaction.getExtent()).toEqual([0, 0, 1200, 1000]);
  });

  test("hover sets the map cursor and removal restores it", () => {
    target.style.cursor = "default";
    const interaction = new ImageExtentInteraction({ extent: BOX });
    map.addInteraction(interaction);

    interaction.handleEvent(mapEvent(map, "pointermove", [50, 50]));
    expect(target.style.cursor).toBe("move");
    interaction.handleEvent(mapEvent(map, "pointermove", [100, 50]));
    expect(target.style.cursor).toBe("e-resize");
    interaction.handleEvent(mapEvent(map, "pointermove", [500, 500]));
    expect(target.style.cursor).toBe("grab");

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    expect(target.style.cursor).toBe("grab");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift" }));
    expect(target.style.cursor).toBe("crosshair");
    // A held key repeats keydown; that is not a change.
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift" }));
    expect(target.style.cursor).toBe("crosshair");
    document.dispatchEvent(new KeyboardEvent("keyup", { key: "Shift" }));
    expect(target.style.cursor).toBe("grab");

    map.removeInteraction(interaction);
    expect(target.style.cursor).toBe("default");
  });
});

test("a map without a target element still runs the interaction", () => {
  const targetless = new Map({
    view: new View({ center: [0, 0], resolution: 1 }),
  });
  const interaction = new ImageExtentInteraction({ extent: BOX });
  targetless.addInteraction(interaction);
  // No element to set a cursor on: hovering is a no-op, not an error.
  expect(() =>
    interaction.handleEvent(mapEvent(targetless, "pointermove", [50, 50])),
  ).not.toThrow();
  targetless.removeInteraction(interaction);
});

describe("ImageExtentInteraction alongside the map's default interactions", () => {
  let map;
  let target;
  let dragPan;
  let dragZoom;

  beforeEach(() => {
    ({ map, target } = makeMap());
    // Interactions only run once the map has a frame state.
    map.frameState_ = { viewState: {} };
    const interactions = map.getInteractions().getArray();
    dragPan = interactions.find((i) => i instanceof DragPan);
    dragZoom = interactions.find((i) => i instanceof DragZoom);
    jest.spyOn(dragPan, "handleEvent");
    jest.spyOn(dragZoom, "handleEvent");
  });

  afterEach(() => {
    map.setTarget(null);
    target.remove();
  });

  function dispatchDown(coordinate, opts = {}) {
    map.handleMapBrowserEvent(
      mapEvent(map, "pointerdown", coordinate, { ...opts, target }),
    );
  }

  test("a pointerdown inside the box never reaches DragPan", () => {
    map.addInteraction(new ImageExtentInteraction({ extent: BOX }));
    dispatchDown([50, 50]);
    expect(dragPan.handleEvent).not.toHaveBeenCalled();
  });

  test("a pointerdown outside the box reaches DragPan", () => {
    map.addInteraction(new ImageExtentInteraction({ extent: BOX }));
    dispatchDown([500, 500]);
    expect(dragPan.handleEvent).toHaveBeenCalled();
  });

  test("a Shift pointerdown never reaches DragZoom", () => {
    map.addInteraction(new ImageExtentInteraction({ extent: BOX }));
    dispatchDown([500, 500], { shiftKey: true });
    expect(dragZoom.handleEvent).not.toHaveBeenCalled();
  });
});

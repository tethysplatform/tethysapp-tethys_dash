import Map from "ol/Map.js";
import View from "ol/View.js";
import Feature from "ol/Feature.js";
import Point from "ol/geom/Point.js";
import TextRotateInteraction, {
  ROTATE_HANDLE_DISTANCE_PX,
  rotateHandleCoordinate,
  rotationFromPointer,
} from "components/map/textRotateInteraction";

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

describe("rotateHandleCoordinate", () => {
  it("sits straight above unrotated text and turns clockwise with it", () => {
    const d = ROTATE_HANDLE_DISTANCE_PX * 2;
    expect(rotateHandleCoordinate([10, 10], 0, 2)).toEqual([10, 10 + d]);
    const east = rotateHandleCoordinate([10, 10], 90, 2);
    expect(east[0]).toBeCloseTo(10 + d);
    expect(east[1]).toBeCloseTo(10);
  });
});

describe("rotationFromPointer", () => {
  it("measures clockwise from north in whole degrees", () => {
    expect(rotationFromPointer([0, 0], [0, 5])).toBe(0);
    expect(rotationFromPointer([0, 0], [5, 0])).toBe(90);
    expect(rotationFromPointer([0, 0], [0, -5])).toBe(180);
    expect(rotationFromPointer([0, 0], [-5, 0])).toBe(270);
  });

  it("snaps to 15 degree steps when asked", () => {
    // About 50 degrees.
    const pointer = [
      Math.sin((50 * Math.PI) / 180),
      Math.cos((50 * Math.PI) / 180),
    ];
    expect(rotationFromPointer([0, 0], pointer, false)).toBe(50);
    expect(rotationFromPointer([0, 0], pointer, true)).toBe(45);
  });
});

describe("TextRotateInteraction", () => {
  let map;
  let target;
  let text;
  let onRotate;
  let selected;

  beforeEach(() => {
    target = document.createElement("div");
    document.body.appendChild(target);
    map = new Map({
      target,
      view: new View({ center: [0, 0], resolution: 1 }),
    });
    map.setSize([400, 300]);
    // OpenLayers' synchronous frame render, for a frame state -- not a
    // Testing Library render.
    // eslint-disable-next-line testing-library/no-render-in-setup
    map.renderSync();
    text = new Feature(new Point([0, 0]));
    selected = text;
    onRotate = jest.fn();
  });

  afterEach(() => {
    map.setTarget(null);
    target.remove();
  });

  const make = (rotation = 0) =>
    new TextRotateInteraction({
      getSelectedText: () => selected,
      getRotation: () => rotation,
      onRotate,
    });

  const pointer = (type, pixel, { shiftKey = false } = {}) => {
    const originalEvent = {
      type,
      pointerId: 1,
      isPrimary: true,
      button: 0,
      shiftKey,
      preventDefault: () => {},
    };
    return {
      type,
      map,
      pixel,
      coordinate: map.getCoordinateFromPixel(pixel),
      originalEvent,
      activePointers: type === "pointerup" ? [] : [originalEvent],
    };
  };

  // Resolution 1, centred on the origin: map [x, y] is pixel [200 + x, 150 - y].
  const handlePixel = (rotation) => {
    const [x, y] = rotateHandleCoordinate([0, 0], rotation, 1);
    return [200 + x, 150 - y];
  };

  it("grabs the handle and stops the event reaching move and reshape", () => {
    const interaction = make();
    // handleEvent returns false when it stops propagation.
    expect(
      interaction.handleEvent(pointer("pointerdown", handlePixel(0))),
    ).toBe(false);
  });

  it("finds the handle where the current rotation puts it", () => {
    const interaction = make(90);
    expect(
      interaction.handleEvent(pointer("pointerdown", handlePixel(0))),
    ).toBe(true);
    expect(
      interaction.handleEvent(pointer("pointerdown", handlePixel(90))),
    ).toBe(false);
  });

  it("leaves a pointerdown away from the handle to the other interactions", () => {
    const interaction = make();
    expect(interaction.handleEvent(pointer("pointerdown", [300, 150]))).toBe(
      true,
    );
    expect(onRotate).not.toHaveBeenCalled();
  });

  it("does nothing when no text is selected", () => {
    selected = null;
    const interaction = make();
    expect(
      interaction.handleEvent(pointer("pointerdown", handlePixel(0))),
    ).toBe(true);
  });

  it("rotates toward the pointer while dragging, snapping with Shift", () => {
    const interaction = make();
    interaction.handleEvent(pointer("pointerdown", handlePixel(0)));

    // Due east of the text.
    interaction.handleEvent(pointer("pointerdrag", [240, 150]));
    expect(onRotate).toHaveBeenLastCalledWith(text, 90);

    // About 50 degrees, snapped to 45.
    interaction.handleEvent(
      pointer(
        "pointerdrag",
        [200 + 30 * Math.sin(0.8727), 150 - 30 * Math.cos(0.8727)],
        {
          shiftKey: true,
        },
      ),
    );
    expect(onRotate).toHaveBeenLastCalledWith(text, 45);

    interaction.handleEvent(pointer("pointerup", [240, 150]));
    // Released: a later drag rotates nothing.
    onRotate.mockClear();
    interaction.handleEvent(pointer("pointerdrag", [200, 100]));
    expect(onRotate).not.toHaveBeenCalled();
  });
});

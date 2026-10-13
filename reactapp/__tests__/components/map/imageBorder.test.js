import ImageLayer from "ol/layer/Image";
import RenderEvent from "ol/render/Event";
import { get as getProjection, transform } from "ol/proj";
import { create as createTransform } from "ol/transform";
import {
  DEFAULT_BORDER_WIDTH,
  attachImageBorder,
  drawBorder,
  footprintRing,
  isTransparentColor,
  normalizeBorder,
} from "components/map/imageBorder";

function mockContext() {
  const calls = [];
  const record =
    (name) =>
    (...args) =>
      calls.push([name, ...args]);
  return {
    calls,
    save: record("save"),
    restore: record("restore"),
    beginPath: record("beginPath"),
    moveTo: record("moveTo"),
    lineTo: record("lineTo"),
    closePath: record("closePath"),
    clip: record("clip"),
    stroke: record("stroke"),
    globalAlpha: 1,
    lineWidth: 1,
    strokeStyle: "",
  };
}

describe("isTransparentColor", () => {
  test("detects zero-alpha hex colors", () => {
    expect(isTransparentColor("#ff000000")).toBe(true);
    expect(isTransparentColor("#F000")).toBe(true);
    expect(isTransparentColor("#ff000080")).toBe(false);
    expect(isTransparentColor("#ff0000")).toBe(false);
    expect(isTransparentColor("red")).toBe(false);
    expect(isTransparentColor(undefined)).toBe(false);
  });
});

describe("normalizeBorder", () => {
  test("no color or a transparent color means no border", () => {
    expect(normalizeBorder(undefined, 3)).toBeNull();
    expect(normalizeBorder("", 3)).toBeNull();
    expect(normalizeBorder("#ff000000", 3)).toBeNull();
  });

  test("a missing or non-numeric width takes the default", () => {
    expect(normalizeBorder("#ff0000")).toEqual({
      color: "#ff0000",
      width: DEFAULT_BORDER_WIDTH,
    });
    expect(normalizeBorder("#ff0000", "abc").width).toBe(DEFAULT_BORDER_WIDTH);
    expect(normalizeBorder("#ff0000", "").width).toBe(DEFAULT_BORDER_WIDTH);
  });

  test("a numeric width is clamped to 1..50", () => {
    expect(normalizeBorder("#ff0000", 0.4).width).toBe(1);
    expect(normalizeBorder("#ff0000", 500).width).toBe(50);
    expect(normalizeBorder("#ff0000", "4").width).toBe(4);
  });

  test("alpha colors and other CSS colors pass through", () => {
    expect(normalizeBorder("#ff000080", 2).color).toBe("#ff000080");
    expect(normalizeBorder("rgb(0, 0, 0)", 2).color).toBe("rgb(0, 0, 0)");
  });
});

describe("footprintRing", () => {
  test("an extent in the view projection is its four corners", () => {
    expect(footprintRing([0, 0, 10, 20], "EPSG:3857", "EPSG:3857")).toEqual([
      [0, 0],
      [10, 0],
      [10, 20],
      [0, 20],
    ]);
  });

  test("a reprojected extent is densified and transformed", () => {
    const ring = footprintRing([-10, 40, 10, 50], "EPSG:4326", "EPSG:3857");
    expect(ring).toHaveLength(64);
    const corner = transform([-10, 40], "EPSG:4326", "EPSG:3857");
    expect(ring[0][0]).toBeCloseTo(corner[0]);
    expect(ring[0][1]).toBeCloseTo(corner[1]);
  });
});

describe("drawBorder", () => {
  const square = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ];

  test("clips to the footprint and strokes at double width", () => {
    const context = mockContext();
    drawBorder(
      context,
      square,
      { color: "#00ff00", width: 3 },
      { opacity: 0.5, pixelRatio: 2 },
    );
    const names = context.calls.map(([name]) => name);
    expect(names[0]).toBe("save");
    expect(names.indexOf("clip")).toBeLessThan(names.indexOf("stroke"));
    expect(names[names.length - 1]).toBe("restore");
    expect(context.globalAlpha).toBe(0.5);
    expect(context.lineWidth).toBe(12);
    expect(context.strokeStyle).toBe("#00ff00");
  });

  test("a null border draws nothing", () => {
    const context = mockContext();
    drawBorder(context, square, null, { opacity: 1, pixelRatio: 1 });
    expect(context.calls).toHaveLength(0);
  });
});

describe("attachImageBorder", () => {
  function postrender(layer, context) {
    const frameState = {
      pixelRatio: 1,
      coordinateToPixelTransform: createTransform(),
      viewState: { projection: getProjection("EPSG:3857") },
    };
    layer.dispatchEvent(
      new RenderEvent("postrender", createTransform(), frameState, context),
    );
  }

  test("strokes the footprint on each postrender with the layer's opacity", () => {
    const layer = new ImageLayer({ opacity: 0.25 });
    attachImageBorder(
      layer,
      { color: "#ff0000", width: 2 },
      { extent: [0, 0, 10, 10], projection: "EPSG:3857" },
    );
    const context = mockContext();
    postrender(layer, context);
    expect(context.calls.some(([name]) => name === "stroke")).toBe(true);
    expect(context.globalAlpha).toBe(0.25);
    expect(context.calls).toContainEqual(["moveTo", 0, 0]);
    expect(context.calls).toContainEqual(["lineTo", 10, 10]);
  });

  test("the returned function detaches the border", () => {
    const layer = new ImageLayer();
    const detach = attachImageBorder(
      layer,
      { color: "#ff0000", width: 2 },
      { extent: [0, 0, 10, 10], projection: "EPSG:3857" },
    );
    detach();
    const context = mockContext();
    postrender(layer, context);
    expect(context.calls).toHaveLength(0);
  });

  test("a null border attaches nothing", () => {
    const layer = new ImageLayer();
    attachImageBorder(layer, null, {
      extent: [0, 0, 10, 10],
      projection: "EPSG:3857",
    });
    expect(layer.hasListener("postrender")).toBe(false);
  });
});

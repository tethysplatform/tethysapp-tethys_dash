import { render, screen, act } from "@testing-library/react";
import FloatingMapControl, {
  normalizeMeasuredHeight,
  useMapDivHeight,
  deriveControlMaxHeight,
  COLLAPSED_CONTROL_PX,
  MapSizedControlContainer,
} from "components/map/FloatingMapControl";
import { makeMapDiv } from "__tests__/utilities/mapDiv";
import PropTypes from "prop-types";

// jsdom does no layout, so every rect is stubbed. These tests pin where the
// control renders and how it measures its map; they cannot prove paint order.
const VIEWPORT = { width: 1000, height: 800 };

const stubRect = (rect) =>
  jest
    .spyOn(Element.prototype, "getBoundingClientRect")
    .mockReturnValue({ ...rect, toJSON: () => ({}) });

beforeEach(() => {
  window.innerWidth = VIEWPORT.width;
  window.innerHeight = VIEWPORT.height;
});

afterEach(() => {
  jest.restoreAllMocks();
});

// A fill-viewport tile: position:fixed, which makes it a stacking context of
// its own. The control stays inside it, exactly as it stays inside an ordinary
// tile -- being sealed into the tile that owns you is the behaviour here.
const FixedTile = ({ children }) => (
  <div data-testid="map-tile" style={{ position: "fixed" }}>
    {children}
  </div>
);
FixedTile.propTypes = { children: PropTypes.node };

describe("FloatingMapControl", () => {
  test.each([
    [
      "an ordinary tile",
      ({ children }) => <div data-testid="map-tile">{children}</div>,
    ],
    ["a fill-viewport tile", FixedTile],
  ])(
    "stays inside %s, so a tile sent to the front covers it",
    (_label, Tile) => {
      // Grid items carry no z-index and are painted in DOM order, so a control
      // on document.body outranked every tile: a text box an author sent to the
      // front covered the map but not its legend. The control stays in the tile
      // that owns it, and a fill-viewport tile is no exception -- being sealed
      // into your own tile is the behaviour, not a problem to escape.
      render(
        <Tile>
          <FloatingMapControl>
            <button type="button">Show Legend</button>
          </FloatingMapControl>
        </Tile>,
      );

      const control = screen.getByRole("button", { name: "Show Legend" });
      expect(screen.getByTestId("map-tile")).toContainElement(control);
    },
  );

  test("watches nothing but the map, and stops on unmount", () => {
    // It used to track the window too, because a scroll or a resize moved the
    // rectangle the floated copy was pinned to. In place there is no rectangle
    // to track: CSS positions it, and the only thing left to measure is how
    // tall the map is.
    const addSpy = jest.spyOn(window, "addEventListener");
    const disconnect = jest.fn();
    const observe = jest.fn();
    const original = global.ResizeObserver;
    global.ResizeObserver = jest.fn(() => ({ observe, disconnect }));

    const parent = document.createElement("div");
    document.body.appendChild(parent);
    jest
      .spyOn(HTMLElement.prototype, "offsetParent", "get")
      .mockReturnValue(parent);

    const { unmount } = render(
      <FixedTile>
        <FloatingMapControl>
          <span>content</span>
        </FloatingMapControl>
      </FixedTile>,
    );
    expect(addSpy).not.toHaveBeenCalledWith("resize", expect.any(Function));
    expect(addSpy).not.toHaveBeenCalledWith(
      "scroll",
      expect.any(Function),
      true,
    );
    expect(observe).toHaveBeenCalledWith(parent);

    unmount();
    expect(disconnect).toHaveBeenCalled();
    global.ResizeObserver = original;
  });
});

describe("tracking the map it belongs to", () => {
  it("observes the offset parent, so a resized tile remeasures", () => {
    // Editing the layout resizes the tile without a window resize or a scroll,
    // so neither listener would fire.
    const observe = jest.fn();
    const disconnect = jest.fn();
    const realResizeObserver = global.ResizeObserver;
    global.ResizeObserver = jest.fn(() => ({ observe, disconnect }));

    const parent = document.createElement("div");
    document.body.appendChild(parent);
    jest
      .spyOn(HTMLElement.prototype, "offsetParent", "get")
      .mockReturnValue(parent);
    stubRect({
      top: 100,
      left: 20,
      width: 200,
      height: 50,
      bottom: 150,
      right: 220,
    });

    try {
      const { unmount } = render(
        <FloatingMapControl>
          <span>content</span>
        </FloatingMapControl>,
      );

      expect(global.ResizeObserver).toHaveBeenCalled();
      expect(observe).toHaveBeenCalledWith(parent);

      unmount();
      expect(disconnect).toHaveBeenCalled();
    } finally {
      if (realResizeObserver) global.ResizeObserver = realResizeObserver;
      else delete global.ResizeObserver;
    }
  });

  it("does not observe when the runtime has no ResizeObserver", () => {
    const realResizeObserver = global.ResizeObserver;
    delete global.ResizeObserver;
    const parent = document.createElement("div");
    jest
      .spyOn(HTMLElement.prototype, "offsetParent", "get")
      .mockReturnValue(parent);
    stubRect({ top: 0, left: 0, width: 10, height: 10, bottom: 10, right: 10 });

    try {
      expect(() =>
        render(
          <FloatingMapControl>
            <span>content</span>
          </FloatingMapControl>,
        ),
      ).not.toThrow();
    } finally {
      if (realResizeObserver) global.ResizeObserver = realResizeObserver;
    }
  });

  // Detaching the anchor is itself what resizes the offsetParent being
  // observed, and the observer is torn down a phase later than React nulls the
  // ref -- so the callback can genuinely arrive with nothing to measure. It
  // used to throw, which surfaced as a console error the moment an edit made a
  // map's extent invalid and took one of its alert banners down.
  test("tolerates a resize callback delivered after the anchor detaches", () => {
    const realResizeObserver = global.ResizeObserver;
    let fireResize;
    global.ResizeObserver = class {
      constructor(callback) {
        fireResize = callback;
      }
      observe() {}
      // A real disconnect cannot recall a callback already in flight.
      disconnect() {}
    };
    const parent = document.createElement("div");
    jest
      .spyOn(HTMLElement.prototype, "offsetParent", "get")
      .mockReturnValue(parent);
    stubRect({ top: 0, left: 0, width: 10, height: 10, bottom: 10, right: 10 });

    try {
      const { unmount } = render(
        <FloatingMapControl>
          <span>content</span>
        </FloatingMapControl>,
      );
      unmount();
      expect(() => fireResize()).not.toThrow();
    } finally {
      if (realResizeObserver) global.ResizeObserver = realResizeObserver;
    }
  });
});

describe("map div height", () => {
  // A control is portalled out of the map div, so it has no CSS relationship to
  // the map it belongs to. These pin the measurement it reads instead.

  const HeightProbe = () => {
    const height = useMapDivHeight();
    return <span data-testid="probe">{String(height)}</span>;
  };

  const ANCHOR_RECT = {
    top: 100,
    left: 20,
    width: 0,
    height: 0,
    bottom: 100,
    right: 20,
  };

  describe("normalizeMeasuredHeight", () => {
    test.each([
      ["a positive height", 400, 400],
      ["zero", 0, null],
      ["a negative height", -5, null],
      ["NaN", NaN, null],
      ["Infinity", Infinity, null],
      ["undefined", undefined, null],
    ])("maps %s", (_label, input, expected) => {
      expect(normalizeMeasuredHeight(input)).toBe(expected);
    });
  });

  test("reports the map div's height to its children", () => {
    stubRect(ANCHOR_RECT);
    const mapDiv = makeMapDiv(400);

    render(
      <FloatingMapControl mapDivRef={{ current: mapDiv }}>
        <HeightProbe />
      </FloatingMapControl>,
    );

    expect(screen.getByTestId("probe")).toHaveTextContent("400");
  });

  test("reports unmeasured for a map div that measures zero", () => {
    // A map on an inactive dashboard tab is mounted but display:none, so it
    // measures zero. Capping a control at a fraction of zero would hide it.
    stubRect(ANCHOR_RECT);
    const mapDiv = makeMapDiv(0);

    render(
      <FloatingMapControl mapDivRef={{ current: mapDiv }}>
        <HeightProbe />
      </FloatingMapControl>,
    );

    expect(screen.getByTestId("probe")).toHaveTextContent("null");
  });

  test("picks up a height change through the resize observer", () => {
    // AE7 / AE10: a tile resized under an open control, and a hidden tab
    // becoming visible, are the same mechanism -- the observed box changes size
    // while the control stays mounted.
    const realResizeObserver = global.ResizeObserver;
    let fireResize;
    global.ResizeObserver = class {
      constructor(callback) {
        fireResize = callback;
      }
      observe() {}
      disconnect() {}
    };
    stubRect(ANCHOR_RECT);

    let currentHeight = 0;
    const mapDiv = document.createElement("div");
    mapDiv.getBoundingClientRect = () => ({
      top: 0,
      left: 0,
      width: 300,
      height: currentHeight,
      bottom: currentHeight,
      right: 300,
      toJSON: () => ({}),
    });
    document.body.appendChild(mapDiv);

    try {
      render(
        <FloatingMapControl mapDivRef={{ current: mapDiv }}>
          <HeightProbe />
        </FloatingMapControl>,
      );

      // Hidden at mount.
      expect(screen.getByTestId("probe")).toHaveTextContent("null");

      currentHeight = 600;
      act(() => fireResize());

      expect(screen.getByTestId("probe")).toHaveTextContent("600");
    } finally {
      if (realResizeObserver) global.ResizeObserver = realResizeObserver;
      else delete global.ResizeObserver;
    }
  });

  test("viewport clamp updates on a window resize (map div unchanged)", () => {
    // Regression: MapSizedControlContainer is portalled/passed as children, so
    // FloatingMapControl re-rendering on resize does not re-render it. A pure
    // window resize (map div height unchanged) must still tighten the viewport
    // clamp -- previously a render-time window.innerHeight read went stale here.
    stubRect(ANCHOR_RECT);
    window.innerHeight = 800;
    const mapDiv = makeMapDiv(4000); // tall map, so the viewport clamp binds
    // eslint-disable-next-line react/prop-types
    const ProbeContainer = ({ $maxheight }) => (
      <div data-testid="cap">{$maxheight}</div>
    );

    render(
      <FloatingMapControl mapDivRef={{ current: mapDiv }}>
        <MapSizedControlContainer container={ProbeContainer} expanded>
          x
        </MapSizedControlContainer>
      </FloatingMapControl>,
    );

    // min(4000 * 0.75, 800 * 0.75) = min(3000, 600) = 600.
    expect(screen.getByTestId("cap")).toHaveTextContent("600px");

    act(() => {
      window.innerHeight = 400;
      window.dispatchEvent(new Event("resize"));
    });

    // Map div still 4000; only the viewport shrank -> min(3000, 300) = 300.
    expect(screen.getByTestId("cap")).toHaveTextContent("300px");
  });

  test("falls back to observing offsetParent when given no map div ref", () => {
    // The alert anchors pass no ref, and must keep behaving exactly as before.
    const observe = jest.fn();
    const realResizeObserver = global.ResizeObserver;
    global.ResizeObserver = jest.fn(() => ({
      observe,
      disconnect: jest.fn(),
    }));
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    jest
      .spyOn(HTMLElement.prototype, "offsetParent", "get")
      .mockReturnValue(parent);
    stubRect(ANCHOR_RECT);

    try {
      render(
        <FloatingMapControl>
          <HeightProbe />
        </FloatingMapControl>,
      );
      expect(observe).toHaveBeenCalledWith(parent);
    } finally {
      if (realResizeObserver) global.ResizeObserver = realResizeObserver;
      else delete global.ResizeObserver;
    }
  });

  test("measures once even when the runtime has no ResizeObserver", () => {
    const realResizeObserver = global.ResizeObserver;
    delete global.ResizeObserver;
    stubRect(ANCHOR_RECT);
    const mapDiv = makeMapDiv(320);

    try {
      render(
        <FloatingMapControl mapDivRef={{ current: mapDiv }}>
          <HeightProbe />
        </FloatingMapControl>,
      );
      expect(screen.getByTestId("probe")).toHaveTextContent("320");
    } finally {
      if (realResizeObserver) global.ResizeObserver = realResizeObserver;
    }
  });

  test("reports null to a consumer rendered outside the provider", () => {
    render(<HeightProbe />);
    expect(screen.getByTestId("probe")).toHaveTextContent("null");
  });
});

describe("deriveControlMaxHeight", () => {
  test("caps an expanded control at three quarters of the map div", () => {
    expect(deriveControlMaxHeight(800, true)).toBe("600px");
  });

  test("scales down with a shorter map", () => {
    expect(deriveControlMaxHeight(300, true)).toBe("225px");
  });

  test("falls back to the pre-measurement cap when unmeasured", () => {
    // Whatever the reason -- an inactive tab, a runtime reporting zero -- the
    // fallback is the behavior users already had rather than something new.
    expect(deriveControlMaxHeight(null, true)).toBe("35vh");
  });

  test("never caps below the collapsed control's own size", () => {
    // 75% of 40 is 30, which would clip the toggle and leave the control
    // impossible to open on a very short map.
    expect(deriveControlMaxHeight(40, true)).toBe(`${COLLAPSED_CONTROL_PX}px`);
  });

  test("does not cap a collapsed control at all", () => {
    expect(deriveControlMaxHeight(800, false)).toBe("none");
    expect(deriveControlMaxHeight(null, false)).toBe("none");
  });

  test("clamps to the viewport when the map is taller than the window", () => {
    // position:fixed means an over-tall control's top is simply unreachable.
    expect(deriveControlMaxHeight(4000, true, 800)).toBe("600px");
  });

  test("lets the map bind when it is shorter than the viewport", () => {
    expect(deriveControlMaxHeight(800, true, 2000)).toBe("600px");
  });

  test("applies no viewport cap when no viewport height is given", () => {
    expect(deriveControlMaxHeight(800, true)).toBe("600px");
  });
});

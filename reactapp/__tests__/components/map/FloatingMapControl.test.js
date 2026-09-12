import { render, screen, act } from "@testing-library/react";
import FloatingMapControl, {
  FLOATING_CONTROL_Z_INDEX,
  styleFromAnchor,
  normalizeMeasuredHeight,
  useMapDivHeight,
  deriveControlMaxHeight,
  COLLAPSED_CONTROL_PX,
} from "components/map/FloatingMapControl";
import { makeMapDiv } from "__tests__/utilities/mapDiv";

// jsdom does no layout, so every rect is stubbed. These tests pin the mapping
// from anchor rect to fixed-position style and the escape from the parent tree;
// they cannot prove paint order.
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

describe("styleFromAnchor", () => {
  // A bottom-left anchor collapses to a point once its content is portalled
  // away, so only left/bottom carry meaning -- right/top are the same point and
  // say nothing about the control's size.
  test("bottom-left pins the corner and leaves size to the content", () => {
    const style = styleFromAnchor(
      { left: 16, right: 16, top: 700, bottom: 700, width: 0, height: 0 },
      ["bottom", "left"],
      VIEWPORT,
    );
    expect(style).toEqual({ left: "16px", bottom: "100px" });
  });

  test("bottom-right measures from the far edges", () => {
    const style = styleFromAnchor(
      { left: 984, right: 984, top: 700, bottom: 700, width: 0, height: 0 },
      ["bottom", "right"],
      VIEWPORT,
    );
    expect(style).toEqual({ right: "16px", bottom: "100px" });
  });

  test("pinned on both sides carries the width across", () => {
    // The alert spans the map, so the floated copy must not shrink to content.
    const style = styleFromAnchor(
      { left: 16, right: 984, top: 16, bottom: 16, width: 968, height: 0 },
      ["top", "left", "right"],
      VIEWPORT,
    );
    expect(style).toEqual({ left: "16px", top: "16px", width: "968px" });
    expect(style.right).toBeUndefined();
  });

  test("no rect yields no style", () => {
    expect(styleFromAnchor(null, ["bottom", "left"], VIEWPORT)).toBeNull();
  });
});

describe("FloatingMapControl", () => {
  test("renders its children outside the parent tree", () => {
    stubRect({
      left: 16,
      right: 16,
      top: 700,
      bottom: 700,
      width: 0,
      height: 0,
    });
    render(
      <div data-testid="map-tile">
        <FloatingMapControl edges={["bottom", "left"]}>
          <button type="button">Show Legend</button>
        </FloatingMapControl>
      </div>,
    );

    const control = screen.getByRole("button", { name: "Show Legend" });
    expect(control).toBeInTheDocument();
    // The whole point: it must not be a descendant of the tile, or it stays
    // sealed inside that tile's stacking context.
    expect(screen.getByTestId("map-tile")).not.toContainElement(control);
    expect(document.body).toContainElement(control);
  });

  test("positions the floated copy from the anchor's rect", () => {
    stubRect({
      left: 16,
      right: 16,
      top: 700,
      bottom: 700,
      width: 0,
      height: 0,
    });
    render(
      <FloatingMapControl edges={["bottom", "left"]}>
        <span>content</span>
      </FloatingMapControl>,
    );

    const floated = screen.getByTestId("floating-map-control");
    expect(floated).toHaveStyle({
      position: "fixed",
      left: "16px",
      bottom: "100px",
    });
    expect(floated).toHaveStyle({ zIndex: String(FLOATING_CONTROL_Z_INDEX) });
  });

  test("repositions when the window resizes", () => {
    const rect = stubRect({
      left: 16,
      right: 16,
      top: 700,
      bottom: 700,
      width: 0,
      height: 0,
    });
    render(
      <FloatingMapControl edges={["bottom", "left"]}>
        <span>content</span>
      </FloatingMapControl>,
    );
    expect(screen.getByTestId("floating-map-control")).toHaveStyle({
      bottom: "100px",
    });

    // The map got shorter: same anchor offset from the bottom, different
    // viewport, so the computed `bottom` has to change.
    rect.mockReturnValue({
      left: 16,
      right: 16,
      top: 500,
      bottom: 500,
      width: 0,
      height: 0,
      toJSON: () => ({}),
    });
    window.innerHeight = 600;
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(screen.getByTestId("floating-map-control")).toHaveStyle({
      bottom: "100px",
      left: "16px",
    });
  });

  test("removes its listeners and observer on unmount", () => {
    stubRect({
      left: 16,
      right: 16,
      top: 700,
      bottom: 700,
      width: 0,
      height: 0,
    });
    const addSpy = jest.spyOn(window, "addEventListener");
    const removeSpy = jest.spyOn(window, "removeEventListener");
    const disconnect = jest.fn();
    const observe = jest.fn();
    const original = global.ResizeObserver;
    global.ResizeObserver = jest.fn(() => ({ observe, disconnect }));

    const { unmount } = render(
      <FloatingMapControl edges={["bottom", "left"]}>
        <span>content</span>
      </FloatingMapControl>,
    );
    expect(addSpy).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith("scroll", expect.any(Function), true);

    unmount();
    expect(removeSpy).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith(
      "scroll",
      expect.any(Function),
      true,
    );
    global.ResizeObserver = original;
  });

  test("the anchor stays behind and is inert", () => {
    stubRect({
      left: 16,
      right: 16,
      top: 700,
      bottom: 700,
      width: 0,
      height: 0,
    });
    render(
      <FloatingMapControl edges={["bottom", "left"]} className="anchor-class">
        <span>content</span>
      </FloatingMapControl>,
    );

    // The caller's positioning CSS rides on the anchor, so it has to remain in
    // place rather than move to the portal.
    const anchor = screen.getByTestId("floating-map-control-anchor");
    expect(anchor).toHaveClass("anchor-class");
    expect(anchor).toHaveAttribute("aria-hidden", "true");
    expect(anchor).toBeEmptyDOMElement();
  });
});

describe("tracking the tile it floats above", () => {
  it("observes the anchor's offset parent so a resized tile repositions it", () => {
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
        <FloatingMapControl edges={["bottom", "left"]}>
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
          <FloatingMapControl edges={["top", "right"]}>
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
        <FloatingMapControl edges={["top", "left"]}>
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

  test("reports the map div's height to a portalled child", () => {
    stubRect(ANCHOR_RECT);
    const mapDiv = makeMapDiv(400);

    render(
      <FloatingMapControl
        edges={["bottom", "left"]}
        mapDivRef={{ current: mapDiv }}
      >
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
      <FloatingMapControl
        edges={["bottom", "left"]}
        mapDivRef={{ current: mapDiv }}
      >
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
        <FloatingMapControl
          edges={["bottom", "left"]}
          mapDivRef={{ current: mapDiv }}
        >
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
        <FloatingMapControl edges={["bottom", "left"]}>
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
        <FloatingMapControl
          edges={["bottom", "left"]}
          mapDivRef={{ current: mapDiv }}
        >
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

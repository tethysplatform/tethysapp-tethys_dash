import { render, screen, act } from "@testing-library/react";
import FloatingMapControl, {
  FLOATING_CONTROL_Z_INDEX,
  styleFromAnchor,
} from "components/map/FloatingMapControl";

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

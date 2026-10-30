import React, { useRef, useState } from "react";
import { act, render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PopupModal, {
  MIN_POPUP_HEIGHT_PX,
  MIN_POPUP_WIDTH_PX,
  draggedRect,
  rectToPosition,
  computePositionStyle,
  isEditableTarget,
  getInitialIsSmallViewport,
  getInitialViewportHeight,
  readHeaderHeight,
  trackSmallViewport,
} from "components/modals/PopupModal/PopupModal";

const ORIGINAL_INNER_WIDTH = window.innerWidth;
const ORIGINAL_INNER_HEIGHT = window.innerHeight;

// A 56px header over a 1000px window leaves a 944px content area, which the
// vertical percentages measure.
const HEADER = 56;
const CONTENT = 1000 - HEADER;
const topFor = (pct) => `${Math.round(HEADER + (CONTENT * pct) / 100)}px`;
const heightFor = (pct) => `${Math.round((CONTENT * pct) / 100)}px`;

beforeEach(() => {
  document.documentElement.style.setProperty(
    "--ts-header-height",
    `${HEADER}px`,
  );
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    writable: true,
    value: 1000,
  });
});

const CENTERED = { leftPct: 20, topPct: 20, widthPct: 60, heightPct: 60 };

afterEach(() => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: ORIGINAL_INNER_WIDTH,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    writable: true,
    value: ORIGINAL_INNER_HEIGHT,
  });
  document.documentElement.style.removeProperty("--ts-header-height");
});

function setViewportWidth(width) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
  fireEvent(window, new Event("resize"));
}

describe("PopupModal — render", () => {
  it("renders the dialog positioned within the content area below the header", () => {
    render(
      <PopupModal
        show={true}
        onClose={() => {}}
        position={{ leftPct: 20, topPct: 25, widthPct: 60, heightPct: 50 }}
        title={<span id="popup-title">Title</span>}
        ariaLabelledBy="popup-title"
      >
        <p>body</p>
      </PopupModal>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "false");
    expect(dialog).toHaveAttribute("aria-labelledby", "popup-title");

    // Position + size come through inline styles so jsdom can read them.
    expect(dialog).toHaveStyle("left: 20vw");
    expect(dialog).toHaveStyle(`top: ${topFor(25)}`);
    expect(dialog).toHaveStyle("width: 60vw");
    expect(dialog).toHaveStyle(`height: ${heightFor(50)}`);
    expect(dialog).toHaveStyle("position: fixed");
    // Under the fixed header's layer, so its menus open over the popup.
    expect(dialog).toHaveStyle("z-index: 1025");
  });

  it("renders nothing when show=false", () => {
    render(
      <PopupModal
        show={false}
        onClose={() => {}}
        position={CENTERED}
        title={<span id="popup-title">Title</span>}
        ariaLabelledBy="popup-title"
      >
        <p>body</p>
      </PopupModal>,
    );

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByTestId("popup-modal")).toBeNull();
  });

  it("portals the content into document.body", () => {
    const { container } = render(
      <PopupModal
        show={true}
        onClose={() => {}}
        position={CENTERED}
        title={<span id="t">t</span>}
        ariaLabelledBy="t"
      />,
    );
    // The dialog is NOT a child of the test render container — it's portaled
    // into document.body. `screen` queries the whole document, so it should
    // find the dialog even though `container` does not.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(container).not.toContainElement(screen.getByRole("dialog"));
  });

  it.each([
    [
      { leftPct: 0, topPct: 0, widthPct: 30, heightPct: 30 },
      // A popup at the very top starts below the header, not under it.
      { left: "0vw", top: `${HEADER}px` },
    ],
    [
      { leftPct: 70, topPct: 0, widthPct: 30, heightPct: 30 },
      { left: "70vw", top: `${HEADER}px` },
    ],
    [
      { leftPct: 0, topPct: 70, widthPct: 30, heightPct: 30 },
      { left: "0vw", top: topFor(70) },
    ],
    [
      { leftPct: 70, topPct: 70, widthPct: 30, heightPct: 30 },
      { left: "70vw", top: topFor(70) },
    ],
  ])(
    "positions correctly for free-position config %#",
    (position, expected) => {
      render(
        <PopupModal
          show={true}
          onClose={() => {}}
          position={position}
          title={<span id="t">t</span>}
          ariaLabelledBy="t"
        />,
      );
      const dialog = screen.getByRole("dialog");
      Object.entries(expected).forEach(([prop, value]) => {
        expect(dialog).toHaveStyle(`${prop}: ${value}`);
      });
      expect(dialog).toHaveStyle(`width: ${position.widthPct}vw`);
      expect(dialog).toHaveStyle(`height: ${heightFor(position.heightPct)}`);
    },
  );

  it("follows the window's height when it resizes", () => {
    render(
      <PopupModal
        show={true}
        onClose={() => {}}
        position={CENTERED}
        title={<span id="t">t</span>}
        ariaLabelledBy="t"
      />,
    );

    window.innerHeight = 556;
    fireEvent(window, new Event("resize"));

    // 500px of content below the 56px header.
    expect(screen.getByRole("dialog")).toHaveStyle("top: 156px");
    expect(screen.getByRole("dialog")).toHaveStyle("height: 300px");
  });
});

describe("computePositionStyle", () => {
  it("measures vertical percentages from the content area below the header", () => {
    expect(
      computePositionStyle({
        position: { leftPct: 10, topPct: 50, widthPct: 40, heightPct: 50 },
        isSmallViewport: false,
        viewportHeight: 856,
        headerHeight: 56,
      }),
    ).toEqual({ left: "10vw", top: "456px", width: "40vw", height: "400px" });
  });

  it("uses the defaults and treats a missing header as none", () => {
    expect(
      computePositionStyle({
        position: undefined,
        isSmallViewport: false,
        viewportHeight: 1000,
      }),
    ).toEqual({ left: "20vw", top: "200px", width: "60vw", height: "600px" });
  });

  it("never sizes a popup negatively in a window shorter than the header", () => {
    expect(
      computePositionStyle({
        position: CENTERED,
        isSmallViewport: false,
        viewportHeight: 40,
        headerHeight: 56,
      }),
    ).toEqual(expect.objectContaining({ top: "56px", height: "0px" }));
  });
});

describe("readHeaderHeight", () => {
  it("reads the header height the layout declares", () => {
    expect(readHeaderHeight()).toBe(HEADER);
  });

  it("is zero when none is declared", () => {
    document.documentElement.style.removeProperty("--ts-header-height");
    expect(readHeaderHeight()).toBe(0);
  });
});

describe("PopupModal — Esc to close", () => {
  it("Esc on the modal container fires onClose", () => {
    const onClose = jest.fn();
    render(
      <PopupModal
        show={true}
        onClose={onClose}
        position={CENTERED}
        title={<span id="t">t</span>}
        ariaLabelledBy="t"
      />,
    );

    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Esc fired from inside an <input> child does NOT call onClose", () => {
    const onClose = jest.fn();
    render(
      <PopupModal
        show={true}
        onClose={onClose}
        position={CENTERED}
        title={<span id="t">t</span>}
        ariaLabelledBy="t"
      >
        <input type="text" data-testid="child-input" />
      </PopupModal>,
    );

    const input = screen.getByTestId("child-input");
    input.focus();
    fireEvent.keyDown(input, { key: "Escape" });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("Esc from a textarea child does NOT call onClose", () => {
    const onClose = jest.fn();
    render(
      <PopupModal
        show={true}
        onClose={onClose}
        position={CENTERED}
        title={<span id="t">t</span>}
        ariaLabelledBy="t"
      >
        <textarea data-testid="child-textarea" />
      </PopupModal>,
    );

    const ta = screen.getByTestId("child-textarea");
    ta.focus();
    fireEvent.keyDown(ta, { key: "Escape" });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("Esc from a contentEditable child does NOT call onClose", () => {
    const onClose = jest.fn();
    render(
      <PopupModal
        show={true}
        onClose={onClose}
        position={CENTERED}
        title={<span id="t">t</span>}
        ariaLabelledBy="t"
      >
        <div
          contentEditable="true"
          data-testid="child-ce"
          suppressContentEditableWarning
        >
          editable
        </div>
      </PopupModal>,
    );

    const ce = screen.getByTestId("child-ce");
    fireEvent.keyDown(ce, { key: "Escape" });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("non-Escape key does not call onClose", () => {
    const onClose = jest.fn();
    render(
      <PopupModal
        show={true}
        onClose={onClose}
        position={CENTERED}
        title={<span id="t">t</span>}
        ariaLabelledBy="t"
      />,
    );

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Enter" });
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "a" });

    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("PopupModal — small-viewport fallback (R9)", () => {
  it("ignores position at viewport widths below 768px", () => {
    setViewportWidth(700);

    render(
      <PopupModal
        show={true}
        onClose={() => {}}
        position={{ leftPct: 0, topPct: 0, widthPct: 30, heightPct: 30 }}
        title={<span id="t">t</span>}
        ariaLabelledBy="t"
      />,
    );

    const dialog = screen.getByRole("dialog");
    // Near-fullscreen — uses inset rather than viewport-percent sizing, and
    // starts 1rem below the header.
    expect(dialog).toHaveStyle(`top: ${HEADER + 16}px`);
    expect(dialog).toHaveStyle("left: 1rem");
    expect(dialog).toHaveStyle("right: 1rem");
    expect(dialog).toHaveStyle("bottom: 1rem");
    expect(dialog).toHaveStyle("width: auto");
    expect(dialog).toHaveStyle("height: auto");
  });

  it("switches between fullscreen and free-position layout on resize", () => {
    setViewportWidth(1200);
    render(
      <PopupModal
        show={true}
        onClose={() => {}}
        position={{ leftPct: 25, topPct: 25, widthPct: 50, heightPct: 50 }}
        title={<span id="t">t</span>}
        ariaLabelledBy="t"
      />,
    );

    let dialog = screen.getByRole("dialog");
    expect(dialog).toHaveStyle("width: 50vw");

    act(() => {
      setViewportWidth(600);
    });

    dialog = screen.getByRole("dialog");
    expect(dialog).toHaveStyle("width: auto");
    expect(dialog).toHaveStyle(`top: ${HEADER + 16}px`);
  });
});

describe("PopupModal — focus management (R28)", () => {
  it("moves focus to the modal container when opened", () => {
    function Harness() {
      const [show, setShow] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setShow(true)}>
            open
          </button>
          <PopupModal
            show={show}
            onClose={() => setShow(false)}
            position={CENTERED}
            title={<span id="t">t</span>}
            ariaLabelledBy="t"
          />
        </>
      );
    }

    render(<Harness />);
    fireEvent.click(screen.getByText("open"));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveFocus();
  });

  it("restores focus to triggerRef when closed", () => {
    function Harness() {
      const [show, setShow] = useState(true);
      const triggerRef = useRef(null);
      return (
        <>
          <button type="button" ref={triggerRef} data-testid="trigger">
            trigger
          </button>
          <button
            type="button"
            onClick={() => setShow(false)}
            data-testid="closer"
          >
            close
          </button>
          <PopupModal
            show={show}
            onClose={() => setShow(false)}
            position={CENTERED}
            title={<span id="t">t</span>}
            ariaLabelledBy="t"
            triggerRef={triggerRef}
          />
        </>
      );
    }

    render(<Harness />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("closer"));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByTestId("trigger")).toHaveFocus();
  });

  it("leaves focus alone when it mounts closed", () => {
    // Every map mounts one closed. Handing focus to the trigger then made the
    // browser scroll each map into view, leaving the page at the last one.
    function Harness() {
      const triggerRef = useRef(null);
      return (
        <>
          <button type="button" ref={triggerRef} data-testid="trigger">
            trigger
          </button>
          <PopupModal
            show={false}
            onClose={() => {}}
            position={CENTERED}
            title={<span id="t">t</span>}
            ariaLabelledBy="t"
            triggerRef={triggerRef}
          />
        </>
      );
    }

    render(<Harness />);

    expect(screen.getByTestId("trigger")).not.toHaveFocus();
    expect(document.body).toHaveFocus();
  });

  it("does not error if triggerRef is null/undefined when closing", () => {
    function Harness() {
      const [show, setShow] = useState(true);
      return (
        <>
          <button
            type="button"
            onClick={() => setShow(false)}
            data-testid="closer"
          >
            close
          </button>
          <PopupModal
            show={show}
            onClose={() => setShow(false)}
            position={CENTERED}
            title={<span id="t">t</span>}
            ariaLabelledBy="t"
          />
        </>
      );
    }

    render(<Harness />);
    expect(() => fireEvent.click(screen.getByTestId("closer"))).not.toThrow();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("PopupModal — chrome (X close button)", () => {
  it("clicking the X button calls onClose", async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(
      <PopupModal
        show={true}
        onClose={onClose}
        position={CENTERED}
        title={<span id="t">t</span>}
        ariaLabelledBy="t"
      />,
    );

    await user.click(screen.getByRole("button", { name: /close popup/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("X button has minimum 44x44 CSS hit target (WCAG 2.5.5)", () => {
    render(
      <PopupModal
        show={true}
        onClose={() => {}}
        position={CENTERED}
        title={<span id="t">t</span>}
        ariaLabelledBy="t"
      />,
    );

    const closeBtn = screen.getByRole("button", { name: /close popup/i });
    // Inline styles set min-width/min-height to satisfy WCAG 2.5.5 even
    // though jsdom doesn't compute layout and offsetWidth/offsetHeight are 0.
    expect(closeBtn).toHaveStyle("min-width: 44px");
    expect(closeBtn).toHaveStyle("min-height: 44px");
  });

  it("renders the title slot content", () => {
    render(
      <PopupModal
        show={true}
        onClose={() => {}}
        position={CENTERED}
        title={<span id="my-title">Hello world</span>}
        ariaLabelledBy="my-title"
      />,
    );
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });
});

describe("PopupModal — accessibility wiring (R27)", () => {
  it("dialog has role=dialog with aria-modal=false", () => {
    render(
      <PopupModal
        show={true}
        onClose={() => {}}
        position={CENTERED}
        title={<span id="t">t</span>}
        ariaLabelledBy="t"
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("role", "dialog");
    expect(dialog).toHaveAttribute("aria-modal", "false");
  });

  it("aria-labelledby points at the title element id", () => {
    render(
      <PopupModal
        show={true}
        onClose={() => {}}
        position={CENTERED}
        title={<span id="my-title-id">Hi</span>}
        ariaLabelledBy="my-title-id"
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-labelledby", "my-title-id");
    expect(screen.getByText("Hi")).toHaveAttribute("id", "my-title-id");
  });

  it("falls back to aria-label when ariaLabelledBy is omitted", () => {
    render(<PopupModal show={true} onClose={() => {}} position={CENTERED} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).not.toHaveAttribute("aria-labelledby");
    expect(dialog).toHaveAttribute("aria-label", "Popup Modal");
  });

  it("does not render a backdrop element (R15 — map stays interactive)", () => {
    render(
      <PopupModal
        show={true}
        onClose={() => {}}
        position={CENTERED}
        title={<span id="t">t</span>}
        ariaLabelledBy="t"
      />,
    );

    // No bootstrap-style backdrop and no element covering the viewport.
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.querySelector(".modal-backdrop")).toBeNull();
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.querySelector("[data-popup-backdrop]")).toBeNull();
  });
});

describe("PopupModal — branch coverage for guards", () => {
  // Line 116: if (!el) return false — !el true branch.
  // fireEvent always sets event.target to the element, so this guard is
  // unreachable via the component. Tested by calling the exported helper.
  it("isEditableTarget returns false when el is null or undefined", () => {
    expect(isEditableTarget(null)).toBe(false);
    expect(isEditableTarget(undefined)).toBe(false);
  });

  // Line 123: if (el.isContentEditable) return true.
  // JSDOM doesn't implement the live isContentEditable getter, so the existing
  // contentEditable-attribute test falls through to the attribute branch.
  // Overriding the getter via defineProperty exercises line 123 directly.
  it("isEditableTarget returns true when el.isContentEditable is true", () => {
    const div = document.createElement("div");
    Object.defineProperty(div, "isContentEditable", {
      value: true,
      configurable: true,
    });
    expect(isEditableTarget(div)).toBe(true);
  });

  // Lines 155-156: useState lazy initializer's typeof window === "undefined"
  // SSR fallback. Unreachable in JSDOM via render() because testing-library
  // itself needs window. Calling the extracted helper with global.window
  // temporarily deleted makes typeof window return "undefined".
  it("getInitialIsSmallViewport returns false when window is not defined", () => {
    const savedWindow = global.window;
    delete global.window;
    let result;
    try {
      result = getInitialIsSmallViewport();
    } finally {
      global.window = savedWindow;
    }
    expect(result).toBe(false);
  });

  // The position's SSR guards, reached the same way: with window deleted, both
  // helpers fall back to zero instead of throwing.
  it("getInitialViewportHeight and readHeaderHeight are zero when window is not defined", () => {
    const savedWindow = global.window;
    delete global.window;
    let height;
    let header;
    try {
      height = getInitialViewportHeight();
      header = readHeaderHeight();
    } finally {
      global.window = savedWindow;
    }
    expect(height).toBe(0);
    expect(header).toBe(0);
  });

  it("getInitialViewportHeight reads the window's height", () => {
    expect(getInitialViewportHeight()).toBe(window.innerHeight);
  });

  // Line 161: useEffect's typeof window === "undefined" SSR guard.
  // Same approach: call the extracted helper with window deleted and assert
  // the function returns undefined (no listener attached).
  it("trackSmallViewport returns undefined when window is not defined", () => {
    const savedWindow = global.window;
    delete global.window;
    let result;
    try {
      result = trackSmallViewport(() => {});
    } finally {
      global.window = savedWindow;
    }
    expect(result).toBeUndefined();
  });

  // Line 177: if (node) — false branch (containerRef.current is null).
  // In normal rendering React always populates the ref before useEffect runs.
  // Spy on React.useRef so .current stays null even after commit-phase
  // ref-attach (no-op setter), exercising the false branch.
  it("focus useEffect skips node.focus() when containerRef.current is null", () => {
    const realUseRef = useRef;
    jest.spyOn(React, "useRef").mockImplementationOnce(() => {
      const ref = realUseRef(null);
      Object.defineProperty(ref, "current", {
        get: () => null,
        set: () => {},
        configurable: true,
        enumerable: true,
      });
      return ref;
    });

    render(
      <PopupModal
        show={true}
        onClose={() => {}}
        position={CENTERED}
        title={<span id="t">t</span>}
        ariaLabelledBy="t"
      />,
    );

    // Modal renders without crashing. With containerRef.current null, the
    // focus effect's `if (node)` guard returned false instead of calling
    // node.focus(), so the dialog never received focus.
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).not.toHaveFocus();

    jest.restoreAllMocks();
  });
});

describe("PopupModal — header layout", () => {
  it("renders the leading slot empty when no leadingControls are supplied", () => {
    render(
      <PopupModal
        show={true}
        onClose={() => {}}
        position={CENTERED}
        title={<span id="t">Title</span>}
        ariaLabelledBy="t"
      />,
    );
    const leading = screen.getByTestId("popup-modal-header-leading");
    expect(leading).toBeInTheDocument();
    expect(leading).toBeEmptyDOMElement();
  });

  it("renders leadingControls inside the header's left slot", () => {
    render(
      <PopupModal
        show={true}
        onClose={() => {}}
        position={CENTERED}
        title={<span id="t">Title</span>}
        ariaLabelledBy="t"
        leadingControls={
          <button type="button" data-testid="my-leading-button">
            ◀ ▶
          </button>
        }
      />,
    );
    const leading = screen.getByTestId("popup-modal-header-leading");
    expect(leading).toContainElement(screen.getByTestId("my-leading-button"));
  });

  it("title slot is centered and truncates long content with ellipsis", () => {
    render(
      <PopupModal
        show={true}
        onClose={() => {}}
        position={CENTERED}
        title={
          <span id="t">
            A very long popup title that would overlap controls without
            truncation
          </span>
        }
        ariaLabelledBy="t"
      />,
    );
    const titleSlot = screen.getByTestId("popup-modal-header-title-slot");
    // The slot's computed style isn't fully resolved in jsdom, but
    // styled-components applies inline rules we can check directly via
    // the rule strings in toHaveStyle.
    expect(titleSlot).toHaveStyle("text-align: center");
    expect(titleSlot).toHaveStyle("white-space: nowrap");
    expect(titleSlot).toHaveStyle("overflow: hidden");
    expect(titleSlot).toHaveStyle("text-overflow: ellipsis");
  });
});

describe("draggedRect", () => {
  // The window below a 56px header, 1000px square.
  const area = { left: 0, top: 56, right: 1000, bottom: 1000 };
  const start = { left: 200, top: 300, right: 800, bottom: 700 };

  it.each([
    ["e", 50, 0, { ...start, right: 850 }],
    ["w", -50, 0, { ...start, left: 150 }],
    ["n", 0, -50, { ...start, top: 250 }],
    ["s", 0, 50, { ...start, bottom: 750 }],
    ["se", 50, 50, { ...start, right: 850, bottom: 750 }],
    ["nw", -50, -50, { ...start, left: 150, top: 250 }],
  ])("drags the %s edge by (%p, %p)", (edge, dx, dy, expected) => {
    expect(draggedRect(start, edge, dx, dy, area)).toEqual(expected);
  });

  it("moves the whole popup, keeping its size", () => {
    expect(draggedRect(start, "move", 30, -40, area)).toEqual({
      left: 230,
      top: 260,
      right: 830,
      bottom: 660,
    });
  });

  it("keeps a moved popup inside the window and below the header", () => {
    expect(draggedRect(start, "move", 900, -900, area)).toEqual({
      left: 400,
      top: 56,
      right: 1000,
      bottom: 456,
    });
  });

  it("stops an edge at the window and the header", () => {
    expect(draggedRect(start, "nw", -900, -900, area)).toEqual({
      ...start,
      left: 0,
      top: 56,
    });
  });

  it("never shrinks the popup past its minimum size", () => {
    expect(draggedRect(start, "se", -900, -900, area)).toEqual({
      ...start,
      right: start.left + MIN_POPUP_WIDTH_PX,
      bottom: start.top + MIN_POPUP_HEIGHT_PX,
    });
  });
});

describe("rectToPosition", () => {
  it("gives percentages of the window's width and of the area below the header", () => {
    expect(
      rectToPosition(
        { left: 100, top: 56 + 236, right: 600, bottom: 56 + 708 },
        { viewportWidth: 1000, viewportHeight: 1000, headerHeight: 56 },
      ),
    ).toEqual({ leftPct: 10, widthPct: 50, topPct: 25, heightPct: 50 });
  });
});

describe("PopupModal — dragging", () => {
  beforeAll(() => {
    // jsdom has no PointerEvent; a MouseEvent carries what a drag reads.
    if (!window.PointerEvent) window.PointerEvent = class extends MouseEvent {};
  });

  // The CENTERED popup in a 1000px square window: 20vw..80vw wide, and its
  // top and height as computePositionStyle places them.
  const renderAt = (position = CENTERED) => {
    setViewportWidth(1000);
    const utils = render(
      <PopupModal show onClose={() => {}} position={position}>
        <p>body</p>
      </PopupModal>,
    );
    const dialog = screen.getByRole("dialog");
    dialog.getBoundingClientRect = () => ({
      left: parseFloat(dialog.style.left) * 10,
      top: parseFloat(dialog.style.top),
      right:
        (parseFloat(dialog.style.left) + parseFloat(dialog.style.width)) * 10,
      bottom: parseFloat(dialog.style.top) + parseFloat(dialog.style.height),
    });
    return { ...utils, dialog };
  };
  const drag = (target, [x, y], [toX, toY]) => {
    fireEvent.pointerDown(target, { clientX: x, clientY: y, button: 0 });
    fireEvent.pointerMove(window, { clientX: toX, clientY: toY });
    fireEvent.pointerUp(window, { clientX: toX, clientY: toY });
  };

  it("resizes from an edge, and keeps that size for every later popup", () => {
    const { dialog, rerender } = renderAt();
    drag(screen.getByTestId("popup-modal-resize-e"), [800, 500], [900, 500]);
    expect(dialog.style.left).toBe("20vw");
    expect(dialog.style.width).toBe("70vw");

    // Closed, then reopened for another layer with its own configured size.
    const other = { leftPct: 50, topPct: 0, widthPct: 50, heightPct: 100 };
    rerender(<PopupModal show={false} onClose={() => {}} position={other} />);
    rerender(<PopupModal show onClose={() => {}} position={other} />);
    expect(screen.getByRole("dialog").style.width).toBe("70vw");
  });

  it("moves when its header is dragged", () => {
    const { dialog } = renderAt();
    const top = parseFloat(dialog.style.top);
    drag(
      screen.getByTestId("popup-modal-header"),
      [500, top + 10],
      [550, top + 40],
    );

    expect(dialog.style.left).toBe("25vw");
    expect(dialog.style.width).toBe("60vw");
    expect(dialog.style.top).toBe(`${top + 30}px`);
  });

  it("does not move when a button in the header is pressed", () => {
    const { dialog } = renderAt();
    const top = parseFloat(dialog.style.top);
    drag(
      screen.getByLabelText("Close popup"),
      [790, top + 10],
      [600, top + 200],
    );

    expect(dialog.style.left).toBe("20vw");
    expect(dialog.style.top).toBe(topFor(20));
  });

  it("stops following the pointer and restores text selection once released", () => {
    const { dialog } = renderAt();
    const edge = screen.getByTestId("popup-modal-resize-e");
    fireEvent.pointerDown(edge, { clientX: 800, clientY: 500, button: 0 });
    expect(document.body.style.userSelect).toBe("none");
    fireEvent.pointerMove(window, { clientX: 900, clientY: 500 });
    fireEvent.pointerUp(window, { clientX: 900, clientY: 500 });

    expect(document.body.style.userSelect).toBe("");
    fireEvent.pointerMove(window, { clientX: 950, clientY: 500 });
    expect(dialog.style.width).toBe("70vw");
  });

  it("ends a drag the browser cancels", () => {
    const { dialog } = renderAt();
    const edge = screen.getByTestId("popup-modal-resize-e");
    fireEvent.pointerDown(edge, { clientX: 800, clientY: 500, button: 0 });
    fireEvent.pointerCancel(window);

    expect(document.body.style.userSelect).toBe("");
    fireEvent.pointerMove(window, { clientX: 900, clientY: 500 });
    expect(dialog.style.width).toBe("60vw");
  });

  it("restores the page's own text selection after an overlapping drag", () => {
    // A second press while a drag is live, as a second finger makes.
    renderAt();
    const edge = screen.getByTestId("popup-modal-resize-e");
    fireEvent.pointerDown(edge, { clientX: 800, clientY: 500, button: 0 });
    fireEvent.pointerDown(edge, { clientX: 800, clientY: 500, button: 0 });
    fireEvent.pointerUp(window, { clientX: 800, clientY: 500 });

    expect(document.body.style.userSelect).toBe("");
  });

  it("ends a drag when the popup goes away mid-drag", () => {
    const { unmount } = renderAt();
    fireEvent.pointerDown(screen.getByTestId("popup-modal-resize-e"), {
      clientX: 800,
      clientY: 500,
      button: 0,
    });
    unmount();

    expect(document.body.style.userSelect).toBe("");
    expect(() =>
      fireEvent.pointerMove(window, { clientX: 900, clientY: 500 }),
    ).not.toThrow();
  });

  it("does not resize on a press of another button", () => {
    const { dialog } = renderAt();
    const edge = screen.getByTestId("popup-modal-resize-e");
    fireEvent.pointerDown(edge, { clientX: 800, clientY: 500, button: 2 });
    fireEvent.pointerMove(window, { clientX: 900, clientY: 500 });
    fireEvent.pointerUp(window, { clientX: 900, clientY: 500 });

    expect(dialog.style.width).toBe("60vw");
  });

  it("offers nothing to drag on a small screen", () => {
    setViewportWidth(500);
    render(
      <PopupModal show onClose={() => {}} position={CENTERED}>
        <p>body</p>
      </PopupModal>,
    );
    expect(screen.queryByTestId("popup-modal-resize-e")).toBeNull();
  });
});

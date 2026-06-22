import React, { useRef, useState } from "react";
import { act, render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PopupModal, {
  isEditableTarget,
  getInitialIsSmallViewport,
  trackSmallViewport,
} from "components/modals/PopupModal/PopupModal";

const ORIGINAL_INNER_WIDTH = window.innerWidth;

const CENTERED = { leftPct: 20, topPct: 20, widthPct: 60, heightPct: 60 };

afterEach(() => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: ORIGINAL_INNER_WIDTH,
  });
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
  it("renders the dialog when show=true with viewport-percent position", () => {
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
    expect(dialog).toHaveStyle("top: 25vh");
    expect(dialog).toHaveStyle("width: 60vw");
    expect(dialog).toHaveStyle("height: 50vh");
    expect(dialog).toHaveStyle("position: fixed");
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
      { left: "0vw", top: "0vh" },
    ],
    [
      { leftPct: 70, topPct: 0, widthPct: 30, heightPct: 30 },
      { left: "70vw", top: "0vh" },
    ],
    [
      { leftPct: 0, topPct: 70, widthPct: 30, heightPct: 30 },
      { left: "0vw", top: "70vh" },
    ],
    [
      { leftPct: 70, topPct: 70, widthPct: 30, heightPct: 30 },
      { left: "70vw", top: "70vh" },
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
      expect(dialog).toHaveStyle(`height: ${position.heightPct}vh`);
    },
  );
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
    // Near-fullscreen — uses inset rather than viewport-percent sizing.
    expect(dialog).toHaveStyle("top: 1rem");
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
    expect(dialog).toHaveStyle("top: 1rem");
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

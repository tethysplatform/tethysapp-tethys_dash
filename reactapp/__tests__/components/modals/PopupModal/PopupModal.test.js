import { useRef, useState } from "react";
import { act, render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PopupModal from "components/modals/PopupModal/PopupModal";

const ORIGINAL_INNER_WIDTH = window.innerWidth;

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
  it("renders the dialog when show=true with viewport-percent size and centered anchor", () => {
    render(
      <PopupModal
        show={true}
        onClose={() => {}}
        anchor={{ name: "center" }}
        size={{ widthPct: 60, heightPct: 50 }}
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

    // Width/height come through inline styles so jsdom can read them.
    expect(dialog).toHaveStyle("width: 60vw");
    expect(dialog).toHaveStyle("height: 50vh");
    // Centered uses transform translate.
    expect(dialog).toHaveStyle("transform: translate(-50%, -50%)");
    expect(dialog).toHaveStyle("position: fixed");
  });

  it("renders nothing when show=false", () => {
    render(
      <PopupModal
        show={false}
        onClose={() => {}}
        anchor={{ name: "center" }}
        size={{ widthPct: 60, heightPct: 50 }}
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
        anchor={{ name: "center" }}
        size={{ widthPct: 50, heightPct: 50 }}
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
    ["top-left", { top: "5px", left: "10px" }],
    ["top-right", { top: "5px", right: "10px" }],
    ["bottom-left", { bottom: "5px", left: "10px" }],
    ["bottom-right", { bottom: "5px", right: "10px" }],
  ])("positions correctly for anchor %s with offsets", (name, expected) => {
    render(
      <PopupModal
        show={true}
        onClose={() => {}}
        anchor={{ name, offsetX: 10, offsetY: 5 }}
        size={{ widthPct: 40, heightPct: 30 }}
        title={<span id="t">t</span>}
        ariaLabelledBy="t"
      />,
    );
    const dialog = screen.getByRole("dialog");
    Object.entries(expected).forEach(([prop, value]) => {
      expect(dialog).toHaveStyle(`${prop}: ${value}`);
    });
    expect(dialog).toHaveStyle("width: 40vw");
    expect(dialog).toHaveStyle("height: 30vh");
  });
});

describe("PopupModal — Esc to close", () => {
  it("Esc on the modal container fires onClose", () => {
    const onClose = jest.fn();
    render(
      <PopupModal
        show={true}
        onClose={onClose}
        anchor={{ name: "center" }}
        size={{ widthPct: 60, heightPct: 60 }}
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
        anchor={{ name: "center" }}
        size={{ widthPct: 60, heightPct: 60 }}
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
        anchor={{ name: "center" }}
        size={{ widthPct: 60, heightPct: 60 }}
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
        anchor={{ name: "center" }}
        size={{ widthPct: 60, heightPct: 60 }}
        title={<span id="t">t</span>}
        ariaLabelledBy="t"
      >
        <div contentEditable="true" data-testid="child-ce" suppressContentEditableWarning>
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
        anchor={{ name: "center" }}
        size={{ widthPct: 60, heightPct: 60 }}
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
  it("ignores anchor/size at viewport widths below 768px", () => {
    setViewportWidth(700);

    render(
      <PopupModal
        show={true}
        onClose={() => {}}
        anchor={{ name: "top-left", offsetX: 100, offsetY: 100 }}
        size={{ widthPct: 30, heightPct: 30 }}
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

  it("switches between fullscreen and anchored layout on resize", () => {
    setViewportWidth(1200);
    render(
      <PopupModal
        show={true}
        onClose={() => {}}
        anchor={{ name: "center" }}
        size={{ widthPct: 50, heightPct: 50 }}
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
            anchor={{ name: "center" }}
            size={{ widthPct: 60, heightPct: 60 }}
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
          <button type="button" onClick={() => setShow(false)} data-testid="closer">
            close
          </button>
          <PopupModal
            show={show}
            onClose={() => setShow(false)}
            anchor={{ name: "center" }}
            size={{ widthPct: 60, heightPct: 60 }}
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
          <button type="button" onClick={() => setShow(false)} data-testid="closer">
            close
          </button>
          <PopupModal
            show={show}
            onClose={() => setShow(false)}
            anchor={{ name: "center" }}
            size={{ widthPct: 60, heightPct: 60 }}
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
        anchor={{ name: "center" }}
        size={{ widthPct: 60, heightPct: 60 }}
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
        anchor={{ name: "center" }}
        size={{ widthPct: 60, heightPct: 60 }}
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
        anchor={{ name: "center" }}
        size={{ widthPct: 60, heightPct: 60 }}
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
        anchor={{ name: "center" }}
        size={{ widthPct: 60, heightPct: 60 }}
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
        anchor={{ name: "center" }}
        size={{ widthPct: 60, heightPct: 60 }}
        title={<span id="my-title-id">Hi</span>}
        ariaLabelledBy="my-title-id"
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-labelledby", "my-title-id");
    expect(screen.getByText("Hi")).toHaveAttribute("id", "my-title-id");
  });

  it("falls back to aria-label when ariaLabelledBy is omitted", () => {
    render(
      <PopupModal
        show={true}
        onClose={() => {}}
        anchor={{ name: "center" }}
        size={{ widthPct: 60, heightPct: 60 }}
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).not.toHaveAttribute("aria-labelledby");
    expect(dialog).toHaveAttribute("aria-label", "Popup Modal");
  });

  it("does not render a backdrop element (R15 — map stays interactive)", () => {
    render(
      <PopupModal
        show={true}
        onClose={() => {}}
        anchor={{ name: "center" }}
        size={{ widthPct: 60, heightPct: 60 }}
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

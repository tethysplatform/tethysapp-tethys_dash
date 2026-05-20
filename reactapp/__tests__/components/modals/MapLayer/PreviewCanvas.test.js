import React, { useRef } from "react";
import { render, screen, fireEvent, createEvent } from "@testing-library/react";
import PreviewCanvas, {
  computeNextPosition,
} from "components/modals/MapLayer/PreviewCanvas";

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 225; // 16:9
const DEFAULT_VALUE = {
  leftPct: 20,
  topPct: 20,
  widthPct: 60,
  heightPct: 60,
};

beforeEach(() => {
  // jsdom defaults `getBoundingClientRect` to all-zero, which would cause every
  // delta-based percentage calculation to be NaN. Stub a real-looking rect on
  // any element under test so the canvas pixel→percent math runs.
  jest
    .spyOn(Element.prototype, "getBoundingClientRect")
    .mockImplementation(() => ({
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      top: 0,
      left: 0,
      right: CANVAS_WIDTH,
      bottom: CANVAS_HEIGHT,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }));
});

afterEach(() => {
  jest.restoreAllMocks();
});

function renderCanvas(initial = DEFAULT_VALUE) {
  const onChange = jest.fn();
  let current = initial;
  const handleChange = (next) => {
    current = next;
    onChange(next);
  };
  const utils = render(
    <PreviewCanvas value={current} onChange={handleChange} />,
  );
  return {
    ...utils,
    onChange,
    get value() {
      return current;
    },
  };
}

// jsdom's pointer-event constructor drops clientX/clientY/pointerId from the
// init dict; setting them via defineProperty after createEvent is the
// portable workaround used by react-testing-library examples.
function pointer(target, type, clientX, clientY, pointerId = 1) {
  const event = createEvent[type](target, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clientX", { value: clientX });
  Object.defineProperty(event, "clientY", { value: clientY });
  Object.defineProperty(event, "pointerId", { value: pointerId });
  Object.defineProperty(event, "pointerType", { value: "mouse" });
  Object.defineProperty(event, "button", { value: 0 });
  fireEvent(target, event);
}

describe("computeNextPosition (pure function)", () => {
  const start = { ...DEFAULT_VALUE };

  it("body drag translates leftPct/topPct without changing size", () => {
    const next = computeNextPosition("body", start, 10, 5, 20, 20);
    expect(next).toEqual({
      leftPct: 30,
      topPct: 25,
      widthPct: 60,
      heightPct: 60,
    });
  });

  it("body drag clamps so the rect stays within 0..100", () => {
    const left = computeNextPosition("body", start, -50, 0, 20, 20);
    expect(left.leftPct).toBe(0);
    const right = computeNextPosition("body", start, 90, 0, 20, 20);
    expect(right.leftPct).toBe(100 - start.widthPct); // 40
    const top = computeNextPosition("body", start, 0, -50, 20, 20);
    expect(top.topPct).toBe(0);
    const bottom = computeNextPosition("body", start, 0, 90, 20, 20);
    expect(bottom.topPct).toBe(100 - start.heightPct);
  });

  it("east handle grows widthPct without moving leftPct", () => {
    const next = computeNextPosition("e", start, 10, 0, 20, 20);
    expect(next.leftPct).toBe(start.leftPct);
    expect(next.widthPct).toBe(70);
  });

  it("east handle clamps width to remaining space", () => {
    const next = computeNextPosition("e", start, 100, 0, 20, 20);
    expect(next.widthPct).toBe(100 - start.leftPct); // 80
  });

  it("east handle clamps width to minWidth", () => {
    const next = computeNextPosition("e", start, -100, 0, 20, 20);
    expect(next.widthPct).toBe(20);
  });

  it("west handle moves leftPct and adjusts widthPct in tandem", () => {
    const next = computeNextPosition("w", start, 10, 0, 20, 20);
    expect(next.leftPct).toBe(30);
    expect(next.widthPct).toBe(50);
  });

  it("south handle grows heightPct from the top edge", () => {
    const next = computeNextPosition("s", start, 0, 10, 20, 20);
    expect(next.topPct).toBe(start.topPct);
    expect(next.heightPct).toBe(70);
  });

  it("north handle moves topPct and adjusts heightPct in tandem", () => {
    const next = computeNextPosition("n", start, 0, 10, 20, 20);
    expect(next.topPct).toBe(30);
    expect(next.heightPct).toBe(50);
  });

  it("corner handle (se) composes east + south axes", () => {
    const next = computeNextPosition("se", start, 10, 5, 20, 20);
    expect(next.widthPct).toBe(70);
    expect(next.heightPct).toBe(65);
  });

  it("corner handle (nw) composes west + north axes", () => {
    const next = computeNextPosition("nw", start, 10, 5, 20, 20);
    expect(next.leftPct).toBe(30);
    expect(next.widthPct).toBe(50);
    expect(next.topPct).toBe(25);
    expect(next.heightPct).toBe(55);
  });
});

describe("PreviewCanvas — pointer-driven rendering", () => {
  it("renders the rect at the configured percent position", () => {
    renderCanvas();
    const rect = screen.getByTestId("popup-preview-rect");
    expect(rect).toHaveStyle("left: 20%");
    expect(rect).toHaveStyle("top: 20%");
    expect(rect).toHaveStyle("width: 60%");
    expect(rect).toHaveStyle("height: 60%");
  });

  it("renders 8 resize handles (4 corners + 4 edges)", () => {
    renderCanvas();
    ["n", "s", "e", "w", "ne", "nw", "se", "sw"].forEach((mode) => {
      expect(
        screen.getByTestId(`popup-preview-handle-${mode}`),
      ).toBeInTheDocument();
    });
  });

  it("dragging the body emits an onChange that translates the rect", () => {
    const { onChange } = renderCanvas();
    const rect = screen.getByTestId("popup-preview-rect");

    // Start drag at (100, 100) within a 400x225 canvas.
    pointer(rect, "pointerDown", 100, 100);
    // Move 40px right (10% of 400) and 22.5px down (10% of 225).
    pointer(rect, "pointerMove", 140, 122.5);

    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCall.leftPct).toBeCloseTo(30, 5);
    expect(lastCall.topPct).toBeCloseTo(30, 5);
    expect(lastCall.widthPct).toBe(60);
    expect(lastCall.heightPct).toBe(60);
  });

  it("dragging the east handle resizes width without moving left", () => {
    const { onChange } = renderCanvas();
    const handle = screen.getByTestId("popup-preview-handle-e");

    pointer(handle, "pointerDown", 200, 100);
    pointer(handle, "pointerMove", 240, 100); // +10% width

    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCall.leftPct).toBe(20);
    expect(lastCall.widthPct).toBeCloseTo(70, 5);
  });

  it("releases pointer on pointerUp and stops emitting on subsequent moves", () => {
    const { onChange } = renderCanvas();
    const rect = screen.getByTestId("popup-preview-rect");

    pointer(rect, "pointerDown", 100, 100);
    pointer(rect, "pointerMove", 120, 110);
    expect(onChange).toHaveBeenCalled();
    onChange.mockClear();

    pointer(rect, "pointerUp", 120, 110);
    pointer(rect, "pointerMove", 200, 200);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("no onChange fires before pointerDown", () => {
    const { onChange } = renderCanvas();
    const rect = screen.getByTestId("popup-preview-rect");
    pointer(rect, "pointerMove", 200, 200);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("calls setPointerCapture on the target when the method is available (covers lines 148-149)", () => {
    // JSDOM doesn't ship setPointerCapture on Elements, so the production
    // `if (e.target.setPointerCapture)` guard normally short-circuits. Assigning
    // a spy directly onto the rect node makes the guard truthy so the try block
    // runs and we can verify setPointerCapture was called with the pointer id.
    renderCanvas();
    const rect = screen.getByTestId("popup-preview-rect");
    const setPointerCaptureSpy = jest.fn();
    rect.setPointerCapture = setPointerCaptureSpy;

    pointer(rect, "pointerDown", 100, 100);

    expect(setPointerCaptureSpy).toHaveBeenCalledWith(1);
  });

  it("calls releasePointerCapture on the target when the method is available (covers lines 180-181)", () => {
    // Same approach as the setPointerCapture coverage test: attach a spy so the
    // releasePointerCapture guard inside handlePointerUp enters its try block.
    // pointerDown must fire first so dragRef.current is set — otherwise
    // handlePointerUp returns early at the `if (!dragRef.current) return` guard.
    renderCanvas();
    const rect = screen.getByTestId("popup-preview-rect");
    const releasePointerCaptureSpy = jest.fn();
    rect.setPointerCapture = jest.fn();
    rect.releasePointerCapture = releasePointerCaptureSpy;

    pointer(rect, "pointerDown", 100, 100);
    pointer(rect, "pointerUp", 100, 100);

    expect(releasePointerCaptureSpy).toHaveBeenCalledWith(1);
  });

  it("handlePointerDown returns early when canvasRef is unattached (covers line 135 true branch)", () => {
    // Spy on React.useRef so canvasRef.current is permanently null. We call the
    // real useRef to register the fiber hook slot (otherwise the next render's
    // hook reconciliation crashes), then replace .current with an accessor
    // whose setter is a no-op so React's commit-phase ref-attach can't populate
    // it. canvasRef is the first useRef call in PreviewCanvas, so
    // mockImplementationOnce targets exactly that ref.
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

    const onChange = jest.fn();
    render(<PreviewCanvas value={DEFAULT_VALUE} onChange={onChange} />);

    const rect = screen.getByTestId("popup-preview-rect");
    const setPointerCaptureSpy = jest.fn();
    rect.setPointerCapture = setPointerCaptureSpy;

    pointer(rect, "pointerDown", 100, 100);

    // The `if (!canvas) return` guard fired before setPointerCapture or any
    // dragRef state could be set.
    expect(setPointerCaptureSpy).not.toHaveBeenCalled();

    // And because dragRef.current is still null, a follow-up move emits nothing.
    pointer(rect, "pointerMove", 200, 200);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("handlePointerUp returns early when no drag is in progress (covers line 178 true branch)", () => {
    // Firing pointerUp with no prior pointerDown means dragRef.current is null,
    // so the guard returns before reaching releasePointerCapture.
    renderCanvas();
    const rect = screen.getByTestId("popup-preview-rect");

    const releasePointerCaptureSpy = jest.fn();
    rect.releasePointerCapture = releasePointerCaptureSpy;

    pointer(rect, "pointerUp", 100, 100);

    expect(releasePointerCaptureSpy).not.toHaveBeenCalled();
  });

  it("disabled hides handles and ignores pointer drags", () => {
    const onChange = jest.fn();
    render(
      <PreviewCanvas value={DEFAULT_VALUE} onChange={onChange} disabled />,
    );

    expect(screen.queryByTestId("popup-preview-handle-e")).toBeNull();

    pointer(screen.getByTestId("popup-preview-rect"), "pointerDown", 100, 100);
    pointer(screen.getByTestId("popup-preview-rect"), "pointerMove", 200, 200);
    expect(onChange).not.toHaveBeenCalled();
  });
});

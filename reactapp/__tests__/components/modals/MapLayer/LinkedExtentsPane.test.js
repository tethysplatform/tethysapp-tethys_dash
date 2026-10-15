import { useRef, useState } from "react";
import PropTypes from "prop-types";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LinkedExtentsPane from "components/modals/MapLayer/LinkedExtentsPane";

let latest;
const Harness = ({ initial }) => {
  const [style, setStyle] = useState(initial);
  const containerRef = useRef(null);
  return (
    <div ref={containerRef}>
      <LinkedExtentsPane
        style={style}
        onChange={(next) => {
          latest = next;
          setStyle(next);
        }}
        containerRef={containerRef}
      />
    </div>
  );
};
Harness.propTypes = { initial: PropTypes.object };

beforeEach(() => {
  latest = undefined;
});

test("a pane given no style starts one on the first edit", () => {
  render(<Harness />);

  fireEvent.change(screen.getByLabelText("Outline Width"), {
    target: { value: "4" },
  });

  expect(latest).toEqual({ width: 4 });
});

test("clearing the width removes the key rather than storing a blank", () => {
  render(<Harness initial={{ color: "#0000ff", width: 3 }} />);

  fireEvent.change(screen.getByLabelText("Outline Width"), {
    target: { value: "" },
  });

  expect(latest).toEqual({ color: "#0000ff" });
  expect(screen.getByLabelText("Outline Width")).toHaveValue("");
});

describe("the color controls", () => {
  // react-color-palette measures its saturation area; jsdom has no observer.
  let realResizeObserver;
  beforeAll(() => {
    realResizeObserver = global.ResizeObserver;
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });
  afterAll(() => {
    if (realResizeObserver) global.ResizeObserver = realResizeObserver;
    else delete global.ResizeObserver;
  });

  const pickColor = (label, hex) => {
    fireEvent.click(screen.getByLabelText(`${label} color popover square`));
    fireEvent.change(screen.getByRole("textbox", { name: "HEX" }), {
      target: { value: hex },
    });
  };

  test("picking an outline color stores it beside the other settings", async () => {
    render(<Harness initial={{ width: 3 }} />);

    pickColor("Outline Color", "#2aff00");

    await waitFor(() => expect(latest).toEqual({ width: 3, color: "#2aff00" }));
  });

  test("picking a fill color stores it without disturbing the outline color", async () => {
    render(<Harness initial={{ color: "#112233" }} />);

    pickColor("Fill Color", "#00ffff");

    await waitFor(() =>
      expect(latest).toEqual({ color: "#112233", fillColor: "#00ffff" }),
    );
  });
});

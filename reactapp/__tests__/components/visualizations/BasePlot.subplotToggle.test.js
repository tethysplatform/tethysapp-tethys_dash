import { render, screen, fireEvent } from "@testing-library/react";
import { createRef } from "react";

// --- Mocks: capture the props handed to the Plotly component, and drive the
// resize-detector size so we can simulate a resize. ---------------------------
// (mock factories may only reference globals, not module-scoped vars)
jest.mock("react-resize-detector", () => ({
  useResizeDetector: () => ({
    width: global.__resizeSize.width,
    height: global.__resizeSize.height,
    ref: { current: null },
  }),
}));

jest.mock("react-plotly.js/factory", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: () =>
      function MockPlot(props) {
        global.__plotProps = props;
        return React.createElement("div", {
          className: props.className,
          "data-testid": "plot",
        });
      },
  };
});

jest.mock("plotly.js-strict-dist-min", () => ({
  relayout: jest.fn(),
  purge: jest.fn(),
}));

// eslint-disable-next-line import/first
import BasePlot from "components/visualizations/BasePlot";
// eslint-disable-next-line import/first
import {
  VariableInputsContext,
  GridItemContext,
  DataViewerModeContext,
} from "components/contexts/Contexts";

// Vertical stack of three rows, each with a right-side overlay and a dedicated
// x-axis sharing one x-domain (mirrors tethysapp .../data.json).
const figure = () => ({
  data: [
    { name: "Temp", xaxis: "x", yaxis: "y" }, // 0
    { name: "RH", xaxis: "x", yaxis: "y2" }, // 1 (overlay)
    { name: "MSLP", xaxis: "x2", yaxis: "y3" }, // 2
    { name: "Solar", xaxis: "x2", yaxis: "y4" }, // 3 (overlay)
    { name: "Wind", xaxis: "x3", yaxis: "y5" }, // 4
  ],
  layout: {
    xaxis: { domain: [0, 0.94], anchor: "y", matches: "x3" },
    xaxis2: { domain: [0, 0.94], anchor: "y3", matches: "x3" },
    xaxis3: { domain: [0, 0.94], anchor: "y5" },
    yaxis: { domain: [0.7, 1.0], anchor: "x", title: { text: "Temperature" } },
    yaxis2: { anchor: "x", overlaying: "y", side: "right" },
    yaxis3: { domain: [0.35, 0.65], anchor: "x2", title: { text: "Pressure" } },
    yaxis4: { anchor: "x2", overlaying: "y3", side: "right" },
    yaxis5: { domain: [0, 0.3], anchor: "x3", title: { text: "Wind" } },
    annotations: [
      { text: "Temperature", xref: "x domain", yref: "y domain", x: 0, y: 1 },
      { text: "Pressure", xref: "x2 domain", yref: "y3 domain", x: 0, y: 1 },
      { text: "Wind", xref: "x3 domain", yref: "y5 domain", x: 0, y: 1 },
    ],
    shapes: [
      { type: "line", xref: "x2", yref: "y3", x0: 0, x1: 1, y0: 1, y1: 2 },
    ],
  },
});

const renderPlot = (metadata) => {
  const { data, layout } = figure();
  return render(
    <VariableInputsContext.Provider
      value={{ variableInputDateFormats: {}, variableInputValues: {} }}
    >
      <GridItemContext.Provider value={{ gridItemArgsString: "{}" }}>
        <DataViewerModeContext.Provider value={{ mode: "default" }}>
          <BasePlot
            data={data}
            layout={layout}
            config={{ responsive: true }}
            visualizationRef={createRef()}
            metadata={metadata}
          />
        </DataViewerModeContext.Provider>
      </GridItemContext.Provider>
    </VariableInputsContext.Provider>,
  );
};

beforeEach(() => {
  global.__resizeSize = { width: 500, height: 300 };
  global.__plotProps = undefined;
});

describe("BasePlot subplot toggle", () => {
  it("does not render the control when toggle_subplots is off", () => {
    renderPlot({});
    expect(
      screen.queryByTestId("subplot-toggle-control"),
    ).not.toBeInTheDocument();
    // Original data passed through untouched.
    expect(global.__plotProps.data[2].visible).toBeUndefined();
  });

  it("renders all panes visible initially with the original figure untouched", () => {
    renderPlot({ toggle_subplots: true });
    expect(screen.getByTestId("subplot-toggle-control")).toBeInTheDocument();
    // No trace hidden, no domain rewrite while everything is visible.
    global.__plotProps.data.forEach((t) => expect(t.visible).toBeUndefined());
    expect(global.__plotProps.layout.yaxis.domain).toEqual([0.7, 1.0]);
  });

  it("hides a pane's traces + exclusive axes and reflows the rest", () => {
    renderPlot({ toggle_subplots: true });
    fireEvent.click(screen.getByLabelText("Toggle subplots"));
    fireEvent.click(screen.getByLabelText("Pressure")); // hide middle row

    const { data, layout } = global.__plotProps;
    // Pressure row traces hidden (primary + overlay).
    expect(data[2].visible).toBe(false);
    expect(data[3].visible).toBe(false);
    // Other rows still visible.
    expect(data[0].visible).toBe(true);
    expect(data[4].visible).toBe(true);
    // Pressure's exclusive axes hidden.
    expect(layout.yaxis3.visible).toBe(false);
    expect(layout.yaxis4.visible).toBe(false);
    expect(layout.xaxis2.visible).toBe(false);
    // Remaining two rows reflow to fill the vertical space.
    expect(layout.yaxis.domain[1]).toBeCloseTo(1, 6);
    expect(layout.yaxis5.domain[0]).toBeCloseTo(0, 6);
    // Overlay axis never receives a domain.
    expect(layout.yaxis2.domain).toBeUndefined();
    // The hidden row's annotation and drawing are hidden too; others stay.
    expect(layout.annotations[1].visible).toBe(false); // Pressure title
    expect(layout.shapes[0].visible).toBe(false); // Pressure drawing
    expect(layout.annotations[0].visible).toBeUndefined(); // Temperature title
    expect(layout.annotations[2].visible).toBeUndefined(); // Wind title
  });

  it("does not revert the toggle when the plot resizes", () => {
    renderPlot({ toggle_subplots: true });
    fireEvent.click(screen.getByLabelText("Toggle subplots"));
    fireEvent.click(screen.getByLabelText("Pressure"));
    expect(global.__plotProps.data[2].visible).toBe(false);

    // Simulate a resize: width changes, component re-renders.
    global.__resizeSize = { width: 900, height: 300 };
    fireEvent.click(screen.getByLabelText("Wind")); // any state change triggers re-render
    fireEvent.click(screen.getByLabelText("Wind")); // toggle back on

    expect(global.__plotProps.layout.width).toBe(900);
    // The Pressure toggle survived the resize/re-render.
    expect(global.__plotProps.data[2].visible).toBe(false);
    expect(global.__plotProps.layout.yaxis3.visible).toBe(false);
  });

  it("keeps at least one pane visible", () => {
    renderPlot({ toggle_subplots: true });
    fireEvent.click(screen.getByLabelText("Toggle subplots"));
    fireEvent.click(screen.getByLabelText("Temperature"));
    fireEvent.click(screen.getByLabelText("Pressure"));
    fireEvent.click(screen.getByLabelText("Wind")); // attempt to hide the last

    // Wind cannot be hidden — its traces remain visible.
    expect(global.__plotProps.data[4].visible).toBe(true);
  });

  it("coexists with a vertical line without crashing", () => {
    expect(() =>
      renderPlot({
        toggle_subplots: true,
        plotlyVerticalLine: { mode: "on", value: "2026-06-10T00:00:00" },
      }),
    ).not.toThrow();
    expect(screen.getByTestId("subplot-toggle-control")).toBeInTheDocument();
  });
});

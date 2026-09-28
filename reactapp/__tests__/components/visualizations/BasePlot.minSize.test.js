import { render, screen } from "@testing-library/react";
import { createRef } from "react";

// --- Mocks: capture the props handed to the Plotly component, and drive the
// resize-detector size so we can simulate a tile of a given size. ------------
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

// Two stacked panes, the shape this feature exists for: a tall figure in
// a short tile.
const figure = () => ({
  data: [
    { name: "Flow", xaxis: "x", yaxis: "y" },
    { name: "Stage", xaxis: "x2", yaxis: "y2" },
  ],
  layout: {
    // A plugin asking for far more room than the tile has. Ignored on its
    // own -- only metadata.min_plot_height changes anything.
    height: 900,
    xaxis: { domain: [0, 1], anchor: "y", matches: "x2" },
    xaxis2: { domain: [0, 1], anchor: "y2" },
    yaxis: { domain: [0.55, 1], anchor: "x", title: { text: "Flow" } },
    yaxis2: { domain: [0, 0.45], anchor: "x2", title: { text: "Stage" } },
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

const scroller = () => screen.getByTestId("plot").parentElement;
const overflowY = () => window.getComputedStyle(scroller()).overflowY;
const overflowX = () => window.getComputedStyle(scroller()).overflowX;

beforeEach(() => {
  global.__resizeSize = { width: 500, height: 300 };
  global.__plotProps = undefined;
});

describe("BasePlot minimum plot size", () => {
  it("sizes the plot to the tile when no minimum is given", () => {
    renderPlot({});
    expect(global.__plotProps.layout.height).toBe(300);
    expect(global.__plotProps.layout.width).toBe(500);
    expect(overflowY()).toBe("visible");
  });

  it("ignores the figure's own layout.height", () => {
    // The plugin asked for 900; the tile still wins.
    renderPlot({});
    expect(global.__plotProps.layout.height).toBe(300);
  });

  it("holds the plot at the minimum and scrolls when the tile is shorter", () => {
    renderPlot({ min_plot_height: 800 });
    expect(global.__plotProps.layout.height).toBe(800);
    // Width is untouched: the scroll box is measured, so its content-box
    // width already excludes the scrollbar.
    expect(global.__plotProps.layout.width).toBe(500);
    expect(overflowY()).toBe("auto");
  });

  it("does not scroll when the tile is already tall enough", () => {
    global.__resizeSize = { width: 500, height: 1000 };
    renderPlot({ min_plot_height: 800 });
    expect(global.__plotProps.layout.height).toBe(1000);
    expect(overflowY()).toBe("visible");
  });

  it("does nothing before the tile has been measured", () => {
    global.__resizeSize = { width: undefined, height: undefined };
    renderPlot({ min_plot_height: 800 });
    expect(global.__plotProps.layout.height).toBeUndefined();
    expect(overflowY()).toBe("visible");
  });

  it("ignores a minimum that is not a positive number", () => {
    for (const bad of [0, -100, "tall", null]) {
      global.__plotProps = undefined;
      const { unmount } = renderPlot({ min_plot_height: bad });
      expect(global.__plotProps.layout.height).toBe(300);
      unmount();
    }
  });

  it("holds the plot at the minimum width and scrolls when the tile is narrower", () => {
    renderPlot({ min_plot_width: 900 });
    expect(global.__plotProps.layout.width).toBe(900);
    expect(global.__plotProps.layout.height).toBe(300);
    expect(overflowX()).toBe("auto");
    expect(overflowY()).toBe("visible");
  });

  it("does not scroll horizontally when the tile is already wide enough", () => {
    renderPlot({ min_plot_width: 400 });
    expect(global.__plotProps.layout.width).toBe(500);
    expect(overflowX()).toBe("hidden");
  });

  it("never scrolls horizontally without a minimum width", () => {
    // A plot is fitted to the measured width, so a horizontal scrollbar
    // would only ever be an artefact.
    renderPlot({ min_plot_height: 800 });
    expect(overflowX()).toBe("hidden");
  });

  it("applies both floors at once", () => {
    renderPlot({ min_plot_width: 900, min_plot_height: 800 });
    expect(global.__plotProps.layout.width).toBe(900);
    expect(global.__plotProps.layout.height).toBe(800);
    expect(overflowX()).toBe("auto");
    expect(overflowY()).toBe("auto");
  });

  it("ignores a width that is not a positive number", () => {
    for (const bad of [0, -100, "wide", null]) {
      global.__plotProps = undefined;
      const { unmount } = renderPlot({ min_plot_width: bad });
      expect(global.__plotProps.layout.width).toBe(500);
      unmount();
    }
  });

  it("keeps the subplot toggle control outside the scrolling box", () => {
    renderPlot({ min_plot_height: 800, toggle_subplots: true });
    const control = screen.getByTestId("subplot-toggle-control");
    // Anchored to the outer box, so it stays put while the figure scrolls.
    expect(scroller()).not.toContainElement(control);
  });
});

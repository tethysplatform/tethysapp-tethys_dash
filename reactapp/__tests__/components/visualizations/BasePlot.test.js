const mockRelayout = jest.fn();
const mockPlotly = {
  relayout: mockRelayout,
  purge: jest.fn(),
  newPlot: jest.fn(),
  react: jest.fn(),
  resize: jest.fn(),
};
jest.mock("plotly.js-strict-dist-min", () => mockPlotly);

// eslint-disable-next-line
import { render, screen } from "@testing-library/react";
// eslint-disable-next-line
import React from "react";

const {
  default: BasePlot,
  addVerticalLine,
} = require("components/visualizations/BasePlot");

// Helper to create a mock plotRef
function createMockPlotRef(layout = {}) {
  return {
    current: {
      el: { layout },
    },
  };
}

beforeEach(() => {
  delete window.ResizeObserver;
  window.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));
});

afterEach(() => {
  window.ResizeObserver = ResizeObserver;
  jest.restoreAllMocks();
});

describe("BasePlot", () => {
  it("renders with data, layout, and config", () => {
    const data = [{ x: [1, 2], y: [3, 4], type: "scatter" }];
    const layout = { title: "Test Plot" };
    const config = { responsive: true };
    const { container } = render(
      <BasePlot
        data={data}
        layout={layout}
        config={config}
        visualizationRef={React.createRef()}
      />
    );
    // Should render a plot container div with flex style
    const plotDiv = container.querySelector('div[style*="display: flex"]');
    expect(plotDiv).toBeInTheDocument();
  });
});

describe("addVerticalLine", () => {
  beforeEach(() => {
    mockRelayout.mockClear();
  });

  it("handles layout with no shapes property (undefined)", () => {
    const plotRef = createMockPlotRef({}); // layout has no shapes
    addVerticalLine(plotRef, "2022-01-01");
    const shapes = mockRelayout.mock.calls[0][1].shapes;
    expect(Array.isArray(shapes)).toBe(true);
    expect(shapes.length).toBe(1);
    expect(shapes[0].type).toBe("line");
  });

  it("sets both id and variable properties in meta for the vertical line shape", () => {
    const plotRef = createMockPlotRef({ shapes: [] });
    addVerticalLine(plotRef, "2022-01-01", {
      id: "custom_id_123",
      variable: "custom_var_456",
    });
    const shapes = mockRelayout.mock.calls[0][1].shapes;
    expect(shapes[0].meta.id).toBe("custom_id_123");
    expect(shapes[0].meta.variable).toBe("custom_var_456");
  });

  it("sets the variable property in meta for the vertical line shape", () => {
    const plotRef = createMockPlotRef({ shapes: [] });
    addVerticalLine(plotRef, "2022-01-01", { variable: "myVar" });
    const shapes = mockRelayout.mock.calls[0][1].shapes;
    expect(shapes[0].meta.variable).toBe("myVar");
  });

  it("adds a vertical line with default options", () => {
    const plotRef = createMockPlotRef({ shapes: [] });
    addVerticalLine(plotRef, "2022-01-01");
    expect(mockRelayout).toHaveBeenCalledWith(
      plotRef.current.el,
      expect.objectContaining({ shapes: expect.any(Array) })
    );
    const shapes = mockRelayout.mock.calls[0][1].shapes;
    expect(shapes[0].type).toBe("line");
    expect(shapes[0].x0).toContain("2022-01-01T00:00:00.000Z");
    expect(shapes[0].line.color).toBe("red");
  });

  it("sets the id property in meta for the vertical line shape", () => {
    const plotRef = createMockPlotRef({ shapes: [] });
    addVerticalLine(plotRef, "2022-01-01", { id: "test_vline_id" });
    const shapes = mockRelayout.mock.calls[0][1].shapes;
    expect(shapes[0].meta.id).toBe("test_vline_id");
  });

  it("removes existing vertical lines if removeExisting is true", () => {
    const existingShape = {
      type: "line",
      meta: { createdBy: "addVerticalLine" },
    };
    const plotRef = createMockPlotRef({ shapes: [existingShape] });
    addVerticalLine(plotRef, "2022-01-01", { removeExisting: true });
    const shapes = mockRelayout.mock.calls[0][1].shapes;
    expect(shapes.length).toBe(1);
    expect(shapes[0].meta.createdBy).toBe("addVerticalLine");
  });

  it("does not add a line if plotRef is missing", () => {
    addVerticalLine(null, "2022-01-01");
    expect(mockRelayout).not.toHaveBeenCalled();
  });

  it("handles xValue as datetime string with time", () => {
    const plotRef = createMockPlotRef({ shapes: [] });
    addVerticalLine(plotRef, "2022-01-01 12:34");
    const shapes = mockRelayout.mock.calls[0][1].shapes;
    expect(shapes[0].x0).toContain("2022-01-01T12:34:00.000Z");
  });

  it("handles xValue as number", () => {
    const plotRef = createMockPlotRef({ shapes: [] });
    addVerticalLine(plotRef, 123);
    const shapes = mockRelayout.mock.calls[0][1].shapes;
    expect(shapes[0].x0).toBe("1970-01-01T00:00:00.123Z");
  });

  it("handles xValue as new format", () => {
    const plotRef = createMockPlotRef({ shapes: [] });
    addVerticalLine(plotRef, "1970-01-01T00");
    const shapes = mockRelayout.mock.calls[0][1].shapes;
    expect(shapes[0].x0).toBe("1970-01-01T00");
  });

  it("handles custom options", () => {
    const plotRef = createMockPlotRef({ shapes: [] });
    addVerticalLine(plotRef, "2022-01-01", {
      color: "blue",
      width: 5,
      dash: "dot",
      id: "custom_id",
    });
    const shapes = mockRelayout.mock.calls[0][1].shapes;
    expect(shapes[0].line.color).toBe("blue");
    expect(shapes[0].line.width).toBe(5);
    expect(shapes[0].line.dash).toBe("dot");
    expect(shapes[0].meta.id).toBe("custom_id");
  });

  it("plotly relayout error handling", () => {
    const plotRef = createMockPlotRef({ shapes: [] });
    mockPlotly.relayout.mockImplementationOnce(() => {
      throw new Error("Relayout failed");
    });
    console.warn = jest.fn();
    addVerticalLine(plotRef, "2022-01-01");
    expect(console.warn).toHaveBeenCalledWith(
      "Failed to add vertical line:",
      expect.any(Error)
    );
  });
});

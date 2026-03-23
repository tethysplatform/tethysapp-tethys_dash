import { render } from "@testing-library/react";
import { createRef } from "react";
import BasePlot, {
  createVerticalLine,
  formatToDate,
  snapDate,
  normalizedToDate,
  paperToAxisNormalized,
  handleEventData,
} from "components/visualizations/BasePlot";
import {
  VariableInputsContext,
  GridItemContext,
  DataViewerModeContext,
} from "components/contexts/Contexts";

jest.mock("plotly.js-strict-dist-min", () => {
  const mockRelayout = jest.fn();
  // Expose the mock for assertions
  global.mockRelayout = mockRelayout;
  return {
    relayout: mockRelayout,
    purge: jest.fn(),
    // add any other Plotly methods if needed
  };
});

beforeEach(() => {
  delete window.ResizeObserver;
  if (global.mockRelayout) global.mockRelayout.mockClear();
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
      <VariableInputsContext.Provider
        value={{ variableInputDateFormats: {}, variableInputValues: {} }}
      >
        <GridItemContext.Provider value={{ gridItemArgsString: "{}" }}>
          <DataViewerModeContext.Provider value={{ mode: "default" }}>
            <BasePlot
              data={data}
              layout={layout}
              config={config}
              visualizationRef={createRef()}
            />
          </DataViewerModeContext.Provider>
        </GridItemContext.Provider>
      </VariableInputsContext.Provider>,
    );
    // Should render a plot container div with flex style
    // eslint-disable-next-line
    const plotDiv = container.querySelector('div[style*="display: flex"]');
    expect(plotDiv).toBeInTheDocument();
  });
});

describe("BasePlot utility functions", () => {
  describe("paperToAxisNormalized", () => {
    it("converts paper-normalized x to axis-relative x using domain", () => {
      expect(paperToAxisNormalized(0.5, [0, 1])).toBeCloseTo(0.5);
      expect(paperToAxisNormalized(0, [0, 1])).toBeCloseTo(0);
      expect(paperToAxisNormalized(1, [0, 1])).toBeCloseTo(1);
      expect(paperToAxisNormalized(-0.2, [0, 1])).toBeCloseTo(0);
      expect(paperToAxisNormalized(1.2, [0, 1])).toBeCloseTo(1);
      expect(paperToAxisNormalized(0.5, [0.2, 0.8])).toBeCloseTo(
        (0.5 - 0.2) / (0.8 - 0.2),
      );
      expect(paperToAxisNormalized(0.5, [0.5, 0.5])).toBe(0.5);
      expect(paperToAxisNormalized(0.5, null)).toBe(0.5);
    });
  });

  describe("normalizedToDate", () => {
    it("converts normalized value to date using x2range", () => {
      const start = "2020-01-01T00:00:00.000Z";
      const end = "2020-01-02T00:00:00.000Z";
      const x2range = [start, end];
      const date = normalizedToDate(0, x2range);
      expect(date).toEqual(new Date(start));
      const date1 = normalizedToDate(1, x2range);
      expect(date1).toEqual(new Date(end));
      const dateMid = normalizedToDate(0.5, x2range);
      expect(dateMid.getTime()).toBeCloseTo(
        (new Date(start).getTime() + new Date(end).getTime()) / 2,
      );
      expect(normalizedToDate(0.5, null)).toBe(0.5);
      expect(normalizedToDate(0.5, ["bad", "bad"])).toBe(0.5);
    });
  });

  describe("snapDate", () => {
    it("snaps date to nearest minute", () => {
      const d = new Date("2020-01-01T00:01:29.000");
      const snapped = snapDate(d, "minute");
      expect(new Date(snapped)).toStrictEqual(
        new Date("2020-01-01T00:01:00.000"),
      );

      const d2 = new Date("2020-01-01T00:01:30.000");
      const snapped2 = snapDate(d2, "minute");
      expect(new Date(snapped2)).toStrictEqual(
        new Date("2020-01-01T00:02:00.000"),
      );
    });

    it("snaps date to nearest hour", () => {
      const d = new Date("2020-01-01T01:29:00.000");
      const snapped = snapDate(d, "hour");
      expect(new Date(snapped)).toStrictEqual(
        new Date("2020-01-01T01:00:00.000"),
      );

      const d2 = new Date("2020-01-01T01:30:00.000");
      const snapped2 = snapDate(d2, "hour");
      expect(new Date(snapped2)).toStrictEqual(
        new Date("2020-01-01T02:00:00.000"),
      );
    });

    it("snaps date to nearest day", () => {
      const d = new Date("2020-01-01T12:00:00.000");
      const snapped = snapDate(d, "day");
      expect(new Date(snapped)).toStrictEqual(
        new Date("2020-01-02T00:00:00.000"),
      );

      const d2 = new Date("2020-01-01T06:00:00.000");
      const snapped2 = snapDate(d2, "day");
      expect(new Date(snapped2)).toStrictEqual(
        new Date("2020-01-01T00:00:00.000"),
      );
    });

    it("snaps date to nearest week", () => {
      const d = new Date("2020-01-07T12:00:00.000");
      const snapped = snapDate(d, "week");
      expect(new Date(snapped)).toStrictEqual(
        new Date("2020-01-05T00:00:00.000"),
      );

      const d2 = new Date("2020-01-08T10:00:00.000");
      const snapped2 = snapDate(d2, "week");
      expect(new Date(snapped2)).toStrictEqual(
        new Date("2020-01-05T00:00:00.000"),
      );

      const d3 = new Date("2020-01-08T12:00:00.000");
      const snapped3 = snapDate(d3, "week");
      expect(new Date(snapped3)).toStrictEqual(
        new Date("2020-01-12T00:00:00.000"),
      );

      const d4 = new Date("2020-01-10T00:00:00.000");
      const snapped4 = snapDate(d4, "week");
      expect(new Date(snapped4)).toStrictEqual(
        new Date("2020-01-12T00:00:00.000"),
      );
    });

    it("snaps date to nearest month", () => {
      const d = new Date("2020-01-15T12:00:00.000");
      const snapped = snapDate(d, "month");
      expect(new Date(snapped)).toStrictEqual(
        new Date("2020-01-01T00:00:00.000"),
      );
      const d2 = new Date("2020-01-20T12:00:00.000");
      const snapped2 = snapDate(d2, "month");
      expect(new Date(snapped2)).toStrictEqual(
        new Date("2020-02-01T00:00:00.000"),
      );
    });

    it("snaps date to nearest year", () => {
      const d = new Date("2020-03-15T12:00:00.000");
      const snapped = snapDate(d, "year");
      expect(new Date(snapped)).toStrictEqual(
        new Date("2020-01-01T00:00:00.000"),
      );
      const d2 = new Date("2020-09-15T12:00:00.000");
      const snapped2 = snapDate(d2, "year");
      expect(new Date(snapped2)).toStrictEqual(
        new Date("2021-01-01T00:00:00.000"),
      );
    });

    it("returns original date for bad step", () => {
      const d = new Date("2020-01-01T00:01:29.000");
      const snapped = snapDate(d, "invalid-step");
      expect(new Date(snapped)).toStrictEqual(d);
    });

    it("returns original value for invalid date", () => {
      expect(snapDate("not-a-date", "minute")).toBe("not-a-date");
    });
  });

  describe("formatToDate", () => {
    it("formats normalized value to snapped date", () => {
      const x2range = ["2020-01-01T00:00:00.000Z", "2020-01-02T00:00:00.000Z"];
      let expected = formatToDate(0, x2range, "minute");
      expect(new Date(expected)).toStrictEqual(
        new Date("2020-01-01T00:00:00.000Z"),
      );
      expected = formatToDate(1, x2range, "minute");
      expect(new Date(expected)).toStrictEqual(
        new Date("2020-01-02T00:00:00.000Z"),
      );
      const mid = formatToDate(0.5, x2range, "hour");
      expect(new Date(mid)).toStrictEqual(new Date("2020-01-01T12:00:00.000Z"));
    });

    it("clamps value to 0-1", () => {
      const x2range = ["2020-01-01T00:00:00.000Z", "2020-01-02T00:00:00.000Z"];

      let expected = formatToDate(-0.5, x2range, "minute");
      expect(new Date(expected)).toStrictEqual(
        new Date("2020-01-01T00:00:00.000Z"),
      );
      expected = formatToDate(1.5, x2range, "minute");
      expect(new Date(expected)).toStrictEqual(
        new Date("2020-01-02T00:00:00.000Z"),
      );
    });
  });
});

describe("BasePlot vertical line", () => {
  it("creates a vertical line shape with correct metadata", () => {
    const shape = createVerticalLine({
      xValue: "2022-01-01",
      plotElement: {
        layout: {
          xaxis: {
            range: ["2022-01-01T00:00:00.000Z", "2022-01-02T00:00:00.000Z"],
            domain: [0, 1],
          },
        },
      },
      options: {
        id: "vline1",
        variable: "var1",
      },
    });
    expect(shape.type).toBe("line");
    expect(shape.meta.id).toBe("vline1");
    expect(shape.meta.variable).toBe("var1");
    expect(shape.x0).toBe(0);
    expect(shape.x1).toBe(0);
    expect(shape.line.color).toBe("red");
  });

  it("creates a vertical line, axis match is nonexistent", () => {
    const shape = createVerticalLine({
      xValue: "2022-01-01",
      plotElement: {
        layout: {
          xaxis: {
            range: ["2022-01-01T00:00:00.000Z", "2022-01-02T00:00:00.000Z"],
            domain: [0, 1],
            matches: "x3",
          },
        },
      },
      options: {
        id: "vline1",
        variable: "var1",
      },
    });
    expect(shape.type).toBe("line");
    expect(shape.meta.id).toBe("vline1");
    expect(shape.meta.variable).toBe("var1");
    expect(shape.x0).toBe(0);
    expect(shape.x1).toBe(0);
    expect(shape.line.color).toBe("red");
  });

  it("creates a vertical line, axis bad match format", () => {
    const shape = createVerticalLine({
      xValue: "2022-01-01",
      plotElement: {
        layout: {
          xaxis: {
            range: ["2022-01-01T00:00:00.000Z", "2022-01-02T00:00:00.000Z"],
            domain: [0, 1],
            matches: "some axis 3",
          },
        },
      },
      options: {
        id: "vline1",
        variable: "var1",
      },
    });
    expect(shape.type).toBe("line");
    expect(shape.meta.id).toBe("vline1");
    expect(shape.meta.variable).toBe("var1");
    expect(shape.x0).toBe(0);
    expect(shape.x1).toBe(0);
    expect(shape.line.color).toBe("red");
  });

  it("creates a vertical line shape with correct metadata, shared axis", () => {
    const shape = createVerticalLine({
      xValue: "2022-01-01",
      plotElement: {
        layout: {
          xaxis: {
            matches: "x2",
          },
          xaxis2: {
            range: ["2022-01-01T00:00:00.000Z", "2022-01-02T00:00:00.000Z"],
            domain: [0, 1],
          },
        },
      },
      options: {
        id: "vline1",
        variable: "var1",
      },
    });
    expect(shape.type).toBe("line");
    expect(shape.meta.id).toBe("vline1");
    expect(shape.meta.variable).toBe("var1");
    expect(shape.x0).toBe(0);
    expect(shape.x1).toBe(0);
    expect(shape.line.color).toBe("red");
  });

  it("creates a vertical line with custom color, width, dash", () => {
    const shape = createVerticalLine({
      xValue: "2022-01-01T12:00:00.000Z",
      plotElement: {
        layout: {
          xaxis: {
            range: ["2022-01-01T00:00:00.000Z", "2022-01-02T00:00:00.000Z"],
            domain: [0, 1],
          },
        },
      },
      options: {
        color: "blue",
        width: 5,
        dash: "dot",
      },
    });
    expect(shape.line.color).toBe("blue");
    expect(shape.line.width).toBe(5);
    expect(shape.line.dash).toBe("dot");
    expect(shape.x0).toBe(0.5);
    expect(shape.x1).toBe(0.5);
  });

  it("handles xValue as number", () => {
    const shape = createVerticalLine({
      xValue: 123,
      plotElement: {
        layout: {
          xaxis: {
            range: ["2022-01-01T00:00:00.000Z", "2022-01-02T00:00:00.000Z"],
            domain: [0, 1],
          },
        },
      },
    });
    expect(shape.x0).toBe(123);
    expect(shape.x1).toBe(123);
  });

  it("handles bad range in plot", () => {
    const shape = createVerticalLine({
      xValue: 123,
      plotElement: {
        layout: {
          xaxis: {},
        },
      },
    });
    expect(shape.x0).toBe(0.5);
    expect(shape.x1).toBe(0.5);
  });

  it("handles xValue as invalid date and return 0.5", () => {
    const shape = createVerticalLine({
      xValue: "invalid-date-string",
      plotElement: {
        layout: {
          xaxis: {
            range: ["2022-01-01T00:00:00.000Z", "2022-01-02T00:00:00.000Z"],
            domain: [0, 1],
          },
        },
      },
    });
    expect(shape.x0).toBe(0.5);
    expect(shape.x1).toBe(0.5);
  });

  it("handles out of range values, max", () => {
    const shape = createVerticalLine({
      xValue: "2022-01-03T00:00:00.000",
      plotElement: {
        layout: {
          xaxis: {
            range: ["2022-01-01T00:00:00.000", "2022-01-02T00:00:00.000"],
            domain: [0, 1],
          },
        },
      },
      options: {
        id: "vline1",
        variable: "var1",
      },
    });
    expect(shape.type).toBe("line");
    expect(shape.meta.id).toBe("vline1");
    expect(shape.meta.variable).toBe("var1");
    expect(shape.x0).toBe(1);
    expect(shape.x1).toBe(1);
    expect(shape.line.color).toBe("red");
  });

  it("handles out of range values, min", () => {
    const shape = createVerticalLine({
      xValue: "2021-12-31T00:00:00.000",
      plotElement: {
        layout: {
          xaxis: {
            range: ["2022-01-01T00:00:00.000", "2022-01-02T00:00:00.000"],
            domain: [0, 1],
          },
        },
      },
      options: {
        id: "vline1",
        variable: "var1",
      },
    });
    expect(shape.type).toBe("line");
    expect(shape.meta.id).toBe("vline1");
    expect(shape.meta.variable).toBe("var1");
    expect(shape.x0).toBe(0);
    expect(shape.x1).toBe(0);
    expect(shape.line.color).toBe("red");
  });

  it("handles out of range values, returnOutOfRange is true", () => {
    const shape = createVerticalLine({
      xValue: "2022-01-03T00:00:00.000",
      plotElement: {
        layout: {
          xaxis: {
            range: ["2022-01-01T00:00:00.000", "2022-01-02T00:00:00.000"],
            domain: [0, 1],
          },
        },
      },
      options: {
        id: "vline1",
        variable: "var1",
      },
      returnOutOfRange: true,
    });
    expect(shape.type).toBe("line");
    expect(shape.meta.id).toBe("vline1");
    expect(shape.meta.variable).toBe("var1");
    expect(shape.x0).toBe(2);
    expect(shape.x1).toBe(2);
    expect(shape.line.color).toBe("red");
  });
});

describe("BasePlot handleEventData line shift", () => {
  it("no custom vertical line present", () => {
    const mockSetVariableInputValues = jest.fn();
    handleEventData({
      eventData: {
        "shapes[0].x0": 0.49816614420062694,
        "shapes[0].x1": 0.49816614420062694,
        "shapes[0].y0": 0,
        "shapes[0].y1": 1,
      },
      verticalLineEditable: true,
      plotElement: {
        layout: {
          shapes: [{ meta: { createdBy: "plotly" } }],
          xaxis: {
            range: ["2020-01-01T00:00:00.000", "2020-01-01T01:00:00.000"],
            domain: [0, 1],
          },
        },
      },
      originalVerticalLine: undefined,
      verticalLineStep: "minute",
      inDataViewerMode: false,
      gridItemMetadataString: "{}",
      variableInputDateFormats: {},
      setVariableInputValues: mockSetVariableInputValues,
    });
    expect(mockSetVariableInputValues).not.toHaveBeenCalled();
    expect(global.mockRelayout).not.toHaveBeenCalled();
  });

  it("no vertical line updates", () => {
    const mockSetVariableInputValues = jest.fn();
    handleEventData({
      eventData: {
        "shapes[1].x0": 0.49816614420062694,
        "shapes[1].x1": 0.49816614420062694,
        "shapes[1].y0": 0,
        "shapes[1].y1": 1,
      },
      verticalLineEditable: true,
      plotElement: {
        layout: {
          shapes: [
            { meta: { createdBy: "addVerticalLine" } },
            { meta: { createdBy: "plotly" } },
          ],
          xaxis: {
            range: ["2020-01-01T00:00:00.000", "2020-01-01T01:00:00.000"],
            domain: [0, 1],
          },
        },
      },
      originalVerticalLine: undefined,
      verticalLineStep: "minute",
      inDataViewerMode: false,
      gridItemMetadataString: "{}",
      variableInputDateFormats: {},
      setVariableInputValues: mockSetVariableInputValues,
    });
    expect(mockSetVariableInputValues).not.toHaveBeenCalled();
    expect(global.mockRelayout).not.toHaveBeenCalled();
  });

  it("vertical line updates - line shifted", () => {
    const mockSetVariableInputValues = jest.fn();
    const plotElement = {
      layout: {
        shapes: [
          {
            x0: 0.256,
            x1: 0.256,
            y0: 0.25,
            y1: 0.75,
            meta: { createdBy: "addVerticalLine" },
          },
          { meta: { createdBy: "plotly" } },
        ],
        xaxis: { matches: "x2" },
        xaxis2: {
          range: ["2020-01-01T00:00:00.000", "2020-01-01T01:00:00.000"],
          domain: [0, 1],
        },
      },
    };

    handleEventData({
      eventData: {
        "shapes[0].x0": 0.256,
        "shapes[0].x1": 0.256,
        "shapes[0].y0": 0.25,
        "shapes[0].y1": 0.75,
      },
      verticalLineEditable: true,
      plotElement: plotElement,
      originalVerticalLine: {},
      verticalLineStep: "minute",
      inDataViewerMode: false,
      gridItemMetadataString: JSON.stringify({
        plotlyVerticalLine: { value: "2022-01-01T00:00:00.000" },
      }),
      variableInputDateFormats: {},
      setVariableInputValues: mockSetVariableInputValues,
    });
    expect(mockSetVariableInputValues).not.toHaveBeenCalled();
    expect(global.mockRelayout).toHaveBeenCalled();
    // snaps to the minute and therefore updates to 0.25, and y0/y1 are updated to 0 and 1 respectively since the line was shifted, not resized
    expect(global.mockRelayout).toHaveBeenCalledWith(plotElement, {
      "shapes[0].x0": 0.25,
      "shapes[0].x1": 0.25,
      "shapes[0].y0": 0,
      "shapes[0].y1": 1,
    });
  });

  it("vertical line updates - bottom shifted", () => {
    const mockSetVariableInputValues = jest.fn();
    const plotElement = {
      layout: {
        shapes: [
          {
            x0: 0.25,
            x1: 0.5,
            y0: 0,
            y1: 1,
            meta: { createdBy: "addVerticalLine" },
          },
          { meta: { createdBy: "plotly" } },
        ],
        xaxis: {
          range: ["2020-01-01T00:00:00.000", "2020-01-01T01:00:00.000"],
          domain: [0, 1],
        },
      },
    };

    handleEventData({
      eventData: {
        "shapes[0].x0": 0.25,
        "shapes[0].x1": 0.5,
        "shapes[0].y0": 0,
        "shapes[0].y1": 1,
      },
      verticalLineEditable: true,
      plotElement: plotElement,
      originalVerticalLine: {
        x: 0.5,
        date: "2020-01-01T00:30:00.000",
      },
      verticalLineStep: "minute",
      inDataViewerMode: false,
      gridItemMetadataString: JSON.stringify({
        plotlyVerticalLine: { value: "2022-01-01T00:00:00.000Z" },
      }),
      variableInputDateFormats: {},
      setVariableInputValues: mockSetVariableInputValues,
    });
    expect(mockSetVariableInputValues).not.toHaveBeenCalled();
    expect(global.mockRelayout).toHaveBeenCalled();
    expect(global.mockRelayout).toHaveBeenCalledWith(plotElement, {
      "shapes[0].x0": 0.25,
      "shapes[0].x1": 0.25,
    });
  });

  it("vertical line updates - top shifted", () => {
    const mockSetVariableInputValues = jest.fn();
    const plotElement = {
      layout: {
        shapes: [
          {
            x0: 0.5,
            x1: 0.25,
            y0: 0,
            y1: 1,
            meta: { createdBy: "addVerticalLine" },
          },
          { meta: { createdBy: "plotly" } },
        ],
        xaxis: {
          range: ["2020-01-01T00:00:00.000", "2020-01-01T01:00:00.000"],
          domain: [0, 1],
        },
      },
    };

    handleEventData({
      eventData: {
        "shapes[0].x0": 0.5,
        "shapes[0].x1": 0.25,
        "shapes[0].y0": 0,
        "shapes[0].y1": 1,
      },
      verticalLineEditable: true,
      plotElement: plotElement,
      originalVerticalLine: {
        x: 0.5,
        date: "2020-01-01T00:30:00.000",
      },
      verticalLineStep: "minute",
      inDataViewerMode: false,
      gridItemMetadataString: JSON.stringify({
        plotlyVerticalLine: { value: "2022-01-01T00:00:00.000Z" },
      }),
      variableInputDateFormats: {},
      setVariableInputValues: mockSetVariableInputValues,
    });
    expect(mockSetVariableInputValues).not.toHaveBeenCalled();
    expect(global.mockRelayout).toHaveBeenCalled();
    expect(global.mockRelayout).toHaveBeenCalledWith(plotElement, {
      "shapes[0].x0": 0.25,
      "shapes[0].x1": 0.25,
    });
  });

  it("vertical line updates with variable", () => {
    const mockSetVariableInputValues = jest.fn();
    const plotElement = {
      layout: {
        shapes: [
          {
            x0: 0.49816614420062694,
            x1: 0.49816614420062694,
            y0: 0.25,
            y1: 0.75,
            meta: { createdBy: "addVerticalLine" },
          },
          { meta: { createdBy: "plotly" } },
        ],
        xaxis: {
          range: ["2020-01-01T00:00:00.000", "2020-01-01T01:00:00.000"],
          domain: [0, 1],
        },
      },
    };

    handleEventData({
      eventData: {
        "shapes[0].x0": 0.49816614420062694,
        "shapes[0].x1": 0.49816614420062694,
        "shapes[0].y0": 0.25,
        "shapes[0].y1": 0.75,
      },
      verticalLineEditable: true,
      plotElement: plotElement,
      originalVerticalLine: {},
      verticalLineStep: "minute",
      inDataViewerMode: false,
      gridItemMetadataString: JSON.stringify({
        // eslint-disable-next-line
        plotlyVerticalLine: { value: "${Test Var}" },
      }),
      variableInputDateFormats: { "Test Var": "MM/dd/yyyy" },
      setVariableInputValues: mockSetVariableInputValues,
    });
    const updateFn = mockSetVariableInputValues.mock.calls[0][0];

    // Call the updater with a fake previous state
    const result = updateFn({ foo: "bar" });

    // Assert the result
    expect(result).toEqual({
      "Test Var": "01/01/2020",
      foo: "bar",
    });

    expect(global.mockRelayout).not.toHaveBeenCalled();
  });

  it("vertical line updates with variable in dataviewer mode", () => {
    const mockSetVariableInputValues = jest.fn();
    const plotElement = {
      layout: {
        shapes: [
          {
            x0: 0.49816614420062694,
            x1: 0.49816614420062694,
            y0: 0.25,
            y1: 0.75,
            meta: { createdBy: "addVerticalLine" },
          },
          { meta: { createdBy: "plotly" } },
        ],
        xaxis: {
          range: ["2020-01-01T00:00:00.000", "2020-01-01T01:00:00.000"],
          domain: [0, 1],
        },
      },
    };

    handleEventData({
      eventData: {
        "shapes[0].x0": 0.49816614420062694,
        "shapes[0].x1": 0.49816614420062694,
        "shapes[0].y0": 0.25,
        "shapes[0].y1": 0.75,
      },
      verticalLineEditable: true,
      plotElement: plotElement,
      originalVerticalLine: {},
      verticalLineStep: "minute",
      inDataViewerMode: true,
      gridItemMetadataString: JSON.stringify({
        // eslint-disable-next-line
        plotlyVerticalLine: { value: "${Test Var}" },
      }),
      variableInputDateFormats: { "Test Var": "MM/dd/yyyy" },
      setVariableInputValues: mockSetVariableInputValues,
    });

    expect(mockSetVariableInputValues).not.toHaveBeenCalled();
    expect(global.mockRelayout).toHaveBeenCalled();
    expect(global.mockRelayout).toHaveBeenCalledWith(plotElement, {
      "shapes[0].x0": 0.5,
      "shapes[0].x1": 0.5,
      "shapes[0].y0": 0,
      "shapes[0].y1": 1,
    });
  });
});

describe("BasePlot handleEventData range update", () => {
  it("range updates - line in range", () => {
    const mockSetVariableInputValues = jest.fn();
    const plotElement = {
      layout: {
        shapes: [
          {
            x0: 0.5,
            x1: 0.5,
            y0: 0.25,
            y1: 0.75,
            meta: { createdBy: "addVerticalLine" },
          },
          { meta: { createdBy: "plotly" } },
        ],
        xaxis: {
          matches: "x2",
        },
        xaxis2: {
          range: ["2020-01-01T00:00:00.000", "2020-01-01T01:00:00.000"],
          domain: [0, 1],
        },
      },
    };

    handleEventData({
      eventData: {
        "xaxis.range[0]": "2020-01-01T00:00:00.000",
        "xaxis.range[1]": "2020-01-01T01:00:00.000",
      },
      verticalLineEditable: true,
      plotElement: plotElement,
      originalVerticalLine: { date: "2020-01-01T00:15:00.000" },
      verticalLineStep: "minute",
      inDataViewerMode: false,
      gridItemMetadataString: JSON.stringify({
        plotlyVerticalLine: { value: "2022-01-01T00:00:00.000" },
      }),
      variableInputDateFormats: {},
      setVariableInputValues: mockSetVariableInputValues,
    });

    expect(mockSetVariableInputValues).not.toHaveBeenCalled();
    expect(global.mockRelayout).toHaveBeenCalled();
    // snaps to the minute and therefore updates to 0.25, and y0/y1 are updated to 0 and 1 respectively since the line was shifted, not resized
    expect(global.mockRelayout).toHaveBeenCalledWith(plotElement, {
      "shapes[0].visible": true,
      "shapes[0].x0": 0.25,
      "shapes[0].x1": 0.25,
    });
  });

  it("range updates - line out of range", () => {
    const mockSetVariableInputValues = jest.fn();
    const plotElement = {
      layout: {
        shapes: [
          {
            x0: 0.5,
            x1: 0.5,
            y0: 0.25,
            y1: 0.75,
            meta: { createdBy: "addVerticalLine" },
          },
          { meta: { createdBy: "plotly" } },
        ],
        xaxis: {
          matches: "x2",
        },
        xaxis2: {
          range: ["2020-01-01T00:00:00.000", "2020-01-01T00:10:00.000"],
          domain: [0, 1],
        },
      },
    };

    handleEventData({
      eventData: {
        "xaxis.range[0]": "2020-01-01T00:00:00.000",
        "xaxis.range[1]": "2020-01-01T00:10:00.000",
      },
      verticalLineEditable: true,
      plotElement: plotElement,
      originalVerticalLine: { date: "2020-01-01T00:15:00.000" },
      verticalLineStep: "minute",
      inDataViewerMode: false,
      gridItemMetadataString: JSON.stringify({
        plotlyVerticalLine: { value: "2022-01-01T00:00:00.000" },
      }),
      variableInputDateFormats: {},
      setVariableInputValues: mockSetVariableInputValues,
    });

    expect(mockSetVariableInputValues).not.toHaveBeenCalled();
    expect(global.mockRelayout).toHaveBeenCalled();
    // snaps to the minute and therefore updates to 0.25, and y0/y1 are updated to 0 and 1 respectively since the line was shifted, not resized
    expect(global.mockRelayout).toHaveBeenCalledWith(plotElement, {
      "shapes[0].visible": false,
    });
  });
});

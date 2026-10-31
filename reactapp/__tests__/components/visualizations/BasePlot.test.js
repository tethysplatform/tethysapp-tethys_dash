import { act, render } from "@testing-library/react";
import { createRef } from "react";
import BasePlot, {
  createVerticalLine,
  snapDate,
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

// Capture the props handed to the Plotly component so the plotConfig merge can
// be asserted (mirrors the mock in BasePlot.subplotToggle.test.js — mock
// factories may only reference globals, not module-scoped vars).
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

  // A plot whose line is tied to the variable "Date", in a slider's
  // outputFormat. The ref is never mounted unless a test gives one: the
  // line must not wait for the plot element.
  const plotWithLine = ({
    value,
    data = [
      {
        x: ["2026-06-01T00:00:00", "2026-06-10T00:00:00"],
        y: [3, 4],
        type: "scatter",
      },
    ],
    layout = { title: "Test" },
    line = {},
    visualizationRef = createRef(),
    setVariableInputValues = jest.fn(),
    rawValue = "${Date}", // eslint-disable-line no-template-curly-in-string
    metadata = { plotlyVerticalLine: { mode: "on", value, ...line } },
  }) => (
    <VariableInputsContext.Provider
      value={{
        variableInputDateFormats: { Date: "MM/dd/yyyy'T'HH:mm" },
        variableInputValues: { Date: value },
        setVariableInputValues,
      }}
    >
      <GridItemContext.Provider
        value={{
          gridItemArgsString: "{}",
          gridItemMetadataString: JSON.stringify({
            plotlyVerticalLine: { mode: "on", value: rawValue },
          }),
        }}
      >
        <DataViewerModeContext.Provider value={{ mode: "default" }}>
          <BasePlot
            data={data}
            layout={layout}
            config={{ responsive: true }}
            visualizationRef={visualizationRef}
            metadata={metadata}
          />
        </DataViewerModeContext.Provider>
      </GridItemContext.Provider>
    </VariableInputsContext.Provider>
  );

  const verticalLinesIn = (layout) =>
    (layout.shapes || []).filter(
      (s) => s.meta?.createdBy === "addVerticalLine",
    );

  it("draws a line tied to a variable at its value, read with the variable's format", () => {
    // The substituted value is in the slider's outputFormat, not ISO, and
    // can only be read with the format registered for the source variable.
    const pluginShape = { type: "rect", x0: 0, x1: 1, y0: 0, y1: 1 };
    render(
      plotWithLine({
        value: "06/05/2026T12:00",
        layout: { title: "Test", shapes: [pluginShape] },
      }),
    );

    const { layout } = global.__plotProps;
    expect(layout.shapes[0]).toBe(pluginShape);
    const [line] = verticalLinesIn(layout);
    expect(line).toMatchObject({ xref: "x", yref: "paper", y0: 0, y1: 1 });
    expect(line.x0).toBe("2026-06-05 12:00:00");
    expect(line.x1).toBe(line.x0);
  });

  const pinned = ["2026-05-01T00:00:00", "2026-07-01T00:00:00"];
  it.each([
    ["inside the data on an autoranged axis", "06/05/2026T12:00", {}, true],
    ["outside the data on an autoranged axis", "06/15/2026T12:00", {}, false],
    [
      "outside the data on a pinned axis",
      "06/15/2026T12:00",
      { xaxis: { range: pinned } },
      true,
    ],
    [
      "outside the data on an axis matched to a pinned one",
      "06/15/2026T12:00",
      { xaxis: { matches: "x2" }, xaxis2: { range: pinned } },
      true,
    ],
    [
      "outside the data on an axis told to autorange over its range",
      "06/15/2026T12:00",
      { xaxis: { range: pinned, autorange: true } },
      false,
    ],
  ])("draws a line %s: visible %p", (_case, value, axes, visible) => {
    // Hidden, Plotly leaves the line out of the autorange, which it would
    // otherwise stretch to reach the line.
    render(plotWithLine({ value, layout: { title: "Test", ...axes } }));

    const [line] = verticalLinesIn(global.__plotProps.layout);
    expect(line.visible !== false).toBe(visible);
  });

  it.each([["06/01/2026T00:30"], ["06/09/2026T23:30"]])(
    "reads the data's dates as wall-clock time, as Plotly does: %s",
    (value) => {
      // Plotly discards these offsets and draws the data from June 1 00:00 to
      // June 10 00:00 wall-clock, so a line just inside either end is inside.
      // Honored, the offsets would pull both ends inside both lines.
      const data = [
        {
          x: ["2026-06-01T00:00:00-12:00", "2026-06-10T00:00:00+14:00"],
          y: [3, 4],
        },
      ];
      render(plotWithLine({ value, data }));

      const [line] = verticalLinesIn(global.__plotProps.layout);
      expect(line.visible).not.toBe(false);
    },
  );

  it("measures only the data on the line's own x axis", () => {
    // A side-by-side subplot on its own x axis spans the whole year.
    const data = [
      {
        x: ["2026-06-01T00:00:00", "2026-06-10T00:00:00"],
        y: [3, 4],
      },
      {
        x: ["2026-01-01T00:00:00", "2026-12-31T00:00:00"],
        y: [3, 4],
        xaxis: "x3",
      },
    ];
    render(
      plotWithLine({
        value: "06/15/2026T12:00",
        data,
        layout: { title: "Test", xaxis3: {} },
      }),
    );

    const [line] = verticalLinesIn(global.__plotProps.layout);
    expect(line.visible).toBe(false);
  });

  it.each([
    [
      "values that do not only increase",
      "06/09/2026T12:00",
      [
        {
          x: [
            "2026-06-05T00:00:00",
            "2026-06-01T00:00:00",
            "2026-06-10T00:00:00",
            "2026-06-03T00:00:00",
          ],
          y: [1, 2, 3, 4],
        },
      ],
      {},
      true,
    ],
    [
      "milliseconds on a date axis",
      "06/15/2026T12:00",
      [{ x: [Date.UTC(2026, 5, 1), Date.UTC(2026, 5, 10)], y: [1, 2] }],
      { xaxis: { type: "date" } },
      false,
    ],
    [
      "visible traces only",
      "06/15/2026T12:00",
      [
        { x: ["2026-06-01T00:00:00", "2026-06-10T00:00:00"], y: [1, 2] },
        {
          x: ["2026-01-01T00:00:00", "2026-12-31T00:00:00"],
          y: [1, 2],
          visible: "legendonly",
        },
      ],
      {},
      false,
    ],
  ])(
    "measures the data on the line's axis from %s",
    (_case, value, data, axes, visible) => {
      // Each figure's data spans June 1-10.
      render(plotWithLine({ value, data, layout: { title: "Test", ...axes } }));

      const [line] = verticalLinesIn(global.__plotProps.layout);
      expect(line.visible !== false).toBe(visible);
    },
  );

  it("draws the line on a figure with no data to measure", () => {
    render(plotWithLine({ value: "06/05/2026T12:00", data: null }));

    const [line] = verticalLinesIn(global.__plotProps.layout);
    expect(line.x0).toBe("2026-06-05 12:00:00");
    expect(line.visible).not.toBe(false);
  });

  it("reads the value of a variable with no date format as it comes", () => {
    render(
      plotWithLine({
        value: "2026-06-05T12:00:00",
        rawValue: "${Day}", // eslint-disable-line no-template-curly-in-string
      }),
    );

    const [line] = verticalLinesIn(global.__plotProps.layout);
    expect(line.x0).toBe("2026-06-05 12:00:00");
  });

  it("draws no line when its value cannot be read as a date", () => {
    render(plotWithLine({ value: "not a date" }));

    expect(verticalLinesIn(global.__plotProps.layout)).toEqual([]);
  });

  it("re-reads a relative value such as now when a new figure arrives", () => {
    jest.useFakeTimers({ now: new Date(2026, 5, 5, 12, 0) });
    try {
      // One metadata object across renders, as Base.js hands over when a
      // refresh changes nothing in it.
      const props = {
        value: "now",
        rawValue: "now",
        metadata: { plotlyVerticalLine: { mode: "on", value: "now" } },
      };
      const { rerender } = render(plotWithLine(props));
      expect(verticalLinesIn(global.__plotProps.layout)[0].x0).toMatch(
        "2026-06-05 12:00:00",
      );

      // An auto-refresh: same metadata, new figure, an hour later.
      jest.setSystemTime(new Date(2026, 5, 5, 13, 0));
      rerender(plotWithLine({ ...props, layout: { title: "Refreshed" } }));
      expect(verticalLinesIn(global.__plotProps.layout)[0].x0).toMatch(
        "2026-06-05 13:00:00",
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it("snaps a drag, publishes it, and ignores Plotly's echo of the snap", () => {
    // Stands in for the Plotly graph div, which holds the very layout object
    // it was given, so a drag shows up as a change to that object.
    const plotElement = {};
    const visualizationRef = {};
    Object.defineProperty(visualizationRef, "current", {
      get: () => ({ el: plotElement }),
      set: () => {},
      configurable: true,
    });
    const setVariableInputValues = jest.fn();
    render(
      plotWithLine({
        value: "06/05/2026T12:00",
        // No step saved: the editor shows "minute", so the drag snaps to it.
        line: { editable: true },
        visualizationRef,
        setVariableInputValues,
      }),
    );
    plotElement.layout = global.__plotProps.layout;
    const [line] = verticalLinesIn(plotElement.layout);
    const moveLineTo = (x) => {
      line.x0 = x;
      line.x1 = x;
      act(() =>
        global.__plotProps.onRelayout({ "shapes[0].x0": x, "shapes[0].x1": x }),
      );
    };

    moveLineTo("2026-06-05 14:20:31.2");
    expect(global.mockRelayout).toHaveBeenCalledTimes(1);
    const snapped = global.mockRelayout.mock.calls[0][1]["shapes[0].x0"];
    expect(snapped).toBe("2026-06-05 14:21:00");
    expect(setVariableInputValues.mock.calls[0][0]({})).toEqual({
      Date: "06/05/2026T14:21",
    });

    // Plotly applies the snap and reports it back.
    moveLineTo(snapped);
    expect(global.mockRelayout).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["draggable", { editable: true }, true],
    ["fixed", {}, undefined],
  ])("drags shapes directly only when the line is %s", (_case, line, on) => {
    render(plotWithLine({ value: "06/05/2026T12:00", line }));

    expect(global.__plotProps.config.edits?.shapePosition).toBe(on);
    // The CSV button is still added alongside.
    expect(global.__plotProps.config.modeBarButtonsToAdd).toHaveLength(1);
  });

  it("draws no line when the metadata has none", () => {
    render(
      <VariableInputsContext.Provider
        value={{ variableInputDateFormats: {}, variableInputValues: {} }}
      >
        <GridItemContext.Provider value={{ gridItemArgsString: "{}" }}>
          <DataViewerModeContext.Provider value={{ mode: "default" }}>
            <BasePlot
              data={[{ x: [1, 2], y: [3, 4], type: "scatter" }]}
              layout={{ title: "Test Plot" }}
              config={{ responsive: true }}
              visualizationRef={createRef()}
              metadata={{}}
            />
          </DataViewerModeContext.Provider>
        </GridItemContext.Provider>
      </VariableInputsContext.Provider>,
    );

    expect(verticalLinesIn(global.__plotProps.layout)).toEqual([]);
  });
});

describe("BasePlot utility functions", () => {
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
});

describe("BasePlot vertical line", () => {
  it("anchors the line to the x axis at the value's wall-clock time", () => {
    const shape = createVerticalLine({
      xValue: "2022-01-01T12:00:00",
      options: { id: "vline1", variable: "var1" },
    });
    expect(shape).toMatchObject({
      type: "line",
      xref: "x",
      yref: "paper",
      y0: 0,
      y1: 1,
      editable: false,
      layer: "below",
      line: { color: "red", width: 2, dash: "solid" },
      meta: { id: "vline1", variable: "var1", createdBy: "addVerticalLine" },
    });
    expect(shape.x0).toBe("2022-01-01 12:00:00");
    expect(shape.x1).toBe(shape.x0);
  });

  it("accepts a Date", () => {
    const shape = createVerticalLine({
      xValue: new Date(2022, 0, 1, 6, 30),
    });
    expect(shape.x0).toBe("2022-01-01 06:30:00");
  });

  it("applies a custom color, width, dash, and editable", () => {
    const shape = createVerticalLine({
      xValue: "2022-01-01T12:00:00",
      options: { color: "blue", width: 5, dash: "dot", editable: true },
    });
    expect(shape.line).toEqual({ color: "blue", width: 5, dash: "dot" });
    expect(shape.editable).toBe(true);
  });

  it("gives Plotly its time with no offset, even in a half-hour time zone", () => {
    // Plotly's shape editor cannot read an offset back, and "+5.5:30" was
    // once all a half-hour zone got.
    jest.spyOn(Date.prototype, "getTimezoneOffset").mockReturnValue(-330);
    const shape = createVerticalLine({ xValue: "2022-01-01T12:00:00" });
    expect(shape.x0).toBe("2022-01-01 12:00:00");
  });

  it.each([["invalid-date-string"], [null], [123]])(
    "returns no line for a value that is not a date: %p",
    (xValue) => {
      expect(createVerticalLine({ xValue })).toBeNull();
    },
  );
});

describe("BasePlot handleEventData", () => {
  // The vertical line sits after one of the plugin's shapes. Dragged
  // positions are given the way Plotly reports them on a date axis, e.g.
  // "2020-01-01 00:15:29.5", with no zone.
  const plotWithLine = (line) => ({
    layout: {
      shapes: [
        { meta: { createdBy: "plotly" } },
        { y0: 0, y1: 1, ...line, meta: { createdBy: "addVerticalLine" } },
      ],
    },
  });
  // A drag of the line to where plotElement now has it, unless the test
  // gives other event data.
  const drag = (plotElement, overrides = {}) =>
    handleEventData({
      eventData: {
        "shapes[1].x0": plotElement.layout.shapes[1]?.x0,
        "shapes[1].x1": plotElement.layout.shapes[1]?.x1,
      },
      plotElement,
      lastLineX: "2020-01-01T00:30:00",
      verticalLineStep: "minute",
      inDataViewerMode: true,
      lineVariable: null,
      setVariableInputValues: jest.fn(),
      ...overrides,
    });
  const atMinute = (hhmm) => `2020-01-01 ${hhmm}:00`;

  it("ignores a plot without a vertical line", () => {
    const plotElement = { layout: { shapes: [{ meta: {} }] } };
    expect(
      drag(plotElement, { eventData: { "shapes[0].x0": "2020-01-01" } }),
    ).toBeNull();
    expect(global.mockRelayout).not.toHaveBeenCalled();
  });

  it("ignores an event with no plot to read", () => {
    expect(
      drag({ layout: { shapes: [] } }, { plotElement: undefined }),
    ).toBeNull();
    expect(global.mockRelayout).not.toHaveBeenCalled();
  });

  it("leaves the line alone on a zoom or pan", () => {
    const plotElement = plotWithLine({
      x0: "2020-01-01T00:30:00",
      x1: "2020-01-01T00:30:00",
    });
    const result = drag(plotElement, {
      eventData: {
        "xaxis.range[0]": "2020-01-01 00:40:00",
        "xaxis.range[1]": "2020-01-01 00:50:00",
      },
    });
    expect(result).toBeNull();
    expect(global.mockRelayout).not.toHaveBeenCalled();
  });

  it("snaps a dragged line to the step and back to the full plot height", () => {
    const plotElement = plotWithLine({
      x0: "2020-01-01 00:15:29.5",
      x1: "2020-01-01 00:15:29.5",
      y0: 0.25,
      y1: 0.75,
    });
    const result = drag(plotElement);

    expect(result).toEqual(atMinute("00:15"));
    expect(global.mockRelayout).toHaveBeenCalledWith(plotElement, {
      "shapes[1].x0": result,
      "shapes[1].x1": result,
      "shapes[1].y0": 0,
      "shapes[1].y1": 1,
    });
  });

  it.each([
    ["x1", { x0: "2020-01-01 00:30:00", x1: "2020-01-01 00:10:10" }],
    ["x0", { x0: "2020-01-01 00:10:10", x1: "2020-01-01 00:30:00" }],
  ])("follows the end that was dragged: %s", (_end, ends) => {
    const plotElement = plotWithLine(ends);
    const result = drag(plotElement);

    expect(result).toEqual(atMinute("00:10"));
    expect(global.mockRelayout).toHaveBeenCalledWith(plotElement, {
      "shapes[1].x0": result,
      "shapes[1].x1": result,
    });
  });

  it("ignores the echo of its own snap", () => {
    const snapped = "2020-01-01 00:15:00";
    const plotElement = plotWithLine({ x0: snapped, x1: snapped });

    expect(drag(plotElement, { lastLineX: snapped })).toBeNull();
    expect(global.mockRelayout).not.toHaveBeenCalled();
  });

  it("reads a position in the form Plotly's shape editor writes", () => {
    const plotElement = plotWithLine({
      x0: "2020-01-01_00:15:29.5",
      x1: "2020-01-01_00:15:29.5",
    });

    expect(drag(plotElement)).toEqual(atMinute("00:15"));
  });

  it("takes a drag that lands exactly on a new step", () => {
    const plotElement = plotWithLine({
      x0: "2020-01-01 00:15:00",
      x1: "2020-01-01 00:15:00",
    });

    expect(drag(plotElement)).toEqual(atMinute("00:15"));
    expect(global.mockRelayout).toHaveBeenCalled();
  });

  it("leaves a position that is not a date alone", () => {
    const plotElement = plotWithLine({ x0: 0.25, x1: 0.25 });

    expect(drag(plotElement)).toBeNull();
    expect(global.mockRelayout).not.toHaveBeenCalled();
  });

  it("publishes the snapped time to the variable the line is tied to", () => {
    const setVariableInputValues = jest.fn();
    const plotElement = plotWithLine({
      x0: "2020-01-01 00:15:10",
      x1: "2020-01-01 00:15:10",
    });
    drag(plotElement, {
      inDataViewerMode: false,
      lineVariable: { name: "Test Var", dateFormat: "MM/dd/yyyy HH:mm" },
      setVariableInputValues,
    });

    const updater = setVariableInputValues.mock.calls[0][0];
    expect(updater({ foo: "bar" })).toEqual({
      foo: "bar",
      "Test Var": "01/01/2020 00:15",
    });
    // Moved at once, rather than waiting on the variable to come back round.
    expect(global.mockRelayout).toHaveBeenCalled();
  });

  it("publishes the snapped time as it is to a variable with no date format", () => {
    const setVariableInputValues = jest.fn();
    const plotElement = plotWithLine({
      x0: "2020-01-01 00:15:10",
      x1: "2020-01-01 00:15:10",
    });
    drag(plotElement, {
      inDataViewerMode: false,
      lineVariable: { name: "Test Var", dateFormat: null },
      setVariableInputValues,
    });

    expect(setVariableInputValues.mock.calls[0][0]({})).toEqual({
      "Test Var": "2020-01-01 00:15:00",
    });
  });

  it("only moves the line in the data viewer", () => {
    const setVariableInputValues = jest.fn();
    const plotElement = plotWithLine({
      x0: "2020-01-01 00:15:10",
      x1: "2020-01-01 00:15:10",
    });
    drag(plotElement, {
      inDataViewerMode: true,
      lineVariable: { name: "Test Var", dateFormat: "MM/dd/yyyy HH:mm" },
      setVariableInputValues,
    });

    expect(setVariableInputValues).not.toHaveBeenCalled();
    expect(global.mockRelayout).toHaveBeenCalled();
  });
});

describe("BasePlot plotConfig CSV download button merge", () => {
  // The always-on "Download data as CSV" modebar button is merged into the
  // plugin's config by the plotConfig memo. Assertions read the config that
  // actually reaches the Plot component (captured by the factory mock above).
  const renderWithConfig = (config) =>
    render(
      <VariableInputsContext.Provider
        value={{ variableInputDateFormats: {}, variableInputValues: {} }}
      >
        <GridItemContext.Provider value={{ gridItemArgsString: "{}" }}>
          <DataViewerModeContext.Provider value={{ mode: "default" }}>
            <BasePlot
              data={[{ x: [1, 2], y: [3, 4], type: "scatter" }]}
              layout={{ title: "Test Plot" }}
              config={config}
              visualizationRef={createRef()}
            />
          </DataViewerModeContext.Provider>
        </GridItemContext.Provider>
      </VariableInputsContext.Provider>,
    );

  beforeEach(() => {
    delete global.__plotProps;
  });

  it("adds exactly one downloadCsv modebar button when the plugin sends no config", () => {
    renderWithConfig(undefined);
    const { config } = global.__plotProps;
    expect(config.modeBarButtonsToAdd).toHaveLength(1);
    expect(config.modeBarButtonsToAdd[0].name).toBe("downloadCsv");
  });

  it("preserves plugin config keys and custom modebar buttons while appending downloadCsv", () => {
    renderWithConfig({
      displaylogo: false,
      modeBarButtonsToAdd: [{ name: "custom" }],
    });
    const { config } = global.__plotProps;
    expect(config.displaylogo).toBe(false);
    expect(config.modeBarButtonsToAdd.map((button) => button.name)).toEqual([
      "custom",
      "downloadCsv",
    ]);
  });

  it("does not duplicate a downloadCsv button the plugin already provides", () => {
    const pluginConfig = {
      modeBarButtonsToAdd: [{ name: "downloadCsv", click: jest.fn() }],
    };
    renderWithConfig(pluginConfig);
    const { config } = global.__plotProps;
    // The memo returns the plugin config untouched — same reference, no
    // second downloadCsv appended.
    expect(config).toBe(pluginConfig);
    expect(config.modeBarButtonsToAdd).toHaveLength(1);
    expect(config.modeBarButtonsToAdd[0].name).toBe("downloadCsv");
  });

  it("appends downloadCsv as its own group when the plugin uses a full modeBarButtons override", () => {
    // Plotly ignores modeBarButtonsToAdd when modeBarButtons is set (the
    // cnrfc_hefs plugin curates its toolbar this way), so the button must be
    // merged into the override itself.
    renderWithConfig({
      responsive: true,
      modeBarButtons: [
        ["toImage"],
        ["zoom2d", "pan2d", "zoomIn2d", "zoomOut2d"],
      ],
    });
    const { config } = global.__plotProps;
    expect(config.responsive).toBe(true);
    expect(config.modeBarButtonsToAdd).toBeUndefined();
    expect(config.modeBarButtons).toHaveLength(3);
    expect(config.modeBarButtons[0]).toEqual(["toImage"]);
    expect(config.modeBarButtons[1]).toEqual([
      "zoom2d",
      "pan2d",
      "zoomIn2d",
      "zoomOut2d",
    ]);
    expect(config.modeBarButtons[2]).toHaveLength(1);
    expect(config.modeBarButtons[2][0].name).toBe("downloadCsv");
  });

  it("does not duplicate downloadCsv inside a modeBarButtons override that already has it", () => {
    const pluginConfig = {
      modeBarButtons: [
        ["toImage"],
        [{ name: "downloadCsv", click: jest.fn() }],
      ],
    };
    renderWithConfig(pluginConfig);
    const { config } = global.__plotProps;
    expect(config).toBe(pluginConfig);
    expect(config.modeBarButtons).toHaveLength(2);
  });
});

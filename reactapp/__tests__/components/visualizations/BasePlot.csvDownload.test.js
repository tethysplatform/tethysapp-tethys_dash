import {
  buildCsvFromGraphDiv,
  downloadCsvFromGraphDiv,
  csvDownloadButton,
} from "components/visualizations/csvExport";

jest.mock("plotly.js-strict-dist-min", () => ({
  relayout: jest.fn(),
  purge: jest.fn(),
}));

describe("buildCsvFromGraphDiv", () => {
  it("serializes cartesian traces to a wide CSV keyed by x", () => {
    const gd = {
      data: [
        { x: [1, 2], y: [10, 20], name: "A", type: "scatter" },
        { x: [1, 2], y: [30, 40], name: "B", type: "scatter" },
      ],
    };
    expect(buildCsvFromGraphDiv(gd)).toBe("x,A,B\n1,10,30\n2,20,40");
  });

  it("skips legend-hidden and non-visible traces", () => {
    const gd = {
      data: [
        { x: [1], y: [10], name: "A", type: "scatter" },
        { x: [1], y: [99], name: "B", type: "scatter", visible: "legendonly" },
        { x: [1], y: [88], name: "C", type: "scatter", visible: false },
      ],
    };
    expect(buildCsvFromGraphDiv(gd)).toBe("x,A\n1,10");
  });

  it("falls back to series_<i> when a trace has no name", () => {
    const gd = { data: [{ x: [1], y: [5], type: "scatter" }] };
    expect(buildCsvFromGraphDiv(gd)).toBe("x,series_0\n1,5");
  });

  it("serializes a plotly table trace from header/cells", () => {
    const gd = {
      data: [
        {
          type: "table",
          header: { values: ["col1", "col2"] },
          cells: {
            values: [
              ["a", "b"],
              ["1", "2"],
            ],
          },
        },
      ],
    };
    expect(buildCsvFromGraphDiv(gd)).toBe("col1,col2\na,1\nb,2");
  });

  it("quotes values containing commas or quotes", () => {
    const gd = {
      data: [{ x: ["a,b", 'c"d'], y: [1, 2], name: "n", type: "scatter" }],
    };
    expect(buildCsvFromGraphDiv(gd)).toBe('x,n\n"a,b",1\n"c""d",2');
  });

  it("decodes plotly base64 typed-array (bdata) numeric columns", () => {
    const b64 = (arr) => Buffer.from(arr.buffer).toString("base64");
    const gd = {
      data: [
        {
          x: ["2000-01-01", "2000-01-02"],
          y: { dtype: "f8", bdata: b64(Float64Array.from([10, 20])) },
          name: "A",
          type: "scatter",
        },
        {
          x: ["2000-01-01", "2000-01-02"],
          y: { dtype: "f8", bdata: b64(Float64Array.from([30, 40])) },
          name: "B",
          type: "scatter",
        },
      ],
    };
    expect(buildCsvFromGraphDiv(gd)).toBe(
      "x,A,B\n2000-01-01,10,30\n2000-01-02,20,40",
    );
  });

  it("reads already-decoded TypedArray x/y", () => {
    const gd = {
      data: [
        { x: [1, 2], y: Float64Array.from([5, 6]), name: "A", type: "scatter" },
      ],
    };
    expect(buildCsvFromGraphDiv(gd)).toBe("x,A\n1,5\n2,6");
  });

  it("returns an empty string when there are no visible traces", () => {
    expect(buildCsvFromGraphDiv({ data: [] })).toBe("");
    expect(buildCsvFromGraphDiv({})).toBe("");
    expect(buildCsvFromGraphDiv(undefined)).toBe("");
  });

  it("includes both the cartesian and table sections for a mixed figure, separated by a blank line", () => {
    const gd = {
      data: [
        { x: [1, 2], y: [10, 20], name: "A", type: "scatter" },
        {
          type: "table",
          header: { values: ["col1", "col2"] },
          cells: {
            values: [
              ["a", "b"],
              ["1", "2"],
            ],
          },
        },
      ],
    };
    expect(buildCsvFromGraphDiv(gd)).toBe(
      "x,A\n1,10\n2,20\n\ncol1,col2\na,1\nb,2",
    );
  });

  it("long format preserves per-trace point order for out-of-order duplicate x (no sorting)", () => {
    const gd = {
      data: [{ x: [2, 1, 1], y: [30, 10, 20], name: "A", type: "scatter" }],
    };
    expect(buildCsvFromGraphDiv(gd)).toBe("trace,x,y\nA,2,30\nA,1,10\nA,1,20");
  });

  it("emits long format (trace,x,y) preserving both y values when a trace has duplicate x", () => {
    const gd = {
      data: [{ x: [1, 1, 2], y: [10, 20, 30], name: "A", type: "scatter" }],
    };
    expect(buildCsvFromGraphDiv(gd)).toBe("trace,x,y\nA,1,10\nA,1,20\nA,2,30");
  });

  it("falls back the whole cartesian section to long format when only one of several traces has duplicate x (no partial wide/long mix)", () => {
    const gd = {
      data: [
        { x: [1, 1, 2], y: [10, 20, 30], name: "A", type: "scatter" },
        { x: [1, 2], y: [100, 200], name: "B", type: "scatter" },
      ],
    };
    expect(buildCsvFromGraphDiv(gd)).toBe(
      "trace,x,y\nA,1,10\nA,1,20\nA,2,30\nB,1,100\nB,2,200",
    );
  });

  it("sorts wide-format rows numerically when x domains are interleaved across traces", () => {
    const gd = {
      data: [
        { x: [1, 3], y: [10, 30], name: "A", type: "scatter" },
        { x: [2, 4], y: [200, 400], name: "B", type: "scatter" },
      ],
    };
    expect(buildCsvFromGraphDiv(gd)).toBe(
      "x,A,B\n1,10,\n2,,200\n3,30,\n4,,400",
    );
  });

  it("sorts wide-format rows chronologically when x values are date strings out of order", () => {
    const gd = {
      data: [
        {
          x: ["2020-01-03", "2020-01-01", "2020-01-02"],
          y: [3, 1, 2],
          name: "A",
          type: "scatter",
        },
      ],
    };
    expect(buildCsvFromGraphDiv(gd)).toBe(
      "x,A\n2020-01-01,1\n2020-01-02,2\n2020-01-03,3",
    );
  });

  it("sorts wide-format rows lexicographically without throwing when x values are mixed types", () => {
    const gd = {
      data: [{ x: ["abc", 2, "1"], y: [1, 2, 3], name: "A", type: "scatter" }],
    };
    expect(() => buildCsvFromGraphDiv(gd)).not.toThrow();
    expect(buildCsvFromGraphDiv(gd)).toBe("x,A\n1,3\n2,2\nabc,1");
  });

  it("sorts out-of-order numeric x with no duplicates (row order now sorted, not insertion order)", () => {
    const gd = {
      data: [{ x: [3, 1, 2], y: [30, 10, 20], name: "A", type: "scatter" }],
    };
    expect(buildCsvFromGraphDiv(gd)).toBe("x,A\n1,10\n2,20\n3,30");
  });
});

describe("buildCsvFromGraphDiv toArray fallback", () => {
  it("emits empty cells for a trace whose y is missing (non-array value)", () => {
    const gd = {
      data: [{ x: [1, 2], name: "A", type: "scatter" }],
    };
    expect(buildCsvFromGraphDiv(gd)).toBe("x,A\n1,\n2,");
  });

  it("treats a bdata spec with an unknown dtype as empty", () => {
    const gd = {
      data: [
        {
          x: [1],
          y: { dtype: "z9", bdata: "AAAA" },
          name: "A",
          type: "scatter",
        },
      ],
    };
    expect(buildCsvFromGraphDiv(gd)).toBe("x,A\n1,");
  });

  it("joins array-valued table headers and tolerates missing header/cells", () => {
    // Multi-part header values (arrays) join with spaces.
    const withArrayHeaders = {
      data: [
        {
          type: "table",
          header: { values: [["col", "1"], "col2"] },
          cells: { values: [["a"], ["b"]] },
        },
      ],
    };
    expect(buildCsvFromGraphDiv(withArrayHeaders)).toBe("col 1,col2\na,b");

    // A table trace with no header/cells degrades to an empty section.
    expect(buildCsvFromGraphDiv({ data: [{ type: "table" }] })).toBe("");
  });
});

describe("downloadCsvFromGraphDiv", () => {
  let clickSpy;

  beforeEach(() => {
    clickSpy = jest.fn();
    global.URL.createObjectURL = jest.fn(() => "blob:url");
    global.URL.revokeObjectURL = jest.fn();
    const realCreate = document.createElement.bind(document);
    jest.spyOn(document, "createElement").mockImplementation((tag) => {
      const el = realCreate(tag);
      if (tag === "a") el.click = clickSpy;
      return el;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("triggers a CSV download for the visible data", () => {
    downloadCsvFromGraphDiv({
      data: [{ x: [1], y: [2], name: "A", type: "scatter" }],
      layout: { title: { text: "My Plot" } },
    });
    expect(global.URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:url");
  });

  it("does nothing when there is no visible data", () => {
    downloadCsvFromGraphDiv({ data: [] });
    expect(global.URL.createObjectURL).not.toHaveBeenCalled();
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it("derives the filename from a plain-string title, and falls back to plot_data", () => {
    const downloadNames = () =>
      document.createElement.mock.results
        .map((r) => r.value)
        .filter((el) => el?.tagName === "A")
        .map((el) => el.download);

    // Plain string title (not the { text } object form), sanitized.
    downloadCsvFromGraphDiv({
      data: [{ x: [1], y: [2], name: "A", type: "scatter" }],
      layout: { title: "My Plot/Name" },
    });
    // No layout at all -> default name.
    downloadCsvFromGraphDiv({
      data: [{ x: [1], y: [2], name: "A", type: "scatter" }],
    });
    // Title of only special characters sanitizes to empty -> default name.
    downloadCsvFromGraphDiv({
      data: [{ x: [1], y: [2], name: "A", type: "scatter" }],
      layout: { title: { text: "///" } },
    });

    expect(downloadNames()).toEqual([
      "My_Plot_Name.csv",
      "plot_data.csv",
      "plot_data.csv",
    ]);
  });

  it("csvDownloadButton.click routes the graph div into the download", () => {
    expect(csvDownloadButton.name).toBe("downloadCsv");
    csvDownloadButton.click({
      data: [{ x: [1], y: [2], name: "A", type: "scatter" }],
      layout: { title: { text: "My Plot" } },
    });
    expect(global.URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});

import LegendRenderer, { LegendSymbol } from "components/map/LegendRenderer";
import { render, screen, waitFor } from "@testing-library/react";
import { defaultStroke } from "components/inputs/RuleEditor";

const ESRIResponse = {
  layers: [
    {
      layerId: 0,
      layerName: "Layer A",
      legend: [
        {
          label: "Symbol A",
          imageData: "abcd1234",
          contentType: "image/png",
          width: 20,
          height: 20,
        },
      ],
    },
    {
      layerId: 1,
      layerName: "Layer B",
      legend: [
        {
          label: "Symbol B",
          imageData: "efgh5678",
          contentType: "image/png",
          width: 20,
          height: 20,
        },
      ],
    },
  ],
};

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.resetAllMocks();
});

test("LegendRenderer", async () => {
  const { container } = render(<LegendRenderer />);
  // eslint-disable-next-line
  expect(container.firstChild).toBeNull();
});

test("LegendRenderer; custom legend with no items", async () => {
  render(<LegendRenderer legend={{ title: "", items: [] }} />);
  const list = screen.getByRole("list"); // <ul>
  expect(list).toBeInTheDocument();

  const items = screen.queryAllByRole("listitem"); // <li>
  expect(items).toHaveLength(0);
});

test("LegendRenderer; custom legend with 1 item", async () => {
  render(
    <LegendRenderer
      legend={{
        title: "Some Title",
        items: [
          { symbol: "square", color: "green", label: "some legend item" },
        ],
      }}
    />,
  );

  expect(screen.getByText("Some Title")).toBeInTheDocument();
  expect(screen.queryByRole("list")).not.toBeInTheDocument();
  const symbol1 = screen.getByLabelText("green-square");
  expect(symbol1).toBeInTheDocument();
});

test("LegendRenderer; custom legend with multiple items", async () => {
  render(
    <LegendRenderer
      legend={{
        title: "Some Title",
        items: [
          { symbol: "square", color: "green", label: "some legend item" },
          { symbol: "circle", color: "blue", label: "some legend item 2" },
        ],
      }}
    />,
  );
  const list = screen.getByRole("list"); // <ul>
  expect(list).toBeInTheDocument();

  const items = screen.queryAllByRole("listitem"); // <li>
  expect(items).toHaveLength(2);

  expect(screen.getByText("Some Title")).toBeInTheDocument();
  expect(screen.getByText("some legend item")).toBeInTheDocument();
  expect(screen.getByText("some legend item 2")).toBeInTheDocument();
  const symbol1 = screen.getByLabelText("green-square");
  expect(symbol1).toBeInTheDocument();
  const symbol2 = screen.getByLabelText("blue-circle");
  expect(symbol2).toBeInTheDocument();
});

describe("LegendRenderer; ramp legend (GeoTIFF)", () => {
  const rampColors = ["#000000", "#808080", "#ffffff"];

  test("renders gradient strip with min/max labels and title", () => {
    render(
      <LegendRenderer
        legend={{
          title: "Elevation",
          rampColors,
          rampMin: 0,
          rampMax: 100,
        }}
      />,
    );

    // Title rendered
    expect(screen.getByText("Elevation")).toBeInTheDocument();

    // Gradient strip rendered with role="img" and proper aria-label
    const gradient = screen.getByRole("img", {
      name: "Color ramp from 0 to 100",
    });
    expect(gradient).toBeInTheDocument();
    expect(gradient).toHaveStyle({
      background: `linear-gradient(to right, ${rampColors.join(",")})`,
    });

    // Min/max scale labels
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  test("omits the title when not provided", () => {
    render(
      <LegendRenderer
        legend={{
          rampColors,
          rampMin: -10,
          rampMax: 10,
        }}
      />,
    );

    const gradient = screen.getByRole("img", {
      name: "Color ramp from -10 to 10",
    });
    expect(gradient).toBeInTheDocument();
    expect(screen.getByText("-10")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  test("does not render the ramp branch when rampColors is empty", () => {
    const { container } = render(
      <LegendRenderer
        legend={{
          rampColors: [],
          rampMin: 0,
          rampMax: 1,
        }}
      />,
    );
    // Empty rampColors should fall through; with no items/styleJSON/etc.,
    // renderer returns null
    // eslint-disable-next-line
    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  test("renders string min/max values in the labels and aria-label", () => {
    render(
      <LegendRenderer
        legend={{
          title: "Temperature (°C)",
          rampColors,
          rampMin: "low",
          rampMax: "high",
        }}
      />,
    );
    expect(
      screen.getByRole("img", { name: "Color ramp from low to high" }),
    ).toBeInTheDocument();
    expect(screen.getByText("low")).toBeInTheDocument();
    expect(screen.getByText("high")).toBeInTheDocument();
  });
});

test("LegendRenderer; ESRI and no url", async () => {
  render(
    <LegendRenderer
      legend={{
        sourceType: "ESRI Image and Map Service",
      }}
    />,
  );

  expect(
    screen.getByText("No URL provided for ESRI legend."),
  ).toBeInTheDocument();
  expect(screen.queryByText("Loading legend...")).not.toBeInTheDocument();
});

test("LegendRenderer; ESRI and no layers", async () => {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ESRIResponse,
  });

  render(
    <LegendRenderer
      legend={{
        sourceType: "ESRI Image and Map Service",
        url: "some/MapServer",
      }}
    />,
  );

  expect(screen.getByText("Loading legend...")).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.getByText("Layer A")).toBeInTheDocument();
  });
  const lists = screen.queryAllByRole("list");
  expect(lists).toHaveLength(2);

  const items = screen.queryAllByRole("listitem"); // <li>
  expect(items).toHaveLength(2);

  const img1 = await screen.findByAltText("Symbol A");
  expect(img1).toBeInTheDocument();
  expect(img1).toHaveAttribute("src", "data:image/png;base64,abcd1234");
  expect(img1).toHaveAttribute("width", "20");
  expect(img1).toHaveAttribute("height", "20");

  expect(screen.getByText("Layer B")).toBeInTheDocument();
  const img2 = await screen.findByAltText("Symbol B");
  expect(img2).toBeInTheDocument();
  expect(img2).toHaveAttribute("src", "data:image/png;base64,efgh5678");
  expect(img2).toHaveAttribute("width", "20");
  expect(img2).toHaveAttribute("height", "20");
});

test("LegendRenderer; ESRI and typo layer", async () => {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ESRIResponse,
  });

  render(
    <LegendRenderer
      legend={{
        sourceType: "ESRI Image and Map Service",
        url: "some/MapServer",
        layers: "shw:0",
      }}
    />,
  );

  expect(screen.getByText("Loading legend...")).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.queryByText("Loading legend...")).not.toBeInTheDocument();
  });
  const lists = screen.queryAllByRole("list");
  expect(lists).toHaveLength(0);

  const items = screen.queryAllByRole("listitem"); // <li>
  expect(items).toHaveLength(0);

  expect(screen.queryByText("Layer A")).not.toBeInTheDocument();
  expect(screen.queryByText("Layer B")).not.toBeInTheDocument();
});

test("LegendRenderer; ESRI and bad layer", async () => {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ESRIResponse,
  });

  render(
    <LegendRenderer
      legend={{
        sourceType: "ESRI Image and Map Service",
        url: "some/MapServer",
        layers: { aasd: "aasd" },
      }}
    />,
  );

  expect(screen.getByText("Loading legend...")).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.queryByText("Loading legend...")).not.toBeInTheDocument();
  });
  const lists = screen.queryAllByRole("list");
  expect(lists).toHaveLength(0);

  const items = screen.queryAllByRole("listitem"); // <li>
  expect(items).toHaveLength(0);

  expect(screen.queryByText("Layer A")).not.toBeInTheDocument();
  expect(screen.queryByText("Layer B")).not.toBeInTheDocument();
});

test("LegendRenderer; ESRI and integer layer", async () => {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ESRIResponse,
  });

  render(
    <LegendRenderer
      legend={{
        sourceType: "ESRI Image and Map Service",
        url: "some/MapServer",
        layers: 0,
      }}
    />,
  );

  expect(screen.getByText("Loading legend...")).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.getByText("Layer A")).toBeInTheDocument();
  });
  const list = await screen.findByRole("list");
  expect(list).toBeInTheDocument();

  const items = screen.queryAllByRole("listitem"); // <li>
  expect(items).toHaveLength(1);

  const img1 = await screen.findByAltText("Symbol A");
  expect(img1).toBeInTheDocument();
  expect(img1).toHaveAttribute("src", "data:image/png;base64,abcd1234");
  expect(img1).toHaveAttribute("width", "20");
  expect(img1).toHaveAttribute("height", "20");

  expect(screen.queryByText("Layer B")).not.toBeInTheDocument();
});

test("LegendRenderer; ESRI and show 0", async () => {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ESRIResponse,
  });

  render(
    <LegendRenderer
      legend={{
        sourceType: "ESRI Image and Map Service",
        url: "some/MapServer",
        layers: "show:0",
      }}
    />,
  );

  expect(screen.getByText("Loading legend...")).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.getByText("Layer A")).toBeInTheDocument();
  });
  const list = await screen.findByRole("list");
  expect(list).toBeInTheDocument();

  const items = screen.queryAllByRole("listitem"); // <li>
  expect(items).toHaveLength(1);

  const img1 = await screen.findByAltText("Symbol A");
  expect(img1).toBeInTheDocument();
  expect(img1).toHaveAttribute("src", "data:image/png;base64,abcd1234");
  expect(img1).toHaveAttribute("width", "20");
  expect(img1).toHaveAttribute("height", "20");

  expect(screen.queryByText("Layer B")).not.toBeInTheDocument();
});

test("LegendRenderer; ESRI and hide 0", async () => {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ESRIResponse,
  });

  render(
    <LegendRenderer
      legend={{
        sourceType: "ESRI Image and Map Service",
        url: "some/MapServer",
        layers: "hide:0",
      }}
    />,
  );

  expect(screen.getByText("Loading legend...")).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.getByText("Layer B")).toBeInTheDocument();
  });
  const list = await screen.findByRole("list");
  expect(list).toBeInTheDocument();

  const items = screen.queryAllByRole("listitem"); // <li>
  expect(items).toHaveLength(1);

  expect(screen.queryByText("Layer A")).not.toBeInTheDocument();

  expect(screen.getByText("Layer B")).toBeInTheDocument();
  const img2 = await screen.findByAltText("Symbol B");
  expect(img2).toBeInTheDocument();
  expect(img2).toHaveAttribute("src", "data:image/png;base64,efgh5678");
  expect(img2).toHaveAttribute("width", "20");
  expect(img2).toHaveAttribute("height", "20");
});

test("LegendRenderer; ESRI and include 0", async () => {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ESRIResponse,
  });

  render(
    <LegendRenderer
      legend={{
        sourceType: "ESRI Image and Map Service",
        url: "some/MapServer",
        layers: "include:0",
      }}
    />,
  );

  expect(screen.getByText("Loading legend...")).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.getByText("Layer A")).toBeInTheDocument();
  });
  const lists = screen.queryAllByRole("list");
  expect(lists).toHaveLength(2);

  const items = screen.queryAllByRole("listitem"); // <li>
  expect(items).toHaveLength(2);

  const img1 = await screen.findByAltText("Symbol A");
  expect(img1).toBeInTheDocument();
  expect(img1).toHaveAttribute("src", "data:image/png;base64,abcd1234");
  expect(img1).toHaveAttribute("width", "20");
  expect(img1).toHaveAttribute("height", "20");

  expect(screen.getByText("Layer B")).toBeInTheDocument();
  const img2 = await screen.findByAltText("Symbol B");
  expect(img2).toBeInTheDocument();
  expect(img2).toHaveAttribute("src", "data:image/png;base64,efgh5678");
  expect(img2).toHaveAttribute("width", "20");
  expect(img2).toHaveAttribute("height", "20");
});

test("LegendRenderer; ESRI and exclude 0", async () => {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ESRIResponse,
  });

  render(
    <LegendRenderer
      legend={{
        sourceType: "ESRI Image and Map Service",
        url: "some/MapServer",
        layers: "exclude:0",
      }}
    />,
  );

  expect(screen.getByText("Loading legend...")).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.getByText("Layer B")).toBeInTheDocument();
  });
  const list = await screen.findByRole("list");
  expect(list).toBeInTheDocument();

  const items = screen.queryAllByRole("listitem"); // <li>
  expect(items).toHaveLength(1);

  expect(screen.queryByText("Layer A")).not.toBeInTheDocument();

  expect(screen.getByText("Layer B")).toBeInTheDocument();
  const img2 = await screen.findByAltText("Symbol B");
  expect(img2).toBeInTheDocument();
  expect(img2).toHaveAttribute("src", "data:image/png;base64,efgh5678");
  expect(img2).toHaveAttribute("width", "20");
  expect(img2).toHaveAttribute("height", "20");
});

test("LegendRenderer; ESRI Feature Service", async () => {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ESRIResponse,
  });

  render(
    <LegendRenderer
      legend={{
        sourceType: "ESRI Image and Map Service",
        url: "some/FeatureServer",
        layers: "0",
      }}
    />,
  );

  expect(screen.getByText("Loading legend...")).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.getByText("Layer A")).toBeInTheDocument();
  });
  const list = await screen.findByRole("list");
  expect(list).toBeInTheDocument();

  const items = screen.queryAllByRole("listitem"); // <li>
  expect(items).toHaveLength(1);

  const img1 = await screen.findByAltText("Symbol A");
  expect(img1).toBeInTheDocument();
  expect(img1).toHaveAttribute("src", "data:image/png;base64,abcd1234");
  expect(img1).toHaveAttribute("width", "20");
  expect(img1).toHaveAttribute("height", "20");

  expect(screen.queryByText("Layer B")).not.toBeInTheDocument();
});

test("LegendRenderer; empty styleJSON", async () => {
  const legend = {
    styleJSON: {},
    title: "test",
  };
  render(<LegendRenderer legend={legend} />);

  expect(screen.getByText("test")).toBeInTheDocument();
  const list = screen.getByRole("list"); // <ul>
  expect(list).toBeInTheDocument();

  const items = screen.queryAllByRole("listitem"); // <li>
  expect(items).toHaveLength(0);
});

test("LegendRenderer; styleJSON only default point", async () => {
  const legend = {
    styleJSON: {
      rules: [],
      default: {
        point: {
          shape: "star",
        },
      },
    },
    title: "test",
  };
  render(<LegendRenderer legend={legend} />);

  expect(screen.getByText("test")).toBeInTheDocument();
  const list = screen.queryByRole("list");
  expect(list).not.toBeInTheDocument();

  expect(screen.queryByText("Default")).not.toBeInTheDocument();
  const svgElements = await screen.findByLabelText(
    "rgba(255, 255, 255, 0.4)-star",
  );
  expect(svgElements).toBeInTheDocument();
});

test("LegendRenderer; styleJSON only default point icon", async () => {
  const legend = {
    styleJSON: {
      rules: [],
      default: {
        point: {
          shape: "icon",
          iconUrl: "http://example.com/icon.png",
        },
      },
    },
    title: "test",
  };
  render(<LegendRenderer legend={legend} />);

  expect(screen.getByText("test")).toBeInTheDocument();
  const list = screen.queryByRole("list");
  expect(list).not.toBeInTheDocument();

  expect(screen.queryByText("Default")).not.toBeInTheDocument();

  const defaultIcon = await screen.findByLabelText("icon-point");
  expect(defaultIcon).toBeInTheDocument();
  expect(defaultIcon).toHaveAttribute("src", "http://example.com/icon.png");
});

test("LegendRenderer; styleJSON legend linestrings", async () => {
  const legend = {
    styleJSON: {
      rules: [
        {
          geometryType: "linestring",
          conditionField: "id",
          conditionType: "=",
          conditionValue: "test-line",
          stroke: "#f50000",
        },
      ],
      default: {
        linestring: {
          strokeDash: "8,4,2,4,2,4",
          strokeWidth: "2.5",
        },
      },
    },
    title: "test",
  };
  render(<LegendRenderer legend={legend} />);

  expect(screen.getByText("test")).toBeInTheDocument();
  const list = screen.getByRole("list"); // <ul>
  expect(list).toBeInTheDocument();

  const items = screen.queryAllByRole("listitem"); // <li>
  expect(items).toHaveLength(2); //default and rule

  expect(screen.getByText("Default")).toBeInTheDocument();
  expect(screen.getByText("Linestring: id = test-line")).toBeInTheDocument();
  const svgElements = await screen.findAllByLabelText("linestring");
  expect(svgElements).toHaveLength(2);

  // eslint-disable-next-line testing-library/no-node-access
  const lineElement = svgElements[0].querySelector("line");
  expect(lineElement).toBeInTheDocument();
  expect(lineElement).toHaveAttribute("x1", "2");
  expect(lineElement).toHaveAttribute("y1", "6");
  expect(lineElement).toHaveAttribute("x2", "20");
  expect(lineElement).toHaveAttribute("y2", "6");
  expect(lineElement).toHaveAttribute("stroke", "#3399CC");
  expect(lineElement).toHaveAttribute("stroke-width", "1.6666666666666665");
  expect(lineElement).toHaveAttribute("stroke-linecap", "round");
  expect(lineElement).toHaveAttribute("stroke-dasharray", "8 4 2 4 2 4");

  // eslint-disable-next-line testing-library/no-node-access
  const lineElementRule = svgElements[1].querySelector("line");
  expect(lineElementRule).toBeInTheDocument();
  expect(lineElementRule).toHaveAttribute("x1", "2");
  expect(lineElementRule).toHaveAttribute("y1", "6");
  expect(lineElementRule).toHaveAttribute("x2", "20");
  expect(lineElementRule).toHaveAttribute("y2", "6");
  expect(lineElementRule).toHaveAttribute("stroke", "#f50000");
  expect(lineElementRule).toHaveAttribute("stroke-width", "1.6666666666666665");
  expect(lineElementRule).toHaveAttribute("stroke-linecap", "round");
  expect(lineElementRule).toHaveAttribute("stroke-dasharray", "8 4 2 4 2 4");
});

test("LegendRenderer; styleJSON legend polygon", async () => {
  const legend = {
    styleJSON: {
      rules: [
        {
          geometryType: "polygon",
          conditionField: "id",
          conditionType: "=",
          conditionValue: "test-line",
          fill: "#f50000",
        },
      ],
      default: {
        polygon: {
          strokeDash: "8,4,2,4,2,4",
          strokeWidth: "2.5",
        },
      },
    },
    title: "test",
  };
  render(<LegendRenderer legend={legend} />);

  expect(screen.getByText("test")).toBeInTheDocument();
  const list = screen.getByRole("list"); // <ul>
  expect(list).toBeInTheDocument();

  const items = screen.queryAllByRole("listitem"); // <li>
  expect(items).toHaveLength(2); //default and rule

  expect(screen.getByText("Default")).toBeInTheDocument();
  expect(screen.getByText("Polygon: id = test-line")).toBeInTheDocument();

  const defaultSVGElement = await screen.findByLabelText(
    "rgba(255, 255, 255, 0.4)-square",
  );
  expect(defaultSVGElement).toBeInTheDocument();
  expect(defaultSVGElement).toHaveAttribute(
    "style",
    expect.stringContaining("color: rgba(255, 255, 255, 0.4);"),
  );

  const rule1SVGElement = await screen.findByLabelText("#f50000-square");
  expect(rule1SVGElement).toBeInTheDocument();
  expect(rule1SVGElement).toHaveAttribute(
    "style",
    expect.stringContaining("color: rgb(245, 0, 0);"),
  );
});

test("LegendRenderer; styleJSON legend points and missing some keys", async () => {
  const legend = {
    styleJSON: {
      rules: [
        {
          conditionType: "=",
          conditionValue: "test-point",
          stroke: "#f50000",
          shape: "triangle",
        },
        {
          geometryType: "point",
          conditionField: "id",
          conditionType: "=",
          conditionValue: "test-point-2",
          iconUrl: "http://example.com/icon.png",
          shape: "icon",
          size: 1,
        },
        {
          name: "Custom Point Rule",
          geometryType: "point",
          conditionField: "id",
          conditionType: "=",
          conditionValue: "test-point-3",
          shape: "square",
          size: 2,
        },
      ],
      default: {
        point: {
          fill: "black",
        },
      },
    },
    title: "test",
  };
  render(<LegendRenderer legend={legend} />);

  expect(screen.getByText("test")).toBeInTheDocument();
  const list = screen.getByRole("list"); // <ul>
  expect(list).toBeInTheDocument();

  const items = screen.queryAllByRole("listitem"); // <li>
  expect(items).toHaveLength(4); //default and 2 rule

  expect(screen.getByText("Default")).toBeInTheDocument();
  expect(screen.getByText("Point (Rule)")).toBeInTheDocument();
  expect(screen.getByText("Point: id = test-point-2")).toBeInTheDocument();
  expect(screen.getByText("Custom Point Rule")).toBeInTheDocument();

  const defaultSVGElement = await screen.findByLabelText("black-circle");
  expect(defaultSVGElement).toBeInTheDocument();
  expect(defaultSVGElement).toHaveAttribute(
    "style",
    expect.stringContaining("color: black;"),
  );
  // eslint-disable-next-line testing-library/no-node-access
  const lineElement = defaultSVGElement.querySelector("circle");
  expect(lineElement).toBeInTheDocument();
  expect(lineElement).toHaveAttribute("cx", "8");
  expect(lineElement).toHaveAttribute("cy", "8");
  expect(lineElement).toHaveAttribute("r", "8");

  const rule1SVGElement = await screen.findByLabelText("black-triangle");
  expect(rule1SVGElement).toBeInTheDocument();
  expect(rule1SVGElement).toHaveAttribute(
    "style",
    expect.stringContaining("stroke: #f50000;"),
  );

  const rule2Icon = await screen.findByLabelText(
    "icon-Point: id = test-point-2",
  );
  expect(rule2Icon).toBeInTheDocument();
  expect(rule2Icon).toHaveAttribute("src", "http://example.com/icon.png");

  const rule3SVGElement = await screen.findByLabelText("black-square");
  expect(rule3SVGElement).toBeInTheDocument();
  expect(rule3SVGElement).toHaveAttribute(
    "style",
    "color: black; stroke: #3399CC; stroke-width: 1.33;",
  );
});

test("LegendRenderer; styleJSON default icon shape", async () => {
  const legend = {
    styleJSON: {
      rules: [
        {
          geometryType: "point",
          conditionField: "id",
          conditionType: "=",
          conditionValue: "test-point-2",
          iconUrl: "http://example.com/icon2.png",
          shape: "icon",
          size: 1,
        },
      ],
      default: {
        point: {
          fill: "black",
          iconUrl: "http://example.com/icon.png",
          shape: "icon",
        },
      },
    },
    title: "test",
  };
  render(<LegendRenderer legend={legend} />);

  expect(screen.getByText("test")).toBeInTheDocument();
  const list = screen.getByRole("list"); // <ul>
  expect(list).toBeInTheDocument();

  const items = screen.queryAllByRole("listitem"); // <li>
  expect(items).toHaveLength(2); //default and 2 rule

  expect(screen.getByText("Default")).toBeInTheDocument();
  expect(screen.getByText("Point: id = test-point-2")).toBeInTheDocument();

  const defaultIcon = await screen.findByLabelText("icon-Default");
  expect(defaultIcon).toBeInTheDocument();
  expect(defaultIcon).toHaveAttribute("src", "http://example.com/icon.png");
  expect(defaultIcon).toHaveStyle({ width: "16px", height: "16px" });

  const ruleIcon = await screen.findByLabelText(
    "icon-Point: id = test-point-2",
  );
  expect(ruleIcon).toBeInTheDocument();
  expect(ruleIcon).toHaveAttribute("src", "http://example.com/icon2.png");
  expect(ruleIcon).toHaveStyle({ width: "16px", height: "16px" });
});

test("LegendRenderer; styleJSON default icon shape missing url", async () => {
  const legend = {
    styleJSON: {
      rules: [
        {
          geometryType: "point",
          conditionField: "id",
          conditionType: "=",
          conditionValue: "test-point-2",
          shape: "icon",
          size: 1,
        },
      ],
      default: {
        point: {
          fill: "black",
          shape: "icon",
        },
      },
    },
    title: "test",
  };
  render(<LegendRenderer legend={legend} />);

  expect(screen.getByText("test")).toBeInTheDocument();
  const list = screen.getByRole("list"); // <ul>
  expect(list).toBeInTheDocument();

  const items = screen.queryAllByRole("listitem"); // <li>
  expect(items).toHaveLength(2); //default and 2 rule

  expect(screen.getByText("Default")).toBeInTheDocument();
  expect(screen.getByText("Point: id = test-point-2")).toBeInTheDocument();

  const SVGElements = await screen.findAllByLabelText("black-circle");

  const defaultSVGElement = SVGElements[0];
  expect(defaultSVGElement).toBeInTheDocument();
  expect(defaultSVGElement).toHaveAttribute(
    "style",
    "color: black; stroke: #3399CC; stroke-width: 1.33;",
  );
  // eslint-disable-next-line testing-library/no-node-access
  let lineElement = defaultSVGElement.querySelector("circle");
  expect(lineElement).toBeInTheDocument();
  expect(lineElement).toHaveAttribute("cx", "8");
  expect(lineElement).toHaveAttribute("cy", "8");
  expect(lineElement).toHaveAttribute("r", "8");

  const ruleSVGElement = SVGElements[1];
  expect(ruleSVGElement).toBeInTheDocument();
  expect(ruleSVGElement).toHaveAttribute(
    "style",
    "color: black; stroke: #3399CC; stroke-width: 1.33;",
  );
  // eslint-disable-next-line testing-library/no-node-access
  lineElement = ruleSVGElement.querySelector("circle");
  expect(lineElement).toBeInTheDocument();
  expect(lineElement).toHaveAttribute("cx", "8");
  expect(lineElement).toHaveAttribute("cy", "8");
  expect(lineElement).toHaveAttribute("r", "8");
});

test("LegendRenderer; styleJSON legend bad geom", async () => {
  const legend = {
    styleJSON: {
      rules: [
        {
          geometryType: "bad-geom",
          conditionField: "id",
          conditionType: "=",
          conditionValue: "test-point",
          stroke: "#f50000",
          shape: "triangle",
          iconUrl: "http://example.com/icon.png", // ignored when shape is not iconUrl
        },
      ],
      default: {
        point: {
          fill: "black",
        },
      },
    },
    title: "test",
  };
  render(<LegendRenderer legend={legend} />);

  expect(screen.getByText("test")).toBeInTheDocument();
  const list = screen.getByRole("list"); // <ul>
  expect(list).toBeInTheDocument();

  const items = screen.queryAllByRole("listitem"); // <li>
  expect(items).toHaveLength(2); //default and 1 rule

  expect(screen.getByText("Default")).toBeInTheDocument();
  expect(screen.getByText("Bad-geom: id = test-point")).toBeInTheDocument();
  const defaultSVGElement = await screen.findByLabelText("black-circle");
  expect(defaultSVGElement).toBeInTheDocument();
  expect(defaultSVGElement).toHaveAttribute(
    "style",
    `color: black; stroke: ${defaultStroke}; stroke-width: 1.33;`,
  );
  // eslint-disable-next-line testing-library/no-node-access
  const lineElement = defaultSVGElement.querySelector("circle");
  expect(lineElement).toBeInTheDocument();
  expect(lineElement).toHaveAttribute("cx", "8");
  expect(lineElement).toHaveAttribute("cy", "8");
  expect(lineElement).toHaveAttribute("r", "8");

  const rule1SVGElement = await screen.findByLabelText(
    "rgba(255, 255, 255, 0.4)-triangle",
  );
  expect(rule1SVGElement).toBeInTheDocument();
  expect(rule1SVGElement).toHaveAttribute(
    "style",
    "color: rgba(255, 255, 255, 0.4); stroke: #f50000; stroke-width: 1.33;",
  );
});

test("shows error when ESRI fetch fails", async () => {
  const legend = {
    sourceType: "ESRI Feature Service",
    url: "http://example.com/arcgis/rest/services/Sample/FeatureServer",
  };

  fetch.mockRejectedValueOnce(new Error("Network error"));

  render(<LegendRenderer legend={legend} />);
  expect(
    await screen.findByText(/failed to load ESRI legend/i),
  ).toBeInTheDocument();
});

test("shows error when ESRI bad response", async () => {
  global.fetch.mockResolvedValueOnce({
    ok: false,
  });

  render(
    <LegendRenderer
      legend={{
        sourceType: "ESRI Image and Map Service",
        url: "some/MapServer",
      }}
    />,
  );

  expect(screen.getByText("Loading legend...")).toBeInTheDocument();
  expect(
    await screen.findByText(/failed to load ESRI legend/i),
  ).toBeInTheDocument();
});

test("renders WMS legend loading and image success", async () => {
  const legend = {
    sourceType: "WMS",
    layers: "layer1,layer2",
    url: "http://example.com/wms",
  };

  // Mock global Image
  const originalImage = global.Image;

  global.Image = class {
    constructor() {
      setTimeout(() => {
        if (this.onload) this.onload(); // simulate load
      }, 0);
    }
    set src(_src) {} // no-op
  };

  render(<LegendRenderer legend={legend} />);
  expect(screen.getByText(/loading legend/i)).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.getByText("layer1")).toBeInTheDocument();
  });
  expect(screen.getByAltText("Legend for layer1")).toBeInTheDocument();

  // Restore original Image constructor
  global.Image = originalImage;
});

test("shows error when WMS image fails", async () => {
  const legend = {
    sourceType: "WMS",
    layers: "layer1",
    url: "http://example.com/wms",
  };

  const OriginalImage = global.Image;

  // Mock Image to simulate error
  global.Image = class {
    constructor() {
      setTimeout(() => {
        if (this.onerror) this.onerror(); // simulate load failure
      }, 0);
    }
    set src(_src) {} // no-op
  };

  render(<LegendRenderer legend={legend} />);

  expect(
    await screen.findByText(/failed to load WMS legend/i),
  ).toBeInTheDocument();

  global.Image = OriginalImage; // restore
});

test("LegendSymbol", async () => {
  render(<LegendSymbol symbol={"circle"} color={"green"} />);

  expect(await screen.findByLabelText("green-circle")).toBeInTheDocument();
});

test("LegendSymbol; bad symbol", async () => {
  render(<LegendSymbol symbol={"sfsdfsdf"} color={"green"} />);

  const symbol = await screen.findByLabelText("green-circle");
  expect(symbol).toBeInTheDocument();
});

test("LegendSymbol, polygon hatch diagonal pattern", async () => {
  render(
    <LegendSymbol
      symbol="polygon"
      color="red"
      polygonFillType="hatch"
      hatchSpacing={10}
      hatchDirection="diagonal"
    />,
  );

  const svgElement = await screen.findByLabelText("polygon-hatch");
  expect(svgElement).toBeInTheDocument();
  expect(svgElement).toHaveAttribute("width", "16");
  expect(svgElement).toHaveAttribute("height", "16");

  // eslint-disable-next-line testing-library/no-node-access
  const patternElement = svgElement.querySelector("pattern");
  expect(patternElement).toBeInTheDocument();
  expect(patternElement).toHaveAttribute("id");
  expect(patternElement).toHaveAttribute("patternUnits", "userSpaceOnUse");
  expect(patternElement).toHaveAttribute("width", "10");
  expect(patternElement).toHaveAttribute("height", "10");
  expect(patternElement).toHaveAttribute("patternTransform", "rotate(45)");

  // eslint-disable-next-line testing-library/no-node-access
  const lineElement = patternElement.querySelector("line");
  expect(lineElement).toBeInTheDocument();
  expect(lineElement).toHaveAttribute("x1", "0");
  expect(lineElement).toHaveAttribute("y1", "0");
  expect(lineElement).toHaveAttribute("x2", "0");
  expect(lineElement).toHaveAttribute("y2", "10");
  expect(lineElement).toHaveAttribute("stroke", "red");
  expect(lineElement).toHaveAttribute("stroke-width", "1.33");
});

test("LegendSymbol, polygon hatch horizontal pattern", async () => {
  render(
    <LegendSymbol
      symbol="polygon"
      color="red"
      polygonFillType="hatch"
      hatchSpacing={10}
      hatchDirection="horizontal"
    />,
  );

  const svgElement = await screen.findByLabelText("polygon-hatch");
  expect(svgElement).toBeInTheDocument();
  expect(svgElement).toHaveAttribute("width", "16");
  expect(svgElement).toHaveAttribute("height", "16");

  // eslint-disable-next-line testing-library/no-node-access
  const patternElement = svgElement.querySelector("pattern");
  expect(patternElement).toBeInTheDocument();
  expect(patternElement).toHaveAttribute("id");
  expect(patternElement).toHaveAttribute("patternUnits", "userSpaceOnUse");
  expect(patternElement).toHaveAttribute("width", "10");
  expect(patternElement).toHaveAttribute("height", "10");
  expect(patternElement).not.toHaveAttribute("patternTransform");

  // eslint-disable-next-line testing-library/no-node-access
  const lineElement = patternElement.querySelector("line");
  expect(lineElement).toBeInTheDocument();
  expect(lineElement).toHaveAttribute("x1", "0");
  expect(lineElement).toHaveAttribute("y1", "0");
  expect(lineElement).toHaveAttribute("x2", "10");
  expect(lineElement).toHaveAttribute("y2", "0");
  expect(lineElement).toHaveAttribute("stroke", "red");
  expect(lineElement).toHaveAttribute("stroke-width", "1.33");
});

test("LegendSymbol, polygon hatch vertical pattern", async () => {
  render(
    <LegendSymbol
      symbol="polygon"
      color="red"
      polygonFillType="hatch"
      hatchSpacing={10}
      hatchDirection="vertical"
    />,
  );

  const svgElement = await screen.findByLabelText("polygon-hatch");
  expect(svgElement).toBeInTheDocument();
  expect(svgElement).toHaveAttribute("width", "16");
  expect(svgElement).toHaveAttribute("height", "16");

  // eslint-disable-next-line testing-library/no-node-access
  const patternElement = svgElement.querySelector("pattern");
  expect(patternElement).toBeInTheDocument();
  expect(patternElement).toHaveAttribute("id");
  expect(patternElement).toHaveAttribute("patternUnits", "userSpaceOnUse");
  expect(patternElement).toHaveAttribute("width", "10");
  expect(patternElement).toHaveAttribute("height", "10");
  expect(patternElement).not.toHaveAttribute("patternTransform");

  // eslint-disable-next-line testing-library/no-node-access
  const lineElement = patternElement.querySelector("line");
  expect(lineElement).toBeInTheDocument();
  expect(lineElement).toHaveAttribute("x1", "0");
  expect(lineElement).toHaveAttribute("y1", "0");
  expect(lineElement).toHaveAttribute("x2", "0");
  expect(lineElement).toHaveAttribute("y2", "10");
  expect(lineElement).toHaveAttribute("stroke", "red");
  expect(lineElement).toHaveAttribute("stroke-width", "1.33");
});

test("LegendSymbol, polygon hatch cross pattern", async () => {
  render(
    <LegendSymbol
      symbol="polygon"
      color="red"
      polygonFillType="hatch"
      hatchSpacing={10}
      hatchDirection="cross"
    />,
  );

  const svgElement = await screen.findByLabelText("polygon-hatch");
  expect(svgElement).toBeInTheDocument();
  expect(svgElement).toHaveAttribute("width", "16");
  expect(svgElement).toHaveAttribute("height", "16");

  // eslint-disable-next-line testing-library/no-node-access
  const patternElement = svgElement.querySelector("pattern");
  expect(patternElement).toBeInTheDocument();
  expect(patternElement).toHaveAttribute("id");
  expect(patternElement).toHaveAttribute("patternUnits", "userSpaceOnUse");
  expect(patternElement).toHaveAttribute("width", "10");
  expect(patternElement).toHaveAttribute("height", "10");
  expect(patternElement).not.toHaveAttribute("patternTransform");

  // eslint-disable-next-line testing-library/no-node-access
  const lineElement1 = patternElement.querySelectorAll("line")[0];
  expect(lineElement1).toBeInTheDocument();
  expect(lineElement1).toHaveAttribute("x1", "0");
  expect(lineElement1).toHaveAttribute("y1", "0");
  expect(lineElement1).toHaveAttribute("x2", "10");
  expect(lineElement1).toHaveAttribute("y2", "0");
  expect(lineElement1).toHaveAttribute("stroke", "red");
  expect(lineElement1).toHaveAttribute("stroke-width", "1.33");

  // eslint-disable-next-line testing-library/no-node-access
  const lineElement2 = patternElement.querySelectorAll("line")[1];
  expect(lineElement2).toBeInTheDocument();
  expect(lineElement2).toHaveAttribute("x1", "0");
  expect(lineElement2).toHaveAttribute("y1", "0");
  expect(lineElement2).toHaveAttribute("x2", "0");
  expect(lineElement2).toHaveAttribute("y2", "10");
  expect(lineElement2).toHaveAttribute("stroke", "red");
  expect(lineElement2).toHaveAttribute("stroke-width", "1.33");
});

test("LegendSymbol, polygon hatch default (diagonal) pattern", async () => {
  render(
    <LegendSymbol
      symbol="polygon"
      color="red"
      polygonFillType="hatch"
      hatchSpacing={10}
    />,
  );

  const svgElement = await screen.findByLabelText("polygon-hatch");
  expect(svgElement).toBeInTheDocument();
  expect(svgElement).toHaveAttribute("width", "16");
  expect(svgElement).toHaveAttribute("height", "16");

  // eslint-disable-next-line testing-library/no-node-access
  const patternElement = svgElement.querySelector("pattern");
  expect(patternElement).toBeInTheDocument();
  expect(patternElement).toHaveAttribute("id");
  expect(patternElement).toHaveAttribute("patternUnits", "userSpaceOnUse");
  expect(patternElement).toHaveAttribute("width", "10");
  expect(patternElement).toHaveAttribute("height", "10");
  expect(patternElement).toHaveAttribute("patternTransform", "rotate(45)");

  // eslint-disable-next-line testing-library/no-node-access
  const lineElement = patternElement.querySelector("line");
  expect(lineElement).toBeInTheDocument();
  expect(lineElement).toHaveAttribute("x1", "0");
  expect(lineElement).toHaveAttribute("y1", "0");
  expect(lineElement).toHaveAttribute("x2", "0");
  expect(lineElement).toHaveAttribute("y2", "10");
  expect(lineElement).toHaveAttribute("stroke", "red");
  expect(lineElement).toHaveAttribute("stroke-width", "1.33");
});

test("LegendSymbol, polygon dot fill", async () => {
  render(
    <LegendSymbol
      symbol="polygon"
      color="blue"
      polygonFillType="dot"
      dotSpacing={16}
      dotRadius={5}
    />,
  );

  const svgElement = await screen.findByLabelText("polygon-dot");
  expect(svgElement).toBeInTheDocument();

  // eslint-disable-next-line testing-library/no-node-access
  const patternElement = svgElement.querySelector("pattern");
  expect(patternElement).toBeInTheDocument();
  expect(patternElement).toHaveAttribute("id");
  expect(patternElement).toHaveAttribute("patternUnits", "userSpaceOnUse");
  expect(patternElement).toHaveAttribute("width", "16");
  expect(patternElement).toHaveAttribute("height", "16");

  // eslint-disable-next-line testing-library/no-node-access
  const circleElement = patternElement.querySelector("circle");
  expect(circleElement).toBeInTheDocument();
  expect(circleElement).toHaveAttribute("cx", "8");
  expect(circleElement).toHaveAttribute("cy", "8");
  expect(circleElement).toHaveAttribute("r", "3.333333333333333");
  expect(circleElement).toHaveAttribute("fill", "blue");
});

test("LegendSymbol, polygon dot fill and bad spacing", async () => {
  render(
    <LegendSymbol
      symbol="polygon"
      color="blue"
      polygonFillType="dot"
      dotSpacing={"bad"}
      dotRadius={"bad"}
    />,
  );

  const svgElement = await screen.findByLabelText("polygon-dot");
  expect(svgElement).toBeInTheDocument();

  // eslint-disable-next-line testing-library/no-node-access
  const patternElement = svgElement.querySelector("pattern");
  expect(patternElement).toBeInTheDocument();
  expect(patternElement).toHaveAttribute("id");
  expect(patternElement).toHaveAttribute("patternUnits", "userSpaceOnUse");
  expect(patternElement).toHaveAttribute("width", "8");
  expect(patternElement).toHaveAttribute("height", "8");

  // eslint-disable-next-line testing-library/no-node-access
  const circleElement = patternElement.querySelector("circle");
  expect(circleElement).toBeInTheDocument();
  expect(circleElement).toHaveAttribute("cx", "4");
  expect(circleElement).toHaveAttribute("cy", "4");
  expect(circleElement).toHaveAttribute("r", "1.3333333333333333");
  expect(circleElement).toHaveAttribute("fill", "blue");
});

test("LegendSymbol, linestring", async () => {
  render(<LegendSymbol symbol="linestring" color="blue" />);

  const svgElement = await screen.findByLabelText("linestring");
  expect(svgElement).toBeInTheDocument();

  // eslint-disable-next-line testing-library/no-node-access
  const lineElement = svgElement.querySelector("line");
  expect(lineElement).toBeInTheDocument();
  expect(lineElement).toHaveAttribute("x1", "2");
  expect(lineElement).toHaveAttribute("y1", "6");
  expect(lineElement).toHaveAttribute("x2", "20");
  expect(lineElement).toHaveAttribute("y2", "6");
  expect(lineElement).toHaveAttribute("stroke", "blue");
  expect(lineElement).toHaveAttribute("stroke-width", "2.6666666666666665");
  expect(lineElement).toHaveAttribute("stroke-linecap", "round");
  expect(lineElement).not.toHaveAttribute("stroke-dasharray");
});

test("LegendSymbol, linestring with strokeDash", async () => {
  render(<LegendSymbol symbol="linestring" color="blue" strokeDash="5,5" />);

  const svgElement = await screen.findByLabelText("linestring");
  expect(svgElement).toBeInTheDocument();

  // eslint-disable-next-line testing-library/no-node-access
  const lineElement = svgElement.querySelector("line");
  expect(lineElement).toBeInTheDocument();
  expect(lineElement).toHaveAttribute("x1", "2");
  expect(lineElement).toHaveAttribute("y1", "6");
  expect(lineElement).toHaveAttribute("x2", "20");
  expect(lineElement).toHaveAttribute("y2", "6");
  expect(lineElement).toHaveAttribute("stroke", "blue");
  expect(lineElement).toHaveAttribute("stroke-width", "2.6666666666666665");
  expect(lineElement).toHaveAttribute("stroke-linecap", "round");
  expect(lineElement).toHaveAttribute("stroke-dasharray", "5 5");
});

import LegendRenderer, { LegendSymbol } from "components/map/LegendRenderer";
import { render, screen, waitFor } from "@testing-library/react";

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

test("LegendRenderer; custom legend with items", async () => {
  render(
    <LegendRenderer
      legend={{
        title: "Some Title",
        items: [
          { symbol: "square", color: "green", label: "some legend item" },
        ],
      }}
    />
  );
  const list = screen.getByRole("list"); // <ul>
  expect(list).toBeInTheDocument();

  const items = screen.queryAllByRole("listitem"); // <li>
  expect(items).toHaveLength(1);

  expect(screen.getByText("Some Title")).toBeInTheDocument();
  expect(screen.getByText("some legend item")).toBeInTheDocument();
  expect(screen.getByLabelText("green-square")).toBeInTheDocument();
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
    />
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
    />
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
    />
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
    />
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
    />
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
    />
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
    />
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
    />
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
    />
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

test("shows error when ESRI fetch fails", async () => {
  const legend = {
    sourceType: "ESRI Feature Service",
    url: "http://example.com/arcgis/rest/services/Sample/FeatureServer",
  };

  fetch.mockRejectedValueOnce(new Error("Network error"));

  render(<LegendRenderer legend={legend} />);
  expect(
    await screen.findByText(/failed to load ESRI legend/i)
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
    />
  );

  expect(screen.getByText("Loading legend...")).toBeInTheDocument();
  expect(
    await screen.findByText(/failed to load ESRI legend/i)
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
    await screen.findByText(/failed to load WMS legend/i)
  ).toBeInTheDocument();

  global.Image = OriginalImage; // restore
});

test("LegendSymbol", async () => {
  render(<LegendSymbol symbol={"circle"} color={"green"} />);

  expect(await screen.findByLabelText("green-circle")).toBeInTheDocument();
});

test("LegendSymbol; bad symbol", async () => {
  render(<LegendSymbol symbol={"sfsdfsdf"} color={"green"} />);

  expect(await screen.findByLabelText("green-square")).toBeInTheDocument();
});

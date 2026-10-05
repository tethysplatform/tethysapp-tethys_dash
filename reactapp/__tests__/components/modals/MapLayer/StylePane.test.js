import { useState } from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import StylePane from "components/modals/MapLayer/StylePane";
import appAPI from "services/api/app";
import PropTypes from "prop-types";
import userEvent from "@testing-library/user-event";
import { LayoutContext, AppContext } from "components/contexts/Contexts";
import * as utilities from "components/map/utilities";
import { fromUrl } from "geotiff";

jest.mock("geotiff", () => ({ fromUrl: jest.fn() }));

const exampleStyle = {
  version: 8,
  sprite:
    "https://cdn.arcgis.com/sharing/rest/content/items/005b8960ddd04ae781df8d471b6726b3/resources/styles/../sprites/sprite",
  glyphs:
    "https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer/resources/fonts/{fontstack}/{range}.pbf",
  sources: {
    esri: {
      type: "vector",
      url: "https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer",
      tiles: [
        "https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer/tile/{z}/{y}/{x}.pbf",
      ],
    },
  },
  layers: [
    {
      id: "Land/Ice",
      type: "fill",
      source: "esri",
      "source-layer": "Land",
      filter: ["==", "_symbol", 1],
      layout: {},
      paint: {
        "fill-opacity": 0.8,
        "fill-color": "#feffff",
      },
    },
  ],
};

const exampleRuleBasedStyle = {
  rules: [
    {
      conditionField: "id",
      conditionType: "=",
      conditionValue: "test-point",
      geometryType: "point",
      shape: "square",
      size: "20",
    },
  ],
  default: {
    point: {
      shape: "star",
      iconUrl: "https://cw3e.ucsd.edu/yuba-feather/icons/rhombus_green.png",
      size: "10",
      strokeWidth: "2",
      fill: "#fb0000",
      stroke: "#09f510",
    },
  },
};

const TestingComponent = ({
  initialStyle,
  setErrorMessage,
  sourceProps = {},
  setSourceProps,
}) => {
  const [style, setStyle] = useState(initialStyle);

  return (
    <AppContext.Provider value={{ dynamicMapLayers: [] }}>
      <LayoutContext.Provider value={{ uuid: "123" }}>
        <StylePane
          style={style}
          setStyle={setStyle}
          setErrorMessage={setErrorMessage}
          sourceProps={sourceProps}
          setSourceProps={setSourceProps}
        />
        <p data-testid="style">{style}</p>
      </LayoutContext.Provider>
    </AppContext.Provider>
  );
};

// A raster's ramp settings are saved as `configuration.style` and reach
// StylePane as `rasterStyle`, separately from the source props. The tests here
// describe a layer as one flat object -- a source with its styling -- and this
// splits it into the two the pane takes, so each test reads as the layer an
// author sees rather than as two stores. The keys are disjoint, so the split
// and the merge below are both lossless.
const RASTER_STYLE_KEYS = [
  "rampName",
  "rampMin",
  "rampMax",
  "rampReverse",
  "styleMode",
  "classes",
  "fallbackColor",
];

const splitLayer = (flat = {}) => {
  const sourceProps = {};
  const rasterStyle = {};
  Object.entries(flat).forEach(([key, value]) => {
    if (RASTER_STYLE_KEYS.includes(key)) rasterStyle[key] = value;
    else sourceProps[key] = value;
  });
  return { sourceProps, rasterStyle };
};

const GeoTIFFTestHarness = ({
  initialSourceProps,
  sourcePropsSpy,
  dynamicMapLayers = [],
}) => {
  const [layer, setLayer] = useState(initialSourceProps ?? {});
  const { sourceProps, rasterStyle } = splitLayer(layer);

  // One setter per half. Each replaces its own half wholesale -- so a style
  // that drops `classes` really drops it -- and leaves the other standing.
  const setHalf = (half) => (updater) => {
    setLayer((prev) => {
      const parts = splitLayer(prev);
      const next =
        typeof updater === "function" ? updater(parts[half]) : updater;
      const other =
        half === "sourceProps" ? parts.rasterStyle : parts.sourceProps;
      const merged = { ...other, ...next };
      if (typeof sourcePropsSpy === "function") sourcePropsSpy(merged);
      return merged;
    });
  };

  return (
    <AppContext.Provider value={{ dynamicMapLayers }}>
      <LayoutContext.Provider value={{ uuid: "123" }}>
        <StylePane
          style={undefined}
          setStyle={() => {}}
          setErrorMessage={() => {}}
          sourceProps={sourceProps}
          setSourceProps={setHalf("sourceProps")}
          rasterStyle={rasterStyle}
          setRasterStyle={setHalf("rasterStyle")}
        />
        <p data-testid="stylePinned">{String(layer.stylePinned)}</p>
        <p data-testid="maskBelow">{layer.props?.mask_below ?? ""}</p>
        <p data-testid="rampName">{layer.rampName ?? ""}</p>
        <p data-testid="rampMin">{layer.rampMin ?? ""}</p>
        <p data-testid="rampMax">{layer.rampMax ?? ""}</p>
        <p data-testid="rampReverse">{String(layer.rampReverse ?? false)}</p>
      </LayoutContext.Provider>
    </AppContext.Provider>
  );
};

test("StylePane GeoTIFF ramp/min/max handlers no-op when setSourceProps is missing", async () => {
  // Covers the `if (!setSourceProps) return;` early-returns at lines 203,
  // 207, and 212. With setSourceProps undefined, every handler must
  // short-circuit silently — the ramp picker click and the min/max input
  // changes should not throw.
  render(
    <AppContext.Provider value={{ dynamicMapLayers: [] }}>
      <LayoutContext.Provider value={{ uuid: "123" }}>
        <StylePane
          style={undefined}
          setStyle={() => {}}
          setErrorMessage={() => {}}
          sourceProps={{ type: "GeoTIFF" }}
          // intentionally omit setSourceProps to drive the early-return path
        />
      </LayoutContext.Provider>
    </AppContext.Provider>,
  );

  // Ramp picker → handleRampSelect short-circuits (line 203).
  const rampButton = await screen.findByLabelText("Select viridis ramp");
  expect(() => fireEvent.click(rampButton)).not.toThrow();

  // Min input → handleMinChange short-circuits (line 207).
  const minInput = screen.getByLabelText("Ramp Min");
  expect(() =>
    fireEvent.change(minInput, { target: { value: "10" } }),
  ).not.toThrow();

  // Max input → handleMaxChange short-circuits (line 212).
  const maxInput = screen.getByLabelText("Ramp Max");
  expect(() =>
    fireEvent.change(maxInput, { target: { value: "100" } }),
  ).not.toThrow();

  // Reverse checkbox → handleReverseToggle short-circuits too.
  const reverse = screen.getByLabelText("Reverse Color Ramp");
  expect(() => fireEvent.click(reverse)).not.toThrow();
});

test("StylePane reverse checkbox toggles sourceProps.rampReverse", async () => {
  render(<GeoTIFFTestHarness initialSourceProps={{ type: "GeoTIFF" }} />);

  const reverse = await screen.findByLabelText("Reverse Color Ramp");
  expect(reverse).not.toBeChecked();
  expect(screen.getByTestId("rampReverse")).toHaveTextContent("false");

  await userEvent.click(reverse);
  expect(screen.getByTestId("rampReverse")).toHaveTextContent("true");
  expect(await screen.findByLabelText("Reverse Color Ramp")).toBeChecked();

  await userEvent.click(screen.getByLabelText("Reverse Color Ramp"));
  expect(screen.getByTestId("rampReverse")).toHaveTextContent("false");
});

test("StylePane hides the reverse checkbox in categorical mode", async () => {
  // A discrete class list has no ramp direction to flip.
  render(
    <GeoTIFFTestHarness
      initialSourceProps={{
        type: "GeoTIFF",
        rampName: "turbo",
        styleMode: "categorical",
        classes: [{ value: "1", color: "#123456", label: "One" }],
      }}
    />,
  );

  expect(await screen.findByText("Classes")).toBeInTheDocument();
  expect(screen.queryByLabelText("Reverse Color Ramp")).not.toBeInTheDocument();
});

test("StylePane json Input", async () => {
  render(<TestingComponent sourceProps={{ type: "GeoJSON" }} />);

  expect(await screen.findByText("Upload style file")).toBeInTheDocument();

  const textArea = screen.getByLabelText("style-text-area");
  fireEvent.change(textArea, {
    target: { value: JSON.stringify(exampleStyle) },
  });
  expect(await screen.findByTestId("style")).toHaveTextContent(
    JSON.stringify(exampleStyle),
  );
});

test("StylePane Json File Upload", async () => {
  render(<TestingComponent sourceProps={{ type: "GeoJSON" }} />);

  expect(await screen.findByText("Upload style file")).toBeInTheDocument();

  const file = new File([JSON.stringify(exampleStyle)], "test-file.json", {
    type: "text/plain",
  });
  const fileInput = screen.getByTestId("file-input");
  fireEvent.change(fileInput, { target: { files: [file] } });

  await waitFor(async () => {
    expect(await screen.findByTestId("style")).toHaveTextContent(
      JSON.stringify(exampleStyle),
    );
  });
});

test("StylePane Json URL", async () => {
  global.fetch = jest.fn().mockResolvedValueOnce({
    ok: true,
  });
  const mockSetErrorMessage = jest.fn();

  render(
    <TestingComponent
      sourceProps={{ type: "GeoJSON" }}
      setErrorMessage={mockSetErrorMessage}
    />,
  );

  expect(await screen.findByText("Style Source")).toBeInTheDocument();

  const UrlRadio = await screen.findByLabelText("URL");
  await userEvent.click(UrlRadio);
  expect(UrlRadio).toBeInTheDocument();

  const UrlInput = await screen.findByLabelText("URL Input");
  fireEvent.change(UrlInput, {
    target: { value: "some/url/file.json" },
  });
  expect(await screen.findByTestId("style")).toHaveTextContent(
    "some/url/file.json",
  );
  await waitFor(() => {
    expect(mockSetErrorMessage).toHaveBeenCalledTimes(0);
  });

  const CustomRadio = await screen.findByLabelText("Custom");
  await userEvent.click(CustomRadio);
  expect(await screen.findByTestId("style")).toHaveTextContent("{}");
});

test("StylePane Json bad URL", async () => {
  global.fetch = jest.fn().mockResolvedValueOnce({
    ok: false,
  });
  const mockSetErrorMessage = jest.fn();

  render(
    <TestingComponent
      sourceProps={{ type: "GeoJSON" }}
      setErrorMessage={mockSetErrorMessage}
    />,
  );

  expect(await screen.findByText("Style Source")).toBeInTheDocument();

  const UrlRadio = await screen.findByLabelText("URL");
  await userEvent.click(UrlRadio);
  expect(UrlRadio).toBeInTheDocument();

  const UrlInput = await screen.findByLabelText("URL Input");
  fireEvent.change(UrlInput, {
    target: { value: "some/url/file.json" },
  });
  expect(await screen.findByTestId("style")).toHaveTextContent(
    "some/url/file.json",
  );
  await waitFor(() => {
    expect(mockSetErrorMessage).toHaveBeenCalledWith("Failed to retrieve JSON");
  });
});

test("StylePane Updating Existing GeoJSON", async () => {
  const mockDownloadJSON = jest.fn();
  jest.spyOn(appAPI, "downloadJSON").mockImplementation(mockDownloadJSON);
  mockDownloadJSON.mockResolvedValue({ data: exampleStyle });

  render(
    <TestingComponent
      initialStyle={"some_file.json"}
      sourceProps={{ type: "GeoJSON" }}
    />,
  );

  expect(await screen.findByText("Upload style file")).toBeInTheDocument();
  const textbox = await screen.findByRole("textbox");
  await waitFor(async () => {
    expect(textbox.value).toStrictEqual(JSON.stringify(exampleStyle, null, 4));
  });
});

test("StylePane Styling not available", async () => {
  render(<TestingComponent sourceProps={{ type: "NotGeoJSON" }} />);
  const supportedTypes = [
    "GeoJSON",
    "ESRI Feature Service",
    "PMTiles Vector",
    "Shapefile",
    "GeoPackage",
    "GeoParquet",
  ];
  expect(
    await screen.findByText(
      `Custom Styling is only available for ${supportedTypes.join(", ")} layers.`,
    ),
  ).toBeInTheDocument();
});

test("StylePane offers the style editor for a Shapefile source", async () => {
  // The gate this exercises is separate from field discovery: absent from the
  // supported list, the tab renders a dead-end panel and styling the layer is
  // impossible no matter what fields were found. Asserted on the absence of that
  // panel, which is decided at render rather than after discovery resolves.
  //
  // Discovery is stubbed so the effect does not reach the network for a URL that
  // does not exist; what it returns is covered by its own suite.
  const styleFieldsSpy = jest
    .spyOn(utilities, "getStyleFields")
    .mockResolvedValue(["HUC8", "AREASQKM"]);

  render(
    <TestingComponent
      sourceProps={{
        type: "Shapefile",
        props: { url: "https://example.org/basins.zip" },
      }}
    />,
  );

  expect(
    screen.queryByText(/Custom Styling is only available for/),
  ).not.toBeInTheDocument();
  // And discovery is reached rather than skipped, so the rule editor has fields
  // to offer once it resolves.
  await waitFor(() => {
    expect(styleFieldsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceProps: expect.objectContaining({ type: "Shapefile" }),
      }),
    );
  });
  styleFieldsSpy.mockRestore();
});

test("StylePane switches to rules mode and syncs rules/defaultStyle from JSON", async () => {
  render(<TestingComponent sourceProps={{ type: "GeoJSON" }} />);
  // Switch to rules mode
  const rulesRadio = await screen.findByLabelText("Rule-based Editor");
  await userEvent.click(rulesRadio);
  // Add a rule
  const addRuleBtn = await screen.findByLabelText("Add Rule Button");
  await userEvent.click(addRuleBtn);

  expect(JSON.parse(screen.getByTestId("style").textContent)).toStrictEqual({
    rules: [
      {
        conditionField: "",
        conditionType: "=",
        conditionValue: "",
        geometryType: "point",
      },
    ],
    default: {},
  });
});

test("StylePane valid json and then reset when switch to rules mode", async () => {
  render(<TestingComponent sourceProps={{ type: "GeoJSON" }} />);
  const textArea = screen.getByLabelText("style-text-area");
  fireEvent.change(textArea, {
    target: { value: JSON.stringify(exampleRuleBasedStyle) },
  });

  expect(textArea.value).toStrictEqual(JSON.stringify(exampleRuleBasedStyle));

  // Switch to rules mode
  const rulesRadio = await screen.findByLabelText("Rule-based Editor");
  await userEvent.click(rulesRadio);

  await waitFor(() => {
    expect(JSON.parse(screen.getByTestId("style").textContent)).toStrictEqual(
      exampleRuleBasedStyle,
    );
  });

  // Add a rule
  const addRuleBtn = await screen.findByLabelText("Add Rule Button");
  await userEvent.click(addRuleBtn);

  const expectedRules = [
    ...exampleRuleBasedStyle.rules,
    {
      conditionField: "",
      conditionType: "=",
      conditionValue: "",
      geometryType: "point",
    },
  ];
  expect(JSON.parse(screen.getByTestId("style").textContent)).toStrictEqual({
    rules: expectedRules,
    default: { ...exampleRuleBasedStyle.default },
  });
});

test("StylePane valid json missing rules and then reset when switch to rules mode", async () => {
  render(<TestingComponent sourceProps={{ type: "GeoJSON" }} />);

  const copiedStyle = { ...exampleRuleBasedStyle };
  delete copiedStyle.rules;
  copiedStyle.default = "string default";

  const textArea = screen.getByLabelText("style-text-area");
  fireEvent.change(textArea, {
    target: { value: JSON.stringify(copiedStyle) },
  });

  expect(textArea.value).toStrictEqual(JSON.stringify(copiedStyle));

  // Switch to rules mode
  const rulesRadio = await screen.findByLabelText("Rule-based Editor");
  await userEvent.click(rulesRadio);

  await waitFor(() => {
    expect(JSON.parse(screen.getByTestId("style").textContent)).toStrictEqual({
      default: {},
      rules: [],
    });
  });

  // Add a rule
  const addRuleBtn = await screen.findByLabelText("Add Rule Button");
  await userEvent.click(addRuleBtn);

  expect(JSON.parse(screen.getByTestId("style").textContent)).toStrictEqual({
    rules: [
      {
        conditionField: "",
        conditionType: "=",
        conditionValue: "",
        geometryType: "point",
      },
    ],
    default: {},
  });
});

test("StylePane bad json and then reset when switch to rules mode", async () => {
  render(<TestingComponent sourceProps={{ type: "GeoJSON" }} />);
  const textArea = screen.getByLabelText("style-text-area");
  fireEvent.change(textArea, {
    target: {
      value: "{rules: [{",
    },
  });

  expect(textArea.value).toStrictEqual("{rules: [{");

  // Switch to rules mode
  const rulesRadio = await screen.findByLabelText("Rule-based Editor");
  await userEvent.click(rulesRadio);

  await waitFor(() => {
    expect(JSON.parse(screen.getByTestId("style").textContent)).toStrictEqual({
      rules: [],
      default: {},
    });
  });

  // Add a rule
  const addRuleBtn = await screen.findByLabelText("Add Rule Button");
  await userEvent.click(addRuleBtn);

  expect(JSON.parse(screen.getByTestId("style").textContent)).toStrictEqual({
    rules: [
      {
        conditionField: "",
        conditionType: "=",
        conditionValue: "",
        geometryType: "point",
      },
    ],
    default: {},
  });
});

test("StylePane bad string and then reset when switch to rules mode", async () => {
  render(<TestingComponent sourceProps={{ type: "GeoJSON" }} />);
  const textArea = screen.getByLabelText("style-text-area");
  fireEvent.change(textArea, {
    target: { value: "a bad format" },
  });

  expect(textArea.value).toStrictEqual("a bad format");

  // Switch to rules mode
  const rulesRadio = await screen.findByLabelText("Rule-based Editor");
  await userEvent.click(rulesRadio);

  await waitFor(() => {
    expect(JSON.parse(screen.getByTestId("style").textContent)).toStrictEqual({
      rules: [],
      default: {},
    });
  });

  // Add a rule
  const addRuleBtn = await screen.findByLabelText("Add Rule Button");
  await userEvent.click(addRuleBtn);

  expect(JSON.parse(screen.getByTestId("style").textContent)).toStrictEqual({
    rules: [
      {
        conditionField: "",
        conditionType: "=",
        conditionValue: "",
        geometryType: "point",
      },
    ],
    default: {},
  });
});

test("StylePane handleStyleJSONUpload sets style and rules", async () => {
  render(<TestingComponent sourceProps={{ type: "GeoJSON" }} />);
  // Switch to rules mode
  const jsonRadio = await screen.findByLabelText("JSON Editor");
  await userEvent.click(jsonRadio);
  // Upload a file with rules
  const file = new File(
    [JSON.stringify({ rules: [{ foo: "bar" }], default: { color: "red" } })],
    "test-file.json",
    { type: "text/plain" },
  );
  const fileInput = screen.getByTestId("file-input");
  fireEvent.change(fileInput, { target: { files: [file] } });

  await waitFor(() => {
    expect(JSON.parse(screen.getByTestId("style").textContent)).toStrictEqual({
      rules: [
        {
          foo: "bar",
        },
      ],
      default: { color: "red" },
    });
  });
});

test("StylePane handleStyleJSONChange sets style and rules", async () => {
  render(<TestingComponent sourceProps={{ type: "GeoJSON" }} />);
  // Switch to rules mode
  const rulesRadio = await screen.findByLabelText("Rule-based Editor");
  await userEvent.click(rulesRadio);
  // Change textarea to valid rules JSON
  const textArea = screen.getByLabelText("JSON Editor");
  fireEvent.change(textArea, {
    target: { value: JSON.stringify({ rules: [{ foo: "baz" }] }) },
  });
  expect(JSON.parse(textArea.value).rules[0].foo).toBe("baz");
});

test("StylePane handleStyleSourceChange resets style for custom and url", async () => {
  render(<TestingComponent sourceProps={{ type: "GeoJSON" }} />);
  // Switch to URL
  const urlRadio = await screen.findByLabelText("URL");
  await userEvent.click(urlRadio);
  expect(screen.getByTestId("style").textContent).toBe("");
  // Switch back to Custom
  const customRadio = await screen.findByLabelText("Custom");
  await userEvent.click(customRadio);
  expect(screen.getByTestId("style").textContent).toBe("{}");
});

TestingComponent.propTypes = {
  initialStyle: PropTypes.string,
  setErrorMessage: PropTypes.func,
  sourceProps: PropTypes.object,
  setSourceProps: PropTypes.func,
};

GeoTIFFTestHarness.propTypes = {
  initialSourceProps: PropTypes.object,
  sourcePropsSpy: PropTypes.func,
  dynamicMapLayers: PropTypes.array,
};

test("StylePane renders Color Ramp section for GeoTIFF source type", async () => {
  render(<GeoTIFFTestHarness initialSourceProps={{ type: "GeoTIFF" }} />);

  expect(await screen.findByText("Color Ramp")).toBeInTheDocument();
  // All four ramp options render.
  expect(
    screen.getByRole("radio", { name: "Select viridis ramp" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("radio", { name: "Select turbo ramp" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("radio", { name: "Select RdYlBu ramp" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("radio", { name: "Select grayscale ramp" }),
  ).toBeInTheDocument();
  // Min and Max inputs render.
  expect(screen.getByLabelText("Ramp Min")).toBeInTheDocument();
  expect(screen.getByLabelText("Ramp Max")).toBeInTheDocument();
});

test("StylePane defaults a GeoTIFF source's ramp to turbo when none is set", async () => {
  render(<GeoTIFFTestHarness initialSourceProps={{ type: "GeoTIFF" }} />);
  await waitFor(() => {
    expect(screen.getByTestId("rampName")).toHaveTextContent("turbo");
  });
});

test("StylePane renders the Color Ramp section and defaults to turbo for a Zarr source", async () => {
  render(<GeoTIFFTestHarness initialSourceProps={{ type: "Zarr" }} />);
  expect(await screen.findByText("Color Ramp")).toBeInTheDocument();
  await waitFor(() => {
    expect(screen.getByTestId("rampName")).toHaveTextContent("turbo");
  });
});

test("StylePane leaves GeoTIFF ramp min/max empty so the ramp fits each file", async () => {
  // The ramp range is resolved at render time from the file's statistics (see
  // applyAutoRamp), which lets it refit when a variable input swaps the URL.
  // StylePane must not pre-fill the fields, since a filled range reads as the
  // author pinning the scale and would freeze the ramp on the first file.
  fromUrl.mockReset();

  render(
    <GeoTIFFTestHarness
      initialSourceProps={{
        type: "GeoTIFF",
        rampName: "turbo",
        props: { sources: [{ url: "http://example.com/cog.tif" }] },
      }}
    />,
  );

  await screen.findByText("Color Ramp");
  expect(screen.getByTestId("rampMin")).toHaveTextContent("");
  expect(screen.getByTestId("rampMax")).toHaveTextContent("");
  expect(fromUrl).not.toHaveBeenCalled();
});

test("StylePane keeps an author-entered GeoTIFF range untouched", async () => {
  fromUrl.mockReset();

  render(
    <GeoTIFFTestHarness
      initialSourceProps={{
        type: "GeoTIFF",
        rampName: "turbo",
        rampMin: "0",
        rampMax: "50",
        props: { sources: [{ url: "http://example.com/cog.tif" }] },
      }}
    />,
  );

  await screen.findByText("Color Ramp");
  expect(screen.getByTestId("rampMin")).toHaveTextContent("0");
  expect(screen.getByTestId("rampMax")).toHaveTextContent("50");
  expect(fromUrl).not.toHaveBeenCalled();
});

test("StylePane does NOT render Color Ramp section for non-GeoTIFF sources", async () => {
  render(<TestingComponent sourceProps={{ type: "GeoJSON" }} />);
  // Vector editor renders instead.
  expect(await screen.findByText("Upload style file")).toBeInTheDocument();
  expect(screen.queryByText("Color Ramp")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("radio", { name: "Select viridis ramp" }),
  ).not.toBeInTheDocument();
});

test("StylePane Color Ramp section hidden for WMS source type", async () => {
  render(<TestingComponent sourceProps={{ type: "WMS" }} />);
  // WMS shows the "not available" message and NOT the ramp picker.
  expect(
    await screen.findByText(/Custom Styling is only available/),
  ).toBeInTheDocument();
  expect(screen.queryByText("Color Ramp")).not.toBeInTheDocument();
});

test("StylePane selecting a ramp updates sourceProps.rampName", async () => {
  render(<GeoTIFFTestHarness initialSourceProps={{ type: "GeoTIFF" }} />);

  const viridisOption = await screen.findByRole("radio", {
    name: "Select viridis ramp",
  });
  await userEvent.click(viridisOption);

  expect(screen.getByTestId("rampName")).toHaveTextContent("viridis");
});

test("StylePane typing min/max updates sourceProps.rampMin / rampMax as strings", async () => {
  render(<GeoTIFFTestHarness initialSourceProps={{ type: "GeoTIFF" }} />);

  const minInput = screen.getByLabelText("Ramp Min");
  const maxInput = screen.getByLabelText("Ramp Max");

  fireEvent.change(minInput, { target: { value: "0" } });
  fireEvent.change(maxInput, { target: { value: "100" } });

  await waitFor(() => {
    expect(screen.getByTestId("rampMin")).toHaveTextContent("0");
  });
  expect(screen.getByTestId("rampMax")).toHaveTextContent("100");
});

test("StylePane pre-populates ramp selection and min/max from sourceProps", async () => {
  render(
    <GeoTIFFTestHarness
      initialSourceProps={{
        type: "GeoTIFF",
        rampName: "viridis",
        rampMin: "0",
        rampMax: "100",
      }}
    />,
  );

  const viridisOption = await screen.findByRole("radio", {
    name: "Select viridis ramp",
  });
  expect(viridisOption).toHaveAttribute("aria-checked", "true");

  expect(screen.getByLabelText("Ramp Min")).toHaveValue("0");
  expect(screen.getByLabelText("Ramp Max")).toHaveValue("100");
});

test("StylePane json/rules editor still works for non-GeoTIFF layers (regression)", async () => {
  render(<TestingComponent sourceProps={{ type: "GeoJSON" }} />);
  // Regression: mode selector works unchanged for GeoJSON.
  const rulesRadio = await screen.findByLabelText("Rule-based Editor");
  await userEvent.click(rulesRadio);
  const addRuleBtn = await screen.findByLabelText("Add Rule Button");
  expect(addRuleBtn).toBeInTheDocument();
});

test("StylePane calls getStyleFields for URL-based GeoJSON (no early bail-out)", async () => {
  const getStyleFieldsSpy = jest
    .spyOn(utilities, "getStyleFields")
    .mockResolvedValue(["station_id", "flow"]);

  render(
    <AppContext.Provider value={{ dynamicMapLayers: [] }}>
      <LayoutContext.Provider value={{ uuid: "123" }}>
        <StylePane
          style={{}}
          setStyle={() => {}}
          setErrorMessage={() => {}}
          sourceProps={{
            type: "GeoJSON",
            geojson: "https://example.com/data.geojson",
          }}
          setSourceProps={() => {}}
          layerProps={{}}
        />
      </LayoutContext.Provider>
    </AppContext.Provider>,
  );

  await waitFor(() => {
    expect(getStyleFieldsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceProps: expect.objectContaining({
          geojson: "https://example.com/data.geojson",
        }),
      }),
    );
  });

  getStyleFieldsSpy.mockRestore();
});

test("StylePane round-trips conditionCombinator and 'in' operator rules", async () => {
  const combinatorStyle = {
    rules: [
      {
        geometryType: "point",
        conditionCombinator: "OR",
        conditionField: "BuildCat",
        conditionType: "in",
        conditionValue: "0, 36, 42",
        conditions: [{ field: "risk", type: "=", value: "high" }],
        fill: "#ff0000",
      },
    ],
    default: {},
  };

  render(<TestingComponent sourceProps={{ type: "GeoJSON" }} />);
  const textArea = screen.getByLabelText("style-text-area");
  fireEvent.change(textArea, {
    target: { value: JSON.stringify(combinatorStyle) },
  });

  // Switch to rules mode; the rule (including the new fields) must survive
  // the parse -> state -> re-serialize round-trip unchanged.
  const rulesRadio = await screen.findByLabelText("Rule-based Editor");
  await userEvent.click(rulesRadio);

  await waitFor(() => {
    expect(JSON.parse(screen.getByTestId("style").textContent)).toStrictEqual(
      combinatorStyle,
    );
  });
});

describe("StylePane categorical raster styling", () => {
  const renderPane = (sourceProps, spy) =>
    render(
      <GeoTIFFTestHarness
        initialSourceProps={{
          type: "GeoTIFF",
          rampName: "turbo",
          props: { url: "lu.tif" },
          ...sourceProps,
        }}
        sourcePropsSpy={spy}
      />,
    );

  test("Categorical mode swaps the range inputs for a class table", async () => {
    renderPane({ styleMode: "categorical", classes: [] });

    // Heading follows the mode; "Color Ramp" would misdescribe a class table.
    expect(await screen.findByText("Classes")).toBeInTheDocument();
    expect(screen.queryByText("Color Ramp")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add class" }),
    ).toBeInTheDocument();
    // The continuous controls are gone: range inputs and the ramp picker.
    expect(screen.queryByLabelText("Ramp Min")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Ramp Max")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("radiogroup", { name: "Color ramp picker" }),
    ).not.toBeInTheDocument();
  });

  test("Continuous mode keeps the range inputs and hides the class table", async () => {
    renderPane({});

    expect(await screen.findByLabelText("Ramp Min")).toBeInTheDocument();
    expect(
      screen.getByRole("radiogroup", { name: "Color ramp picker" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add class" }),
    ).not.toBeInTheDocument();
  });

  test("switching to Categorical records the mode", async () => {
    let last;
    renderPane({}, (next) => {
      last = next;
    });

    const modeGroup = await screen.findByRole("radiogroup", {
      name: "Raster Style Mode",
    });
    // Scoped: the ramp picker is a radiogroup too.
    fireEvent.click(within(modeGroup).getAllByRole("radio")[1]);

    await waitFor(() => expect(last?.styleMode).toBe("categorical"));
  });

  test("Add class appends a row seeded with a ramp color", async () => {
    let last;
    renderPane({ styleMode: "categorical", classes: [] }, (next) => {
      last = next;
    });

    fireEvent.click(await screen.findByRole("button", { name: "Add class" }));

    await waitFor(() => expect(last?.classes).toHaveLength(1));
    // Seeded so a usable style exists without picking colors by hand.
    expect(last.classes[0].color).toMatch(/^#/);
    expect(last.classes[0].value).toBe("");
  });

  test("editing a class value and label writes them back", async () => {
    let last;
    renderPane(
      {
        styleMode: "categorical",
        classes: [{ value: "", color: "#aaa", label: "" }],
      },
      (next) => {
        last = next;
      },
    );

    fireEvent.change(await screen.findByLabelText("Class 1 Value"), {
      target: { value: "2" },
    });
    await waitFor(() => expect(last?.classes[0].value).toBe("2"));

    fireEvent.change(screen.getByLabelText("Class 1 Label"), {
      target: { value: "Urban" },
    });
    await waitFor(() => expect(last?.classes[0].label).toBe("Urban"));
  });

  test("class swatches carry no visible label but stay named for a11y", async () => {
    // The table already has a Color column header, so "Class 1:" beside each
    // swatch was redundant. The accessible name must survive.
    renderPane({
      styleMode: "categorical",
      classes: [{ value: "0", color: "#aaa" }],
    });

    expect(
      await screen.findByLabelText("Class 1 color popover square"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Class 1")).not.toBeInTheDocument();
  });

  test("the Other values swatch keeps its visible label", async () => {
    renderPane({
      styleMode: "categorical",
      classes: [{ value: "0", color: "#aaa" }],
    });

    expect(await screen.findByText("Other values")).toBeInTheDocument();
  });

  test("removing a class drops just that row", async () => {
    let last;
    renderPane(
      {
        styleMode: "categorical",
        classes: [
          { value: "0", color: "#aaa" },
          { value: "1", color: "#bbb" },
        ],
      },
      (next) => {
        last = next;
      },
    );

    fireEvent.click(await screen.findByLabelText("Remove class 1"));

    await waitFor(() => expect(last?.classes).toHaveLength(1));
    expect(last.classes[0].value).toBe("1");
  });
});

describe("StylePane ranges raster styling", () => {
  const renderPane = (sourceProps, spy) =>
    render(
      <GeoTIFFTestHarness
        initialSourceProps={{
          type: "GeoTIFF",
          rampName: "turbo",
          props: { url: "flow.tif" },
          ...sourceProps,
        }}
        sourcePropsSpy={spy}
      />,
    );
  const classRows = [
    { value: "1", color: "#aaa", label: "0.1 to 1" },
    { value: "2", color: "#bbb", label: "1 to 2" },
  ];
  const modeRadio = async (name) =>
    within(
      await screen.findByRole("radiogroup", { name: "Raster Style Mode" }),
    ).getByRole("radio", { name });

  test("offers Ranges beside Continuous and Categorical", async () => {
    renderPane({});

    const group = await screen.findByRole("radiogroup", {
      name: "Raster Style Mode",
    });
    const radios = within(group).getAllByRole("radio");
    expect(radios).toEqual([
      within(group).getByRole("radio", { name: "Continuous" }),
      within(group).getByRole("radio", { name: "Categorical" }),
      within(group).getByRole("radio", { name: "Ranges" }),
    ]);
    expect(await modeRadio("Continuous")).toBeChecked();
  });

  test("Ranges mode shows the class table headed Up to, with its helper line", async () => {
    renderPane({ styleMode: "ranges", classes: classRows });

    expect(await screen.findByText("Classes")).toBeInTheDocument();
    expect(await modeRadio("Ranges")).toBeChecked();
    expect(await modeRadio("Categorical")).not.toBeChecked();
    expect(
      screen.getByRole("columnheader", { name: "Up to" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "Value" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Each class covers values above the previous class's bound, up to and including its own.",
      ),
    ).toBeInTheDocument();
    // The continuous controls are gone, as in Categorical.
    expect(screen.queryByLabelText("Ramp Min")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("radiogroup", { name: "Color ramp picker" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Other values")).toBeInTheDocument();
  });

  test("Categorical mode heads the value column Value, with no helper line", async () => {
    renderPane({ styleMode: "categorical", classes: classRows });

    expect(
      await screen.findByRole("columnheader", { name: "Value" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "Up to" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/covers values above the previous class/),
    ).not.toBeInTheDocument();
  });

  test("switching between Categorical and Ranges keeps the class rows", async () => {
    let last;
    renderPane({ styleMode: "categorical", classes: classRows }, (next) => {
      last = next;
    });

    fireEvent.click(await modeRadio("Ranges"));
    await waitFor(() => expect(last?.styleMode).toBe("ranges"));
    expect(last.classes).toEqual(classRows);
    expect(
      await screen.findByRole("columnheader", { name: "Up to" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Class 2 Label")).toHaveValue("1 to 2");

    fireEvent.click(await modeRadio("Categorical"));
    await waitFor(() => expect(last?.styleMode).toBe("categorical"));
    expect(last.classes).toEqual(classRows);
    expect(screen.getByLabelText("Class 1 Value")).toHaveValue("1");
  });

  test("switching to Continuous from Ranges brings the ramp back", async () => {
    let last;
    renderPane({ styleMode: "ranges", classes: classRows }, (next) => {
      last = next;
    });

    fireEvent.click(await modeRadio("Continuous"));

    await waitFor(() => expect(last?.styleMode).toBe("continuous"));
    expect(await screen.findByLabelText("Ramp Min")).toBeInTheDocument();
    // Kept, so returning to a class mode does not lose the table.
    expect(last.classes).toEqual(classRows);
  });
});

describe("StylePane categorical editing edges", () => {
  // Deliberately without setRasterStyle: these cover the read-only rendering,
  // where every writer has to no-op rather than throw.
  const renderBare = (flat) => {
    const { sourceProps, rasterStyle } = splitLayer({
      rampName: "turbo",
      ...flat,
    });
    return render(
      <AppContext.Provider value={{ dynamicMapLayers: [] }}>
        <LayoutContext.Provider value={{ uuid: "123" }}>
          <StylePane
            style={undefined}
            setStyle={() => {}}
            setErrorMessage={() => {}}
            sourceProps={{
              type: "GeoTIFF",
              props: { url: "lu.tif" },
              ...sourceProps,
            }}
            rasterStyle={rasterStyle}
          />
        </LayoutContext.Provider>
      </AppContext.Provider>,
    );
  };

  test("class editing is inert without a way to save it", async () => {
    // The pane is rendered read-only in places; every writer has to no-op
    // rather than throw on a missing setter.
    renderBare({
      styleMode: "categorical",
      classes: [{ value: "1", color: "#aaa" }],
    });

    await userEvent.click(screen.getByRole("button", { name: "Add class" }));
    await userEvent.click(screen.getByRole("radio", { name: /continuous/i }));
    expect(screen.getByText("Classes")).toBeInTheDocument();
  });

  test("a class row with no value renders an empty input", async () => {
    renderBare({ styleMode: "categorical", classes: [{ color: "#aaa" }] });

    expect(await screen.findByLabelText("Class 1 Value")).toHaveValue("");
  });

  test("a new class falls back to grey when the ramp resolves to nothing", async () => {
    const spy = jest.fn();
    render(
      <GeoTIFFTestHarness
        initialSourceProps={{
          type: "GeoTIFF",
          rampName: "not-a-real-ramp",
          styleMode: "categorical",
          classes: [],
          props: { url: "lu.tif" },
        }}
        sourcePropsSpy={spy}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Add class" }));

    await waitFor(() => {
      const last = spy.mock.calls.at(-1)?.[0];
      expect(last.classes[0].color).toBe("#888888");
    });
  });
});

test("StylePane takes a shapefile's fields from the Source tab's read", async () => {
  // Opening the Style tab must not start a multi-megabyte download of its own.
  render(
    <AppContext.Provider value={{ dynamicMapLayers: [] }}>
      <LayoutContext.Provider value={{ uuid: "123" }}>
        <StylePane
          style={undefined}
          setStyle={() => {}}
          setErrorMessage={() => {}}
          sourceProps={{
            type: "Shapefile",
            props: { url: "https://example.org/basins.shp" },
          }}
          setSourceProps={() => {}}
          shapefileDiscovery={{
            isShapefile: true,
            state: "ready",
            fields: ["BASIN_ID"],
          }}
        />
      </LayoutContext.Provider>
    </AppContext.Provider>,
  );

  // The pane offers the editor rather than the dead-end panel, and takes its
  // fields from that read instead of fetching anything itself.
  expect(await screen.findByText("Style Source")).toBeInTheDocument();
  expect(
    screen.queryByText(/Custom Styling is only available/),
  ).not.toBeInTheDocument();
});

describe("StylePane categorical colors", () => {
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

  const openSwatch = async (name) => {
    fireEvent.click(
      await screen.findByLabelText(`${name} color popover square`),
    );
    return screen.findByRole("textbox", { name: "HEX" });
  };

  test("picking a class color updates just that class", async () => {
    let last;
    render(
      <GeoTIFFTestHarness
        initialSourceProps={{
          type: "GeoTIFF",
          rampName: "turbo",
          styleMode: "categorical",
          classes: [
            { value: "0", color: "#aaaaaa" },
            { value: "1", color: "#bbbbbb" },
          ],
          props: { url: "lu.tif" },
        }}
        sourcePropsSpy={(next) => {
          last = next;
        }}
      />,
    );

    const hex = await openSwatch("Class 2");
    fireEvent.change(hex, { target: { value: "#00ff00" } });

    await waitFor(() =>
      expect(last?.classes[1].color.toLowerCase()).toBe("#00ff00"),
    );
    expect(last?.classes[0].color).toBe("#aaaaaa");
  });

  test("picking the fallback color leaves the classes alone", async () => {
    let last;
    render(
      <GeoTIFFTestHarness
        initialSourceProps={{
          type: "GeoTIFF",
          rampName: "turbo",
          styleMode: "categorical",
          classes: [{ value: "0", color: "#aaaaaa" }],
          props: { url: "lu.tif" },
        }}
        sourcePropsSpy={(next) => {
          last = next;
        }}
      />,
    );

    const hex = await openSwatch("Other values");
    fireEvent.change(hex, { target: { value: "#123456" } });

    await waitFor(() =>
      expect(last?.fallbackColor.toLowerCase()).toBe("#123456"),
    );
    expect(last?.classes[0].color).toBe("#aaaaaa");
  });
});

test("StylePane offers no fields when the field read fails", async () => {
  // A failed read must leave the rule editor usable with an empty field list
  // rather than taking the tab down.
  const { getStyleFields } = require("components/map/utilities");
  const spy = jest
    .spyOn(require("components/map/utilities"), "getStyleFields")
    .mockRejectedValue(new Error("could not read fields"));

  try {
    render(
      <AppContext.Provider value={{ dynamicMapLayers: [] }}>
        <LayoutContext.Provider value={{ uuid: "123" }}>
          <StylePane
            style={undefined}
            setStyle={() => {}}
            setErrorMessage={() => {}}
            sourceProps={{
              type: "GeoJSON",
              geojson: JSON.stringify({
                type: "FeatureCollection",
                features: [],
              }),
            }}
            setSourceProps={() => {}}
          />
        </LayoutContext.Provider>
      </AppContext.Provider>,
    );

    expect(await screen.findByText("Style Source")).toBeInTheDocument();
    await waitFor(() => expect(spy).toHaveBeenCalled());
  } finally {
    spy.mockRestore();
  }
  expect(typeof getStyleFields).toBe("function");
});

describe("StylePane dynamic GeoTIFF layers", () => {
  const rasterPlugin = {
    source: "echo_runtime_raster",
    value: "Echo Runtime Raster",
    label: "Echo Runtime Raster",
    args: { mode: "text" },
    type: "map_layer",
    dynamic_map_layer: true,
    dynamic_map_layer_source: "GeoTIFF",
  };
  const geojsonPlugin = {
    source: "custom_layer_test",
    value: "Stream Gauges (Dynamic)",
    label: "Stream Gauges (Dynamic)",
    args: {},
    type: "map_layer",
    dynamic_map_layer: true,
    dynamic_map_layer_source: "GeoJSON",
  };
  const dynamicMapLayers = [
    { label: "Dynamic Map Layers", options: [rasterPlugin, geojsonPlugin] },
  ];
  const rasterSourceProps = (extra = {}) => ({
    type: "Echo Runtime Raster",
    source: "echo_runtime_raster",
    args: { mode: "happy" },
    props: {},
    rampName: "viridis",
    ...extra,
  });
  test("shows the ramp section, and no follow toggle, for a plugin that declares GeoTIFF", async () => {
    render(
      <GeoTIFFTestHarness
        initialSourceProps={rasterSourceProps()}
        dynamicMapLayers={dynamicMapLayers}
      />,
    );

    expect(await screen.findByText("Color Ramp")).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: "Select viridis ramp" }),
    ).toHaveAttribute("aria-checked", "true");
    // The mask is a source property, edited on the Source pane, so it is not
    // here -- see the dynamic-layer mask field in SourcePane.test.js.
    expect(screen.queryByLabelText("Mask Below")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Leave Min/Max empty to fit the range to each file the plugin returns.",
      ),
    ).toBeInTheDocument();

    // No follow toggle: a dynamic raster's style is the author's like any
    // other layer's, and a fetch never displaces it.
    expect(
      screen.queryByRole("switch", { name: /follow plugin styling/i }),
    ).not.toBeInTheDocument();
  });

  test.each([
    [
      "selecting a ramp",
      () =>
        userEvent.click(
          screen.getByRole("radio", { name: "Select magma ramp" }),
        ),
      () => screen.getByTestId("rampName").textContent === "magma",
    ],
    [
      "reversing the ramp",
      () => userEvent.click(screen.getByLabelText("Reverse Color Ramp")),
      () => screen.getByTestId("rampReverse").textContent === "true",
    ],
    [
      "typing a min",
      () =>
        fireEvent.change(screen.getByLabelText("Ramp Min"), {
          target: { value: "1" },
        }),
      () => screen.getByTestId("rampMin").textContent === "1",
    ],
    [
      "typing a max",
      () =>
        fireEvent.change(screen.getByLabelText("Ramp Max"), {
          target: { value: "9" },
        }),
      () => screen.getByTestId("rampMax").textContent === "9",
    ],
    [
      "switching to categorical",
      () => userEvent.click(screen.getByRole("radio", { name: /Categorical/ })),
      () => screen.getByRole("columnheader", { name: "Value" }),
    ],
    [
      "switching to ranges",
      () => userEvent.click(screen.getByRole("radio", { name: /Ranges/ })),
      () => screen.getByRole("columnheader", { name: "Up to" }),
    ],
  ])(
    "%s writes to the style, and nowhere else",
    async (_label, edit, landed) => {
      // Every control on this pane edits the layer's saved style. None of them
      // touches the source props any more -- there is no pin to set, because a
      // fetch never competes with what is here.
      render(
        <GeoTIFFTestHarness
          initialSourceProps={rasterSourceProps()}
          dynamicMapLayers={dynamicMapLayers}
        />,
      );
      await screen.findByText("Color Ramp");

      await edit();

      await waitFor(() => expect(landed()).toBeTruthy());
      expect(screen.getByTestId("stylePinned")).toHaveTextContent("undefined");
    },
  );

  test("defaults a dynamic GeoTIFF without a ramp to turbo", async () => {
    render(
      <GeoTIFFTestHarness
        initialSourceProps={rasterSourceProps({ rampName: undefined })}
        dynamicMapLayers={dynamicMapLayers}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId("rampName")).toHaveTextContent("turbo");
    });
  });

  test("a static GeoTIFF layer styles the same way, with no toggle", async () => {
    render(
      <GeoTIFFTestHarness
        initialSourceProps={{ type: "GeoTIFF", rampName: "viridis" }}
        dynamicMapLayers={dynamicMapLayers}
      />,
    );
    await screen.findByText("Color Ramp");
    expect(
      screen.queryByRole("switch", { name: /follow plugin styling/i }),
    ).not.toBeInTheDocument();
    // A static layer sets its mask in the Source tab.
    expect(screen.queryByLabelText("Mask Below")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Ramp Min"), {
      target: { value: "1" },
    });
    await waitFor(() => {
      expect(screen.getByTestId("rampMin")).toHaveTextContent("1");
    });
  });

  test("a GeoJSON dynamic layer keeps the vector style editor and has no toggle", async () => {
    render(
      <GeoTIFFTestHarness
        initialSourceProps={{
          type: "Stream Gauges (Dynamic)",
          source: "custom_layer_test",
          args: {},
          props: {},
        }}
        dynamicMapLayers={dynamicMapLayers}
      />,
    );
    expect(await screen.findByText("Upload style file")).toBeInTheDocument();
    expect(screen.queryByText("Color Ramp")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("switch", { name: /follow plugin styling/i }),
    ).not.toBeInTheDocument();
  });

  test("a dynamic plugin that declares no source type is treated as GeoJSON", async () => {
    const { dynamic_map_layer_source: _omit, ...undeclared } = rasterPlugin;
    render(
      <GeoTIFFTestHarness
        initialSourceProps={rasterSourceProps()}
        dynamicMapLayers={[{ label: "Dynamic", options: [undeclared] }]}
      />,
    );
    expect(await screen.findByText("Upload style file")).toBeInTheDocument();
    expect(screen.queryByText("Color Ramp")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("switch", { name: /follow plugin styling/i }),
    ).not.toBeInTheDocument();
  });
});

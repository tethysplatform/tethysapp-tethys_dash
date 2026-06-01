import { useState } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import StylePane from "components/modals/MapLayer/StylePane";
import appAPI from "services/api/app";
import PropTypes from "prop-types";
import userEvent from "@testing-library/user-event";
import { LayoutContext, AppContext } from "components/contexts/Contexts";
import * as utilities from "components/map/utilities";

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

const GeoTIFFTestHarness = ({ initialSourceProps }) => {
  const [sourceProps, setSourceProps] = useState(initialSourceProps);

  return (
    <AppContext.Provider value={{ dynamicMapLayers: [] }}>
      <LayoutContext.Provider value={{ uuid: "123" }}>
        <StylePane
          style={undefined}
          setStyle={() => {}}
          setErrorMessage={() => {}}
          sourceProps={sourceProps}
          setSourceProps={setSourceProps}
        />
        <p data-testid="rampName">{sourceProps.rampName ?? ""}</p>
        <p data-testid="rampMin">{sourceProps.rampMin ?? ""}</p>
        <p data-testid="rampMax">{sourceProps.rampMax ?? ""}</p>
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
  const supportedTypes = ["GeoJSON", "ESRI Feature Service", "PMTiles Vector"];
  expect(
    await screen.findByText(
      `Custom Styling is only available for ${supportedTypes.join(", ")} layers.`,
    ),
  ).toBeInTheDocument();
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
          style={"{}"}
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

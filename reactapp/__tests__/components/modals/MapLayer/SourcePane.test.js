import { useState } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SourcePane, {
  generatePropertiesArrayWithValues,
} from "components/modals/MapLayer/SourcePane";
import selectEvent from "react-select-event";
import appAPI from "services/api/app";
import PropTypes from "prop-types";
import userEvent from "@testing-library/user-event";
import {
  AppContext,
  LayoutContext,
  VariableInputsContext,
  DataViewerModeContext,
} from "components/contexts/Contexts";
import MapContextProvider from "components/contexts/MapContext";
import { sourcePropertiesOptions } from "components/map/utilities";

const exampleGeoJSON = {
  type: "FeatureCollection",
  crs: {
    type: "name",
    properties: {
      name: "EPSG:3857",
    },
  },
  features: [
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [0, 0],
      },
    },
  ],
};

const TestingComponent = ({
  initialSourceProps,
  setErrorMessage,
  onRequestHideModal,
  sourcePropsSpy,
  dynamicMapLayers = [],
  onFetchPluginDefaults,
}) => {
  const [sourceProps, setSourceProps] = useState(initialSourceProps ?? {});
  const [attributeProps, setAttributeProps] = useState({
    variables: {
      someLayer: { someField: "someVariable" },
    },
    omitted: {
      someLayer: ["someField"],
    },
  });

  // Spy wrapper so tests can observe setSourceProps calls without losing
  // the underlying state updates.
  const spyingSetSourceProps = (updater) => {
    setSourceProps((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (typeof sourcePropsSpy === "function") {
        sourcePropsSpy(next);
      }
      return next;
    });
  };

  return (
    <AppContext.Provider value={{ dynamicMapLayers: dynamicMapLayers }}>
      <MapContextProvider>
        <LayoutContext.Provider value={{ uuid: "123" }}>
          <SourcePane
            sourceProps={sourceProps}
            setSourceProps={spyingSetSourceProps}
            setAttributeProps={setAttributeProps}
            setErrorMessage={setErrorMessage}
            onRequestHideModal={onRequestHideModal}
            onFetchPluginDefaults={onFetchPluginDefaults}
          />
          <p data-testid="sourceProps">{JSON.stringify(sourceProps)}</p>
          <p data-testid="attributeVariables">
            {JSON.stringify(attributeProps.variables)}
          </p>
          <p data-testid="omittedPopupAttributes">
            {JSON.stringify(attributeProps.omitted)}
          </p>
        </LayoutContext.Provider>
      </MapContextProvider>
    </AppContext.Provider>
  );
};

test("SourcePane ImageArcGISRest", async () => {
  render(<TestingComponent />);

  expect(await screen.findByText("Source Type")).toBeInTheDocument();
  expect(await screen.findByTestId("sourceProps")).toHaveTextContent(
    JSON.stringify({}),
  );
  expect(await screen.findByTestId("attributeVariables")).toHaveTextContent(
    JSON.stringify({
      someLayer: { someField: "someVariable" },
    }),
  );
  expect(await screen.findByTestId("omittedPopupAttributes")).toHaveTextContent(
    JSON.stringify({
      someLayer: ["someField"],
    }),
  );
  const sourceDropdown = screen.getByRole("combobox");

  selectEvent.openMenu(sourceDropdown);
  const sourceOption = await screen.findByText("ESRI Image and Map Service");
  fireEvent.click(sourceOption);
  expect(await screen.findByText("Source Properties")).toBeInTheDocument();
  expect(await screen.findByTestId("sourceProps")).toHaveTextContent(
    JSON.stringify({ type: "ESRI Image and Map Service", props: {} }),
  );

  expect(screen.getByText("*url")).toBeInTheDocument();
  expect(screen.getByText("attributions")).toBeInTheDocument();
  expect(screen.getByText("params - LAYERS")).toBeInTheDocument();
  expect(screen.getByText("params - TIME")).toBeInTheDocument();
  expect(screen.getByText("params - LAYERDEFS")).toBeInTheDocument();
  expect(screen.getByText("params - mosaicRule")).toBeInTheDocument();
  expect(screen.getByText("projection")).toBeInTheDocument();

  const inputs = screen.getAllByRole("textbox");
  expect(inputs.length).toBe(7);

  const urlInput = inputs[0];
  expect(urlInput.placeholder).toBe("ArcGIS Rest service URL");
  fireEvent.change(urlInput, { target: { value: "Some Url" } });
  expect(await screen.findByTestId("sourceProps")).toHaveTextContent(
    JSON.stringify({
      type: "ESRI Image and Map Service",
      props: { url: "Some Url" },
    }),
  );

  const layerdefsInput = inputs[4];
  expect(layerdefsInput.placeholder).toBe(
    "Allows you to filter the features of individual layers",
  );
  fireEvent.change(layerdefsInput, {
    target: { value: "Some layerDef" },
  });
  expect(await screen.findByTestId("sourceProps")).toHaveTextContent(
    JSON.stringify({
      type: "ESRI Image and Map Service",
      props: { url: "Some Url", params: { LAYERDEFS: "Some layerDef" } },
    }),
  );

  selectEvent.openMenu(sourceDropdown);
  const newSourceOption = await screen.findByText("WMS");
  fireEvent.click(newSourceOption);
  expect(await screen.findByTestId("sourceProps")).toHaveTextContent(
    JSON.stringify({
      type: "WMS",
      props: { url: "Some Url" },
    }),
  );
});

test("SourcePane GeoJson then switch type", async () => {
  render(<TestingComponent />);

  expect(await screen.findByText("Source Type")).toBeInTheDocument();
  expect(await screen.findByTestId("sourceProps")).toHaveTextContent(
    JSON.stringify({}),
  );
  const sourceDropdown = screen.getByRole("combobox");

  selectEvent.openMenu(sourceDropdown);
  let sourceOption = await screen.findByText("GeoJSON");
  fireEvent.click(sourceOption);

  expect(await screen.findByText("Upload GeoJSON file")).toBeInTheDocument();

  const textArea = screen.getByLabelText("geojson-source-text-area");
  fireEvent.change(textArea, {
    target: { value: JSON.stringify(exampleGeoJSON) },
  });
  expect(await screen.findByTestId("sourceProps")).toHaveTextContent(
    JSON.stringify({
      type: "GeoJSON",
      props: {},
      geojson: JSON.stringify(exampleGeoJSON),
    }),
  );

  selectEvent.openMenu(sourceDropdown);
  sourceOption = await screen.findByText("ESRI Feature Service");
  fireEvent.click(sourceOption);

  expect(await screen.findByTestId("sourceProps")).toHaveTextContent(
    JSON.stringify({
      type: "ESRI Feature Service",
      props: {},
    }),
  );
});

test("SourcePane GeoJson URL", async () => {
  global.fetch = jest.fn().mockResolvedValueOnce({
    ok: true,
  });
  const mockSetErrorMessage = jest.fn();

  render(<TestingComponent setErrorMessage={mockSetErrorMessage} />);

  expect(await screen.findByText("Source Type")).toBeInTheDocument();
  expect(await screen.findByTestId("sourceProps")).toHaveTextContent(
    JSON.stringify({}),
  );
  const sourceDropdown = screen.getByRole("combobox");

  selectEvent.openMenu(sourceDropdown);
  const sourceOption = await screen.findByText("GeoJSON");
  fireEvent.click(sourceOption);

  expect(await screen.findByText("GeoJSON Source")).toBeInTheDocument();
  const UrlRadio = await screen.findByLabelText("URL");
  await userEvent.click(UrlRadio);
  expect(UrlRadio).toBeInTheDocument();

  const UrlInput = await screen.findByLabelText("URL Input");
  fireEvent.change(UrlInput, {
    target: { value: "some/url/file.json" },
  });
  expect(await screen.findByTestId("sourceProps")).toHaveTextContent(
    JSON.stringify({
      type: "GeoJSON",
      props: {},
      geojson: "some/url/file.json",
    }),
  );
  await waitFor(() => {
    expect(mockSetErrorMessage).toHaveBeenCalledTimes(0);
  });

  const CustomRadio = await screen.findByLabelText("Custom");
  await userEvent.click(CustomRadio);
  expect(await screen.findByTestId("sourceProps")).toHaveTextContent(
    JSON.stringify({
      type: "GeoJSON",
      props: {},
      geojson: "{}",
    }),
  );
});

test("SourcePane GeoJson bad stored filename surfaces error", async () => {
  // SourcePane only fetches when geojson is a stored-filename (no slash).
  // URL-shaped strings are pass-through — no fetch, no error to surface.
  // This test exercises the filename branch via appAPI.downloadJSON
  // returning success: false.
  jest.spyOn(appAPI, "downloadJSON").mockResolvedValueOnce({ success: false });
  const mockSetErrorMessage = jest.fn();

  render(<TestingComponent setErrorMessage={mockSetErrorMessage} />);

  expect(await screen.findByText("Source Type")).toBeInTheDocument();
  expect(await screen.findByTestId("sourceProps")).toHaveTextContent(
    JSON.stringify({}),
  );
  const sourceDropdown = screen.getByRole("combobox");

  selectEvent.openMenu(sourceDropdown);
  const sourceOption = await screen.findByText("GeoJSON");
  fireEvent.click(sourceOption);

  expect(await screen.findByText("GeoJSON Source")).toBeInTheDocument();
  // Switch to URL mode so we can type a value into the field. The field's
  // value is a stored-filename here (no slash → triggers the fetch branch),
  // not an actual URL — the URL-mode radio is just the input shape.
  const UrlRadio = await screen.findByLabelText("URL");
  await userEvent.click(UrlRadio);

  const UrlInput = await screen.findByLabelText("URL Input");
  fireEvent.change(UrlInput, {
    target: { value: "stored_geojson_file.json" },
  });
  expect(await screen.findByTestId("sourceProps")).toHaveTextContent(
    JSON.stringify({
      type: "GeoJSON",
      props: {},
      geojson: "stored_geojson_file.json",
    }),
  );
  await waitFor(() => {
    expect(mockSetErrorMessage).toHaveBeenCalledWith("Failed to retrieve JSON");
  });
});

test("SourcePane GeoJson URL is pass-through (no fetch, no error)", async () => {
  // URL-shaped geojson (contains "/") skips the fetch path entirely so
  // OL's VectorSource can resolve the URL directly. No setErrorMessage
  // call should ever fire for URL inputs.
  const downloadSpy = jest.spyOn(appAPI, "downloadJSON");
  const mockSetErrorMessage = jest.fn();

  render(<TestingComponent setErrorMessage={mockSetErrorMessage} />);

  expect(await screen.findByText("Source Type")).toBeInTheDocument();
  const sourceDropdown = screen.getByRole("combobox");
  selectEvent.openMenu(sourceDropdown);
  fireEvent.click(await screen.findByText("GeoJSON"));

  const UrlRadio = await screen.findByLabelText("URL");
  await userEvent.click(UrlRadio);

  const UrlInput = await screen.findByLabelText("URL Input");
  fireEvent.change(UrlInput, {
    target: { value: "https://some/url/file.json" },
  });

  expect(await screen.findByTestId("sourceProps")).toHaveTextContent(
    JSON.stringify({
      type: "GeoJSON",
      props: {},
      geojson: "https://some/url/file.json",
    }),
  );
  // No fetch attempted on URL path.
  expect(downloadSpy).not.toHaveBeenCalled();
  expect(mockSetErrorMessage).not.toHaveBeenCalled();
});

test("SourcePane GeoJson File Upload", async () => {
  render(<TestingComponent />);

  expect(await screen.findByText("Source Type")).toBeInTheDocument();
  expect(await screen.findByTestId("sourceProps")).toHaveTextContent(
    JSON.stringify({}),
  );
  const sourceDropdown = screen.getByRole("combobox");

  selectEvent.openMenu(sourceDropdown);
  const sourceOption = await screen.findByText("GeoJSON");
  fireEvent.click(sourceOption);

  expect(await screen.findByText("Upload GeoJSON file")).toBeInTheDocument();

  const file = new File([JSON.stringify(exampleGeoJSON)], "test-file.json", {
    type: "text/plain",
  });
  const fileInput = screen.getByTestId("file-input");
  fireEvent.change(fileInput, { target: { files: [file] } });

  await waitFor(async () => {
    expect(await screen.findByTestId("sourceProps")).toHaveTextContent(
      JSON.stringify({
        type: "GeoJSON",
        props: {},
        geojson: JSON.stringify(exampleGeoJSON),
      }),
    );
  });
});

test("SourcePane Updating Existing GeoJSON file", async () => {
  const mockDownloadJSON = jest.fn();
  jest.spyOn(appAPI, "downloadJSON").mockImplementation(mockDownloadJSON);
  mockDownloadJSON.mockResolvedValue({ success: true, data: exampleGeoJSON });

  render(
    <TestingComponent
      initialSourceProps={{
        type: "GeoJSON",
        props: {},
        geojson: "some_file.json",
      }}
    />,
  );

  expect(await screen.findByText("Source Type")).toBeInTheDocument();
  expect(await screen.findByTestId("sourceProps")).toHaveTextContent(
    JSON.stringify({
      type: "GeoJSON",
      props: {},
      geojson: "some_file.json",
    }),
  );
  expect(await screen.findByText("Upload GeoJSON file")).toBeInTheDocument();
  await waitFor(async () => {
    expect(await screen.findByTestId("sourceProps")).toHaveTextContent(
      JSON.stringify({
        type: "GeoJSON",
        props: {},
        geojson: JSON.stringify(exampleGeoJSON),
      }),
    );
  });
});

test("SourcePane Updating Existing GeoJSON url", async () => {
  global.fetch = jest.fn().mockResolvedValueOnce({
    ok: true,
  });

  render(
    <TestingComponent
      initialSourceProps={{
        type: "GeoJSON",
        props: {},
        geojson: "some/url/some_file.json",
      }}
    />,
  );

  expect(await screen.findByText("Source Type")).toBeInTheDocument();
  expect(await screen.findByTestId("sourceProps")).toHaveTextContent(
    JSON.stringify({}),
  );

  expect(await screen.findByText("GeoJSON Source")).toBeInTheDocument();
  expect(await screen.findByTestId("sourceProps")).toHaveTextContent(
    JSON.stringify({
      type: "GeoJSON",
      props: {},
      geojson: "some/url/some_file.json",
    }),
  );
});

test("SourcePane Updating Existing GeoJSON object", async () => {
  const mockDownloadJSON = jest.fn();
  jest.spyOn(appAPI, "downloadJSON").mockImplementation(mockDownloadJSON);
  mockDownloadJSON.mockResolvedValue({ success: true, data: exampleGeoJSON });

  render(
    <TestingComponent
      initialSourceProps={{
        type: "GeoJSON",
        props: {},
        geojson: exampleGeoJSON,
      }}
    />,
  );

  expect(await screen.findByText("Source Type")).toBeInTheDocument();
  expect(await screen.findByTestId("sourceProps")).toHaveTextContent(
    JSON.stringify({
      type: "GeoJSON",
      props: {},
      geojson: JSON.stringify(exampleGeoJSON),
    }),
  );
});

test("SourcePane Updating Error Downloading GeoJSON", async () => {
  const mockDownloadJSON = jest.fn();
  jest.spyOn(appAPI, "downloadJSON").mockImplementation(mockDownloadJSON);
  mockDownloadJSON.mockResolvedValue({ success: false });
  const mockSetErrorMessage = jest.fn();

  render(
    <TestingComponent
      initialSourceProps={{
        type: "GeoJSON",
        props: {},
        geojson: "some_file.json",
      }}
      setErrorMessage={mockSetErrorMessage}
    />,
  );

  expect(await screen.findByText("Source Type")).toBeInTheDocument();
  expect(await screen.findByTestId("sourceProps")).toHaveTextContent(
    JSON.stringify({
      type: "GeoJSON",
      props: {},
      geojson: "some_file.json",
    }),
  );
  expect(await screen.findByText("Upload GeoJSON file")).toBeInTheDocument();
  expect(mockSetErrorMessage).toHaveBeenCalledWith("Failed to retrieve JSON");
});

test("SourcePane Updating Existing VectorTiles", async () => {
  const mockDownloadJSON = jest.fn();
  jest.spyOn(appAPI, "downloadJSON").mockImplementation(mockDownloadJSON);
  mockDownloadJSON.mockResolvedValue({ data: exampleGeoJSON });

  render(
    <TestingComponent
      initialSourceProps={{
        type: "Vector Tile",
        props: {
          urls: ["some_url", "some_other_url"],
        },
      }}
    />,
  );

  expect(await screen.findByText("Source Type")).toBeInTheDocument();
  expect(await screen.findByTestId("sourceProps")).toHaveTextContent(
    JSON.stringify({
      type: "Vector Tile",
      props: {
        urls: ["some_url", "some_other_url"],
      },
    }),
  );

  expect(screen.getByText("*urls")).toBeInTheDocument();
  expect(screen.getByText("attributions")).toBeInTheDocument();
  expect(screen.getByText("projection")).toBeInTheDocument();

  const inputs = screen.getAllByRole("textbox");
  const urlsInput = inputs[0];
  expect(urlsInput.placeholder).toBe(
    "An comma separated list of URL templates. Must include {x}, {y} or {-y}, and {z} placeholders. A {?-?} template pattern, for example subdomain{a-f}.domain.com, may be used instead of defining each one separately in the urls option.",
  );
  expect(urlsInput.value).toBe("some_url,some_other_url");
});

describe("generatePropertiesArrayWithValues", () => {
  test("generates properties array empty values", () => {
    const sourceProperties = {
      required: {},
      optional: {},
    };
    const existingPropertyValues = {};

    const { properties, placeholders, types } =
      generatePropertiesArrayWithValues(
        sourceProperties,
        existingPropertyValues,
      );

    expect(properties).toEqual([]);
    expect(placeholders).toEqual([]);
    expect(types).toEqual([]);
  });

  test("generates properties array from bad properties", () => {
    const sourceProperties = {
      optional: {},
    };
    const existingPropertyValues = {};

    const { properties, placeholders, types } =
      generatePropertiesArrayWithValues(
        sourceProperties,
        existingPropertyValues,
      );

    expect(properties).toEqual([]);
    expect(placeholders).toEqual([]);
    expect(types).toEqual([]);
  });

  test("generates properties array from undefined existingPropertyValues", () => {
    const sourceProperties =
      sourcePropertiesOptions["ESRI Image and Map Service"];
    const existingPropertyValues = undefined;

    const { properties, placeholders, types } =
      generatePropertiesArrayWithValues(
        sourceProperties,
        existingPropertyValues,
      );

    expect(properties).toEqual([
      {
        property: "*url",
        value: "",
      },
      {
        property: "attributions",
        value: "",
      },
      {
        property: "params - LAYERS",
        value: "",
      },
      {
        property: "params - TIME",
        value: "",
      },
      {
        property: "params - LAYERDEFS",
        value: "",
      },
      {
        property: "params - mosaicRule",
        value: "",
      },
      {
        property: "projection",
        value: "",
      },
    ]);
    expect(placeholders).toEqual([
      {
        value: "ArcGIS Rest service URL",
      },
      {
        value: "Attributions",
      },
      {
        value: "[show|hide|include|exclude]:layerId1,layerId2",
      },
      {
        value: "<startTime>, <endTime> or <timeInstant>",
      },
      {
        value: "Allows you to filter the features of individual layers",
      },
      {
        value: "Specifies how image service should handle mosaics",
      },
      {
        value: "EPSG:<Code>",
      },
    ]);
    expect(types).toEqual([
      "text",
      "text",
      "text",
      "text",
      "text",
      "text",
      "text",
    ]);
  });

  test("generates properties array from existingPropertyValues", () => {
    const sourceProperties =
      sourcePropertiesOptions["ESRI Image and Map Service"];
    const existingPropertyValues = {
      url: "some_url",
    };

    const { properties, placeholders, types } =
      generatePropertiesArrayWithValues(
        sourceProperties,
        existingPropertyValues,
      );

    expect(properties).toEqual([
      {
        property: "*url",
        value: "some_url",
      },
      {
        property: "attributions",
        value: "",
      },
      {
        property: "params - LAYERS",
        value: "",
      },
      {
        property: "params - TIME",
        value: "",
      },
      {
        property: "params - LAYERDEFS",
        value: "",
      },
      {
        property: "params - mosaicRule",
        value: "",
      },
      {
        property: "projection",
        value: "",
      },
    ]);
    expect(placeholders).toEqual([
      {
        value: "ArcGIS Rest service URL",
      },
      {
        value: "Attributions",
      },
      {
        value: "[show|hide|include|exclude]:layerId1,layerId2",
      },
      {
        value: "<startTime>, <endTime> or <timeInstant>",
      },
      {
        value: "Allows you to filter the features of individual layers",
      },
      {
        value: "Specifies how image service should handle mosaics",
      },
      {
        value: "EPSG:<Code>",
      },
    ]);
    expect(types).toEqual([
      "text",
      "text",
      "text",
      "text",
      "text",
      "text",
      "text",
    ]);
  });
});

describe("SourcePane Dynamic Map Layer", () => {
  test("Dynamic Map Layer option appears in source-type dropdown", async () => {
    const sourcePropsSpy = jest.fn();

    render(
      <TestingComponent
        sourcePropsSpy={sourcePropsSpy}
        dynamicMapLayers={[
          {
            label: "Dynamic Map Layers",
            options: [
              {
                source: "custom_layer_test",
                value: "Stream Gauges (Dynamic)",
                label: "Stream Gauges (Dynamic)",
                args: {},
                type: "map_layer",
                tags: ["hydrology", "gauges", "live"],
                attribution: "",
                description:
                  "Live stream gauge locations, color-coded by current flow.",
                loading_icon: true,
                restricted: false,
                dynamic_map_layer: true,
              },
            ],
          },
        ]}
      />,
    );

    expect(await screen.findByText("Source Type")).toBeInTheDocument();
    expect(await screen.findByTestId("sourceProps")).toHaveTextContent(
      JSON.stringify({}),
    );
    const sourceDropdown = screen.getByRole("combobox");

    selectEvent.openMenu(sourceDropdown);
    const sourceOption = await screen.findByText("Stream Gauges (Dynamic)");
    fireEvent.click(sourceOption);

    expect(
      await screen.findByText("This plugin takes no arguments."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Fetch plugin defaults")).toBeInTheDocument();

    expect(sourcePropsSpy).toHaveBeenCalledWith({
      source: "custom_layer_test",
      value: "Stream Gauges (Dynamic)",
      label: "Stream Gauges (Dynamic)",
      args: {},
      type: "Stream Gauges (Dynamic)",
      tags: ["hydrology", "gauges", "live"],
      attribution: "",
      description: "Live stream gauge locations, color-coded by current flow.",
      loading_icon: true,
      restricted: false,
      dynamic_map_layer: true,
      props: {},
    });
  });

  test("Dynamic Map Layer initial and existing", async () => {
    const sourcePropsSpy = jest.fn();
    render(
      <VariableInputsContext.Provider value={{ variableInputValues: {} }}>
        <DataViewerModeContext.Provider value={{ inDataViewerMode: true }}>
          <TestingComponent
            sourcePropsSpy={sourcePropsSpy}
            initialSourceProps={{
              type: "Stream Gauges (Dynamic)",
              source: "custom_layer_test",
              props: {},
            }}
            dynamicMapLayers={[
              {
                label: "Dynamic Map Layers",
                options: [
                  {
                    source: "custom_layer_test",
                    value: "Stream Gauges (Dynamic)",
                    label: "Stream Gauges (Dynamic)",
                    args: { test: "text" },
                    type: "map_layer",
                    tags: ["hydrology", "gauges", "live"],
                    attribution: "",
                    description:
                      "Live stream gauge locations, color-coded by current flow.",
                    loading_icon: true,
                    restricted: false,
                    dynamic_map_layer: true,
                  },
                ],
              },
            ]}
          />
        </DataViewerModeContext.Provider>
      </VariableInputsContext.Provider>,
    );

    expect(await screen.findByText("Source Type")).toBeInTheDocument();
    expect(await screen.findByTestId("sourceProps")).toHaveTextContent(
      JSON.stringify({}),
    );
    const sourceDropdown = screen.getByRole("combobox");

    selectEvent.openMenu(sourceDropdown);
    const sourceOption = await screen.findByText("Stream Gauges (Dynamic)");
    fireEvent.click(sourceOption);

    const argInput = await screen.findByLabelText("Test Input");
    expect(argInput).toBeInTheDocument();
    expect(screen.getByLabelText("Fetch plugin defaults")).toBeInTheDocument();

    fireEvent.change(argInput, { target: { value: "updated text" } });

    expect(sourcePropsSpy).toHaveBeenCalledWith({
      source: "custom_layer_test",
      args: { test: "updated text" },
      type: "Stream Gauges (Dynamic)",
      props: {},
    });

    fireEvent.change(argInput, { target: { value: "another updated text" } });

    expect(sourcePropsSpy).toHaveBeenCalledWith({
      source: "custom_layer_test",
      args: { test: "another updated text" },
      type: "Stream Gauges (Dynamic)",
      props: {},
    });
  });

  test("Dynamic Map Layer initial and nonexisting", async () => {
    const sourcePropsSpy = jest.fn();
    render(
      <VariableInputsContext.Provider value={{ variableInputValues: {} }}>
        <DataViewerModeContext.Provider value={{ inDataViewerMode: true }}>
          <TestingComponent
            sourcePropsSpy={sourcePropsSpy}
            initialSourceProps={{
              type: "Stream Gauges (Dynamic)",
              source: "custom_layer_test",
              args: { test: "some text" },
              props: {},
            }}
          />
        </DataViewerModeContext.Provider>
      </VariableInputsContext.Provider>,
    );

    expect(await screen.findByText("Source Type")).toBeInTheDocument();
    expect(await screen.findByTestId("sourceProps")).toHaveTextContent(
      JSON.stringify({}),
    );

    const sourceDropdown = screen.getByRole("combobox");
    await selectEvent.select(sourceDropdown, "Stream Gauges (Dynamic)");

    expect(
      await screen.findByText(
        /This layer was configured with the dynamic map-layer plugin/,
      ),
    ).toBeInTheDocument();

    expect(
      await screen.findByText(/but it is no longer installed on this server/),
    ).toBeInTheDocument();

    expect(sourcePropsSpy).toHaveBeenCalledTimes(0);
  });

  test("Dynamic Map Layer initial and nonexisting 2", async () => {
    const sourcePropsSpy = jest.fn();
    render(
      <VariableInputsContext.Provider value={{ variableInputValues: {} }}>
        <DataViewerModeContext.Provider value={{ inDataViewerMode: true }}>
          <TestingComponent
            sourcePropsSpy={sourcePropsSpy}
            initialSourceProps={{
              source: "custom_layer_test",
              args: { test: "some text" },
              props: {},
            }}
          />
        </DataViewerModeContext.Provider>
      </VariableInputsContext.Provider>,
    );

    expect(await screen.findByText("Source Type")).toBeInTheDocument();
    expect(await screen.findByTestId("sourceProps")).toHaveTextContent(
      JSON.stringify({}),
    );
    const sourceDropdown = screen.getByRole("combobox");
    await selectEvent.select(sourceDropdown, "custom_layer_test");

    expect(
      await screen.findByText(
        /This layer was configured with the dynamic map-layer plugin/,
      ),
    ).toBeInTheDocument();

    expect(
      await screen.findByText(/but it is no longer installed on this server/),
    ).toBeInTheDocument();

    expect(sourcePropsSpy).toHaveBeenCalledTimes(0);
  });

  test("Dynamic Map Layer initial and success fetch defaults", async () => {
    const sourcePropsSpy = jest.fn();
    const onFetchPluginDefaults = jest.fn().mockResolvedValue({
      success: true,
    });

    render(
      <VariableInputsContext.Provider value={{ variableInputValues: {} }}>
        <DataViewerModeContext.Provider value={{ inDataViewerMode: true }}>
          <TestingComponent
            sourcePropsSpy={sourcePropsSpy}
            onFetchPluginDefaults={onFetchPluginDefaults}
            initialSourceProps={{
              type: "Stream Gauges (Dynamic)",
              source: "custom_layer_test",
              props: {},
            }}
            dynamicMapLayers={[
              {
                label: "Dynamic Map Layers",
                options: [
                  {
                    source: "custom_layer_test",
                    value: "Stream Gauges (Dynamic)",
                    label: "Stream Gauges (Dynamic)",
                    args: {},
                    type: "map_layer",
                    tags: ["hydrology", "gauges", "live"],
                    attribution: "",
                    description:
                      "Live stream gauge locations, color-coded by current flow.",
                    loading_icon: true,
                    restricted: false,
                    dynamic_map_layer: true,
                  },
                ],
              },
            ]}
          />
        </DataViewerModeContext.Provider>
      </VariableInputsContext.Provider>,
    );

    expect(await screen.findByText("Source Type")).toBeInTheDocument();
    expect(await screen.findByTestId("sourceProps")).toHaveTextContent(
      JSON.stringify({}),
    );
    const sourceDropdown = screen.getByRole("combobox");

    selectEvent.openMenu(sourceDropdown);
    const sourceOption = await screen.findByText("Stream Gauges (Dynamic)");
    fireEvent.click(sourceOption);

    const fetchDefaultsButton = await screen.findByLabelText(
      "Fetch plugin defaults",
    );
    expect(fetchDefaultsButton).toBeInTheDocument();
    fireEvent.click(fetchDefaultsButton);

    expect(sourcePropsSpy).toHaveBeenCalledTimes(0);
  });

  test("Dynamic Map Layer initial and failed fetch defaults", async () => {
    const sourcePropsSpy = jest.fn();
    const onFetchPluginDefaults = jest.fn().mockResolvedValue({
      success: false,
    });

    render(
      <VariableInputsContext.Provider value={{ variableInputValues: {} }}>
        <DataViewerModeContext.Provider value={{ inDataViewerMode: true }}>
          <TestingComponent
            sourcePropsSpy={sourcePropsSpy}
            onFetchPluginDefaults={onFetchPluginDefaults}
            initialSourceProps={{
              type: "Stream Gauges (Dynamic)",
              source: "custom_layer_test",
              props: {},
            }}
            dynamicMapLayers={[
              {
                label: "Dynamic Map Layers",
                options: [
                  {
                    source: "custom_layer_test",
                    value: "Stream Gauges (Dynamic)",
                    label: "Stream Gauges (Dynamic)",
                    args: {},
                    type: "map_layer",
                    tags: ["hydrology", "gauges", "live"],
                    attribution: "",
                    description:
                      "Live stream gauge locations, color-coded by current flow.",
                    loading_icon: true,
                    restricted: false,
                    dynamic_map_layer: true,
                  },
                ],
              },
            ]}
          />
        </DataViewerModeContext.Provider>
      </VariableInputsContext.Provider>,
    );

    expect(await screen.findByText("Source Type")).toBeInTheDocument();
    expect(await screen.findByTestId("sourceProps")).toHaveTextContent(
      JSON.stringify({}),
    );
    const sourceDropdown = screen.getByRole("combobox");

    selectEvent.openMenu(sourceDropdown);
    const sourceOption = await screen.findByText("Stream Gauges (Dynamic)");
    fireEvent.click(sourceOption);

    const fetchDefaultsButton = await screen.findByLabelText(
      "Fetch plugin defaults",
    );
    expect(fetchDefaultsButton).toBeInTheDocument();
    fireEvent.click(fetchDefaultsButton);

    expect(
      await screen.findByText(/Failed to fetch plugin defaults/),
    ).toBeInTheDocument();

    expect(sourcePropsSpy).toHaveBeenCalledTimes(0);
  });

  test("Dynamic Map Layer initial and failed fetch defaults with message", async () => {
    const sourcePropsSpy = jest.fn();
    const onFetchPluginDefaults = jest.fn().mockResolvedValue({
      success: false,
      error: "Custom error message",
    });

    render(
      <VariableInputsContext.Provider value={{ variableInputValues: {} }}>
        <DataViewerModeContext.Provider value={{ inDataViewerMode: true }}>
          <TestingComponent
            sourcePropsSpy={sourcePropsSpy}
            onFetchPluginDefaults={onFetchPluginDefaults}
            initialSourceProps={{
              type: "Stream Gauges (Dynamic)",
              value: "custom_layer_test",
              props: {},
            }}
            dynamicMapLayers={[
              {
                label: "Dynamic Map Layers",
                options: [
                  {
                    source: "custom_layer_test",
                    value: "Stream Gauges (Dynamic)",
                    label: "Stream Gauges (Dynamic)",
                    args: {},
                    type: "map_layer",
                    tags: ["hydrology", "gauges", "live"],
                    attribution: "",
                    description:
                      "Live stream gauge locations, color-coded by current flow.",
                    loading_icon: true,
                    restricted: false,
                    dynamic_map_layer: true,
                  },
                ],
              },
            ]}
          />
        </DataViewerModeContext.Provider>
      </VariableInputsContext.Provider>,
    );

    expect(await screen.findByText("Source Type")).toBeInTheDocument();
    expect(await screen.findByTestId("sourceProps")).toHaveTextContent(
      JSON.stringify({}),
    );
    const sourceDropdown = screen.getByRole("combobox");

    selectEvent.openMenu(sourceDropdown);
    const sourceOption = await screen.findByText("Stream Gauges (Dynamic)");
    fireEvent.click(sourceOption);

    const fetchDefaultsButton = await screen.findByLabelText(
      "Fetch plugin defaults",
    );
    expect(fetchDefaultsButton).toBeInTheDocument();
    fireEvent.click(fetchDefaultsButton);

    expect(await screen.findByText(/Custom error message/)).toBeInTheDocument();

    expect(sourcePropsSpy).toHaveBeenCalledTimes(0);
  });
});

test("SourcePane Static Image fields", async () => {
  render(<TestingComponent onRequestHideModal={jest.fn()} />);

  const sourceDropdown = screen.getByRole("combobox");
  selectEvent.openMenu(sourceDropdown);
  const sourceOption = await screen.findByText("Static Image");
  fireEvent.click(sourceOption);

  expect(await screen.findByText("Source Properties")).toBeInTheDocument();
  expect(screen.getByText("*url")).toBeInTheDocument();
  expect(screen.getByText("*projection")).toBeInTheDocument();
  expect(screen.getByText("*imageExtent")).toBeInTheDocument();
  expect(screen.getByText("attributions")).toBeInTheDocument();

  expect(await screen.findByTestId("sourceProps")).toHaveTextContent(
    JSON.stringify({ type: "Static Image", props: {} }),
  );
});

test("SourcePane Static Image Draw Extent button calls onRequestHideModal", async () => {
  const mockOnRequestHideModal = jest.fn();
  render(<TestingComponent onRequestHideModal={mockOnRequestHideModal} />);

  const sourceDropdown = screen.getByRole("combobox");
  selectEvent.openMenu(sourceDropdown);
  const sourceOption = await screen.findByText("Static Image");
  fireEvent.click(sourceOption);

  // Fill in URL first
  const inputs = await screen.findAllByRole("textbox");
  const urlInput = inputs[0];
  fireEvent.change(urlInput, {
    target: { value: "https://example.com/image.png" },
  });

  const drawButton = await screen.findByLabelText("Draw Extent on Map Button");
  expect(drawButton).toBeInTheDocument();
  fireEvent.click(drawButton);

  expect(mockOnRequestHideModal).toHaveBeenCalledTimes(1);
});

test("SourcePane Static Image Draw Extent requires URL", async () => {
  const mockSetErrorMessage = jest.fn();
  render(
    <TestingComponent
      setErrorMessage={mockSetErrorMessage}
      onRequestHideModal={jest.fn()}
    />,
  );

  const sourceDropdown = screen.getByRole("combobox");
  selectEvent.openMenu(sourceDropdown);
  const sourceOption = await screen.findByText("Static Image");
  fireEvent.click(sourceOption);

  const drawButton = await screen.findByLabelText("Draw Extent on Map Button");
  fireEvent.click(drawButton);

  expect(mockSetErrorMessage).toHaveBeenCalledWith(
    "Please enter an image URL before drawing the extent.",
  );
});

test("SourcePane Static Image existing values", async () => {
  render(
    <TestingComponent
      initialSourceProps={{
        type: "Static Image",
        props: {
          url: "https://example.com/image.png",
          projection: "EPSG:3857",
          imageExtent: "-100, 30, -90, 40",
        },
      }}
      onRequestHideModal={jest.fn()}
    />,
  );

  expect(await screen.findByText("Source Type")).toBeInTheDocument();
  expect(screen.getByText("*url")).toBeInTheDocument();
  expect(screen.getByText("*projection")).toBeInTheDocument();
  expect(screen.getByText("*imageExtent")).toBeInTheDocument();

  const inputs = await screen.findAllByRole("textbox");
  const urlInput = inputs[0];
  const projectionInput = inputs[1];
  const imageExtentInput = inputs[2];

  expect(urlInput.value).toBe("https://example.com/image.png");
  expect(projectionInput.value).toBe("EPSG:3857");
  expect(imageExtentInput.value).toBe("-100, 30, -90, 40");
});

test("SourcePane Static Image Draw Extent parses existing imageExtent", async () => {
  const mockOnRequestHideModal = jest.fn();
  render(
    <TestingComponent
      initialSourceProps={{
        type: "Static Image",
        props: {
          url: "https://example.com/image.png",
          projection: "EPSG:3857",
          imageExtent: "-100.5, 30.2, -90.1, 40.8",
        },
      }}
      onRequestHideModal={mockOnRequestHideModal}
    />,
  );

  await waitFor(() => {
    expect(screen.getByText("*imageExtent")).toBeInTheDocument();
  });

  const drawButton = await screen.findByLabelText("Draw Extent on Map Button");
  fireEvent.click(drawButton);

  expect(mockOnRequestHideModal).toHaveBeenCalledTimes(1);
});

test("SourcePane GeoTIFF option appears in source-type dropdown", async () => {
  render(<TestingComponent />);

  expect(await screen.findByText("Source Type")).toBeInTheDocument();
  const sourceDropdown = screen.getByRole("combobox");

  selectEvent.openMenu(sourceDropdown);
  expect(await screen.findByText("GeoTIFF")).toBeInTheDocument();
});

test("SourcePane switching from GeoTIFF to WMS renders InputTable", async () => {
  render(<TestingComponent />);

  const sourceDropdown = screen.getByRole("combobox");

  // Select GeoTIFF first — its own fields appear in the shared table.
  selectEvent.openMenu(sourceDropdown);
  const geoTIFFOption = await screen.findByText("GeoTIFF");
  fireEvent.click(geoTIFFOption);
  expect(await screen.findByText("Source Properties")).toBeInTheDocument();
  expect(screen.getByText("mask_below")).toBeInTheDocument();

  // Switch to WMS
  selectEvent.openMenu(sourceDropdown);
  const wmsOption = await screen.findByText("WMS");
  fireEvent.click(wmsOption);

  // Table is rebuilt for WMS, with no stale GeoTIFF fields.
  expect(await screen.findByText("Source Properties")).toBeInTheDocument();
  expect(screen.queryByText("mask_below")).not.toBeInTheDocument();
});

test("SourcePane GeoTIFF renders the shared InputTable with its own fields", async () => {
  // GeoTIFF now uses the same required/optional properties table as every other
  // source type, instead of a bespoke sources list plus sub-modal.
  render(<TestingComponent initialSourceProps={{ type: "GeoTIFF" }} />);

  expect(await screen.findByText("Source Properties")).toBeInTheDocument();
  expect(screen.getByText("*url")).toBeInTheDocument();
  expect(screen.getByText("projection")).toBeInTheDocument();
  // nodata is not authored — it comes from the raster's own tag.
  expect(screen.queryByText("nodata")).not.toBeInTheDocument();
  expect(screen.getByText("mask_below")).toBeInTheDocument();
  // The sources sub-modal is gone.
  expect(
    screen.queryByRole("button", { name: "Add source" }),
  ).not.toBeInTheDocument();
});

test("SourcePane GeoTIFF regression: KML still renders InputTable", async () => {
  render(<TestingComponent />);

  const sourceDropdown = screen.getByRole("combobox");
  selectEvent.openMenu(sourceDropdown);
  const sourceOption = await screen.findByText("KML");
  fireEvent.click(sourceOption);

  expect(await screen.findByText("Source Properties")).toBeInTheDocument();
  expect(
    screen.queryByText("Add at least one source to render this layer"),
  ).not.toBeInTheDocument();
});

test("SourcePane GeoTIFF regression: Vector Tile still renders InputTable", async () => {
  render(<TestingComponent />);

  const sourceDropdown = screen.getByRole("combobox");
  selectEvent.openMenu(sourceDropdown);
  const sourceOption = await screen.findByText("Vector Tile");
  fireEvent.click(sourceOption);

  expect(await screen.findByText("Source Properties")).toBeInTheDocument();
  expect(screen.getByText("*urls")).toBeInTheDocument();
  expect(
    screen.queryByText("Add at least one source to render this layer"),
  ).not.toBeInTheDocument();
});

test("SourcePane Static Image Draw Extent handles invalid imageExtent gracefully", async () => {
  const mockOnRequestHideModal = jest.fn();
  render(
    <TestingComponent
      initialSourceProps={{
        type: "Static Image",
        props: {
          url: "https://example.com/image.png",
          projection: "EPSG:3857",
          imageExtent: "not, a, valid",
        },
      }}
      onRequestHideModal={mockOnRequestHideModal}
    />,
  );

  await waitFor(() => {
    expect(screen.getByText("*imageExtent")).toBeInTheDocument();
  });

  const drawButton = await screen.findByLabelText("Draw Extent on Map Button");
  fireEvent.click(drawButton);

  // Should still proceed (initialExtent stays null) without error
  expect(mockOnRequestHideModal).toHaveBeenCalledTimes(1);
});

TestingComponent.propTypes = {
  initialSourceProps: PropTypes.object,
  setErrorMessage: PropTypes.func,
  onRequestHideModal: PropTypes.func,
  sourcePropsSpy: PropTypes.func,
  dynamicMapLayers: PropTypes.array,
  onFetchPluginDefaults: PropTypes.func,
};

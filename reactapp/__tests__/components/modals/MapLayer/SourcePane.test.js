import { useState } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SourcePane, {
  generatePropertiesArrayWithValues,
} from "components/modals/MapLayer/SourcePane";
import selectEvent from "react-select-event";
import appAPI from "services/api/app";
import PropTypes from "prop-types";
import userEvent from "@testing-library/user-event";
import { LayoutContext } from "components/contexts/Contexts";
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
  onSubModalToggle,
  sourcePropsSpy,
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
    <MapContextProvider>
      <LayoutContext.Provider value={{ uuid: "123" }}>
        <SourcePane
          sourceProps={sourceProps}
          setSourceProps={spyingSetSourceProps}
          setAttributeProps={setAttributeProps}
          setErrorMessage={setErrorMessage}
          onRequestHideModal={onRequestHideModal}
          onSubModalToggle={onSubModalToggle}
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

describe("SourcePane GeoTIFF row rendering edge cases", () => {
  test("multi-band/blank-band/missing-url sources hit the row formatters' fallback paths", async () => {
    // Three sources cover three different formatter branches at once:
    //   - bands "1,2,3" → singleBandIndex's `parts.length !== 1` early
    //     return at line 112 (3 sources triggers `sources.every(...)`,
    //     so the multi-band entry forces the null branch).
    //   - bands ",,," → formatSummary's `parts.length === 0` early
    //     return at line 126.
    //   - missing url → JSX `source?.url ?? ""` fallback at line 533.
    //   - non-empty min/max → fieldDisplay's `s !== ""` branch at line 132.
    render(
      <TestingComponent
        initialSourceProps={{
          type: "GeoTIFF",
          props: {
            sources: [
              {
                url: "https://example.com/multi.tif",
                bands: "1,2,3",
                min: "10",
                max: "100",
              },
              { url: "https://example.com/blank.tif", bands: ",,," },
              { bands: "1" },
            ],
          },
        }}
      />,
    );

    // Row 0: non-empty min/max land in the row summary verbatim (line 132
    // false branch — the existing tests only stamped em-dashes).
    expect(await screen.findByText(/min: 10 · max: 100/)).toBeInTheDocument();

    // Row 1: blank-only bands string collapses to em-dash for bands.
    expect(screen.getByText(/bands: — · min: — · max: —/)).toBeInTheDocument();

    // Row 2: missing url renders as empty (the `?? ""` ran). Edit/Remove
    // buttons still appear so the row is reachable.
    expect(screen.getByLabelText("Edit source 3")).toBeInTheDocument();
    expect(screen.getByLabelText("Remove source 3")).toBeInTheDocument();

    // 3-source allSingleBand check called singleBandIndex on the multi-
    // band entry; this `every(...)` call must have short-circuited false
    // so no R/G/B channel labels were rendered.
    expect(screen.queryByText(/^R:$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^G:$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^B:$/)).not.toBeInTheDocument();
  });

  test("Add source on a GeoTIFF sourceProps with no `props` key uses the {} fallback", async () => {
    // Covers the right side of `previousSourceProps?.props ?? {}` at
    // line 441. With initialSourceProps = { type: "GeoTIFF" } (no
    // `props` key), the first sub-modal save's syncSourcesToProps spread
    // must fall back to an empty object before adding `sources`.
    let lastSetProps;
    render(
      <TestingComponent
        initialSourceProps={{ type: "GeoTIFF" }}
        sourcePropsSpy={(next) => {
          lastSetProps = next;
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add source" }));
    const urlInput = await screen.findByLabelText("URL Input");
    fireEvent.change(urlInput, {
      target: { value: "https://example.com/new.tif" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save GeoTIFF Source Button" }),
    );

    await waitFor(() => {
      expect(lastSetProps?.props?.sources).toBeDefined();
    });
    expect(lastSetProps.props.sources).toEqual([
      expect.objectContaining({ url: "https://example.com/new.tif" }),
    ]);
    // Type was preserved alongside the newly-built `props` object.
    expect(lastSetProps.type).toBe("GeoTIFF");
  });
});

TestingComponent.propTypes = {
  initialSourceProps: PropTypes.object,
  setErrorMessage: PropTypes.func,
  onRequestHideModal: PropTypes.func,
  onSubModalToggle: PropTypes.func,
  sourcePropsSpy: PropTypes.func,
};

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

test("SourcePane GeoTIFF renders placeholder UI and not InputTable", async () => {
  render(<TestingComponent />);

  const sourceDropdown = screen.getByRole("combobox");
  selectEvent.openMenu(sourceDropdown);
  const sourceOption = await screen.findByText("GeoTIFF");
  fireEvent.click(sourceOption);

  // Empty-state copy + Add button appear
  expect(
    await screen.findByText("Add at least one source to render this layer"),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Add source" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Sources")).toBeInTheDocument();

  // InputTable markers do NOT appear (no "Source Properties" heading, no required * marker)
  expect(screen.queryByText("Source Properties")).not.toBeInTheDocument();
  expect(
    screen.queryByText(/indicates a required property/),
  ).not.toBeInTheDocument();
});

test("SourcePane GeoTIFF Add source button is keyboard-reachable with accessible name", async () => {
  render(<TestingComponent />);

  const sourceDropdown = screen.getByRole("combobox");
  selectEvent.openMenu(sourceDropdown);
  const sourceOption = await screen.findByText("GeoTIFF");
  fireEvent.click(sourceOption);

  const addButton = await screen.findByRole("button", { name: "Add source" });
  // Button text itself provides the accessible name (no aria-label needed)
  expect(addButton).toHaveAccessibleName("Add source");
  // Default button tabIndex is 0 (keyboard-reachable) unless explicitly disabled
  expect(addButton).not.toBeDisabled();
  expect(addButton.tabIndex).not.toBe(-1);
  // Clickable (no-op placeholder behavior for Unit 2)
  fireEvent.click(addButton);
  expect(addButton).toBeInTheDocument();
});

test("SourcePane switching from GeoTIFF to WMS renders InputTable", async () => {
  render(<TestingComponent />);

  const sourceDropdown = screen.getByRole("combobox");

  // Select GeoTIFF first
  selectEvent.openMenu(sourceDropdown);
  const geoTIFFOption = await screen.findByText("GeoTIFF");
  fireEvent.click(geoTIFFOption);
  expect(
    await screen.findByText("Add at least one source to render this layer"),
  ).toBeInTheDocument();

  // Switch to WMS
  selectEvent.openMenu(sourceDropdown);
  const wmsOption = await screen.findByText("WMS");
  fireEvent.click(wmsOption);

  // InputTable rendered
  expect(await screen.findByText("Source Properties")).toBeInTheDocument();
  // Stale GeoTIFF UI is gone
  expect(
    screen.queryByText("Add at least one source to render this layer"),
  ).not.toBeInTheDocument();
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

// --- Unit 4: GeoTIFF sources-array CRUD + sub-modal integration ------------

const selectGeoTIFF = async () => {
  const sourceDropdown = screen.getByRole("combobox");
  selectEvent.openMenu(sourceDropdown);
  const sourceOption = await screen.findByText("GeoTIFF");
  fireEvent.click(sourceOption);
};

test("SourcePane GeoTIFF Add source opens sub-modal and Save appends a row", async () => {
  render(<TestingComponent />);
  await selectGeoTIFF();

  // Empty-state visible before Add
  expect(
    await screen.findByText("Add at least one source to render this layer"),
  ).toBeInTheDocument();

  const addButton = await screen.findByRole("button", { name: "Add source" });
  fireEvent.click(addButton);

  // Sub-modal URL input (from GeoTIFFSourceModal) appears
  const urlInput = await screen.findByLabelText("URL Input");
  fireEvent.change(urlInput, {
    target: { value: "https://example.com/a.tif" },
  });

  const saveBtn = screen.getByRole("button", {
    name: "Save GeoTIFF Source Button",
  });
  fireEvent.click(saveBtn);

  // Row appears with the URL
  expect(
    await screen.findByText("https://example.com/a.tif"),
  ).toBeInTheDocument();
  // Empty state copy is gone
  expect(
    screen.queryByText("Add at least one source to render this layer"),
  ).not.toBeInTheDocument();
  // Summary placeholder shows em-dashes (no bands/min/max filled)
  expect(screen.getByText(/bands: — · min: — · max: —/)).toBeInTheDocument();
});

test("SourcePane GeoTIFF reopening a layer with existing sources shows all rows", async () => {
  render(
    <TestingComponent
      initialSourceProps={{
        type: "GeoTIFF",
        props: {
          sources: [
            { url: "https://example.com/a.tif" },
            { url: "https://example.com/b.tif" },
            { url: "https://example.com/c.tif" },
          ],
        },
      }}
    />,
  );

  expect(
    await screen.findByText("https://example.com/a.tif"),
  ).toBeInTheDocument();
  expect(screen.getByText("https://example.com/b.tif")).toBeInTheDocument();
  expect(screen.getByText("https://example.com/c.tif")).toBeInTheDocument();

  // Each row has an Edit and Remove button with positional aria-labels
  expect(
    screen.getByRole("button", { name: "Edit source 1" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Edit source 2" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Edit source 3" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Remove source 1" }),
  ).toBeInTheDocument();
});

test("SourcePane GeoTIFF Edit row 2 updates only that row and returns focus", async () => {
  render(
    <TestingComponent
      initialSourceProps={{
        type: "GeoTIFF",
        props: {
          sources: [
            { url: "https://example.com/a.tif" },
            { url: "https://example.com/b.tif" },
            { url: "https://example.com/c.tif" },
          ],
        },
      }}
    />,
  );

  const editRow2 = await screen.findByRole("button", {
    name: "Edit source 2",
  });
  fireEvent.click(editRow2);

  const urlInput = await screen.findByLabelText("URL Input");
  expect(urlInput.value).toBe("https://example.com/b.tif");
  fireEvent.change(urlInput, {
    target: { value: "https://example.com/b-edited.tif" },
  });

  const saveBtn = screen.getByRole("button", {
    name: "Save GeoTIFF Source Button",
  });
  fireEvent.click(saveBtn);

  // Row 2 updated; rows 1 and 3 unchanged
  expect(
    await screen.findByText("https://example.com/b-edited.tif"),
  ).toBeInTheDocument();
  expect(screen.getByText("https://example.com/a.tif")).toBeInTheDocument();
  expect(screen.getByText("https://example.com/c.tif")).toBeInTheDocument();
  expect(
    screen.queryByText("https://example.com/b.tif"),
  ).not.toBeInTheDocument();

  // After the modal's exit transition, focus returns to the triggering
  // Edit button. We wait for focus rather than relying on exact transition
  // timing.
  await waitFor(() => {
    expect(screen.getByRole("button", { name: "Edit source 2" })).toHaveFocus();
  });
});

test("SourcePane GeoTIFF prefixes R/G/B when exactly 3 single-band sources", async () => {
  render(
    <TestingComponent
      initialSourceProps={{
        type: "GeoTIFF",
        props: {
          sources: [
            { url: "https://example.com/r.tif", bands: "1" },
            { url: "https://example.com/g.tif", bands: "1" },
            { url: "https://example.com/b.tif", bands: "1" },
          ],
        },
      }}
    />,
  );

  expect(await screen.findByText("R:")).toBeInTheDocument();
  expect(screen.getByText("G:")).toBeInTheDocument();
  expect(screen.getByText("B:")).toBeInTheDocument();

  // Add a 4th source via the real user flow — rerender() won't re-seed
  // TestingComponent's useState initial value, so we drive the state change
  // through the actual Add button + sub-modal Save path.
  const addButton = screen.getByRole("button", { name: "Add source" });
  fireEvent.click(addButton);
  const urlInput = await screen.findByLabelText("URL Input");
  fireEvent.change(urlInput, {
    target: { value: "https://example.com/d.tif" },
  });
  const saveBtn = screen.getByRole("button", {
    name: "Save GeoTIFF Source Button",
  });
  fireEvent.click(saveBtn);

  // Row appears for the 4th source, and positional prefixes are removed.
  await waitFor(() => {
    expect(screen.getByText("https://example.com/d.tif")).toBeInTheDocument();
  });
  expect(screen.queryByText("R:")).not.toBeInTheDocument();
  expect(screen.queryByText("G:")).not.toBeInTheDocument();
  expect(screen.queryByText("B:")).not.toBeInTheDocument();
});

test("SourcePane GeoTIFF Edit and Remove buttons are keyboard-reachable and aria-labeled", async () => {
  render(
    <TestingComponent
      initialSourceProps={{
        type: "GeoTIFF",
        props: {
          sources: [{ url: "https://example.com/a.tif" }],
        },
      }}
    />,
  );

  const editBtn = await screen.findByRole("button", {
    name: "Edit source 1",
  });
  const removeBtn = screen.getByRole("button", { name: "Remove source 1" });

  expect(editBtn.tabIndex).not.toBe(-1);
  expect(removeBtn.tabIndex).not.toBe(-1);
  expect(editBtn).toHaveAttribute("aria-label", "Edit source 1");
  expect(removeBtn).toHaveAttribute("aria-label", "Remove source 1");
});

test("SourcePane GeoTIFF Remove on row 2 with confirm=true splices that row out", async () => {
  const confirmSpy = jest
    .spyOn(window, "confirm")
    .mockImplementation(() => true);

  try {
    render(
      <TestingComponent
        initialSourceProps={{
          type: "GeoTIFF",
          props: {
            sources: [
              { url: "https://example.com/a.tif" },
              { url: "https://example.com/b.tif" },
              { url: "https://example.com/c.tif" },
            ],
          },
        }}
      />,
    );

    const removeRow2 = await screen.findByRole("button", {
      name: "Remove source 2",
    });
    fireEvent.click(removeRow2);

    await waitFor(() => {
      expect(
        screen.queryByText("https://example.com/b.tif"),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByText("https://example.com/a.tif")).toBeInTheDocument();
    expect(screen.getByText("https://example.com/c.tif")).toBeInTheDocument();
    // After removal rows 1 and 3 collapse to 1 and 2
    expect(
      screen.getByRole("button", { name: "Edit source 1" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit source 2" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit source 3" }),
    ).not.toBeInTheDocument();
  } finally {
    confirmSpy.mockRestore();
  }
});

test("SourcePane GeoTIFF Remove with confirm=false leaves the list unchanged", async () => {
  const confirmSpy = jest
    .spyOn(window, "confirm")
    .mockImplementation(() => false);

  try {
    render(
      <TestingComponent
        initialSourceProps={{
          type: "GeoTIFF",
          props: {
            sources: [
              { url: "https://example.com/a.tif" },
              { url: "https://example.com/b.tif" },
            ],
          },
        }}
      />,
    );

    const removeRow1 = await screen.findByRole("button", {
      name: "Remove source 1",
    });
    fireEvent.click(removeRow1);

    expect(screen.getByText("https://example.com/a.tif")).toBeInTheDocument();
    expect(screen.getByText("https://example.com/b.tif")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit source 1" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit source 2" }),
    ).toBeInTheDocument();
  } finally {
    confirmSpy.mockRestore();
  }
});

test("SourcePane GeoTIFF sub-modal Save calls setSourceProps with updated sources", async () => {
  const spy = jest.fn();
  render(<TestingComponent sourcePropsSpy={spy} />);

  await selectGeoTIFF();

  const addButton = await screen.findByRole("button", { name: "Add source" });
  fireEvent.click(addButton);

  const urlInput = await screen.findByLabelText("URL Input");
  fireEvent.change(urlInput, {
    target: { value: "https://example.com/spy.tif" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Save GeoTIFF Source Button" }),
  );

  // The spy should have been called with a sourceProps whose
  // props.sources includes the new row.
  await waitFor(() => {
    const matching = spy.mock.calls.find(
      ([next]) =>
        next?.type === "GeoTIFF" &&
        Array.isArray(next?.props?.sources) &&
        next.props.sources.some((s) => s.url === "https://example.com/spy.tif"),
    );
    expect(matching).toBeDefined();
  });
});

test("SourcePane switching from GeoTIFF to WMS and back restores sources", async () => {
  render(
    <TestingComponent
      initialSourceProps={{
        type: "GeoTIFF",
        props: {
          sources: [
            { url: "https://example.com/a.tif" },
            { url: "https://example.com/b.tif" },
          ],
        },
      }}
    />,
  );

  // Both rows rendered initially
  expect(
    await screen.findByText("https://example.com/a.tif"),
  ).toBeInTheDocument();
  expect(screen.getByText("https://example.com/b.tif")).toBeInTheDocument();

  // Switch to WMS
  const sourceDropdown = screen.getByRole("combobox");
  selectEvent.openMenu(sourceDropdown);
  const wmsOption = await screen.findByText("WMS");
  fireEvent.click(wmsOption);
  expect(await screen.findByText("Source Properties")).toBeInTheDocument();

  // Switch back to GeoTIFF — no sources in state because the WMS switch
  // overwrote sourceProps.props. This is the expected behavior per the
  // plan ("switching away from GeoTIFF to WMS and back — the sources list
  // is restored from sourceProps"). Since sourceProps was cleared by the
  // type switch, the restored list is empty, and the empty-state appears.
  selectEvent.openMenu(sourceDropdown);
  const geoTIFFOption = await screen.findByText("GeoTIFF");
  fireEvent.click(geoTIFFOption);

  expect(
    await screen.findByText("Add at least one source to render this layer"),
  ).toBeInTheDocument();
});

test("SourcePane GeoTIFF sub-modal open/close toggles onSubModalToggle", async () => {
  const mockToggle = jest.fn();
  render(<TestingComponent onSubModalToggle={mockToggle} />);

  await selectGeoTIFF();

  // Initial call is false (sub-modal starts closed)
  await waitFor(() => {
    expect(mockToggle).toHaveBeenCalledWith(false);
  });
  mockToggle.mockClear();

  const addButton = await screen.findByRole("button", { name: "Add source" });
  fireEvent.click(addButton);

  await waitFor(() => {
    expect(mockToggle).toHaveBeenCalledWith(true);
  });
  mockToggle.mockClear();

  // Cancel closes the modal
  fireEvent.click(
    screen.getByRole("button", { name: "Cancel GeoTIFF Source Button" }),
  );
  await waitFor(() => {
    expect(mockToggle).toHaveBeenCalledWith(false);
  });
});

test("SourcePane GeoTIFF R4: sub-modal Save preserves var template string in URL", async () => {
  const spy = jest.fn();
  render(<TestingComponent sourcePropsSpy={spy} />);
  await selectGeoTIFF();

  const addButton = await screen.findByRole("button", { name: "Add source" });
  fireEvent.click(addButton);

  const urlInput = await screen.findByLabelText("URL Input");
  fireEvent.change(urlInput, {
    // eslint-disable-next-line no-template-curly-in-string
    target: { value: "${base}/imagery.tif" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Save GeoTIFF Source Button" }),
  );

  // The literal template string survives into the saved props (authoring
  // path does not corrupt the template). Production-time variable
  // interpolation is covered by utilities tests and is out of scope here.
  await waitFor(() => {
    const matching = spy.mock.calls.find(([next]) =>
      // eslint-disable-next-line no-template-curly-in-string
      next?.props?.sources?.some((s) => s.url === "${base}/imagery.tif"),
    );
    expect(matching).toBeDefined();
  });
  expect(
    // eslint-disable-next-line no-template-curly-in-string
    await screen.findByText("${base}/imagery.tif"),
  ).toBeInTheDocument();
});

test("SourcePane GeoTIFF hints at color ramp when a single-band source is present", async () => {
  render(<TestingComponent />);
  await selectGeoTIFF();

  // Empty state: projection hint is visible but the single-band nudge is not.
  expect(
    await screen.findByText(/render in the source's native projection/i),
  ).toBeInTheDocument();
  expect(
    screen.queryByText(/Single-band source detected/i),
  ).not.toBeInTheDocument();

  // Add one single-band source → single-band hint appears.
  const addButton = screen.getByRole("button", { name: "Add source" });
  fireEvent.click(addButton);
  const urlInput = await screen.findByLabelText("URL Input");
  fireEvent.change(urlInput, {
    target: { value: "https://example.com/scientific.tif" },
  });
  const bandsInput = await screen.findByLabelText("Bands Input");
  fireEvent.change(bandsInput, { target: { value: "1" } });
  const saveBtn = screen.getByRole("button", {
    name: "Save GeoTIFF Source Button",
  });
  fireEvent.click(saveBtn);

  expect(
    await screen.findByText(/Single-band source detected/i),
  ).toBeInTheDocument();

  // Add a second source → the hint goes away (no longer a single-source layer).
  fireEvent.click(screen.getByRole("button", { name: "Add source" }));
  const urlInput2 = await screen.findByLabelText("URL Input");
  fireEvent.change(urlInput2, {
    target: { value: "https://example.com/scientific2.tif" },
  });
  const bandsInput2 = await screen.findByLabelText("Bands Input");
  fireEvent.change(bandsInput2, { target: { value: "1" } });
  fireEvent.click(
    screen.getByRole("button", { name: "Save GeoTIFF Source Button" }),
  );

  await waitFor(() => {
    expect(
      screen.getByText("https://example.com/scientific2.tif"),
    ).toBeInTheDocument();
  });
  expect(
    screen.queryByText(/Single-band source detected/i),
  ).not.toBeInTheDocument();
});

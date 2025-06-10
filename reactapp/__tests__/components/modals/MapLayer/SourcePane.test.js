import { useState } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SourcePane from "components/modals/MapLayer/SourcePane";
import selectEvent from "react-select-event";
import appAPI from "services/api/app";
import PropTypes from "prop-types";

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

const TestingComponent = ({ initialSourceProps }) => {
  const [sourceProps, setSourceProps] = useState(initialSourceProps ?? {});
  const [attributeProps, setAttributeProps] = useState({
    variables: {
      someLayer: { someField: "someVariable" },
    },
    omitted: {
      someLayer: ["someField"],
    },
  });

  return (
    <>
      <SourcePane
        sourceProps={sourceProps}
        setSourceProps={setSourceProps}
        setAttributeProps={setAttributeProps}
      />
      <p data-testid="sourceProps">{JSON.stringify(sourceProps)}</p>
      <p data-testid="attributeVariables">
        {JSON.stringify(attributeProps.variables)}
      </p>
      <p data-testid="omittedPopupAttributes">
        {JSON.stringify(attributeProps.omitted)}
      </p>
    </>
  );
};

test("SourcePane ImageArcGISRest", async () => {
  render(<TestingComponent />);

  expect(await screen.findByText("Source Type")).toBeInTheDocument();
  expect(await screen.findByTestId("sourceProps")).toHaveTextContent(
    JSON.stringify({})
  );
  expect(await screen.findByTestId("attributeVariables")).toHaveTextContent(
    JSON.stringify({
      someLayer: { someField: "someVariable" },
    })
  );
  expect(await screen.findByTestId("omittedPopupAttributes")).toHaveTextContent(
    JSON.stringify({
      someLayer: ["someField"],
    })
  );
  const sourceDropdown = screen.getByRole("combobox");

  selectEvent.openMenu(sourceDropdown);
  const sourceOption = await screen.findByText("ESRI Image and Map Service");
  fireEvent.click(sourceOption);
  expect(await screen.findByText("Source Properties")).toBeInTheDocument();
  expect(await screen.findByTestId("sourceProps")).toHaveTextContent(
    JSON.stringify({ type: "ESRI Image and Map Service", props: {} })
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
    })
  );

  const layerdefsInput = inputs[4];
  expect(layerdefsInput.placeholder).toBe(
    "Allows you to filter the features of individual layers"
  );
  fireEvent.change(layerdefsInput, {
    target: { value: "Some layerDef" },
  });
  expect(await screen.findByTestId("sourceProps")).toHaveTextContent(
    JSON.stringify({
      type: "ESRI Image and Map Service",
      props: { url: "Some Url", params: { LAYERDEFS: "Some layerDef" } },
    })
  );

  selectEvent.openMenu(sourceDropdown);
  const newSourceOption = await screen.findByText("WMS");
  fireEvent.click(newSourceOption);
  expect(await screen.findByTestId("sourceProps")).toHaveTextContent(
    JSON.stringify({
      type: "WMS",
      props: { url: "Some Url" },
    })
  );
});

test("SourcePane GeoJson Input", async () => {
  render(<TestingComponent />);

  expect(await screen.findByText("Source Type")).toBeInTheDocument();
  expect(await screen.findByTestId("sourceProps")).toHaveTextContent(
    JSON.stringify({})
  );
  const sourceDropdown = screen.getByRole("combobox");

  selectEvent.openMenu(sourceDropdown);
  const sourceOption = await screen.findByText("GeoJSON");
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
    })
  );
});

test("SourcePane GeoJson File Upload", async () => {
  render(<TestingComponent />);

  expect(await screen.findByText("Source Type")).toBeInTheDocument();
  expect(await screen.findByTestId("sourceProps")).toHaveTextContent(
    JSON.stringify({})
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
      })
    );
  });
});

test("SourcePane Updating Existing GeoJSON", async () => {
  const mockDownloadJSON = jest.fn();
  appAPI.downloadJSON = mockDownloadJSON;
  mockDownloadJSON.mockResolvedValue({ data: exampleGeoJSON });

  render(
    <TestingComponent
      initialSourceProps={{
        type: "GeoJSON",
        props: {},
        geojson: "some_file.json",
      }}
    />
  );

  expect(await screen.findByText("Source Type")).toBeInTheDocument();
  expect(await screen.findByTestId("sourceProps")).toHaveTextContent(
    JSON.stringify({
      type: "GeoJSON",
      props: {},
      geojson: "some_file.json",
    })
  );
  expect(await screen.findByText("Upload GeoJSON file")).toBeInTheDocument();
  await waitFor(async () => {
    expect(await screen.findByTestId("sourceProps")).toHaveTextContent(
      JSON.stringify({
        type: "GeoJSON",
        props: {},
        geojson: JSON.stringify(exampleGeoJSON),
      })
    );
  });
});

test("SourcePane Updating Existing VectorTiles", async () => {
  const mockDownloadJSON = jest.fn();
  appAPI.downloadJSON = mockDownloadJSON;
  mockDownloadJSON.mockResolvedValue({ data: exampleGeoJSON });

  render(
    <TestingComponent
      initialSourceProps={{
        type: "Vector Tile",
        props: {
          urls: ["some_url", "some_other_url"],
        },
      }}
    />
  );

  expect(await screen.findByText("Source Type")).toBeInTheDocument();
  expect(await screen.findByTestId("sourceProps")).toHaveTextContent(
    JSON.stringify({
      type: "Vector Tile",
      props: {
        urls: ["some_url", "some_other_url"],
      },
    })
  );

  expect(screen.getByText("*urls")).toBeInTheDocument();
  expect(screen.getByText("attributions")).toBeInTheDocument();
  expect(screen.getByText("projection")).toBeInTheDocument();

  const inputs = screen.getAllByRole("textbox");
  const urlsInput = inputs[0];
  expect(urlsInput.placeholder).toBe(
    "An comma separated list of URL templates. Must include {x}, {y} or {-y}, and {z} placeholders. A {?-?} template pattern, for example subdomain{a-f}.domain.com, may be used instead of defining each one separately in the urls option."
  );
  expect(urlsInput.value).toBe("some_url,some_other_url");
});

TestingComponent.propTypes = {
  initialSourceProps: PropTypes.object,
};

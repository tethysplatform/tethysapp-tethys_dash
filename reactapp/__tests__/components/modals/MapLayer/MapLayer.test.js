import PropTypes from "prop-types";
import {
  render,
  screen,
  fireEvent,
  within,
  waitFor,
} from "@testing-library/react";
import selectEvent from "react-select-event";
import MapLayerModal from "components/modals/MapLayer/MapLayer";
import { AppContext } from "components/contexts/Contexts";
import appAPI from "services/api/app";
import { getLayerAttributes } from "components/map/utilities";

jest.mock("uuid", () => ({
  v4: () => 12345678,
}));

jest.mock("components/map/utilities", () => {
  const originalModule = jest.requireActual("components/map/utilities");
  return {
    ...originalModule,
    getLayerAttributes: jest.fn(),
  };
});
const mockedGetLayerAttributes = jest.mocked(getLayerAttributes);

global.crypto = {
  getRandomValues: (arr) => {
    return arr.map(() => Math.floor(Math.random() * 256));
  },
};

const TestingComponent = ({
  showModal,
  handleModalClose,
  addMapLayer,
  layerInfo,
  mapLayers,
  existingLayerOriginalName,
}) => {
  const csrf = "asdasdasdasd";
  const appContext = {
    csrf,
  };

  return (
    <>
      <AppContext.Provider value={appContext}>
        <MapLayerModal
          showModal={showModal}
          handleModalClose={handleModalClose}
          addMapLayer={addMapLayer}
          layerInfo={layerInfo}
          mapLayers={mapLayers}
          existingLayerOriginalName={existingLayerOriginalName}
        />
      </AppContext.Provider>
    </>
  );
};

test("MapLayerModal new ImageArcGISRest layer", async () => {
  const handleModalClose = jest.fn();
  const addMapLayer = jest.fn();
  const layerInfo = {};
  const mapLayers = [];
  const existingLayerOriginalName = { current: null };
  render(
    <TestingComponent
      showModal={true}
      handleModalClose={handleModalClose}
      addMapLayer={addMapLayer}
      layerInfo={layerInfo}
      mapLayers={mapLayers}
      existingLayerOriginalName={existingLayerOriginalName}
    />
  );

  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  expect(screen.getByText("Add Map Layer")).toBeInTheDocument();
  expect(screen.getByText("Layer")).toBeInTheDocument();
  expect(screen.getByText("Source")).toBeInTheDocument();
  expect(screen.getByText("Style")).toBeInTheDocument();
  expect(screen.getByText("Legend")).toBeInTheDocument();
  expect(screen.getByText("Attributes/Popup")).toBeInTheDocument();

  const nameInput = await screen.findByLabelText("Name Input");
  fireEvent.change(nameInput, { target: { value: "New Layer Name" } });

  const sourceTab = screen.getByText("Source");
  fireEvent.click(sourceTab);
  const sourceTabContent = screen.getByLabelText("layer-source-tab");
  const sourceDropdown = screen.getByRole("combobox");

  selectEvent.openMenu(sourceDropdown);
  const sourceOption = await screen.findByText("ImageArcGISRest");
  fireEvent.click(sourceOption);
  expect(await screen.findByText("Source Properties")).toBeInTheDocument();

  const urlInput = within(sourceTabContent).getByLabelText("value Input 0");
  fireEvent.change(urlInput, { target: { value: "Some Url" } });

  const createLayerButton = await screen.findByLabelText("Create Layer Button");
  fireEvent.click(createLayerButton);

  expect(addMapLayer).toHaveBeenCalledWith({
    configuration: {
      props: {
        name: "New Layer Name",
        source: {
          props: {
            url: "Some Url",
          },
          type: "ImageArcGISRest",
        },
      },
      type: "ImageLayer",
    },
  });
});

test("MapLayerModal new ImageWMS layer", async () => {
  const handleModalClose = jest.fn();
  const addMapLayer = jest.fn();
  const layerInfo = {};
  const mapLayers = [];
  const existingLayerOriginalName = { current: null };
  render(
    <TestingComponent
      showModal={true}
      handleModalClose={handleModalClose}
      addMapLayer={addMapLayer}
      layerInfo={layerInfo}
      mapLayers={mapLayers}
      existingLayerOriginalName={existingLayerOriginalName}
    />
  );

  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  expect(screen.getByText("Add Map Layer")).toBeInTheDocument();
  expect(screen.getByText("Layer")).toBeInTheDocument();
  expect(screen.getByText("Source")).toBeInTheDocument();
  expect(screen.getByText("Style")).toBeInTheDocument();
  expect(screen.getByText("Legend")).toBeInTheDocument();
  expect(screen.getByText("Attributes/Popup")).toBeInTheDocument();

  const nameInput = await screen.findByLabelText("Name Input");
  fireEvent.change(nameInput, { target: { value: "New Layer Name" } });

  const sourceTab = screen.getByText("Source");
  fireEvent.click(sourceTab);
  const sourceTabContent = screen.getByLabelText("layer-source-tab");
  const sourceDropdown = screen.getByRole("combobox");

  selectEvent.openMenu(sourceDropdown);
  const sourceOption = await screen.findByText("ImageWMS");
  fireEvent.click(sourceOption);
  expect(await screen.findByText("Source Properties")).toBeInTheDocument();

  const urlInput = within(sourceTabContent).getByLabelText("value Input 0");
  fireEvent.change(urlInput, { target: { value: "Some Url" } });

  const layersInput = within(sourceTabContent).getByLabelText("value Input 1");
  fireEvent.change(layersInput, {
    target: { value: "some:layer,some:layer2" },
  });

  const createLayerButton = await screen.findByLabelText("Create Layer Button");
  fireEvent.click(createLayerButton);

  expect(addMapLayer).toHaveBeenCalledWith({
    configuration: {
      props: {
        name: "New Layer Name",
        source: {
          props: {
            url: "Some Url",
            params: { LAYERS: "some:layer,some:layer2" },
          },
          type: "ImageWMS",
        },
      },
      type: "ImageLayer",
    },
  });
});

test("MapLayerModal new GeoJSON layer", async () => {
  const mockUploadJSON = jest.fn();
  appAPI.uploadJSON = mockUploadJSON;
  mockUploadJSON.mockResolvedValue({ success: true });

  const handleModalClose = jest.fn();
  const addMapLayer = jest.fn();
  const layerInfo = {};
  const mapLayers = [];
  const existingLayerOriginalName = { current: null };
  render(
    <TestingComponent
      showModal={true}
      handleModalClose={handleModalClose}
      addMapLayer={addMapLayer}
      layerInfo={layerInfo}
      mapLayers={mapLayers}
      existingLayerOriginalName={existingLayerOriginalName}
    />
  );

  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  expect(screen.getByText("Add Map Layer")).toBeInTheDocument();
  expect(screen.getByText("Layer")).toBeInTheDocument();
  expect(screen.getByText("Source")).toBeInTheDocument();
  expect(screen.getByText("Style")).toBeInTheDocument();
  expect(screen.getByText("Legend")).toBeInTheDocument();
  expect(screen.getByText("Attributes/Popup")).toBeInTheDocument();

  const nameInput = await screen.findByLabelText("Name Input");
  fireEvent.change(nameInput, { target: { value: "New Layer Name" } });

  const sourceTab = screen.getByText("Source");
  fireEvent.click(sourceTab);
  const sourceDropdown = screen.getByRole("combobox");

  selectEvent.openMenu(sourceDropdown);
  const sourceOption = await screen.findByText("GeoJSON");
  fireEvent.click(sourceOption);
  expect(await screen.findByText("Upload GeoJSON file")).toBeInTheDocument();
  expect(screen.queryByText("Source Properties")).not.toBeInTheDocument();

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

  const textArea = screen.getByLabelText("geojson-source-text-area");
  fireEvent.change(textArea, {
    target: { value: "{'dd':}" },
  });

  const createLayerButton = await screen.findByLabelText("Create Layer Button");
  fireEvent.click(createLayerButton);

  expect(
    await screen.findByText(
      "Invalid GeoJSON is being used. Please alter the json and try again."
    )
  ).toBeInTheDocument();

  fireEvent.change(textArea, {
    target: {
      value: JSON.stringify({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [0, 0],
            },
          },
        ],
      }),
    },
  });

  fireEvent.click(createLayerButton);

  expect(
    await screen.findByText(
      'GeoJSON must include a crs key with the structure {"properties": {"name": "EPSG:<CODE>"}}'
    )
  ).toBeInTheDocument();

  fireEvent.change(textArea, {
    target: { value: JSON.stringify(exampleGeoJSON) },
  });

  fireEvent.click(createLayerButton);

  await waitFor(() => {
    expect(addMapLayer).toHaveBeenCalledWith({
      configuration: {
        props: {
          name: "New Layer Name",
          source: {
            geojson: "12345678.json",
            props: {},
            type: "GeoJSON",
          },
        },
        type: "VectorLayer",
      },
    });
  });
});

test("MapLayerModal new ImageTile layer", async () => {
  const handleModalClose = jest.fn();
  const addMapLayer = jest.fn();
  const layerInfo = {};
  const mapLayers = [];
  const existingLayerOriginalName = { current: null };
  render(
    <TestingComponent
      showModal={true}
      handleModalClose={handleModalClose}
      addMapLayer={addMapLayer}
      layerInfo={layerInfo}
      mapLayers={mapLayers}
      existingLayerOriginalName={existingLayerOriginalName}
    />
  );

  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  expect(screen.getByText("Add Map Layer")).toBeInTheDocument();
  expect(screen.getByText("Layer")).toBeInTheDocument();
  expect(screen.getByText("Source")).toBeInTheDocument();
  expect(screen.getByText("Style")).toBeInTheDocument();
  expect(screen.getByText("Legend")).toBeInTheDocument();
  expect(screen.getByText("Attributes/Popup")).toBeInTheDocument();

  const nameInput = await screen.findByLabelText("Name Input");
  fireEvent.change(nameInput, { target: { value: "New Layer Name" } });

  const sourceTab = screen.getByText("Source");
  fireEvent.click(sourceTab);
  const sourceTabContent = screen.getByLabelText("layer-source-tab");
  const sourceDropdown = screen.getByRole("combobox");

  selectEvent.openMenu(sourceDropdown);
  const sourceOption = await screen.findByText("ImageTile");
  fireEvent.click(sourceOption);
  expect(await screen.findByText("Source Properties")).toBeInTheDocument();

  const urlInput = within(sourceTabContent).getByLabelText("value Input 0");
  fireEvent.change(urlInput, {
    target: { value: "https://tile.openstreetmap.org/{z}/{x}/{y}.png" },
  });

  const createLayerButton = await screen.findByLabelText("Create Layer Button");
  fireEvent.click(createLayerButton);

  expect(addMapLayer).toHaveBeenCalledWith({
    configuration: {
      props: {
        name: "New Layer Name",
        source: {
          props: {
            url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          },
          type: "ImageTile",
        },
      },
      type: "TileLayer",
    },
  });
});

test("MapLayerModal new VectorTile layer", async () => {
  const handleModalClose = jest.fn();
  const addMapLayer = jest.fn();
  const layerInfo = {};
  const mapLayers = [];
  const existingLayerOriginalName = { current: null };
  render(
    <TestingComponent
      showModal={true}
      handleModalClose={handleModalClose}
      addMapLayer={addMapLayer}
      layerInfo={layerInfo}
      mapLayers={mapLayers}
      existingLayerOriginalName={existingLayerOriginalName}
    />
  );

  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  expect(screen.getByText("Add Map Layer")).toBeInTheDocument();
  expect(screen.getByText("Layer")).toBeInTheDocument();
  expect(screen.getByText("Source")).toBeInTheDocument();
  expect(screen.getByText("Style")).toBeInTheDocument();
  expect(screen.getByText("Legend")).toBeInTheDocument();
  expect(screen.getByText("Attributes/Popup")).toBeInTheDocument();

  const nameInput = await screen.findByLabelText("Name Input");
  fireEvent.change(nameInput, { target: { value: "New Layer Name" } });

  const sourceTab = screen.getByText("Source");
  fireEvent.click(sourceTab);
  const sourceTabContent = screen.getByLabelText("layer-source-tab");
  const sourceDropdown = screen.getByRole("combobox");

  selectEvent.openMenu(sourceDropdown);
  const sourceOption = await screen.findByText("VectorTile");
  fireEvent.click(sourceOption);
  expect(await screen.findByText("Source Properties")).toBeInTheDocument();

  const urlInput = within(sourceTabContent).getByLabelText("value Input 0");
  fireEvent.change(urlInput, { target: { value: "some_url,some_other_url" } });

  const createLayerButton = await screen.findByLabelText("Create Layer Button");
  fireEvent.click(createLayerButton);

  expect(addMapLayer).toHaveBeenCalledWith({
    configuration: {
      props: {
        name: "New Layer Name",
        source: {
          props: {
            urls: ["some_url", "some_other_url"],
          },
          type: "VectorTile",
        },
      },
      type: "VectorTileLayer",
    },
  });
});

test("MapLayerModal no name error", async () => {
  const handleModalClose = jest.fn();
  const addMapLayer = jest.fn();
  const layerInfo = {};
  const mapLayers = [];
  const existingLayerOriginalName = { current: null };
  render(
    <TestingComponent
      showModal={true}
      handleModalClose={handleModalClose}
      addMapLayer={addMapLayer}
      layerInfo={layerInfo}
      mapLayers={mapLayers}
      existingLayerOriginalName={existingLayerOriginalName}
    />
  );

  const createLayerButton = await screen.findByLabelText("Create Layer Button");
  fireEvent.click(createLayerButton);

  expect(
    await screen.findByText(
      "Layer type and name must be provided in the configuration pane."
    )
  ).toBeInTheDocument();
});

test("MapLayerModal missing required properties", async () => {
  const handleModalClose = jest.fn();
  const addMapLayer = jest.fn();
  const layerInfo = {};
  const mapLayers = [];
  const existingLayerOriginalName = { current: null };
  render(
    <TestingComponent
      showModal={true}
      handleModalClose={handleModalClose}
      addMapLayer={addMapLayer}
      layerInfo={layerInfo}
      mapLayers={mapLayers}
      existingLayerOriginalName={existingLayerOriginalName}
    />
  );

  const nameInput = await screen.findByLabelText("Name Input");
  fireEvent.change(nameInput, { target: { value: "New Layer Name" } });

  const sourceTab = screen.getByText("Source");
  fireEvent.click(sourceTab);
  const sourceTabContent = screen.getByLabelText("layer-source-tab");
  const sourceDropdown = screen.getByRole("combobox");

  selectEvent.openMenu(sourceDropdown);
  const sourceOption = await screen.findByText("ImageWMS");
  fireEvent.click(sourceOption);
  expect(await screen.findByText("Source Properties")).toBeInTheDocument();

  const urlInput = within(sourceTabContent).getByLabelText("value Input 0");
  fireEvent.change(urlInput, { target: { value: "Some Url" } });

  const createLayerButton = await screen.findByLabelText("Create Layer Button");
  fireEvent.click(createLayerButton);

  expect(
    await screen.findByText(
      "Missing required params arguments. Please check the configuration and try again."
    )
  ).toBeInTheDocument();
});

test("MapLayerModal attribute variables and omitted popups", async () => {
  mockedGetLayerAttributes.mockResolvedValue({
    "New Layer Name": [
      { name: "the_geom", alias: "the_geom" },
      { name: "STATE_NAME", alias: "STATE_NAME" },
    ],
  });

  const handleModalClose = jest.fn();
  const addMapLayer = jest.fn();
  const layerInfo = {};
  const mapLayers = [];
  const existingLayerOriginalName = { current: null };
  render(
    <TestingComponent
      showModal={true}
      handleModalClose={handleModalClose}
      addMapLayer={addMapLayer}
      layerInfo={layerInfo}
      mapLayers={mapLayers}
      existingLayerOriginalName={existingLayerOriginalName}
    />
  );

  const nameInput = await screen.findByLabelText("Name Input");
  fireEvent.change(nameInput, { target: { value: "New Layer Name" } });

  const sourceTab = screen.getByText("Source");
  fireEvent.click(sourceTab);
  const sourceTabContent = screen.getByLabelText("layer-source-tab");
  const sourceDropdown = screen.getByRole("combobox");

  selectEvent.openMenu(sourceDropdown);
  const sourceOption = await screen.findByText("ImageArcGISRest");
  fireEvent.click(sourceOption);
  expect(await screen.findByText("Source Properties")).toBeInTheDocument();

  const urlInput = within(sourceTabContent).getByLabelText("value Input 0");
  fireEvent.change(urlInput, { target: { value: "Some Url" } });

  const attributesTab = screen.getByText("Attributes/Popup");
  fireEvent.click(attributesTab);

  expect(await screen.findByText("New Layer Name")).toBeInTheDocument();
  const attributesTabContent = screen.getByLabelText("layer-attributes-tab");
  const variableInput = within(attributesTabContent).getAllByRole("textbox")[0];
  fireEvent.change(variableInput, { target: { value: "Some Variable" } });
  const popupCheckbox =
    within(attributesTabContent).getAllByRole("checkbox")[1];
  fireEvent.click(popupCheckbox);

  const createLayerButton = await screen.findByLabelText("Create Layer Button");
  fireEvent.click(createLayerButton);

  expect(addMapLayer).toHaveBeenCalledWith({
    attributeVariables: {
      "New Layer Name": {
        the_geom: "Some Variable",
      },
    },
    omittedPopupAttributes: {
      "New Layer Name": ["the_geom"],
    },
    configuration: {
      props: {
        name: "New Layer Name",
        source: {
          props: {
            url: "Some Url",
          },
          type: "ImageArcGISRest",
        },
      },
      type: "ImageLayer",
    },
  });
});

test("MapLayerModal duplicate attribute variables in other layer", async () => {
  mockedGetLayerAttributes.mockResolvedValue({
    "New Layer Name": [
      { name: "the_geom", alias: "the_geom" },
      { name: "STATE_NAME", alias: "STATE_NAME" },
    ],
  });

  const handleModalClose = jest.fn();
  const addMapLayer = jest.fn();
  const layerInfo = {};
  const mapLayers = [
    {
      attributeVariables: {
        "Some Layer": {
          the_geom: "Some Variable",
        },
      },
      configuration: {
        props: {
          name: "Some Layer",
          source: {
            props: {
              url: "Some Url",
            },
            type: "ImageArcGISRest",
          },
        },
        type: "ImageLayer",
      },
    },
  ];
  const existingLayerOriginalName = { current: null };
  render(
    <TestingComponent
      showModal={true}
      handleModalClose={handleModalClose}
      addMapLayer={addMapLayer}
      layerInfo={layerInfo}
      mapLayers={mapLayers}
      existingLayerOriginalName={existingLayerOriginalName}
    />
  );

  const nameInput = await screen.findByLabelText("Name Input");
  fireEvent.change(nameInput, { target: { value: "New Layer Name" } });

  const sourceTab = screen.getByText("Source");
  fireEvent.click(sourceTab);
  const sourceTabContent = screen.getByLabelText("layer-source-tab");
  const sourceDropdown = screen.getByRole("combobox");

  selectEvent.openMenu(sourceDropdown);
  const sourceOption = await screen.findByText("ImageArcGISRest");
  fireEvent.click(sourceOption);
  expect(await screen.findByText("Source Properties")).toBeInTheDocument();

  const urlInput = within(sourceTabContent).getByLabelText("value Input 0");
  fireEvent.change(urlInput, { target: { value: "Some Url" } });

  const attributesTab = screen.getByText("Attributes/Popup");
  fireEvent.click(attributesTab);

  expect(await screen.findByText("New Layer Name")).toBeInTheDocument();
  const attributesTabContent = screen.getByLabelText("layer-attributes-tab");
  const variableInput = within(attributesTabContent).getAllByRole("textbox")[0];
  fireEvent.change(variableInput, { target: { value: "Some Variable" } });
  const popupCheckbox =
    within(attributesTabContent).getAllByRole("checkbox")[1];
  fireEvent.click(popupCheckbox);

  const createLayerButton = await screen.findByLabelText("Create Layer Button");
  fireEvent.click(createLayerButton);

  expect(
    await screen.findByText(
      "The following variable inputs are already in use in the map:"
    )
  ).toBeInTheDocument();

  expect(await screen.findByText("Some Variable")).toBeInTheDocument();

  expect(
    await screen.findByText(
      "Check the other map layers and change the Variable Input names in the Attributes tab before trying again."
    )
  ).toBeInTheDocument();
  expect(addMapLayer).toHaveBeenCalledTimes(0);
});

test("MapLayerModal duplicate variable in same map layer", async () => {
  mockedGetLayerAttributes.mockResolvedValue({
    "New Layer Name": [
      { name: "the_geom", alias: "the_geom" },
      { name: "STATE_NAME", alias: "STATE_NAME" },
    ],
  });

  const handleModalClose = jest.fn();
  const addMapLayer = jest.fn();
  const layerInfo = {};
  const mapLayers = [];
  const existingLayerOriginalName = { current: null };
  render(
    <TestingComponent
      showModal={true}
      handleModalClose={handleModalClose}
      addMapLayer={addMapLayer}
      layerInfo={layerInfo}
      mapLayers={mapLayers}
      existingLayerOriginalName={existingLayerOriginalName}
    />
  );

  const nameInput = await screen.findByLabelText("Name Input");
  fireEvent.change(nameInput, { target: { value: "New Layer Name" } });

  const sourceTab = screen.getByText("Source");
  fireEvent.click(sourceTab);
  const sourceTabContent = screen.getByLabelText("layer-source-tab");
  const sourceDropdown = screen.getByRole("combobox");

  selectEvent.openMenu(sourceDropdown);
  const sourceOption = await screen.findByText("ImageArcGISRest");
  fireEvent.click(sourceOption);
  expect(await screen.findByText("Source Properties")).toBeInTheDocument();

  const urlInput = within(sourceTabContent).getByLabelText("value Input 0");
  fireEvent.change(urlInput, { target: { value: "Some Url" } });

  const attributesTab = screen.getByText("Attributes/Popup");
  fireEvent.click(attributesTab);

  expect(await screen.findByText("New Layer Name")).toBeInTheDocument();
  const attributesTabContent = screen.getByLabelText("layer-attributes-tab");

  const variableInput1 =
    within(attributesTabContent).getAllByRole("textbox")[0];
  fireEvent.change(variableInput1, { target: { value: "Some Variable" } });

  const variableInput2 =
    within(attributesTabContent).getAllByRole("textbox")[1];
  fireEvent.change(variableInput2, { target: { value: "Some Variable" } });

  const popupCheckbox =
    within(attributesTabContent).getAllByRole("checkbox")[1];
  fireEvent.click(popupCheckbox);

  const createLayerButton = await screen.findByLabelText("Create Layer Button");
  fireEvent.click(createLayerButton);

  expect(
    await screen.findByText("The following variable inputs are duplicated:")
  ).toBeInTheDocument();

  expect(await screen.findByText("Some Variable")).toBeInTheDocument();

  expect(
    await screen.findByText(
      "Change the Variable Input Names in the Attributes tab before trying again."
    )
  ).toBeInTheDocument();
  expect(addMapLayer).toHaveBeenCalledTimes(0);
});

test("MapLayerModal legend", async () => {
  const handleModalClose = jest.fn();
  const addMapLayer = jest.fn();
  const layerInfo = {};
  const mapLayers = [];
  const existingLayerOriginalName = { current: null };
  render(
    <TestingComponent
      showModal={true}
      handleModalClose={handleModalClose}
      addMapLayer={addMapLayer}
      layerInfo={layerInfo}
      mapLayers={mapLayers}
      existingLayerOriginalName={existingLayerOriginalName}
    />
  );

  const nameInput = await screen.findByLabelText("Name Input");
  fireEvent.change(nameInput, { target: { value: "New Layer Name" } });

  const sourceTab = screen.getByText("Source");
  fireEvent.click(sourceTab);
  const sourceTabContent = screen.getByLabelText("layer-source-tab");
  const sourceDropdown = screen.getByRole("combobox");

  selectEvent.openMenu(sourceDropdown);
  const sourceOption = await screen.findByText("ImageArcGISRest");
  fireEvent.click(sourceOption);
  expect(await screen.findByText("Source Properties")).toBeInTheDocument();

  const urlInput = within(sourceTabContent).getByLabelText("value Input 0");
  fireEvent.change(urlInput, { target: { value: "Some Url" } });

  const legendTab = screen.getByText("Legend");
  fireEvent.click(legendTab);

  expect(await screen.findByText("Legend Control")).toBeInTheDocument();
  const onRadio = screen.getByLabelText("Show legend for layer");
  fireEvent.click(onRadio);

  const addRowButton = await screen.findByLabelText("Add Legend Item Button");
  fireEvent.click(addRowButton);

  const createLayerButton = await screen.findByLabelText("Create Layer Button");
  fireEvent.click(createLayerButton);

  expect(
    await screen.findByText(
      "Provide a legend title if showing a legend for this layer"
    )
  ).toBeInTheDocument();

  const legendTabContent = screen.getByLabelText("layer-legend-tab");
  const legendTitle = within(legendTabContent).getAllByRole("textbox")[0];
  fireEvent.change(legendTitle, { target: { value: "Some Title" } });

  fireEvent.click(createLayerButton);

  expect(
    await screen.findByText(
      "All Legend Items must have a label, color, and symbol"
    )
  ).toBeInTheDocument();

  const legendItemLabel = within(legendTabContent).getAllByRole("textbox")[1];
  fireEvent.change(legendItemLabel, { target: { value: "Some Label" } });

  fireEvent.click(createLayerButton);

  expect(addMapLayer).toHaveBeenCalledWith({
    configuration: {
      props: {
        name: "New Layer Name",
        source: {
          props: {
            url: "Some Url",
          },
          type: "ImageArcGISRest",
        },
      },
      type: "ImageLayer",
    },
    legend: {
      items: [
        {
          color: "#ff0000",
          label: "Some Label",
          symbol: "square",
        },
      ],
      title: "Some Title",
    },
  });
});

test("MapLayerModal new GeoJSON layer api fail", async () => {
  const mockUploadJSON = jest.fn();
  appAPI.uploadJSON = mockUploadJSON;
  mockUploadJSON.mockResolvedValue({ success: false });

  const handleModalClose = jest.fn();
  const addMapLayer = jest.fn();
  const layerInfo = {};
  const mapLayers = [];
  const existingLayerOriginalName = { current: null };
  render(
    <TestingComponent
      showModal={true}
      handleModalClose={handleModalClose}
      addMapLayer={addMapLayer}
      layerInfo={layerInfo}
      mapLayers={mapLayers}
      existingLayerOriginalName={existingLayerOriginalName}
    />
  );

  const nameInput = await screen.findByLabelText("Name Input");
  fireEvent.change(nameInput, { target: { value: "New Layer Name" } });

  const sourceTab = screen.getByText("Source");
  fireEvent.click(sourceTab);
  const sourceDropdown = screen.getByRole("combobox");

  selectEvent.openMenu(sourceDropdown);
  const sourceOption = await screen.findByText("GeoJSON");
  fireEvent.click(sourceOption);
  expect(await screen.findByText("Upload GeoJSON file")).toBeInTheDocument();
  expect(screen.queryByText("Source Properties")).not.toBeInTheDocument();

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

  const textArea = screen.getByLabelText("geojson-source-text-area");
  fireEvent.change(textArea, {
    target: { value: JSON.stringify(exampleGeoJSON) },
  });

  const createLayerButton = await screen.findByLabelText("Create Layer Button");
  fireEvent.click(createLayerButton);

  expect(
    await screen.findByText(
      "Failed to upload the json data. Check logs for more information."
    )
  ).toBeInTheDocument();
  expect(addMapLayer).toHaveBeenCalledTimes(0);
});

test("MapLayerModal style", async () => {
  const mockUploadJSON = jest.fn();
  appAPI.uploadJSON = mockUploadJSON;
  mockUploadJSON.mockResolvedValue({ success: true });

  const handleModalClose = jest.fn();
  const addMapLayer = jest.fn();
  const layerInfo = {};
  const mapLayers = [];
  const existingLayerOriginalName = { current: null };
  render(
    <TestingComponent
      showModal={true}
      handleModalClose={handleModalClose}
      addMapLayer={addMapLayer}
      layerInfo={layerInfo}
      mapLayers={mapLayers}
      existingLayerOriginalName={existingLayerOriginalName}
    />
  );

  const nameInput = await screen.findByLabelText("Name Input");
  fireEvent.change(nameInput, { target: { value: "New Layer Name" } });

  const sourceTab = screen.getByText("Source");
  fireEvent.click(sourceTab);
  const sourceTabContent = screen.getByLabelText("layer-source-tab");
  const sourceDropdown = screen.getByRole("combobox");

  selectEvent.openMenu(sourceDropdown);
  const sourceOption = await screen.findByText("ImageArcGISRest");
  fireEvent.click(sourceOption);
  expect(await screen.findByText("Source Properties")).toBeInTheDocument();

  const urlInput = within(sourceTabContent).getByLabelText("value Input 0");
  fireEvent.change(urlInput, { target: { value: "Some Url" } });

  const styleTab = screen.getByText("Style");
  fireEvent.click(styleTab);

  expect(await screen.findByText("Upload style file")).toBeInTheDocument();

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

  const textArea = screen.getByLabelText("style-text-area");
  fireEvent.change(textArea, {
    target: { value: "{'dd':}" },
  });

  const createLayerButton = await screen.findByLabelText("Create Layer Button");
  fireEvent.click(createLayerButton);

  expect(
    await screen.findByText(
      "Invalid style json is being used. Please alter the json and try again."
    )
  ).toBeInTheDocument();

  fireEvent.change(textArea, {
    target: { value: JSON.stringify(exampleStyle) },
  });

  fireEvent.click(createLayerButton);

  await waitFor(() => {
    expect(addMapLayer).toHaveBeenCalledWith({
      configuration: {
        props: {
          name: "New Layer Name",
          source: {
            props: {
              url: "Some Url",
            },
            type: "ImageArcGISRest",
          },
        },
        type: "ImageLayer",
      },
      style: "12345678.json",
    });
  });
});

test("MapLayerModal style api fail", async () => {
  const mockUploadJSON = jest.fn();
  appAPI.uploadJSON = mockUploadJSON;
  mockUploadJSON.mockResolvedValue({ success: false });

  const handleModalClose = jest.fn();
  const addMapLayer = jest.fn();
  const layerInfo = {};
  const mapLayers = [];
  const existingLayerOriginalName = { current: null };
  render(
    <TestingComponent
      showModal={true}
      handleModalClose={handleModalClose}
      addMapLayer={addMapLayer}
      layerInfo={layerInfo}
      mapLayers={mapLayers}
      existingLayerOriginalName={existingLayerOriginalName}
    />
  );

  const nameInput = await screen.findByLabelText("Name Input");
  fireEvent.change(nameInput, { target: { value: "New Layer Name" } });

  const sourceTab = screen.getByText("Source");
  fireEvent.click(sourceTab);
  const sourceTabContent = screen.getByLabelText("layer-source-tab");
  const sourceDropdown = screen.getByRole("combobox");

  selectEvent.openMenu(sourceDropdown);
  const sourceOption = await screen.findByText("ImageArcGISRest");
  fireEvent.click(sourceOption);
  expect(await screen.findByText("Source Properties")).toBeInTheDocument();

  const urlInput = within(sourceTabContent).getByLabelText("value Input 0");
  fireEvent.change(urlInput, { target: { value: "Some Url" } });

  const styleTab = screen.getByText("Style");
  fireEvent.click(styleTab);

  expect(await screen.findByText("Upload style file")).toBeInTheDocument();

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

  const textArea = screen.getByLabelText("style-text-area");
  fireEvent.change(textArea, {
    target: { value: JSON.stringify(exampleStyle) },
  });

  const createLayerButton = await screen.findByLabelText("Create Layer Button");
  fireEvent.click(createLayerButton);

  expect(
    await screen.findByText(
      "Failed to upload the json data. Check logs for more information."
    )
  ).toBeInTheDocument();

  const closeAlert = screen.getByLabelText("Close alert");
  fireEvent.click(closeAlert);

  expect(
    screen.queryByText(
      "Failed to upload the json data. Check logs for more information."
    )
  ).not.toBeInTheDocument();

  expect(addMapLayer).toHaveBeenCalledTimes(0);
});

test("MapLayerModal update ImageArcGISRest layer", async () => {
  mockedGetLayerAttributes.mockResolvedValue({
    "New Layer Name": [
      { name: "the_geom", alias: "the_geom" },
      { name: "STATE_NAME", alias: "STATE_NAME" },
    ],
  });

  const handleModalClose = jest.fn();
  const addMapLayer = jest.fn();
  const layerInfo = {
    layerProps: {
      name: "New Layer Name",
    },
    sourceProps: {
      props: {
        url: "Some Url",
      },
      type: "ImageArcGISRest",
    },
    attributeVariables: {
      "New Layer Name": {
        the_geom: "Some Variable",
      },
    },
  };
  const mapLayers = [
    {
      configuration: {
        props: {
          name: "New Layer Name",
          source: {
            props: {
              url: "Some Url",
            },
            type: "ImageArcGISRest",
          },
        },
        type: "ImageLayer",
      },
      attributeVariables: {
        "New Layer Name": {
          the_geom: "Some Variable",
        },
      },
    },
  ];
  const existingLayerOriginalName = { current: "New Layer Name" };
  render(
    <TestingComponent
      showModal={true}
      handleModalClose={handleModalClose}
      addMapLayer={addMapLayer}
      layerInfo={layerInfo}
      mapLayers={mapLayers}
      existingLayerOriginalName={existingLayerOriginalName}
    />
  );

  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  expect(screen.getByText("Add Map Layer")).toBeInTheDocument();
  expect(screen.getByText("Layer")).toBeInTheDocument();
  expect(screen.getByText("Source")).toBeInTheDocument();
  expect(screen.getByText("Style")).toBeInTheDocument();
  expect(screen.getByText("Legend")).toBeInTheDocument();
  expect(screen.getByText("Attributes/Popup")).toBeInTheDocument();

  const nameInput = await screen.findByLabelText("Name Input");
  fireEvent.change(nameInput, { target: { value: "New Layer Name" } });

  const sourceTab = screen.getByText("Source");
  fireEvent.click(sourceTab);
  const sourceTabContent = screen.getByLabelText("layer-source-tab");
  const sourceDropdown = screen.getByRole("combobox");

  selectEvent.openMenu(sourceDropdown);
  const sourceOption = await screen.findByText("ImageArcGISRest");
  fireEvent.click(sourceOption);
  expect(await screen.findByText("Source Properties")).toBeInTheDocument();

  const urlInput = within(sourceTabContent).getByLabelText("value Input 0");
  fireEvent.change(urlInput, { target: { value: "Some Url" } });

  const attributesTab = screen.getByText("Attributes/Popup");
  fireEvent.click(attributesTab);

  expect(await screen.findByText("New Layer Name")).toBeInTheDocument();
  const attributesTabContent = screen.getByLabelText("layer-attributes-tab");

  const variableInput1 =
    within(attributesTabContent).getAllByRole("textbox")[0];
  fireEvent.change(variableInput1, { target: { value: "Some New Variable" } });

  const createLayerButton = await screen.findByLabelText("Create Layer Button");
  fireEvent.click(createLayerButton);

  expect(addMapLayer).toHaveBeenCalledWith({
    configuration: {
      props: {
        name: "New Layer Name",
        source: {
          props: {
            url: "Some Url",
          },
          type: "ImageArcGISRest",
        },
      },
      type: "ImageLayer",
    },
    attributeVariables: {
      "New Layer Name": {
        the_geom: "Some New Variable",
      },
    },
  });
});

TestingComponent.propTypes = {
  showModal: PropTypes.bool,
  handleModalClose: PropTypes.func,
  addMapLayer: PropTypes.func,
  layerInfo: PropTypes.object,
  mapLayers: PropTypes.array,
  existingLayerOriginalName: PropTypes.object,
};

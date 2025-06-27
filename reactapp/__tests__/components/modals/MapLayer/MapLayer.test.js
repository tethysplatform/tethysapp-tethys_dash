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
import { server } from "__tests__/utilities/server";
import { rest } from "msw";
import { fullMapLayer } from "__tests__/utilities/constants";

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
}) => {
  const csrf = "asdasdasdasd";
  const mapLayerTemplates = [
    {
      source: "template_map_layer_example",
      value: "Map Layer Template Example",
      label: "Map Layer Template Example",
      args: {},
      type: "map_layer",
      tags: ["map_layer"],
      description: "An example plugin for the map layer template",
    },
  ];
  const appContext = {
    csrf,
    mapLayerTemplates,
  };

  return (
    <>
      <AppContext.Provider value={appContext}>
        <MapLayerModal
          showModal={showModal}
          handleModalClose={handleModalClose}
          addMapLayer={addMapLayer}
          layerInfo={layerInfo}
        />
      </AppContext.Provider>
    </>
  );
};

test("MapLayerModal layer template full map layer", async () => {
  server.use(
    rest.get("http://api.test/apps/tethysdash/data/", (req, res, ctx) => {
      return res(
        ctx.status(200),
        ctx.json({
          success: true,
          data: fullMapLayer,
        }),
        ctx.set("Content-Type", "application/json")
      );
    })
  );

  const handleModalClose = jest.fn();
  const addMapLayer = jest.fn();
  const layerInfo = {};
  render(
    <TestingComponent
      showModal={true}
      handleModalClose={handleModalClose}
      addMapLayer={addMapLayer}
      layerInfo={layerInfo}
    />
  );

  expect(await screen.findByRole("dialog")).toBeInTheDocument();

  const layerTemplatesDropdown = screen.getByLabelText("Layer Templates Input");

  selectEvent.openMenu(layerTemplatesDropdown);
  const templateOption = await screen.findByText("Map Layer Template Example");
  fireEvent.click(templateOption);

  await waitFor(() => {
    expect(screen.getByLabelText("Name Input").value).toBe("NWC");
  });

  await waitFor(() => {
    expect(screen.getByText("ESRI Image and Map Service")).toBeInTheDocument();
  });

  const createLayerButton = await screen.findByLabelText("Create Layer Button");
  fireEvent.click(createLayerButton);

  await waitFor(() => {
    expect(addMapLayer).toHaveBeenCalledWith({
      configuration: {
        type: "ImageLayer",
        props: {
          name: "NWC",
          source: {
            type: "ESRI Image and Map Service",
            props: {
              url: "some_url",
            },
          },
        },
        layerVisibility: false,
        style: "12345.json",
      },
      attributeAliases: {
        NWC: {
          nws_lid: "LID",
        },
      },
      attributeVariables: {
        NWC: {
          nws_lid: "LID",
        },
      },
      omittedPopupAttributes: {
        NWC: ["nws_lid"],
      },
      legend: {
        title: "Some Title",
        items: [
          {
            label: "Some label",
            color: "green",
            symbol: "square",
          },
        ],
      },
    });
  });
});

test("MapLayerModal layer template partial map layer", async () => {
  server.use(
    rest.get("http://api.test/apps/tethysdash/data/", (req, res, ctx) => {
      return res(
        ctx.status(200),
        ctx.json({
          success: true,
          data: {
            configuration: {
              type: "ImageLayer",
              props: {
                name: "NWC",
                source: {
                  type: "ESRI Image and Map Service",
                  props: {
                    url: "some_url",
                  },
                },
              },
            },
            queryable: false,
          },
        }),
        ctx.set("Content-Type", "application/json")
      );
    })
  );

  const handleModalClose = jest.fn();
  const addMapLayer = jest.fn();
  const layerInfo = {};
  render(
    <TestingComponent
      showModal={true}
      handleModalClose={handleModalClose}
      addMapLayer={addMapLayer}
      layerInfo={layerInfo}
    />
  );

  expect(await screen.findByRole("dialog")).toBeInTheDocument();

  const layerTemplatesDropdown = screen.getByLabelText("Layer Templates Input");

  selectEvent.openMenu(layerTemplatesDropdown);
  const templateOption = await screen.findByText("Map Layer Template Example");
  fireEvent.click(templateOption);

  await waitFor(() => {
    expect(screen.getByLabelText("Name Input").value).toBe("NWC");
  });

  await waitFor(() => {
    expect(screen.getByText("ESRI Image and Map Service")).toBeInTheDocument();
  });

  const createLayerButton = await screen.findByLabelText("Create Layer Button");
  fireEvent.click(createLayerButton);

  await waitFor(() => {
    expect(addMapLayer).toHaveBeenCalledWith({
      configuration: {
        type: "ImageLayer",
        props: {
          name: "NWC",
          source: {
            type: "ESRI Image and Map Service",
            props: {
              url: "some_url",
            },
          },
        },
      },
      queryable: false,
    });
  });
});

test("MapLayerModal new ImageArcGISRest layer", async () => {
  const handleModalClose = jest.fn();
  const addMapLayer = jest.fn();
  const layerInfo = {};
  render(
    <TestingComponent
      showModal={true}
      handleModalClose={handleModalClose}
      addMapLayer={addMapLayer}
      layerInfo={layerInfo}
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
  const sourceDropdown = screen.getByLabelText("Source Type Input");

  selectEvent.openMenu(sourceDropdown);
  const sourceOption = await screen.findByText("ESRI Image and Map Service");
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
          type: "ESRI Image and Map Service",
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
  render(
    <TestingComponent
      showModal={true}
      handleModalClose={handleModalClose}
      addMapLayer={addMapLayer}
      layerInfo={layerInfo}
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
  const sourceDropdown = screen.getByLabelText("Source Type Input");

  selectEvent.openMenu(sourceDropdown);
  const sourceOption = await screen.findByText("WMS");
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
          type: "WMS",
        },
      },
      type: "ImageLayer",
    },
  });
});

test("MapLayerModal new GeoJSON layer", async () => {
  const mockUploadJSON = jest.fn();
  appAPI.uploadJSON = mockUploadJSON;
  mockUploadJSON.mockResolvedValue({
    success: true,
    filename: "12345678.json",
  });

  const handleModalClose = jest.fn();
  const addMapLayer = jest.fn();
  const layerInfo = {};
  render(
    <TestingComponent
      showModal={true}
      handleModalClose={handleModalClose}
      addMapLayer={addMapLayer}
      layerInfo={layerInfo}
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
  const sourceDropdown = screen.getByLabelText("Source Type Input");

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
      "Invalid json is being used. Please alter the json and try again."
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
  render(
    <TestingComponent
      showModal={true}
      handleModalClose={handleModalClose}
      addMapLayer={addMapLayer}
      layerInfo={layerInfo}
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
  const sourceDropdown = screen.getByLabelText("Source Type Input");

  selectEvent.openMenu(sourceDropdown);
  const sourceOption = await screen.findByText("Image Tile");
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
          type: "Image Tile",
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
  render(
    <TestingComponent
      showModal={true}
      handleModalClose={handleModalClose}
      addMapLayer={addMapLayer}
      layerInfo={layerInfo}
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
  const sourceDropdown = screen.getByLabelText("Source Type Input");

  selectEvent.openMenu(sourceDropdown);
  const sourceOption = await screen.findByText("Vector Tile");
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
          type: "Vector Tile",
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
  render(
    <TestingComponent
      showModal={true}
      handleModalClose={handleModalClose}
      addMapLayer={addMapLayer}
      layerInfo={layerInfo}
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
  render(
    <TestingComponent
      showModal={true}
      handleModalClose={handleModalClose}
      addMapLayer={addMapLayer}
      layerInfo={layerInfo}
    />
  );

  const nameInput = await screen.findByLabelText("Name Input");
  fireEvent.change(nameInput, { target: { value: "New Layer Name" } });

  const sourceTab = screen.getByText("Source");
  fireEvent.click(sourceTab);
  const sourceTabContent = screen.getByLabelText("layer-source-tab");
  const sourceDropdown = screen.getByLabelText("Source Type Input");

  selectEvent.openMenu(sourceDropdown);
  const sourceOption = await screen.findByText("WMS");
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
  render(
    <TestingComponent
      showModal={true}
      handleModalClose={handleModalClose}
      addMapLayer={addMapLayer}
      layerInfo={layerInfo}
    />
  );

  const nameInput = await screen.findByLabelText("Name Input");
  fireEvent.change(nameInput, { target: { value: "New Layer Name" } });

  const sourceTab = screen.getByText("Source");
  fireEvent.click(sourceTab);
  const sourceTabContent = screen.getByLabelText("layer-source-tab");
  const sourceDropdown = screen.getByLabelText("Source Type Input");

  selectEvent.openMenu(sourceDropdown);
  const sourceOption = await screen.findByText("ESRI Image and Map Service");
  fireEvent.click(sourceOption);
  expect(await screen.findByText("Source Properties")).toBeInTheDocument();

  const urlInput = within(sourceTabContent).getByLabelText("value Input 0");
  fireEvent.change(urlInput, { target: { value: "Some Url" } });

  const attributesTab = screen.getByText("Attributes/Popup");
  fireEvent.click(attributesTab);

  expect(await screen.findByText("New Layer Name")).toBeInTheDocument();
  const attributesTabContent = screen.getByLabelText("layer-attributes-tab");
  const variableInput =
    within(attributesTabContent).getAllByLabelText("variable row")[0];
  fireEvent.change(variableInput, { target: { value: "Some Variable" } });
  const popupCheckboxes = screen.getAllByLabelText("Show in popup row");
  fireEvent.click(popupCheckboxes[0]);

  const createLayerButton = await screen.findByLabelText("Create Layer Button");
  fireEvent.click(createLayerButton);

  expect(addMapLayer).toHaveBeenCalledWith({
    attributeVariables: {
      "New Layer Name": {
        the_geom: "Some Variable",
      },
    },
    attributeAliases: {
      "New Layer Name": {
        STATE_NAME: "STATE_NAME",
        the_geom: "the_geom",
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
          type: "ESRI Image and Map Service",
        },
      },
      type: "ImageLayer",
    },
  });
});

test("MapLayerModal legend", async () => {
  const handleModalClose = jest.fn();
  const addMapLayer = jest.fn();
  const layerInfo = {};
  render(
    <TestingComponent
      showModal={true}
      handleModalClose={handleModalClose}
      addMapLayer={addMapLayer}
      layerInfo={layerInfo}
    />
  );

  const nameInput = await screen.findByLabelText("Name Input");
  fireEvent.change(nameInput, { target: { value: "New Layer Name" } });

  const sourceTab = screen.getByText("Source");
  fireEvent.click(sourceTab);
  const sourceTabContent = screen.getByLabelText("layer-source-tab");
  const sourceDropdown = screen.getByLabelText("Source Type Input");

  selectEvent.openMenu(sourceDropdown);
  const sourceOption = await screen.findByText("ESRI Image and Map Service");
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
          type: "ESRI Image and Map Service",
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
  render(
    <TestingComponent
      showModal={true}
      handleModalClose={handleModalClose}
      addMapLayer={addMapLayer}
      layerInfo={layerInfo}
    />
  );

  const nameInput = await screen.findByLabelText("Name Input");
  fireEvent.change(nameInput, { target: { value: "New Layer Name" } });

  const sourceTab = screen.getByText("Source");
  fireEvent.click(sourceTab);
  const sourceDropdown = screen.getByLabelText("Source Type Input");

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
  mockUploadJSON.mockResolvedValue({
    success: true,
    filename: "12345678.json",
  });

  const handleModalClose = jest.fn();
  const addMapLayer = jest.fn();
  const layerInfo = {};
  render(
    <TestingComponent
      showModal={true}
      handleModalClose={handleModalClose}
      addMapLayer={addMapLayer}
      layerInfo={layerInfo}
    />
  );

  const nameInput = await screen.findByLabelText("Name Input");
  fireEvent.change(nameInput, { target: { value: "New Layer Name" } });

  const sourceTab = screen.getByText("Source");
  fireEvent.click(sourceTab);
  const sourceTabContent = screen.getByLabelText("layer-source-tab");
  const sourceDropdown = screen.getByLabelText("Source Type Input");

  selectEvent.openMenu(sourceDropdown);
  const sourceOption = await screen.findByText("ESRI Image and Map Service");
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
      "Invalid json is being used. Please alter the json and try again."
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
            type: "ESRI Image and Map Service",
          },
        },
        type: "ImageLayer",
        style: "12345678.json",
      },
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
  render(
    <TestingComponent
      showModal={true}
      handleModalClose={handleModalClose}
      addMapLayer={addMapLayer}
      layerInfo={layerInfo}
    />
  );

  const nameInput = await screen.findByLabelText("Name Input");
  fireEvent.change(nameInput, { target: { value: "New Layer Name" } });

  const sourceTab = screen.getByText("Source");
  fireEvent.click(sourceTab);
  const sourceTabContent = screen.getByLabelText("layer-source-tab");
  const sourceDropdown = screen.getByLabelText("Source Type Input");

  selectEvent.openMenu(sourceDropdown);
  const sourceOption = await screen.findByText("ESRI Image and Map Service");
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
      type: "ESRI Image and Map Service",
    },
    attributeProps: {
      variables: {
        "New Layer Name": {
          the_geom: "Some Variable",
        },
      },
    },
  };
  render(
    <TestingComponent
      showModal={true}
      handleModalClose={handleModalClose}
      addMapLayer={addMapLayer}
      layerInfo={layerInfo}
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

  const visibilityToggle = screen.getByLabelText("Default Visibility Toggle");
  fireEvent.click(visibilityToggle);

  const sourceTab = screen.getByText("Source");
  fireEvent.click(sourceTab);
  const sourceTabContent = screen.getByLabelText("layer-source-tab");
  const sourceDropdown = screen.getByLabelText("Source Type Input");

  selectEvent.openMenu(sourceDropdown);
  const sourceOption = await screen.findByText("ESRI Image and Map Service");
  fireEvent.click(sourceOption);
  expect(await screen.findByText("Source Properties")).toBeInTheDocument();

  const urlInput = within(sourceTabContent).getByLabelText("value Input 0");
  fireEvent.change(urlInput, { target: { value: "Some Url" } });

  const attributesTab = screen.getByText("Attributes/Popup");
  fireEvent.click(attributesTab);

  expect(await screen.findByText("New Layer Name")).toBeInTheDocument();
  const attributesTabContent = screen.getByLabelText("layer-attributes-tab");

  const variableInput1 =
    within(attributesTabContent).getAllByLabelText("variable row")[0];
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
          type: "ESRI Image and Map Service",
        },
      },
      type: "ImageLayer",
      layerVisibility: false,
    },
    attributeVariables: {
      "New Layer Name": {
        the_geom: "Some New Variable",
      },
    },
    attributeAliases: {
      "New Layer Name": {
        STATE_NAME: "STATE_NAME",
        the_geom: "the_geom",
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

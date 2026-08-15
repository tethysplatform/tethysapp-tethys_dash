import PropTypes from "prop-types";
import { useRef } from "react";
import {
  render,
  screen,
  fireEvent,
  within,
  waitFor,
} from "@testing-library/react";
import selectEvent from "react-select-event";
import MapLayerModal, {
  getLayerType,
  rekeyAttributeMapToLayer,
  renameLayerInAttributeProps,
  normalizeAttributePropsForLayer,
} from "components/modals/MapLayer/MapLayer";
import {
  AppContext,
  LayoutContext,
  VariableInputsContext,
} from "components/contexts/Contexts";
import MapContextProvider, {
  useMapContext,
} from "components/contexts/MapContext";
import appAPI from "services/api/app";
import { getLayerAttributes } from "components/map/utilities";
import { server } from "__tests__/utilities/server";
import { rest } from "msw";
import { fullMapLayer } from "__tests__/utilities/constants";

jest.mock("components/map/utilities", () => {
  const originalModule = jest.requireActual("components/map/utilities");
  return {
    ...originalModule,
    getLayerAttributes: jest.fn(),
  };
});
const mockedGetLayerAttributes = jest.mocked(getLayerAttributes);

// DashboardLayout is rendered inside the popup layout sub-editor and reads
// DisabledEditingMovementContext (and tab/editing contexts) that this file
// does not provide. The popup-pane z-index test only cares about the parent
// modal style flip, so stub DashboardLayout to a sentinel.
jest.mock("components/dashboard/DashboardLayout", () => {
  const MockDashboardLayout = () => (
    <div data-testid="mock-popup-dashboard-layout" />
  );
  return MockDashboardLayout;
});

global.crypto = {
  getRandomValues: (arr) => {
    return arr.map(() => Math.floor(Math.random() * 256));
  },
};

// Helper component for extent draw tests — wraps MapLayerModal with MapContext
const ExtentTestComponent = ({ layerInfo, visualizationRefOverride }) => {
  const csrf = "asdasdasdasd";
  const appContext = {
    csrf,
    mapLayerTemplates: [],
    dynamicMapLayers: [],
    sessionNonce: "test-nonce",
  };
  const { setExtentDrawMode, setDrawnExtent, extentDrawMode } = useMapContext();
  const defaultRef = useRef({
    getView: () => ({
      getProjection: () => ({
        getCode: () => "EPSG:4326",
      }),
    }),
  });
  const visualizationRef =
    visualizationRefOverride !== undefined
      ? visualizationRefOverride
      : defaultRef;

  return (
    <>
      <AppContext.Provider value={appContext}>
        <LayoutContext.Provider value={{ uuid: "123" }}>
          <VariableInputsContext.Provider
            value={{ variableInputValues: {}, variableInputDateFormats: {} }}
          >
            <MapLayerModal
              showModal={true}
              handleModalClose={jest.fn()}
              addMapLayer={jest.fn()}
              layerInfo={layerInfo}
              visualizationRef={visualizationRef}
            />
          </VariableInputsContext.Provider>
        </LayoutContext.Provider>
      </AppContext.Provider>
      <button
        data-testid="set-drawn-extent"
        onClick={() => setDrawnExtent([10, 20, 30, 40])}
      >
        Set Drawn Extent
      </button>
      <button
        data-testid="clear-extent-draw-mode"
        onClick={() => setExtentDrawMode(null)}
      >
        Clear Extent Draw Mode
      </button>
      <p data-testid="extent-draw-mode">{extentDrawMode ? "active" : "null"}</p>
    </>
  );
};

const TestingComponent = ({
  showModal,
  handleModalClose,
  addMapLayer,
  layerInfo,
  dynamicMapLayers = [],
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
    dynamicMapLayers,
  };

  return (
    <>
      <AppContext.Provider value={appContext}>
        <LayoutContext.Provider value={{ uuid: "123" }}>
          <VariableInputsContext.Provider
            value={{ variableInputValues: {}, variableInputDateFormats: {} }}
          >
            <MapLayerModal
              showModal={showModal}
              handleModalClose={handleModalClose}
              addMapLayer={addMapLayer}
              layerInfo={layerInfo}
            />
          </VariableInputsContext.Provider>
        </LayoutContext.Provider>
      </AppContext.Provider>
    </>
  );
};

test("MapLayerModal layer template full map layer", async () => {
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/visualizations/get/",
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            success: true,
            data: fullMapLayer,
          }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
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
    />,
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
    rest.get(
      "http://api.test/apps/tethysdash/visualizations/get/",
      (req, res, ctx) => {
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
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
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
    />,
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
      tablePopupType: "none",
    });
  });
});

test("MapLayerModal layer template error response", async () => {
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/visualizations/get/",
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            success: false,
          }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
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
    />,
  );

  expect(await screen.findByRole("dialog")).toBeInTheDocument();

  const layerTemplatesDropdown = screen.getByLabelText("Layer Templates Input");

  selectEvent.openMenu(layerTemplatesDropdown);
  const templateOption = await screen.findByText("Map Layer Template Example");
  fireEvent.click(templateOption);

  expect(
    await screen.findByText("Failed to load layer template. Check logs."),
  ).toBeInTheDocument();
});

test("MapLayerModal layer template error response, custom error", async () => {
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/visualizations/get/",
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            success: false,
            data: { error: "Error loading layer template" },
          }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
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
    />,
  );

  expect(await screen.findByRole("dialog")).toBeInTheDocument();

  const layerTemplatesDropdown = screen.getByLabelText("Layer Templates Input");

  selectEvent.openMenu(layerTemplatesDropdown);
  const templateOption = await screen.findByText("Map Layer Template Example");
  fireEvent.click(templateOption);

  expect(
    await screen.findByText("Error loading layer template"),
  ).toBeInTheDocument();
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
    />,
  );

  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  expect(screen.getByText("Add Map Layer")).toBeInTheDocument();
  expect(screen.getByText("Layer")).toBeInTheDocument();
  expect(screen.getByText("Source")).toBeInTheDocument();
  expect(screen.getByText("Style")).toBeInTheDocument();
  expect(screen.getByText("Legend")).toBeInTheDocument();
  expect(screen.getByText("Attributes/Table Popup")).toBeInTheDocument();

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
    />,
  );

  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  expect(screen.getByText("Add Map Layer")).toBeInTheDocument();
  expect(screen.getByText("Layer")).toBeInTheDocument();
  expect(screen.getByText("Source")).toBeInTheDocument();
  expect(screen.getByText("Style")).toBeInTheDocument();
  expect(screen.getByText("Legend")).toBeInTheDocument();
  expect(screen.getByText("Attributes/Table Popup")).toBeInTheDocument();

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
  jest.spyOn(appAPI, "uploadJSON").mockImplementation(mockUploadJSON);
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
    />,
  );

  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  expect(screen.getByText("Add Map Layer")).toBeInTheDocument();
  expect(screen.getByText("Layer")).toBeInTheDocument();
  expect(screen.getByText("Source")).toBeInTheDocument();
  expect(screen.getByText("Style")).toBeInTheDocument();
  expect(screen.getByText("Legend")).toBeInTheDocument();
  expect(screen.getByText("Attributes/Table Popup")).toBeInTheDocument();

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

  const textArea = screen.getByLabelText("geojson-source-text-area");
  fireEvent.change(textArea, {
    target: { value: "{'dd':}" },
  });

  const createLayerButton = await screen.findByLabelText("Create Layer Button");
  fireEvent.click(createLayerButton);

  expect(
    await screen.findByText("Invalid JSON or failed to fetch/parse the file."),
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
    />,
  );

  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  expect(screen.getByText("Add Map Layer")).toBeInTheDocument();
  expect(screen.getByText("Layer")).toBeInTheDocument();
  expect(screen.getByText("Source")).toBeInTheDocument();
  expect(screen.getByText("Style")).toBeInTheDocument();
  expect(screen.getByText("Legend")).toBeInTheDocument();
  expect(screen.getByText("Attributes/Table Popup")).toBeInTheDocument();

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
    />,
  );

  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  expect(screen.getByText("Add Map Layer")).toBeInTheDocument();
  expect(screen.getByText("Layer")).toBeInTheDocument();
  expect(screen.getByText("Source")).toBeInTheDocument();
  expect(screen.getByText("Style")).toBeInTheDocument();
  expect(screen.getByText("Legend")).toBeInTheDocument();
  expect(screen.getByText("Attributes/Table Popup")).toBeInTheDocument();

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

test("MapLayerModal new PMTiles Vector layer", async () => {
  const handleModalClose = jest.fn();
  const addMapLayer = jest.fn();
  const layerInfo = {};
  render(
    <TestingComponent
      showModal={true}
      handleModalClose={handleModalClose}
      addMapLayer={addMapLayer}
      layerInfo={layerInfo}
    />,
  );

  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  expect(screen.getByText("Add Map Layer")).toBeInTheDocument();
  expect(screen.getByText("Layer")).toBeInTheDocument();
  expect(screen.getByText("Source")).toBeInTheDocument();
  expect(screen.getByText("Style")).toBeInTheDocument();
  expect(screen.getByText("Legend")).toBeInTheDocument();
  expect(screen.getByText("Attributes/Table Popup")).toBeInTheDocument();

  const nameInput = await screen.findByLabelText("Name Input");
  fireEvent.change(nameInput, { target: { value: "New Layer Name" } });

  const sourceTab = screen.getByText("Source");
  fireEvent.click(sourceTab);
  const sourceTabContent = screen.getByLabelText("layer-source-tab");
  const sourceDropdown = screen.getByLabelText("Source Type Input");

  selectEvent.openMenu(sourceDropdown);
  const sourceOption = await screen.findByText("PMTiles Vector");
  fireEvent.click(sourceOption);
  expect(await screen.findByText("Source Properties")).toBeInTheDocument();

  const urlInput = within(sourceTabContent).getByLabelText("value Input 0");
  fireEvent.change(urlInput, { target: { value: "some_url" } });

  const createLayerButton = await screen.findByLabelText("Create Layer Button");
  fireEvent.click(createLayerButton);

  expect(addMapLayer).toHaveBeenCalledWith({
    configuration: {
      props: {
        name: "New Layer Name",
        source: {
          props: {
            url: "some_url",
          },
          type: "PMTiles Vector",
        },
      },
      type: "VectorTileLayer",
    },
  });
});

test("MapLayerModal new PMTiles Raster layer", async () => {
  const handleModalClose = jest.fn();
  const addMapLayer = jest.fn();
  const layerInfo = {};
  render(
    <TestingComponent
      showModal={true}
      handleModalClose={handleModalClose}
      addMapLayer={addMapLayer}
      layerInfo={layerInfo}
    />,
  );

  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  expect(screen.getByText("Add Map Layer")).toBeInTheDocument();
  expect(screen.getByText("Layer")).toBeInTheDocument();
  expect(screen.getByText("Source")).toBeInTheDocument();
  expect(screen.getByText("Style")).toBeInTheDocument();
  expect(screen.getByText("Legend")).toBeInTheDocument();
  expect(screen.getByText("Attributes/Table Popup")).toBeInTheDocument();

  const nameInput = await screen.findByLabelText("Name Input");
  fireEvent.change(nameInput, { target: { value: "New Layer Name" } });

  const sourceTab = screen.getByText("Source");
  fireEvent.click(sourceTab);
  const sourceTabContent = screen.getByLabelText("layer-source-tab");
  const sourceDropdown = screen.getByLabelText("Source Type Input");

  selectEvent.openMenu(sourceDropdown);
  const sourceOption = await screen.findByText("PMTiles Raster");
  fireEvent.click(sourceOption);
  expect(await screen.findByText("Source Properties")).toBeInTheDocument();

  const urlInput = within(sourceTabContent).getByLabelText("value Input 0");
  fireEvent.change(urlInput, { target: { value: "some_url" } });

  const createLayerButton = await screen.findByLabelText("Create Layer Button");
  fireEvent.click(createLayerButton);

  expect(addMapLayer).toHaveBeenCalledWith({
    configuration: {
      props: {
        name: "New Layer Name",
        source: {
          props: {
            url: "some_url",
          },
          type: "PMTiles Raster",
        },
      },
      type: "WebGLTile",
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
    />,
  );

  const createLayerButton = await screen.findByLabelText("Create Layer Button");
  fireEvent.click(createLayerButton);

  expect(
    await screen.findByText(
      "Layer type and name must be provided in the configuration pane.",
    ),
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
    />,
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
      "Missing required params arguments. Please check the configuration and try again.",
    ),
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
    />,
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

  const attributesTab = screen.getByText("Attributes/Table Popup");
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
    />,
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
  const onRadio = screen.getByLabelText("Custom Legend");
  fireEvent.click(onRadio);

  const addRowButton = await screen.findByLabelText("Add Legend Item Button");
  fireEvent.click(addRowButton);

  const createLayerButton = await screen.findByLabelText("Create Layer Button");
  fireEvent.click(createLayerButton);

  expect(
    await screen.findByText(
      "Provide a legend title if showing a legend for this layer",
    ),
  ).toBeInTheDocument();

  const legendTabContent = screen.getByLabelText("layer-legend-tab");
  const legendTitle = within(legendTabContent).getAllByRole("textbox")[0];
  fireEvent.change(legendTitle, { target: { value: "Some Title" } });

  fireEvent.click(createLayerButton);

  expect(
    await screen.findByText(
      "All Legend Items must have a label, color, and symbol",
    ),
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

test("MapLayerModal string legend", async () => {
  const handleModalClose = jest.fn();
  const addMapLayer = jest.fn();
  const layerInfo = {
    legend: "bad",
    sourceProps: {
      props: {
        url: "Some Url",
      },
      type: "ESRI Image and Map Service",
    },

    layerProps: { name: "New Layer Name" },
  };
  render(
    <TestingComponent
      showModal={true}
      handleModalClose={handleModalClose}
      addMapLayer={addMapLayer}
      layerInfo={layerInfo}
    />,
  );

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
    legend: "bad",
  });
});

test("MapLayerModal new GeoJSON layer api fail", async () => {
  const mockUploadJSON = jest.fn();
  jest.spyOn(appAPI, "uploadJSON").mockImplementation(mockUploadJSON);
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
    />,
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
      "Failed to upload the json data. Check logs for more information.",
    ),
  ).toBeInTheDocument();
  expect(addMapLayer).toHaveBeenCalledTimes(0);
});

test("MapLayerModal style", async () => {
  const mockUploadJSON = jest.fn();
  jest.spyOn(appAPI, "uploadJSON").mockImplementation(mockUploadJSON);
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
    />,
  );

  const nameInput = await screen.findByLabelText("Name Input");
  fireEvent.change(nameInput, { target: { value: "New Layer Name" } });

  const sourceTab = screen.getByText("Source");
  fireEvent.click(sourceTab);
  const sourceTabContent = screen.getByLabelText("layer-source-tab");
  const sourceDropdown = screen.getByLabelText("Source Type Input");

  selectEvent.openMenu(sourceDropdown);
  const sourceOption = await screen.findByText("ESRI Feature Service");
  fireEvent.click(sourceOption);
  expect(await screen.findByText("Source Properties")).toBeInTheDocument();

  const urlInput = within(sourceTabContent).getByLabelText("value Input 0");
  fireEvent.change(urlInput, { target: { value: "Some Url" } });
  const layerInput = within(sourceTabContent).getByLabelText("value Input 1");
  fireEvent.change(layerInput, { target: { value: 0 } });

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
    await screen.findByText("Invalid JSON or failed to fetch/parse the file."),
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
              layer: "0",
              url: "Some Url",
            },
            type: "ESRI Feature Service",
          },
        },
        type: "VectorLayer",
        style: "12345678.json",
      },
    });
  });
});

test("MapLayerModal style api fail", async () => {
  const mockUploadJSON = jest.fn();
  jest.spyOn(appAPI, "uploadJSON").mockImplementation(mockUploadJSON);
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
    />,
  );

  const nameInput = await screen.findByLabelText("Name Input");
  fireEvent.change(nameInput, { target: { value: "New Layer Name" } });

  const sourceTab = screen.getByText("Source");
  fireEvent.click(sourceTab);
  const sourceTabContent = screen.getByLabelText("layer-source-tab");
  const sourceDropdown = screen.getByLabelText("Source Type Input");

  selectEvent.openMenu(sourceDropdown);
  const sourceOption = await screen.findByText("ESRI Feature Service");
  fireEvent.click(sourceOption);
  expect(await screen.findByText("Source Properties")).toBeInTheDocument();

  const urlInput = within(sourceTabContent).getByLabelText("value Input 0");
  fireEvent.change(urlInput, { target: { value: "Some Url" } });
  const layerInput = within(sourceTabContent).getByLabelText("value Input 1");
  fireEvent.change(layerInput, { target: { value: 0 } });

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
      "Failed to upload the json data. Check logs for more information.",
    ),
  ).toBeInTheDocument();

  const closeAlert = screen.getByLabelText("Close alert");
  fireEvent.click(closeAlert);

  expect(
    screen.queryByText(
      "Failed to upload the json data. Check logs for more information.",
    ),
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
    />,
  );

  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  expect(screen.getByText("Add Map Layer")).toBeInTheDocument();
  expect(screen.getByText("Layer")).toBeInTheDocument();
  expect(screen.getByText("Source")).toBeInTheDocument();
  expect(screen.getByText("Style")).toBeInTheDocument();
  expect(screen.getByText("Legend")).toBeInTheDocument();
  expect(screen.getByText("Attributes/Table Popup")).toBeInTheDocument();

  const nameInput = await screen.findByLabelText("Name Input");
  fireEvent.change(nameInput, { target: { value: "New Layer Name" } });

  const visibilityToggle = screen.getByLabelText("Default Visibility Toggle");
  fireEvent.click(visibilityToggle);

  const sourceTab = screen.getByText("Source");
  fireEvent.click(sourceTab);
  const sourceTabContent = screen.getByLabelText("layer-source-tab");
  const sourceDropdown = screen.getByLabelText("Source Type Input");

  await selectEvent.select(sourceDropdown, "ESRI Image and Map Service");
  expect(await screen.findByText("Source Properties")).toBeInTheDocument();

  const urlInput = within(sourceTabContent).getByLabelText("value Input 0");
  fireEvent.change(urlInput, { target: { value: "Some Url" } });

  const attributesTab = screen.getByText("Attributes/Table Popup");
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

test("MapLayerModal handleLayerPropsChange accepts a direct object updater", async () => {
  const handleModalClose = jest.fn();
  const addMapLayer = jest.fn();
  const layerInfo = {
    layerProps: {
      name: "Existing Layer",
    },
    sourceProps: {
      props: {
        url: "Some Url",
      },
      type: "ESRI Image and Map Service",
    },
    attributeProps: {
      aliases: {
        "Existing Layer": {
          STATE_NAME: "State",
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
    />,
  );

  expect(await screen.findByRole("dialog")).toBeInTheDocument();

  // LayerPane.handlePropertyChange calls setLayerProps with a plain object
  // (not a function), exercising the non-function branch of the
  // `typeof updater === "function" ? updater(prev) : updater` ternary in
  // handleLayerPropsChange.
  const layerTabContent = screen.getByLabelText("layer-tab");
  const opacityInput = within(layerTabContent).getByLabelText("value Input 0");
  fireEvent.change(opacityInput, { target: { value: "0.5" } });

  const createLayerButton = await screen.findByLabelText("Create Layer Button");
  fireEvent.click(createLayerButton);

  expect(addMapLayer).toHaveBeenCalledWith({
    configuration: {
      type: "ImageLayer",
      props: {
        name: "Existing Layer",
        opacity: "0.5",
        source: {
          type: "ESRI Image and Map Service",
          props: {
            url: "Some Url",
          },
        },
      },
    },
    // Name was unchanged, so attributeAliases keys must remain under
    // "Existing Layer" — i.e., renameLayerInAttributeProps was NOT called.
    attributeAliases: {
      "Existing Layer": {
        STATE_NAME: "State",
      },
    },
  });
});

test("MapLayerModal re-shows and updates sourceProps when drawnExtent arrives", async () => {
  render(
    <MapContextProvider>
      <ExtentTestComponent
        layerInfo={{
          sourceProps: {
            type: "Static Image",
            props: {
              url: "https://example.com/image.png",
            },
          },
          layerProps: { name: "Test Layer" },
        }}
      />
    </MapContextProvider>,
  );

  // Navigate to Source tab
  const sourceTab = screen.getByText("Source");
  fireEvent.click(sourceTab);

  // Fill in URL for the "Draw Extent on Map" button
  await waitFor(() => {
    expect(screen.getByText("*url")).toBeInTheDocument();
  });

  // Click "Draw Extent on Map" — triggers onRequestHideModal (line 96)
  const drawButton = await screen.findByLabelText("Draw Extent on Map Button");
  fireEvent.click(drawButton);

  // Verify extentDrawMode was set
  await waitFor(() => {
    expect(screen.getByTestId("extent-draw-mode")).toHaveTextContent("active");
  });

  // Simulate drawnExtent arriving (lines 103-120)
  fireEvent.click(screen.getByTestId("set-drawn-extent"));

  // Modal should re-show — verify the dialog is still present with updated values
  await waitFor(() => {
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  // Verify sourceProps were updated with the extent
  // Navigate back to source tab to see updated values
  fireEvent.click(screen.getByText("Source"));
  await waitFor(() => {
    const inputs = screen.getAllByRole("textbox");
    // imageExtent should be populated with the drawn extent
    const imageExtentInput = inputs.find(
      (input) => input.value === "10.00, 20.00, 30.00, 40.00",
    );
    expect(imageExtentInput).toBeDefined();
  });
});

test("MapLayerModal re-shows when extentDrawMode is cancelled", async () => {
  render(
    <MapContextProvider>
      <ExtentTestComponent
        layerInfo={{
          sourceProps: {
            type: "Static Image",
            props: {
              url: "https://example.com/image.png",
            },
          },
          layerProps: { name: "Test Layer" },
        }}
      />
    </MapContextProvider>,
  );

  // Navigate to Source tab and click Draw Extent
  fireEvent.click(screen.getByText("Source"));
  await waitFor(() => {
    expect(screen.getByText("*url")).toBeInTheDocument();
  });

  const drawButton = await screen.findByLabelText("Draw Extent on Map Button");
  fireEvent.click(drawButton);

  await waitFor(() => {
    expect(screen.getByTestId("extent-draw-mode")).toHaveTextContent("active");
  });

  // Simulate cancel — extentDrawMode set to null (line 126)
  fireEvent.click(screen.getByTestId("clear-extent-draw-mode"));

  await waitFor(() => {
    expect(screen.getByTestId("extent-draw-mode")).toHaveTextContent("null");
  });

  // Modal should re-show
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});

test("MapLayerModal falls back to EPSG:3857 when visualizationRef is null", async () => {
  const nullRef = { current: null };

  render(
    <MapContextProvider>
      <ExtentTestComponent
        layerInfo={{
          sourceProps: {
            type: "Static Image",
            props: {
              url: "https://example.com/image.png",
            },
          },
          layerProps: { name: "Test Layer" },
        }}
        visualizationRefOverride={nullRef}
      />
    </MapContextProvider>,
  );

  // Navigate to Source tab and trigger draw extent
  fireEvent.click(screen.getByText("Source"));
  await waitFor(() => {
    expect(screen.getByText("*url")).toBeInTheDocument();
  });

  const drawButton = await screen.findByLabelText("Draw Extent on Map Button");
  fireEvent.click(drawButton);

  await waitFor(() => {
    expect(screen.getByTestId("extent-draw-mode")).toHaveTextContent("active");
  });

  // Simulate drawnExtent arriving with null visualizationRef
  fireEvent.click(screen.getByTestId("set-drawn-extent"));

  await waitFor(() => {
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  // Verify projection fell back to EPSG:3857
  fireEvent.click(screen.getByText("Source"));
  await waitFor(() => {
    const inputs = screen.getAllByRole("textbox");
    const projectionInput = inputs.find((input) => input.value === "EPSG:3857");
    expect(projectionInput).toBeDefined();
  });
});

describe("MapLayerModal GeoTIFF save path", () => {
  const renderModal = (props, addMapLayer, extra = {}) => {
    render(
      <TestingComponent
        showModal={true}
        handleModalClose={jest.fn()}
        addMapLayer={addMapLayer}
        layerInfo={{
          layerProps: { name: "GeoTIFF Layer" },
          sourceProps: { type: "GeoTIFF", props },
        }}
        {...extra}
      />,
    );
  };

  test("saves the flat url/nodata/projection fields", async () => {
    const addMapLayer = jest.fn();
    renderModal(
      { url: "https://example.com/a.tif", projection: "EPSG:32615" },
      addMapLayer,
    );

    fireEvent.click(await screen.findByLabelText("Create Layer Button"));
    await waitFor(() => expect(addMapLayer).toHaveBeenCalledTimes(1));

    const saved = addMapLayer.mock.calls[0][0];
    expect(saved.configuration.type).toBe("WebGLTile");
    // No `sources` array in the saved config — ModuleLoader builds OL's shape.
    expect(saved.configuration.props.source.props).toEqual(
      expect.objectContaining({
        url: "https://example.com/a.tif",
        projection: "EPSG:32615",
      }),
    );
    expect(saved.configuration.props.source.props.sources).toBeUndefined();
  });

  test("blocks save when the required url is missing", async () => {
    const addMapLayer = jest.fn();
    renderModal({}, addMapLayer);

    fireEvent.click(await screen.findByLabelText("Create Layer Button"));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(addMapLayer).not.toHaveBeenCalled();
  });
});

describe("MapLayerModal save-path nullish fallbacks and sub-modal zIndex", () => {
  test("GeoJSON save with no `geojson` key falls back to '' and stores empty string", async () => {
    // Covers the right side of `(sourceProps.geojson ?? "").trim()` at
    // line 282. With geojson undefined, geoStr is "", isJsonBody is false,
    // so the URL/filename branch stores the empty string verbatim.
    const handleModalClose = jest.fn();
    const addMapLayer = jest.fn();
    const layerInfo = {
      layerProps: { name: "GeoJSON No Geojson" },
      sourceProps: {
        type: "GeoJSON",
        props: {},
        // No geojson key.
      },
    };

    render(
      <TestingComponent
        showModal={true}
        handleModalClose={handleModalClose}
        addMapLayer={addMapLayer}
        layerInfo={layerInfo}
      />,
    );

    fireEvent.click(await screen.findByLabelText("Create Layer Button"));
    await waitFor(() => {
      expect(addMapLayer).toHaveBeenCalledTimes(1);
    });
    expect(
      addMapLayer.mock.calls[0][0].configuration.props.source.geojson,
    ).toBe("");
  });

  test("a ramp-styled GeoTIFF always guards the alpha band", async () => {
    // Exercises the right side of the hasNodata predicate: other ramp tests
    // leave nodata unset, so only the Zarr short-circuit is covered there.
    const handleModalClose = jest.fn();
    const addMapLayer = jest.fn();
    const layerInfo = {
      layerProps: { name: "Nodata Ramp GeoTIFF" },
      sourceProps: {
        type: "GeoTIFF",
        props: { url: "x.tif" },
        rampName: "viridis",
        rampMin: "0",
        rampMax: "100",
      },
    };

    render(
      <TestingComponent
        showModal={true}
        handleModalClose={handleModalClose}
        addMapLayer={addMapLayer}
        layerInfo={layerInfo}
      />,
    );

    fireEvent.click(await screen.findByLabelText("Create Layer Button"));
    await waitFor(() => {
      expect(addMapLayer).toHaveBeenCalledTimes(1);
    });

    // hasNodata=true wraps the interpolate in a `case` against band 2.
    const color = addMapLayer.mock.calls[0][0].configuration.style.color;
    expect(color[0]).toBe("case");
    expect(color[1]).toEqual(["==", ["band", 2], 0]);
  });
});

describe("MapLayerModal GeoJSON URL/filename path", () => {
  test("save with a GeoJSON URL string stores it directly without uploading", async () => {
    // Covers line 306: when sourceProps.geojson is a non-empty string that
    // doesn't start with `{` or `[`, save bypasses the saveLayerJSON upload
    // and stores the URL/filename directly on source.geojson.
    const uploadSpy = jest
      .spyOn(appAPI, "uploadJSON")
      .mockResolvedValue({ success: true, filename: "should-not-upload.json" });
    const handleModalClose = jest.fn();
    const addMapLayer = jest.fn();
    const layerInfo = {
      layerProps: { name: "Remote GeoJSON" },
      sourceProps: {
        type: "GeoJSON",
        props: {},
        geojson: "https://example.com/data.geojson",
      },
    };

    render(
      <TestingComponent
        showModal={true}
        handleModalClose={handleModalClose}
        addMapLayer={addMapLayer}
        layerInfo={layerInfo}
      />,
    );

    fireEvent.click(await screen.findByLabelText("Create Layer Button"));
    await waitFor(() => {
      expect(addMapLayer).toHaveBeenCalledTimes(1);
    });

    const savedSource = addMapLayer.mock.calls[0][0].configuration.props.source;
    // URL was stored verbatim — no upload roundtrip.
    expect(savedSource.geojson).toBe("https://example.com/data.geojson");
    expect(uploadSpy).not.toHaveBeenCalled();
  });
});

describe("MapLayerModal categorical raster save path", () => {
  const renderCategorical = (sourceProps, addMapLayer) =>
    render(
      <TestingComponent
        showModal={true}
        handleModalClose={jest.fn()}
        addMapLayer={addMapLayer}
        layerInfo={{
          layerProps: { name: "Land Use" },
          sourceProps: {
            type: "GeoTIFF",
            rampName: "turbo",
            props: { url: "lu.tif" },
            ...sourceProps,
          },
        }}
      />,
    );

  test("saves a match style, the class list, and normalize off", async () => {
    const addMapLayer = jest.fn();
    renderCategorical(
      {
        styleMode: "categorical",
        classes: [
          { value: "0", color: "#aaa", label: "Bare" },
          { value: "1", color: "#bbb", label: "Crop" },
        ],
        fallbackColor: "#999999",
      },
      addMapLayer,
    );

    fireEvent.click(await screen.findByLabelText("Create Layer Button"));
    await waitFor(() => expect(addMapLayer).toHaveBeenCalledTimes(1));

    const saved = addMapLayer.mock.calls[0][0];
    const source = saved.configuration.props.source;
    expect(source.styleMode).toBe("categorical");
    expect(source.classes).toHaveLength(2);
    expect(source.fallbackColor).toBe("#999999");
    // Raw band values are required for the match to line up.
    expect(source.props.normalize).toBe(false);
    // Nearest neighbor: interpolated class labels fringe nodata boundaries.
    expect(source.props.interpolate).toBe(false);
    expect(saved.configuration.style.color[3][0]).toBe("match");
    // The ramp name survives so switching back does not lose the palette.
    expect(source.rampName).toBe("turbo");
  });

  test("drops half-filled class rows rather than saving them as class 0", async () => {
    const addMapLayer = jest.fn();
    renderCategorical(
      {
        styleMode: "categorical",
        classes: [
          { value: "2", color: "#ccc" },
          { value: "", color: "#ddd" },
        ],
      },
      addMapLayer,
    );

    fireEvent.click(await screen.findByLabelText("Create Layer Button"));
    await waitFor(() => expect(addMapLayer).toHaveBeenCalledTimes(1));

    const source = addMapLayer.mock.calls[0][0].configuration.props.source;
    expect(source.classes).toEqual([{ value: "2", color: "#ccc" }]);
  });

  test("falls back to the ramp when no class is usable", async () => {
    const addMapLayer = jest.fn();
    renderCategorical(
      { styleMode: "categorical", classes: [{ value: "", color: "#aaa" }] },
      addMapLayer,
    );

    fireEvent.click(await screen.findByLabelText("Create Layer Button"));
    await waitFor(() => expect(addMapLayer).toHaveBeenCalledTimes(1));

    const saved = addMapLayer.mock.calls[0][0];
    expect(saved.configuration.props.source.styleMode).toBeUndefined();
    expect(saved.configuration.style.color[3][0]).toBe("interpolate");
  });
});

describe("MapLayerModal GeoTIFF ramp round-trip persistence", () => {
  test("persists rampName/rampMin/rampMax on configuration.props.source", async () => {
    // Regression: without this, re-opening a ramp-styled GeoTIFF layer in the
    // modal shows empty ramp inputs because sourceProps doesn't carry them
    // back. StylePane reads sourceProps.rampName/rampMin/rampMax directly.
    const handleModalClose = jest.fn();
    const addMapLayer = jest.fn();
    const layerInfo = {
      layerProps: { name: "Ramped Round-Trip" },
      sourceProps: {
        type: "GeoTIFF",
        props: { url: "rt.tif" },
        rampName: "RdYlBu",
        rampMin: "277",
        rampMax: "300",
      },
    };

    render(
      <TestingComponent
        showModal={true}
        handleModalClose={handleModalClose}
        addMapLayer={addMapLayer}
        layerInfo={layerInfo}
      />,
    );
    fireEvent.click(await screen.findByLabelText("Create Layer Button"));
    await waitFor(() => {
      expect(addMapLayer).toHaveBeenCalledTimes(1);
    });

    const savedSource = addMapLayer.mock.calls[0][0].configuration.props.source;
    expect(savedSource.rampName).toBe("RdYlBu");
    expect(savedSource.rampMin).toBe("277");
    expect(savedSource.rampMax).toBe("300");
    // The generated color expression still lands on configuration.style.
    // Always guarded now: both raster types end up with a nodata value.
    const rtColor = addMapLayer.mock.calls[0][0].configuration.style.color;
    expect(rtColor[0]).toBe("case");
    expect(rtColor[3][0]).toBe("interpolate");
  });
});

describe("MapLayerModal GeoTIFF ramp-style save path (Unit 7)", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  test("saves a ramp-styled GeoTIFF as an object-literal style (bypasses saveLayerJSON)", async () => {
    // Spy on appAPI.uploadJSON — the backend call made by saveLayerJSON.
    // For GeoTIFF ramp styling, it must NOT be invoked.
    const uploadSpy = jest.spyOn(appAPI, "uploadJSON").mockResolvedValue({
      success: true,
      filename: "should-not-be-used.json",
    });

    const handleModalClose = jest.fn();
    const addMapLayer = jest.fn();
    const layerInfo = {
      layerProps: { name: "Viridis Raster" },
      sourceProps: {
        type: "GeoTIFF",
        rampName: "viridis",
        rampMin: "0",
        rampMax: "100",
        props: {
          url: "a.tif",
        },
      },
    };

    render(
      <TestingComponent
        showModal={true}
        handleModalClose={handleModalClose}
        addMapLayer={addMapLayer}
        layerInfo={layerInfo}
      />,
    );

    const createLayerButton = await screen.findByLabelText(
      "Create Layer Button",
    );
    fireEvent.click(createLayerButton);

    await waitFor(() => {
      expect(addMapLayer).toHaveBeenCalledTimes(1);
    });

    const savedConfig = addMapLayer.mock.calls[0][0];
    const savedStyle = savedConfig.configuration.style;

    // Style is an object literal, not a filename string.
    expect(typeof savedStyle).toBe("object");
    expect(savedStyle).not.toBeNull();
    expect(Array.isArray(savedStyle)).toBe(false);
    expect(savedStyle).toHaveProperty("color");
    expect(Array.isArray(savedStyle.color)).toBe(true);

    // The expression header confirms it's a WebGLTile interpolate expression.
    // ["case", <alpha guard>, <transparent>, <interpolate>]
    expect(savedStyle.color[0]).toBe("case");
    const interp = savedStyle.color[3];
    expect(interp[0]).toBe("interpolate");
    expect(interp[1]).toEqual(["linear"]);
    expect(interp[2]).toEqual(["band", 1]);
    expect(interp[3]).toBe(0);
    // Last stop pair ends at rampMax.
    expect(interp[interp.length - 2]).toBe(100);
    // Explicit range = raw band values, so the source is not normalized.
    expect(savedConfig.configuration.props.source.props.normalize).toBe(false);

    // Most important regression guard: the backend upload was NOT called.
    expect(uploadSpy).not.toHaveBeenCalled();
  });

  test("GeoTIFF with no explicit range gets a normalized style (turbo default)", async () => {
    const uploadSpy = jest
      .spyOn(appAPI, "uploadJSON")
      .mockResolvedValue({ success: true, filename: "x.json" });

    const handleModalClose = jest.fn();
    const addMapLayer = jest.fn();
    const layerInfo = {
      layerProps: { name: "Default-shader GeoTIFF" },
      sourceProps: {
        type: "GeoTIFF",
        props: {
          url: "a.tif",
        },
      },
    };

    render(
      <TestingComponent
        showModal={true}
        handleModalClose={handleModalClose}
        addMapLayer={addMapLayer}
        layerInfo={layerInfo}
      />,
    );

    const createLayerButton = await screen.findByLabelText(
      "Create Layer Button",
    );
    fireEvent.click(createLayerButton);

    await waitFor(() => {
      expect(addMapLayer).toHaveBeenCalledTimes(1);
    });

    const savedConfig = addMapLayer.mock.calls[0][0];
    const savedStyle = savedConfig.configuration.style;
    // Turbo default + normalized [0,1] interpolate; no persisted range.
    expect(Array.isArray(savedStyle.color)).toBe(true);
    expect(savedStyle.color[0]).toBe("case");
    expect(savedStyle.color[3][0]).toBe("interpolate");
    expect(savedStyle.color[3][savedStyle.color[3].length - 2]).toBe(1);
    expect(savedConfig.configuration.props.source.rampName).toBe("turbo");
    expect(savedConfig.configuration.props.source.rampMin).toBeUndefined();
    expect(savedConfig.configuration.props.source.props.normalize).toBe(true);
    expect(uploadSpy).not.toHaveBeenCalled();
  });

  test("Zarr source saves as a WebGLTile layer with a normalized turbo ramp", async () => {
    const handleModalClose = jest.fn();
    const addMapLayer = jest.fn();
    const layerInfo = {
      layerProps: { name: "Flood Depth" },
      sourceProps: {
        type: "Zarr",
        props: {
          url: "https://x/store.zarr",
          variable: "depth",
          index: "5",
        },
      },
    };

    render(
      <TestingComponent
        showModal={true}
        handleModalClose={handleModalClose}
        addMapLayer={addMapLayer}
        layerInfo={layerInfo}
      />,
    );

    fireEvent.click(await screen.findByLabelText("Create Layer Button"));
    await waitFor(() => {
      expect(addMapLayer).toHaveBeenCalledTimes(1);
    });

    const savedConfig = addMapLayer.mock.calls[0][0];
    // WebGLTile layer with the Zarr source and its fields preserved for editing.
    expect(savedConfig.configuration.type).toBe("WebGLTile");
    const source = savedConfig.configuration.props.source;
    expect(source.type).toBe("Zarr");
    expect(source.props.url).toBe("https://x/store.zarr");
    expect(source.props.variable).toBe("depth");
    expect(source.props.index).toBe("5");
    // Turbo default + per-slice auto-scaling (normalized ramp). Zarr COGs always
    // carry a -9999 nodata sentinel, so the ramp is wrapped in a transparency
    // `case` expression (a GeoTIFF with no nodata set would be bare interpolate).
    const color = savedConfig.configuration.style.color;
    expect(color[0]).toBe("case");
    expect(JSON.stringify(color)).toContain("interpolate");
    expect(source.rampName).toBe("turbo");
    expect(source.props.normalize).toBe(true);
  });

  test("GeoTIFF with rampName and empty range gets a normalized style", async () => {
    const uploadSpy = jest
      .spyOn(appAPI, "uploadJSON")
      .mockResolvedValue({ success: true, filename: "x.json" });

    const handleModalClose = jest.fn();
    const addMapLayer = jest.fn();
    const layerInfo = {
      layerProps: { name: "Auto Ramp GeoTIFF" },
      sourceProps: {
        type: "GeoTIFF",
        rampName: "viridis",
        rampMin: "",
        rampMax: "",
        props: {
          url: "a.tif",
        },
      },
    };

    render(
      <TestingComponent
        showModal={true}
        handleModalClose={handleModalClose}
        addMapLayer={addMapLayer}
        layerInfo={layerInfo}
      />,
    );

    const createLayerButton = await screen.findByLabelText(
      "Create Layer Button",
    );
    fireEvent.click(createLayerButton);

    await waitFor(() => {
      expect(addMapLayer).toHaveBeenCalledTimes(1);
    });

    const savedConfig = addMapLayer.mock.calls[0][0];
    const savedStyle = savedConfig.configuration.style;
    expect(Array.isArray(savedStyle.color)).toBe(true);
    expect(savedStyle.color[0]).toBe("case");
    expect(savedStyle.color[3][0]).toBe("interpolate");
    expect(savedStyle.color[3][savedStyle.color[3].length - 2]).toBe(1);
    expect(savedConfig.configuration.props.source.rampMin).toBeUndefined();
    expect(savedConfig.configuration.props.source.props.normalize).toBe(true);
    expect(uploadSpy).not.toHaveBeenCalled();
  });

  test("saves a half-pinned ramp range without throwing", async () => {
    // Only one bound entered. buildGeoTIFFStyleColor rejects a partial range,
    // so the save has to store the normalized placeholder and keep the bound
    // that was set — applyAutoRamp completes the other at render time.
    jest
      .spyOn(appAPI, "uploadJSON")
      .mockResolvedValue({ success: true, filename: "x.json" });

    const addMapLayer = jest.fn();
    render(
      <TestingComponent
        showModal={true}
        handleModalClose={jest.fn()}
        addMapLayer={addMapLayer}
        layerInfo={{
          layerProps: { name: "Half Pinned GeoTIFF" },
          sourceProps: {
            type: "GeoTIFF",
            rampName: "viridis",
            rampMin: "0",
            rampMax: "",
            props: { url: "a.tif" },
          },
        }}
      />,
    );

    fireEvent.click(await screen.findByLabelText("Create Layer Button"));
    await waitFor(() => expect(addMapLayer).toHaveBeenCalledTimes(1));

    const savedConfig = addMapLayer.mock.calls[0][0];
    const savedSource = savedConfig.configuration.props.source;
    // The pinned bound survives; the empty one stays absent so it gets resolved.
    expect(savedSource.rampMin).toBe("0");
    expect(savedSource.rampMax).toBeUndefined();
    // Placeholder style until the render-time resolve lands.
    expect(savedConfig.configuration.style.color[0]).toBe("case");
    expect(savedSource.props.normalize).toBe(true);
  });

  test("switching ramps on resave regenerates the color expression", async () => {
    jest
      .spyOn(appAPI, "uploadJSON")
      .mockResolvedValue({ success: true, filename: "x.json" });

    // First render: viridis.
    const addMapLayerA = jest.fn();
    const layerInfoA = {
      layerProps: { name: "Ramp Layer A" },
      sourceProps: {
        type: "GeoTIFF",
        rampName: "viridis",
        rampMin: "0",
        rampMax: "100",
        props: { url: "a.tif" },
      },
    };

    const { unmount } = render(
      <TestingComponent
        showModal={true}
        handleModalClose={jest.fn()}
        addMapLayer={addMapLayerA}
        layerInfo={layerInfoA}
      />,
    );
    fireEvent.click(await screen.findByLabelText("Create Layer Button"));
    await waitFor(() => {
      expect(addMapLayerA).toHaveBeenCalledTimes(1);
    });
    const viridisColor =
      addMapLayerA.mock.calls[0][0].configuration.style.color;
    unmount();

    // Second render: turbo.
    const addMapLayerB = jest.fn();
    const layerInfoB = {
      layerProps: { name: "Ramp Layer B" },
      sourceProps: {
        type: "GeoTIFF",
        rampName: "turbo",
        rampMin: "0",
        rampMax: "100",
        props: { url: "a.tif" },
      },
    };

    render(
      <TestingComponent
        showModal={true}
        handleModalClose={jest.fn()}
        addMapLayer={addMapLayerB}
        layerInfo={layerInfoB}
      />,
    );
    fireEvent.click(await screen.findByLabelText("Create Layer Button"));
    await waitFor(() => {
      expect(addMapLayerB).toHaveBeenCalledTimes(1);
    });
    const turboColor = addMapLayerB.mock.calls[0][0].configuration.style.color;

    // Same structure, but the color hex strings differ between the ramps.
    expect(viridisColor).toHaveLength(turboColor.length);
    // The interpolate sits inside the `case` guard, so reach through index 3.
    // Index 4 there is the first color stop: viridis starts near dark-purple,
    // turbo near dark-red — they must not match.
    expect(viridisColor[3][4]).not.toBe(turboColor[3][4]);
  });

  test("non-GeoTIFF vector layer with a style still uploads via saveLayerJSON", async () => {
    const uploadSpy = jest.spyOn(appAPI, "uploadJSON").mockResolvedValue({
      success: true,
      filename: "vector-style.json",
    });

    const handleModalClose = jest.fn();
    const addMapLayer = jest.fn();
    // Style on the layer — simulates what happens when a vector style is
    // entered in StylePane.
    const layerInfo = {
      layerProps: { name: "Vector Layer" },
      sourceProps: {
        type: "ESRI Feature Service",
        props: { url: "https://example.com", layer: "0" },
      },
      style: JSON.stringify({ version: 8, sources: {}, layers: [] }),
    };

    render(
      <TestingComponent
        showModal={true}
        handleModalClose={handleModalClose}
        addMapLayer={addMapLayer}
        layerInfo={layerInfo}
      />,
    );

    const createLayerButton = await screen.findByLabelText(
      "Create Layer Button",
    );
    fireEvent.click(createLayerButton);

    await waitFor(() => {
      expect(addMapLayer).toHaveBeenCalledTimes(1);
    });

    // Non-GeoTIFF still goes through the upload path.
    expect(uploadSpy).toHaveBeenCalledTimes(1);
    const savedStyle = addMapLayer.mock.calls[0][0].configuration.style;
    expect(savedStyle).toBe("vector-style.json");
  });

  test("GeoTIFF ramp save with rampMin === rampMax does not crash", async () => {
    jest
      .spyOn(appAPI, "uploadJSON")
      .mockResolvedValue({ success: true, filename: "x.json" });

    const addMapLayer = jest.fn();
    const layerInfo = {
      layerProps: { name: "Degenerate Ramp" },
      sourceProps: {
        type: "GeoTIFF",
        rampName: "viridis",
        rampMin: "50",
        rampMax: "50",
        props: { url: "a.tif" },
      },
    };

    render(
      <TestingComponent
        showModal={true}
        handleModalClose={jest.fn()}
        addMapLayer={addMapLayer}
        layerInfo={layerInfo}
      />,
    );

    fireEvent.click(await screen.findByLabelText("Create Layer Button"));
    await waitFor(() => {
      expect(addMapLayer).toHaveBeenCalledTimes(1);
    });

    const savedStyle = addMapLayer.mock.calls[0][0].configuration.style;
    expect(savedStyle).toHaveProperty("color");
    // All stop values collapse to 50, colors still vary.
    // Degenerate range: every stop collapses onto the same value.
    expect(savedStyle.color[3][3]).toBe(50);
    expect(savedStyle.color[3][savedStyle.color[3].length - 2]).toBe(50);
  });
});

describe("MapLayerModal save path regression for non-GeoTIFF sources", () => {
  test("Vector Tile save still splits comma-separated urls", async () => {
    const handleModalClose = jest.fn();
    const addMapLayer = jest.fn();
    const layerInfo = {
      layerProps: { name: "Vector Tile Layer" },
      sourceProps: {
        type: "Vector Tile",
        props: {
          urls: "a_url,b_url",
        },
      },
    };

    render(
      <TestingComponent
        showModal={true}
        handleModalClose={handleModalClose}
        addMapLayer={addMapLayer}
        layerInfo={layerInfo}
      />,
    );

    const createLayerButton = await screen.findByLabelText(
      "Create Layer Button",
    );
    fireEvent.click(createLayerButton);

    await waitFor(() => {
      expect(addMapLayer).toHaveBeenCalledTimes(1);
    });

    const savedProps =
      addMapLayer.mock.calls[0][0].configuration.props.source.props;
    expect(savedProps.urls).toEqual(["a_url", "b_url"]);
    expect(savedProps.sources).toBeUndefined();
  });

  test("Static Image save preserves imageExtent string", async () => {
    const handleModalClose = jest.fn();
    const addMapLayer = jest.fn();
    const layerInfo = {
      layerProps: { name: "Static Image Layer" },
      sourceProps: {
        type: "Static Image",
        props: {
          url: "https://example.com/image.png",
          projection: "EPSG:4326",
          imageExtent: "10, 20, 30, 40",
        },
      },
    };

    render(
      <TestingComponent
        showModal={true}
        handleModalClose={handleModalClose}
        addMapLayer={addMapLayer}
        layerInfo={layerInfo}
      />,
    );

    const createLayerButton = await screen.findByLabelText(
      "Create Layer Button",
    );
    fireEvent.click(createLayerButton);

    await waitFor(() => {
      expect(addMapLayer).toHaveBeenCalledTimes(1);
    });

    const savedProps =
      addMapLayer.mock.calls[0][0].configuration.props.source.props;
    expect(savedProps.url).toBe("https://example.com/image.png");
    expect(savedProps.projection).toBe("EPSG:4326");
    expect(savedProps.imageExtent).toBe("10, 20, 30, 40");
    expect(savedProps.sources).toBeUndefined();
  });
});

describe("MapLayerModal plugin layer", () => {
  test("fetchPluginDefaults sets configuration", async () => {
    const handleModalClose = jest.fn();
    const addMapLayer = jest.fn();
    const layerInfo = {
      layerProps: {},
      sourceProps: {
        type: "Stream Gauges (Dynamic)",
        source: "custom_layer_test",
        args: {},
        props: {},
      },
    };

    server.use(
      rest.get(
        "http://api.test/apps/tethysdash/visualizations/get/",
        (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              success: true,
              data: {
                configuration: {
                  layerVisibility: false,
                  props: {
                    name: "Some Plugin Layer",
                  },
                },
                attributeAliases: { test: { name: "Name Alias", id: "ID" } },
                attributeVariables: { test: { name: "Name Variable" } },
                omittedPopupAttributes: { test: ["omitted"] },
                queryable: false,
                legend: "default",
              },
            }),
            ctx.set("Content-Type", "application/json"),
          );
        },
      ),
    );

    render(
      <TestingComponent
        showModal={true}
        handleModalClose={handleModalClose}
        addMapLayer={addMapLayer}
        layerInfo={layerInfo}
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

    const fetchPluginDefaultsButton = await screen.findByLabelText(
      "Fetch plugin defaults",
    );
    fireEvent.click(fetchPluginDefaultsButton);

    expect(await screen.findByText(/Fetching/)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText(/Fetching/)).not.toBeInTheDocument();
    });

    const createLayerButton = await screen.findByLabelText(
      "Create Layer Button",
    );
    fireEvent.click(createLayerButton);

    await waitFor(() => {
      expect(addMapLayer).toHaveBeenCalledTimes(1);
    });

    expect(addMapLayer).toHaveBeenLastCalledWith({
      attributeAliases: {
        "Some Plugin Layer": {
          id: "ID",
          name: "Name Alias",
        },
      },
      attributeVariables: {
        "Some Plugin Layer": {
          name: "Name Variable",
        },
      },
      configuration: {
        layerVisibility: false,
        props: {
          layerId: 12345678,
          name: "Some Plugin Layer",
          pluginSource: {
            args: {},
            source: "custom_layer_test",
          },
          source: {
            geojson: {
              crs: {
                properties: {
                  name: "EPSG:4326",
                },
                type: "name",
              },
              features: [],
              type: "FeatureCollection",
            },
            props: {},
            type: "GeoJSON",
          },
        },
        type: "VectorLayer",
      },
      legend: "default",
      omittedPopupAttributes: {
        "Some Plugin Layer": ["omitted"],
      },
      tablePopupType: "none",
    });
  });

  test("fetchPluginDefaults sets configuration without data returned", async () => {
    const handleModalClose = jest.fn();
    const addMapLayer = jest.fn();
    const layerInfo = {
      layerProps: { name: "Plugin Layer" },
      sourceProps: {
        type: "Stream Gauges (Dynamic)",
        source: "custom_layer_test",
        args: {},
        props: {},
      },
    };

    server.use(
      rest.get(
        "http://api.test/apps/tethysdash/visualizations/get/",
        (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              success: true,
            }),
            ctx.set("Content-Type", "application/json"),
          );
        },
      ),
    );

    render(
      <TestingComponent
        showModal={true}
        handleModalClose={handleModalClose}
        addMapLayer={addMapLayer}
        layerInfo={layerInfo}
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

    const fetchPluginDefaultsButton = await screen.findByLabelText(
      "Fetch plugin defaults",
    );
    fireEvent.click(fetchPluginDefaultsButton);

    expect(await screen.findByText(/Fetching/)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText(/Fetching/)).not.toBeInTheDocument();
    });

    const createLayerButton = await screen.findByLabelText(
      "Create Layer Button",
    );
    fireEvent.click(createLayerButton);

    await waitFor(() => {
      expect(addMapLayer).toHaveBeenCalledTimes(1);
    });

    expect(addMapLayer).toHaveBeenLastCalledWith({
      configuration: {
        props: {
          layerId: 12345678,
          name: "Plugin Layer",
          pluginSource: {
            args: {},
            source: "custom_layer_test",
          },
          source: {
            geojson: {
              crs: {
                properties: {
                  name: "EPSG:4326",
                },
                type: "name",
              },
              features: [],
              type: "FeatureCollection",
            },
            props: {},
            type: "GeoJSON",
          },
        },
        type: "VectorLayer",
      },
    });
  });

  test("fetchPluginDefaults; API call not successful", async () => {
    const handleModalClose = jest.fn();
    const addMapLayer = jest.fn();
    const layerInfo = {
      layerProps: { name: "Plugin Layer" },
      sourceProps: {
        type: "Stream Gauges (Dynamic)",
        source: "custom_layer_test",
        args: {},
        props: {},
      },
    };

    server.use(
      rest.get(
        "http://api.test/apps/tethysdash/visualizations/get/",
        (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              success: false,
            }),
            ctx.set("Content-Type", "application/json"),
          );
        },
      ),
    );

    render(
      <TestingComponent
        showModal={true}
        handleModalClose={handleModalClose}
        addMapLayer={addMapLayer}
        layerInfo={layerInfo}
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

    const fetchPluginDefaultsButton = await screen.findByLabelText(
      "Fetch plugin defaults",
    );
    fireEvent.click(fetchPluginDefaultsButton);

    expect(await screen.findByText(/Fetching/)).toBeInTheDocument();

    expect(
      await screen.findByText(/Failed to fetch plugin defaults. Check logs./),
    ).toBeInTheDocument();
  });

  test("fetchPluginDefaults; API call not successful with message", async () => {
    const handleModalClose = jest.fn();
    const addMapLayer = jest.fn();
    const layerInfo = {
      layerProps: { name: "Plugin Layer" },
      sourceProps: {
        type: "Stream Gauges (Dynamic)",
        source: "custom_layer_test",
        args: {},
        props: {},
      },
    };

    server.use(
      rest.get(
        "http://api.test/apps/tethysdash/visualizations/get/",
        (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              success: false,
              data: {
                error: "Something went wrong",
              },
            }),
            ctx.set("Content-Type", "application/json"),
          );
        },
      ),
    );

    render(
      <TestingComponent
        showModal={true}
        handleModalClose={handleModalClose}
        addMapLayer={addMapLayer}
        layerInfo={layerInfo}
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

    const fetchPluginDefaultsButton = await screen.findByLabelText(
      "Fetch plugin defaults",
    );
    fireEvent.click(fetchPluginDefaultsButton);

    expect(await screen.findByText(/Fetching/)).toBeInTheDocument();

    expect(await screen.findByText(/Something went wrong/)).toBeInTheDocument();
  });

  test("fetchPluginDefaults; API call fails", async () => {
    const handleModalClose = jest.fn();
    const addMapLayer = jest.fn();
    const layerInfo = {
      layerProps: { name: "Plugin Layer" },
      sourceProps: {
        type: "Stream Gauges (Dynamic)",
        source: "custom_layer_test",
        args: {},
        props: {},
      },
    };

    const spy = jest
      .spyOn(appAPI, "getVisualizationData")
      .mockRejectedValue(new Error());

    render(
      <TestingComponent
        showModal={true}
        handleModalClose={handleModalClose}
        addMapLayer={addMapLayer}
        layerInfo={layerInfo}
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

    const fetchPluginDefaultsButton = await screen.findByLabelText(
      "Fetch plugin defaults",
    );
    fireEvent.click(fetchPluginDefaultsButton);

    expect(await screen.findByText(/Fetching/)).toBeInTheDocument();

    expect(
      await screen.findByText(/Failed to fetch plugin defaults./),
    ).toBeInTheDocument();

    spy.mockRestore();
  });

  test("fetchPluginDefaults; API call fails with message", async () => {
    const handleModalClose = jest.fn();
    const addMapLayer = jest.fn();
    const layerInfo = {
      layerProps: { name: "Plugin Layer" },
      sourceProps: {
        type: "Stream Gauges (Dynamic)",
        source: "custom_layer_test",
        args: {},
        props: {},
      },
    };

    const spy = jest
      .spyOn(appAPI, "getVisualizationData")
      .mockRejectedValue(new Error("Some error occurred"));

    render(
      <TestingComponent
        showModal={true}
        handleModalClose={handleModalClose}
        addMapLayer={addMapLayer}
        layerInfo={layerInfo}
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

    const fetchPluginDefaultsButton = await screen.findByLabelText(
      "Fetch plugin defaults",
    );
    fireEvent.click(fetchPluginDefaultsButton);

    expect(await screen.findByText(/Fetching/)).toBeInTheDocument();

    expect(await screen.findByText(/Some error occurred/)).toBeInTheDocument();

    spy.mockRestore();
  });

  test("fetchPluginDefaults filters source and pluginSource keys from scaffold layerProps", async () => {
    // Covers MapLayer.js line 495 — the filter callback inside
    // fetchPluginDefaults that strips `source` and `pluginSource` from the
    // scaffold's configuration.props before they become layerProps. Other
    // keys (opacity, name) pass through.
    const handleModalClose = jest.fn();
    const addMapLayer = jest.fn();
    const layerInfo = {
      layerProps: { name: "Plugin Layer" },
      sourceProps: {
        type: "Stream Gauges (Dynamic)",
        source: "custom_layer_test",
        args: {},
        props: {},
      },
    };

    server.use(
      rest.get(
        "http://api.test/apps/tethysdash/visualizations/get/",
        (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              success: true,
              data: {
                configuration: {
                  props: {
                    name: "Scaffold Name",
                    opacity: 0.7,
                    source: { type: "GeoJSON", props: {} },
                    pluginSource: {
                      source: "custom_layer_test",
                      args: {},
                    },
                  },
                },
              },
            }),
            ctx.set("Content-Type", "application/json"),
          );
        },
      ),
    );

    render(
      <TestingComponent
        showModal={true}
        handleModalClose={handleModalClose}
        addMapLayer={addMapLayer}
        layerInfo={layerInfo}
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

    fireEvent.click(await screen.findByLabelText("Fetch plugin defaults"));

    // Wait for the scaffold to be applied: opacity 0.7 propagates into
    // layerProps and renders in the Layer pane's property table. This proves
    // the filter at line 495 has run and setLayerProps has flushed before we
    // click Save.
    fireEvent.click(screen.getByText("Layer"));
    await waitFor(() => {
      expect(screen.getByDisplayValue("0.7")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Create Layer Button"));

    await waitFor(() => {
      expect(addMapLayer).toHaveBeenCalledTimes(1);
    });

    const saved = addMapLayer.mock.calls[0][0];
    // Non-source/non-pluginSource scaffold prop survived the filter.
    expect(saved.configuration.props.opacity).toBe(0.7);
    // User-set name is preserved over the scaffold's "Scaffold Name".
    expect(saved.configuration.props.name).toBe("Plugin Layer");
    // saveLayer's runtime branch overwrites source with the placeholder
    // GeoJSON FC — proving the scaffold's source object never bled into
    // layerProps and then back out via the spread.
    expect(saved.configuration.props.source.type).toBe("GeoJSON");
    expect(saved.configuration.props.source.geojson.features).toEqual([]);
    // pluginSource is rebuilt from sourceProps, not the scaffold's value.
    expect(saved.configuration.props.pluginSource).toEqual({
      source: "custom_layer_test",
      args: {},
    });
  });
});

describe("MapLayerModal Popup pane (in-memory popup config)", () => {
  // popupConfig now lives entirely in the layer's args_string and rides
  // along with the rest of the dashboard save — no separate API call,
  // no premature DB persistence. These tests assert the in-memory
  // attach (no spy on appAPI.updatePopup; that function no longer exists).

  test("renders the Custom Modal Popup tab alongside the existing tabs", async () => {
    const handleModalClose = jest.fn();
    const addMapLayer = jest.fn();
    render(
      <TestingComponent
        showModal={true}
        handleModalClose={handleModalClose}
        addMapLayer={addMapLayer}
        layerInfo={{}}
      />,
    );

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Custom Modal Popup")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Custom Modal Popup"));
    expect(
      await screen.findByLabelText("Enable Custom Popup Modal"),
    ).not.toBeChecked();
  });

  test("saving a layer with the modal popup enabled attaches popupConfig to mapConfiguration", async () => {
    const handleModalClose = jest.fn();
    const addMapLayer = jest.fn();
    render(
      <TestingComponent
        showModal={true}
        handleModalClose={handleModalClose}
        addMapLayer={addMapLayer}
        layerInfo={{
          sourceProps: {
            type: "ESRI Image and Map Service",
            props: { url: "https://example.com" },
          },
          layerProps: { name: "Layer A" },
        }}
      />,
    );

    fireEvent.click(await screen.findByText("Custom Modal Popup"));
    fireEvent.click(screen.getByLabelText("Enable Custom Popup Modal"));

    fireEvent.click(await screen.findByLabelText("Create Layer Button"));

    await waitFor(() => {
      expect(addMapLayer).toHaveBeenCalled();
    });
    const passedConfig = addMapLayer.mock.calls[0][0];
    expect(passedConfig.popupConfig).toBeTruthy();
    expect(passedConfig.popupConfig.mode).toBe("modal");
  });

  test("parent modal drops zIndex to 1050 while the layout editor is open", async () => {
    const existingPopupConfig = {
      mode: "modal",
      position: { leftPct: 20, topPct: 20, widthPct: 60, heightPct: 60 },
      titleTemplate: "",
      gridItems: [],
    };
    const handleModalClose = jest.fn();
    const addMapLayer = jest.fn();
    render(
      <TestingComponent
        showModal={true}
        handleModalClose={handleModalClose}
        addMapLayer={addMapLayer}
        layerInfo={{
          sourceProps: {
            type: "ESRI Image and Map Service",
            props: { url: "https://example.com" },
          },
          layerProps: { name: "Layer B" },
          popupConfig: existingPopupConfig,
        }}
      />,
    );

    fireEvent.click(await screen.findByText("Custom Modal Popup"));
    fireEvent.click(await screen.findByLabelText("Edit Popup Layout Button"));

    await waitFor(() => {
      const dialogs = screen.getAllByRole("dialog");
      const outer = dialogs.find((d) => d.className.includes("map-layer"));
      expect(outer.style.zIndex).toBe("1050");
    });
  });

  // Covers the `onClose: () => setShowLayoutEditor(false)` handler at
  // MapLayer.js:723. Cancel must unmount the editor, drop the parent
  // modal's zIndex back to undefined, and discard any local edits made
  // inside the editor (i.e., `popupConfig.gridItems` is unchanged).
  test("cancelling the layout editor closes it and discards in-editor edits", async () => {
    const seedGridItem = {
      i: "1",
      x: 0,
      y: 0,
      w: 4,
      h: 4,
      source: "Text",
      args_string: "{}",
      metadata_string: "{}",
      uuid: "seed-uuid",
      id: null,
    };
    const existingPopupConfig = {
      mode: "modal",
      position: { leftPct: 20, topPct: 20, widthPct: 60, heightPct: 60 },
      titleTemplate: "",
      gridItems: [seedGridItem],
    };
    const handleModalClose = jest.fn();
    const addMapLayer = jest.fn();
    render(
      <TestingComponent
        showModal={true}
        handleModalClose={handleModalClose}
        addMapLayer={addMapLayer}
        layerInfo={{
          sourceProps: {
            type: "ESRI Image and Map Service",
            props: { url: "https://example.com" },
          },
          layerProps: { name: "Layer C" },
          popupConfig: existingPopupConfig,
        }}
      />,
    );

    fireEvent.click(await screen.findByText("Custom Modal Popup"));
    fireEvent.click(await screen.findByLabelText("Edit Popup Layout Button"));

    expect(
      await screen.findByLabelText("Popup Layout Editor Modal"),
    ).toBeInTheDocument();

    // Diverge the editor's local state from the seed so cancelling has
    // something concrete to discard.
    fireEvent.click(
      await screen.findByLabelText("Add Popup Visualization Button"),
    );

    fireEvent.click(screen.getByLabelText("Cancel Popup Layout Editor"));

    await waitFor(() => {
      expect(
        screen.queryByLabelText("Popup Layout Editor Modal"),
      ).not.toBeInTheDocument();
    });

    // Parent modal's style ternary returns `undefined` when neither
    // showLayoutEditor nor showingSubModal is true — inline `style` is
    // unset, so the dialog's style.zIndex reads as empty string.
    const outer = screen
      .getAllByRole("dialog")
      .find((d) => d.className.includes("map-layer"));
    expect(outer.style.zIndex).toBe("");

    fireEvent.click(screen.getByLabelText("Create Layer Button"));

    await waitFor(() => {
      expect(addMapLayer).toHaveBeenCalledTimes(1);
    });
    const passedConfig = addMapLayer.mock.calls[0][0];
    // Cancel discards the editor-local gridItem; the seed survives.
    expect(passedConfig.popupConfig.gridItems).toEqual([seedGridItem]);
  });

  // Covers the `onSave: (nextGridItems) => { setPopupConfig(...); setShowLayoutEditor(false); }`
  // handler at MapLayer.js:725-730. Save must (a) close the editor and
  // (b) propagate the edited gridItems back into popupConfig so the
  // parent modal's saveLayer carries them along.
  test("saving the layout editor propagates edited gridItems into popupConfig", async () => {
    const existingPopupConfig = {
      mode: "modal",
      position: { leftPct: 20, topPct: 20, widthPct: 60, heightPct: 60 },
      titleTemplate: "",
      gridItems: [],
    };
    const handleModalClose = jest.fn();
    const addMapLayer = jest.fn();
    render(
      <TestingComponent
        showModal={true}
        handleModalClose={handleModalClose}
        addMapLayer={addMapLayer}
        layerInfo={{
          sourceProps: {
            type: "ESRI Image and Map Service",
            props: { url: "https://example.com" },
          },
          layerProps: { name: "Layer D" },
          popupConfig: existingPopupConfig,
        }}
      />,
    );

    fireEvent.click(await screen.findByText("Custom Modal Popup"));
    fireEvent.click(await screen.findByLabelText("Edit Popup Layout Button"));
    expect(
      await screen.findByLabelText("Popup Layout Editor Modal"),
    ).toBeInTheDocument();

    fireEvent.click(
      await screen.findByLabelText("Add Popup Visualization Button"),
    );

    fireEvent.click(screen.getByLabelText("Save Popup Layout Editor"));

    await waitFor(() => {
      expect(
        screen.queryByLabelText("Popup Layout Editor Modal"),
      ).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Create Layer Button"));

    await waitFor(() => {
      expect(addMapLayer).toHaveBeenCalledTimes(1);
    });
    const passedConfig = addMapLayer.mock.calls[0][0];
    expect(passedConfig.popupConfig.gridItems).toHaveLength(1);
    const addedItem = passedConfig.popupConfig.gridItems[0];
    // Shape from buildNewGridItem in PopupLayoutEditor.js. The uuid is a
    // generated v4 string, so just assert its type rather than pinning it.
    expect(addedItem).toEqual(
      expect.objectContaining({
        i: "1",
        x: 0,
        y: 0,
        w: 20,
        h: 20,
        source: "",
        args_string: "{}",
        id: null,
      }),
    );
    // uuidv4() is exercised by buildNewGridItem; the test-file crypto
    // mock above leaves the value's exact type implementation-defined, so
    // just verify the property is present (the meaningful assertion is
    // that the editor's saved item flowed through to popupConfig).
    expect(addedItem).toHaveProperty("uuid");
  });
});

describe("rekeyAttributeMapToLayer", () => {
  test("rekeys attribute map keys to match layer name", () => {
    const attributeMap = {
      "Old Layer Name": { attributes: ["attr1", "attr2"] },
    };
    const layerName = "New Layer Name";
    const rekeyedMap = rekeyAttributeMapToLayer(attributeMap, layerName);
    expect(rekeyedMap).toEqual({
      "New Layer Name": { attributes: ["attr1", "attr2"] },
    });
  });

  test("returns empty object if original map is empty", () => {
    const attributeMap = {};
    const layerName = "Any Layer Name";
    const rekeyedMap = rekeyAttributeMapToLayer(attributeMap, layerName);
    expect(rekeyedMap).toEqual({});
  });

  test("returns original map if no map is provided", () => {
    const layerName = "Nonexistent Layer Name";
    const rekeyedMap = rekeyAttributeMapToLayer(null, layerName);
    expect(rekeyedMap).toEqual(null);
  });

  test("returns original map if map is string instead of object", () => {
    const attributeMap = "This is not an object";
    const layerName = "Any Layer Name";
    const rekeyedMap = rekeyAttributeMapToLayer(attributeMap, layerName);
    expect(rekeyedMap).toEqual("This is not an object");
  });

  test("returns original map if target layer name is not provided", () => {
    const attributeMap = {
      "Old Layer Name": { attributes: ["attr1", "attr2"] },
    };
    const rekeyedMap = rekeyAttributeMapToLayer(attributeMap, null);
    expect(rekeyedMap).toEqual({
      "Old Layer Name": { attributes: ["attr1", "attr2"] },
    });
  });
});

describe("renameLayerInAttributeProps", () => {
  test("renames layer key in attributeProps", () => {
    const attributeProps = {
      variables: {
        "Old Layer Name": {
          gauge_id: "Selected Gauge",
        },
      },
      omitted: {
        "Old Layer Name": ["_internal_id"],
      },
      aliases: {
        "Old Layer Name": {
          flow_cfs: "Flow (cfs)",
        },
      },
      queryable: true,
    };
    const oldName = "Old Layer Name";
    const newName = "New Layer Name";
    const renamedProps = renameLayerInAttributeProps(
      attributeProps,
      oldName,
      newName,
    );
    expect(renamedProps).toEqual({
      variables: {
        "New Layer Name": {
          gauge_id: "Selected Gauge",
        },
      },
      omitted: {
        "New Layer Name": ["_internal_id"],
      },
      aliases: {
        "New Layer Name": {
          flow_cfs: "Flow (cfs)",
        },
      },
      queryable: true,
    });
  });

  test("returns original props if old layer name is not found", () => {
    const attributeProps = {
      variables: {
        "Old Layer Name": {
          gauge_id: "Selected Gauge",
        },
      },
      omitted: {
        "Old Layer Name": ["_internal_id"],
      },
      aliases: {
        "Old Layer Name": {
          flow_cfs: "Flow (cfs)",
        },
      },
      queryable: true,
    };
    const oldName = "Nonexistent Layer Name";
    const newName = "New Layer Name";
    const renamedProps = renameLayerInAttributeProps(
      attributeProps,
      oldName,
      newName,
    );
    expect(renamedProps).toEqual(attributeProps);
  });

  test("returns original props if oldName or newName is not provided", () => {
    const attributeProps = {
      variables: {
        "Old Layer Name": {
          gauge_id: "Selected Gauge",
        },
      },
      omitted: {
        "Old Layer Name": ["_internal_id"],
      },
      aliases: {
        "Old Layer Name": {
          flow_cfs: "Flow (cfs)",
        },
      },
      queryable: true,
    };
    const renamedProps1 = renameLayerInAttributeProps(
      attributeProps,
      null,
      "New Layer Name",
    );
    const renamedProps2 = renameLayerInAttributeProps(
      attributeProps,
      "Old Layer Name",
      null,
    );
    expect(renamedProps1).toEqual(attributeProps);
    expect(renamedProps2).toEqual(attributeProps);
  });

  test("returns original props if the new name is the same as the old name", () => {
    const attributeProps = {
      variables: {
        "Layer Name": {
          gauge_id: "Selected Gauge",
        },
      },
      omitted: {
        "Layer Name": ["_internal_id"],
      },
      aliases: {
        "Layer Name": {
          flow_cfs: "Flow (cfs)",
        },
      },
      queryable: true,
    };
    const renamedProps = renameLayerInAttributeProps(
      attributeProps,
      "Layer Name",
      "Layer Name",
    );
    expect(renamedProps).toEqual(attributeProps);
  });
});

describe("normalizeAttributePropsForLayer", () => {
  test("returns normalized attributeProps for a given layer", () => {
    const attributeProps = {
      variables: {
        "Layer Name": {
          gauge_id: "Selected Gauge",
        },
      },
      omitted: {
        "Layer Name": ["_internal_id"],
      },
      aliases: {
        "Layer Name": {
          flow_cfs: "Flow (cfs)",
        },
      },
      queryable: true,
    };
    const layerName = "New Layer Name";
    const normalizedProps = normalizeAttributePropsForLayer(
      attributeProps,
      layerName,
    );
    expect(normalizedProps).toEqual({
      variables: {
        "New Layer Name": {
          gauge_id: "Selected Gauge",
        },
      },
      omitted: {
        "New Layer Name": ["_internal_id"],
      },
      aliases: {
        "New Layer Name": {
          flow_cfs: "Flow (cfs)",
        },
      },
      queryable: true,
    });
  });

  test("returns original props if the target layer name is not provided", () => {
    const attributeProps = {
      variables: {
        "Layer Name": {
          gauge_id: "Selected Gauge",
        },
      },
      omitted: {
        "Layer Name": ["_internal_id"],
      },
      aliases: {
        "Layer Name": {
          flow_cfs: "Flow (cfs)",
        },
      },
      queryable: true,
    };
    const normalizedProps = normalizeAttributePropsForLayer(
      attributeProps,
      null,
    );
    expect(normalizedProps).toEqual(attributeProps);
  });
});

describe("getLayerType", () => {
  test("GeoTIFF short-circuits to WebGLTile before substring checks", () => {
    expect(getLayerType("GeoTIFF")).toBe("WebGLTile");
  });

  test("Zarr maps to WebGLTile (renders as a COG)", () => {
    expect(getLayerType("Zarr")).toBe("WebGLTile");
  });

  test("Vector source types map to VectorTileLayer", () => {
    expect(getLayerType("Vector Tile")).toBe("VectorTileLayer");
    expect(getLayerType("Vector")).toBe("VectorTileLayer");
  });

  test("Raster source types map to WebGLTile", () => {
    expect(getLayerType("PMTiles Raster")).toBe("WebGLTile");
    expect(getLayerType("Raster")).toBe("WebGLTile");
  });

  test("Tile source types map to TileLayer", () => {
    expect(getLayerType("Image Tile")).toBe("TileLayer");
  });

  test("Image / WMS source types map to ImageLayer", () => {
    expect(getLayerType("WMS")).toBe("ImageLayer");
    expect(getLayerType("Static Image")).toBe("ImageLayer");
    expect(getLayerType("ESRI Image and Map Service")).toBe("ImageLayer");
  });

  test("Unknown source types fall back to VectorLayer", () => {
    expect(getLayerType("GeoJSON")).toBe("VectorLayer");
    expect(getLayerType("KML")).toBe("VectorLayer");
  });
});

TestingComponent.propTypes = {
  showModal: PropTypes.bool,
  handleModalClose: PropTypes.func,
  addMapLayer: PropTypes.func,
  layerInfo: PropTypes.object,
  mapLayers: PropTypes.array,
  existingLayerOriginalName: PropTypes.object,
  dynamicMapLayers: PropTypes.array,
};

ExtentTestComponent.propTypes = {
  layerInfo: PropTypes.object,
  visualizationRefOverride: PropTypes.object,
};

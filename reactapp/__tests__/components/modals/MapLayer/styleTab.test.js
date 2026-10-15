import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MapLayerModal from "components/modals/MapLayer/MapLayer";
import {
  AppContext,
  LayoutContext,
  TabContext,
  VariableInputsContext,
} from "components/contexts/Contexts";

jest.mock("components/map/utilities", () => {
  const originalModule = jest.requireActual("components/map/utilities");
  return {
    ...originalModule,
    getLayerAttributes: jest.fn(),
    getStyleFields: jest.fn().mockResolvedValue([]),
  };
});

const mountModal = (layerInfo) => {
  const addMapLayer = jest.fn();
  render(
    <AppContext.Provider
      value={{ csrf: "csrf", mapLayerTemplates: [], dynamicMapLayers: [] }}
    >
      <LayoutContext.Provider value={{ uuid: "123" }}>
        <TabContext.Provider value={{ activeTabId: "tab-1" }}>
          <VariableInputsContext.Provider
            value={{ variableInputValues: {}, variableInputDateFormats: {} }}
          >
            <MapLayerModal
              showModal={true}
              handleModalClose={jest.fn()}
              addMapLayer={addMapLayer}
              layerInfo={layerInfo}
            />
          </VariableInputsContext.Provider>
        </TabContext.Provider>
      </LayoutContext.Provider>
    </AppContext.Provider>,
  );
  return addMapLayer;
};

// These draw the styling they were published with.
const UNSTYLEABLE_SOURCES = [
  "ESRI Image and Map Service",
  "WMS",
  "KML",
  "Image Tile",
  "Vector Tile",
  "PMTiles Raster",
];

const STYLEABLE_SOURCES = [
  "GeoJSON",
  "ESRI Feature Service",
  "PMTiles Vector",
  "Shapefile",
  "GeoPackage",
  "GeoParquet",
  "GeoTIFF",
  "Zarr",
];

test.each(UNSTYLEABLE_SOURCES)("a %s layer has no Style tab", async (type) => {
  mountModal({
    sourceProps: { type, props: { url: "https://example.com/service" } },
    layerProps: { name: "Layer" },
  });

  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  expect(screen.queryByRole("tab", { name: "Style" })).not.toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "Legend" })).toBeInTheDocument();
});

test.each(STYLEABLE_SOURCES)("a %s layer keeps its Style tab", async (type) => {
  mountModal({
    sourceProps: { type, props: { url: "https://example.com/data" } },
    layerProps: { name: "Layer" },
  });

  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "Style" })).toBeInTheDocument();
});

test("a new layer shows no Style tab until its source type is chosen", async () => {
  mountModal({});

  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  expect(screen.queryByRole("tab", { name: "Style" })).not.toBeInTheDocument();
});

test("a style left over from another source type is not saved", async () => {
  const addMapLayer = mountModal({
    sourceProps: {
      type: "ESRI Image and Map Service",
      props: { url: "https://example.com/MapServer" },
    },
    layerProps: { name: "Radar" },
    style: "old_style.json",
  });

  fireEvent.click(await screen.findByLabelText("Create Layer Button"));
  await waitFor(() => expect(addMapLayer).toHaveBeenCalled());
  expect(addMapLayer.mock.calls[0][0].configuration).not.toHaveProperty(
    "style",
  );
});

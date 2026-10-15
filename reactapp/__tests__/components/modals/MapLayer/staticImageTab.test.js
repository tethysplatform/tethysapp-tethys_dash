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

const staticImageSource = {
  type: "Static Image",
  props: {
    url: "https://example.com/forecast.gif",
    projection: "EPSG:3857",
    imageExtent: "-9949812.64, 3474527.91, -9818534.97, 3551750.07",
  },
};

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

const savedConfig = async (addMapLayer) => {
  fireEvent.click(screen.getByLabelText("Create Layer Button"));
  await waitFor(() => expect(addMapLayer).toHaveBeenCalled());
  return addMapLayer.mock.calls[0][0];
};

const DATA_TABS = [
  "Style",
  "Labels",
  "Legend",
  "Attributes/Table Popup",
  "Custom Modal Popup",
];

test("a Static Image layer shows only the Layer and Source tabs", async () => {
  mountModal({
    sourceProps: staticImageSource,
    layerProps: { name: "Forecast" },
  });

  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "Layer" })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "Source" })).toBeInTheDocument();
  for (const tab of DATA_TABS) {
    expect(screen.queryByRole("tab", { name: tab })).not.toBeInTheDocument();
  }
});

test("saving writes only the layer and source settings, off every query", async () => {
  const addMapLayer = mountModal({
    sourceProps: staticImageSource,
    layerProps: { name: "Forecast" },
    // Left over from before these tabs were hidden: dropped on save, since
    // nothing could show or remove them any more.
    legend: {
      title: "Old",
      items: [{ label: "x", color: "red", symbol: "square" }],
    },
    style: "old_style.json",
    popupConfig: { mode: "modal", gridItems: [] },
    attributeProps: { aliases: { a: { b: "c" } }, variables: {}, omitted: {} },
  });

  expect(await savedConfig(addMapLayer)).toEqual({
    configuration: {
      type: "ImageLayer",
      props: {
        name: "Forecast",
        source: staticImageSource,
      },
    },
    tablePopupType: "none",
  });
});

test("a Static Image layer saved while hidden stays hidden", async () => {
  const addMapLayer = mountModal({
    sourceProps: staticImageSource,
    layerProps: { name: "Forecast", layerVisibility: false },
  });

  const saved = await savedConfig(addMapLayer);
  expect(saved.configuration.layerVisibility).toBe(false);
  expect(saved.configuration.props).not.toHaveProperty("layerVisibility");
});

test("other image layers keep their data tabs", async () => {
  mountModal({
    sourceProps: {
      type: "ESRI Image and Map Service",
      props: { url: "https://example.com/MapServer" },
    },
    layerProps: { name: "Gauges" },
  });

  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  for (const tab of ["Style", "Legend", "Attributes/Table Popup"]) {
    expect(screen.getByRole("tab", { name: tab })).toBeInTheDocument();
  }
});

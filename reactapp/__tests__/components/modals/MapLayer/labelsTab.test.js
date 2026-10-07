/* eslint-disable no-template-curly-in-string */
// The label template syntax under test is literal `${feature.<key>}` text.
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MapLayerModal from "components/modals/MapLayer/MapLayer";
import {
  AppContext,
  LayoutContext,
  TabContext,
  VariableInputsContext,
} from "components/contexts/Contexts";
import { POPUP_TAB_ID } from "components/map/viewGroup";
import { getLayerAttributes } from "components/map/utilities";

jest.mock("components/map/utilities", () => {
  const originalModule = jest.requireActual("components/map/utilities");
  return {
    ...originalModule,
    getLayerAttributes: jest.fn(),
    // StylePane's own field discovery fires on mount for every pane the Tabs
    // render. It is not what these tests are about, and left real it reaches
    // the network on every case.
    getStyleFields: jest.fn().mockResolvedValue([]),
  };
});
const mockedGetLayerAttributes = jest.mocked(getLayerAttributes);

const vectorLayerInfo = {
  sourceProps: {
    type: "ESRI Feature Service",
    props: { url: "https://example.com/FeatureServer", layer: 1 },
  },
  layerProps: { name: "Gauges" },
};

const rasterLayerInfo = {
  sourceProps: {
    type: "GeoTIFF",
    props: { url: "https://example.com/raster.tif" },
  },
  layerProps: { name: "Depth" },
};

const mountModal = ({
  layerInfo,
  addMapLayer = jest.fn(),
  activeTabId = "tab-1",
  dynamicMapLayers = [],
} = {}) => {
  render(
    <AppContext.Provider
      value={{ csrf: "csrf", mapLayerTemplates: [], dynamicMapLayers }}
    >
      <LayoutContext.Provider value={{ uuid: "123" }}>
        <TabContext.Provider value={{ activeTabId }}>
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

const openLabelsTab = () => fireEvent.click(screen.getByText("Labels"));

const savedConfig = async (addMapLayer) => {
  fireEvent.click(screen.getByLabelText("Create Layer Button"));
  await waitFor(() => expect(addMapLayer).toHaveBeenCalled());
  return addMapLayer.mock.calls[0][0];
};

beforeEach(() => {
  mockedGetLayerAttributes.mockReset();
});

test("the Labels tab renders for a vector layer", async () => {
  mountModal({ layerInfo: vectorLayerInfo });

  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  expect(screen.getByText("Labels")).toBeInTheDocument();

  openLabelsTab();
  expect(await screen.findByTestId("labels-pane")).toBeInTheDocument();
});

test("the Labels tab does not render for a raster layer", async () => {
  mountModal({ layerInfo: rasterLayerInfo });

  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  // The Style tab is still there, so this is the labels gate rather than a
  // modal that failed to render.
  expect(screen.getByText("Style")).toBeInTheDocument();
  expect(screen.queryByText("Labels")).not.toBeInTheDocument();
});

test("the Labels tab does not render on a popup-nested map", async () => {
  mountModal({ layerInfo: vectorLayerInfo, activeTabId: POPUP_TAB_ID });

  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  expect(screen.getByText("Style")).toBeInTheDocument();
  expect(screen.queryByText("Labels")).not.toBeInTheDocument();
});

test("a saved label reopens showing its values", async () => {
  mountModal({
    layerInfo: {
      ...vectorLayerInfo,
      layerProps: {
        ...vectorLayerInfo.layerProps,
        labelConfig: {
          template: "${feature.station_id}",
          anchor: "top",
          color: "#ff0000",
          size: 18,
          minZoom: 7,
        },
      },
    },
  });

  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  openLabelsTab();

  expect(await screen.findByLabelText("Template")).toHaveValue(
    "${feature.station_id}",
  );
  expect(screen.getByLabelText("Size")).toHaveValue("18");
  expect(screen.getByLabelText("Label Minimum Zoom")).toHaveValue("7");
});

test("editing an unrelated field preserves the label config through pruning", async () => {
  const addMapLayer = mountModal({
    layerInfo: {
      ...vectorLayerInfo,
      layerProps: {
        ...vectorLayerInfo.layerProps,
        labelConfig: { template: "${feature.name}", size: 14, minZoom: 5 },
      },
    },
  });

  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Name Input"), {
    target: { value: "Renamed Gauges" },
  });

  const config = await savedConfig(addMapLayer);
  expect(config.configuration.props.name).toBe("Renamed Gauges");
  expect(config.configuration.props.labelConfig).toEqual({
    template: "${feature.name}",
    size: 14,
    minZoom: 5,
  });
});

test("a zero-like label size and zoom floor survive the save", async () => {
  const addMapLayer = mountModal({
    layerInfo: {
      ...vectorLayerInfo,
      layerProps: {
        ...vectorLayerInfo.layerProps,
        labelConfig: { template: "${feature.name}", size: 12, minZoom: 6 },
      },
    },
  });

  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  openLabelsTab();

  fireEvent.change(await screen.findByLabelText("Size"), {
    target: { value: "0" },
  });
  fireEvent.change(screen.getByLabelText("Label Minimum Zoom"), {
    target: { value: "0" },
  });

  const config = await savedConfig(addMapLayer);
  expect(config.configuration.props.labelConfig).toMatchObject({
    template: "${feature.name}",
    size: 0,
    minZoom: 0,
  });
});

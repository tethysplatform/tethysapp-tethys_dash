import { render, waitFor } from "@testing-library/react";
import MapVisualization from "components/visualizations/Map";
import {
  AppContext,
  DataViewerModeContext,
  LayoutContext,
  TabContext,
  VariableInputsContext,
} from "components/contexts/Contexts";
import MapContextProvider from "components/contexts/MapContext";
import { POPUP_TAB_ID } from "components/map/viewGroup";

// The OpenLayers map is not what is under test here: this file is about which
// layer configs the visualization hands down. Standing in for the map component
// lets the configs be read directly, instead of inferred from a rendered style.
const receivedLayers = { current: null };
jest.mock("components/map/Map", () => {
  // eslint-disable-next-line react/prop-types -- a one-prop test stand-in.
  const MockMapComponent = ({ layers }) => {
    receivedLayers.current = layers;
    return <div data-testid="mock-map" />;
  };
  return MockMapComponent;
});

const labelledLayer = () => ({
  configuration: {
    type: "VectorLayer",
    props: {
      name: "Gauges",
      source: { type: "GeoJSON", props: {}, geojson: "some.json" },
    },
    labels: { template: "${feature.name}", size: 14 }, // eslint-disable-line no-template-curly-in-string
  },
});

const renderMap = (activeTabId) =>
  render(
    <AppContext.Provider value={{ sessionNonce: "test-nonce" }}>
      <LayoutContext.Provider value={{ uuid: "dashboard-uuid" }}>
        <DataViewerModeContext.Provider value={{ inDataViewerMode: false }}>
          <VariableInputsContext.Provider
            value={{
              variableInputValues: {},
              variableInputDateFormats: {},
              setVariableInputValues: jest.fn(),
            }}
          >
            <TabContext.Provider value={{ activeTabId }}>
              <MapContextProvider>
                <MapVisualization
                  mapConfig={{}}
                  mapExtent={{}}
                  layers={[labelledLayer()]}
                  baseMap="OpenStreetMap"
                />
              </MapContextProvider>
            </TabContext.Provider>
          </VariableInputsContext.Provider>
        </DataViewerModeContext.Provider>
      </LayoutContext.Provider>
    </AppContext.Provider>,
  );

const gaugesLayer = () =>
  (receivedLayers.current ?? []).find(
    (layer) => layer?.props?.name === "Gauges",
  );

beforeEach(() => {
  receivedLayers.current = null;
});

test("a map outside a popup keeps its layers' label config", async () => {
  renderMap("tab-1");
  await waitFor(() => expect(gaugesLayer()).toBeTruthy());
  expect(gaugesLayer().labels).toEqual({
    template: "${feature.name}", // eslint-disable-line no-template-curly-in-string
    size: 14,
  });
});

test("a map nested in a popup is handed its layers with no label config", async () => {
  renderMap(POPUP_TAB_ID);
  await waitFor(() => expect(gaugesLayer()).toBeTruthy());
  // Dropped at render, so a label saved before the layer was reused in a popup
  // -- or one a plugin supplied -- never reaches the map.
  expect(gaugesLayer()).not.toHaveProperty("labels");
  // ...and the rest of the layer is untouched.
  expect(gaugesLayer().props.name).toBe("Gauges");
  expect(gaugesLayer().props.source).toBeTruthy();
});

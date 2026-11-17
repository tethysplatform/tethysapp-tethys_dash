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
import { ANNOTATION_GROUP_KEY } from "components/map/annotationGroups";

// Which layer configs the visualization hands the map, read directly from a
// stand-in map component, as in Map.labels.test.js.
const receivedLayers = { current: null };
jest.mock("components/map/Map", () => {
  // eslint-disable-next-line react/prop-types -- a one-prop test stand-in.
  const MockMapComponent = ({ layers }) => {
    receivedLayers.current = layers;
    return <div data-testid="mock-map" />;
  };
  return MockMapComponent;
});

const stationsLayer = () => ({
  configuration: {
    type: "VectorLayer",
    props: {
      name: "Stations",
      source: { type: "GeoJSON", props: {}, geojson: "stations.json" },
    },
  },
});

const groups = [
  {
    name: "Flood notes",
    defaults: { lineColor: "#0000ff" },
    items: [{ id: "a1", kind: "text", coordinates: [-105, 40], text: "Gauge" }],
  },
  { name: "Site visits", defaults: {}, items: [] },
];

const renderMap = (annotationGroups) =>
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
            <TabContext.Provider value={{ activeTabId: "tab-1" }}>
              <MapContextProvider>
                <MapVisualization
                  mapConfig={{}}
                  mapExtent={{}}
                  layers={[stationsLayer()]}
                  annotationGroups={annotationGroups}
                />
              </MapContextProvider>
            </TabContext.Provider>
          </VariableInputsContext.Provider>
        </DataViewerModeContext.Provider>
      </LayoutContext.Provider>
    </AppContext.Provider>,
  );

// No base map is configured, so every config handed down is a layer's.
const nonBaseLayers = () => receivedLayers.current ?? [];

beforeEach(() => {
  receivedLayers.current = null;
});

test("annotation groups are drawn after the map's layers, in group order", async () => {
  renderMap(groups);
  await waitFor(() => expect(nonBaseLayers()).toHaveLength(3));

  const [stations, flood, visits] = nonBaseLayers();
  expect(stations.props.name).toBe("Stations");
  expect(flood.props.title).toBe("Flood notes");
  expect(flood.props[ANNOTATION_GROUP_KEY]).toBe("Flood notes");
  expect(flood.props.source.type).toBe("Annotations");
  expect(flood.annotations.items).toEqual(groups[0].items);
  expect(visits.props.title).toBe("Site visits");
  expect(stations.props.zIndex).toBeLessThan(flood.props.zIndex);
  expect(flood.props.zIndex).toBeLessThan(visits.props.zIndex);
});

test("a map with no annotation groups gets only its own layers", async () => {
  renderMap(undefined);
  await waitFor(() => expect(nonBaseLayers()).toHaveLength(1));
  expect(nonBaseLayers()[0].props.name).toBe("Stations");
});

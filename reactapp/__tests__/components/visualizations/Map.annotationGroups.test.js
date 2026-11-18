import { act, render, waitFor } from "@testing-library/react";
import MapVisualization from "components/visualizations/Map";
import {
  AppContext,
  DataViewerModeContext,
  EditingContext,
  GridItemContext,
  LayoutContext,
  TabContext,
  VariableInputsContext,
} from "components/contexts/Contexts";
import MapContextProvider from "components/contexts/MapContext";
import { ANNOTATION_GROUP_KEY } from "components/map/annotationGroups";

// What the visualization hands the map, read directly from a stand-in map
// component, as in Map.labels.test.js.
const receivedLayers = { current: null };
const receivedProps = { current: null };
jest.mock("components/map/Map", () => {
  /* eslint-disable react/prop-types -- a test stand-in, not a component. */
  const MockMapComponent = (props) => {
    receivedLayers.current = props.layers;
    receivedProps.current = props;
    return <div data-testid="mock-map" />;
  };
  /* eslint-enable react/prop-types */
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
  receivedProps.current = null;
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

describe("the annotation button", () => {
  const metadataString = JSON.stringify({
    refreshRate: 0,
    annotations: groups,
  });

  const renderTile = ({ isEditing }) =>
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
              <EditingContext.Provider value={{ isEditing }}>
                <TabContext.Provider
                  value={{
                    activeTabId: "tab-1",
                    updateGridItem: jest.fn(),
                  }}
                >
                  <GridItemContext.Provider
                    value={{
                      gridItemUUID: "map-uuid",
                      gridItemMetadataString: metadataString,
                    }}
                  >
                    <MapContextProvider>
                      <MapVisualization
                        mapConfig={{}}
                        mapExtent={{}}
                        layers={[stationsLayer()]}
                        annotationGroups={groups}
                      />
                    </MapContextProvider>
                  </GridItemContext.Provider>
                </TabContext.Provider>
              </EditingContext.Provider>
            </VariableInputsContext.Provider>
          </DataViewerModeContext.Provider>
        </LayoutContext.Provider>
      </AppContext.Provider>,
    );

  // A map whose layers are read the moment a click is processed.
  const fakeMap = () => ({
    getLayers: jest.fn(() => ({ getArray: () => [] })),
  });

  it("is handed to the map in edit mode, with the saved groups", () => {
    renderTile({ isEditing: true });
    expect(receivedProps.current.annotationControl.groups).toEqual(groups);
  });

  it("is not handed to the map outside edit mode", () => {
    renderTile({ isEditing: false });
    expect(receivedProps.current.annotationControl).toBeNull();
  });

  it("keeps map clicks from querying layers while a session is open", async () => {
    renderTile({ isEditing: true });

    // Control: with no session a click goes on to read the layers. The fake
    // map is only good for that first read, so what fails after it is no
    // concern of this test.
    const idle = fakeMap();
    await act(async () => {
      try {
        await receivedProps.current.onMapClick(idle, { pixel: [0, 0] });
      } catch {
        // past the point this control checks
      }
    });
    expect(idle.getLayers).toHaveBeenCalled();

    act(() =>
      receivedProps.current.annotationControl.onSessionChange({
        groupName: "Flood notes",
        layerName: "annotation-group:Flood notes",
        items: [],
      }),
    );
    const drawing = fakeMap();
    await act(() =>
      receivedProps.current.onMapClick(drawing, { pixel: [0, 0] }),
    );
    expect(drawing.getLayers).not.toHaveBeenCalled();
  });
});

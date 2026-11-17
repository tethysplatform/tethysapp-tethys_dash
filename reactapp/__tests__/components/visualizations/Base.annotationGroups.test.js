import { render, waitFor } from "@testing-library/react";
import BaseVisualization, {
  Visualization,
} from "components/visualizations/Base";
import * as utilities from "components/visualizations/utilities";
import {
  AppContext,
  EditingContext,
  GridItemContext,
  VariableInputsContext,
} from "components/contexts/Contexts";
import { WebsocketContext } from "components/contexts/WebSocketContext";

// Only the hand-off is under test: what reaches the map visualization.
const receivedProps = { current: null };
jest.mock("components/visualizations/Map", () => {
  const MockMapVisualization = (props) => {
    receivedProps.current = props;
    return <div data-testid="mock-map-visualization" />;
  };
  return MockMapVisualization;
});

const groups = [{ name: "Flood notes", defaults: {}, items: [] }];

beforeEach(() => {
  receivedProps.current = null;
});

test("a map is given the annotation groups from its settings", () => {
  render(
    <Visualization
      vizType="map"
      vizData={{ layers: [], baseMap: "OpenStreetMap" }}
      vizMetadata={{ refreshRate: 0, annotations: groups }}
    />,
  );
  expect(receivedProps.current.annotationGroups).toBe(groups);
});

test("a map whose settings hold no annotations is given none", () => {
  render(<Visualization vizType="map" vizData={{ layers: [] }} />);
  expect(receivedProps.current.annotationGroups).toBeUndefined();
});

describe("editing a map's annotations", () => {
  // Only the contexts BaseVisualization reads, so every fetch it makes is
  // counted -- a loaded dashboard would add fetches of its own.
  const renderBase = (gridItem) => (
    <AppContext.Provider value={{ visualizations: [] }}>
      <EditingContext.Provider value={{ isEditing: true }}>
        <WebsocketContext.Provider value={{ getMessageForRequest: () => null }}>
          <VariableInputsContext.Provider
            value={{
              variableInputValues: {},
              variableInputDateFormats: {},
              variableInputSliderMeta: {},
              setVariableInputValues: jest.fn(),
            }}
          >
            <GridItemContext.Provider
              value={{
                gridItemSource: gridItem.source,
                gridItemArgsString: gridItem.args_string,
                gridItemMetadataString: gridItem.metadata_string,
                gridItemUUID: "map-uuid",
                shouldLoad: true,
              }}
            >
              <BaseVisualization />
            </GridItemContext.Provider>
          </VariableInputsContext.Provider>
        </WebsocketContext.Provider>
      </EditingContext.Provider>
    </AppContext.Provider>
  );

  const settingsWith = (annotations) =>
    JSON.stringify({ refreshRate: 0, annotations });

  beforeEach(() => {
    // Stands in for the plugin call: answers with a map and counts the call.
    jest
      .spyOn(utilities, "getVisualization")
      .mockImplementation(async ({ setVizType, setVizData }) => {
        setVizType("map");
        setVizData({ layers: [] });
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ["a plugin map", "flood_plugin_map", { river: "Platte" }],
    ["the built-in map", "Map", { baseMap: "OpenStreetMap", layers: [] }],
  ])(
    "redraws %s with the new annotations without fetching it again",
    async (_label, source, args) => {
      const gridItem = {
        source,
        args_string: JSON.stringify(args),
        metadata_string: settingsWith([
          { name: "Flood notes", defaults: {}, items: [] },
        ]),
      };
      const { rerender } = render(renderBase(gridItem));
      await waitFor(() =>
        expect(receivedProps.current?.annotationGroups).toHaveLength(1),
      );
      expect(utilities.getVisualization).toHaveBeenCalledTimes(1);

      // An annotation drawn: only the settings change.
      const edited = [
        {
          name: "Flood notes",
          defaults: {},
          items: [
            { id: "a1", kind: "text", coordinates: [-105, 40], text: "Gauge" },
          ],
        },
      ];
      rerender(
        renderBase({ ...gridItem, metadata_string: settingsWith(edited) }),
      );
      await waitFor(() =>
        expect(receivedProps.current.annotationGroups).toEqual(edited),
      );
      expect(utilities.getVisualization).toHaveBeenCalledTimes(1);

      // Control: an args change still fetches, so the spy is live.
      rerender(
        renderBase({
          ...gridItem,
          args_string: JSON.stringify({ ...args, changed: true }),
          metadata_string: settingsWith(edited),
        }),
      );
      await waitFor(() =>
        expect(utilities.getVisualization).toHaveBeenCalledTimes(2),
      );
    },
  );
});

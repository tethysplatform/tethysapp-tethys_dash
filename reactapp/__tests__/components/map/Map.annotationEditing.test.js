import { useRef, useState } from "react";
import PropTypes from "prop-types";
import { act, render, screen } from "@testing-library/react";
import MapComponent from "components/map/Map";
import { GRID_DRAG_CANCEL_CLASS } from "components/dashboard/gridDragCancel";
import MapContextProvider, {
  useMapContext,
} from "components/contexts/MapContext";
import { VariableInputsContext } from "components/contexts/Contexts";
import {
  annotationGroupLayerName,
  buildAnnotationGroupLayers,
} from "components/map/annotationGroups";

global.ResizeObserver = require("resize-observer-polyfill");

// A dashboard map with one annotation group, as visualizations/Map.js hands it
// to MapComponent while the dashboard is being edited.
const group = {
  name: "Callouts",
  defaults: {},
  items: [{ id: "a1", kind: "text", coordinates: [-105, 40], text: "Gauge" }],
};
const groupLayer = () => {
  const [entry] = buildAnnotationGroupLayers([group]);
  return {
    ...entry.configuration,
    props: { ...entry.configuration.props, zIndex: 1 },
  };
};

let setSession;
const Harness = ({ withDrawing, withButton }) => {
  const visualizationRef = useRef();
  const drawing = useRef(false);
  const [session, setSessionState] = useState(null);
  setSession = setSessionState;
  const { mapReady } = useMapContext();
  return (
    <div>
      <MapComponent
        visualizationRef={visualizationRef}
        layers={[groupLayer()]}
        baseMap={null}
        mapDrawing={withDrawing ? { options: ["Point"] } : undefined}
        drawing={drawing}
        annotationControl={
          withButton
            ? {
                groups: [group],
                onGroupsChange: jest.fn(),
                session,
                onSessionChange: setSessionState,
              }
            : null
        }
      />
      <p>{mapReady ? "Map Ready" : "Map Not Ready"}</p>
    </div>
  );
};
Harness.propTypes = {
  withDrawing: PropTypes.bool,
  withButton: PropTypes.bool,
};

const renderMap = ({ withDrawing = false, withButton = true } = {}) =>
  render(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <MapContextProvider>
        <Harness withDrawing={withDrawing} withButton={withButton} />
      </MapContextProvider>
    </VariableInputsContext.Provider>,
  );

const startSession = () =>
  act(() =>
    setSession({
      groupName: group.name,
      layerName: annotationGroupLayerName(group.name),
      title: group.name,
      defaults: group.defaults,
      items: group.items,
      startItems: group.items,
    }),
  );

test("a map whose dashboard is not being edited has no button and no editor", async () => {
  renderMap({ withButton: false });
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Show Annotation Control" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("toolbar", { name: "Annotation editor" }),
  ).not.toBeInTheDocument();
});

test("the editor shows only during a session", async () => {
  renderMap();
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  expect(
    screen.queryByRole("toolbar", { name: "Annotation editor" }),
  ).not.toBeInTheDocument();

  startSession();
  expect(
    screen.getByRole("toolbar", { name: "Annotation editor" }),
  ).toBeInTheDocument();
});

// In dashboard edit mode the tile is a drag handle; during a session presses
// on the map have to draw instead, and outside one the tile moves as before.
test("the map is left out of tile dragging only during a session", async () => {
  renderMap();
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  const mapDiv = screen.getByLabelText("Map Div");
  expect(mapDiv).not.toHaveClass(GRID_DRAG_CANCEL_CLASS);

  startSession();
  expect(mapDiv).toHaveClass(GRID_DRAG_CANCEL_CLASS);
  expect(mapDiv).toHaveClass("ol-map");

  act(() => setSession(null));
  expect(mapDiv).not.toHaveClass(GRID_DRAG_CANCEL_CLASS);
});

test("the viewer drawing tool steps aside during a session and returns after", async () => {
  renderMap({ withDrawing: true });
  expect(await screen.findByTitle("Draw Point")).toBeInTheDocument();

  startSession();
  expect(screen.queryByTitle("Draw Point")).not.toBeInTheDocument();

  act(() => setSession(null));
  expect(await screen.findByTitle("Draw Point")).toBeInTheDocument();
});

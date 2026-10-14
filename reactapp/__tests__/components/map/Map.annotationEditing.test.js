import { useRef } from "react";
import PropTypes from "prop-types";
import { act, render, screen } from "@testing-library/react";
import MapComponent from "components/map/Map";
import MapContextProvider, {
  useMapContext,
} from "components/contexts/MapContext";
import { VariableInputsContext } from "components/contexts/Contexts";

global.ResizeObserver = require("resize-observer-polyfill");

const annotationsLayer = {
  type: "VectorLayer",
  props: { name: "Callouts", source: { type: "Annotations", props: {} } },
  annotations: {
    defaults: {},
    items: [{ id: "a1", kind: "text", coordinates: [-105, 40], text: "Gauge" }],
  },
};

let mapContext;
const Harness = ({ withDrawing }) => {
  const visualizationRef = useRef();
  const drawing = useRef(false);
  mapContext = useMapContext();
  return (
    <div>
      <MapComponent
        visualizationRef={visualizationRef}
        layers={[annotationsLayer]}
        baseMap={null}
        mapDrawing={withDrawing ? { options: ["Point"] } : undefined}
        drawing={drawing}
      />
      <p>{mapContext?.mapReady ? "Map Ready" : "Map Not Ready"}</p>
    </div>
  );
};
Harness.propTypes = { withDrawing: PropTypes.bool };

const renderMap = ({ inDataViewer = true, withDrawing = false } = {}) => {
  const harness = <Harness withDrawing={withDrawing} />;
  render(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      {inDataViewer ? (
        <MapContextProvider>{harness}</MapContextProvider>
      ) : (
        harness
      )}
    </VariableInputsContext.Provider>,
  );
};

const startSession = () =>
  act(() =>
    mapContext.setAnnotationEditSession({
      layerName: "Callouts",
      defaults: {},
      items: annotationsLayer.annotations.items,
    }),
  );

test("a dashboard map, outside the DataViewer, never shows the editor", async () => {
  renderMap({ inDataViewer: false });

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();
  expect(mapContext).toBeNull();
  expect(
    screen.queryByRole("toolbar", { name: "Annotation editor" }),
  ).not.toBeInTheDocument();
});

test("the DataViewer preview shows the editor only during a session", async () => {
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

test("the viewer drawing tool steps aside during a session and returns after", async () => {
  renderMap({ withDrawing: true });
  expect(await screen.findByTitle("Draw Point")).toBeInTheDocument();

  startSession();
  expect(screen.queryByTitle("Draw Point")).not.toBeInTheDocument();

  act(() => mapContext.setAnnotationEditSession(null));
  expect(await screen.findByTitle("Draw Point")).toBeInTheDocument();
});

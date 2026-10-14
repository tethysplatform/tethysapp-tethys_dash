import { useRef, useState } from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import PropTypes from "prop-types";
import MapComponent from "components/map/Map";
import MapContextProvider, {
  useMapContext,
} from "components/contexts/MapContext";
import { VariableInputsContext } from "components/contexts/Contexts";

global.ResizeObserver = require("resize-observer-polyfill");

function annotationsLayer({
  lineColor = "#000000",
  items,
  zIndex = 1,
  style,
} = {}) {
  return {
    type: "VectorLayer",
    props: {
      name: "Callouts",
      zIndex,
      source: { type: "Annotations", props: {} },
    },
    annotations: {
      defaults: { lineColor, arrowheads: "end" },
      items: items ?? [
        {
          id: "a1",
          kind: "line",
          coordinates: [
            [-105, 40],
            [-104, 40],
          ],
        },
        { id: "a2", kind: "text", coordinates: [-105, 41], text: "Gauge" },
      ],
    },
    ...(style === undefined ? {} : { style }),
  };
}

function geojsonLayer({ opacity = 1, zIndex = 0 } = {}) {
  return {
    type: "VectorLayer",
    props: {
      name: "Stations",
      opacity,
      zIndex,
      source: {
        type: "GeoJSON",
        props: {},
        geojson: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {},
              geometry: { type: "Point", coordinates: [-105, 40] },
            },
          ],
        },
      },
    },
  };
}

let mapRef;
let setLayers;

const Harness = ({ initialLayers }) => {
  const visualizationRef = useRef();
  const [layers, setLayersState] = useState(initialLayers);
  const { mapReady } = useMapContext();
  mapRef = visualizationRef;
  setLayers = setLayersState;
  return (
    <div>
      <MapComponent
        visualizationRef={visualizationRef}
        layers={layers}
        baseMap={null}
      />
      <p>{mapReady ? "Map Ready" : "Map Not Ready"}</p>
    </div>
  );
};
Harness.propTypes = { initialLayers: PropTypes.array };

const layerNamed = (name) =>
  (mapRef?.current?.getLayers?.().getArray() ?? []).find(
    (layer) => layer.get("name") === name,
  );

async function mount(initialLayers) {
  render(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <MapContextProvider>
        <Harness initialLayers={initialLayers} />
      </MapContextProvider>
    </VariableInputsContext.Provider>,
  );
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  await waitFor(() => expect(layerNamed("Callouts")).toBeTruthy());
}

const lineColorOf = (layer) => {
  const line = layer.getSource().getFeatureById("a1");
  return layer.getStyleFunction()(line, 1)[0].getStroke().getColor();
};

test("an Annotations layer is drawn with its saved items", async () => {
  await mount([geojsonLayer(), annotationsLayer()]);

  const layer = layerNamed("Callouts");
  expect(layer.getSource().getFeatures()).toHaveLength(2);
  expect(lineColorOf(layer)).toBe("#000000");
});

test("an unrelated edit keeps the same live Annotations layer", async () => {
  await mount([geojsonLayer(), annotationsLayer()]);
  const before = layerNamed("Callouts");
  const stationsBefore = layerNamed("Stations");

  act(() => setLayers([geojsonLayer({ opacity: 0.4 }), annotationsLayer()]));

  // The GeoJSON layer is rebuilt, as it always has been...
  await waitFor(() => expect(layerNamed("Stations")).not.toBe(stationsBefore));
  // ...while the Annotations layer, whose config did not change, is kept.
  expect(layerNamed("Callouts")).toBe(before);
});

test("an identical config in a new object still keeps the layer", async () => {
  await mount([annotationsLayer()]);
  const before = layerNamed("Callouts");

  act(() => setLayers([annotationsLayer()]));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  expect(layerNamed("Callouts")).toBe(before);
});

test("editing the layer default rebuilds it with the new style (AE1)", async () => {
  const overridden = [
    {
      id: "a1",
      kind: "line",
      coordinates: [
        [-105, 40],
        [-104, 40],
      ],
    },
    {
      id: "a3",
      kind: "line",
      coordinates: [
        [-105, 39],
        [-104, 39],
      ],
      style: { lineColor: "#ff0000" },
    },
  ];
  await mount([annotationsLayer({ items: overridden })]);
  const before = layerNamed("Callouts");

  act(() =>
    setLayers([annotationsLayer({ items: overridden, lineColor: "#0000ff" })]),
  );

  await waitFor(() => expect(layerNamed("Callouts")).not.toBe(before));
  const after = layerNamed("Callouts");
  expect(lineColorOf(after)).toBe("#0000ff");
  const kept = after.getSource().getFeatureById("a3");
  expect(after.getStyleFunction()(kept, 1)[0].getStroke().getColor()).toBe(
    "#ff0000",
  );
});

test("editing the items rebuilds the layer with them", async () => {
  await mount([annotationsLayer()]);
  const before = layerNamed("Callouts");

  act(() =>
    setLayers([
      annotationsLayer({
        items: [
          { id: "a2", kind: "text", coordinates: [-105, 41], text: "Moved" },
        ],
      }),
    ]),
  );

  await waitFor(() => expect(layerNamed("Callouts")).not.toBe(before));
  expect(
    layerNamed("Callouts")
      .getSource()
      .getFeatures()
      .map((f) => f.getId()),
  ).toEqual(["a2"]);
});

test("a stray style key cannot replace the annotation styling", async () => {
  await mount([
    annotationsLayer({
      style: { default: { linestring: { stroke: "#00ff00" } } },
    }),
  ]);

  expect(lineColorOf(layerNamed("Callouts"))).toBe("#000000");
});

test("renaming the layer rebuilds it rather than keeping the old one", async () => {
  await mount([annotationsLayer()]);
  const before = layerNamed("Callouts");
  const renamed = annotationsLayer();
  renamed.props.name = "Gauge Notes";

  act(() => setLayers([renamed]));

  await waitFor(() => expect(layerNamed("Gauge Notes")).toBeTruthy());
  expect(layerNamed("Gauge Notes")).not.toBe(before);
  expect(layerNamed("Callouts")).toBeUndefined();
});

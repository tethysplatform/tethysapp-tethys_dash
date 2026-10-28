import { useRef, useState } from "react";
import PropTypes from "prop-types";
import { act, render, screen, waitFor } from "@testing-library/react";
import { transform } from "ol/proj.js";
import MapComponent from "components/map/Map";
import MapContextProvider, {
  useMapContext,
} from "components/contexts/MapContext";
import LinkedExtentProvider, {
  useLinkedExtentContext,
} from "components/contexts/LinkedExtentContext";
import {
  GridItemContext,
  TabContext,
  VariableInputsContext,
} from "components/contexts/Contexts";
import { viewFootprint } from "components/map/linkedExtent";
import { POPUP_TAB_ID } from "components/map/viewGroup";

global.ResizeObserver = require("resize-observer-polyfill");

const outlineLayer = (linkedExtentStyle) => ({
  type: "VectorLayer",
  props: { name: "Inset", source: { type: "Linked Extents", props: {} } },
  ...(linkedExtentStyle ? { linkedExtentStyle } : {}),
});

const otherLayer = (opacity = 1) => ({
  type: "VectorLayer",
  props: {
    name: "Stations",
    opacity,
    source: {
      type: "GeoJSON",
      props: {},
      geojson: { type: "FeatureCollection", features: [] },
    },
  },
});

// Detail maps are stood in for by publishing straight into the registry: the
// publishing half is covered by useLinkedExtentPublisher's own suite.
const footprintAt = (lon, lat) =>
  viewFootprint({
    center: transform([lon, lat], "EPSG:4326", "EPSG:3857"),
    resolution: 50,
    rotation: 0,
    size: [400, 300],
    projection: "EPSG:3857",
  });

let mapRef;
let registry;
let setLayers;

const Overview = ({ initialLayers, mapExtent }) => {
  const visualizationRef = useRef();
  const [layers, setLayersState] = useState(initialLayers);
  const { mapReady } = useMapContext();
  mapRef = visualizationRef;
  registry = useLinkedExtentContext();
  setLayers = setLayersState;
  return (
    <div>
      <MapComponent
        visualizationRef={visualizationRef}
        layers={layers}
        baseMap={null}
        mapExtent={mapExtent}
      />
      <p>{mapReady ? "Map Ready" : "Map Not Ready"}</p>
    </div>
  );
};
Overview.propTypes = {
  initialLayers: PropTypes.array,
  mapExtent: PropTypes.any,
};

const EXTENT = "-13700000,5470000,6";

async function mount({
  layers = [outlineLayer()],
  mapExtent = { extent: EXTENT, linkedExtentGroup: "Basin" },
  activeTabId = 1,
  gridItemUUID = "overview",
} = {}) {
  render(
    <LinkedExtentProvider>
      <TabContext.Provider value={{ activeTabId }}>
        <GridItemContext.Provider value={{ gridItemUUID, shouldLoad: true }}>
          <VariableInputsContext.Provider
            value={{ setVariableInputValues: jest.fn() }}
          >
            <MapContextProvider>
              <Overview initialLayers={layers} mapExtent={mapExtent} />
            </MapContextProvider>
          </VariableInputsContext.Provider>
        </GridItemContext.Provider>
      </TabContext.Provider>
    </LinkedExtentProvider>,
  );
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  await waitFor(() => expect(insetLayer()).toBeTruthy());
}

const insetLayer = () =>
  (mapRef?.current?.getLayers?.().getArray() ?? []).find(
    (layer) => layer.get("name") === "Inset",
  );

const outlines = () => insetLayer().getSource().getFeatures();

test("draws a live outline of another member's view (AE2)", async () => {
  await mount();
  const detail = registry.register("Basin", "detail");

  act(() => detail.publish(footprintAt(-123, 44)));
  expect(outlines()).toHaveLength(1);
  const [x0] = outlines()[0].getGeometry().getExtent();

  // The detail map pans east: its outline slides east.
  act(() => detail.publish(footprintAt(-122.5, 44)));
  const [x1] = outlines()[0].getGeometry().getExtent();
  expect(x1).toBeGreaterThan(x0);
});

test("one outline per other member, never its own", async () => {
  await mount();
  act(() => {
    registry.register("Basin", "overview").publish(footprintAt(-120, 40));
    registry.register("Basin", "a").publish(footprintAt(-123, 44));
    registry.register("Basin", "b").publish(footprintAt(-121, 45));
  });

  expect(
    outlines()
      .map((f) => f.get("linkedExtentMember"))
      .sort(),
  ).toEqual(["a", "b"]);
});

test("skips a member that shares this map's view group (AE3)", async () => {
  await mount({
    mapExtent: {
      extent: EXTENT,
      viewGroup: "Valley",
      linkedExtentGroup: "Basin",
    },
  });
  act(() => {
    registry
      .register("Basin", "peer", { viewGroup: "Valley" })
      .publish(footprintAt(-123, 44));
    registry.register("Basin", "other").publish(footprintAt(-121, 45));
  });

  expect(outlines().map((f) => f.get("linkedExtentMember"))).toEqual(["other"]);
});

test("drops a member that has nothing on screen (AE4)", async () => {
  await mount();
  const detail = registry.register("Basin", "detail");
  act(() => detail.publish(footprintAt(-123, 44)));
  expect(outlines()).toHaveLength(1);

  act(() => detail.publish(null));
  expect(outlines()).toHaveLength(0);

  act(() => detail.unregister());
  expect(outlines()).toHaveLength(0);
});

test("draws nothing when the map is in no group (AE6)", async () => {
  await mount({ mapExtent: { extent: EXTENT } });
  act(() =>
    registry.register("Basin", "detail").publish(footprintAt(-123, 44)),
  );

  expect(outlines()).toHaveLength(0);
});

test("a popup map outlines nothing, whatever its saved group", async () => {
  await mount({ activeTabId: POPUP_TAB_ID });
  act(() =>
    registry.register("Basin", "detail").publish(footprintAt(-123, 44)),
  );

  expect(outlines()).toHaveLength(0);
});

test("outlines survive an unrelated layer edit on a kept layer", async () => {
  await mount({ layers: [otherLayer(), outlineLayer()] });
  act(() =>
    registry.register("Basin", "detail").publish(footprintAt(-123, 44)),
  );
  const before = insetLayer();

  act(() => setLayers([otherLayer(0.5), outlineLayer()]));
  await waitFor(() => expect(mapRef.current.getLayers().getLength()).toBe(2));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  expect(insetLayer()).toBe(before);
  expect(outlines()).toHaveLength(1);
});

test("a style edit rebuilds the layer, filled with outlines from the start", async () => {
  await mount();
  act(() =>
    registry.register("Basin", "detail").publish(footprintAt(-123, 44)),
  );
  const before = insetLayer();

  act(() => setLayers([outlineLayer({ color: "#0000ff", width: 4 })]));
  await waitFor(() => expect(insetLayer()).not.toBe(before));

  expect(outlines()).toHaveLength(1);
  const stroke = insetLayer().getStyle().getStroke();
  expect(stroke.getColor()).toBe("#0000ff");
  expect(stroke.getWidth()).toBe(4);
});

import { useRef } from "react";
import PropTypes from "prop-types";
import { act, render } from "@testing-library/react";
import Map from "ol/Map.js";
import View from "ol/View.js";
import VectorLayer from "ol/layer/Vector.js";
import VectorSource from "ol/source/Vector.js";
import Feature from "ol/Feature.js";
import Point from "ol/geom/Point.js";
import LinkedExtentProvider, {
  LinkedExtentContext,
  useLinkedExtentContext,
} from "components/contexts/LinkedExtentContext";
import { GridItemContext, TabContext } from "components/contexts/Contexts";
import useLinkedExtentOutlines, {
  LINKED_EXTENT_MEMBER_KEY,
} from "components/map/useLinkedExtentOutlines";
import {
  LINKED_EXTENT_LAYER_KEY,
  viewFootprint,
} from "components/map/linkedExtent";

// The full Map component path is covered by Map.linkedExtents.test.js; this
// suite drives the hook directly against a real OpenLayers map for the edges
// that path cannot reach.

let registry;
let olMap;

const Overview = ({ mapRef }) => {
  registry = useLinkedExtentContext();
  const visualizationRef = useRef(mapRef);
  useLinkedExtentOutlines({
    visualizationRef,
    mapExtent: { extent: "1,2,3", linkedExtentGroup: "Basin" },
  });
  return null;
};
Overview.propTypes = { mapRef: PropTypes.any };

const withContexts = (children) => (
  <TabContext.Provider value={{ activeTabId: 1 }}>
    <GridItemContext.Provider value={{ gridItemUUID: "overview" }}>
      {children}
    </GridItemContext.Provider>
  </TabContext.Provider>
);

const outlineLayer = (source) => {
  const layer = new VectorLayer({ source });
  layer.set(LINKED_EXTENT_LAYER_KEY, true);
  return layer;
};

const FOOTPRINT = viewFootprint({
  center: [0, 0],
  resolution: 100,
  rotation: 0,
  size: [400, 300],
  projection: "EPSG:3857",
});

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterAll(() => {
  delete global.ResizeObserver;
});

beforeEach(() => {
  registry = null;
  olMap = new Map({
    view: new View({ center: [0, 0], resolution: 100 }),
  });
});

test("a map that is not built yet subscribes to nothing", () => {
  const subscribe = jest.fn(() => () => {});
  render(
    <LinkedExtentContext.Provider
      value={{ register: jest.fn(), subscribe, getFootprints: () => [] }}
    >
      {withContexts(<Overview mapRef={null} />)}
    </LinkedExtentContext.Provider>,
  );

  expect(subscribe).not.toHaveBeenCalled();
});

test("an outline layer whose source is gone is skipped, not fatal", () => {
  const filled = new VectorSource();
  olMap.addLayer(outlineLayer(null));
  olMap.addLayer(outlineLayer(filled));

  render(
    <LinkedExtentProvider>
      {withContexts(<Overview mapRef={olMap} />)}
    </LinkedExtentProvider>,
  );
  const detail = registry.register("Basin", "detail");

  act(() => detail.publish(FOOTPRINT));

  // The layer that still has a source is filled with the other member's
  // outline; the sourceless one is passed over without throwing.
  const features = filled.getFeatures();
  expect(features).toHaveLength(1);
  expect(features[0].get(LINKED_EXTENT_MEMBER_KEY)).toBe("detail");
});

test("outside a dashboard an outline layer is drawn empty", () => {
  // Left over from a previous build: outlines are never trusted to survive.
  const source = new VectorSource({
    features: [new Feature(new Point([0, 0]))],
  });
  olMap.addLayer(outlineLayer(source));

  // No registry, tab or grid item: there is no group to outline.
  render(<Overview mapRef={olMap} />);

  expect(registry).toBeNull();
  expect(source.getFeatures()).toEqual([]);
});

test("an outline layer added later is filled at once; other layers are not", () => {
  render(
    <LinkedExtentProvider>
      {withContexts(<Overview mapRef={olMap} />)}
    </LinkedExtentProvider>,
  );
  act(() => registry.register("Basin", "detail").publish(FOOTPRINT));

  const plain = new VectorSource();
  olMap.addLayer(new VectorLayer({ source: plain }));
  const outlines = new VectorSource();
  olMap.addLayer(outlineLayer(outlines));

  expect(plain.getFeatures()).toEqual([]);
  expect(outlines.getFeatures()).toHaveLength(1);
});

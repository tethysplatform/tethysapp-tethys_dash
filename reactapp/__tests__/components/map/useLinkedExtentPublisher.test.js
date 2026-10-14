import { useRef } from "react";
import PropTypes from "prop-types";
import { render } from "@testing-library/react";
import Map from "ol/Map.js";
import View from "ol/View.js";
import LinkedExtentProvider, {
  useLinkedExtentContext,
} from "components/contexts/LinkedExtentContext";
import { GridItemContext, TabContext } from "components/contexts/Contexts";
import useLinkedExtentPublisher from "components/map/useLinkedExtentPublisher";

let registry;
let olMap;

// Stands in for the map component: owns a real OpenLayers map and calls the
// hook the way `components/map/Map.js` does.
const Member = ({ mapExtent, dataviewerViz = false }) => {
  registry = useLinkedExtentContext();
  const visualizationRef = useRef(null);
  if (!visualizationRef.current) visualizationRef.current = olMap;
  useLinkedExtentPublisher({ visualizationRef, mapExtent, dataviewerViz });
  return null;
};
Member.propTypes = { mapExtent: PropTypes.any, dataviewerViz: PropTypes.bool };

const tree = ({
  mapExtent = { extent: "1,2,3", linkedExtentGroup: "Basin" },
  shouldLoad = true,
  activeTabId = 1,
  gridItemUUID = "detail",
  dataviewerViz = false,
} = {}) => (
  <LinkedExtentProvider>
    <TabContext.Provider value={{ activeTabId }}>
      <GridItemContext.Provider value={{ gridItemUUID, shouldLoad }}>
        <Member mapExtent={mapExtent} dataviewerViz={dataviewerViz} />
      </GridItemContext.Provider>
    </TabContext.Provider>
  </LinkedExtentProvider>
);

const ring = () => registry.getFootprints("Basin")[0]?.ring;

// ol/Map observes its target's size; jsdom has no ResizeObserver.
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

let target;

beforeEach(() => {
  target = document.createElement("div");
  document.body.appendChild(target);
  olMap = new Map({
    target,
    view: new View({
      center: [0, 0],
      resolution: 100,
      projection: "EPSG:3857",
    }),
  });
  olMap.setSize([400, 300]);
});

afterEach(() => {
  olMap.setTarget(null);
  olMap = null;
  target.remove();
});

test("a member publishes its footprint on joining", () => {
  render(tree());
  olMap.renderSync();

  const footprint = ring();
  expect(footprint).toBeTruthy();
  expect(footprint[0][0]).toBeLessThan(0);
});

test("panning publishes an updated footprint", () => {
  render(tree());
  olMap.renderSync();
  const before = ring();

  olMap.getView().setCenter([100000, 0]);
  olMap.renderSync();

  expect(ring()).not.toBe(before);
  expect(ring()[0][0]).toBeGreaterThan(before[0][0]);
});

test("an unchanged frame does not republish", () => {
  render(tree());
  olMap.renderSync();
  const listener = jest.fn();
  registry.subscribe("Basin", listener);

  olMap.renderSync();

  expect(listener).not.toHaveBeenCalled();
});

test("a hidden tab publishes nothing, and returning republishes", () => {
  const { rerender } = render(tree());
  olMap.renderSync();

  rerender(tree({ shouldLoad: false }));
  expect(registry.getFootprints("Basin")[0].ring).toBeNull();

  rerender(tree({ shouldLoad: true }));
  olMap.renderSync();
  expect(ring()).toBeTruthy();
});

test("a map shrunk to zero size publishes nothing", () => {
  render(tree());
  olMap.renderSync();

  olMap.setSize([0, 0]);

  expect(registry.getFootprints("Basin")[0].ring).toBeNull();
});

test("renaming the group moves the member", () => {
  const { rerender } = render(tree());
  olMap.renderSync();

  rerender(
    tree({ mapExtent: { extent: "1,2,3", linkedExtentGroup: "Valley" } }),
  );
  olMap.renderSync();

  expect(registry.getFootprints("Basin")).toEqual([]);
  expect(registry.getFootprints("Valley")[0].ring).toBeTruthy();
});

test("unmounting removes the member", () => {
  const { unmount } = render(tree());
  olMap.renderSync();
  const footprints = registry;

  unmount();

  expect(footprints.getFootprints("Basin")).toEqual([]);
});

test("it records the member's view group for peer exclusion", () => {
  render(
    tree({
      mapExtent: {
        extent: "1,2,3",
        viewGroup: "Valley",
        linkedExtentGroup: "Basin",
      },
    }),
  );

  expect(registry.getFootprints("Basin")[0].viewGroup).toBe("Valley");
});

test.each([
  ["the DataViewer preview", { dataviewerViz: true }],
  ["a popup map", { activeTabId: "popup" }],
  ["a map with no group", { mapExtent: { extent: "1,2,3" } }],
  ["a map with no grid item uuid", { gridItemUUID: null }],
])("%s never joins", (_label, options) => {
  render(tree(options));
  olMap.renderSync();

  expect(registry.getFootprints("Basin")).toEqual([]);
});

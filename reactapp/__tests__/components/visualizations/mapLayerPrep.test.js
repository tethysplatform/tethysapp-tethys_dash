import { useRef } from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import createLoadedComponent from "__tests__/utilities/customRender";
import PropTypes from "prop-types";
import { Map } from "ol";
import MapVisualization from "components/visualizations/Map";
import MapContextProvider from "components/contexts/MapContext";
import { loadLayerJSONs } from "components/map/utilities";
import moduleLoader from "components/map/ModuleLoader";

global.ResizeObserver = require("resize-observer-polyfill");

// Preparing a layer is a backend style fetch plus, for a raster, a header read.
// Holding it open is the whole point of these tests: everything asserted here is
// about what the map shows *while* that is still outstanding.
jest.mock("components/map/utilities", () => ({
  ...jest.requireActual("components/map/utilities"),
  loadLayerJSONs: jest.fn(),
}));

// Constructing a source is where most layer types actually spend their time --
// a GeoTIFF reads its header, a GeoPackage fetches the whole file. Wrapped so a
// single named layer can be held mid-construction while the rest, the basemap
// included, build for real.
//
// The suite runs with `resetMocks: true`, so an implementation given to
// `jest.fn` here would be stripped before the first test. Every mock below is
// therefore (re)implemented in `beforeEach`.
jest.mock("components/map/ModuleLoader", () => ({
  ...jest.requireActual("components/map/ModuleLoader"),
  __esModule: true,
  default: jest.fn(),
}));

const realModuleLoader = jest.requireActual(
  "components/map/ModuleLoader",
).default;

const BASE_MAP =
  "https://server.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer";

const styledLayer = (name) => ({
  configuration: {
    type: "ImageLayer",
    props: {
      name,
      source: {
        type: "ESRI Image and Map Service",
        props: { url: "some_url" },
      },
    },
    style: "saved-style.json",
  },
});

const Harness = ({ layers }) => {
  const visualizationRef = useRef();
  return (
    <MapVisualization
      visualizationRef={visualizationRef}
      mapConfig={{}}
      viewConfig={{}}
      layers={layers}
      baseMap={BASE_MAP}
      layerControl={true}
    />
  );
};
Harness.propTypes = { layers: PropTypes.array };

function deferred() {
  let release;
  const promise = new Promise((resolve) => {
    release = resolve;
  });
  return { promise, release: () => act(async () => release()) };
}

function addedLayerNames(spy) {
  return spy.mock.calls.map(([layer]) => layer.get("name"));
}

let addLayerSpy;

beforeEach(() => {
  addLayerSpy = jest.spyOn(Map.prototype, "addLayer");
  loadLayerJSONs.mockResolvedValue(undefined);
  moduleLoader.mockImplementation(realModuleLoader);
});

afterEach(() => {
  addLayerSpy.mockRestore();
});

async function mount(layers) {
  render(
    createLoadedComponent({
      children: (
        <MapContextProvider>
          <Harness layers={layers} />
        </MapContextProvider>
      ),
    }),
  );
  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();
}

test("the basemap is on the map before the layers finish preparing", async () => {
  // The regression: every layer was prepared one at a time and nothing at all
  // was published until all of it had finished -- the basemap included, even
  // though it needs nothing asynchronous. A dashboard with a couple of layers
  // showed an empty white map for the sum of their latencies.
  const gate = deferred();
  loadLayerJSONs.mockImplementation(() => gate.promise);

  await mount([styledLayer("Slow layer")]);

  await waitFor(() =>
    expect(addedLayerNames(addLayerSpy)).toContain("World Light Gray Base"),
  );
  // Still nothing else: the layer is genuinely still being prepared.
  expect(loadLayerJSONs).toHaveBeenCalledTimes(1);
  expect(addedLayerNames(addLayerSpy)).not.toContain("Slow layer");

  await gate.release();

  await waitFor(() =>
    expect(addedLayerNames(addLayerSpy)).toContain("Slow layer"),
  );
});

test("layers are prepared in parallel, not one after another", async () => {
  // Each layer's prep awaits its own network reads and touches only its own
  // config, so serializing them made the wall clock the sum of their latencies
  // for no reason.
  const gate = deferred();
  loadLayerJSONs.mockImplementation(() => gate.promise);

  await mount([styledLayer("One"), styledLayer("Two"), styledLayer("Three")]);

  // All three are in flight against a single unresolved gate. Serial prep could
  // only ever have one outstanding.
  await waitFor(() => expect(loadLayerJSONs).toHaveBeenCalledTimes(3));

  await gate.release();
  await waitFor(() =>
    expect(addedLayerNames(addLayerSpy)).toEqual(
      expect.arrayContaining(["One", "Two", "Three"]),
    ),
  );
});

test("a layer still being prepared is reported as loading", async () => {
  // Only the shapefile source reported its load, because only it defers work to
  // an OpenLayers loader with events to watch. The prep phase runs before any
  // OL layer exists at all, so it had nothing to report through.
  const gate = deferred();
  loadLayerJSONs.mockImplementation(() => gate.promise);

  await mount([styledLayer("Slow layer")]);

  const alert = await screen.findByRole("status");
  expect(alert).toHaveTextContent("Loading Slow layer");

  await gate.release();

  await waitFor(() =>
    expect(screen.queryByRole("status")).not.toBeInTheDocument(),
  );
});

test("a layer still being constructed is reported as loading", async () => {
  // The other half of the indicator. Prep finishes immediately here, so the
  // only thing outstanding is the source build -- which for every type except
  // the shapefile used to happen with nothing said at all.
  const gate = deferred();
  moduleLoader.mockImplementation(async (config, ...rest) => {
    if (config?.props?.name === "Slow source") {
      await gate.promise;
    }
    return realModuleLoader(config, ...rest);
  });

  await mount([styledLayer("Slow source")]);

  // The basemap is unaffected: it goes through the same loader and is not gated.
  await waitFor(() =>
    expect(addedLayerNames(addLayerSpy)).toContain("World Light Gray Base"),
  );
  const alert = await screen.findByRole("status");
  expect(alert).toHaveTextContent("Loading Slow source");

  await gate.release();

  await waitFor(() =>
    expect(addedLayerNames(addLayerSpy)).toContain("Slow source"),
  );
  await waitFor(() =>
    expect(screen.queryByRole("status")).not.toBeInTheDocument(),
  );
});

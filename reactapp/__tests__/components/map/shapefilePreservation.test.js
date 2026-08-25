import { useRef, useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import PropTypes from "prop-types";
import { get as getProjection } from "ol/proj.js";
import MapComponent from "components/map/Map";
import MapContextProvider, {
  useMapContext,
} from "components/contexts/MapContext";
import { VariableInputsContext } from "components/contexts/Contexts";
import { acquireComponents } from "components/map/shapefile/acquire";
import { interpretShapefile } from "components/map/shapefile/index";

global.ResizeObserver = require("resize-observer-polyfill");

// Acquisition stands in for "did this layer load again". The pipeline itself is
// covered by its own suites.
jest.mock("components/map/shapefile/acquire", () => ({
  acquireComponents: jest.fn(),
}));
jest.mock("components/map/shapefile/index", () => ({
  interpretShapefile: jest.fn(),
}));

const FULL_EXTENT = [-Infinity, -Infinity, Infinity, Infinity];

const COLLECTION = {
  type: "FeatureCollection",
  crs: { type: "name", properties: { name: "EPSG:4326" } },
  features: [
    {
      type: "Feature",
      properties: { HUC8: "10190005" },
      geometry: { type: "Point", coordinates: [-105, 40] },
    },
  ],
};

function shapefileLayer({
  url = "https://example.org/basins.zip",
  projection,
  style,
} = {}) {
  return {
    type: "VectorLayer",
    props: {
      name: "Basins",
      source: {
        type: "Shapefile",
        props: { url, ...(projection === undefined ? {} : { projection }) },
      },
    },
    ...(style === undefined ? {} : { style }),
  };
}

function otherLayer({ opacity = 1 } = {}) {
  return {
    type: "TileLayer",
    props: {
      name: "Basemap",
      opacity,
      source: { type: "Image Tile", props: { url: "https://example.org/{z}" } },
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
      <MapComponent visualizationRef={visualizationRef} layers={layers} />
      <p>{mapReady ? "Map Ready" : "Map Not Ready"}</p>
    </div>
  );
};
Harness.propTypes = { initialLayers: PropTypes.array };

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
  await waitFor(() => expect(shapefileLayers()).toHaveLength(1));
}

function shapefileLayers() {
  return (mapRef?.current?.getLayers?.().getArray() ?? []).filter(
    (layer) => !!layer.getSource?.()?.get?.("shapefileController"),
  );
}

function layerNamed(name) {
  return (mapRef?.current?.getLayers?.().getArray() ?? []).find(
    (layer) => layer.get("name") === name,
  );
}

// The loader is pulled by OpenLayers only when a layer renders, and a jsdom map
// has no size -- so drive it directly. This also makes the assertion the right
// one: a preserved layer keeps its source and its loaded-extent bookkeeping, so
// driving it again is a no-op, while a rebuilt layer has a fresh source that
// loads from scratch.
async function drive() {
  shapefileLayers().forEach((layer) => {
    layer.getSource().loadFeatures(FULL_EXTENT, 1, getProjection("EPSG:3857"));
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
}

// Wait on an observable post-condition rather than a fixed delay, so a slow
// machine cannot turn these into flakes. Reconciliation is asynchronous, so
// something it did has to be visible before the assertions run.
async function reconciled(condition) {
  await waitFor(condition);
}

beforeEach(() => {
  mapRef = undefined;
  setLayers = undefined;
  acquireComponents.mockReset();
  interpretShapefile.mockReset();
  acquireComponents.mockResolvedValue({
    components: { shp: new Uint8Array() },
  });
  interpretShapefile.mockResolvedValue({
    featureCollection: COLLECTION,
    projectionCode: "EPSG:4326",
  });
});

describe("shapefile layer preservation", () => {
  it("does not load again when an unrelated layer's opacity changes", async () => {
    // The reconciliation sweep rebuilds every vector layer on any change to the
    // layer array, so without preservation an opacity edit elsewhere -- or one
    // frame of a raster time-slider -- costs a full refetch and reparse.
    await mount([shapefileLayer(), otherLayer({ opacity: 1 })]);
    await drive();
    expect(acquireComponents).toHaveBeenCalledTimes(1);
    const original = layerNamed("Basins");

    setLayers([shapefileLayer(), otherLayer({ opacity: 0.4 })]);
    await reconciled(() =>
      expect(layerNamed("Basemap").getOpacity()).toBeCloseTo(0.4),
    );
    await drive();

    expect(acquireComponents).toHaveBeenCalledTimes(1);
    // Same instance, so its features and loaded-extent bookkeeping survived.
    expect(layerNamed("Basins")).toBe(original);
  });

  it("loads again when the resolved url changes", async () => {
    await mount([shapefileLayer()]);
    await drive();
    expect(acquireComponents).toHaveBeenCalledTimes(1);

    const original = shapefileLayers()[0];
    setLayers([shapefileLayer({ url: "https://example.org/gages.zip" })]);
    await reconciled(() => expect(shapefileLayers()[0]).not.toBe(original));
    await drive();

    expect(acquireComponents.mock.calls.length).toBeGreaterThan(1);
    expect(acquireComponents).toHaveBeenLastCalledWith(
      "https://example.org/gages.zip",
      expect.anything(),
    );
  });

  it("does not load again when a re-render resolves to the same url", async () => {
    await mount([shapefileLayer()]);
    await drive();
    expect(acquireComponents).toHaveBeenCalledTimes(1);

    // A new config object carrying an identical resolved url. Nothing observable
    // changes when a layer is preserved, so the instance check is the assertion
    // and the load count corroborates it.
    const original = shapefileLayers()[0];
    setLayers([shapefileLayer()]);
    await reconciled(() => expect(shapefileLayers()).toHaveLength(1));
    await drive();

    expect(shapefileLayers()[0]).toBe(original);
    expect(acquireComponents).toHaveBeenCalledTimes(1);
  });

  it("repaints a style edit on a preserved layer without loading again", async () => {
    // Style is otherwise applied only when a layer is constructed, so a
    // preserved layer would silently ignore a style edit -- which would
    // contradict styling working on a shapefile layer at all.
    await mount([shapefileLayer({ style: { a: 1 } })]);
    await drive();
    const original = layerNamed("Basins");
    expect(acquireComponents).toHaveBeenCalledTimes(1);

    setLayers([shapefileLayer({ style: { a: 2 } })]);
    await waitFor(() => {
      expect(layerNamed("Basins").get("appliedStyle")).toEqual({ a: 2 });
    });
    await drive();

    expect(acquireComponents).toHaveBeenCalledTimes(1);
    expect(layerNamed("Basins")).toBe(original);
  });

  it("keeps exactly one instance of the layer across a change", async () => {
    await mount([shapefileLayer(), otherLayer()]);

    setLayers([shapefileLayer(), otherLayer({ opacity: 0.5 })]);
    await reconciled(() =>
      expect(layerNamed("Basemap").getOpacity()).toBeCloseTo(0.5),
    );

    expect(shapefileLayers()).toHaveLength(1);
  });
});

describe("shapefile load cancellation", () => {
  it("aborts an in-flight load when the layer is removed", async () => {
    let capturedSignal;
    acquireComponents.mockImplementation((url, options) => {
      capturedSignal = options?.signal;
      return new Promise(() => {});
    });

    await mount([shapefileLayer()]);
    await drive();
    expect(capturedSignal).toBeDefined();
    expect(capturedSignal.aborted).toBe(false);

    setLayers([otherLayer()]);

    await waitFor(() => {
      expect(capturedSignal.aborted).toBe(true);
    });
  });
});

describe("shapefile preservation and the source's other props", () => {
  it("loads again when the author changes the projection", async () => {
    // `projection` is the only way to place a shapefile carrying no .prj.
    // Preservation matched on the url alone, so editing it preserved the layer
    // and re-read nothing -- the author changed the field, saved, and the map
    // did not move.
    await mount([shapefileLayer()]);
    await drive();
    expect(acquireComponents).toHaveBeenCalledTimes(1);
    const original = shapefileLayers()[0];

    setLayers([shapefileLayer({ projection: "EPSG:5070" })]);
    await reconciled(() => expect(shapefileLayers()[0]).not.toBe(original));
    await drive();

    expect(acquireComponents.mock.calls.length).toBeGreaterThan(1);
    expect(interpretShapefile).toHaveBeenLastCalledWith(expect.anything(), {
      fallbackProjection: "EPSG:5070",
    });
  });

  it("still preserves the layer when nothing about the source changed", async () => {
    await mount([shapefileLayer({ projection: "EPSG:5070" })]);
    await drive();
    const original = shapefileLayers()[0];

    setLayers([
      shapefileLayer({ projection: "EPSG:5070" }),
      otherLayer({ opacity: 0.4 }),
    ]);
    await reconciled(() =>
      expect(layerNamed("Basemap").getOpacity()).toBeCloseTo(0.4),
    );
    await drive();

    expect(acquireComponents).toHaveBeenCalledTimes(1);
    expect(shapefileLayers()[0]).toBe(original);
  });
});

describe("shapefile load listeners", () => {
  it("stops listening to a removed layer's source", async () => {
    await mount([shapefileLayer()]);
    await drive();
    const source = shapefileLayers()[0].getSource();
    expect(source.getListeners("featuresloadend")?.length ?? 0).toBeGreaterThan(
      0,
    );

    setLayers([otherLayer()]);
    await reconciled(() => expect(shapefileLayers()).toHaveLength(0));

    // Load status is kept per layer *name*, and a rebuilt layer reuses the
    // name -- so a dead source still being listened to can report under a name
    // a different source now owns.
    expect(source.getListeners("featuresloadend")?.length ?? 0).toBe(0);
    expect(source.getListeners("featuresloaderror")?.length ?? 0).toBe(0);
  });

  it("listens to the replacement after a rebuild", async () => {
    await mount([shapefileLayer()]);
    await drive();
    const original = shapefileLayers()[0].getSource();

    setLayers([shapefileLayer({ url: "https://example.org/gages.zip" })]);
    await reconciled(() =>
      expect(shapefileLayers()[0].getSource()).not.toBe(original),
    );

    expect(original.getListeners("featuresloadend")?.length ?? 0).toBe(0);
    expect(
      shapefileLayers()[0].getSource().getListeners("featuresloadend")
        ?.length ?? 0,
    ).toBeGreaterThan(0);
  });
});

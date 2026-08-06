// Regression: a GeoTIFF layer whose source URL changes must not leave the old
// raster visible, and rapid changes must converge to the latest value.
import { useRef } from "react";
import { render, waitFor, act } from "@testing-library/react";
import PropTypes from "prop-types";
import MapComponent from "components/map/Map";
import MapContextProvider from "components/contexts/MapContext";
import { Map } from "ol";
import { VariableInputsContext } from "components/contexts/Contexts";
import GeoTIFFSource from "ol/source/GeoTIFF.js";

global.ResizeObserver = require("resize-observer-polyfill");

jest.mock("ol/source/GeoTIFF.js", () => {
  const ActualSource = jest.requireActual("ol/source/Source.js").default;
  class MockGeoTIFFSource extends ActualSource {
    constructor(options) {
      super({ projection: null });
      this.options = options;
      MockGeoTIFFSource.instances.push(this);
    }
    // getTile makes map/Map.js treat this as a tile source (engages the guard)
    getTile() {
      return null;
    }
    getView() {
      return Promise.resolve({
        projection: "EPSG:4326",
        extent: [-180, -90, 180, 90],
        center: [0, 0],
        zoom: 2,
      });
    }
  }
  MockGeoTIFFSource.instances = [];
  return { __esModule: true, default: MockGeoTIFFSource };
});

const realAddLayer = Map.prototype.addLayer;
let mapInstance = null;

const TestingComponent = ({ mapProps }) => {
  const visualizationRef = useRef();
  return <MapComponent visualizationRef={visualizationRef} {...mapProps} />;
};
TestingComponent.propTypes = { mapProps: PropTypes.object };

const geotiffLayer = (url) => ({
  type: "WebGLTile",
  props: {
    source: { type: "GeoTIFF", props: { sources: [{ url }] } },
    name: "Floodmap",
    zIndex: 0,
  },
});

const wrap = (layers) => (
  <VariableInputsContext.Provider value={{ setVariableInputValues: jest.fn() }}>
    <MapContextProvider>
      <TestingComponent mapProps={{ layers }} />
    </MapContextProvider>
  </VariableInputsContext.Provider>
);

const mapLayers = () => mapInstance?.getLayers().getArray() ?? [];
const urlOf = (l) => l.getSource?.()?.options?.sources?.[0]?.url;
const layerByUrl = (url) => mapLayers().find((l) => urlOf(l) === url);
const visibleUrls = () =>
  mapLayers()
    .filter((l) => l.getVisible())
    .map(urlOf)
    .filter(Boolean);

const fireTileLoadEnd = (url) => {
  const src = GeoTIFFSource.instances.find(
    (s) => s.options?.sources?.[0]?.url === url,
  );
  act(() => {
    src.dispatchEvent("tileloadend");
  });
};

beforeEach(() => {
  GeoTIFFSource.instances.length = 0;
  mapInstance = null;
  jest.spyOn(Map.prototype, "renderSync").mockImplementation(() => {});
  jest.spyOn(Map.prototype, "addLayer").mockImplementation(function (layer) {
    mapInstance = this;
    return realAddLayer.call(this, layer);
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

const URL_A = "http://localhost/apps/tethysdash/floodmap/cog/?storm=199";
const URL_B = "http://localhost/apps/tethysdash/floodmap/cog/?storm=5";
const URL_C = "http://localhost/apps/tethysdash/floodmap/cog/?storm=42";

test("outgoing GeoTIFF layer is hidden immediately on a URL change, removed after load", async () => {
  const { rerender } = render(wrap([geotiffLayer(URL_A)]));
  await waitFor(() => expect(layerByUrl(URL_A)).toBeDefined());

  rerender(wrap([geotiffLayer(URL_B)]));
  await waitFor(() => expect(layerByUrl(URL_B)).toBeDefined());

  // No stale raster: the old layer is hidden before the new tiles load.
  expect(layerByUrl(URL_A).getVisible()).toBe(false);
  expect(visibleUrls()).toEqual([URL_B]);

  // Once the new layer loads, the old layer is removed.
  fireTileLoadEnd(URL_B);
  await waitFor(() => expect(layerByUrl(URL_A)).toBeUndefined());
  expect(visibleUrls()).toEqual([URL_B]);
});

test("rapid supersede converges to the latest layer; a late load does not resurrect a stale one", async () => {
  const { rerender } = render(wrap([geotiffLayer(URL_A)]));
  await waitFor(() => expect(layerByUrl(URL_A)).toBeDefined());

  // B's tiles never load; C supersedes it before that resolves.
  rerender(wrap([geotiffLayer(URL_B)]));
  await waitFor(() => expect(layerByUrl(URL_B)).toBeDefined());
  rerender(wrap([geotiffLayer(URL_C)]));
  await waitFor(() => expect(layerByUrl(URL_C)).toBeDefined());

  fireTileLoadEnd(URL_C);
  await waitFor(() => expect(visibleUrls()).toEqual([URL_C]));
  expect(layerByUrl(URL_A)).toBeUndefined();
  expect(layerByUrl(URL_B)).toBeUndefined();

  // B's superseded run resolves late — it must not remove C or bring B back.
  fireTileLoadEnd(URL_B);
  await waitFor(() => expect(visibleUrls()).toEqual([URL_C]));
});

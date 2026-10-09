// Shared harness for the MapVisualization suites (Map, MapClick, MapHover,
// MapLinkedViews). Importing it installs the module mocks below, so it must
// be each suite's first import: a mock registers only for modules required
// after it.
import { useRef, useEffect } from "react";
import { render } from "@testing-library/react";
import createLoadedComponent, {
  InputVariablePComponent,
} from "__tests__/utilities/customRender";
import PropTypes from "prop-types";
import { applyStyle } from "ol-mapbox-style";
import {
  queryLayerFeatures,
  swapVectorLayerFeatures,
} from "components/map/utilities";
import { fetchLayerVectorFeatures } from "components/map/snapping";
import { Swiper } from "swiper";
import MapContextProvider, {
  useMapContext,
} from "components/contexts/MapContext";
import MapVisualization from "components/visualizations/Map";

jest.mock("components/map/ModuleLoader", () => {
  const actual = jest.requireActual("components/map/ModuleLoader");
  return {
    __esModule: true,
    default: actual.default, // use the real default export
    createJsonStyleFunction: jest.fn(), // mock only this function
    applyAutoRamp: actual.applyAutoRamp, // real: drives the Zarr legend
    clearClientSourceCaches: actual.clearClientSourceCaches,
    // Real: the map tests an instanceof against it to decide whether a failed
    // layer's message is meant for the author.
    LayerSourceError: actual.LayerSourceError,
  };
});

// The real fetcher runs, but a test can stand in for the ramps it publishes:
// building a runtime raster for real means opening a GeoTIFF, which is the
// fetcher's own suite's business. Not a jest.fn, which resetMocks would strip.
export const mockRasterLegendStore = {
  value: null,
  listeners: new Set(),
  set(value) {
    this.value = value;
    this.listeners.forEach((listener) => listener());
  },
};
jest.mock("components/visualizations/runtimeLayerFetcher", () => {
  const actual = jest.requireActual(
    "components/visualizations/runtimeLayerFetcher",
  );
  const { useSyncExternalStore } = jest.requireActual("react");
  const subscribe = (listener) => {
    mockRasterLegendStore.listeners.add(listener);
    return () => mockRasterLegendStore.listeners.delete(listener);
  };
  const getSnapshot = () => mockRasterLegendStore.value;
  const useRuntimeLayerFetcherWithLegends = (args) => {
    const result = actual.default(args);
    const override = useSyncExternalStore(subscribe, getSnapshot);
    return override ? { ...result, rasterLegendByLayerId: override } : result;
  };
  return {
    ...actual,
    __esModule: true,
    default: useRuntimeLayerFetcherWithLegends,
  };
});

// Records each legend entry the legend renders, so a test can read the colors
// a colorbar was given: jsdom drops a linear-gradient background, so they are
// not on the rendered element.
export const mockRenderedLegends = [];
jest.mock("components/map/LegendRenderer", () => {
  const actual = jest.requireActual("components/map/LegendRenderer");
  const { createElement } = jest.requireActual("react");
  const RecordingLegendRenderer = (props) => {
    mockRenderedLegends.push(props.legend);
    return createElement(actual.default, props);
  };
  return { ...actual, __esModule: true, default: RecordingLegendRenderer };
});

jest.mock("geotiff", () => ({ fromUrl: jest.fn() }));
jest.mock("components/map/zarrReader", () => ({
  __esModule: true,
  readSlice: jest.fn(),
  readMetadata: jest.fn(),
}));

global.ResizeObserver = require("resize-observer-polyfill");

jest.mock("ol-mapbox-style", () => ({
  applyStyle: jest.fn(),
}));
export const mockedApplyStyle = jest.mocked(applyStyle);

jest.mock("components/map/utilities", () => {
  const originalModule = jest.requireActual("components/map/utilities");
  return {
    ...originalModule,
    queryLayerFeatures: jest.fn(),
    swapVectorLayerFeatures: jest.fn(),
  };
});

jest.mock("components/map/snapping", () => {
  const originalModule = jest.requireActual("components/map/snapping");
  return {
    ...originalModule,
    fetchLayerVectorFeatures: jest.fn(),
  };
});
export const mockedQueryLayerFeatures = jest.mocked(queryLayerFeatures);
export const mockedSwapVectorLayerFeatures = jest.mocked(
  swapVectorLayerFeatures,
);
export const mockedFetchLayerVectorFeatures = jest.mocked(
  fetchLayerVectorFeatures,
);

export const exampleGeoJSON = {
  type: "FeatureCollection",
  crs: {
    type: "name",
    properties: {
      name: "EPSG:3857",
    },
  },
  features: [
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [0, 0],
      },
    },
  ],
};

export const exampleStyle = {
  version: 8,
  sprite:
    "https://cdn.arcgis.com/sharing/rest/content/items/005b8960ddd04ae781df8d471b6726b3/resources/styles/../sprites/sprite",
  glyphs:
    "https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer/resources/fonts/{fontstack}/{range}.pbf",
  sources: {
    esri: {
      type: "vector",
      url: "https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer",
      tiles: [
        "https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer/tile/{z}/{y}/{x}.pbf",
      ],
    },
  },
  layers: [
    {
      id: "Land/Ice",
      type: "fill",
      source: "esri",
      "source-layer": "Land",
      filter: ["==", "_symbol", 1],
      layout: {},
      paint: {
        "fill-opacity": 0.8,
        "fill-color": "#feffff",
      },
    },
  ],
};

export const exampleRuleBasedStyle = {
  rules: [],
  default: {
    point: {
      shape: "star",
      size: "10",
      strokeWidth: "2",
      fill: "#fb0000",
      stroke: "#09f510",
    },
  },
};

export const TestingComponent = ({
  onMapClick,
  onMapPointerMove,
  onMapZoom,
  clickCoordinates,
  mapProps,
}) => {
  const visualizationRef = useRef();
  const { mapReady } = useMapContext();

  useEffect(() => {
    if (!visualizationRef.current || !mapReady) return;

    if (onMapClick) {
      const evt = {
        type: "singleclick",
        coordinate: clickCoordinates,
      };
      visualizationRef.current.dispatchEvent(evt);
    }

    if (onMapPointerMove) {
      const evt = {
        type: "pointermove",
        coordinate: clickCoordinates,
      };
      visualizationRef.current.dispatchEvent(evt);
    }

    if (onMapZoom) {
      visualizationRef.current.getView().setZoom(8);
    }
  }, [mapReady, clickCoordinates, onMapClick, onMapPointerMove, onMapZoom]);

  return (
    <div>
      <MapVisualization visualizationRef={visualizationRef} {...mapProps} />
      <p>{mapReady ? "Map Ready" : "Map Not Ready"}</p>
      <InputVariablePComponent />
    </div>
  );
};

export const zarrRampLayer = (style = {}) => ({
  configuration: {
    type: "WebGLTile",
    props: {
      name: "Flood Depth",
      source: {
        type: "Zarr",
        props: { url: "https://example.com/store.zarr", variable: "depth" },
      },
    },
    style: { rampName: "viridis", ...style },
  },
  legend: "default",
});

export const renderMapWithLayers = (layers) => {
  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          mapProps={{
            mapConfig: {},
            viewConfig: {},
            layers,
            baseMap: null,
            layerControl: false,
          }}
        />
      </MapContextProvider>
    ),
  });
  render(LoadedComponent);
};

export const zarrSlice = (over = {}) => ({
  width: 2,
  height: 2,
  extent: [0, 0, 2, 2],
  crs: "EPSG:3857",
  data: new Float32Array([0, 1, 8, 1, 17, 1, 4, 1]), // [value, alpha] per pixel
  min: 0,
  max: 17,
  ...over,
});

// --- Table popup <-> popup modal sync ---------------------------------------
//
// The table overlay and the popup modal are driven by two lists filtered out of
// the same click results, so their feature objects match by reference. These
// tests cover both sync directions and the overlay anchoring that comes with
// them. `popSetPosition` is shared with the spinner overlay, so assertions use
// `toHaveBeenLastCalledWith`.

// A layer that opens BOTH popups, with two features far enough apart that the
// anchor assertions distinguish them.
export const syncLayer = (name = "Both") => ({
  name,
  configuration: {
    type: "ImageLayer",
    props: {
      name,
      source: {
        type: "ESRI Image and Map Service",
        props: { url: "both_url" },
      },
    },
  },
  popupConfig: {
    mode: "modal",
    position: null,
    titleTemplate: null,
    gridItems: [],
  },
});

export const renderSyncMap = (layers) => {
  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          onMapClick={jest.fn()}
          clickCoordinates={[10, 20]}
          mapProps={{
            mapConfig: {},
            viewConfig: {},
            layers,
            baseMap: null,
            layerControl: false,
          }}
        />
      </MapContextProvider>
    ),
  });
  return render(LoadedComponent);
};

// Under jsdom every element measures 0x0, so Swiper never assigns its
// `swiper-slide-active` class or updates its fraction pagination — neither can
// be read back to tell which slide is showing. Spy on `slideTo` instead: it is
// the call the modal makes to move the table, so asserting it is asserting the
// behavior under test rather than a rendering detail jsdom cannot produce.
export const spyOnSlideTo = () => jest.spyOn(Swiper.prototype, "slideTo");

export const BASE_MAP_A =
  "https://server.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer";

export const BASE_MAP_B =
  "https://server.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer";

// Helper component that sets MapContext.extentDrawMode synchronously on
// mount. Used by the draw-mode-suppression test.
export const ExtentDrawModeSetter = ({ mode }) => {
  const { setExtentDrawMode } = useMapContext();
  useEffect(() => {
    setExtentDrawMode(mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
};

ExtentDrawModeSetter.propTypes = { mode: PropTypes.string };

TestingComponent.propTypes = {
  mapProps: PropTypes.shape({
    onMapClick: PropTypes.func,
    layers: PropTypes.array,
  }),
  onMapClick: PropTypes.func,
  onMapPointerMove: PropTypes.bool,
  onMapZoom: PropTypes.bool,
  clickCoordinates: PropTypes.arrayOf(PropTypes.number),
};

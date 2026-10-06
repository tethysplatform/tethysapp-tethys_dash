// A static GeoTIFF layer -- no plugin behind it -- whose URL names a variable
// input, e.g. "https://example.com/depth_${Year}.tif", repoints when that input
// changes. Nothing in the map code knows about this: it falls out of three
// generic steps, and this file pins each of them plus the whole chain.
//
//   1. Base.js substitutes variable inputs into every grid-item arg. A non-string
//      arg (the Map's `layers` array) is JSON-stringified, substituted and parsed
//      back, so a `${...}` nested at layers[i].configuration.props.source.props.url
//      is reached. The changed args differ from the last fetched ones, so
//      getVisualization runs again and hands the Map the substituted layers.
//   2. visualizations/Map.js sees a `layers` prop unequal to the last one and
//      republishes the layer configurations to map/Map.js.
//   3. map/Map.js reconciles: a static layer is kept only when its props are
//      valuesEqual to an incoming layer's, so a changed URL tears the old OL
//      layer down and builds a new one on the new file.
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import PropTypes from "prop-types";
import { useContext } from "react";
import { Map } from "ol";
import WebGLTileLayer from "ol/layer/WebGLTile";
import createLoadedComponent from "__tests__/utilities/customRender";
import BaseVisualization from "components/visualizations/Base";
import * as utilities from "components/visualizations/utilities";
import {
  GridItemContext,
  VariableInputsContext,
} from "components/contexts/Contexts";

global.ResizeObserver = require("resize-observer-polyfill");

// No real header reads: the CRS and statistics readers fall back, as they do
// for a file whose header cannot be read.
jest.mock("geotiff", () => ({
  fromUrl: jest.fn().mockRejectedValue(new Error("no header reads in tests")),
}));

// A GeoTIFF source that opens nothing, but keeps the options it was built with
// so a test can read which file a layer points at.
jest.mock("ol/source/GeoTIFF.js", () => {
  const ActualSource = jest.requireActual("ol/source/Source.js").default;
  class MockGeoTIFFSource extends ActualSource {
    constructor(options) {
      super({ projection: null });
      this.options = options;
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
  return { __esModule: true, default: MockGeoTIFFSource };
});

// eslint-disable-next-line no-template-curly-in-string
const URL_TEMPLATE = "https://example.com/rasters/depth_${Year}.tif";

const staticGeoTIFFLayer = (url) => ({
  configuration: {
    type: "WebGLTile",
    props: {
      name: "Depth",
      source: { type: "GeoTIFF", props: { url } },
    },
  },
});

const mapArgsString = JSON.stringify({
  baseMap: null,
  layers: [staticGeoTIFFLayer(URL_TEMPLATE)],
  layerControl: false,
  map_extent: { extent: "-10686671.12,4721671.57,5" },
  mapConfig: {},
});

afterEach(() => {
  jest.restoreAllMocks();
});

// The URL every GeoTIFF source a WebGLTile layer was built on points at, in the
// order the layers were added to the map.
function addedGeoTIFFUrls(addLayerSpy) {
  return addLayerSpy.mock.calls
    .map(([layer]) => layer)
    .filter((layer) => layer instanceof WebGLTileLayer)
    .map((layer) => layer.getSource()?.options?.sources?.[0]?.url);
}

describe("step 1: variable-input substitution reaches a nested layer URL", () => {
  it("substitutes a variable reference inside the layers array arg", () => {
    const resolved = utilities.updateObjectWithVariableInputs({
      args: JSON.parse(mapArgsString),
      variableInputs: { Year: "2024" },
    });
    expect(resolved.layers[0].configuration.props.source.props.url).toBe(
      "https://example.com/rasters/depth_2024.tif",
    );
    // The arg keeps its shape: still an array of layer wrappers.
    expect(Array.isArray(resolved.layers)).toBe(true);
  });

  it("re-runs getVisualization with the new URL when the input changes", async () => {
    const realGetVisualization = utilities.getVisualization;
    const captured = [];
    const spy = jest
      .spyOn(utilities, "getVisualization")
      .mockImplementation((options) =>
        // The real Map branch, with what it hands the Map recorded.
        realGetVisualization({
          ...options,
          setVizType: () => {},
          setVizData: (data) => captured.push(data),
        }),
      );

    const tree = (values) => (
      <VariableInputsContext.Provider
        value={{
          variableInputValues: values,
          variableInputDateFormats: {},
          variableInputSliderMeta: {},
          setVariableInputValues: jest.fn(),
        }}
      >
        <GridItemContext.Provider
          value={{
            gridItemSource: "Map",
            gridItemArgsString: mapArgsString,
            gridItemMetadataString: JSON.stringify({ refreshRate: 0 }),
            gridItemUUID: "static-url-uuid",
            shouldLoad: true,
          }}
        >
          <BaseVisualization />
        </GridItemContext.Provider>
      </VariableInputsContext.Provider>
    );

    const { rerender } = render(
      createLoadedComponent({ children: tree({ Year: "2024" }) }),
    );
    await waitFor(() => expect(captured).toHaveLength(1));
    expect(captured[0].layers[0].configuration.props.source.props.url).toBe(
      "https://example.com/rasters/depth_2024.tif",
    );

    rerender(createLoadedComponent({ children: tree({ Year: "2025" }) }));
    await waitFor(() => expect(captured).toHaveLength(2));
    expect(captured[1].layers[0].configuration.props.source.props.url).toBe(
      "https://example.com/rasters/depth_2025.tif",
    );
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

// Drives the dashboard's own variable-input state, as a variable input
// visualization does when the viewer changes it.
const SetYear = ({ year }) => {
  const { setVariableInputValues } = useContext(VariableInputsContext);
  return (
    <button
      type="button"
      onClick={() =>
        setVariableInputValues((previous) => ({ ...previous, Year: year }))
      }
    >
      {`Set Year ${year}`}
    </button>
  );
};
SetYear.propTypes = { year: PropTypes.string.isRequired };

describe("the whole chain: Base -> visualizations/Map -> map/Map", () => {
  it("rebuilds a static GeoTIFF layer on the new file when the input changes", async () => {
    const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");
    const removeLayerSpy = jest.spyOn(Map.prototype, "removeLayer");

    render(
      createLoadedComponent({
        children: (
          <div>
            <SetYear year="2024" />
            <SetYear year="2025" />
            <GridItemContext.Provider
              value={{
                gridItemSource: "Map",
                gridItemArgsString: mapArgsString,
                gridItemMetadataString: JSON.stringify({ refreshRate: 0 }),
                gridItemUUID: "static-url-chain-uuid",
                shouldLoad: true,
              }}
            >
              <BaseVisualization />
            </GridItemContext.Provider>
          </div>
        ),
      }),
    );

    fireEvent.click(await screen.findByText("Set Year 2024"));
    await waitFor(() =>
      expect(addedGeoTIFFUrls(addLayerSpy)).toContain(
        "https://example.com/rasters/depth_2024.tif",
      ),
    );
    const firstLayer = addLayerSpy.mock.calls
      .map(([layer]) => layer)
      .find((layer) => layer instanceof WebGLTileLayer);

    fireEvent.click(screen.getByText("Set Year 2025"));
    await waitFor(() =>
      expect(addedGeoTIFFUrls(addLayerSpy)).toContain(
        "https://example.com/rasters/depth_2025.tif",
      ),
    );

    // A new OL layer on the new file, and the old one taken off the map.
    const lastLayer = addLayerSpy.mock.calls
      .map(([layer]) => layer)
      .filter((layer) => layer instanceof WebGLTileLayer)
      .at(-1);
    expect(lastLayer).not.toBe(firstLayer);
    await waitFor(() =>
      expect(removeLayerSpy.mock.calls.map(([layer]) => layer)).toContain(
        firstLayer,
      ),
    );
    // And the map ends up drawing only the new file.
    const map = addLayerSpy.mock.contexts.at(-1);
    await waitFor(() =>
      expect(
        map
          .getLayers()
          .getArray()
          .filter((layer) => layer instanceof WebGLTileLayer)
          .map((layer) => layer.getSource().options.sources[0].url),
      ).toEqual(["https://example.com/rasters/depth_2025.tif"]),
    );
  });
});

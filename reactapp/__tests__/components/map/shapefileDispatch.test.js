import {
  CLIENT_VECTOR_SOURCE_TYPES,
  layerPropertiesOptions,
  getLayerAttributes,
  getStyleFields,
  queryLayerFeatures,
} from "components/map/utilities";
import { acquireComponents } from "components/map/shapefile/acquire";
import { interpretShapefile } from "components/map/shapefile/index";

jest.mock("components/map/shapefile/acquire", () => ({
  acquireComponents: jest.fn(),
}));
jest.mock("components/map/shapefile/index", () => ({
  interpretShapefile: jest.fn(),
}));

const SOURCE_PROPS = {
  type: "Shapefile",
  props: { url: "https://example.org/basins.zip" },
};

const WITH_ATTRIBUTES = {
  featureCollection: {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { HUC8: "10190005", AREASQKM: 91, NAME: "Upper" },
        geometry: { type: "Point", coordinates: [0, 0] },
      },
      // A second feature carrying one field the first lacks, so the union rather
      // than the first record decides the field list.
      {
        type: "Feature",
        properties: { HUC8: "10190006", STATES: "CO" },
        geometry: { type: "Point", coordinates: [1, 1] },
      },
    ],
  },
  projectionCode: "EPSG:4326",
};

beforeEach(() => {
  acquireComponents.mockReset();
  interpretShapefile.mockReset();
  acquireComponents.mockResolvedValue({
    components: { shp: new Uint8Array() },
  });
  interpretShapefile.mockResolvedValue(WITH_ATTRIBUTES);
});

describe("client-vector source types", () => {
  it("includes Shapefile, so clicks and snapping read from the map", () => {
    // Absent from this list the snap path falls through to the feature-service
    // query and returns nothing -- a silent failure, not an error.
    expect(CLIENT_VECTOR_SOURCE_TYPES).toContain("Shapefile");
  });
});

describe("queryLayerFeatures", () => {
  it("reaches the client-vector branch for a shapefile layer instead of throwing", async () => {
    // Without Shapefile in the client-vector list this throws "is not currently
    // configured to be queried" -- it does not fall through to anything. The
    // empty result here is the point: dispatch arrived, found no matching
    // feature, and returned normally.
    const mockMap = {
      getView: jest.fn(() => ({
        getResolution: jest.fn(),
        getZoom: jest.fn(() => 10),
      })),
      forEachFeatureAtPixel: jest.fn((pixel, callback) => {
        callback(null, {
          get: jest.fn(() => "Some Other Layer"),
          getProperties: () => ({ name: "Some Other Layer" }),
        });
      }),
    };

    const features = await queryLayerFeatures(
      {
        configuration: { props: { name: "Basins", source: SOURCE_PROPS } },
      },
      mockMap,
      [0, 0],
      [639, 366],
    );

    expect(features).toStrictEqual([]);
    expect(mockMap.forEachFeatureAtPixel).toHaveBeenCalled();
  });
});

describe("shapefile field discovery is not wired into the generic dispatch", () => {
  // These functions had Shapefile arms with direct unit tests, and both panes
  // return before ever reaching them -- so the suite reported confidence in a
  // path production never took. What actually needs asserting is the
  // short-circuit, which is what makes those arms unnecessary.
  it("getStyleFields does not treat Shapefile as a delegating source", async () => {
    await expect(
      getStyleFields({
        sourceProps: { type: "Shapefile", props: { url: "https://x/b.zip" } },
        layerProps: { name: "Basins" },
      }),
    ).resolves.toEqual([]);
  });

  it("getLayerAttributes refuses a Shapefile rather than reading one", async () => {
    // Reaching this would download and parse the whole archive; the author
    // triggers that explicitly from the Source tab instead.
    await expect(
      getLayerAttributes({
        sourceProps: { type: "Shapefile", props: { url: "https://x/b.zip" } },
        layerName: "Basins",
      }),
    ).rejects.toThrow(/not currently configured/);
  });
});
describe("layerPropertiesOptions help text", () => {
  it("names Shapefile among the types clickTolerance applies to", () => {
    // This registry drives the editor's Layer Properties table, so the text is
    // user-visible.
    expect(layerPropertiesOptions.clickTolerance.placeholder).toContain(
      "Shapefile",
    );
  });

  it("names Shapefile among the types snapToFeatures applies to", () => {
    expect(layerPropertiesOptions.snapToFeatures.placeholder).toContain(
      "Shapefile",
    );
  });
});

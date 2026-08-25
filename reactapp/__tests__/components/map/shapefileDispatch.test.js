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

describe("getLayerAttributes — Shapefile", () => {
  it("returns the union of .dbf field names", async () => {
    const attributes = await getLayerAttributes({
      sourceProps: SOURCE_PROPS,
      layerName: "Basins",
      dashboard_uuid: "uuid",
    });

    expect(attributes.Basins.map((f) => f.name).sort()).toEqual([
      "AREASQKM",
      "HUC8",
      "NAME",
      "STATES",
    ]);
    // No alias source for a shapefile, so each field aliases to itself.
    expect(attributes.Basins.every((f) => f.alias === f.name)).toBe(true);
  });

  it("passes the author's projection through as the fallback", async () => {
    await getLayerAttributes({
      sourceProps: {
        ...SOURCE_PROPS,
        props: { ...SOURCE_PROPS.props, projection: "EPSG:5070" },
      },
      layerName: "Basins",
    });

    expect(interpretShapefile).toHaveBeenCalledWith(expect.anything(), {
      fallbackProjection: "EPSG:5070",
    });
  });

  it("returns an empty list rather than throwing when the source cannot be read", async () => {
    acquireComponents.mockResolvedValue({
      error: { stage: "fetch", reason: "unreachable", detail: "no host" },
    });

    const attributes = await getLayerAttributes({
      sourceProps: SOURCE_PROPS,
      layerName: "Basins",
    });

    expect(attributes).toEqual({ Basins: [] });
  });

  it("returns an empty list when interpretation fails", async () => {
    interpretShapefile.mockResolvedValue({
      error: { stage: "parse", reason: "missing_projection", detail: "no prj" },
    });

    const attributes = await getLayerAttributes({
      sourceProps: SOURCE_PROPS,
      layerName: "Basins",
    });

    expect(attributes).toEqual({ Basins: [] });
  });

  it("returns an empty list for geometry with no attributes", async () => {
    // Covers the no-.dbf case: the layer still renders and is styleable by
    // geometry-independent rules, but offers no fields.
    interpretShapefile.mockResolvedValue({
      featureCollection: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: { type: "Point", coordinates: [0, 0] },
          },
        ],
      },
      projectionCode: "EPSG:4326",
    });

    const attributes = await getLayerAttributes({
      sourceProps: SOURCE_PROPS,
      layerName: "Basins",
    });

    expect(attributes.Basins).toEqual([]);
  });
});

describe("getStyleFields — Shapefile", () => {
  it("returns the same field list attribute discovery does", async () => {
    // Registering in only one of the two discovery trees gives working fields in
    // one pane and an empty list in the other, so this asserts they agree.
    const styleFields = await getStyleFields({
      sourceProps: SOURCE_PROPS,
      layerProps: { name: "Basins" },
      dashboard_uuid: "uuid",
    });
    const attributes = await getLayerAttributes({
      sourceProps: SOURCE_PROPS,
      layerName: "Basins",
      dashboard_uuid: "uuid",
    });

    expect(styleFields.sort()).toEqual(
      attributes.Basins.map((f) => f.name).sort(),
    );
  });

  it("returns an empty list rather than throwing when the source cannot be read", async () => {
    acquireComponents.mockResolvedValue({ cancelled: true });

    const fields = await getStyleFields({
      sourceProps: SOURCE_PROPS,
      layerProps: { name: "Basins" },
    });

    expect(fields).toEqual([]);
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

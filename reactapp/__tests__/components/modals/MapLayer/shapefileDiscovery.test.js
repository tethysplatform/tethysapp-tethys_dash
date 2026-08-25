import { renderHook, act } from "@testing-library/react";
import {
  useShapefileDiscovery,
  resolveShapefileUrl,
  collectReferencedFields,
  SLOW_LOAD_MS,
} from "components/modals/MapLayer/shapefileDiscovery";
import { acquireComponents } from "components/map/shapefile/acquire";
import { interpretShapefile } from "components/map/shapefile/index";

jest.mock("components/map/shapefile/acquire", () => ({
  acquireComponents: jest.fn(),
}));
jest.mock("components/map/shapefile/index", () => ({
  interpretShapefile: jest.fn(),
}));

const SOURCE = {
  type: "Shapefile",
  props: { url: "https://example.org/basins.zip" },
};

function collection(propertySets) {
  return {
    featureCollection: {
      type: "FeatureCollection",
      features: propertySets.map((properties) => ({
        type: "Feature",
        properties,
        geometry: { type: "Point", coordinates: [0, 0] },
      })),
    },
    projectionCode: "EPSG:4326",
  };
}

function setup(overrides = {}) {
  return renderHook((props) => useShapefileDiscovery(props), {
    initialProps: {
      sourceProps: SOURCE,
      layerName: "Basins",
      variableInputValues: {},
      variableInputDateFormats: {},
      ...overrides,
    },
  });
}

beforeEach(() => {
  acquireComponents.mockReset();
  interpretShapefile.mockReset();
  acquireComponents.mockResolvedValue({
    components: { shp: new Uint8Array() },
  });
  interpretShapefile.mockResolvedValue(
    collection([
      { HUC8: "1", AREASQKM: 2 },
      { HUC8: "2", STATES: "CO" },
    ]),
  );
});

describe("resolveShapefileUrl", () => {
  it("returns a plain url unchanged", () => {
    expect(resolveShapefileUrl({ sourceProps: SOURCE })).toBe(
      "https://example.org/basins.zip",
    );
  });

  it("substitutes a variable-input template", () => {
    // The editor holds the raw configuration, so a templated url arrives here
    // unsubstituted -- and fetching it literally is guaranteed to fail, which
    // would make discovery unusable for exactly the sources variable inputs are
    // most useful for.
    const resolved = resolveShapefileUrl({
      sourceProps: {
        type: "Shapefile",
        // eslint-disable-next-line no-template-curly-in-string
        props: { url: "https://example.org/${Basin}.zip" },
      },
      variableInputValues: { Basin: "upper-colorado" },
      variableInputDateFormats: {},
    });
    expect(resolved).toBe("https://example.org/upper-colorado.zip");
  });

  it("returns null for a source with no url", () => {
    expect(
      resolveShapefileUrl({ sourceProps: { type: "Shapefile", props: {} } }),
    ).toBeNull();
  });
});

describe("collectReferencedFields", () => {
  it("finds fields named by style rules, including nested conditions", () => {
    const referenced = collectReferencedFields({
      style: {
        rules: [
          { conditionField: "HUC8", conditions: [{ field: "AREASQKM" }] },
          { conditionField: "" },
        ],
      },
    });
    expect(Array.from(referenced).sort()).toEqual(["AREASQKM", "HUC8"]);
  });

  it("finds fields bound to attribute variables and omitted from popups", () => {
    const referenced = collectReferencedFields({
      attributeProps: {
        variables: { Basins: { GAGE_ID: "Selected Gage" } },
        omitted: { Basins: ["SHAPE_LEN"] },
      },
    });
    expect(Array.from(referenced).sort()).toEqual(["GAGE_ID", "SHAPE_LEN"]);
  });

  it("returns nothing for an empty configuration", () => {
    expect(collectReferencedFields({}).size).toBe(0);
  });
});

describe("useShapefileDiscovery", () => {
  it("does not read the source until the author asks", async () => {
    const { result } = setup();
    expect(result.current.state).toBe("idle");
    expect(acquireComponents).not.toHaveBeenCalled();
  });

  it("does not read the source when props change", async () => {
    // This is the whole point of being author-triggered: the style pane's own
    // effect re-runs on every source-props change, which for a typed url is once
    // per keystroke -- and each run is a multi-megabyte download.
    const { rerender } = setup();
    rerender({
      sourceProps: {
        type: "Shapefile",
        props: { url: "https://example.org/basins.zi" },
      },
      layerName: "Basins",
      variableInputValues: {},
      variableInputDateFormats: {},
    });
    rerender({
      sourceProps: SOURCE,
      layerName: "Basins",
      variableInputValues: {},
      variableInputDateFormats: {},
    });
    expect(acquireComponents).not.toHaveBeenCalled();
  });

  it("returns the union of field names once loaded", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.load();
    });
    expect(result.current.state).toBe("ready");
    expect(result.current.fields.sort()).toEqual([
      "AREASQKM",
      "HUC8",
      "STATES",
    ]);
  });

  it("serves a second read of the same url from memory", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.load();
    });
    await act(async () => {
      await result.current.load();
    });
    expect(acquireComponents).toHaveBeenCalledTimes(1);
    expect(result.current.fields).toHaveLength(3);
  });

  it("reads again when the resolved url changes", async () => {
    const { result, rerender } = setup();
    await act(async () => {
      await result.current.load();
    });

    rerender({
      sourceProps: {
        type: "Shapefile",
        props: { url: "https://example.org/gages.zip" },
      },
      layerName: "Basins",
      variableInputValues: {},
      variableInputDateFormats: {},
    });
    await act(async () => {
      await result.current.load();
    });

    expect(acquireComponents).toHaveBeenCalledTimes(2);
  });

  it("names the convert-to-GeoJSON alternative on a fetch-stage failure", async () => {
    // Upload is not offered and a proxy is out of scope, so without this the
    // author is told the cause and left with no move.
    acquireComponents.mockResolvedValue({
      error: {
        stage: "fetch",
        reason: "unreachable",
        detail: "The shapefile could not be fetched.",
      },
    });
    const { result } = setup();

    await act(async () => {
      await result.current.load();
    });

    expect(result.current.state).toBe("error");
    expect(result.current.failure.detail).toMatch(/could not be fetched/);
    expect(result.current.failure.remedy).toMatch(/convert the shapefile/i);
  });

  it("does not offer that alternative for a failure it would not fix", async () => {
    interpretShapefile.mockResolvedValue({
      error: {
        stage: "parse",
        reason: "missing_projection",
        detail: "no projection",
      },
    });
    const { result } = setup();

    await act(async () => {
      await result.current.load();
    });

    expect(result.current.failure.remedy).toBeNull();
  });

  it("escalates a pending read past the threshold", async () => {
    jest.useFakeTimers();
    acquireComponents.mockImplementation(() => new Promise(() => {}));
    const { result } = setup();

    act(() => {
      result.current.load();
    });
    expect(result.current.slow).toBe(false);

    act(() => {
      jest.advanceTimersByTime(SLOW_LOAD_MS + 1);
    });
    // A pending indicator that never changes reads as a hang, and the author
    // retriggers the load and pays for it twice.
    expect(result.current.slow).toBe(true);
    jest.useRealTimers();
  });

  it("reports fields the saved configuration names but the source lacks", async () => {
    // Storing no schema keeps the field list true to the source, but moves
    // staleness into the rules naming those fields: an upstream rename leaves
    // them matching nothing while the layer still renders, so nothing fails.
    const { result } = setup({
      style: { rules: [{ conditionField: "POP2020" }] },
      attributeProps: { variables: { Basins: { GAGE_ID: "Gage" } } },
    });

    await act(async () => {
      await result.current.load();
    });

    expect(result.current.drift).toEqual(["GAGE_ID", "POP2020"]);
  });

  it("reports no drift when every referenced field is present", async () => {
    const { result } = setup({
      style: { rules: [{ conditionField: "HUC8" }] },
    });
    await act(async () => {
      await result.current.load();
    });
    expect(result.current.drift).toEqual([]);
  });

  it("reports no drift before a read has succeeded", async () => {
    const { result } = setup({
      style: { rules: [{ conditionField: "POP2020" }] },
    });
    expect(result.current.drift).toEqual([]);
  });

  it("is inert for a non-shapefile source", async () => {
    const { result } = setup({ sourceProps: { type: "GeoJSON", props: {} } });
    expect(result.current.isShapefile).toBe(false);
    expect(result.current.resolvedUrl).toBeNull();
    await act(async () => {
      await result.current.load();
    });
    expect(acquireComponents).not.toHaveBeenCalled();
  });

  it("waits for the cancelled state without reporting a failure", async () => {
    acquireComponents.mockResolvedValue({ cancelled: true });
    const { result } = setup();
    await act(async () => {
      await result.current.load();
    });
    expect(result.current.state).toBe("idle");
    expect(result.current.failure).toBeNull();
  });
});

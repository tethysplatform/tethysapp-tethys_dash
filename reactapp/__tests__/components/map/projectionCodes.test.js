import { isNativelyResolvable } from "components/map/projectionCodes";

describe("isNativelyResolvable", () => {
  it("accepts the codes OpenLayers ships with", () => {
    for (const code of [
      "EPSG:4326",
      "EPSG:3857",
      "EPSG:900913",
      "EPSG:102100",
    ]) {
      expect(isNativelyResolvable(code)).toBe(true);
    }
  });

  it("accepts both WGS84 UTM zone bands", () => {
    expect(isNativelyResolvable("EPSG:32612")).toBe(true); // northern
    expect(isNativelyResolvable("EPSG:32712")).toBe(true); // southern
  });

  it("rejects a code outside those bands", () => {
    expect(isNativelyResolvable("EPSG:2056")).toBe(false);
    expect(isNativelyResolvable("EPSG:32600")).toBe(false);
    expect(isNativelyResolvable("EPSG:32761")).toBe(false);
  });

  it("rejects anything that is not an EPSG code string", () => {
    expect(isNativelyResolvable("CRS:84")).toBe(false);
    expect(isNativelyResolvable(4326)).toBe(false);
    expect(isNativelyResolvable(undefined)).toBe(false);
  });

  it("tolerates surrounding whitespace", () => {
    expect(isNativelyResolvable("  EPSG:4326  ")).toBe(true);
  });
});

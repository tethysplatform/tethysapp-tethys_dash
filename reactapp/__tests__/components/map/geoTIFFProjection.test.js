// The CRS read that resolves a raster's projection before the map is built.
//
// Its own file because ModuleLoader.test.js calls jest.resetModules() partway
// through, after which the dynamic import inside openGeoTIFF resolves a fresh
// copy of the geotiff mock -- not the instance a file-scope import configured.
import { readGeoTIFFProjectionCode } from "components/map/ModuleLoader";
import { fromUrl } from "geotiff";

jest.mock("geotiff", () => ({ fromUrl: jest.fn() }));

describe("readGeoTIFFProjectionCode", () => {
  // The CRS read the view-projection resolution runs before the map is built.
  // Header only -- no pixels, no statistics sidecar.
  it("refuses a URL it must not fetch, without reading anything", async () => {
    for (const url of [
      undefined,
      null,
      42,
      "",
      "file:///tmp/local.tif",
      "blob:http://localhost/abc",
      "data:image/tiff;base64,AAAA",
      "//example.com/relative.tif",
    ]) {
      await expect(readGeoTIFFProjectionCode(url)).resolves.toBeNull();
    }
    expect(fromUrl).not.toHaveBeenCalled();
  });

  it("prefers a projected code, falls back to a geographic one", async () => {
    fromUrl.mockResolvedValue({
      getImage: jest.fn().mockResolvedValue({
        geoKeys: { ProjectedCSTypeGeoKey: 32620, GeographicTypeGeoKey: 4326 },
      }),
    });
    await expect(
      readGeoTIFFProjectionCode("https://example.com/a.tif"),
    ).resolves.toBe("EPSG:32620");

    fromUrl.mockResolvedValue({
      getImage: jest.fn().mockResolvedValue({
        geoKeys: { GeographicTypeGeoKey: 4326 },
      }),
    });
    await expect(
      readGeoTIFFProjectionCode("https://example.com/b.tif"),
    ).resolves.toBe("EPSG:4326");
  });

  it("treats a user-defined CRS as no code", async () => {
    // 32767 means the file carries the projection's parameters itself rather
    // than naming a code, so there is nothing to look up.
    fromUrl.mockResolvedValue({
      getImage: jest.fn().mockResolvedValue({
        geoKeys: { ProjectedCSTypeGeoKey: 32767, GeographicTypeGeoKey: 32767 },
      }),
    });
    await expect(
      readGeoTIFFProjectionCode("https://example.com/c.tif"),
    ).resolves.toBeNull();
  });

  it("yields null rather than throwing when the file cannot be read", async () => {
    fromUrl.mockRejectedValue(new Error("network down"));
    await expect(
      readGeoTIFFProjectionCode("https://example.com/gone.tif"),
    ).resolves.toBeNull();
  });

  it("yields null when the file carries no geo keys at all", async () => {
    fromUrl.mockResolvedValue({
      getImage: jest.fn().mockResolvedValue({}),
    });
    await expect(
      readGeoTIFFProjectionCode("https://example.com/plain.tif"),
    ).resolves.toBeNull();
  });
});

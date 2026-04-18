// @ts-check
const { test, expect } = require("@playwright/test");
const { createDashboard, truncateAll } = require("./helpers/db");
const { mapItem, wmsLayer, esriImageLayer, geojsonLayer } = require("./helpers/dashboards");
const {
  mockAuthEndpoints,
  mockTileResponses,
  suppressWelcomePopups,
} = require("./helpers/mocks");

const CANVAS_SELECTOR = "canvas";
const TIMEOUT = { timeout: 15_000 };

/** Helper: create a dashboard with a single map layer fixture and navigate. */
async function setupMapTest(page, layers, opts = {}) {
  const uuid = createDashboard([mapItem({ layers, layerControl: opts.layerControl || false })]);
  await suppressWelcomePopups(page);
  await mockAuthEndpoints(page);
  await mockTileResponses(page);
  await page.goto(`/apps/tethysdash/dashboard/${uuid}`);
  return uuid;
}

test.afterEach(async () => {
  truncateAll();
});

// ---------------------------------------------------------------------------
// WMS
// ---------------------------------------------------------------------------
test.describe("WMS layer", () => {
  test("renders map with WMS layer", async ({ page }) => {
    await setupMapTest(page, [
      wmsLayer("https://mock-wms.example.com/wms", "temperature"),
    ]);
    
    await expect(page.locator(CANVAS_SELECTOR).first()).toBeVisible(TIMEOUT);
  });
});

// ---------------------------------------------------------------------------
// ESRI Image and Map Service
// ---------------------------------------------------------------------------
test.describe("ESRI Image layer", () => {
  test("renders map with ESRI Image layer", async ({ page }) => {
    await setupMapTest(page, [
      esriImageLayer("https://mock-esri.example.com/MapServer", {
        layerId: "show:0",
      }),
    ]);
    
    await expect(page.locator(CANVAS_SELECTOR).first()).toBeVisible(TIMEOUT);
  });
});

// ---------------------------------------------------------------------------
// ESRI Feature Service
// ---------------------------------------------------------------------------
test.describe("ESRI Feature layer", () => {
  test("renders map with ESRI Feature layer", async ({ page }) => {
    const layer = {
      configuration: {
        type: "VectorLayer",
        props: {
          name: "ESRI Features",
          source: {
            type: "ESRI Feature Service",
            props: {
              url: "https://mock-esri.example.com/FeatureServer",
              layer: 0,
            },
          },
        },
      },
      queryable: false,
    };
    await setupMapTest(page, [layer]);
    
    await expect(page.locator(CANVAS_SELECTOR).first()).toBeVisible(TIMEOUT);
  });
});

// ---------------------------------------------------------------------------
// GeoJSON (inline)
// ---------------------------------------------------------------------------
test.describe("GeoJSON inline layer", () => {
  test("renders map with inline GeoJSON", async ({ page }) => {
    const geojson = {
      type: "FeatureCollection",
      crs: { type: "name", properties: { name: "EPSG:4326" } },
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [-111.89, 40.76] },
          properties: { name: "Salt Lake City" },
        },
      ],
    };
    await setupMapTest(page, [geojsonLayer(geojson, { name: "Test GeoJSON" })]);
    
    await expect(page.locator(CANVAS_SELECTOR).first()).toBeVisible(TIMEOUT);
  });
});

// ---------------------------------------------------------------------------
// GeoJSON (URL)
// ---------------------------------------------------------------------------
test.describe("GeoJSON URL layer", () => {
  test("renders map with GeoJSON URL", async ({ page }) => {
    // Mock the GeoJSON URL fetch
    await page.route("**/mock-geojson.example.com/**", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          type: "FeatureCollection",
          crs: { type: "name", properties: { name: "EPSG:4326" } },
          features: [],
        }),
      })
    );
    await setupMapTest(page, [
      geojsonLayer("https://mock-geojson.example.com/data.geojson"),
    ]);
    
    await expect(page.locator(CANVAS_SELECTOR).first()).toBeVisible(TIMEOUT);
  });
});

// ---------------------------------------------------------------------------
// KML
// ---------------------------------------------------------------------------
test.describe("KML layer", () => {
  test("renders map with KML layer", async ({ page }) => {
    const layer = {
      configuration: {
        type: "VectorLayer",
        props: {
          name: "KML Layer",
          source: {
            type: "KML",
            props: { url: "https://mock-kml.example.com/data.kml" },
          },
        },
      },
      queryable: false,
    };
    await setupMapTest(page, [layer]);
    
    await expect(page.locator(CANVAS_SELECTOR).first()).toBeVisible(TIMEOUT);
  });
});

// ---------------------------------------------------------------------------
// Image Tile
// ---------------------------------------------------------------------------
test.describe("Image Tile layer", () => {
  test("renders map with Image Tile layer", async ({ page }) => {
    const layer = {
      configuration: {
        type: "TileLayer",
        props: {
          name: "Tile Layer",
          source: {
            type: "Image Tile",
            props: { url: "https://mock-tiles.example.com/{z}/{x}/{y}.png" },
          },
        },
      },
      queryable: false,
    };
    await setupMapTest(page, [layer]);
    
    await expect(page.locator(CANVAS_SELECTOR).first()).toBeVisible(TIMEOUT);
  });
});

// ---------------------------------------------------------------------------
// Vector Tile
// ---------------------------------------------------------------------------
test.describe("Vector Tile layer", () => {
  test("renders map with Vector Tile layer", async ({ page }) => {
    const layer = {
      configuration: {
        type: "VectorTileLayer",
        props: {
          name: "Vector Tiles",
          source: {
            type: "Vector Tile",
            props: { urls: ["https://mock-mvt.example.com/{z}/{x}/{y}.pbf"] },
          },
        },
      },
      queryable: false,
    };
    await setupMapTest(page, [layer]);
    
    await expect(page.locator(CANVAS_SELECTOR).first()).toBeVisible(TIMEOUT);
  });
});

// ---------------------------------------------------------------------------
// PMTiles Vector
// ---------------------------------------------------------------------------
test.describe("PMTiles Vector layer", () => {
  test.fixme("renders map with PMTiles Vector layer", async ({ page }) => {
    // PMTiles requires the ol-pmtiles dynamic import which may not be in the
    // compiled bundle. Skip until verified in the build.
    const layer = {
      configuration: {
        type: "VectorTileLayer",
        props: {
          name: "PMTiles Vector",
          source: {
            type: "PMTiles Vector",
            props: { url: "https://mock-pmtiles.example.com/data.pmtiles" },
          },
        },
      },
      queryable: false,
    };
    await setupMapTest(page, [layer]);
    
  });
});

// ---------------------------------------------------------------------------
// PMTiles Raster
// ---------------------------------------------------------------------------
test.describe("PMTiles Raster layer", () => {
  test.fixme("renders map with PMTiles Raster layer", async ({ page }) => {
    // PMTiles Raster uses WebGLTile which requires WebGL in the browser.
    // Headless Chromium may not support WebGL. Skip until verified.
    const layer = {
      configuration: {
        type: "WebGLTile",
        props: {
          name: "PMTiles Raster",
          source: {
            type: "PMTiles Raster",
            props: { url: "https://mock-pmtiles.example.com/raster.pmtiles" },
          },
        },
      },
      queryable: false,
    };
    await setupMapTest(page, [layer]);
    
  });
});

// ---------------------------------------------------------------------------
// Multi-layer (WMS + GeoJSON with layer control)
// ---------------------------------------------------------------------------
test.describe("Multi-layer map", () => {
  test("renders map with multiple layers and layer control", async ({ page }) => {
    const geojson = {
      type: "FeatureCollection",
      crs: { type: "name", properties: { name: "EPSG:4326" } },
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [-111.89, 40.76] },
          properties: { name: "Test Point" },
        },
      ],
    };
    await setupMapTest(
      page,
      [
        wmsLayer("https://mock-wms.example.com/wms", "layer1", { name: "WMS Layer" }),
        geojsonLayer(geojson, { name: "GeoJSON Points" }),
      ],
      { layerControl: true }
    );
    
    await expect(page.locator(CANVAS_SELECTOR).first()).toBeVisible(TIMEOUT);
  });
});

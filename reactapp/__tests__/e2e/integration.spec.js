// @ts-check
/**
 * Integration tests — hit real public map services instead of mocking.
 *
 * Run with: npx playwright test --project=integration
 *
 * These tests are slower and may flake on network issues. They verify the
 * full pipeline against actual services (USGS, NOAA, OSM, etc.).
 */
const { test, expect } = require("@playwright/test");
const { createDashboard, truncateAll } = require("./helpers/db");
const { mapItem, wmsLayer } = require("./helpers/dashboards");
const {
  mockAuthEndpoints,
  suppressWelcomePopups,
} = require("./helpers/mocks");

// Real-service tests load remote tiles/WMS imagery that can be slower than the
// mocked fixtures. The per-test budget is bumped via test.describe.configure
// below; per-assertion timeouts stay modest since the DOM elements appear as
// soon as the map component mounts.
const TIMEOUT = { timeout: 30_000 };

// Skip all integration tests unless running with --project=integration
test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name !== "integration",
    "Integration tests run only with --project=integration"
  );
});

async function setupIntegrationTest(page, layers) {
  const uuid = createDashboard([mapItem({ layers })]);
  await suppressWelcomePopups(page);
  await mockAuthEndpoints(page);
  // NOTE: No mockTileResponses here — real tiles will load from the internet
  await page.goto(`/apps/tethysdash/dashboard/${uuid}`);
  return uuid;
}

/**
 * Track outgoing requests and successful responses to a service host.
 * Returns a live counter object the test can poll once the map has rendered.
 *
 * A passing "loads from real service" test should see at least one 2xx
 * response from the configured service URL — otherwise OpenLayers would
 * still render an empty canvas even when every tile request fails.
 */
function trackServiceTraffic(page, hostSubstring) {
  const counts = { requests: 0, ok: 0 };
  page.on("request", (req) => {
    if (req.url().includes(hostSubstring)) counts.requests += 1;
  });
  page.on("response", (res) => {
    if (res.url().includes(hostSubstring) && res.status() >= 200 && res.status() < 300) {
      counts.ok += 1;
    }
  });
  return counts;
}

test.afterEach(async () => {
  truncateAll();
});

test.describe("Integration: real services", () => {
  test.describe.configure({ timeout: 90_000 });

  test("Esri World Imagery tile layer loads from real service", async ({ page }) => {
    // Esri World Imagery tiles — public, no API key needed.
    // Note the {z}/{y}/{x} coordinate order (ArcGIS REST convention, not the
    // {z}/{x}/{y} that OSM-style tile servers use).
    const layer = {
      configuration: {
        type: "TileLayer",
        props: {
          name: "Esri World Imagery",
          source: {
            type: "Image Tile",
            props: {
              url: "https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
              attributions:
                "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
            },
          },
        },
      },
      queryable: false,
    };
    // Listeners must be attached before navigation so the initial tile
    // fetches are observed.
    const traffic = trackServiceTraffic(page, "services.arcgisonline.com");
    await setupIntegrationTest(page, [layer]);
    // Wait for the OpenLayers wrapper div and its <canvas>. Matches the
    // locator pattern used by the mocked map tests — the older
    // `[data-testid="backlayer-map"]` selector never reached the DOM because
    // components/map/Map.js does not forward the data-testid prop.
    await expect(page.locator('[aria-label="Map Div"]')).toBeVisible(TIMEOUT);
    await expect(page.locator("canvas").first()).toBeVisible(TIMEOUT);
    // Prove the service URL was actually reached and returned 2xx — an empty
    // canvas alone would pass even when every tile request failed.
    await expect.poll(() => traffic.requests, TIMEOUT).toBeGreaterThan(0);
    await expect.poll(() => traffic.ok, TIMEOUT).toBeGreaterThan(0);
  });

  test("NOAA nowCOAST weather radar WMS layer loads from real service", async ({ page }) => {
    // NOAA nowCOAST GeoServer WMS — public, no key.
    // GetCapabilities: https://nowcoast.noaa.gov/geoserver/observations/weather_radar/ows?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities
    const traffic = trackServiceTraffic(page, "nowcoast.noaa.gov");
    await setupIntegrationTest(page, [
      wmsLayer(
        "https://nowcoast.noaa.gov/geoserver/observations/weather_radar/ows",
        "base_reflectivity_mosaic",
        { name: "Weather Radar Base Reflectivity Mosaic" }
      ),
    ]);
    // Wait for the OpenLayers wrapper div and its <canvas>. Matches the
    // locator pattern used by the mocked map tests — the older
    // `[data-testid="backlayer-map"]` selector never reached the DOM because
    // components/map/Map.js does not forward the data-testid prop.
    await expect(page.locator('[aria-label="Map Div"]')).toBeVisible(TIMEOUT);
    await expect(page.locator("canvas").first()).toBeVisible(TIMEOUT);
    // Prove the service URL was actually reached and returned 2xx — an empty
    // canvas alone would pass even when every tile request failed.
    await expect.poll(() => traffic.requests, TIMEOUT).toBeGreaterThan(0);
    await expect.poll(() => traffic.ok, TIMEOUT).toBeGreaterThan(0);
  });
});

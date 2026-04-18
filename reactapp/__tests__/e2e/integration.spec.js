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

test.afterEach(async () => {
  truncateAll();
});

test.describe("Integration: real services", () => {
  test("OSM-style Image Tile layer loads from real service", async ({ page }) => {
    // OpenStreetMap tiles — free, no API key needed
    const layer = {
      configuration: {
        type: "TileLayer",
        props: {
          name: "OSM",
          source: {
            type: "Image Tile",
            props: {
              url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
              attributions: "© OpenStreetMap contributors",
            },
          },
        },
      },
      queryable: false,
    };
    await setupIntegrationTest(page, [layer]);
    await expect(page.locator('[data-testid="backlayer-map"]')).toBeVisible(TIMEOUT);
    await expect(page.locator("canvas").first()).toBeVisible(TIMEOUT);
  });

  test("USGS WMS layer loads from real service", async ({ page }) => {
    // USGS National Map WMS — public, no key
    await setupIntegrationTest(page, [
      wmsLayer(
        "https://basemap.nationalmap.gov/arcgis/services/USGSTopo/MapServer/WMSServer",
        "0",
        { name: "USGS Topo" }
      ),
    ]);
    await expect(page.locator('[data-testid="backlayer-map"]')).toBeVisible(TIMEOUT);
    await expect(page.locator("canvas").first()).toBeVisible(TIMEOUT);
  });
});

/**
 * Playwright route interception helpers for E2E tests.
 *
 * Provides mock responses for:
 * - Tile/WMS/ESRI service requests (1x1 pixel PNG)
 * - Django API responses for backend plugin visualizations
 * - Auth/session endpoints
 */

// 1x1 transparent PNG (68 bytes)
const ONE_PX_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

/**
 * Mock all common tile/image service requests.
 * Intercepts WMS, ESRI, OSM, and generic tile URLs.
 */
async function mockTileResponses(page) {
  // WMS GetMap requests
  await page.route("**/*?*SERVICE=WMS*", (route) =>
    route.fulfill({ body: ONE_PX_PNG, contentType: "image/png" })
  );

  // ESRI MapServer/ImageServer export
  await page.route("**/MapServer/export*", (route) =>
    route.fulfill({ body: ONE_PX_PNG, contentType: "image/png" })
  );
  await page.route("**/ImageServer/export*", (route) =>
    route.fulfill({ body: ONE_PX_PNG, contentType: "image/png" })
  );

  // ESRI FeatureServer query
  await page.route("**/FeatureServer/*/query*", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        type: "FeatureCollection",
        features: [],
      }),
    })
  );

  // Generic tile patterns (z/x/y)
  await page.route(/\/\d+\/\d+\/\d+\.(png|jpg|pbf|mvt)/, (route) =>
    route.fulfill({ body: ONE_PX_PNG, contentType: "image/png" })
  );

  // OpenStreetMap tiles
  await page.route("**tile.openstreetmap.org**", (route) =>
    route.fulfill({ body: ONE_PX_PNG, contentType: "image/png" })
  );

  // PMTiles
  await page.route("**/*.pmtiles*", (route) =>
    route.fulfill({ body: ONE_PX_PNG, contentType: "application/octet-stream" })
  );

  // KML files
  await page.route("**/*.kml*", (route) =>
    route.fulfill({
      contentType: "application/vnd.google-earth.kml+xml",
      body: `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Test</name></Document></kml>`,
    })
  );
}

/**
 * Mock the Django API response for a specific grid item's visualization.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} gridItemUuid - The grid item UUID to intercept
 * @param {string} vizType - The viz_type to return (plotly, table, map, card, image, text, etc.)
 * @param {Object} data - The visualization data to return
 */
async function mockApiVisualization(page, gridItemUuid, vizType, data) {
  await page.route(
    (url) => url.pathname.includes("/visualizations/get/"),
    (route, request) => {
      const postData = request.postData() || "";
      if (postData.includes(gridItemUuid)) {
        return route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              viz_type: vizType,
              ...data,
            },
          }),
        });
      }
      return route.continue();
    }
  );
}

/**
 * Mock auth/session endpoints so the SPA loads without a real user session.
 */
async function mockAuthEndpoints(page) {
  await page.route("**/api/session/**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ is_authenticated: true, username: "admin" }),
    })
  );

  await page.route("**/api/whoami/**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ username: "admin", is_staff: true }),
    })
  );

  // CSRF: the Axios interceptor returns response.data when truthy, stripping
  // headers.  The real endpoint returns an empty body so the interceptor falls
  // through to the full response (which has headers).  We must do the same.
  await page.route("**/api/csrf/**", (route) =>
    route.fulfill({
      status: 200,
      headers: { "x-csrftoken": "test-csrf-token" },
      body: "",
    })
  );
}

module.exports = {
  ONE_PX_PNG,
  mockTileResponses,
  mockApiVisualization,
  mockAuthEndpoints,
};

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
      const urlStr = request.url();
      const postData = request.postData() || "";
      // Match by gridItemUuid in either URL query (requestId=<uuid>) or POST body
      if (urlStr.includes(gridItemUuid) || postData.includes(gridItemUuid)) {
        return route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            viz_type: vizType, // top-level, matches utilities.js checks
            data,
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

/**
 * Suppress welcome popups / dialogs that block dashboard interaction.
 * Must be called BEFORE page.goto(), so the value is set before React init.
 */
async function suppressWelcomePopups(page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("dontShowPublicLoginOnStart", "true");
      localStorage.setItem("dontShowLandingPageInfoOnStart", "true");
      localStorage.setItem("dontShowDashboardInfoOnStart", "true");
    } catch {
      // localStorage may be unavailable for some origins — ignore
    }
  });
}

// ---------------------------------------------------------------------------
// MCP server mocks (Unit 7b)
// ---------------------------------------------------------------------------
//
// The chatbox-core engine uses the @modelcontextprotocol SDK, which picks a
// transport by URL suffix:
//   - /mcp  → StreamableHTTPClientTransport (HTTP POST, JSON-RPC responses)
//   - /sse  → SSEClientTransport (persistent SSE stream + POST message endpoint)
//   - other → HTTP-first fallback, then SSE
//
// The StreamableHTTP path is the simpler one to mock: the transport's
// `send(message)` issues a POST whose body is the JSON-RPC frame, and it
// accepts EITHER `application/json` (a direct JSON-RPC result) OR
// `text/event-stream` in response. We return JSON, which sidesteps all
// streaming-response fixture complexity. `page.route` intercepts fetch
// reliably — no Node http server needed for the cases this project covers.
//
// To force the HTTP transport (and thus take this simpler path) the tests
// use URLs ending in `/mcp`. The SDK also issues a preflight GET against
// the URL to look for a server-push SSE stream; 405 means "not supported,
// but fine" (streamableHttp.js:~100) so we return 405 for any GET.
//
// For the FAILED scenario, we can just short-circuit everything with 500.

/**
 * Install a mock MCP server that successfully handshakes and returns the
 * given tool list from list_tools. Use a URL whose path ends in `/mcp` so
 * the SDK selects StreamableHTTPClientTransport (simpler to mock than SSE).
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} url - Full URL the chatbox will connect to (e.g., http://mock-mcp.test/mcp).
 * @param {Array<Object>} tools - Tools to return from tools/list. Each: { name, description, inputSchema }.
 */
async function mockMcpServer(page, url, tools = []) {
  await page.route(url, async (route, request) => {
    const method = request.method();

    // Preflight GET: the SDK opens an optional standalone SSE stream with
    // GET. 405 tells it "not supported but fine" (spec-allowed) — POST-only
    // JSON-RPC is sufficient for a minimal handshake + list_tools.
    if (method === "GET") {
      return route.fulfill({ status: 405, contentType: "text/plain", body: "" });
    }

    if (method === "POST") {
      const bodyText = request.postData() || "";
      let msg = null;
      try {
        msg = JSON.parse(bodyText);
      } catch {
        return route.fulfill({ status: 400, contentType: "text/plain", body: "bad json" });
      }

      // Notifications (no `id` field) get a bare 202 with no body. The
      // Streamable-HTTP MCP transport spec requires servers to ack
      // notifications with `202 Accepted` — anything else (including 200)
      // makes the SDK warn or treat the response as a malformed reply.
      // We use `!('id' in msg)` rather than `msg.id === undefined` so a
      // future SDK that emits `{id: null}` notifications still routes here.
      if (msg && msg.method && !("id" in msg)) {
        return route.fulfill({
          status: 202,
          headers: { "mcp-session-id": "mock-session" },
          contentType: "text/plain",
          body: "",
        });
      }

      // initialize request
      if (msg?.method === "initialize") {
        return route.fulfill({
          status: 200,
          headers: { "mcp-session-id": "mock-session" },
          contentType: "application/json",
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: msg.id,
            result: {
              protocolVersion: msg.params?.protocolVersion || "2025-03-26",
              capabilities: { tools: {} },
              serverInfo: { name: "mock-mcp-server", version: "0.1.0" },
            },
          }),
        });
      }

      // tools/list
      if (msg?.method === "tools/list") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: msg.id,
            result: { tools },
          }),
        });
      }

      // Fallback for other requests: generic empty result so nothing throws.
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ jsonrpc: "2.0", id: msg?.id ?? null, result: {} }),
      });
    }

    // DELETE (session termination) and anything else → 200 no-op
    return route.fulfill({ status: 200, contentType: "text/plain", body: "" });
  });
}

/**
 * Install a mock MCP server whose handshake succeeds but that exposes zero
 * tools. Result: the probe settles to the `no-tools` (orange) state.
 *
 * Kept as a named alias even though the body is `mockMcpServer(page, url, [])`
 * — call sites read more clearly when the no-tools intent is explicit, and
 * a future divergence (e.g., a no-tools fixture that also stubs a `prompts/list`
 * RPC to assert resources-only servers still go orange) can land here without
 * touching every caller.
 */
async function mockZeroToolsMcpServer(page, url) {
  return mockMcpServer(page, url, []);
}

/**
 * Install a mock MCP server that always fails with the given status code.
 * The chatbox's HTTP-first / SSE-fallback transport will exhaust both and
 * surface `connection-failed` (or `timeout` if the status code causes the
 * SDK to hang — 500 returns immediately, so expect `connection-failed`).
 */
async function mockFailedMcpServer(page, url, { statusCode = 500 } = {}) {
  await page.route(url, (route) =>
    route.fulfill({
      status: statusCode,
      contentType: "text/plain",
      body: "mock MCP failure",
    }),
  );
}

module.exports = {
  ONE_PX_PNG,
  mockTileResponses,
  mockApiVisualization,
  mockAuthEndpoints,
  suppressWelcomePopups,
  mockMcpServer,
  mockZeroToolsMcpServer,
  mockFailedMcpServer,
};

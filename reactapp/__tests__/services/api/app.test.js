import { server } from "__tests__/utilities/server";
import { rest } from "msw";
import appAPI, {
  DATA_REQUEST_FAILED,
  DATA_REQUEST_TOO_LARGE,
  PAGE_OUT_OF_DATE,
} from "services/api/app";

describe("appAPI APP_ROOT_URL fallback", () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
  });

  test("should default APP_ROOT_URL to /apps/tethysdash/ when TETHYS_APP_ROOT_URL is undefined", async () => {
    process.env = { ...originalEnv };
    delete process.env.TETHYS_APP_ROOT_URL;
    jest.resetModules();

    const { default: freshAppAPI } = require("services/api/app");

    let capturedUrl;
    server.use(
      rest.get(
        "http://api.test/apps/tethysdash/dashboards/list/",
        (req, res, ctx) => {
          capturedUrl = req.url.pathname;
          return res(
            ctx.status(200),
            ctx.json({ success: true, dashboards: [] }),
          );
        },
      ),
    );

    const response = await freshAppAPI.listDashboards();
    expect(capturedUrl).toBe("/apps/tethysdash/dashboards/list/");
    expect(response.success).toBe(true);
  });
});

describe("appAPI", () => {
  test("downloadJSON replaces HTML entities in response data", async () => {
    server.use(
      rest.get(
        "http://api.test/apps/tethysdash/json/download/",
        (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              success: true,
              data: {
                greaterThan: "&gt;",
                lessThan: "&lt;",
                greaterThanEqual: "&gt;=",
                lessThanEqual: "&lt;=",
                more: {
                  equal: "&eq;",
                  notEqual: "&ne;",
                  and: "&amp;",
                },
              },
            }),
            ctx.set("Content-Type", "application/json"),
          );
        },
      ),
    );

    const response = await appAPI.downloadJSON({
      filename: "some_json.json",
    });

    expect(response).toStrictEqual({
      success: true,
      data: {
        greaterThan: ">",
        lessThan: "<",
        greaterThanEqual: ">=",
        lessThanEqual: "<=",
        more: {
          equal: "==",
          notEqual: "!=",
          and: "&",
        },
      },
    });
  });

  test("downloadJSON handles response without success flag", async () => {
    server.use(
      rest.get(
        "http://api.test/apps/tethysdash/json/download/",
        (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              success: false,
              data: {
                test: "&gt;",
              },
            }),
            ctx.set("Content-Type", "application/json"),
          );
        },
      ),
    );

    const response = await appAPI.downloadJSON({
      filename: "test.json",
    });

    expect(response).toStrictEqual({
      success: false,
      data: {
        test: "&gt;", // Should not be replaced when success is false
      },
    });
  });

  test("getUserAppPermissions makes correct API call", async () => {
    const response = await appAPI.getUserAppPermissions();
    expect(response.success).toBe(true);
    expect(response.permissions).toEqual(["manage_visualizations"]);
  });

  test("getActivityData passes activity params correctly", async () => {
    const activity = { userId: 123, action: "view" };
    const response = await appAPI.getActivityData(activity);

    expect(response.status).toBe(1);
    expect(response.EXPIRE_AFTER).toBe(0);
    expect(response.WARN_AFTER).toBe(0);
  });

  test("listVisualizations returns visualization list", async () => {
    const response = await appAPI.listVisualizations();
    expect(response.visualizations).toBeDefined();
  });

  test("listVisualizationPermissions returns permissions", async () => {
    const response = await appAPI.listVisualizationPermissions();
    expect(response.success).toBe(true);
    expect(response.visualization_permissions).toBeDefined();
  });

  test("getDashboard passes id parameter correctly", async () => {
    const response = await appAPI.getDashboard({ id: 1 });
    expect(response.success).toBe(true);
    expect(response.dashboard).toBeDefined();
  });

  test("listDashboards returns dashboard list", async () => {
    const response = await appAPI.listDashboards();
    expect(response).toBeDefined();
  });

  // POST method tests
  test("updateVisualizationPermissions makes POST request correctly", async () => {
    server.use(
      rest.post(
        "http://api.test/apps/tethysdash/visualizations/permissions/update/",
        (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({ success: true }),
            ctx.set("Content-Type", "application/json"),
          );
        },
      ),
    );

    const data = { permissions: [] };
    const response = await appAPI.updateVisualizationPermissions(data);

    expect(response.success).toBe(true);
  });

  test("addDashboard makes POST request with data", async () => {
    let capturedBody = {};
    server.use(
      rest.post(
        "http://api.test/apps/tethysdash/dashboards/add/",
        async (req, res, ctx) => {
          capturedBody = await req.json();
          return res(
            ctx.status(200),
            ctx.json({ success: true, id: 123 }),
            ctx.set("Content-Type", "application/json"),
          );
        },
      ),
    );

    const data = { name: "Test Dashboard", layout: [] };
    const response = await appAPI.addDashboard(data);

    expect(response.success).toBe(true);
    expect(response.id).toBe(123);
    expect(capturedBody).toEqual(data);
  });

  test("copyDashboard makes POST request correctly", async () => {
    server.use(
      rest.post(
        "http://api.test/apps/tethysdash/dashboards/copy/",
        (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({ success: true, new_id: 456 }),
            ctx.set("Content-Type", "application/json"),
          );
        },
      ),
    );

    const data = { id: 123, new_name: "Copied Dashboard" };
    const response = await appAPI.copyDashboard(data);

    expect(response.success).toBe(true);
    expect(response.new_id).toBe(456);
  });

  test("deleteDashboard makes POST request correctly", async () => {
    server.use(
      rest.post(
        "http://api.test/apps/tethysdash/dashboards/delete/",
        (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({ success: true }),
            ctx.set("Content-Type", "application/json"),
          );
        },
      ),
    );

    const data = { id: 123 };
    const response = await appAPI.deleteDashboard(data);

    expect(response.success).toBe(true);
  });

  test("updateDashboard makes POST request correctly", async () => {
    server.use(
      rest.post(
        "http://api.test/apps/tethysdash/dashboards/update/",
        (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({ success: true }),
            ctx.set("Content-Type", "application/json"),
          );
        },
      ),
    );

    const data = { id: 123, name: "Updated Dashboard" };
    const response = await appAPI.updateDashboard(data);

    expect(response.success).toBe(true);
  });

  test("updatePermissionGroup makes POST request correctly", async () => {
    server.use(
      rest.post(
        "http://api.test/apps/tethysdash/permission_groups/update/",
        (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({ success: true }),
            ctx.set("Content-Type", "application/json"),
          );
        },
      ),
    );

    const data = { group_id: 1, permissions: [] };
    const response = await appAPI.updatePermissionGroup(data);

    expect(response.success).toBe(true);
  });

  test("deletePermissionGroup makes POST request correctly", async () => {
    server.use(
      rest.post(
        "http://api.test/apps/tethysdash/permission_groups/delete/",
        (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({ success: true }),
            ctx.set("Content-Type", "application/json"),
          );
        },
      ),
    );

    const data = { group_id: 1 };
    const response = await appAPI.deletePermissionGroup(data);

    expect(response.success).toBe(true);
  });

  test("uploadJSON makes POST request correctly", async () => {
    const response = await appAPI.uploadJSON({ file: "test-file" });
    expect(response.success).toBe(true);
    expect(response.filename).toBe("12345.json");
  });
});

// No helper takes a token: the client's interceptor attaches the page's own to
// every POST, so each sends its data alone and arrives with the token.
describe("appAPI POST helpers", () => {
  beforeEach(() => {
    window.location.assign("http://api.test/apps/tethysdash/");
    document.cookie = "csrftoken=page-token; path=/";
  });

  afterEach(() => {
    document.cookie =
      "csrftoken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  });

  test.each([
    ["updateVisualizationPermissions", "visualizations/permissions/update/"],
    ["addDashboard", "dashboards/add/"],
    ["copyDashboard", "dashboards/copy/"],
    ["deleteDashboard", "dashboards/delete/"],
    ["updateDashboard", "dashboards/update/"],
    ["updatePermissionGroup", "permission_groups/update/"],
    ["deletePermissionGroup", "permission_groups/delete/"],
    ["uploadJSON", "json/upload/"],
  ])("%s sends its data with the page's token", async (helper, path) => {
    let received;
    server.use(
      rest.post(
        `http://api.test/apps/tethysdash/${path}`,
        async (req, res, ctx) => {
          received = {
            token: req.headers.get("X-CSRFToken"),
            body: await req.json(),
          };
          return res(ctx.status(200), ctx.json({ success: true }));
        },
      ),
    );

    expect(appAPI[helper]).toHaveLength(1);
    const response = await appAPI[helper]({ id: 7 });

    expect(response.success).toBe(true);
    expect(received).toEqual({ token: "page-token", body: { id: 7 } });
  });
});

describe("appAPI data requests", () => {
  const DATA_URL = "http://api.test/apps/tethysdash/visualizations/get/";

  beforeEach(() => {
    window.location.assign("http://api.test/apps/tethysdash/");
    document.cookie = "csrftoken=page-token; path=/";
  });

  afterEach(() => {
    document.cookie =
      "csrftoken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  });

  // Answers every data request with `answer` and keeps what it was sent.
  const captureDataRequests = (answer) => {
    const received = [];
    server.use(
      rest.post(DATA_URL, async (req, res, ctx) => {
        received.push({
          token: req.headers.get("X-CSRFToken"),
          body: await req.json(),
        });
        return answer(req, res, ctx);
      }),
    );
    return received;
  };

  const ok = (req, res, ctx) =>
    res(ctx.status(200), ctx.json({ success: true, data: {}, viz_type: "x" }));

  test("getVisualizationData POSTs the dashboard, tile, source and resolved args", async () => {
    const received = captureDataRequests(ok);

    const response = await appAPI.getVisualizationData({
      dashboard: "dash-uuid",
      tile: "tile-uuid",
      source: "plot",
      args: { station: "ABC", start: "2024-01-01T00:00:00-07:00" },
      requestId: "tile-uuid",
    });

    expect(response.success).toBe(true);
    expect(received).toEqual([
      {
        token: "page-token",
        body: {
          dashboard: "dash-uuid",
          tile: "tile-uuid",
          source: "plot",
          // An object, not the JSON string a query parameter carried.
          args: { station: "ABC", start: "2024-01-01T00:00:00-07:00" },
          requestId: "tile-uuid",
        },
      },
    ]);
  });

  test("getVisualizationData sends empty args when given none", async () => {
    const received = captureDataRequests(ok);

    await appAPI.getVisualizationData({ dashboard: "d", source: "template" });

    expect(received[0].body).toEqual({
      dashboard: "d",
      source: "template",
      args: {},
    });
  });

  test("getVisualizationFeatures POSTs the layer with mode features", async () => {
    const received = captureDataRequests((req, res, ctx) =>
      res(
        ctx.status(200),
        ctx.json({
          success: true,
          viz_type: "features",
          data: { type: "FeatureCollection", features: [] },
        }),
      ),
    );

    const response = await appAPI.getVisualizationFeatures({
      dashboard: "dash-uuid",
      tile: "map-uuid",
      layer: "layer-1",
      source: "echo_runtime",
      args: { mode: "empty" },
      requestId: "nonce:map-uuid:layer-1",
    });

    expect(received).toEqual([
      {
        token: "page-token",
        body: {
          dashboard: "dash-uuid",
          tile: "map-uuid",
          layer: "layer-1",
          source: "echo_runtime",
          args: { mode: "empty" },
          requestId: "nonce:map-uuid:layer-1",
          mode: "features",
        },
      },
    ]);
    expect(response.data.type).toBe("FeatureCollection");
  });

  test("getVisualizationFeatures still cancels through its cancelToken", async () => {
    const axios = require("axios");
    const source = axios.CancelToken.source();
    // Long-but-finite delay: the cancel below fires synchronously, so it wins
    // the race, but the timer still settles before Jest's teardown.
    server.use(
      rest.post(DATA_URL, (req, res, ctx) =>
        res(ctx.delay(50), ctx.status(200), ctx.json({})),
      ),
    );

    const promise = appAPI.getVisualizationFeatures({
      dashboard: "dash-uuid",
      tile: "map-uuid",
      layer: "layer-1",
      source: "echo_runtime",
      args: {},
      requestId: "r",
      cancelToken: source.token,
    });
    // Attached synchronously, so the cancel's rejection is never unhandled.
    const captured = promise.catch((err) => err);
    source.cancel("superseded by newer fetch");

    expect(axios.isCancel(await captured)).toBe(true);
  });

  test("a refusal answered with 200 reaches the caller as sent", async () => {
    const refusal = {
      success: false,
      viz_type: null,
      data: {
        error:
          "This dashboard has changed. Reload it to see the latest version.",
      },
    };
    captureDataRequests((req, res, ctx) =>
      res(ctx.status(200), ctx.json(refusal)),
    );

    await expect(
      appAPI.getVisualizationData({ dashboard: "d", tile: "t", source: "s" }),
    ).resolves.toEqual(refusal);
  });

  test.each([
    [
      "the server's 413",
      413,
      "The values sent are too large. A request must be smaller than 2.5 MB.",
    ],
    [
      "the server's 405",
      405,
      "This page is out of date. Reload it to see the latest version.",
    ],
  ])("%s resolves to its own refusal", async (_, status, message) => {
    captureDataRequests((req, res, ctx) =>
      res(
        ctx.status(status),
        ctx.json({ success: false, data: { error: message }, viz_type: null }),
      ),
    );

    for (const request of [
      appAPI.getVisualizationData({ dashboard: "d", tile: "t", source: "s" }),
      appAPI.getVisualizationFeatures({
        dashboard: "d",
        tile: "t",
        layer: "l",
        source: "s",
      }),
    ]) {
      await expect(request).resolves.toEqual({
        success: false,
        data: { error: message },
        viz_type: null,
      });
    }
  });

  test.each([
    ["a proxy's bare 413", 413, DATA_REQUEST_TOO_LARGE],
    ["a bare 405", 405, PAGE_OUT_OF_DATE],
  ])("%s resolves to the server's message", async (_, status, message) => {
    captureDataRequests((req, res, ctx) =>
      res(
        ctx.status(status),
        ctx.set("Content-Type", "text/html"),
        ctx.body(`<html><body><h1>${status}</h1></body></html>`),
      ),
    );

    for (const request of [
      appAPI.getVisualizationData({ dashboard: "d", tile: "t", source: "s" }),
      appAPI.getVisualizationFeatures({
        dashboard: "d",
        tile: "t",
        layer: "l",
        source: "s",
      }),
    ]) {
      await expect(request).resolves.toEqual({
        success: false,
        data: { error: message },
        viz_type: null,
      });
    }
  });

  // The server's wording, from tethysapp/tethysdash/exceptions.py.
  test("the bare-error messages read as the server's own", () => {
    expect(DATA_REQUEST_TOO_LARGE).toBe("The values sent are too large.");
    expect(PAGE_OUT_OF_DATE).toBe(
      "This page is out of date. Reload it to see the latest version.",
    );
    expect(DATA_REQUEST_FAILED).toBe("Failed to retrieve data");
  });

  // None of the callers catches a rejection, which would leave a tile on its
  // loader.
  test.each([
    [
      "a CSRF failure page",
      403,
      "text/html",
      "<h1>Forbidden (403)</h1><p>CSRF verification failed.</p>",
    ],
    ["a gateway's 502", 502, "text/html", "<h1>502 Bad Gateway</h1>"],
    ["a 500 of another shape", 500, "application/json", '{"error": "x"}'],
  ])(
    "%s resolves to the message for a failed request",
    async (_, status, type, body) => {
      captureDataRequests((req, res, ctx) =>
        res(ctx.status(status), ctx.set("Content-Type", type), ctx.body(body)),
      );

      // Sent one at a time, so one that rejects fails here rather than
      // going unhandled.
      for (const send of [
        () =>
          appAPI.getVisualizationData({
            dashboard: "d",
            tile: "t",
            source: "s",
          }),
        () =>
          appAPI.getVisualizationFeatures({
            dashboard: "d",
            tile: "t",
            layer: "l",
            source: "s",
          }),
      ]) {
        await expect(send()).resolves.toEqual({
          success: false,
          data: { error: DATA_REQUEST_FAILED },
          viz_type: null,
        });
      }
    },
  );

  test("a request that gets no answer still rejects", async () => {
    captureDataRequests((req, res) => res.networkError("connection refused"));

    const error = await appAPI
      .getVisualizationData({ dashboard: "d", tile: "t", source: "s" })
      .catch((err) => err);

    expect(error.message).toBe("Network Error");
    expect(error.code).toBe("ERR_NETWORK");
  });

  test("a request cancelled before its error answer still rejects as a cancel", async () => {
    const axios = require("axios");
    const source = axios.CancelToken.source();
    captureDataRequests((req, res, ctx) =>
      res(ctx.delay(50), ctx.status(502), ctx.body("<h1>502</h1>")),
    );

    const promise = appAPI.getVisualizationFeatures({
      dashboard: "d",
      tile: "t",
      layer: "l",
      source: "s",
      cancelToken: source.token,
    });
    const captured = promise.catch((err) => err);
    source.cancel("superseded by newer fetch");

    expect(axios.isCancel(await captured)).toBe(true);
  });
});

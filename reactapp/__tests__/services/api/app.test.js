import { server } from "__tests__/utilities/server";
import { rest } from "msw";
import appAPI from "services/api/app";

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
            ctx.set("Content-Type", "application/json")
          );
        }
      )
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
            ctx.set("Content-Type", "application/json")
          );
        }
      )
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

  test("getVisualizationData passes itemData params correctly", async () => {
    const itemData = { id: 1, type: "chart" };
    const response = await appAPI.getVisualizationData(itemData);

    expect(response.success).toBe(true);
    expect(response.viz_type).toBe("plotly");
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
  test("updateVisualizationPermissions makes POST request with CSRF token", async () => {
    let capturedHeaders = {};
    server.use(
      rest.post(
        "http://api.test/apps/tethysdash/visualizations/permissions/update/",
        (req, res, ctx) => {
          capturedHeaders = req.headers.raw();
          return res(
            ctx.status(200),
            ctx.json({ success: true }),
            ctx.set("Content-Type", "application/json")
          );
        }
      )
    );

    const data = { permissions: [] };
    const csrf = "test-csrf-token";
    const response = await appAPI.updateVisualizationPermissions(data, csrf);

    expect(response.success).toBe(true);
    expect(capturedHeaders["x-csrftoken"]).toEqual(csrf);
  });

  test("addDashboard makes POST request with data and CSRF", async () => {
    let capturedBody = {};
    server.use(
      rest.post(
        "http://api.test/apps/tethysdash/dashboards/add/",
        async (req, res, ctx) => {
          capturedBody = await req.json();
          return res(
            ctx.status(200),
            ctx.json({ success: true, id: 123 }),
            ctx.set("Content-Type", "application/json")
          );
        }
      )
    );

    const data = { name: "Test Dashboard", layout: [] };
    const csrf = "test-csrf-token";
    const response = await appAPI.addDashboard(data, csrf);

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
            ctx.set("Content-Type", "application/json")
          );
        }
      )
    );

    const data = { id: 123, new_name: "Copied Dashboard" };
    const csrf = "test-csrf-token";
    const response = await appAPI.copyDashboard(data, csrf);

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
            ctx.set("Content-Type", "application/json")
          );
        }
      )
    );

    const data = { id: 123 };
    const csrf = "test-csrf-token";
    const response = await appAPI.deleteDashboard(data, csrf);

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
            ctx.set("Content-Type", "application/json")
          );
        }
      )
    );

    const data = { id: 123, name: "Updated Dashboard" };
    const csrf = "test-csrf-token";
    const response = await appAPI.updateDashboard(data, csrf);

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
            ctx.set("Content-Type", "application/json")
          );
        }
      )
    );

    const data = { group_id: 1, permissions: [] };
    const csrf = "test-csrf-token";
    const response = await appAPI.updatePermissionGroup(data, csrf);

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
            ctx.set("Content-Type", "application/json")
          );
        }
      )
    );

    const data = { group_id: 1 };
    const csrf = "test-csrf-token";
    const response = await appAPI.deletePermissionGroup(data, csrf);

    expect(response.success).toBe(true);
  });

  test("uploadJSON makes POST request correctly", async () => {
    const response = await appAPI.uploadJSON(
      { file: "test-file" },
      "test-csrf-token"
    );
    expect(response.success).toBe(true);
    expect(response.filename).toBe("12345.json");
  });
});

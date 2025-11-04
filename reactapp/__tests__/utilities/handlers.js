import { rest } from "msw";
import {
  mockedVisualizations,
  mockedDashboards,
  userDashboard,
  mockVisualizationPermissions,
} from "__tests__/utilities/constants";

const prefixUrlSegment = (process.env.TETHYS_PREFIX_URL || "").replace(
  /(^\/+|\/+?$)/g,
  ""
);
const staticBasePath = `${prefixUrlSegment ? `/${prefixUrlSegment}` : ""}/static/tethysdash/images/`;

const handlers = [
  rest.get("http://api.test/api/apps/tethysdash/", (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        title: "TethysDash",
        description: "",
        tags: "",
        package: "tethysdash",
        urlNamespace: "tethysdash",
        color: "",
        icon: `${staticBasePath}tethys_dash.png`,
        exitUrl: "/apps/",
        rootUrl: "/apps/tethysdash/",
        settingsUrl: "/admin/tethys_apps/tethysapp/999/change/",
      }),
      ctx.set("Content-Type", "application/json")
    );
  }),
  rest.get(
    "http://api.test/apps/tethysdash/visualizations/list/",
    (req, res, ctx) => {
      return res(
        ctx.status(200),
        ctx.json({
          visualizations: mockedVisualizations,
        }),
        ctx.set("Content-Type", "application/json")
      );
    }
  ),
  rest.get(
    "http://api.test/apps/tethysdash/dashboards/list/",
    (req, res, ctx) => {
      return res(
        ctx.status(200),
        ctx.json(mockedDashboards),
        ctx.set("Content-Type", "application/json")
      );
    }
  ),
  rest.get(
    "http://api.test/apps/tethysdash/json/download/",
    (req, res, ctx) => {
      return res(
        ctx.status(200),
        ctx.json({ data: {} }),
        ctx.set("Content-Type", "application/json")
      );
    }
  ),
  rest.get("http://api.test/apps/tethysdash/ping/", (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        status: 1,
        EXPIRE_AFTER: 0,
        WARN_AFTER: 0,
      }),
      ctx.set("Content-Type", "application/json")
    );
  }),
  rest.post("http://api.test/apps/tethysdash/json/upload/", (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({ success: true, filename: "12345.json" }),
      ctx.set("Content-Type", "application/json")
    );
  }),
  rest.get(
    "http://api.test/apps/tethysdash/app/permissions/",
    (req, res, ctx) => {
      return res(
        ctx.status(200),
        ctx.json({ success: true, permissions: ["manage_visualizations"] }),
        ctx.set("Content-Type", "application/json")
      );
    }
  ),
  rest.get(
    "http://api.test/apps/tethysdash/visualizations/permissions/list/",
    (req, res, ctx) => {
      return res(
        ctx.status(200),
        ctx.json({
          success: true,
          visualization_permissions: mockVisualizationPermissions,
        }),
        ctx.set("Content-Type", "application/json")
      );
    }
  ),
  rest.get(
    "http://api.test/apps/tethysdash/dashboards/get/",
    (req, res, ctx) => {
      return res(
        ctx.status(200),
        ctx.json({ success: true, dashboard: userDashboard }),
        ctx.set("Content-Type", "application/json")
      );
    }
  ),
  rest.post(
    "http://api.test/apps/tethysdash/visualizations/get/",
    (req, res, ctx) => {
      return res(
        ctx.status(200),
        ctx.json({ success: true, data: {}, viz_type: "plotly" }),
        ctx.set("Content-Type", "application/json")
      );
    }
  ),
  rest.get("http://api.test/api/session/", (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({ isAuthenticated: true }),
      ctx.set("Content-Type", "application/json"),
      ctx.set(
        "Set-Cookie",
        "sessionid=3mp52f19lnnrl1eeyb4b7xlxm9f2id8d; HttpOnly; Path=/; SameSite=Lax"
      )
    );
  }),
  rest.get("http://api.test/api/csrf/", (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.set(
        "X-CSRFToken",
        "SxICmOkFldX4o4YVaySdZq9sgn0eRd3Ih6uFtY8BgU5tMyZc7n90oJ4M2My5i7cy"
      )
    );
  }),
  rest.get("http://api.test/api/whoami/", (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        username: "admin",
        firstName: "John",
        lastName: "Smith",
        email: "jsmith@tethys.org",
        isAuthenticated: true,
        isStaff: true,
      }),
      ctx.set("Content-Type", "application/json")
    );
  }),
];

export { handlers };

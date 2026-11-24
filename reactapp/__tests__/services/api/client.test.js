import { server } from "__tests__/utilities/server";
import { rest } from "msw";
import apiClient, {
  CSRF_COOKIE_NAME_META,
  CSRF_TOKEN_META,
} from "services/api/client";

// The page the app runs on. The test env serves the API from http://api.test,
// so the page is put on that origin, as the app shell is in a deployment.
const PAGE = "http://api.test/apps/tethysdash/";
const OTHER_ORIGIN = "http://other.test";

function setCookie(name, value) {
  document.cookie = `${name}=${value}; path=/`;
}

function clearCookie(name) {
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

function addMeta(name, content) {
  const meta = document.createElement("meta");
  meta.setAttribute("name", name);
  meta.setAttribute("content", content);
  document.head.appendChild(meta);
}

// Answers every method at `${origin}/echo/` with the token header it received.
function echoTokenAt(origin) {
  const received = [];
  server.use(
    rest.all(`${origin}/echo/`, (req, res, ctx) => {
      received.push(req.headers.get("X-CSRFToken"));
      return res(ctx.status(200), ctx.json({ ok: true }));
    }),
  );
  return received;
}

beforeEach(() => {
  window.location.assign(PAGE);
});

afterEach(() => {
  clearCookie("csrftoken");
  clearCookie("portal_csrf");
  document.head
    .querySelectorAll(
      `meta[name="${CSRF_TOKEN_META}"], meta[name="${CSRF_COOKIE_NAME_META}"]`,
    )
    .forEach((meta) => meta.remove());
});

describe("the CSRF request interceptor", () => {
  test("a POST to a relative URL carries the cookie's token", async () => {
    const received = echoTokenAt("http://api.test");
    setCookie("csrftoken", "cookie-token");
    addMeta(CSRF_TOKEN_META, "embedded-token");

    await apiClient.post("/echo/", { a: 1 });

    expect(received).toEqual(["cookie-token"]);
  });

  test("a rotated cookie is sent on the next POST", async () => {
    const received = echoTokenAt("http://api.test");
    setCookie("csrftoken", "before-sign-in");
    await apiClient.post("/echo/", {});

    setCookie("csrftoken", "after-sign-in");
    await apiClient.post("/echo/", {});

    expect(received).toEqual(["before-sign-in", "after-sign-in"]);
  });

  test("without a readable cookie the POST carries the embedded token", async () => {
    const received = echoTokenAt("http://api.test");
    addMeta(CSRF_TOKEN_META, "embedded-token");

    await apiClient.post("/echo/", {});

    expect(received).toEqual(["embedded-token"]);
  });

  test("the cookie is read under the name the page gives", async () => {
    const received = echoTokenAt("http://api.test");
    addMeta(CSRF_COOKIE_NAME_META, "portal_csrf");
    setCookie("csrftoken", "default-name-token");
    setCookie("portal_csrf", "portal-token");

    await apiClient.post("/echo/", {});

    expect(received).toEqual(["portal-token"]);
  });

  test("an empty cookie falls back to the embedded token", async () => {
    const received = echoTokenAt("http://api.test");
    setCookie("csrftoken", "");
    addMeta(CSRF_TOKEN_META, "embedded-token");

    await apiClient.post("/echo/", {});

    expect(received).toEqual(["embedded-token"]);
  });

  test("with no cookie and no embedded token the POST is sent without one", async () => {
    const received = echoTokenAt("http://api.test");

    await apiClient.post("/echo/", {});

    expect(received).toEqual([null]);
  });

  test.each(["put", "patch", "delete"])(
    "a same-origin %s carries the token",
    async (method) => {
      const received = echoTokenAt("http://api.test");
      setCookie("csrftoken", "cookie-token");

      await apiClient.request({ method, url: "/echo/" });

      expect(received).toEqual(["cookie-token"]);
    },
  );

  test.each(["get", "head", "options"])(
    "a same-origin %s carries no token",
    async (method) => {
      const received = echoTokenAt("http://api.test");
      setCookie("csrftoken", "cookie-token");
      addMeta(CSRF_TOKEN_META, "embedded-token");

      await apiClient.request({ method, url: "/echo/" });

      expect(received).toEqual([null]);
    },
  );

  test("a POST to an absolute same-origin URL carries the token", async () => {
    const received = echoTokenAt("http://api.test");
    setCookie("csrftoken", "cookie-token");

    await apiClient.post("http://api.test/echo/", {});

    expect(received).toEqual(["cookie-token"]);
  });

  test.each([
    ["an absolute cross-origin URL", `${OTHER_ORIGIN}/echo/`, {}],
    ["a protocol-relative URL", "//other.test/echo/", {}],
    [
      "a relative URL under a cross-origin baseURL",
      "/echo/",
      { baseURL: OTHER_ORIGIN },
    ],
  ])("a POST to %s carries no token", async (_, url, config) => {
    const received = echoTokenAt(OTHER_ORIGIN);
    setCookie("csrftoken", "cookie-token");
    addMeta(CSRF_TOKEN_META, "embedded-token");

    await apiClient.post(url, {}, config);

    expect(received).toEqual([null]);
  });

  test("a page on another origin than the API sends the API no token", async () => {
    const received = echoTokenAt("http://api.test");
    window.location.assign("http://localhost/apps/tethysdash/");
    setCookie("csrftoken", "cookie-token");

    await apiClient.post("/echo/", {});

    expect(received).toEqual([null]);
  });

  test("a URL that cannot be parsed is treated as another origin", async () => {
    setCookie("csrftoken", "cookie-token");
    // The adapter receives the request as the interceptors left it.
    const sentHeaders = await apiClient.post(
      "http://[not-a-host/echo/",
      {},
      {
        adapter: async (config) => ({
          data: config.headers,
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        }),
      },
    );

    expect(sentHeaders).not.toHaveProperty("X-CSRFToken");
  });

  test("axios's own XSRF-TOKEN copying never sends a cookie to another origin", async () => {
    const received = [];
    server.use(
      rest.all(`${OTHER_ORIGIN}/echo/`, (req, res, ctx) => {
        received.push(req.headers.get("X-XSRF-TOKEN"));
        return res(ctx.status(200), ctx.json({ ok: true }));
      }),
    );
    setCookie("XSRF-TOKEN", "unrelated-app-token");

    try {
      await apiClient.post(`${OTHER_ORIGIN}/echo/`, {});
    } finally {
      clearCookie("XSRF-TOKEN");
    }

    expect(received).toEqual([null]);
  });
});

describe("the response interceptor", () => {
  test("unwraps the response body", async () => {
    echoTokenAt("http://api.test");

    expect(await apiClient.get("/echo/")).toEqual({ ok: true });
  });

  test("returns the whole response when the body is empty", async () => {
    server.use(
      rest.post("http://api.test/empty/", (req, res, ctx) =>
        res(ctx.status(204)),
      ),
    );

    const response = await apiClient.post("/empty/", {});

    expect(response.status).toBe(204);
  });

  test("passes a failed request's error on", async () => {
    server.use(
      rest.post("http://api.test/fails/", (req, res, ctx) =>
        res(ctx.status(500)),
      ),
    );

    await expect(apiClient.post("/fails/", {})).rejects.toMatchObject({
      response: { status: 500 },
    });
  });
});

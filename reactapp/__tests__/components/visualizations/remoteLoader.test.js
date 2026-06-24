import "@testing-library/jest-dom";

describe("remoteLoader", () => {
  let appendChildSpy;

  beforeEach(() => {
    jest.resetModules();
    global.__webpack_init_sharing__ = jest.fn(() => Promise.resolve());
    global.__webpack_share_scopes__ = { default: {} };
    appendChildSpy = jest
      .spyOn(document.head, "appendChild")
      .mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    delete global.__webpack_init_sharing__;
    delete global.__webpack_share_scopes__;
    jest.restoreAllMocks();
  });

  // Re-import module each time to get a fresh remoteCache
  const getModule = () =>
    require("../../../components/visualizations/remoteLoader");

  // ──────────────────────────────────────────────────────────
  // loadRemoteContainer - routing
  // ──────────────────────────────────────────────────────────
  describe("loadRemoteContainer", () => {
    test("defaults to webpack remote type", async () => {
      const scope = "WpDefault";
      const url = "https://example.com/wp-default.js";
      window[scope] = { init: jest.fn(), get: jest.fn() };

      const { loadRemoteContainer } = getModule();
      const container = await loadRemoteContainer({ scope, url });

      expect(container).toBe(window[scope]);
      delete window[scope];
    });

    test("routes to vite-esm loader when remoteType is 'vite-esm'", async () => {
      const scope = "ViteRoute";
      const url = "https://example.com/vite-route.js";

      jest.doMock(
        url,
        () => ({
          __esModule: true,
          default: { get: jest.fn(), init: jest.fn() },
        }),
        { virtual: true },
      );

      const { loadRemoteContainer } = getModule();
      const result = await loadRemoteContainer({
        scope,
        url,
        remoteType: "vite-esm",
      });

      expect(typeof result.get).toBe("function");
      expect(typeof result.init).toBe("function");
    });
  });

  // ──────────────────────────────────────────────────────────
  // webpack remote loading
  // ──────────────────────────────────────────────────────────
  describe("webpack remote loading", () => {
    test("resolves immediately with existing window[scope]", async () => {
      const scope = "Existing";
      const url = "https://example.com/existing.js";
      const existing = { init: jest.fn(), get: jest.fn() };
      window[scope] = existing;

      const { loadRemoteContainer } = getModule();
      const container = await loadRemoteContainer({ scope, url });

      expect(container).toBe(existing);
      expect(appendChildSpy).not.toHaveBeenCalled();
      delete window[scope];
    });

    test("creates script element with correct attributes", async () => {
      const scope = "ScriptAttrs";
      const url = "https://example.com/script-attrs.js";

      const { loadRemoteContainer } = getModule();
      const promise = loadRemoteContainer({ scope, url });

      const script = appendChildSpy.mock.calls[0][0];
      expect(script.src).toBe(url);
      expect(script.type).toBe("text/javascript");
      expect(script.async).toBe(true);

      // resolve to clean up
      window[scope] = { init: jest.fn(), get: jest.fn() };
      script.onload();
      await promise;
      delete window[scope];
    });

    test("resolves with container after script loads", async () => {
      const scope = "LoadOk";
      const url = "https://example.com/load-ok.js";
      const mockContainer = { init: jest.fn(), get: jest.fn() };

      const { loadRemoteContainer } = getModule();
      const promise = loadRemoteContainer({ scope, url });

      window[scope] = mockContainer;
      appendChildSpy.mock.calls[0][0].onload();

      const container = await promise;
      expect(container).toBe(mockContainer);
      delete window[scope];
    });

    test("rejects when window[scope] not found after load", async () => {
      const scope = "Missing";
      const url = "https://example.com/missing.js";

      const { loadRemoteContainer } = getModule();
      const promise = loadRemoteContainer({ scope, url });

      // simulate onload without setting window[scope]
      appendChildSpy.mock.calls[0][0].onload();

      await expect(promise).rejects.toThrow(
        `Webpack remote loaded but window.${scope} was not found`,
      );
    });

    test("rejects on script error", async () => {
      const scope = "ScriptErr";
      const url = "https://example.com/script-err.js";

      const { loadRemoteContainer } = getModule();
      const promise = loadRemoteContainer({ scope, url });

      appendChildSpy.mock.calls[0][0].onerror();

      await expect(promise).rejects.toThrow(
        `Failed to load webpack remote: ${url}`,
      );
    });

    test("caches and reuses promise for same scope+url", async () => {
      const scope = "Cached";
      const url = "https://example.com/cached.js";
      const mockContainer = { init: jest.fn(), get: jest.fn() };

      const { loadRemoteContainer } = getModule();

      // Two calls before the script loads - only one script should be created
      const p1 = loadRemoteContainer({ scope, url });
      const p2 = loadRemoteContainer({ scope, url });

      expect(appendChildSpy).toHaveBeenCalledTimes(1);

      window[scope] = mockContainer;
      appendChildSpy.mock.calls[0][0].onload();

      const c1 = await p1;
      const c2 = await p2;

      expect(c1).toBe(c2);
      expect(c1).toBe(mockContainer);
      delete window[scope];
    });
  });

  // ──────────────────────────────────────────────────────────
  // vite-esm remote loading
  // ──────────────────────────────────────────────────────────
  describe("vite-esm remote loading", () => {
    test("wraps container with init and get from default export", async () => {
      const url = "https://example.com/vite-default-wrap.js";
      const mockGet = jest.fn();
      const mockInit = jest.fn();

      jest.doMock(
        url,
        () => ({ __esModule: true, default: { get: mockGet, init: mockInit } }),
        {
          virtual: true,
        },
      );

      const { loadRemoteContainer } = getModule();
      const result = await loadRemoteContainer({
        scope: "ViteWrap",
        url,
        remoteType: "vite-esm",
      });

      expect(typeof result.get).toBe("function");
      expect(typeof result.init).toBe("function");
    });

    test("provides no-op init when container lacks init()", async () => {
      const url = "https://example.com/vite-no-init.js";

      jest.doMock(
        url,
        () => ({ __esModule: true, default: { get: jest.fn() } }),
        {
          virtual: true,
        },
      );

      const { loadRemoteContainer } = getModule();
      const result = await loadRemoteContainer({
        scope: "ViteNoInit",
        url,
        remoteType: "vite-esm",
      });

      expect(typeof result.init).toBe("function");
      await expect(result.init()).resolves.toBeUndefined();
    });

    test("rejects when container lacks get() method", async () => {
      const url = "https://example.com/vite-no-get.js";

      jest.doMock(
        url,
        () => ({ __esModule: true, default: { init: jest.fn() } }),
        {
          virtual: true,
        },
      );

      const { loadRemoteContainer } = getModule();

      await expect(
        loadRemoteContainer({
          scope: "ViteNoGet",
          url,
          remoteType: "vite-esm",
        }),
      ).rejects.toThrow("does not expose a compatible get() API");
    });

    test("falls back to module itself when no default export", async () => {
      const url = "https://example.com/vite-fallback.js";
      const mockGet = jest.fn();

      jest.doMock(url, () => ({ __esModule: true, get: mockGet }), {
        virtual: true,
      });

      const { loadRemoteContainer } = getModule();
      const result = await loadRemoteContainer({
        scope: "ViteFallback",
        url,
        remoteType: "vite-esm",
      });

      expect(typeof result.get).toBe("function");
    });

    test("caches and reuses promise for same scope+url", async () => {
      const url = "https://example.com/vite-cached.js";

      jest.doMock(
        url,
        () => ({
          __esModule: true,
          default: { get: jest.fn(), init: jest.fn() },
        }),
        { virtual: true },
      );

      const { loadRemoteContainer } = getModule();
      const c1 = await loadRemoteContainer({
        scope: "ViteCached",
        url,
        remoteType: "vite-esm",
      });
      const c2 = await loadRemoteContainer({
        scope: "ViteCached",
        url,
        remoteType: "vite-esm",
      });

      expect(c1).toBe(c2);
    });
  });

  // ──────────────────────────────────────────────────────────
  // loadComponent
  // ──────────────────────────────────────────────────────────
  describe("loadComponent", () => {
    const setupWindowContainer = (scope, overrides = {}) => {
      const mockFactory = jest.fn(() => ({
        default: () => "component",
      }));
      window[scope] = {
        init: jest.fn(() => Promise.resolve()),
        get: jest.fn(() => Promise.resolve(mockFactory)),
        ...overrides,
      };
      return { mockFactory };
    };

    test("calls __webpack_init_sharing__ with 'default'", async () => {
      const scope = "InitSharing";
      setupWindowContainer(scope);

      const { loadComponent } = getModule();
      await loadComponent({ scope, module: "./Mod", url: "http://a.js" })();

      expect(global.__webpack_init_sharing__).toHaveBeenCalledWith("default");
      delete window[scope];
    });

    test("initializes container when not yet initialized", async () => {
      const scope = "NeedInit";
      const mockInit = jest.fn(() => Promise.resolve());
      setupWindowContainer(scope, { init: mockInit });

      const { loadComponent } = getModule();
      await loadComponent({ scope, module: "./Mod", url: "http://b.js" })();

      expect(mockInit).toHaveBeenCalledWith(
        global.__webpack_share_scopes__.default,
      );
      expect(window[scope].__initialized).toBe(true);
      delete window[scope];
    });

    test("skips init if container already initialized", async () => {
      const scope = "AlreadyInit";
      const mockInit = jest.fn();
      setupWindowContainer(scope, { __initialized: true, init: mockInit });

      const { loadComponent } = getModule();
      await loadComponent({ scope, module: "./Mod", url: "http://c.js" })();

      expect(mockInit).not.toHaveBeenCalled();
      delete window[scope];
    });

    test("handles init collision errors gracefully", async () => {
      const scope = "Collision";
      setupWindowContainer(scope, {
        init: jest.fn(() => Promise.reject(new Error("already initialized"))),
      });

      const { loadComponent } = getModule();

      await expect(
        loadComponent({ scope, module: "./Mod", url: "http://d.js" })(),
      ).resolves.toBeDefined();

      expect(window[scope].__initialized).toBe(true);
      delete window[scope];
    });

    test("calls container.get with module name", async () => {
      const scope = "GetMod";
      const mockGet = jest.fn(() =>
        Promise.resolve(() => ({ default: () => "comp" })),
      );
      setupWindowContainer(scope, { __initialized: true, get: mockGet });

      const { loadComponent } = getModule();
      await loadComponent({
        scope,
        module: "./SpecificModule",
        url: "http://e.js",
      })();

      expect(mockGet).toHaveBeenCalledWith("./SpecificModule");
      delete window[scope];
    });

    test("returns module with default export as-is", async () => {
      const scope = "DefaultExport";
      const MyComponent = () => "component";
      const mockFactory = jest.fn(() => ({ default: MyComponent }));
      setupWindowContainer(scope, {
        __initialized: true,
        get: jest.fn(() => Promise.resolve(mockFactory)),
      });

      const { loadComponent } = getModule();
      const result = await loadComponent({
        scope,
        module: "./Mod",
        url: "http://f.js",
      })();

      expect(result).toEqual({ default: MyComponent });
      delete window[scope];
    });

    test("wraps raw module in { default: module }", async () => {
      const scope = "RawExport";
      const RawComponent = () => "component";
      const mockFactory = jest.fn(() => RawComponent);
      setupWindowContainer(scope, {
        __initialized: true,
        get: jest.fn(() => Promise.resolve(mockFactory)),
      });

      const { loadComponent } = getModule();
      const result = await loadComponent({
        scope,
        module: "./Mod",
        url: "http://g.js",
      })();

      expect(result).toEqual({ default: RawComponent });
      delete window[scope];
    });

    test("skips init for containers without init function", async () => {
      const scope = "NoInitFn";
      const mockFactory = jest.fn(() => ({ default: () => "comp" }));
      window[scope] = {
        get: jest.fn(() => Promise.resolve(mockFactory)),
      };

      const { loadComponent } = getModule();
      const result = await loadComponent({
        scope,
        module: "./Mod",
        url: "http://h.js",
      })();

      expect(result).toEqual({ default: expect.any(Function) });
      delete window[scope];
    });
  });
});

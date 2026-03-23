// remoteLoader.js
const remoteCache = new Map();

async function loadWebpackRemote(scope, url) {
  if (remoteCache.has(`webpack:${scope}:${url}`)) {
    return remoteCache.get(`webpack:${scope}:${url}`);
  }

  const promise = new Promise((resolve, reject) => {
    if (window[scope]) {
      resolve(window[scope]);
      return;
    }

    const script = document.createElement("script");
    script.src = url;
    script.type = "text/javascript";
    script.async = true;

    script.onload = () => {
      const container = window[scope];
      if (!container) {
        reject(new Error(`Webpack remote loaded but window.${scope} was not found`));
        return;
      }
      resolve(container);
    };

    script.onerror = () => {
      reject(new Error(`Failed to load webpack remote: ${url}`));
    };

    document.head.appendChild(script);
  });

  remoteCache.set(`webpack:${scope}:${url}`, promise);
  return promise;
}

async function loadViteEsmRemote(scope, url) {
  if (remoteCache.has(`vite:${scope}:${url}`)) {
    return remoteCache.get(`vite:${scope}:${url}`);
  }

  const promise = import(/* webpackIgnore: true */ url).then((mod) => {
    const container = mod?.default ?? mod;

    if (!container || typeof container.get !== "function") {
      throw new Error(
        `Vite remote loaded from ${url}, but it does not expose a compatible get() API`
      );
    }

    return {
      init:
        typeof container.init === "function"
          ? container.init.bind(container)
          : async () => {},
      get: container.get.bind(container),
    };
  });

  remoteCache.set(`vite:${scope}:${url}`, promise);
  return promise;
}

export async function loadRemoteContainer({ scope, url, remoteType = "webpack" }) {
  console.log("[remoteLoader]", { scope, url, remoteType });
  if (remoteType === "vite-esm") {
    return loadViteEsmRemote(scope, url);
  }
  return loadWebpackRemote(scope, url);
}

export function loadComponent({ scope, module, url, remoteType = "webpack" }) {
  return async () => {
    const container = await loadRemoteContainer({ scope, url, remoteType });

    await __webpack_init_sharing__("default");

    if (!container.__initialized && typeof container.init === "function") {
      try {
        await container.init(__webpack_share_scopes__.default);
      } catch (e) {
        // ignore repeated init collisions
      }
      container.__initialized = true;
    }

    const factory = await container.get(module);
    const rawModule = await factory();

    // Normalize for React.lazy: always return { default: Component }
    if (
      rawModule &&
      typeof rawModule === "object" &&
      "default" in rawModule
    ) {
      return rawModule;
    }

    return { default: rawModule };
  };
}
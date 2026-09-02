export function getTethysPortalHost() {
  let tethys_portal_host = process.env.TETHYS_PORTAL_HOST;

  // If the .env property is not set, derive from current location
  if (!tethys_portal_host || !tethys_portal_host.length) {
    let currLocation = window.location.href;
    let url = new URL(currLocation);
    tethys_portal_host = url.origin;
  }

  return tethys_portal_host;
}

export const getPublicUrl = (uuid) => {
  return new URL(
    getTethysPortalHost() + getTethysAppRoot() + "dashboard/" + uuid,
  ).href;
};

export function getTethysPortalBase() {
  let tethys_portal_host = getTethysPortalHost();
  let tethys_prefix_url = (process.env.TETHYS_PREFIX_URL || "").replace(
    /^\/|\/$/g,
    "",
  );
  let baseUrl = tethys_portal_host;
  if (tethys_prefix_url) {
    baseUrl += `/${tethys_prefix_url}`;
  }

  baseUrl = baseUrl.replace(/([^:]\/)\/{2,}/g, "$1/");
  return baseUrl;
}

export function getTethysAppRoot() {
  let tethys_app_root_url =
    process.env.TETHYS_APP_ROOT_URL ?? "/apps/tethysdash/";
  let tethys_prefix_url = (process.env.TETHYS_PREFIX_URL || "").replace(
    /^\/|\/$/g,
    "",
  );
  let fp = `/${tethys_prefix_url}/${tethys_app_root_url}`;
  return fp.replace(/\/{2,}/g, "/");
}

export function getWebsocketUrl() {
  let configured = (process.env.REDIS_WS_URL || "").trim();

  // An empty value disables websocket usage entirely.
  if (!configured) {
    return null;
  }

  // An absolute websocket url is used as-is. This covers an external
  // notification host and the django dev server, which the webpack dev
  // server does not proxy websocket upgrades to.
  if (/^wss?:\/\//i.test(configured)) {
    return configured;
  }

  // Otherwise the value is a path under the app root and the origin is
  // derived from the current page, so deployed bundles never point the
  // visitor's browser at localhost.
  let host = getTethysPortalHost().replace(/\/+$/, "").replace(/^http/i, "ws");
  let path = `${getTethysAppRoot()}/${configured}`.replace(/\/{2,}/g, "/");

  return host + path;
}

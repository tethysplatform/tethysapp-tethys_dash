import { getConfig } from "services/config";

export function getTethysPortalHost() {
  let tethys_portal_host = getConfig().portalHost;

  // If not configured, derive from current location
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
  let tethys_prefix_url = (getConfig().prefixUrl || "").replace(
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
  let tethys_app_root_url = getConfig().appRootUrl ?? "/apps/tethysdash/";
  let tethys_prefix_url = (getConfig().prefixUrl || "").replace(
    /^\/|\/$/g,
    "",
  );
  let fp = `/${tethys_prefix_url}/${tethys_app_root_url}`;
  return fp.replace(/\/{2,}/g, "/");
}

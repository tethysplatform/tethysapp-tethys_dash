import axios from "axios";

import { getTethysPortalBase } from "services/utilities";

const TETHYS_PORTAL_BASE = getTethysPortalBase();

// The app shell (the `home` view) sets Django's CSRF cookie for every visitor
// and embeds the token and the cookie's name in these meta tags.
export const CSRF_TOKEN_META = "csrf-token";
export const CSRF_COOKIE_NAME_META = "csrf-cookie-name";
const DEFAULT_CSRF_COOKIE_NAME = "csrftoken";
const CSRF_HEADER = "X-CSRFToken";
const SAFE_METHODS = new Set(["get", "head", "options", "trace"]);

const apiClient = axios.create({
  baseURL: `${TETHYS_PORTAL_BASE}`,
  withCredentials: true,
  // Turn off axios's own cookie-to-header copying. Its default cookie name is
  // XSRF-TOKEN, and with withCredentials set axios 0.27 copies that cookie to
  // any origin; attachCsrfToken below is the only way a token is sent.
  xsrfCookieName: null,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

function readMeta(name) {
  return (
    document.querySelector(`meta[name="${name}"]`)?.getAttribute("content") ||
    null
  );
}

function readCookie(name) {
  for (const entry of document.cookie.split(";")) {
    const separator = entry.indexOf("=");
    if (separator !== -1 && entry.slice(0, separator).trim() === name) {
      return entry.slice(separator + 1).trim() || null;
    }
  }
  return null;
}

/**
 * The CSRF token to send now. The cookie is read on every call, so a token
 * rotated by a sign-in in another tab is picked up without a reload. A portal
 * that keeps the cookie from scripts (CSRF_COOKIE_HTTPONLY) or the token in the
 * session (CSRF_USE_SESSIONS) leaves only the token the page was served with.
 */
function currentCsrfToken() {
  const cookieName =
    readMeta(CSRF_COOKIE_NAME_META) || DEFAULT_CSRF_COOKIE_NAME;
  return readCookie(cookieName) || readMeta(CSRF_TOKEN_META);
}

// The URL the request goes to, resolved as axios resolves it: an absolute or
// protocol-relative url as given, anything else joined to baseURL. A url that
// cannot be parsed is treated as another origin.
function isSameOriginRequest(config) {
  try {
    const url = new URL(apiClient.getUri(config), window.location.href);
    return url.origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Attaches the CSRF token to every request that changes state, and only to
 * the page's own origin. axios's own xsrfCookieName is deliberately not used:
 * with withCredentials set, axios 0.27 sends that cookie to any origin
 * (CVE-2023-45857).
 */
function attachCsrfToken(config) {
  // axios has set config.method, in lower case, before an interceptor runs.
  if (SAFE_METHODS.has(config.method) || !isSameOriginRequest(config)) {
    return config;
  }
  const token = currentCsrfToken();
  if (token) {
    config.headers = { ...config.headers, [CSRF_HEADER]: token };
  }
  return config;
}

function handleSuccess(response) {
  return response.data ? response.data : response;
}

function handleError(error) {
  return Promise.reject(error);
}

apiClient.interceptors.request.use(attachCsrfToken);
apiClient.interceptors.response.use(handleSuccess, handleError);

export default apiClient;

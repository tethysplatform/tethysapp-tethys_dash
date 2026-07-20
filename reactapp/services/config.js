// Runtime configuration singleton.
//
// Deployment settings that were previously read from build-time `process.env`
// flow through this module so one compiled build can serve any backend. App
// modules read `getConfig()` instead of `process.env` directly.
//
// Source precedence:
//   1. `setConfig()` override — used by tests and any explicit seed.
//   2. Injected config — the backend renders the config into a
//      `<script id="tethysdash-config" type="application/json">` element in
//      index.html (Django `json_script`), parsed before the app renders. This
//      is the production path: route-independent and backend-agnostic (the
//      frontend reads a DOM node, never a backend-specific endpoint).
//   3. `process.env` bridge — dev/test fallback only; never reached in a
//      served build where the injected element is always present.

const DEFAULTS = {
  // Portal origin for the API base. "" → derive from window.location.origin.
  portalHost: "",
  // URL prefix segment shared by the API base and app root.
  prefixUrl: "",
  // App root path all app API paths are built under.
  appRootUrl: "/apps/tethysdash/",
  // WebSocket URL for progress notifications. "" → WS feature disabled.
  websocketUrl: "",
  // Tethys app id passed to getAppData().
  appId: undefined,
  // Error-display delay (ms) used by the loader.
  loaderDelay: undefined,
  // Session activity ping throttle (ms).
  sessionPingFrequency: undefined,
  // Support contact fields.
  supportEmail: undefined,
  supportGithub: undefined,
  // Show React error stack traces.
  debug: false,
  // Canonical-contract version the backend advertises.
  contractVersion: null,
};

// The canonical-contract version this frontend build targets. Compared against
// the backend-advertised contractVersion at boot (see checkContractVersion).
export const TARGET_CONTRACT_VERSION = "1.0";

function isPlainObject(value) {
  return (
    typeof value === "object" && value !== null && !Array.isArray(value)
  );
}

function fromInjected() {
  if (typeof document === "undefined") return null;
  const el = document.getElementById("tethysdash-config");
  if (el && el.textContent) {
    try {
      const parsed = JSON.parse(el.textContent);
      // Guard against a non-object payload (array/string/number) being spread
      // into the config and producing garbage keys.
      if (isPlainObject(parsed)) return parsed;
    } catch {
      // Malformed injection — fall through to the bridge/defaults.
    }
  }
  return null;
}

const IS_PRODUCTION = process.env.NODE_ENV === "production";

function fromEnv() {
  return {
    portalHost: process.env.TETHYS_PORTAL_HOST || "",
    prefixUrl: process.env.TETHYS_PREFIX_URL || "",
    appRootUrl: process.env.TETHYS_APP_ROOT_URL ?? DEFAULTS.appRootUrl,
    websocketUrl: process.env.REDIS_WS_URL || "",
    appId: process.env.TETHYS_APP_ID,
    loaderDelay: process.env.TETHYS_LOADER_DELAY,
    sessionPingFrequency: process.env.REACT_SESSION_PING_FREQUENCY,
    supportEmail: process.env.TETHYSDASH_SUPPORT_EMAIL,
    supportGithub: process.env.TETHYSDASH_SUPPORT_GITHUB,
    debug: process.env.TETHYS_DEBUG_MODE === "true",
    contractVersion: null,
  };
}

let override = null;

// Replace the entire runtime config. Called by test setup. Missing keys fall
// back to documented defaults.
export function setConfig(values) {
  override = { ...DEFAULTS, ...(values || {}) };
  return override;
}

// Read the current runtime config. Always returns a fully-populated object.
// A production build never falls back to the `process.env` bridge: if the
// injected element is missing, it resolves to DEFAULTS rather than silently
// resurrecting build-time-inlined dev values (e.g. ws://localhost:8000).
export function getConfig() {
  if (override) return override;
  const source = fromInjected() ?? (IS_PRODUCTION ? {} : fromEnv());
  return { ...DEFAULTS, ...source };
}

// Clear any override so `getConfig()` falls back to injection/env. Used by test
// teardown to keep tests isolated.
export function clearConfig() {
  override = null;
}

// Compare the backend-advertised contract version against this build's target.
// Returns "ok" | "mismatch" | "unknown"; logs a clear error on mismatch so a
// drifting backend is detectable rather than surfacing as an opaque failure.
export function checkContractVersion() {
  const advertised = getConfig().contractVersion;
  if (advertised == null) {
    // In production a null version means no config was injected — the app
    // booted on defaults. Surface it loudly rather than as silent "unknown".
    if (IS_PRODUCTION && fromInjected() === null) {
      // eslint-disable-next-line no-console
      console.error(
        "TethysDash: no runtime config was injected — the app booted on " +
          "defaults. The backend may not be serving the injected config element.",
      );
    }
    return "unknown";
  }
  if (advertised !== TARGET_CONTRACT_VERSION) {
    // eslint-disable-next-line no-console
    console.error(
      `TethysDash contract mismatch: frontend targets ${TARGET_CONTRACT_VERSION}, ` +
        `backend advertises ${advertised}. The frontend build and backend may be out of sync.`,
    );
    return "mismatch";
  }
  return "ok";
}

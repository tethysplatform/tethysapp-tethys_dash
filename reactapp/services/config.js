// Runtime configuration singleton.
//
// Deployment settings that were previously read from build-time `process.env`
// flow through this module so one compiled build can serve any backend. App
// modules read `getConfig()` instead of `process.env` directly.
//
// Milestone 1 bridge: until `setConfig()` is called, `getConfig()` derives its
// values live from `process.env`, so current build-time behavior is preserved
// and existing tests that mutate `process.env` keep working. The boot-split
// unit calls `setConfig()` with a `config.json` fetched before the app module
// evaluates (production), and tests call `setConfig()` to seed values; once an
// override is set it wins. A later unit removes the `process.env` fallback so
// the runtime path reads config only.

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
  // Canonical-contract version this build targets against the backend.
  contractVersion: null,
};

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

// Replace the entire runtime config. Called by the boot fetch (production) and
// by test setup. Once set, the override wins over the env bridge. Missing keys
// fall back to documented defaults.
export function setConfig(values) {
  override = { ...DEFAULTS, ...(values || {}) };
  return override;
}

// Read the current runtime config. Returns the override if one has been set,
// otherwise a live env-derived view (Milestone 1 bridge).
export function getConfig() {
  return override ?? { ...DEFAULTS, ...fromEnv() };
}

// Clear any override so `getConfig()` falls back to the env bridge. Used by
// test teardown to keep tests isolated.
export function clearConfig() {
  override = null;
}

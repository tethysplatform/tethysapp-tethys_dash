/**
 * pluginRegistry.js
 *
 * Persists user-registered runtime MFE plugins to localStorage.
 * Syncs to Django endpoint so the MCP server can read the registry.
 */

const STORAGE_KEY = "tethysdash_runtime_plugins";

export function getPlugins() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePlugins(plugins) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plugins));
  } catch {
    // localStorage full or unavailable
  }
}

export function addPlugin({
  url,
  scope,
  module,
  label,
  remoteType = "vite-esm",
  description = "",
  group = "Custom",
  tags = [],
  dataKey = "",
  args = {},
}) {
  const plugins = getPlugins();

  // Deduplicate by scope + module
  const key = `${scope}/${module}`;
  if (plugins.some((p) => `${p.scope}/${p.module}` === key)) {
    return plugins;
  }

  const entry = {
    id: crypto.randomUUID(),
    source: label.trim(),
    url: url.trim(),
    scope: scope.trim(),
    module: module.trim(),
    remoteType,
    label: label.trim(),
    description,
    group,
    tags,
    dataKey,
    args,
    type: "client_custom_remote",
  };

  const updated = [...plugins, entry];
  savePlugins(updated);
  return updated;
}

export function removePlugin(id) {
  const plugins = getPlugins();
  const updated = plugins.filter((p) => p.id !== id);
  savePlugins(updated);
  return updated;
}

export async function syncToServer(csrfToken) {
  const plugins = getPlugins();
  try {
    await fetch("/apps/tethysdash/runtime-plugins/sync/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrfToken,
      },
      body: JSON.stringify(plugins),
    });
  } catch (err) {
    console.warn("Failed to sync runtime plugins to server:", err);
  }
}

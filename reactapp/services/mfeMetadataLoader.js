/**
 * mfeMetadataLoader.js
 *
 * Attempts to load a ./meta module from a remote MFE via Module Federation.
 * Returns the metadata object if available, or null if not found.
 */
import { loadRemoteContainer } from "components/visualizations/remoteLoader";

export async function fetchMfeMetadata({ url, scope, remoteType = "vite-esm" }) {
  try {
    const container = await loadRemoteContainer({ scope, url, remoteType });

    if (!container.__initialized && typeof container.init === "function") {
      try {
        await container.init(__webpack_share_scopes__.default);
      } catch {
        // ignore repeated init collisions
      }
      container.__initialized = true;
    }

    const factory = await container.get("./meta");
    const rawModule = await factory();
    const meta = rawModule?.default ?? rawModule;

    if (!meta || typeof meta !== "object") return null;

    return {
      label: meta.label || "",
      description: meta.description || "",
      args: meta.args || {},
      dataKey: meta.dataKey || "",
      tags: Array.isArray(meta.tags) ? meta.tags : [],
    };
  } catch {
    // ./meta module not found or load failed — expected for MFEs without metadata
    return null;
  }
}

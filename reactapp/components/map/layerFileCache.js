import appAPI from "services/api/app";

// A saved layer file is written once, under a name nothing reuses: every editor
// save and every import uploads under a fresh uuid, a dashboard copy stores under
// the copy's own uuid, and the server refuses a name while the dashboard holds it.
// So what a name returns never changes, and downloading it again each time a map
// prepares its layers -- a variable change, a refresh, an export -- only repeats
// the same request. One dashboard's files are kept at a time, so moving between
// dashboards does not keep every one's GeoJSON alive.
const downloads = new Map();
let cachedDashboard = null;

/**
 * Download one of a dashboard's saved layer files, at most once while the page
 * stays on that dashboard.
 *
 * Answers as appAPI.downloadJSON does. Only a success is kept: a refusal or a
 * failed read may succeed later, once a permission is granted or a storage
 * outage is over. Each caller gets its own copy of the data, since preparing a
 * layer writes into the config it is handed.
 */
export async function downloadLayerFile({ filename, dashboard_uuid }) {
  if (dashboard_uuid !== cachedDashboard) {
    downloads.clear();
    cachedDashboard = dashboard_uuid;
  }
  const key = `${dashboard_uuid}/${filename}`;
  let pending = downloads.get(key);
  if (!pending) {
    pending = appAPI.downloadJSON({ filename, dashboard_uuid });
    downloads.set(key, pending);
  }

  const forget = () => {
    if (downloads.get(key) === pending) downloads.delete(key);
  };
  let response;
  try {
    response = await pending;
  } catch (error) {
    forget();
    throw error;
  }
  if (!response?.success) {
    forget();
    return response;
  }
  return { ...response, data: JSON.parse(JSON.stringify(response.data)) };
}

/** Forget every download, for tests that answer the same name differently. */
export function clearLayerFileCache() {
  downloads.clear();
  cachedDashboard = null;
}

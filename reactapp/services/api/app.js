import apiClient from "services/api/client";

const APP_ROOT_URL = process.env.TETHYS_APP_ROOT_URL ?? "/apps/tethysdash/";

// What a data request shows when it is turned away before the data endpoint
// can answer it in its own words (tethysapp/tethysdash/exceptions.py). A
// proxy's own 413 page states no limit the browser could read, so its message
// is the server's without one.
export const DATA_REQUEST_TOO_LARGE = "The values sent are too large.";
export const PAGE_OUT_OF_DATE =
  "This page is out of date. Reload it to see the latest version.";
export const DATA_REQUEST_FAILED = "Failed to retrieve data";

function refusedDataRequest(error) {
  return { success: false, data: { error }, viz_type: null };
}

/**
 * The answer to a data request that came back with an HTTP error, in the shape
 * of one refused with a 200, so every caller reads both from `data.error`: the
 * server's own refusal as it sent it (a 405 or a 413), a proxy's bare 413 or
 * 405 as the message the server would have sent, and any other -- a CSRF
 * failure page, a gateway's 502 -- as the server's message for a request that
 * failed. None of the callers catches a rejection, so one would leave a tile
 * on its loader. Only a request that got no answer at all rejects: one that
 * could not be sent, or was cancelled, which its caller lets go.
 */
function answerFromHttpError(error) {
  const response = error?.response;
  // A cancel carries no response. A network error carries the request in its
  // place (axios 0.27), which has no status in a browser, and is told apart by
  // its code wherever it has one.
  if (!response?.status || error.code === "ERR_NETWORK") throw error;
  const body = response.data;
  if (body?.success === false && typeof body.data?.error === "string") {
    return body;
  }
  if (response.status === 413) {
    return refusedDataRequest(DATA_REQUEST_TOO_LARGE);
  }
  if (response.status === 405) return refusedDataRequest(PAGE_OUT_OF_DATE);
  return refusedDataRequest(DATA_REQUEST_FAILED);
}

/**
 * Runs a tile's plugin, or a dynamic layer's within a Map tile. The request
 * names the dashboard, the tile and, for a dynamic layer, the layer's
 * `layerId`, so the server can run a viewer's request from the saved settings.
 * `args` are the resolved args, as an object; `requestId` only matches
 * progress messages to the tile that asked. `allArgs` says `args` holds every
 * arg, as for a caller who may edit the dashboard (see dataRequestArgs): only
 * then does the server run them as sent.
 */
function postDataRequest(
  { dashboard, tile, layer, source, args, requestId, mode, allArgs },
  config,
) {
  return apiClient
    .post(
      `${APP_ROOT_URL}visualizations/get/`,
      {
        dashboard,
        tile,
        layer,
        source,
        args: args ?? {},
        requestId,
        mode,
        allArgs: allArgs || undefined,
      },
      config,
    )
    .catch(answerFromHttpError);
}

function replaceHtmlEntitiesInExpressions(obj) {
  const replacements = {
    "&gt;": ">",
    "&lt;": "<",
    "&gt;=": ">=",
    "&lt;=": "<=",
    "&eq;": "==",
    "&ne;": "!=",
    "&amp;": "&", // just in case
  };

  if (typeof obj === "string") {
    return replacements[obj] || obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(replaceHtmlEntitiesInExpressions);
  }

  if (typeof obj === "object" && obj !== null) {
    const newObj = {};
    for (const key in obj) {
      newObj[key] = replaceHtmlEntitiesInExpressions(obj[key]);
    }
    return newObj;
  }

  return obj;
}

const appAPI = {
  getUserAppPermissions: () => {
    return apiClient.get(`${APP_ROOT_URL}app/permissions/`);
  },
  getActivityData: (activity) => {
    return apiClient.get(`${APP_ROOT_URL}ping/`, { params: activity });
  },
  getVisualizationData: (request) => {
    return postDataRequest(request);
  },
  getVisualizationFeatures: ({ cancelToken, ...request }) => {
    return postDataRequest({ ...request, mode: "features" }, { cancelToken });
  },
  listVisualizations: () => {
    return apiClient.get(`${APP_ROOT_URL}visualizations/list/`);
  },
  listVisualizationPermissions: () => {
    return apiClient.get(`${APP_ROOT_URL}visualizations/permissions/list/`);
  },
  updateVisualizationPermissions: (data) => {
    return apiClient.post(
      `${APP_ROOT_URL}visualizations/permissions/update/`,
      data,
    );
  },
  getDashboard: ({ id }) => {
    return apiClient.get(`${APP_ROOT_URL}dashboards/get/`, {
      params: { id },
    });
  },
  listDashboards: () => {
    return apiClient.get(`${APP_ROOT_URL}dashboards/list/`);
  },
  addDashboard: (data) => {
    return apiClient.post(`${APP_ROOT_URL}dashboards/add/`, data);
  },
  copyDashboard: (data) => {
    return apiClient.post(`${APP_ROOT_URL}dashboards/copy/`, data);
  },
  deleteDashboard: (data) => {
    return apiClient.post(`${APP_ROOT_URL}dashboards/delete/`, data);
  },
  updateDashboard: (data) => {
    return apiClient.post(`${APP_ROOT_URL}dashboards/update/`, data);
  },
  updatePermissionGroup: (data) => {
    return apiClient.post(`${APP_ROOT_URL}permission_groups/update/`, data);
  },
  deletePermissionGroup: (data) => {
    return apiClient.post(`${APP_ROOT_URL}permission_groups/delete/`, data);
  },
  uploadJSON: (data) => {
    return apiClient.post(`${APP_ROOT_URL}json/upload/`, data);
  },
  downloadJSON: async (data) => {
    let jsonData = await apiClient.get(`${APP_ROOT_URL}json/download/`, {
      params: data,
    });

    if (jsonData.success) {
      jsonData.data = replaceHtmlEntitiesInExpressions(jsonData.data);
    }
    return jsonData;
  },
};

export default appAPI;

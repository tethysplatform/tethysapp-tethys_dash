import apiClient from "services/api/client";

const APP_ROOT_URL = process.env.TETHYS_APP_ROOT_URL;

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
  getVisualizationData: (itemData) => {
    return apiClient.get(`${APP_ROOT_URL}visualizations/get/`, {
      params: itemData,
    });
  },
  // Runtime feature fetch for dynamic_map_layer plugins. Returns the backend
  // response envelope as-is: { success, data, viz_type }. On success, data is a
  // GeoJSON FeatureCollection; on failure, data is {error: "..."} with the
  // plugin exception message passed through (features-mode posture).
  // Accepts an optional axios CancelToken so the orchestrator can supersede
  // older in-flight fetches when variable inputs change.
  getVisualizationFeatures: ({ source, args, requestId, cancelToken }) => {
    return apiClient.get(`${APP_ROOT_URL}visualizations/get/`, {
      params: {
        source,
        args: typeof args === "string" ? args : JSON.stringify(args ?? {}),
        requestId,
        mode: "features",
      },
      cancelToken,
    });
  },
  listVisualizations: () => {
    return apiClient.get(`${APP_ROOT_URL}visualizations/list/`);
  },
  listVisualizationPermissions: () => {
    return apiClient.get(`${APP_ROOT_URL}visualizations/permissions/list/`);
  },
  updateVisualizationPermissions: (data, csrf) => {
    return apiClient.post(
      `${APP_ROOT_URL}visualizations/permissions/update/`,
      data,
      {
        headers: { "x-csrftoken": csrf },
      }
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
  addDashboard: (data, csrf) => {
    return apiClient.post(`${APP_ROOT_URL}dashboards/add/`, data, {
      headers: { "x-csrftoken": csrf },
    });
  },
  copyDashboard: (data, csrf) => {
    return apiClient.post(`${APP_ROOT_URL}dashboards/copy/`, data, {
      headers: { "x-csrftoken": csrf },
    });
  },
  deleteDashboard: (data, csrf) => {
    return apiClient.post(`${APP_ROOT_URL}dashboards/delete/`, data, {
      headers: { "x-csrftoken": csrf },
    });
  },
  updateDashboard: (data, csrf) => {
    return apiClient.post(`${APP_ROOT_URL}dashboards/update/`, data, {
      headers: { "x-csrftoken": csrf },
    });
  },
  updatePermissionGroup: (data, csrf) => {
    return apiClient.post(`${APP_ROOT_URL}permission_groups/update/`, data, {
      headers: { "x-csrftoken": csrf },
    });
  },
  deletePermissionGroup: (data, csrf) => {
    return apiClient.post(`${APP_ROOT_URL}permission_groups/delete/`, data, {
      headers: { "x-csrftoken": csrf },
    });
  },
  uploadJSON: (data, csrf) => {
    return apiClient.post(`${APP_ROOT_URL}json/upload/`, data, {
      headers: { "x-csrftoken": csrf },
    });
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

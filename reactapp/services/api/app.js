import apiClient from "services/api/client";
import { getConfig } from "services/config";

// App root read from runtime config at call time (not frozen at module-eval).
// getConfig() guarantees appRootUrl from DEFAULTS, so no local fallback needed.
const appRoot = () => getConfig().appRootUrl;

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
    return apiClient.get(`${appRoot()}app/permissions/`);
  },
  getActivityData: (activity) => {
    return apiClient.get(`${appRoot()}ping/`, { params: activity });
  },
  getVisualizationData: (itemData) => {
    return apiClient.get(`${appRoot()}visualizations/get/`, {
      params: itemData,
    });
  },
  getVisualizationFeatures: ({ source, args, requestId, cancelToken }) => {
    return apiClient.get(`${appRoot()}visualizations/get/`, {
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
    return apiClient.get(`${appRoot()}visualizations/list/`);
  },
  listVisualizationPermissions: () => {
    return apiClient.get(`${appRoot()}visualizations/permissions/list/`);
  },
  updateVisualizationPermissions: (data, csrf) => {
    return apiClient.post(
      `${appRoot()}visualizations/permissions/update/`,
      data,
      {
        headers: { "x-csrftoken": csrf },
      },
    );
  },
  getDashboard: ({ id }) => {
    return apiClient.get(`${appRoot()}dashboards/get/`, {
      params: { id },
    });
  },
  listDashboards: () => {
    return apiClient.get(`${appRoot()}dashboards/list/`);
  },
  addDashboard: (data, csrf) => {
    return apiClient.post(`${appRoot()}dashboards/add/`, data, {
      headers: { "x-csrftoken": csrf },
    });
  },
  copyDashboard: (data, csrf) => {
    return apiClient.post(`${appRoot()}dashboards/copy/`, data, {
      headers: { "x-csrftoken": csrf },
    });
  },
  deleteDashboard: (data, csrf) => {
    return apiClient.post(`${appRoot()}dashboards/delete/`, data, {
      headers: { "x-csrftoken": csrf },
    });
  },
  updateDashboard: (data, csrf) => {
    return apiClient.post(`${appRoot()}dashboards/update/`, data, {
      headers: { "x-csrftoken": csrf },
    });
  },
  updatePermissionGroup: (data, csrf) => {
    return apiClient.post(`${appRoot()}permission_groups/update/`, data, {
      headers: { "x-csrftoken": csrf },
    });
  },
  deletePermissionGroup: (data, csrf) => {
    return apiClient.post(`${appRoot()}permission_groups/delete/`, data, {
      headers: { "x-csrftoken": csrf },
    });
  },
  uploadJSON: (data, csrf) => {
    return apiClient.post(`${appRoot()}json/upload/`, data, {
      headers: { "x-csrftoken": csrf },
    });
  },
  downloadJSON: async (data) => {
    let jsonData = await apiClient.get(`${appRoot()}json/download/`, {
      params: data,
    });

    if (jsonData.success) {
      jsonData.data = replaceHtmlEntitiesInExpressions(jsonData.data);
    }
    return jsonData;
  },
};

export default appAPI;

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
  getActivityData: (activity) => {
    return apiClient.get(`${APP_ROOT_URL}ping/`, { params: activity });
  },
  getPlotData: (itemData) => {
    return apiClient.get(`${APP_ROOT_URL}data/`, { params: itemData });
  },
  getDashboards: () => {
    return apiClient.get(`${APP_ROOT_URL}dashboards/`);
  },
  getVisualizations: () => {
    return apiClient.get(`${APP_ROOT_URL}visualizations/`);
  },
  getDashboard: ({ id }) => {
    return apiClient.get(`${APP_ROOT_URL}dashboards/get/`, {
      params: { id },
    });
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

import apiClient from "services/api/client";

const APP_ROOT_URL = process.env.TETHYS_APP_ROOT_URL ?? "/apps/tethysdash/";

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
      },
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
  sendChatBotMessage: async ({
    prompt,
    dashboardId,
    chatId,
    history,
    csrf,
  }) => {
    return await apiClient.post(
      `${APP_ROOT_URL}chat/message/`,
      {
        prompt,
        dashboard_id: dashboardId,
        chat_id: chatId,
        history: history ?? [],
      },
      { headers: { "x-csrftoken": csrf } },
    );
  },
  getChatSettings: async () => {
    return await apiClient.get(`${APP_ROOT_URL}chat/settings/`);
  },
  // NOTE: apiKey transits this request only; the backend stores it
  // encrypted and never returns it. Do not cache or log it client-side.
  saveChatSettings: async ({ provider, modelName, apiKey, clearKey, csrf }) => {
    return await apiClient.post(
      `${APP_ROOT_URL}chat/settings/`,
      {
        provider,
        model_name: modelName,
        api_key: apiKey || "",
        clear_key: Boolean(clearKey),
      },
      { headers: { "x-csrftoken": csrf } },
    );
  },
};

export default appAPI;

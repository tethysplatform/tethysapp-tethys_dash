import apiClient from "services/api/client";

const APP_ROOT_URL = process.env.TETHYS_APP_ROOT_URL;

const appAPI = {
  getPlotData: (itemData) => {
    return apiClient.get(`${APP_ROOT_URL}data/`, { params: itemData });
  },
  getDashboards: () => {
    return apiClient.get(`${APP_ROOT_URL}dashboards/`);
  },
  getVisualizations: () => {
    return apiClient.get(`${APP_ROOT_URL}visualizations/`);
  },
  addDashboard: (data, csrf) => {
    return apiClient.post(`${APP_ROOT_URL}dashboards/add/`, data, {
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
  uploadJSON: (data, csrf) => {
    return apiClient.post(`${APP_ROOT_URL}json/upload/`, data, {
      headers: { "x-csrftoken": csrf },
    });
  },
  downloadJSON: (data) => {
    return apiClient.get(`${APP_ROOT_URL}json/download/`, {
      params: data,
    });
  },
};

export default appAPI;

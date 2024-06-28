import apiClient from "services/api/client";

const APP_ROOT_URL = process.env.TETHYS_APP_ROOT_URL;

const appAPI = {
  getPlotData: (itemData) => {
    return apiClient.get(`${APP_ROOT_URL}data/`, { params: itemData });
  },
  getDashboards: () => {
    return apiClient.get(`${APP_ROOT_URL}dashboards/`);
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
};

export default appAPI;

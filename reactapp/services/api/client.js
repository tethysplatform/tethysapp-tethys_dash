import axios from "axios";

import { getTethysPortalBase } from "services/utilities";

const TETHYS_PORTAL_BASE = getTethysPortalBase();

const apiClient = axios.create({
  baseURL: `${TETHYS_PORTAL_BASE}`,
  withCredentials: true,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

function handleSuccess(response) {
  return response.data ? response.data : response;
}

function handleError(error) {
  return Promise.reject(error);
}

apiClient.interceptors.response.use(handleSuccess, handleError);

export default apiClient;

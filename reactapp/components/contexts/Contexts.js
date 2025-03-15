import { createContext } from "react";

export const AppContext = createContext();
export const VariableInputsContext = createContext();
export const LayoutContext = createContext({
  updateGridItems: () => {},
  getDashboardMetadata: () => {},
  resetGridItems: () => {},
  saveLayoutContext: () => {},
});
export const AvailableDashboardsContext = createContext({
  availableDashboards: {},
  setAvailableDashboards: () => {},
  addDashboard: () => {},
  deleteDashboard: () => {},
  copyDashboard: () => {},
  updateDashboard: () => {},
});
export const EditingContext = createContext({
  isEditing: false,
  setIsEditing: () => {},
});
export const DisabledEditingMovementContext = createContext();
export const DataViewerModeContext = createContext();
export const MapContext = createContext();
export const AppTourContext = createContext();

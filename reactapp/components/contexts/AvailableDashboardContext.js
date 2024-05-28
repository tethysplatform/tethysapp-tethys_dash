import { useContext, createContext, useState } from "react";

const AvailableDashboardContext = createContext();

const AvailableDashboardContextProvider = ({ children }) => {
  const [dashboardLayoutConfigs, setDashboardLayoutConfigs] = useState(null)

  return (
    <AvailableDashboardContext.Provider value={[dashboardLayoutConfigs, setDashboardLayoutConfigs]}>
      {children}
    </AvailableDashboardContext.Provider>
  );

};

export default AvailableDashboardContextProvider;

export const useAvailableDashboardContext = () => {
  return useContext(AvailableDashboardContext);
};
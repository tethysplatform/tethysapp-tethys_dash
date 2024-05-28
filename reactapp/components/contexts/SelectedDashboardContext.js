import { useContext, createContext, useState } from "react";

const SelectedDashboardContext = createContext();

const SelectedDashboardContextProvider = ({ children }) => {
  const [dashboardContext, setDashboardContext] = useState(null);

  return (
    <SelectedDashboardContext.Provider value={[dashboardContext, setDashboardContext]}>
      {children}
    </SelectedDashboardContext.Provider>
  );

};

export default SelectedDashboardContextProvider;

export const useSelectedDashboardContext = () => {
  return useContext(SelectedDashboardContext);
};
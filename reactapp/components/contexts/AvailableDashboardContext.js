import PropTypes from "prop-types";
import { useContext, createContext, useState, useEffect } from "react";
import appAPI from "services/api/app";
import { useRoutesContext } from "components/contexts/RoutesContext";
import { Route } from "react-router-dom";
import DashboardView from "views/dashboard/Dashboard";

const AvailableDashboardContext = createContext();

const AvailableDashboardContextProvider = ({ children }) => {
  const [dashboardLayoutConfigs, setDashboardLayoutConfigs] = useState(null);
  const [routes, setRoutes] = useRoutesContext();

  useEffect(() => {
    appAPI.getDashboards().then((data) => {
      const updatedRoutes = [...routes];
      for (const [name, details] of Object.entries(data)) {
        updatedRoutes.push(
          <Route
            path={"/dashboard/" + name}
            element={<DashboardView initialDashboard={name} />}
            // loader={}
            key={"route-" + name}
          />
        );
      }
      setDashboardLayoutConfigs(data);
      setRoutes(updatedRoutes);
    });
    // eslint-disable-next-line
  }, []);

  return (
    <AvailableDashboardContext.Provider
      value={[dashboardLayoutConfigs, setDashboardLayoutConfigs]}
    >
      {children}
    </AvailableDashboardContext.Provider>
  );
};

AvailableDashboardContextProvider.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
  ]),
};

export default AvailableDashboardContextProvider;

export const useAvailableDashboardContext = () => {
  return useContext(AvailableDashboardContext);
};

import PropTypes from "prop-types";
import { useContext, createContext, useState, useEffect } from "react";
import appAPI from "services/api/app";
import { useRoutesContext } from "components/contexts/RoutesContext";
import { Route } from "react-router-dom";
import DashboardView from "views/dashboard/Dashboard";
import NotFound from "components/error/NotFound";

const AvailableDashboardContext = createContext();

const AvailableDashboardContextProvider = ({ children }) => {
  const [dashboardLayoutConfigs, setDashboardLayoutConfigs] = useState(null);
  const [routes, setRoutes] = useRoutesContext();

  useEffect(() => {
    appAPI.getDashboards().then((data) => {
      const updatedRoutes = [...routes];
      for (const name of Object.keys(data)) {
        updatedRoutes.push(
          <Route
            path={"/dashboard/" + name}
            element={<DashboardView initialDashboard={name} />}
            key={"route-" + name}
          />
        );
      }
      updatedRoutes.push(
        <Route
          key={"route-not-found"}
          path="/dashboard/*"
          element={<NotFound />}
        />
      );
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

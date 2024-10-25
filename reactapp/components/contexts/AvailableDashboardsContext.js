import PropTypes from "prop-types";
import { useContext, createContext, useState, useEffect } from "react";
import appAPI from "services/api/app";
import { useRoutesContext } from "components/contexts/RoutesContext";
import { Route } from "react-router-dom";
import DashboardView from "views/dashboard/Dashboard";
import NotFound from "components/error/NotFound";

const AvailableDashboardsContext = createContext();

const AvailableDashboardsContextProvider = ({ children }) => {
  const [availableDashboards, setAvailableDashboards] = useState(null);
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
      setAvailableDashboards(data);
      setRoutes(updatedRoutes);
    });
    // eslint-disable-next-line
  }, []);

  return (
    <AvailableDashboardsContext.Provider
      value={[availableDashboards, setAvailableDashboards]}
    >
      {children}
    </AvailableDashboardsContext.Provider>
  );
};

AvailableDashboardsContextProvider.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
  ]),
};

export default AvailableDashboardsContextProvider;

export const useAvailableDashboardsContext = () => {
  return useContext(AvailableDashboardsContext);
};

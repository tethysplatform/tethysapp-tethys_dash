import PropTypes from "prop-types";
import { useContext, createContext, useState } from "react";
import { Route } from "react-router-dom";
import DashboardView from "views/dashboard/Dashboard";

const RoutesContext = createContext();

const RoutesContextProvider = ({ children }) => {
  const PATH_HOME = "/",
    PATH_DASHBOARD = "/dashboard";

  const [routes, setRoutes] = useState([
    <Route path={PATH_HOME} element={<DashboardView />} key="route-home" />,
    <Route
      path={PATH_DASHBOARD}
      element={<DashboardView />}
      key="route-dashboard"
    />,
  ]);

  return (
    <RoutesContext.Provider value={{ routes, setRoutes }}>
      {children}
    </RoutesContext.Provider>
  );
};

RoutesContextProvider.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
  ]),
};

export default RoutesContextProvider;

export const useRoutesContext = () => {
  return useContext(RoutesContext);
};

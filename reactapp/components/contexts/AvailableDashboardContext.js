import PropTypes from 'prop-types'
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

AvailableDashboardContextProvider.propTypes = {
  children: PropTypes.oneOfType([
      PropTypes.arrayOf(PropTypes.node),
      PropTypes.node
  ]),
}

export default AvailableDashboardContextProvider;

export const useAvailableDashboardContext = () => {
  return useContext(AvailableDashboardContext);
};
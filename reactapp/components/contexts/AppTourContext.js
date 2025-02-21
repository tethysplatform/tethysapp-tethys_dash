import PropTypes from "prop-types";
import { useContext, createContext, useState } from "react";

const AppTourContext = createContext();

const AppTourContextProvider = ({ children }) => {
  const [activeAppTour, setActiveAppTour] = useState(false);
  const [appTourStep, setAppTourStep] = useState(0);

  return (
    <AppTourContext.Provider
      value={{
        appTourStep,
        setAppTourStep,
        activeAppTour,
        setActiveAppTour,
      }}
    >
      {children}
    </AppTourContext.Provider>
  );
};

AppTourContextProvider.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
    PropTypes.object,
  ]),
};

export default AppTourContextProvider;

export const useAppTourContext = () => {
  return useContext(AppTourContext);
};

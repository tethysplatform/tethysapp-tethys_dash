import PropTypes from "prop-types";
import { useContext, useState } from "react";
import { AppTourContext } from "components/contexts/Contexts";

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
  children: PropTypes.arrayOf(PropTypes.object),
};

export default AppTourContextProvider;

export const useAppTourContext = () => {
  return useContext(AppTourContext);
};

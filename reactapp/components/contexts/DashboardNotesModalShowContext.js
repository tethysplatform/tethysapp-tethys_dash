import PropTypes from "prop-types";
import { useContext, createContext, useState } from "react";

const DashboardNotesModalShowContext = createContext();

const DashboardNotesModalShowContextProvider = ({ children }) => {
  const [showModal, setShowModal] = useState(false);

  return (
    <DashboardNotesModalShowContext.Provider value={[showModal, setShowModal]}>
      {children}
    </DashboardNotesModalShowContext.Provider>
  );
};

DashboardNotesModalShowContextProvider.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
  ]),
};

export default DashboardNotesModalShowContextProvider;

export const useDashboardNotesModalShowContext = () => {
  return useContext(DashboardNotesModalShowContext);
};

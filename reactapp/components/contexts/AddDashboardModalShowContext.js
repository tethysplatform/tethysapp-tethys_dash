import PropTypes from "prop-types";
import { useContext, createContext, useState } from "react";

const AddDashboardModalShowContext = createContext();

const AddDashboardModalShowContextProvider = ({ children }) => {
  const [showModal, setShowModal] = useState(false);

  return (
    <AddDashboardModalShowContext.Provider value={[showModal, setShowModal]}>
      {children}
    </AddDashboardModalShowContext.Provider>
  );
};

AddDashboardModalShowContextProvider.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
  ]),
};

export default AddDashboardModalShowContextProvider;

export const useAddDashboardModalShowContext = () => {
  return useContext(AddDashboardModalShowContext);
};

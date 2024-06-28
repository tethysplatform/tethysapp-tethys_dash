import PropTypes from "prop-types";
import { useContext, createContext, useState } from "react";

const AvailableOptionsContext = createContext();

const AvailableOptionsContextProvider = ({ children }) => {
  const [selectOptions, setSelectOptions] = useState(null);

  return (
    <AvailableOptionsContext.Provider value={[selectOptions, setSelectOptions]}>
      {children}
    </AvailableOptionsContext.Provider>
  );
};

AvailableOptionsContextProvider.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
  ]),
};

export default AvailableOptionsContextProvider;

export const useAvailableOptionsContext = () => {
  return useContext(AvailableOptionsContext);
};

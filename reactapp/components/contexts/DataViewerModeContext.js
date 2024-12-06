import PropTypes from "prop-types";
import { useContext, createContext, useState } from "react";

export const DataViewerModeContext = createContext();

const DataViewerModeContextProvider = ({ children }) => {
  const [inDataViewerMode, setInDataViewerMode] = useState(false);

  return (
    <DataViewerModeContext.Provider
      value={{ inDataViewerMode, setInDataViewerMode }}
    >
      {children}
    </DataViewerModeContext.Provider>
  );
};

DataViewerModeContextProvider.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
  ]),
};

export default DataViewerModeContextProvider;

export const useDataViewerModeContext = () => {
  return useContext(DataViewerModeContext);
};

import PropTypes from "prop-types";
import { useContext, createContext, useState } from "react";

export const DataViewerModeContext = createContext();

const DataViewerModeContextProvider = ({ children }) => {
  const [inDataViewerMode, setInDataViewerMode] = useState(false);

  return (
    <InDataViewerModeContext.Provider value={{inDataViewerMode}}>
      <SetDataViewerModeContext.Provider value={{setInDataViewerMode}}>
        {children}
      </SetDataViewerModeContext.Provider>
    </InDataViewerModeContext.Provider>
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

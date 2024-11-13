import PropTypes from "prop-types";
import { useContext, createContext, useState } from "react";

const InDataViewerModeContext = createContext();
const SetDataViewerModeContext = createContext();

const DataViewerModeContextProvider = ({ children }) => {
  const [inDataViewerMode, setInDataViewerMode] = useState(false);

  return (
    <InDataViewerModeContext.Provider value={inDataViewerMode}>
      <SetDataViewerModeContext.Provider value={setInDataViewerMode}>
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

export const useInDataViewerModeContext = () => {
  return useContext(InDataViewerModeContext);
};

export const useSetDataViewerModeContext = () => {
  return useContext(SetDataViewerModeContext);
};

import PropTypes from "prop-types";
import { useContext, createContext, useRef } from "react";

const VisualizationRefContext = createContext();
const VisualizationRefMetadataContext = createContext();

const VisualizationRefContextProvider = ({ children }) => {
  const visualizationRef = useRef({});
  const visualizationRefMetadata = useRef({});

  return (
    <VisualizationRefContext.Provider value={visualizationRef}>
      <VisualizationRefMetadataContext.Provider
        value={visualizationRefMetadata}
      >
        {children}
      </VisualizationRefMetadataContext.Provider>
    </VisualizationRefContext.Provider>
  );
};

VisualizationRefContextProvider.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
  ]),
};

export default VisualizationRefContextProvider;

export const useVisualizationRefContext = () => {
  return useContext(VisualizationRefContext);
};
export const useVisualizationRefMetadataContext = () => {
  return useContext(VisualizationRefMetadataContext);
};

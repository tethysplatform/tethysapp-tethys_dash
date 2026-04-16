import PropTypes from "prop-types";
import { useContext, useState } from "react";
import { MapContext } from "components/contexts/Contexts";

const MapContextProvider = ({ children }) => {
  const [mapReady, setMapReady] = useState(false);
  const [extentDrawMode, setExtentDrawMode] = useState(null);
  const [drawnExtent, setDrawnExtent] = useState(null);

  return (
    <MapContext.Provider
      value={{
        mapReady,
        setMapReady,
        extentDrawMode,
        setExtentDrawMode,
        drawnExtent,
        setDrawnExtent,
      }}
    >
      {children}
    </MapContext.Provider>
  );
};

MapContextProvider.propTypes = {
  children: PropTypes.node,
};

export default MapContextProvider;

export const useMapContext = () => {
  const context = useContext(MapContext);
  if (!context) {
    return null; // instead of throwing
  }
  return context;
};

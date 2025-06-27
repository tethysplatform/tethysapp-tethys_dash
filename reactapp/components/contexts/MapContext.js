import PropTypes from "prop-types";
import { useContext, useState } from "react";
import { MapContext } from "components/contexts/Contexts";

const MapContextProvider = ({ children }) => {
  const [mapReady, setMapReady] = useState(false);

  return (
    <MapContext.Provider
      value={{
        mapReady,
        setMapReady,
      }}
    >
      {children}
    </MapContext.Provider>
  );
};

MapContextProvider.propTypes = {
  children: PropTypes.oneOf(
    PropTypes.arrayOf(PropTypes.object),
    PropTypes.object
  ),
};

export default MapContextProvider;

export const useMapContext = () => {
  const context = useContext(MapContext);
  if (!context) {
    return null; // instead of throwing
  }
  return context;
};

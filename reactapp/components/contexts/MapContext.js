import PropTypes from "prop-types";
import { useContext, useState } from "react";
import { MapContext } from "components/contexts/Contexts";

const MapContextProvider = ({ children }) => {
  const [mapReady, setMapReady] = useState(false);
  const [extentDrawMode, setExtentDrawMode] = useState(null);
  const [drawnExtent, setDrawnExtent] = useState(null);
  // An on-map annotation editing session: `{layerName, defaults, items}` while
  // the author is drawing, null otherwise. Only the DataViewer mounts this
  // provider, so a map on the dashboard itself can never start one.
  const [annotationEditSession, setAnnotationEditSession] = useState(null);
  // The items a session ended with on Done, for the layer editor to pick up.
  const [editedAnnotations, setEditedAnnotations] = useState(null);

  return (
    <MapContext.Provider
      value={{
        mapReady,
        setMapReady,
        extentDrawMode,
        setExtentDrawMode,
        drawnExtent,
        setDrawnExtent,
        annotationEditSession,
        setAnnotationEditSession,
        editedAnnotations,
        setEditedAnnotations,
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

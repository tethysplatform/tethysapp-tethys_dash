import { useCallback } from 'react';


const useMap = (map) => {
  
  const addEvent = useCallback((event, callback) => {
    if (map) {
      map.on(event, callback);
    }
  }, [map]);

  const setView = useCallback((extent) => {
    if (map) {
      map.getView().fit(extent, {
        duration: 1300, 
        padding: [50, 50, 50, 50]
    })
    }
  }, [map]);

  const addLayer = useCallback((layer) => {
    if (map) {
      map.addLayer(layer);    
    }
  }, [map]);

  const removeLayer = useCallback((layer) => {
    if (map) {
      map.removeLayer(layer);
    }
  }, [map]);

  return { 
    addLayer, 
    removeLayer, 
    setView,
    addEvent 
  };
};

export { useMap };
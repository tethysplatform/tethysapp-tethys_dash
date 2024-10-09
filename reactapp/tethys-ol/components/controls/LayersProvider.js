import React, { useState } from 'react';
import LayersControlContext from './LayersControlContext';

const LayersControlProvider = ({ children }) => {
    const [layersVisibility, setLayersVisibility] = useState({});

    const setLayerVisibility = (layerId, visibility) => {
        setLayersVisibility((prev) => ({
            ...prev,
            [layerId]: visibility,
        }));
    };

    return (
        <LayersControlContext.Provider value={{ layersVisibility, setLayerVisibility }}>
            {children}
        </LayersControlContext.Provider>
    );
};

export { LayersControlProvider };

// Get All Layer Names
const getAllLayerNames = (map) => {
    return map.getLayers().getArray()
      .filter(layer => layer.get('name')) // Ensure the layer has a 'name' property
      .map(layer => layer.get('name')); // Extract the 'name' property
}

//Get Layer by Name
const getLayerbyName = (map, layerName) => {
    const allLayers = map.getLayers().getArray();
    const onlyFirstLayer = allLayers.find(layer => layer.get('name') === layerName);
    return onlyFirstLayer
}

//Zoom to Layer
const zoomToLayer= (map,layer) => {
    const source = layer.getSource();
    const layerExtent = source.getExtent();    
    map.getView().fit(layerExtent, {
        padding: [100,100,100,100],
        duration: 3000, // Optional animation duration in milliseconds.
    });
}   

//Zoom to Layer by Name
const zoomToLayerbyName = (map, layerName) => {
    const source = getLayerbyName(map, layerName).getSource();
    const layerExtent = source.getExtent();    
    map.getView().fit(layerExtent, {
        padding: [100,100,100,100],
        duration: 3000, // Optional animation duration in milliseconds.
    });
}   





export {
    getAllLayerNames,
    zoomToLayer,
    zoomToLayerbyName,
    getLayerbyName,
}

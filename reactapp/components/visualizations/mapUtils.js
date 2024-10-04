import {Stroke, Style} from 'ol/style.js';
import GeoJSON from 'ol/format/GeoJSON';
import ImageLayer from 'ol/layer/Image.js';
import { containsCoordinate } from 'ol/extent';  // Import extent utility

// Map Utils
class MapUtils {

    // Get all layers at the clicked pixel, excluding base map layers
    getImageLayers(event) {
      let layers = [];

      event.map.getLayers().forEach(layer => {
        if (layer instanceof ImageLayer) {

              layers.push(layer);
      }
      });
  
      return layers;
    }

    //get the name of the MapServer service layer
    getMapServerLayerName(layer) {
      const urlService = layer.getSource().getUrl(); // Collect MapServer URL
      const parts = urlService.split('/MapServer')[0].split('/'); // Split at /MapServer and then split the remaining part by /
      return parts[parts.length - 1]; // Return the last segment
    }


    // get the value of a key that starts with a prefix
    getValueStartingWith(obj, prefix) {
      for (const key in obj) {
        if (key.startsWith(prefix)) {
          return obj[key];
        }
      }
      return null; 
    }

    createHUCVectorLayer (name,url){

      const layer = {
        type: "VectorLayer",
        props: {
          source:{
            type: "Vector",
            props:{
              url: url,
              format: new GeoJSON()
            }
          },
          style:
          new Style({
            stroke: new Stroke({
              color: 'green',
              width: 3,
            })
          }),
          name: name,
        }
      }
      return layer
    }

    createClickedReachLayer (name, features) {
        const layerReach = {
            layerType: 'VectorLayer',
            options: {
              sourceType: 'VectorSourceLayer',
              // all the params for the source goes here
              params: {
                format: new GeoJSON(),
                features: new GeoJSON(
                    {
                      dataProjection: 'EPSG:4326',
                      featureProjection: 'EPSG:3857'
                    }
                  ).readFeatures(features)
              },
              // the rest of the attributes are for the definition of the layer
              zIndex: 3,
              name: name,
              style:
                new Style({
                  stroke: new Stroke({
                    color: '#f5e154',
                    width: 3,
                  })
                })
              
            },
        
          }
          return layerReach
    }

}



export default MapUtils
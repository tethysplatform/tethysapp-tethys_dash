import axios from 'axios';
import MapUtils from './mapUtils';
import EsriUtils from './esriUtils';
import Point from "@arcgis/core/geometry/Point.js";

 
class MapEvents {
    constructor() {
        this.esriUtils = new EsriUtils();
        this.mapUtils = new MapUtils();
    }

    async _onClickHucRegion(event, layer) {
        let mapServerInfo = [];
        let clickCoordinate = event.coordinate;
        let mapObject = event.map;
        const urlService = layer.getSource().getUrl(); // collect mapServer URL
        const server = mapServerInfo.find((server) => server.url === urlService); // see if server already exists in mapServerInfo
      
        if (!server) {
          const spatialReference = { latestWkid: 3857, wkid: 102100 };
          const geometry = {
            spatialReference: spatialReference,
            x: clickCoordinate[0],
            y: clickCoordinate[1],
          };
      
          const queryIdentify = {
            f: 'json',
            geometryType: 'esriGeometryPoint',
            layers: 'visible',
            tolerance: 1,
            geometry: clickCoordinate,
            mapExtent: mapObject.getView().calculateExtent(), // get map extent
            imageDisplay: `${mapObject.getSize()},96`, // get map size/resolution
            sr: mapObject
              .getView()
              .getProjection()
              .getCode()
              .split(/:(?=\d+$)/)
              .pop(), // this is because our OL map is in this SR
          };
      
          const url = new URL(`${urlService}/identify`);
          url.search = new URLSearchParams(queryIdentify);
      
          try {
            // First axios request
            const response = await axios.get(url.href);
            // Process the response
            let results = response.data['results'];
            if (results.length === 0) {
              console.error('No results found in identify response.');
              return null;
            }
      
            let layerId = results[results.length - 1]['layerId'];
      
            const queryLayer = {
              geometry: JSON.stringify(geometry),
              outFields: '*',
              geometryType: 'esriGeometryPoint',
              spatialRel: 'esriSpatialRelIntersects',
              units: 'esriSRUnit_Meter',
              distance: 100,
              sr: mapObject
                .getView()
                .getProjection()
                .getCode()
                .split(/:(?=\d+$)/)
                .pop(),
              returnGeometry: true, // I don't want geometry, but you might want to display it on a 'selection layer'
              f: 'geojson',
              inSR: 102100,
              outSR: 102100,
            };
      
            const urlQuery = new URL(`${urlService}/${layerId}/query`);
            urlQuery.search = new URLSearchParams(queryLayer);
      
            // Second axios request
            const responseQuery = await axios.get(urlQuery.href);
            console.log(responseQuery.data);
      
            if (responseQuery.data['features'].length === 0) {
              console.error('No features found in query response.');
              return null;
            }
      
            const layer_name = `${responseQuery.data['features'][0]['id']}_huc_vector_selection`;
            const vector_layer = this.mapUtils.createHUCVectorLayer(layer_name, urlQuery.href);
            const hucid = this.mapUtils.getValueStartingWith(responseQuery.data['features'][0]['properties'], 'huc');
            const rsp = {
                layer: vector_layer,
                hucid: hucid

            }
            // Now, we can return vector_layer from the outer function
            return rsp;
          } catch (error) {
            console.error('Error in _onClickHucRegion:', error);
            throw error; // Optionally rethrow the error to be handled upstream
          }
        } else {
          // Handle the case where server exists if needed
          return null; // Or some appropriate value
        }
    }

    async _onClickServiceLayerHandler(event, layer) {
      let mapServerInfo = [];
      let mapObject = event.map;
      let clickCoordinate = event.coordinate;
  
      const urlService = layer.getSource().getUrl(); // Collect mapServer URL
      const id = layer
          .getSource()
          .getParams()
          .LAYERS.replace('show:', ''); // Remove 'show:' to get the raw layer ID
  
      const server = mapServerInfo.find(server => server.url === urlService); // Check if server already exists in mapServerInfo
  
      if (!server) {
          const spatialReference = { latestWkid: 3857, wkid: 102100 };
          const geometry = {
              spatialReference: spatialReference,
              x: clickCoordinate[0],
              y: clickCoordinate[1],
          };
  
          const queryLayer = {
              geometry: JSON.stringify(geometry),
              outFields: '*',
              geometryType: 'esriGeometryPoint',
              spatialRel: 'esriSpatialRelIntersects',
              units: 'esriSRUnit_Meter',
              distance: this.esriUtils.getDistanceByZoom(mapObject.getView().getZoom()),
              sr: mapObject.getView().getProjection().getCode().split(/:(?=\d+$)/).pop(),
              returnGeometry: true,
              f: 'json',
              inSR: 102100,
              outSR: 4326,
          };
  
          const url = new URL(`${urlService}/${id}/query`);
          url.search = new URLSearchParams(queryLayer);
  
          try {
              // First axios request
              const response = await axios.get(url.href);
              console.log(response.data);
  
              if (response.data.features.length < 1) {
                  console.error('No features found in query response.');
                  return null;
              }
  
              const actual_zoom = mapObject.getView().getZoom();
              const esriMapPoint = new Point({
                  longitude: clickCoordinate[0],
                  latitude: clickCoordinate[1],
                  spatialReference: spatialReference,
              });
  
              const serviceFeature = this.esriUtils.processServiceQueryResult(
                  actual_zoom,
                  esriMapPoint,
                  response.data,
                  mapObject
              );
    
              let id_ = serviceFeature.properties['id'];
              let noaaApiUrl = 'https://api.water.noaa.gov/nwps/v1';
              let rsp = null;
  
              // Create a vector layer from the service feature
              // const layer_name = `${id_}_vector_selection`;
              // const vector_layer = this.mapUtils.createVectorLayerFromFeature(layer_name, serviceFeature);
  
              if (serviceFeature.geometry.type === 'LineString') {
                  noaaApiUrl += `/reaches/${id_}`;
  
                  try {
                      const rspApi = await axios.get(noaaApiUrl);
                      console.log(rspApi.data);
  
                      rsp = {
                          // layer: vector_layer,
                          id: id_,
                      };
                  } catch (error) {
                      console.error('Error fetching reach data:', error);
                      return null;
                  }
              } else {
                  noaaApiUrl += `/gauges/${id_}`;
  
                  try {
                      const rspApi = await axios.get(noaaApiUrl);
                      console.log(rspApi.data);
  
                      rsp = {
                          // layer: vector_layer,
                          gaugeId: id_,
                      };
                  } catch (error) {
                      console.error('Error fetching gauge data:', error);
                      return null;
                  }
              }
  
              // Return the response object similar to _onClickHucRegion
              return rsp;
          } catch (error) {
              console.error('Error in _onClickServiceLayerHandler:', error);
              throw error; // Optionally rethrow the error to be handled upstream
          }
      } else {
          // Handle the case where server exists if needed
          return null; // Or some appropriate value
      }
  }


    async _getInfoFromImageLayers (
        event, 
        layers
    ) {
        for (const layer of layers) {
          const mapServerLayerName = this.mapUtils.getMapServerLayerName(layer);;
          console.log(mapServerLayerName)

          if (mapServerLayerName === 'wbd') {
            if (!layer.getVisible()) continue;
            let rsp = await this._onClickHucRegion(
                event, 
                layer
             );
            return rsp
          }

          else{
            let rsp = await this._onClickServiceLayerHandler(
                event, 
                layer
              );

            if (rsp) {
                return rsp;
            }
          }
                  
        }
        return null;
    };

    async onClickMapEvent (
        event,
    ) {

        event.preventDefault();
        console.log('click event', event);
        let layers = this.mapUtils.getImageLayers(event);
        console.log(layers);
        let response = await this._getInfoFromImageLayers(
            event, 
            layers, 
        )
        return response
      }

}

export default MapEvents;






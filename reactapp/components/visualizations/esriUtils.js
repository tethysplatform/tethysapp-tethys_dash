
import * as geometryEngine from "@arcgis/core/geometry/geometryEngine.js";

// Map Esri Utils
class EsriUtils {
    _isBlank(str) {
        return (!str || /^\s*$/.test(str) || str === null);
    }

    // Get distance by zoom
    getDistanceByZoom(zoom) {
        switch (true) {
            case (zoom > 20):
                return 25;
            case (zoom > 17):
                return 125;
            case (zoom > 14):
                return 250;
            case (zoom > 11):
                return 500;
            case (zoom > 8):
                return 1000;
            case (zoom > 5):
                return 2000;
        }
        return 10000;
    }

    _getCurrentReachOnClick(esriPaths) {
        // Transform ESRI paths into coordinates array for LineString
        const coordinates = esriPaths.map(path => path.map(point => [point[0], point[1]]))[0];
        const geojsonObject = {
            'type': 'LineString',
            'coordinates': coordinates
        };
        return geojsonObject;
    }

    // Get corresponding stream service query result
    processStreamServiceQueryResult(zoom, point, response, mapObject) {
        let minStreamOrder = 5;
        let soAttrName = null;
        let fidAttrName = null;
        let nameAttrName = null;

        if (response.features.length === 0) {
            return;
        }

        if (zoom >= 5) minStreamOrder--;
        if (zoom >= 6) minStreamOrder--;
        if (zoom >= 8) minStreamOrder--;
        if (zoom >= 10) minStreamOrder--;

        response.fields.forEach(field => {
            if (!fidAttrName && /^(reach_id|station_id|feature_id)$/i.test(field.alias)) {
                fidAttrName = field.name;
            }

            if (!soAttrName && /^(stream_?order)$/i.test(field.alias)) {
                soAttrName = field.name;
            }

            if (!nameAttrName && /^((reach|gnis)?_?name)$/i.test(field.alias)) {
                nameAttrName = field.name;
            }
        });

        const validFeatures = response.features.filter(feature => feature.attributes[soAttrName] >= minStreamOrder);

        validFeatures.forEach(feature => {
            feature.distance = geometryEngine.distance(point, feature.geometry);
        });

        validFeatures.sort((a, b) => a.distance - b.distance);

        if (validFeatures.length === 0) {
            return;
        }

        const closestFeature = validFeatures[0];
        const stationName = this._isBlank(closestFeature.attributes[nameAttrName]) ? 'N/A' : closestFeature.attributes[nameAttrName];
        const stationID = closestFeature.attributes[fidAttrName];
        const currentGeosjonReach = this._getCurrentReachOnClick(closestFeature.geometry.paths, mapObject);

        const currentStreamFeature = {
            'type': 'Feature',
            'geometry': currentGeosjonReach,
            'properties': {
                'name': stationName,
                'id': stationID,
                'distance': closestFeature.distance
            }
        };
        return currentStreamFeature;
    }
}

export default EsriUtils;
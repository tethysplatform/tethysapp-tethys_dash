import {
  memo,
  useRef,
  useCallback,
  useEffect,
  useState,
  useContext,
} from "react";
import { Map } from "components/backlayer";
import { queryLayerFeatures } from "components/backlayer/layer/Layer";
import PropTypes from "prop-types";
import { getBaseMapLayer } from "components/visualizations/utilities";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { LineString } from "ol/geom";
import { Stroke, Style } from "ol/style";
import Icon from "ol/style/Icon";
import {
  EditingContext,
  VariableInputsContext,
} from "components/contexts/Contexts";
import { getMapAttributeVariables } from "components/visualizations/utilities";
import { valuesEqual } from "components/modals/utilities";

function createMarkerLayer(coordinate) {
  const markPath = `
      M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9
      c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z
    `;
  const svgIcon = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="40" height="40">
        <path d="${markPath}" fill="#007bff" stroke="white" stroke-width="1"/>
      </svg>
    `;
  const svgURI = "data:image/svg+xml;base64," + btoa(svgIcon);
  const marker = new Feature({
    type: "marker",
    geometry: new Point(coordinate),
  });
  marker.setStyle(
    new Style({
      image: new Icon({
        src: svgURI,
        anchor: [0.5, 1], // Align the bottom-center of the icon to the point
      }),
    })
  );
  const markerLayer = new VectorLayer({
    source: new VectorSource({
      features: [marker],
    }),
    name: "Marker",
  });

  return markerLayer;
}

function createHighlightLayer(geometries) {
  let features;
  if ("paths" in geometries) {
    features = geometries.paths.map((path) => {
      return new Feature({
        geometry: new LineString(path),
        name: "Polyline",
      });
    });
  } else {
    features = [
      new Feature({
        type: "marker",
        geometry: new Point((geometries.x, geometries.y)),
      }),
    ];
  }
  const highlightLayer = new VectorLayer({
    source: new VectorSource({
      features: features,
    }),
    style: new Style({
      stroke: new Stroke({
        color: "#00008b",
        width: 3,
      }),
    }),
    name: "Highlighter",
  });

  return highlightLayer;
}

const MapVisualization = ({
  mapConfig,
  viewConfig,
  layers,
  visualizationRef,
  baseMap,
  layerControl,
}) => {
  const [mapLegend, setMapLegend] = useState();
  const [mapLayers, setMapLayers] = useState();
  const markerLayer = useRef();
  const highlightLayer = useRef();
  const currentLayers = useRef([]);
  const { setVariableInputValues } = useContext(VariableInputsContext);

  useEffect(() => {
    if (!valuesEqual(layers, currentLayers.current)) {
      currentLayers.current = JSON.parse(JSON.stringify(layers));

      const newMapLegend = [];
      const newMapLayers = [];
      for (const layer of layers) {
        if (Object.keys(layer.legend).length > 0) {
          newMapLegend.push(layer.legend);
        }
        newMapLayers.push(layer.configuration);
      }

      if (baseMap) {
        const baseMapLayer = getBaseMapLayer(baseMap);
        newMapLayers.splice(0, 0, baseMapLayer);
      }

      newMapLayers.forEach((layer, index) => {
        layer.props.zIndex = index;
      });
      setMapLegend(newMapLegend);
      setMapLayers(newMapLayers);
    }
  }, [layers]);

  const onMapClick = (map, evt) => {
    // describe feature type (WFS)
    // get capabilities (WMS)
    // Arcgis rest
    // vector tile
    // custom basemap

    // get coordinates and add pointer marker where the click occurred
    const coordinate = evt.coordinate;
    const newMarkerLayer = createMarkerLayer(coordinate);
    if (markerLayer.current) {
      map.removeLayer(markerLayer.current);
    }
    markerLayer.current = newMarkerLayer;
    map.addLayer(newMarkerLayer);

    // reduce the layer attributes variables values into a simplified object of layer names and then values
    const mapAttributeVariables = layers.reduce((combined, current) => {
      if (
        current.attributeVariables &&
        typeof current.attributeVariables === "object"
      ) {
        // Merge the example object into the combined object
        Object.assign(combined, current.attributeVariables);
      }
      return combined;
    }, {});

    // query the layer features
    // NEED TO MAKE THIS WORK WITH MULTIPLE LAYERS IN PARALLEL
    queryLayerFeatures(layers[0], map, coordinate).then((layerFeatures) => {
      if (highlightLayer.current) {
        map.removeLayer(highlightLayer.current);
      }

      // if valid features were selected then continue
      if (layerFeatures && layerFeatures.length > 0) {
        const newHighlightLayer = createHighlightLayer(
          layerFeatures[0].geometry
        );
        highlightLayer.current = newHighlightLayer;
        map.addLayer(newHighlightLayer);

        // loop through the attribute variables in the map and compare them to the returned features to update any potential variable inputs
        let updatedVariableInputs = {};
        for (const layerName in mapAttributeVariables) {
          // only look at selected features within the same layer
          const validLayers = layerFeatures.filter(
            (layerFeature) => layerFeature.layerName === layerName
          );
          for (const validLayer of validLayers) {
            const mappedLayerVariableInputs = {};
            // check each layer attribute variable to see if the features have valid values
            for (const layerAlias in mapAttributeVariables[layerName]) {
              const variableInputName =
                mapAttributeVariables[layerName][layerAlias];
              const featureValue = validLayer.attributes[layerAlias];
              // if the selected feature value is not undefined or "Null" then add it
              if (featureValue && featureValue !== "Null") {
                mappedLayerVariableInputs[variableInputName] = featureValue;
              }
            }
            // Once a selected feature has a valid value for variable input, go to the next variable input
            if (Object.keys(mappedLayerVariableInputs).length > 0) {
              updatedVariableInputs = {
                ...updatedVariableInputs,
                ...mappedLayerVariableInputs,
              };
              continue;
            }
          }
        }
        if (Object.keys(updatedVariableInputs).length > 0) {
          setVariableInputValues((previousVariableInputValues) => ({
            ...previousVariableInputValues,
            ...updatedVariableInputs,
          }));
        } else {
          console.log("No features with variable inputs were selected");
        }
      } else {
        alert("No attributes found");
      }
    });
  };

  return (
    <Map
      mapConfig={mapConfig}
      viewConfig={viewConfig}
      layers={mapLayers}
      legend={mapLegend}
      layerControl={layerControl}
      onMapClick={onMapClick}
      ref={visualizationRef}
      data-testid="backlayer-map"
    />
  );
};

MapVisualization.propTypes = {
  mapConfig: PropTypes.object,
  viewConfig: PropTypes.object,
  layers: PropTypes.array,
  legend: PropTypes.array,
  visualizationRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
};

export default memo(MapVisualization);

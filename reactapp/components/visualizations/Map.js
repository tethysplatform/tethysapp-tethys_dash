import {
  memo,
  useRef,
  useCallback,
  useEffect,
  useState,
  useContext,
} from "react";
import { Map } from "components/map/Map";
import { queryLayerFeatures } from "components/map/utilities";
import PropTypes from "prop-types";
import { getBaseMapLayer } from "components/visualizations/utilities";
import Feature from "ol/Feature";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { LineString, MultiPolygon, Polygon, Point } from "ol/geom";
import { Stroke, Style, Circle } from "ol/style";
import Icon from "ol/style/Icon";
import {
  DataViewerModeContext,
  VariableInputsContext,
} from "components/contexts/Contexts";
import Table from "react-bootstrap/Table";
import styled from "styled-components";
import { getMapAttributeVariables } from "components/visualizations/utilities";
import { valuesEqual } from "components/modals/utilities";
import appAPI from "services/api/app";

const FixedTable = styled(Table)`
  table-layout: fixed;
  font-size: small;
`;
const OverflowTD = styled.td`
  overflow-x: auto;
`;

const PopupDiv = styled.div`
  max-height: 40vh;
  max-width: 20vw;
  width: 20vw;
  overflow-y: auto;
`;

const PopupContent = ({ layerAttributes }) => {
  return Object.keys(layerAttributes).map((layerName) => (
    <PopupDiv>
      <p>
        <b>{layerName}</b>:{" "}
      </p>
      <FixedTable striped bordered hover size="sm">
        <thead>
          <tr>
            <th className="text-center" style={{ width: "33%" }}>
              Field
            </th>
            <th className="text-center" style={{ width: "33%" }}>
              Value
            </th>
          </tr>
        </thead>
        <tbody>
          {Object.keys(layerAttributes[layerName]).map((field) => (
            <tr key={field}>
              <OverflowTD>{field}</OverflowTD>
              <OverflowTD>{layerAttributes[layerName][field]}</OverflowTD>
            </tr>
          ))}
        </tbody>
      </FixedTable>
    </PopupDiv>
  ));
};

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
  if ("paths" in geometries || geometries?.type === "MultiLineString") {
    const paths = geometries.paths || geometries.coordinates;
    features = paths.map((path) => {
      return new Feature({
        geometry: new LineString(path),
        name: "Polyline",
      });
    });
  } else if (geometries?.type === "LineString") {
    features = [
      new Feature({
        geometry: new LineString(geometries.coordinates),
        name: "LineString",
      }),
    ];
  } else if (geometries?.type === "MultiPolygon") {
    features = [
      new Feature({
        geometry: new MultiPolygon(geometries.coordinates),
        name: "MultiPolygon",
      }),
    ];
  } else if (geometries?.type === "Polygon") {
    features = [
      new Feature({
        geometry: new Polygon(geometries.coordinates),
        name: "Polygon",
      }),
    ];
  } else {
    let geometry;
    if ("x" in geometries) {
      geometry = new Point((geometries.x, geometries.y));
    } else {
      geometry = new Point(geometries.coordinates);
    }
    features = [
      new Feature({
        name: "Point",
        geometry: geometry,
      }),
    ];
  }
  const stroke = new Stroke({
    color: "#00008b",
    width: 3,
  });
  const highlightLayer = new VectorLayer({
    source: new VectorSource({
      features: features,
    }),
    style: new Style({
      stroke: stroke,
      image: new Circle({
        stroke: stroke,
        radius: 5,
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
  const currentBaseMap = useRef();
  const { setVariableInputValues } = useContext(VariableInputsContext);
  const { inDataViewerMode } = useContext(DataViewerModeContext);

  useEffect(() => {
    (async () => {
      if (
        !valuesEqual(layers, currentLayers.current) ||
        !valuesEqual(baseMap, currentBaseMap.current)
      ) {
        currentLayers.current = JSON.parse(JSON.stringify(layers));
        const newMapLegend = [];
        const newMapLayers = [];
        for (const layer of layers) {
          if (layer.configuration.props.source.type === "GeoJSON") {
            const geoJSONResponse = await appAPI.downloadJSON({
              filename: layer.configuration.props.source.filename,
            });
            if (geoJSONResponse.success) {
              layer.configuration.props.source.features = geoJSONResponse.data;
            }
          }

          if (layer.style) {
            const styleJSONResponse = await appAPI.downloadJSON({
              filename: layer.style,
            });
            if (styleJSONResponse.success) {
              layer.configuration.style = styleJSONResponse.data;
            }
          }

          if (Object.keys(layer.legend).length > 0) {
            newMapLegend.push(layer.legend);
          }
          newMapLayers.push(layer.configuration);
        }

        if (baseMap) {
          const baseMapLayer = getBaseMapLayer(baseMap);
          if (baseMapLayer) {
            newMapLayers.splice(0, 0, baseMapLayer);
          }
        }

        newMapLayers.forEach((layer, index) => {
          layer.props.zIndex = index;
        });

        currentBaseMap.current = baseMap;
        setMapLegend(newMapLegend);
        setMapLayers(newMapLayers);
      }
    })();
  }, [layers, baseMap]);

  const onMapClick = (map, evt, setPopupContent) => {
    // get coordinates and add pointer marker where the click occurred
    const coordinate = evt.coordinate;
    const pixel = evt.pixel;
    let popupContent = "";
    // const newMarkerLayer = createMarkerLayer(coordinate);
    // if (markerLayer.current) {
    //   map.removeLayer(markerLayer.current);
    // }
    // markerLayer.current = newMarkerLayer;
    // map.addLayer(newMarkerLayer);

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

    // reduce the layer moitted popup attribute values into a simplified object of layer names and then values
    const mapOmittedPopupAttributes = layers.reduce((combined, current) => {
      if (
        current.omittedPopupAttributes &&
        typeof current.omittedPopupAttributes === "object"
      ) {
        // Merge the example object into the combined object
        Object.assign(combined, current.omittedPopupAttributes);
      }
      return combined;
    }, {});

    // query the layer features
    // NEED TO MAKE THIS WORK WITH MULTIPLE LAYERS IN PARALLEL
    queryLayerFeatures(layers[0], map, coordinate, pixel)
      .then((layerFeatures) => {
        if (highlightLayer.current) {
          map.removeLayer(highlightLayer.current);
        }

        // [{attributes: {key: value}, geometry: {x: "", y: ""}, layerName: ""}]
        // if valid features were selected then continue
        if (layerFeatures && layerFeatures.length > 0) {
          const newHighlightLayer = createHighlightLayer(
            layerFeatures[0].geometry
          );
          if (markerLayer.current) {
            map.removeLayer(markerLayer.current);
          }
          highlightLayer.current = newHighlightLayer;
          map.addLayer(newHighlightLayer);

          let updatedVariableInputs = {};
          let layerAttributes = {};
          for (const layerFeature of layerFeatures) {
            const layerName = layerFeature.layerName;
            layerAttributes[layerName] = Object.fromEntries(
              Object.entries(layerFeature.attributes).filter(
                ([key]) => !mapOmittedPopupAttributes[layerName].includes(key)
              )
            );

            if (layerName in mapAttributeVariables) {
              const mappedLayerVariableInputs = {};
              // check each layer attribute variable to see if the features have valid values
              for (const layerAlias in mapAttributeVariables[layerName]) {
                const variableInputName =
                  mapAttributeVariables[layerName][layerAlias];
                const featureValue = layerFeature.attributes[layerAlias];
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

          setPopupContent(<PopupContent layerAttributes={layerAttributes} />);

          // if the map click found any variable inputs to update, then do it
          if (Object.keys(updatedVariableInputs).length > 0) {
            setVariableInputValues((previousVariableInputValues) => ({
              ...previousVariableInputValues,
              ...updatedVariableInputs,
            }));
          } else {
            console.log("No features with variable inputs were selected");
          }
        } else {
          console.log("No attributes found");
        }
      })
      .catch((error) => {
        console.error("Error:", error);
      });
  };

  return (
    <Map
      mapConfig={mapConfig}
      viewConfig={viewConfig}
      layers={mapLayers}
      legend={mapLegend}
      layerControl={layerControl}
      onMapClick={inDataViewerMode ? () => {} : onMapClick}
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

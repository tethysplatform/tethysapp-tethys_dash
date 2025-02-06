import {
  memo,
  useRef,
  useCallback,
  useEffect,
  useState,
  useContext,
} from "react";
import MapComponent from "components/map/Map";
import {
  queryLayerFeatures,
  createHighlightLayer,
  createMarkerLayer,
} from "components/map/utilities";
import PropTypes from "prop-types";
import { getBaseMapLayer } from "components/visualizations/utilities";
import {
  DataViewerModeContext,
  VariableInputsContext,
} from "components/contexts/Contexts";
import Table from "react-bootstrap/Table";
import styled from "styled-components";
import { valuesEqual } from "components/modals/utilities";
import appAPI from "services/api/app";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/navigation";
import { Pagination, Navigation } from "swiper/modules";

const FixedTable = styled(Table)`
  table-layout: fixed;
  font-size: small;
`;
const OverflowTD = styled.td`
  overflow-x: auto;
`;

const PopupDiv = styled.div`
  max-height: 40vh;
  overflow-y: auto;
  margin-bottom: 30px;
`;

const CenteredP = styled.p`
  text-align: center;
  margin: auto;
`;

const SwiperControls = styled.div`
  display: flex;
  justify-content: center; /* Center the controls */
  align-items: center; /* Vertically align the controls */
  position: absolute;
  bottom: 10px; /* Adjust as needed */
  width: 100%; /* Full width for proper alignment */
  z-index: 10;
  height: 2rem;
`;

const SwiperArrows = styled.div`
  font-size: 24px;
  color: #333;
  cursor: pointer;
  margin: 0 10px; /* Space between the arrows and pagination */
  padding: 5px;
  border-radius: 50%;
`;

const SwiperPagination = styled.div`
  font-size: 16px;
  color: #333;
  margin: 0 10px; /* Space between pagination and arrows */
  text-align: center;
`;

const MarginSwiperSlide = styled(SwiperSlide)`
  margin-bottom: 1rem;
`;

const StyledSwiper = styled(Swiper)`
  width: 20vw;
`;

const Popup = ({ layerAttributes }) => {
  return (
    <>
      <StyledSwiper
        modules={[Pagination, Navigation]}
        navigation={{
          nextEl: ".custom-next",
          prevEl: ".custom-prev",
        }}
        pagination={{
          el: ".custom-pagination",
          type: "fraction",
        }}
        className="mySwiper"
      >
        {layerAttributes.map((selectedFeature, index) => (
          <MarginSwiperSlide key={index}>
            <PopupDiv>
              <div>
                <p>
                  <b>{selectedFeature.layerName}</b>:
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
                    {Object.keys(selectedFeature.attributes).map((field) => (
                      <tr key={field}>
                        <OverflowTD>{field}</OverflowTD>
                        <OverflowTD>
                          {selectedFeature.attributes[field]}
                        </OverflowTD>
                      </tr>
                    ))}
                  </tbody>
                </FixedTable>
              </div>
            </PopupDiv>
          </MarginSwiperSlide>
        ))}
        <SwiperControls>
          <SwiperArrows className="custom-prev">❮</SwiperArrows>
          <SwiperPagination className="custom-pagination"></SwiperPagination>
          <SwiperArrows className="custom-next">❯</SwiperArrows>
        </SwiperControls>
      </StyledSwiper>
    </>
  );
};

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
  const highlightLayer = useRef([]);
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
              filename: layer.configuration.props.source.geojson,
            });
            if (geoJSONResponse.success) {
              layer.configuration.props.source.geojson = geoJSONResponse.data;
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

          if (layer.legend) {
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

  const onMapClick = async (map, evt, setPopupContent, popup) => {
    // get coordinates and add pointer marker where the click occurred
    const coordinate = evt.coordinate;
    const pixel = evt.pixel;
    const newMarkerLayer = createMarkerLayer(coordinate);
    if (markerLayer.current) {
      map.removeLayer(markerLayer.current);
    }
    if (highlightLayer.current.length > 0) {
      highlightLayer.current.forEach((highlight) => {
        map.removeLayer(highlight);
      });
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

    // reduce the layer omitted popup attribute values into a simplified object of layer names and then values
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

    // query the layers
    const queryCalls = layers.map((layer) =>
      queryLayerFeatures(layer, map, coordinate, pixel)
        .then((layerFeatures) => {
          // [{attributes: {key: value}, geometry: {x: "", y: ""}, layerName: ""}]
          // if valid features were selected then continue
          if (layerFeatures && layerFeatures.length > 0) {
            let updatedVariableInputs = {};
            for (const layerFeature of layerFeatures) {
              const newHighlightLayer = createHighlightLayer(
                layerFeature.geometry
              );
              highlightLayer.current.push(newHighlightLayer);
              map.addLayer(newHighlightLayer);

              const layerName = layerFeature.layerName;

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
                }
              }

              const newLayerAttributes = Object.fromEntries(
                Object.entries(layerFeature.attributes).filter(
                  ([key]) =>
                    !(layerName in mapOmittedPopupAttributes) ||
                    !mapOmittedPopupAttributes[layerName].includes(key)
                )
              );

              layerFeature.attributes = newLayerAttributes;
            }

            // if the map click found any variable inputs to update, then do it
            if (Object.keys(updatedVariableInputs).length > 0) {
              setVariableInputValues((previousVariableInputValues) => ({
                ...previousVariableInputValues,
                ...updatedVariableInputs,
              }));
            }
          }

          return layerFeatures;
        })
        .catch((error) => {
          console.error("Error:", error);
        })
    );
    const queryLayerFeaturesResults = await Promise.all(queryCalls);

    const nonEmptyLayers = queryLayerFeaturesResults.filter(
      (arr) => arr && arr.length > 0
    );
    const nonEmptyLayerAttributes = nonEmptyLayers
      .flat()
      .filter((item) => Object.keys(item.attributes).length > 0);

    let PopupContent;
    let popupCoordinate;
    if (nonEmptyLayers.length === 0) {
      PopupContent = <CenteredP>No Attributes Found</CenteredP>;
      popupCoordinate = coordinate;
    } else if (nonEmptyLayerAttributes.length === 0) {
      PopupContent = null;
      popupCoordinate = undefined;
    } else {
      PopupContent = <Popup layerAttributes={nonEmptyLayerAttributes} />;
      popupCoordinate = coordinate;
    }
    setPopupContent(PopupContent);
    popup.setPosition(popupCoordinate);
  };

  return (
    <MapComponent
      mapConfig={mapConfig}
      viewConfig={viewConfig}
      layers={mapLayers}
      legend={mapLegend}
      layerControl={layerControl}
      onMapClick={inDataViewerMode ? () => {} : onMapClick}
      visualizationRef={visualizationRef}
      data-testid="backlayer-map"
    />
  );
};

MapVisualization.propTypes = {
  mapConfig: PropTypes.object,
  viewConfig: PropTypes.object,
  layers: PropTypes.array,
  legend: PropTypes.array,
  visualizationRef: PropTypes.shape({ current: PropTypes.any }),
};

export default memo(MapVisualization);

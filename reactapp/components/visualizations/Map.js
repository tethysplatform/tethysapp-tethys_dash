import { memo, useRef, useEffect, useState, useContext } from "react";
import { createRoot } from "react-dom/client";
import MapComponent from "components/map/Map";
import {
  queryLayerFeatures,
  createHighlightLayer,
  createMarkerLayer,
  configurationPropType,
  mapDrawingPropType,
  loadLayerJSONs,
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
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/navigation";
import { Pagination, Navigation } from "swiper/modules";
import Overlay from "ol/Overlay";
import { FaTimes } from "react-icons/fa";

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

const OverlayContentWrapper = styled.div`
  position: relative;
  background-color: white;
  border-radius: 8px;
  padding: 1rem;
  box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.2);
`;

const StyledCloser = styled.a`
  position: absolute;
  top: 8px;
  right: 8px;
  cursor: pointer;
`;

const StyledContent = styled.div`
  margin-top: 1rem;
`;

const Popup = ({ layerAttributes }) => (
  <StyledSwiper
    modules={[Pagination, Navigation]}
    navigation={{ nextEl: ".custom-next", prevEl: ".custom-prev" }}
    pagination={{ el: ".custom-pagination", type: "fraction" }}
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
                    <OverflowTD>{selectedFeature.attributes[field]}</OverflowTD>
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
);

const MapVisualization = ({
  mapConfig,
  mapExtent,
  mapDrawing,
  layers,
  visualizationRef,
  baseMap,
  layerControl,
  dataviewerViz,
}) => {
  const [mapLegend, setMapLegend] = useState();
  const [mapLayers, setMapLayers] = useState();
  const [popupContent, setPopupContent] = useState(null);
  const markerLayer = useRef();
  const highlightLayer = useRef([]);
  const currentLayers = useRef([]);
  const currentBaseMap = useRef();
  const { setVariableInputValues } = useContext(VariableInputsContext);
  const { inDataViewerMode } = useContext(DataViewerModeContext);

  const spinnerOverlayRef = useRef(null);
  const popupOverlayRef = useRef(null);
  const popupContainerRef = useRef(document.createElement("div"));
  const popupRootRef = useRef(null);

  const drawing = useRef(false);

  // Mount the React popup inside the container div
  useEffect(() => {
    popupRootRef.current = createRoot(popupContainerRef.current);
    const popupOverlay = new Overlay({
      element: popupContainerRef.current,
      autoPan: true,
      autoPanAnimation: { duration: 250 },
    });

    spinnerOverlayRef.current = new Overlay({
      element: document.createElement("div"),
      positioning: "center-center",
    });

    if (visualizationRef?.current) {
      visualizationRef.current.addOverlay(spinnerOverlayRef.current);
      visualizationRef.current.addOverlay(popupOverlay);
      popupOverlayRef.current = popupOverlay;
    }

    return () => {
      if (visualizationRef?.current) {
        if (spinnerOverlayRef.current) {
          visualizationRef.current.removeOverlay(spinnerOverlayRef.current);
        }
        if (popupOverlayRef.current) {
          // eslint-disable-next-line
          visualizationRef.current.removeOverlay(popupOverlayRef.current);
        }
      }
    };
  }, [visualizationRef]);

  useEffect(() => {
    if (popupRootRef.current) {
      popupRootRef.current.render(
        popupContent ? (
          <OverlayContentWrapper aria-label="Map Popup" id="map-popup">
            <StyledCloser
              href="#"
              id="popup-closer"
              className="ol-popup-closer"
              aria-label="Popup Closer"
              onClick={(e) => {
                e.preventDefault();
                popupOverlayRef.current.setPosition(undefined);
                setPopupContent(null);
              }}
            >
              <FaTimes />
            </StyledCloser>
            <StyledContent aria-label="Map Popup Content" id="popup-content">
              {popupContent}
            </StyledContent>
          </OverlayContentWrapper>
        ) : null
      );
    }
  }, [popupContent]);

  useEffect(() => {
    const updateLayers = async () => {
      if (
        (layers && !valuesEqual(layers, currentLayers.current)) ||
        !valuesEqual(baseMap, currentBaseMap.current)
      ) {
        currentBaseMap.current = baseMap;
        currentLayers.current = JSON.parse(JSON.stringify(layers));
        const newMapLegend = [];
        const newMapLayers = [];

        for (const layer of layers) {
          await loadLayerJSONs(layer);
          if (layer.legend) newMapLegend.push(layer.legend);
          newMapLayers.push(layer.configuration);
        }

        if (baseMap) {
          const baseMapLayer = getBaseMapLayer(baseMap);
          if (baseMapLayer) {
            newMapLayers.unshift(baseMapLayer);
          } else {
            console.error(`${baseMap} is not a valid basemap`);
          }
        }

        newMapLayers.forEach((layer, index) => {
          layer.props.zIndex = index;
        });

        setMapLegend(newMapLegend);
        setMapLayers(newMapLayers);
      }
    };

    updateLayers();
  }, [layers, baseMap]);

  const onMapClick = async (map, evt) => {
    if (drawing.current) return;

    const coordinate = evt.coordinate;
    const pixel = evt.pixel;

    if (spinnerOverlayRef.current) {
      spinnerOverlayRef.current.setPosition(coordinate);
    }

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

    const queryableLayers = layers.filter(
      (item) => !(item.queryable === false)
    );

    // reduce the layer attributes variables values into a simplified object of layer names and then values
    const mapAttributeAliases = queryableLayers.reduce((combined, current) => {
      if (
        current.attributeAliases &&
        typeof current.attributeAliases === "object"
      ) {
        // Merge the example object into the combined object
        Object.assign(combined, current.attributeAliases);
      }
      return combined;
    }, {});

    // reduce the layer attributes variables values into a simplified object of layer names and then values
    const mapAttributeVariables = queryableLayers.reduce(
      (combined, current) => {
        if (
          current.attributeVariables &&
          typeof current.attributeVariables === "object"
        ) {
          // Merge the example object into the combined object
          Object.assign(combined, current.attributeVariables);
        }
        return combined;
      },
      {}
    );

    // reduce the layer omitted popup attribute values into a simplified object of layer names and then values
    const mapOmittedPopupAttributes = queryableLayers.reduce(
      (combined, current) => {
        if (
          current.omittedPopupAttributes &&
          typeof current.omittedPopupAttributes === "object"
        ) {
          // Merge the example object into the combined object
          Object.assign(combined, current.omittedPopupAttributes);
        }
        return combined;
      },
      {}
    );

    // query the layers
    const queryCalls = queryableLayers.map((layer) =>
      queryLayerFeatures(layer, map, coordinate, pixel)
        .then((layerFeatures) => {
          // [{attributes: {key: value}, geometry: {x: "", y: ""}, layerName: ""}]
          // if valid features were selected then continue
          if (
            layerFeatures &&
            Array.isArray(layerFeatures) &&
            layerFeatures.length > 0
          ) {
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

              const aliasMap = mapAttributeAliases[layerName] || {};
              const omittedFields = mapOmittedPopupAttributes[layerName] || [];

              const newLayerAttributes = Object.fromEntries(
                Object.entries(layerFeature.attributes)
                  .filter(([key]) => !omittedFields.includes(key))
                  .map(([key, value]) => [aliasMap[key] || key, value])
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

    // Remove spinner overlay once queries are done
    if (spinnerOverlayRef.current) {
      spinnerOverlayRef.current.setPosition(null);
    }

    const nonEmptyLayers = queryLayerFeaturesResults.filter(
      (arr) => (arr && Array.isArray(arr) && arr.length > 0) || arr === "zoomed"
    );
    const nonEmptyLayerAttributes = nonEmptyLayers
      .flat()
      .filter(
        (item) => item !== "zoomed" && Object.keys(item.attributes).length > 0
      );

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
    popupOverlayRef.current?.setPosition(popupCoordinate);
  };

  return (
    <MapComponent
      mapConfig={mapConfig}
      mapExtent={mapExtent}
      layers={mapLayers}
      legend={mapLegend}
      layerControl={layerControl}
      mapDrawing={mapDrawing}
      drawing={drawing}
      onMapClick={inDataViewerMode ? () => {} : onMapClick}
      visualizationRef={visualizationRef}
      data-testid="backlayer-map"
      dataviewerViz={dataviewerViz}
    />
  );
};

MapVisualization.propTypes = {
  mapConfig: PropTypes.object, // div element properties for the map
  mapExtent: PropTypes.shape({
    extent: PropTypes.string, // minX,minY,maxX,maxY or lon,lat,zoom
    variable: PropTypes.string,
  }),
  layers: PropTypes.arrayOf(
    PropTypes.shape({
      configuration: configurationPropType,
    })
  ),
  visualizationRef: PropTypes.shape({ current: PropTypes.any }), // react ref pointing to the ol Map
  baseMap: PropTypes.string, // url for basemap layer, maps to baseMapLayers layers in components/visualizations/utilities.js
  layerControl: PropTypes.bool, // deterimines if a layer control menu should be present
  dataviewerViz: PropTypes.bool, // determines if the map is in the dataviewer so that it doesnt affect the main map
  mapDrawing: mapDrawingPropType, // contains draw interaction metadata like options and limits
};

Popup.propTypes = {
  layerAttributes: PropTypes.shape({ map: PropTypes.any }),
};

export default memo(MapVisualization);

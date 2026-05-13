import {
  memo,
  useRef,
  useEffect,
  useState,
  useContext,
  useCallback,
  useMemo,
} from "react";
import { createRoot } from "react-dom/client";
import MapComponent from "components/map/Map";
import {
  queryLayerFeatures,
  createHighlightLayer,
  addHighlightFeatures,
  createMarkerLayer,
  configurationPropType,
  mapDrawingPropType,
  loadLayerJSONs,
} from "components/map/utilities";
import PropTypes from "prop-types";
import { COLOR_RAMPS } from "components/map/colorRamps";
import { getBaseMapLayer } from "components/visualizations/utilities";
import useRuntimeLayerFetcher from "components/visualizations/runtimeLayerFetcher";
import {
  AppContext,
  DataViewerModeContext,
  VariableInputsContext,
  LayoutContext,
  GridItemContext,
} from "components/contexts/Contexts";
import { useMapContext } from "components/contexts/MapContext";
import PopupModal from "components/modals/PopupModal/PopupModal";
import PopupModalChrome from "components/modals/PopupModal/PopupModalChrome";
import PopupModalCarousel from "components/modals/PopupModal/PopupModalCarousel";
import { substituteTemplateString } from "components/modals/PopupModal/substituteTemplateString";
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

export const Popup = ({
  layerAttributes,
  onSwipe,
  omittedPopupAttributes,
  aliases,
}) => {
  const filteredLayerAttributes = layerAttributes.map((feature) => {
    const omittedFields = omittedPopupAttributes[feature.layerName] || [];
    const aliasMap = aliases[feature.layerName] || {};
    const filteredAttributes = Object.fromEntries(
      Object.entries(feature.attributes)
        .filter(([key]) => !omittedFields.includes(key))
        .map(([key, value]) => [aliasMap[key] || key, value]),
    );
    return { ...feature, attributes: filteredAttributes };
  });

  return (
    <StyledSwiper
      modules={[Pagination, Navigation]}
      navigation={{ nextEl: ".custom-next", prevEl: ".custom-prev" }}
      pagination={{ el: ".custom-pagination", type: "fraction" }}
      className="mySwiper"
      simulateTouch={false}
      onSlideChange={onSwipe}
    >
      {filteredLayerAttributes.map((selectedFeature, index) => (
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
                  {Object.keys(selectedFeature.attributes).map((field) => {
                    const value = selectedFeature.attributes[field];
                    // Simple URL regex: matches http(s)://, ftp://, or www.
                    const urlRegex =
                      /^(https?:\/\/|ftp:\/\/|www\.)[\w-]+(\.[\w-]+)+([\w\-.,@?^=%&:/~+#]*[\w\-@?^=%&/~+#])?/i;
                    let renderedValue;
                    if (typeof value === "string" && urlRegex.test(value)) {
                      // Ensure protocol for www. links
                      const href =
                        value.startsWith("http") || value.startsWith("ftp")
                          ? value
                          : `https://${value}`;
                      renderedValue = (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {value}
                        </a>
                      );
                    } else {
                      renderedValue = value;
                    }
                    return (
                      <tr key={field}>
                        <OverflowTD>{field}</OverflowTD>
                        <OverflowTD>{renderedValue}</OverflowTD>
                      </tr>
                    );
                  })}
                </tbody>
              </FixedTable>
            </div>
          </PopupDiv>
        </MarginSwiperSlide>
      ))}
      <SwiperControls>
        <SwiperArrows className="custom-prev" aria-label="Previous Swiper">
          ❮
        </SwiperArrows>
        <SwiperPagination className="custom-pagination"></SwiperPagination>
        <SwiperArrows className="custom-next" aria-label="Next Swiper">
          ❯
        </SwiperArrows>
      </SwiperControls>
    </StyledSwiper>
  );
};

const MapVisualization = ({
  mapConfig,
  mapExtent,
  mapDrawing,
  layers,
  visualizationRef,
  baseMap,
  layerControl,
  dataviewerViz,
  refreshCount,
}) => {
  const [mapLegend, setMapLegend] = useState();
  const [mapLayers, setMapLayers] = useState();
  const [popupContent, setPopupContent] = useState(null);
  const [modalFeatures, setModalFeatures] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeFeatureIndex, setActiveFeatureIndex] = useState(0);
  const markerLayer = useRef();
  const highlightLayer = useRef();
  const currentLayers = useRef([]);
  const currentBaseMap = useRef();
  const mapAttributeVariablesRef = useRef({});
  const mapOmittedPopupAttributesRef = useRef({});
  const mapAttributeAliasesRef = useRef({});
  const mapContainerRef = useRef(null);
  const {
    variableInputValues,
    variableInputDateFormats,
    setVariableInputValues,
  } = useContext(VariableInputsContext);
  const { inDataViewerMode } = useContext(DataViewerModeContext);
  const { uuid } = useContext(LayoutContext);
  const { sessionNonce } = useContext(AppContext);
  const { gridItemUUID } = useContext(GridItemContext) ?? {};
  const mapContextValue = useMapContext();
  const extentDrawMode = mapContextValue?.extentDrawMode ?? null;

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setModalFeatures([]);
    const container = mapContainerRef.current;
    if (container && typeof container.focus === "function") {
      container.focus();
    }
  }, []);

  const dismissPopupBeforeSwap = useCallback(() => {
    // istanbul ignore next
    if (popupOverlayRef.current) {
      popupOverlayRef.current.setPosition(undefined);
    }
    setPopupContent(null);
    if (highlightLayer.current?.getSource) {
      highlightLayer.current.getSource().clear();
    }
  }, []);

  const { errorsByLayerId, retry: retryRuntimeLayer } = useRuntimeLayerFetcher({
    layers,
    gridItemUUID,
    sessionNonce,
    mapRef: visualizationRef,
    variableInputValues,
    variableInputDateFormats,
    onBeforeSwap: dismissPopupBeforeSwap,
    refreshTick: refreshCount,
  });

  const runtimeLayerState = {
    errorsByLayerId,
    retry: retryRuntimeLayer,
    sessionNonce,
    gridItemUUID,
  };

  const spinnerOverlayRef = useRef(null);
  // Create a spinner element for the overlay
  const spinnerElement = document.createElement("div");
  spinnerElement.style.display = "flex";
  spinnerElement.style.justifyContent = "center";
  spinnerElement.style.alignItems = "center";
  spinnerElement.style.width = "48px";
  spinnerElement.style.height = "48px";
  spinnerElement.innerHTML = `<div style="border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 32px; height: 32px; animation: spin 1s linear infinite;"></div><style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>`;
  const popupOverlayRef = useRef(null);
  const popupContainerRef = useRef(document.createElement("div"));
  const popupRootRef = useRef(null);

  const drawing = useRef(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Mount the React popup inside the container div
  useEffect(() => {
    popupRootRef.current = createRoot(popupContainerRef.current);
    const popupOverlay = new Overlay({
      element: popupContainerRef.current,
      autoPan: true,
      autoPanAnimation: { duration: 250 },
    });

    spinnerOverlayRef.current = new Overlay({
      element: spinnerElement,
      positioning: "center-center",
    });

    // istanbul ignore next
    if (visualizationRef?.current) {
      // known non-coverage for tests
      visualizationRef.current.addOverlay(spinnerOverlayRef.current);
      visualizationRef.current.addOverlay(popupOverlay);
      popupOverlayRef.current = popupOverlay;
    }

    return () => {
      // istanbul ignore next
      if (visualizationRef?.current) {
        // known non-coverage for tests
        if (spinnerOverlayRef.current) {
          visualizationRef.current.removeOverlay(spinnerOverlayRef.current);
        }
        if (popupOverlayRef.current) {
          // eslint-disable-next-line
          visualizationRef.current.removeOverlay(popupOverlayRef.current);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visualizationRef]);

  useEffect(() => {
    // istanbul ignore next
    if (popupRootRef.current) {
      popupRootRef.current.render(
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
            {popupContent ? (
              <Popup
                layerAttributes={popupContent}
                onSwipe={onSwipe}
                omittedPopupAttributes={mapOmittedPopupAttributesRef.current}
                aliases={mapAttributeAliasesRef.current}
              />
            ) : (
              <CenteredP>No Attributes Found</CenteredP>
            )}
          </StyledContent>
        </OverlayContentWrapper>,
      );

      // Highlight the first feature when the popup is created
      if (popupContent && popupContent.length > 0) {
        const selectedFeature = popupContent[0];
        addHighlightFeatures(highlightLayer.current, selectedFeature.geometry);
        updateVariableInputsForFeature(selectedFeature);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          await loadLayerJSONs(layer, uuid);
          if (layer.legend) {
            if (layer.legend === "default") {
              const rampSource = layer.configuration?.props?.source;
              if (
                rampSource?.type === "GeoTIFF" &&
                typeof rampSource.rampName === "string" &&
                COLOR_RAMPS[rampSource.rampName] &&
                rampSource.rampMin !== undefined &&
                rampSource.rampMax !== undefined
              ) {
                newMapLegend.push({
                  rampColors: COLOR_RAMPS[rampSource.rampName],
                  rampMin: rampSource.rampMin,
                  rampMax: rampSource.rampMax,
                  title: layer.configuration?.props?.name,
                });
                newMapLayers.push(layer.configuration);
                continue;
              }
              // If the layer has a style JSON, pass it as legend metadata
              if (layer.configuration.style) {
                let styleJSON = layer.configuration.style;
                if (typeof layer.configuration.style === "string") {
                  try {
                    styleJSON = JSON.parse(layer.configuration.style);
                  } catch {
                    newMapLegend.push(null);
                  }
                }

                if (styleJSON && (styleJSON.rules || styleJSON.default)) {
                  newMapLegend.push({
                    styleJSON,
                    title: layer.configuration?.props?.name,
                  });
                } else {
                  newMapLegend.push(null);
                }
              } else {
                newMapLegend.push({
                  sourceType: layer.configuration.props.source.type,
                  url: layer.configuration.props.source.props.url,
                  layers:
                    layer.configuration.props.source.props?.params?.LAYERS,
                });
              }
            } else {
              newMapLegend.push(layer.legend);
            }
          }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, baseMap]);

  const onSwipe = (swiper) => {
    const selectedFeature = popupContent[swiper.activeIndex];

    // Update highlights to only show the currently visible feature
    highlightLayer.current.getSource().clear();
    addHighlightFeatures(highlightLayer.current, selectedFeature.geometry);
    updateVariableInputsForFeature(selectedFeature);
  };

  const updateVariableInputsForFeature = (selectedFeature) => {
    const layerName = selectedFeature.layerName;
    const mapAttributeVariables = mapAttributeVariablesRef.current;

    // for mapped variable inputs, get the selected feature values and set the variable inputs accordingly
    if (layerName && mapAttributeVariables[layerName]) {
      let updatedVariableInputs = {};
      for (const layerAttributeOrAlias in mapAttributeVariables[layerName]) {
        // Try to derive both the alias and the original field name from attributeAliases
        let layerAttribute = layerAttributeOrAlias;
        let layerAttributeAlias = layerAttributeOrAlias;
        const aliasMap = mapAttributeAliasesRef.current[layerName] || {};
        // If the aliasMap has a mapping for this key, set alias and try to find the original
        if (aliasMap[layerAttributeOrAlias]) {
          layerAttributeAlias = aliasMap[layerAttributeOrAlias];
        } else {
          // Try to find if this is an alias value (reverse lookup)
          const originalKey = Object.keys(aliasMap).find(
            (k) => aliasMap[k] === layerAttributeOrAlias,
          );
          if (originalKey) {
            layerAttribute = originalKey;
            layerAttributeAlias = layerAttributeOrAlias;
          }
        }

        const variableInputName =
          mapAttributeVariables[layerName][layerAttributeOrAlias];

        const featureValue =
          selectedFeature.attributes[layerAttribute] ||
          selectedFeature.attributes[layerAttributeAlias];

        if (featureValue && featureValue !== "Null") {
          updatedVariableInputs[variableInputName] = featureValue;
        }
      }
      if (Object.keys(updatedVariableInputs).length > 0) {
        setVariableInputValues((previousVariableInputValues) => ({
          ...previousVariableInputValues,
          ...updatedVariableInputs,
        }));
      }
    }
  };

  const onMapClick = async (map, evt) => {
    // istanbul ignore next
    if (drawing.current || isProcessing) return;
    setIsProcessing(true);

    const coordinate = evt.coordinate;
    const pixel = evt.pixel;

    // istanbul ignore next
    if (spinnerOverlayRef.current) {
      spinnerOverlayRef.current.setPosition(coordinate);
    }

    const newMarkerLayer = createMarkerLayer(coordinate);
    if (markerLayer.current) {
      map.removeLayer(markerLayer.current);
    }
    if (highlightLayer.current) {
      highlightLayer.current.getSource().clear();
    } else {
      highlightLayer.current = createHighlightLayer();
      map.addLayer(highlightLayer.current);
    }
    markerLayer.current = newMarkerLayer;
    map.addLayer(newMarkerLayer);

    // Skip layers the user has hidden via the layer control. The OL layer
    // is the source of truth for visibility because LayersControl mutates
    // `olLayer.setVisible(...)` directly; the config-side `layers` array
    // is not re-synced on toggle. If a config layer has no matching OL
    // layer (e.g., not yet mounted) keep it queryable as a safe default.
    const olLayerVisibility = new Map();
    map
      .getLayers()
      .getArray()
      .forEach((olLayer) => {
        const name = olLayer.get("name");
        if (name) olLayerVisibility.set(name, olLayer.getVisible());
      });
    const queryableLayers = layers.filter((item) => {
      if (item.queryable === false) return false;
      const name = item.configuration?.props?.name;
      if (!name || !olLayerVisibility.has(name)) return true;
      return olLayerVisibility.get(name) === true;
    });

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
    mapAttributeAliasesRef.current = mapAttributeAliases;

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
      {},
    );
    mapAttributeVariablesRef.current = mapAttributeVariables;

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
      {},
    );
    mapOmittedPopupAttributesRef.current = mapOmittedPopupAttributes;

    // query the layers
    //
    // Each feature returned by queryLayerFeatures carries the SOURCE
    // sub-layer name in `feature.layerName` (e.g., for ESRI Image/Map
    // Services that's the rendered sub-layer like "Max Status - Forecast
    // Trend", NOT the wrapper layer the user named "a"). The wrapper is
    // where popupConfig lives, so we tag each feature with its parent
    // wrapper at query time. Downstream popup-resolution code reads
    // `feature.__wrapperLayer` directly instead of trying to back into
    // the wrapper from a sub-layer name string — that lookup is fragile
    // because it only works when the user has also configured aliases /
    // variables / omitted-attrs on that sub-layer.
    const queryCalls = queryableLayers.map(async (layer) => {
      try {
        const features = await queryLayerFeatures(
          layer,
          map,
          coordinate,
          pixel,
        );
        if (!Array.isArray(features)) return features;
        return features.map((feature) =>
          feature && typeof feature === "object"
            ? { ...feature, __wrapperLayer: layer }
            : feature,
        );
      } catch (error) {
        // Optionally log error: console.error(error);
        return [];
      }
    });
    const queryLayerFeaturesResults = await Promise.all(queryCalls);

    // Remove spinner overlay once queries are done
    // istanbul ignore next
    if (spinnerOverlayRef.current) {
      spinnerOverlayRef.current.setPosition(null);
    }
    setIsProcessing(false);

    // If any result contains an object with a 'zoomed' property, suppress popup
    const hasZoomed = queryLayerFeaturesResults.some((arr) => arr === "zoomed");

    let newPopupContent = null;
    let popupCoordinate = undefined;

    if (!hasZoomed) {
      const nonEmptyLayers = queryLayerFeaturesResults
        .filter((arr) => arr && Array.isArray(arr) && arr.length > 0)
        .flat();

      const modalModeFeatures = nonEmptyLayers.filter(
        (feature) =>
          feature?.__wrapperLayer?.popupConfig?.mode === "modal",
      );

      if (modalModeFeatures.length > 0 && !extentDrawMode) {
        setModalFeatures(modalModeFeatures);
        setModalOpen(true);
      }

      const nonEmptyLayerAttributes = nonEmptyLayers.filter((item) => {
        if (!item.attributes || Object.keys(item.attributes).length === 0) {
          return false;
        }
        const omittedFields =
          mapOmittedPopupAttributesRef.current[item.layerName] || [];
        // Check if there is at least one attribute not omitted
        return Object.keys(item.attributes).some(
          (key) => !omittedFields.includes(key),
        );
      });

      newPopupContent = nonEmptyLayers;
      // no features found at the location, show "No Attributes Found" in the popup
      if (nonEmptyLayers.length === 0) {
        popupCoordinate = coordinate;
        newPopupContent = null;
        // if any valid attributes, show them in popup and set the coordinate to the first feature with attributes
      } else if (nonEmptyLayerAttributes.length > 0) {
        popupCoordinate = coordinate;
      }
    }
    setPopupContent(newPopupContent);
    popupOverlayRef.current?.setPosition(popupCoordinate);
  };

  useEffect(() => {
    setActiveFeatureIndex(0);
  }, [modalFeatures]);

  const safeActiveFeatureIndex =
    modalFeatures.length > 0
      ? Math.min(activeFeatureIndex, modalFeatures.length - 1)
      : 0;
  const activeModalFeature = modalFeatures[safeActiveFeatureIndex] ?? null;
  // The wrapper layer is tagged onto each feature at query time (see the
  // queryCalls loop in onMapClick). Reading it back here avoids a fragile
  // sub-layer-name → wrapper-name back-lookup that would fail whenever
  // the user hasn't configured aliases/variables/omitted-attrs on the
  // sub-layer the ESRI service happens to report.
  //
  // The captured `__wrapperLayer` is a closure over the layer object at
  // click time. Host-level variable input changes (e.g., `${f}` in a
  // popup gridItem's args_string) rebuild the `layers` prop with freshly
  // substituted strings — but `modalFeatures` state still holds the
  // old wrapper. Re-resolve here against the current `layers` prop by
  // wrapper name so the popup body always sees up-to-date popupConfig.
  const activeModalLayer = useMemo(() => {
    const captured = activeModalFeature?.__wrapperLayer ?? null;
    if (!captured) return null;
    const name = captured.configuration?.props?.name;
    if (name && Array.isArray(layers)) {
      const fresh = layers.find(
        (l) => l?.configuration?.props?.name === name,
      );
      if (fresh) return fresh;
    }
    return captured;
  }, [activeModalFeature, layers]);
  const activeModalPopupConfig = activeModalLayer?.popupConfig ?? null;

  // Resolve a popup feature's display label. Used both for the header title
  // (active feature) and the carousel prev/next arrows' aria-labels
  // (neighboring features) so screen readers announce them by name.
  const buildFeatureLabel = useCallback(
    (feature, i) => {
      const template = activeModalPopupConfig?.titleTemplate;
      if (feature && template) {
        const substituted = substituteTemplateString(
          template,
          feature.attributes ?? {},
        );
        if (substituted.trim().length > 0) return substituted;
      }
      return feature?.layerName ?? `Feature ${(i ?? 0) + 1}`;
    },
    [activeModalPopupConfig],
  );
  const popupTitleText = activeModalFeature
    ? buildFeatureLabel(activeModalFeature, safeActiveFeatureIndex)
    : "";

  return (
    <div
      ref={mapContainerRef}
      tabIndex={-1}
      style={{ outline: "none", width: "100%", height: "100%" }}
    >
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
        runtimeLayerState={runtimeLayerState}
      />
      <PopupModal
        show={modalOpen && !!activeModalFeature}
        onClose={closeModal}
        position={activeModalPopupConfig?.position}
        title={
          <span id="popup-modal-title" data-testid="popup-modal-header-title">
            {popupTitleText}
          </span>
        }
        leadingControls={
          modalFeatures.length > 1 ? (
            <PopupModalCarousel
              features={modalFeatures}
              activeIndex={safeActiveFeatureIndex}
              onActiveIndexChange={setActiveFeatureIndex}
              getLabel={buildFeatureLabel}
            />
          ) : null
        }
        ariaLabelledBy="popup-modal-title"
        triggerRef={mapContainerRef}
      >
        {activeModalFeature ? (
          <PopupModalChrome
            feature={activeModalFeature}
            popupConfig={activeModalPopupConfig}
          />
        ) : null}
      </PopupModal>
    </div>
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
    }),
  ),
  visualizationRef: PropTypes.shape({ current: PropTypes.any }), // react ref pointing to the ol Map
  baseMap: PropTypes.string, // url for basemap layer, maps to baseMapLayers layers in components/visualizations/utilities.js
  layerControl: PropTypes.bool, // deterimines if a layer control menu should be present
  dataviewerViz: PropTypes.bool, // determines if the map is in the dataviewer so that it doesnt affect the main map
  mapDrawing: mapDrawingPropType, // contains draw interaction metadata like options and limits
  refreshCount: PropTypes.number,
};

Popup.propTypes = {
  layerAttributes: PropTypes.arrayOf(
    PropTypes.shape({
      layerName: PropTypes.string,
      attributes: PropTypes.object,
    }),
  ),
  onSwipe: PropTypes.func, // function to call on swipe event
  omittedPopupAttributes: PropTypes.object,
  aliases: PropTypes.object,
};

export default memo(MapVisualization);

import React, { useEffect, useState, useRef } from "react";
import ReactDOM from "react-dom";
import { valuesEqual } from "components/modals/utilities";
import { MapContext } from "components/contexts/Contexts";
import { Map as OlMap, View } from "ol";
import Overlay from "ol/Overlay";
import moduleLoader from "components/map/ModuleLoader";
import LayersControl from "components/map/LayersControl";
import LegendControl from "components/map/Legend";
import Alert from "react-bootstrap/Alert";
import styled from "styled-components";
import { applyStyle } from "ol-mapbox-style";
import { MdClose } from "react-icons/md";

const StyledAlert = styled(Alert)`
  position: absolute;
  top: 1rem;
  left: 1rem;
  right: 1rem;
  z-index: 1000;
`;

const OverLayContentWrapper = styled.div`
  position: absolute;
  background-color: white;
  padding: 15px;
  border-radius: 10px;
  border: 1px solid #ccc;
  max-width: 30vw;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
  transform: translate(-50%, -100%);

  &:after,
  &:before {
    bottom: -20px;
    border: solid transparent;
    content: "";
    height: 0;
    width: 0;
    position: absolute;
    pointer-events: none;
  }

  &:after {
    border-top-color: white;
    border-width: 10px;
    left: 50%;
    margin-left: -10px;
  }

  &:before {
    border-top-color: #ccc;
    border-width: 11px;
    left: 50%;
    margin-left: -11px;
  }
`;

const StyledCloser = styled.a`
  text-decoration: none;
  position: absolute;
  top: 2px;
  right: 8px;
  color: red;
`;

const StyledContent = styled.div`
  padding-top: 1rem;
`;

const Map = ({
  mapConfig,
  viewConfig,
  layers,
  legend,
  layerControl,
  onMapClick,
  visualizationRef: mapRef,
}) => {
  const [map, setMap] = useState();
  const [errorMessage, setErrorMessage] = useState("");
  const [layerControlUpdate, setLayerControlUpdate] = useState();
  const viewRef = useRef();
  const mapDivRef = useRef();
  const popupRef = useRef(null);
  const onMapClickCurrent = useRef();
  const popupCurrent = useRef();
  const [popupContent, setPopupContent] = useState(null);

  const defaultMapConfig = {
    className: "ol-map",
    style: { width: "100%", height: "100%", position: "relative" },
  };
  const customMapConfig = { ...defaultMapConfig, ...mapConfig };

  const defaultViewConfig = {
    projection: "EPSG:3857",
    zoom: 4.5,
    center: [-10686671.116154263, 4721671.572580108],
  };

  useEffect(() => {
    const initialMap = new OlMap({
      target: mapDivRef.current,
      view: new View(defaultViewConfig),
      layers: [],
      controls: [],
      overlays: [],
    });

    setMap(initialMap);
    mapRef.current = initialMap;

    return () => {
      initialMap.setTarget(undefined);
    };
  }, []);

  useEffect(() => {
    const customViewConfig = { ...defaultViewConfig, ...viewConfig };
    if (!viewRef.current || !valuesEqual(viewRef.current, customViewConfig)) {
      mapRef.current.setView(new View(customViewConfig));
      viewRef.current = customViewConfig;
    }
  }, [viewConfig]);

  useEffect(() => {
    const customLayers = layers ?? [];
    const mapDerivedLayers = [...mapRef.current.getLayers().getArray()];
    mapDerivedLayers.forEach((mapLayer) =>
      mapRef.current.removeLayer(mapLayer)
    );

    customLayers.forEach((layerConfig) => {
      moduleLoader(layerConfig)
        .then((layerInstance) => {
          mapRef.current.addLayer(layerInstance);
          if (layerConfig.style) {
            applyStyle(
              layerInstance,
              layerConfig.style,
              layerConfig.props.name
            ).catch((err) => {
              console.log(err);
            });
          }
        })
        .catch((err) => {
          console.log(err);
          setErrorMessage(
            `Failed to load the '${layerConfig.props.name}' layer`
          );
        });
    });

    const popup = new Overlay({
      element: popupRef.current,
      autoPan: true,
      autoPanAnimation: {
        duration: 250,
      },
      autoPanMargin: 20,
    });
    if (popupCurrent.current) {
      mapRef.current.removeOverlay(popupCurrent.current);
    }
    popupCurrent.current = popup;
    mapRef.current.addOverlay(popup);

    if (onMapClickCurrent.current) {
      mapRef.current.un("singleclick", onMapClickCurrent.current);
    }
    onMapClickCurrent.current = async function (evt) {
      onMapClick(mapRef.current, evt, setPopupContent, popupCurrent.current);
    };
    mapRef.current.on("singleclick", onMapClickCurrent.current);
    setLayerControlUpdate(!layerControlUpdate);
    mapRef.current.renderSync();
  }, [layers]);

  return (
    <>
      <MapContext.Provider value={{ map }}>
        <div ref={mapDivRef} {...customMapConfig}>
          {errorMessage && (
            <StyledAlert
              key="failure"
              variant="danger"
              dismissible={true}
              onClose={() => setErrorMessage("")}
            >
              {errorMessage}
            </StyledAlert>
          )}
          <div>
            {layerControl && <LayersControl updater={layerControlUpdate} />}
            {legend && <LegendControl items={legend} />}
          </div>
        </div>
        <OverLayContentWrapper
          id="map-popup"
          className="map-popup"
          ref={popupRef}
        >
          <StyledCloser
            href="#"
            id="popup-closer"
            class="ol-popup-closer"
            onClick={() => {
              popupCurrent.current.setPosition(undefined);
              setPopupContent(null);
            }}
          >
            <MdClose size="1.5rem" />
          </StyledCloser>
          <StyledContent id="popup-content">
            {popupContent &&
              ReactDOM.createPortal(popupContent, popupRef.current)}
          </StyledContent>
        </OverLayContentWrapper>
      </MapContext.Provider>
    </>
  );
};

export { Map };

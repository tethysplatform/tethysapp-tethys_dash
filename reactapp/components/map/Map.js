import React, { useEffect, useState, useRef } from "react";
import ReactDOM from "react-dom";
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
}) => {
  const [map, setMap] = useState();
  const [errorMessage, setErrorMessage] = useState("");
  const mapRef = useRef();
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
  const customViewConfig = { ...defaultViewConfig, ...viewConfig };

  useEffect(() => {
    const initialMap = new OlMap({
      target: mapRef.current,
      view: new View({
        ...customViewConfig,
      }),
      layers: [],
      controls: [],
      overlays: [],
    });

    setMap(initialMap);

    return () => {
      initialMap.setTarget(undefined);
    };
  }, []);

  useEffect(() => {
    if (!map) return;

    const customLayers = layers ?? [];
    const mapDerivedLayers = [...map.getLayers().getArray()];
    mapDerivedLayers.forEach((mapLayer) => map.removeLayer(mapLayer));

    customLayers.forEach((layerConfig) => {
      moduleLoader(layerConfig)
        .then((layerInstance) => {
          map.addLayer(layerInstance);
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
      map.removeOverlay(popupCurrent.current);
    }
    popupCurrent.current = popup;
    map.addOverlay(popup);

    if (onMapClickCurrent.current) {
      map.un("singleclick", onMapClickCurrent.current);
    }
    onMapClickCurrent.current = async function (evt) {
      onMapClick(map, evt, setPopupContent, popupCurrent.current);
    };
    map.on("singleclick", onMapClickCurrent.current);

    map.renderSync();
  }, [map, layers]);

  return (
    <>
      <MapContext.Provider value={{ map }}>
        <div ref={mapRef} {...customMapConfig}>
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
            {layerControl && <LayersControl />}
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

import { useEffect, useState, useRef } from "react";
import ReactDOM from "react-dom";
import { valuesEqual } from "components/modals/utilities";
import { MapContext } from "components/contexts/Contexts";
import { Map, View } from "ol";
import Overlay from "ol/Overlay";
import moduleLoader from "components/map/ModuleLoader";
import LayersControl from "components/map/LayersControl";
import LegendControl from "components/map/LegendControl";
import Alert from "react-bootstrap/Alert";
import styled from "styled-components";
import { applyStyle } from "ol-mapbox-style";
import { FaTimes } from "react-icons/fa";
import PropTypes from "prop-types";

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
  color: black;
`;

const StyledContent = styled.div`
  padding-top: 1rem;
`;

const MapComponent = ({
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
    // Set up an initial map and set it to state/ref
    const initialMap = new Map({
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
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    // Update the map view if new viewConfig
    const customViewConfig = { ...defaultViewConfig, ...viewConfig };
    if (!viewRef.current || !valuesEqual(viewRef.current, customViewConfig)) {
      mapRef.current.setView(new View(customViewConfig));
      viewRef.current = customViewConfig;
    }
    // eslint-disable-next-line
  }, [viewConfig]);

  useEffect(() => {
    setErrorMessage(null);
    const updateLayers = async () => {
      // Remove current map layers so new ones can be added
      const mapDerivedLayers = [...mapRef.current.getLayers().getArray()];
      mapDerivedLayers.forEach((mapLayer) =>
        mapRef.current.removeLayer(mapLayer)
      );

      // setup constants for handling new layers
      const customLayers = layers ?? [];
      let failedLayers = [];

      // for each layer, load the layer instance, add it to the map, and style if needed
      await Promise.all(
        customLayers.map(async (layerConfig) => {
          try {
            const layerInstance = await moduleLoader(layerConfig);
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
          } catch (err) {
            console.log(err);
            failedLayers.push(layerConfig.props.name);
          }
        })
      );

      // If any layers failed to load, add an error message will all the failed layers
      if (failedLayers.length > 0) {
        setErrorMessage(
          `Failed to load the "${failedLayers.join(", ")}" layer(s)`
        );
      }

      // setup popup with new layers. This is done so that the variable
      // and states in the passed popup are updated and not stale
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

      // setup click event with new layers. This is done so that the variable
      // and states in the passed function are updated and not stale
      if (onMapClickCurrent.current) {
        mapRef.current.un("singleclick", onMapClickCurrent.current);
      }
      onMapClickCurrent.current = async function (evt) {
        onMapClick(mapRef.current, evt, setPopupContent, popupCurrent.current);
      };
      mapRef.current.on("singleclick", onMapClickCurrent.current);

      // update the layerControlUpdate so that the layer controls are triggered to rerender with the new layers
      setLayerControlUpdate(!layerControlUpdate);

      // sync map with changes
      mapRef.current.renderSync();
    };

    updateLayers();
    // eslint-disable-next-line
  }, [layers]);

  return (
    <>
      <MapContext.Provider value={{ map }}>
        <div aria-label="Map Div" ref={mapDivRef} {...customMapConfig}>
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
            {legend && <LegendControl legendItems={legend} />}
          </div>
        </div>
        <OverLayContentWrapper
          aria-label="Map Popup"
          id="map-popup"
          className="map-popup"
          ref={popupRef}
        >
          <StyledCloser
            href="#"
            id="popup-closer"
            className="ol-popup-closer"
            aria-label="Popup Closer"
            onClick={() => {
              popupCurrent.current.setPosition(undefined);
              setPopupContent(null);
            }}
          >
            <FaTimes />
          </StyledCloser>
          <StyledContent aria-label="Map Popup Content" id="popup-content">
            {popupContent &&
              ReactDOM.createPortal(popupContent, popupRef.current)}
          </StyledContent>
        </OverLayContentWrapper>
      </MapContext.Provider>
    </>
  );
};

MapComponent.propTypes = {
  mapConfig: PropTypes.object, // div element properties for the map
  viewConfig: PropTypes.object, // keys can be found at https://openlayers.org/en/latest/apidoc/module-ol_View-View.html
  layers: PropTypes.arrayOf(
    PropTypes.shape({
      configuration: PropTypes.shape({
        type: PropTypes.string.isRequired, // openlayers layer type
        props: PropTypes.shape({
          name: PropTypes.string.isRequired, // name of the layer
          source: PropTypes.shape({
            type: PropTypes.string.isRequired, // openlayers source type
            props: PropTypes.shape({
              url: PropTypes.string.isRequired, // openlayers source url
            }),
          }),
        }),
      }),
    })
  ),
  legend: PropTypes.arrayOf(
    PropTypes.shape({
      title: PropTypes.string, // Title for layer legend
      items: PropTypes.arrayOf(
        PropTypes.shape({
          label: PropTypes.string, // Label for legend item
          color: PropTypes.string, // Color for legend item
          symbol: PropTypes.string, // Symbol for legend item
        })
      ),
    })
  ),
  layerControl: PropTypes.bool, // deterimines if a layer control menu should be present
  onMapClick: PropTypes.func, // function for when user click on the map
  visualizationRef: PropTypes.shape({ current: PropTypes.any }), // react ref pointing to the ol Map
};

export default MapComponent;

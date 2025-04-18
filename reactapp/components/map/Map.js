import { memo, useEffect, useState, useRef } from "react";
import { valuesEqual } from "components/modals/utilities";
import { Map, View } from "ol";
import moduleLoader from "components/map/ModuleLoader";
import LayersControl from "components/map/LayersControl";
import LegendControl from "components/map/LegendControl";
import {
  legendPropType,
  configurationPropType,
} from "components/map/utilities";
import Alert from "react-bootstrap/Alert";
import styled from "styled-components";
import { applyStyle } from "ol-mapbox-style";
import PropTypes from "prop-types";

const StyledAlert = styled(Alert)`
  position: absolute;
  top: 1rem;
  left: 1rem;
  right: 1rem;
  z-index: 1000;
`;

const MapComponent = ({
  mapConfig,
  viewConfig,
  layers,
  legend,
  layerControl,
  onMapClick,
  visualizationRef,
}) => {
  const [errorMessage, setErrorMessage] = useState("");
  const [layerControlUpdate, setLayerControlUpdate] = useState();
  const viewRef = useRef();
  const mapDivRef = useRef();
  const onMapClickCurrent = useRef();

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
    if (mapDivRef.current) {
      const initialMap = new Map({
        target: mapDivRef.current,
        view: new View(defaultViewConfig),
        layers: [],
        controls: [],
        overlays: [],
      });

      visualizationRef.current = initialMap;
    }

    return () => {
      if (visualizationRef.current) {
        visualizationRef.current.setTarget(undefined);
        visualizationRef.current = null;
      }
    };
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    // Update the map view if new viewConfig
    const customViewConfig = { ...defaultViewConfig, ...viewConfig };
    if (!viewRef.current || !valuesEqual(viewRef.current, customViewConfig)) {
      visualizationRef.current.setView(new View(customViewConfig));
      viewRef.current = customViewConfig;
    }
    // eslint-disable-next-line
  }, [viewConfig]);

  useEffect(() => {
    setErrorMessage(null);
    const updateLayers = async () => {
      // Remove current map layers so new ones can be added
      const mapDerivedLayers = [
        ...visualizationRef.current.getLayers().getArray(),
      ];
      mapDerivedLayers.forEach((mapLayer) =>
        visualizationRef.current.removeLayer(mapLayer)
      );

      // setup constants for handling new layers
      const customLayers = layers ?? [];
      let failedLayers = [];

      // for each layer, load the layer instance, add it to the map, and style if needed
      await Promise.all(
        customLayers.map(async (layerConfig) => {
          try {
            const layerInstance = await moduleLoader(
              layerConfig,
              visualizationRef.current.getView().getProjection().getCode()
            );
            visualizationRef.current.addLayer(layerInstance);
            if (layerConfig.style) {
              await applyStyle(
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

      if (visualizationRef.current) {
        // setup click event with new layers. This is done so that the variable
        // and states in the passed function are updated and not stale
        if (onMapClickCurrent.current) {
          visualizationRef.current.un("singleclick", onMapClickCurrent.current);
        }
        onMapClickCurrent.current = async function (evt) {
          onMapClick(visualizationRef.current, evt);
        };
        visualizationRef.current.on("singleclick", onMapClickCurrent.current);

        // update the layerControlUpdate so that the layer controls are triggered to rerender with the new layers
        setLayerControlUpdate(!layerControlUpdate);

        // sync map with changes
        visualizationRef.current.renderSync();
      }
    };

    updateLayers();
    // eslint-disable-next-line
  }, [layers]);

  return (
    <>
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
          {layerControl && (
            <LayersControl
              visualizationRef={visualizationRef}
              updater={layerControlUpdate}
            />
          )}
          {legend && legend.length > 0 && (
            <LegendControl legendItems={legend} />
          )}
        </div>
      </div>
    </>
  );
};

MapComponent.propTypes = {
  mapConfig: PropTypes.object, // div element properties for the map
  viewConfig: PropTypes.object, // keys can be found at https://openlayers.org/en/latest/apidoc/module-ol_View-View.html
  layers: PropTypes.arrayOf(
    PropTypes.shape({
      configuration: configurationPropType,
    })
  ),
  legend: PropTypes.arrayOf(legendPropType),
  layerControl: PropTypes.bool, // deterimines if a layer control menu should be present
  onMapClick: PropTypes.func, // function for when user click on the map
  visualizationRef: PropTypes.shape({ current: PropTypes.any }), // react ref pointing to the ol Map
};

export default memo(MapComponent);

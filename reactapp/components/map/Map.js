import { memo, useEffect, useState, useRef, useContext } from "react";
import { Map, View } from "ol";
import moduleLoader from "components/map/ModuleLoader";
import LayersControl from "components/map/LayersControl";
import LegendControl from "components/map/LegendControl";
import DrawInteractions from "components/map/DrawInteractions";
import {
  legendPropType,
  configurationPropType,
  mapDrawingPropType,
} from "components/map/utilities";
import Alert from "react-bootstrap/Alert";
import styled from "styled-components";
import { applyStyle } from "ol-mapbox-style";
import PropTypes from "prop-types";
import { useMapContext } from "components/contexts/MapContext";
import { fromExtent } from "ol/geom/Polygon";
import { VariableInputsContext } from "components/contexts/Contexts";
import GeoJSON from "ol/format/GeoJSON";

const StyledAlert = styled(Alert)`
  position: absolute;
  top: 1rem;
  left: 1rem;
  right: 1rem;
  z-index: 1000;
`;

const InfoDiv = styled.div`
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(255, 255, 255, 0.8);
  padding: 4px 8px;
  font-size: 12px;
  border-radius: 4px;
  z-index: 1000;
`;

const MapComponent = ({
  mapConfig,
  mapExtent,
  layers,
  legend,
  layerControl,
  mapDrawing,
  drawing,
  onMapClick,
  visualizationRef,
  dataviewerViz,
}) => {
  const [errorMessage, setErrorMessage] = useState("");
  const [layerControlUpdate, setLayerControlUpdate] = useState();
  const mapDivRef = useRef();
  const onMapClickCurrent = useRef();
  const [zoom, setZoom] = useState(4.5);
  const [lonLat, setLonLat] = useState([-10686671.12, 4721671.57]);
  const [projection, setProjection] = useState("EPSG:3857");
  const mapContext = useMapContext();
  const setMapReady = mapContext?.setMapReady;
  const mapReady = mapContext?.mapReady;
  const isFirstRender = useRef(true);
  const mapExtentVariableEvent = useRef();
  const { setVariableInputValues } = useContext(VariableInputsContext);

  const defaultMapConfig = {
    className: "ol-map",
    style: { width: "100%", height: "100%", position: "relative" },
  };
  const customMapConfig = { ...defaultMapConfig, ...mapConfig };

  const defaultViewConfig = {
    projection,
    zoom,
    center: lonLat,
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

      if (setMapReady) {
        initialMap.once("rendercomplete", () => {
          setMapReady(true);
        });
      }
    }

    if (dataviewerViz) {
      // Update coordinates on pointer move
      visualizationRef.current.on("pointermove", function (evt) {
        const coordinate = evt.coordinate;
        setLonLat(coordinate);
      });
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
    if (!mapExtent) return;

    const mapViewConfig = new View({ projection });
    setProjection(mapViewConfig.getProjection().getCode());

    const extent = mapExtent.extent.replaceAll(" ", "");
    const parts = extent.split(",").map((p) => parseFloat(p.trim()));
    if (parts.length === 3) {
      const [lon, lat, zoomLevel] = parts;
      setLonLat([lon, lat]);
      setZoom(zoomLevel);
      mapViewConfig.setZoom(zoomLevel);
      mapViewConfig.setCenter([lon, lat]);
    } else {
      mapViewConfig.fit(extent.split(","), {
        size: visualizationRef.current.getSize(),
      });
      setZoom(mapViewConfig.getZoom().toFixed(2));
      setLonLat(mapViewConfig.getCenter());
    }

    if (mapExtentVariableEvent.current) {
      visualizationRef.current.un("moveend", mapExtentVariableEvent.current);
    }

    if (mapExtent.variable) {
      visualizationRef.current.on("moveend", updateMapExtentVariable);
      mapExtentVariableEvent.current = updateMapExtentVariable;
    }

    // Update zoom on view change
    mapViewConfig.on("change:resolution", () => {
      setZoom(visualizationRef.current.getView().getZoom().toFixed(2));
    });

    visualizationRef.current.setView(mapViewConfig);
    // eslint-disable-next-line
  }, [mapExtent]);

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
            if (
              layerConfig.layerVisibility === false &&
              isFirstRender.current
            ) {
              layerInstance.setVisible(false);
            }
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
        if (onMapClick) {
          if (onMapClickCurrent.current) {
            visualizationRef.current.un(
              "singleclick",
              onMapClickCurrent.current
            );
          }
          onMapClickCurrent.current = async function (evt) {
            onMapClick(visualizationRef.current, evt);
          };
          visualizationRef.current.on("singleclick", onMapClickCurrent.current);
        }

        // update the layerControlUpdate so that the layer controls are triggered to rerender with the new layers
        setLayerControlUpdate(!layerControlUpdate);

        // sync map with changes
        visualizationRef.current.renderSync();
      }

      if (!mapReady && setMapReady) {
        setMapReady(true);
      }

      if (layers && !dataviewerViz && isFirstRender.current) {
        isFirstRender.current = false;
      }
    };

    updateLayers();
    // eslint-disable-next-line
  }, [layers]);

  const updateMapExtentVariable = (event) => {
    const view = event.map.getView();
    const extent = view.calculateExtent(event.map.getSize());
    const rectangleGeom = fromExtent(extent);
    const geojson = JSON.parse(new GeoJSON().writeGeometry(rectangleGeom));
    setVariableInputValues((previousVariableInputValues) => ({
      ...previousVariableInputValues,
      ...{
        [mapExtent.variable]: {
          projection: view.getProjection().getCode(),
          geometries: [geojson],
        },
      },
    }));
  };

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
        {dataviewerViz && (
          <InfoDiv id="info" aria-label="Info Div">
            Zoom: {zoom}
            <br></br>
            Lon: {lonLat[0].toFixed(2)}, Lat: {lonLat[1].toFixed(2)}
            <br></br>
            Projection: {projection}
          </InfoDiv>
        )}
        {mapDrawing && (
          <DrawInteractions
            mapDrawing={mapDrawing}
            visualizationRef={visualizationRef}
            drawing={drawing}
          />
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
  mapExtent: PropTypes.shape({
    extent: PropTypes.string, // minX,minY,maxX,maxY or lon,lat,zoom
    variable: PropTypes.string,
  }),
  layers: PropTypes.arrayOf(
    PropTypes.shape({
      configuration: configurationPropType,
    })
  ),
  legend: PropTypes.arrayOf(legendPropType),
  layerControl: PropTypes.bool, // deterimines if a layer control menu should be present
  onMapClick: PropTypes.func, // function for when user click on the map
  visualizationRef: PropTypes.shape({ current: PropTypes.any }), // react ref pointing to the ol Map
  dataviewerViz: PropTypes.bool, // determines if the map is in the dataviewer so that it doesnt affect the main map
  mapDrawing: mapDrawingPropType,
  drawing: PropTypes.shape({ current: PropTypes.bool }),
};

export default memo(MapComponent);

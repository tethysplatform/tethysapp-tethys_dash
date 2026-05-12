import { memo, useEffect, useState, useRef, useContext } from "react";
import { Map, View } from "ol";
import moduleLoader, {
  createJsonStyleFunction,
} from "components/map/ModuleLoader";
import LayersControl from "components/map/LayersControl";
import LegendControl from "components/map/LegendControl";
import DrawInteractions from "components/map/DrawInteractions";
import ExtentInteraction from "components/map/ExtentInteraction";
import {
  legendPropType,
  configurationPropType,
  mapDrawingPropType,
  updateOlLayerProps,
  wrapMercatorX,
} from "components/map/utilities";
import Alert from "react-bootstrap/Alert";
import styled from "styled-components";
import { applyStyle } from "ol-mapbox-style";
import PropTypes from "prop-types";
import { useMapContext } from "components/contexts/MapContext";
import { fromExtent } from "ol/geom/Polygon";
import { transformExtent } from "ol/proj";
import { VariableInputsContext } from "components/contexts/Contexts";
import GeoJSON from "ol/format/GeoJSON";
import { valuesEqual } from "components/modals/utilities";

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
  runtimeLayerState,
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
  const currentLayers = useRef([]);
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
    // Set up an initial map and set it to state/
    // istanbul ignore next
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
        // istanbul ignore next
        initialMap.once("rendercomplete", () => {
          // istanbul ignore next
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
      // istanbul ignore next
      if (visualizationRef.current) {
        visualizationRef.current.setTarget(undefined);
        visualizationRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ref to track last applied mapExtent string
  const lastAppliedExtentRef = useRef(null);

  useEffect(() => {
    if (!mapExtent) return;

    let extent;
    try {
      extent = mapExtent.extent.extent.replaceAll(" ", "");
    } catch {
      try {
        extent = mapExtent.extent.replaceAll(" ", "");
      } catch {
        extent = mapExtent.replaceAll(" ", "");
      }
    }

    // Only update if extent is different from last applied
    if (lastAppliedExtentRef.current === extent) {
      return;
    }
    lastAppliedExtentRef.current = extent;

    const mapViewConfig = new View({ projection });
    setProjection(mapViewConfig.getProjection().getCode());

    const parts = extent.split(",").map((p) => parseFloat(p.trim()));
    if (parts.length === 3) {
      const [lon, lat, zoomLevel] = parts;
      const centerX =
        mapViewConfig.getProjection().getCode() === "EPSG:3857"
          ? wrapMercatorX(lon)
          : lon;
      setLonLat([centerX, lat]);
      setZoom(zoomLevel);
      mapViewConfig.setZoom(zoomLevel);
      mapViewConfig.setCenter([centerX, lat]);
    } else {
      mapViewConfig.fit(extent.split(",").map(Number), {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapExtent]);

  useEffect(() => {
    setErrorMessage(null);
    const updateLayers = async () => {
      const map = visualizationRef.current;
      const currentMapLayers = map.getLayers().getArray();

      // Clean up layers: determine which to keep and which to remove
      const layersToKeep = [];
      const layersToRemove = [];
      // Runtime-VectorLayers kept via the identity branch may have their
      // cosmetic props updated (opacity, name, zoom bounds) after the keep
      // decision. Collect those here and apply after the loop so the in-place
      // update doesn't interfere with layersToKeep membership checks.
      const runtimeLayerUpdates = [];

      if (currentLayers.current.length) {
        const newLayerProps = (layers ?? []).map((l) => l.props);

        // Build a map of incoming runtime-layer ids → {props, count} so we
        // can detect duplicate-layerId collisions (e.g., from layer-paste).
        // When duplicates exist, both are rebuilt and a console warning is
        // logged so authors notice the identity breakage.
        const incomingRuntimeIds = new Map();
        (layers ?? []).forEach((l) => {
          const id = l?.props?.layerId;
          const plug = l?.props?.pluginSource;
          if (id && plug) {
            const existing = incomingRuntimeIds.get(id);
            if (existing) {
              existing.count += 1;
            } else {
              incomingRuntimeIds.set(id, { props: l.props, count: 1 });
            }
          }
        });

        currentLayers.current.forEach((currentLayer) => {
          const isRuntime =
            currentLayer?.props?.pluginSource &&
            currentLayer?.props?.layerId &&
            currentLayer.type === "VectorLayer";

          if (isRuntime) {
            const incoming = incomingRuntimeIds.get(currentLayer.props.layerId);
            if (
              incoming &&
              incoming.count === 1 &&
              incoming.props.pluginSource?.source ===
                currentLayer.props.pluginSource?.source
            ) {
              // Identity match: preserve the OL layer. Track cosmetic props
              // to propagate after the loop. Use the INCOMING name for the
              // layersToKeep tracker so the add/update loop's
              // `if (layersToKeep.includes(name))` guard skips the new config.
              layersToKeep.push(incoming.props.name);
              runtimeLayerUpdates.push({
                layerId: currentLayer.props.layerId,
                oldName: currentLayer.props.name,
                newProps: incoming.props,
              });
              return;
            }
            if (incoming && incoming.count > 1) {
              console.warn(
                `Multiple runtime layers share layerId "${currentLayer.props.layerId}"; ` +
                  "rebuilding all of them to avoid identity collision. " +
                  "Ensure layerId is regenerated on duplicate/import.",
              );
            }
            // Otherwise (no incoming match, pluginSource changed, duplicate
            // layerId) fall through and let the layer be torn down + rebuilt.
          }

          const shouldKeep =
            newLayerProps.some((newProps) =>
              valuesEqual(newProps, currentLayer.props),
            ) && currentLayer.type !== "VectorLayer";
          if (shouldKeep) {
            layersToKeep.push(currentLayer.props.name);
          }
        });

        const keptRuntimeLayerIds = new Set(
          runtimeLayerUpdates.map((u) => u.layerId),
        );
        currentMapLayers.forEach((layer) => {
          const layerName = layer.get("name");
          const layerId = layer.get("layerId");
          if (layerId && keptRuntimeLayerIds.has(layerId)) {
            return;
          }
          if (!layersToKeep.includes(layerName)) {
            layersToRemove.push(layer);
          }
        });

        // Apply cosmetic prop changes to preserved runtime OL instances.
        runtimeLayerUpdates.forEach(({ layerId, newProps }) => {
          const olLayer = currentMapLayers.find(
            (l) => l.get("layerId") === layerId,
          );
          if (olLayer) {
            updateOlLayerProps(olLayer, newProps);
          }
        });
      }

      // setup constants for handling new layers
      const customLayers = layers ?? [];
      let failedLayers = [];

      // Add or update layers in parallel
      const layerLoadPromises = [];
      await Promise.all(
        customLayers.map(async (layerConfig) => {
          const name = layerConfig.props?.name;
          if (layersToKeep.includes(name)) {
            return;
          }

          try {
            const newLayer = await moduleLoader(
              layerConfig,
              map.getView().getProjection().getCode(),
            );
            newLayer.set("name", name);

            // Tag runtime-layer identity on the OL instance so the
            // identity-based shouldKeep branch can find this layer on the
            // next reconciliation (and so updateOlLayerProps can re-sync the
            // tags if the author renames the layer).
            if (layerConfig.props?.layerId) {
              newLayer.set("layerId", layerConfig.props.layerId);
            }
            if (layerConfig.props?.pluginSource) {
              newLayer.set("pluginSource", layerConfig.props.pluginSource);
            }

            if (
              layerConfig.layerVisibility === false &&
              isFirstRender.current
            ) {
              newLayer.setVisible(false);
            }

            const replacesExisting = layersToRemove.some(
              (old) => old.get("name") === name,
            );
            if (replacesExisting) {
              const source = newLayer.getSource?.();
              const isTileSource =
                source && typeof source.getTile === "function";
              const isImageSource =
                source && typeof source.getImage === "function";

              if (isTileSource || isImageSource) {
                const loadPromise = new Promise((resolve) => {
                  const loadEndEvent = isTileSource
                    ? "tileloadend"
                    : "imageloadend";
                  const loadErrEvent = isTileSource
                    ? "tileloaderror"
                    : "imageloaderror";

                  let resolved = false;
                  const done = () => {
                    if (!resolved) {
                      resolved = true;
                      resolve();
                    }
                  };

                  source.once(loadEndEvent, done);
                  source.once(loadErrEvent, done);
                  // Safety timeout so we don't wait forever
                  setTimeout(done, 5000);
                });
                layerLoadPromises.push(loadPromise);
              }
            }

            map.addLayer(newLayer);

            if (
              layerConfig.type === "WebGLTile" &&
              layerConfig.props?.source?.type === "GeoTIFF"
            ) {
              const geoTIFFSource = newLayer.getSource();

              let errorSurfaced = false;
              const surface = (phase) => (evt) => {
                if (errorSurfaced) return;
                errorSurfaced = true;
                const detail = evt?.error?.message || evt?.message || "";
                const looksLikeFetchFailure =
                  /request failed|AggregateError|CORS|blocked|Failed to fetch/i.test(
                    detail,
                  );
                const message = looksLikeFetchFailure
                  ? `GeoTIFF layer "${name}" failed to fetch the file. ` +
                    `Check the Network tab — likely causes: CORS headers ` +
                    `missing on the hosting server, no HTTP Range support, ` +
                    `or the URL is unreachable. Detail: ${detail}.`
                  : `GeoTIFF layer "${name}" failed (${phase}). ` +
                    (detail ? `Detail: ${detail}. ` : "") +
                    `The file may not be a Cloud Optimized GeoTIFF. ` +
                    `Try converting with ` +
                    `\`gdal_translate -of COG -co COMPRESS=DEFLATE -co PREDICTOR=YES input.tif output.tif\`.`;
                setErrorMessage(message);
                console.warn(
                  `GeoTIFF layer "${name}" (${phase}):`,
                  evt?.error ?? evt,
                );
              };
              geoTIFFSource.on("error", surface("source error"));
              geoTIFFSource.on("tileloaderror", surface("tile load error"));

              try {
                const viewOptions = await geoTIFFSource.getView();
                const mapSize = map.getSize();
                const prevView = map.getView();
                const prevProjection = prevView.getProjection();
                const newProjection = viewOptions.projection;
                const tifExtent = viewOptions.extent;

                const haveMapSize =
                  Array.isArray(mapSize) &&
                  mapSize.length === 2 &&
                  mapSize[0] > 0 &&
                  mapSize[1] > 0;

                // Helper: extents [minX, minY, maxX, maxY] overlap?
                const intersects = (a, b) =>
                  !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);

                const newView = new View({
                  projection: newProjection,
                  center: viewOptions.center ?? [0, 0],
                  zoom: viewOptions.zoom ?? 0,
                });

                let targetExtent = null;
                if (haveMapSize) {
                  const prevExtent = prevView.calculateExtent(mapSize);
                  const sourceValid = prevProjection.getExtent?.();
                  const clampedPrev =
                    Array.isArray(sourceValid) && sourceValid.length === 4
                      ? [
                          Math.max(prevExtent[0], sourceValid[0]),
                          Math.max(prevExtent[1], sourceValid[1]),
                          Math.min(prevExtent[2], sourceValid[2]),
                          Math.min(prevExtent[3], sourceValid[3]),
                        ]
                      : prevExtent;

                  if (
                    clampedPrev.every(Number.isFinite) &&
                    clampedPrev[0] < clampedPrev[2] &&
                    clampedPrev[1] < clampedPrev[3]
                  ) {
                    const transformed = transformExtent(
                      clampedPrev,
                      prevProjection,
                      newProjection,
                    );
                    if (transformed.every(Number.isFinite)) {
                      const overlaps =
                        Array.isArray(tifExtent) &&
                        tifExtent.length === 4 &&
                        intersects(transformed, tifExtent);
                      targetExtent = overlaps
                        ? transformed
                        : Array.isArray(tifExtent) &&
                            tifExtent.every(Number.isFinite)
                          ? tifExtent
                          : transformed;
                    }
                  }
                }

                if (
                  !targetExtent &&
                  Array.isArray(tifExtent) &&
                  tifExtent.length === 4 &&
                  tifExtent.every(Number.isFinite)
                ) {
                  targetExtent = tifExtent;
                }

                if (targetExtent && haveMapSize) {
                  newView.fit(targetExtent, { size: mapSize });
                }
                map.setView(newView);
              } catch (err) {
                console.warn(
                  `GeoTIFF auto-fit failed for layer "${name}":`,
                  err,
                );
              }
            }

            if (layerConfig.style) {
              const isWebGLTileRampStyle =
                layerConfig.type === "WebGLTile" &&
                layerConfig.style &&
                typeof layerConfig.style === "object" &&
                !Array.isArray(layerConfig.style) &&
                "color" in layerConfig.style;

              if (isWebGLTileRampStyle) {
                newLayer.setStyle(layerConfig.style);
              } else {
                try {
                  await applyStyle(newLayer, layerConfig.style);
                } catch (err) {
                  if (
                    err.message !==
                    "Cannot read properties of undefined (reading 'crs')"
                  ) {
                    const styleFunction = createJsonStyleFunction(
                      layerConfig.style,
                    );
                    if (typeof newLayer.setStyle === "function") {
                      newLayer.setStyle(styleFunction);
                    }
                  }
                }
              }
            }
          } catch (err) {
            if (err && err.message === "GeoTIFFEmptySources") {
              return;
            }
            console.log(err);
            failedLayers.push(name);
          }
        }),
      );

      if (layerLoadPromises.length > 0) {
        await Promise.all(layerLoadPromises);
      }

      // Remove layers that are no longer needed
      layersToRemove.forEach((layer) => {
        map.removeLayer(layer);
      });

      if (failedLayers.length > 0) {
        setErrorMessage(
          `Failed to load the "${failedLayers.join(", ")}" layer(s)`,
        );
      }

      // istanbul ignore next
      if (visualizationRef.current) {
        // setup click event with new layers. This is done so that the variable
        // and states in the passed function are updated and not stale
        if (onMapClick) {
          if (onMapClickCurrent.current) {
            visualizationRef.current.un(
              "singleclick",
              onMapClickCurrent.current,
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

      currentLayers.current = layers ?? [];
    };

    updateLayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        {mapContext?.extentDrawMode && (
          <ExtentInteraction visualizationRef={visualizationRef} />
        )}
        {layerControl && (
          <LayersControl
            visualizationRef={visualizationRef}
            updater={layerControlUpdate}
            runtimeLayerState={runtimeLayerState}
          />
        )}
        {legend && legend.length > 0 && <LegendControl legendItems={legend} />}
      </div>
    </>
  );
};

MapComponent.propTypes = {
  mapConfig: PropTypes.object, // div element properties for the map
  mapExtent: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.shape({
      extent: PropTypes.string, // e.g., "minX,minY,maxX,maxY" or "lon,lat,zoom"
      variable: PropTypes.string,
    }),
  ]),
  layers: PropTypes.arrayOf(
    PropTypes.shape({
      configuration: configurationPropType,
    }),
  ),
  legend: PropTypes.arrayOf(legendPropType),
  layerControl: PropTypes.bool, // deterimines if a layer control menu should be present
  onMapClick: PropTypes.func, // function for when user click on the map
  visualizationRef: PropTypes.shape({ current: PropTypes.any }), // react ref pointing to the ol Map
  dataviewerViz: PropTypes.bool, // determines if the map is in the dataviewer so that it doesnt affect the main map
  mapDrawing: mapDrawingPropType,
  drawing: PropTypes.shape({ current: PropTypes.bool }),
  // Runtime dynamic_map_layer state bundle: errors keyed by layerId, retry
  // action, plus sessionNonce + gridItemUuid for building composite WebSocket
  // requestIds (Unit 3/5). Undefined for dataviewer / legacy maps — LayersControl
  // handles absence gracefully.
  runtimeLayerState: PropTypes.shape({
    errorsByLayerId: PropTypes.object,
    retry: PropTypes.func,
    sessionNonce: PropTypes.string,
    gridItemUuid: PropTypes.string,
  }),
};

export default memo(MapComponent);

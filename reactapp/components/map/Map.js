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
      setLonLat([lon, lat]);
      setZoom(zoomLevel);
      mapViewConfig.setZoom(zoomLevel);
      mapViewConfig.setCenter([lon, lat]);
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
      if (currentLayers.current.length) {
        const newLayerProps = (layers ?? []).map((l) => l.props);
        currentLayers.current.forEach((currentLayer) => {
          const shouldKeep =
            newLayerProps.some((newProps) =>
              valuesEqual(newProps, currentLayer.props),
            ) && currentLayer.type !== "VectorLayer";
          if (shouldKeep) {
            layersToKeep.push(currentLayer.props.name);
          }
        });

        // Remove layers from the map that are not in layersToKeep
        currentMapLayers.forEach((layer) => {
          const layerName = layer.get("name");
          if (!layersToKeep.includes(layerName)) {
            layersToRemove.push(layer);
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

            if (
              layerConfig.layerVisibility === false &&
              isFirstRender.current
            ) {
              newLayer.setVisible(false);
            }

            // Wait for the new layer to finish loading before removing
            // the old layer it replaces. This prevents flickering during
            // animated layer transitions (e.g., Array slider cycling
            // through image URLs). Only applies when replacing a layer
            // with an updated version of itself (same name), not when
            // swapping structurally different layers.
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

            // GeoTIFF auto-fit: ol/source/GeoTIFF returns raw data tiles, not
            // pre-rendered image tiles — client-side reprojection across
            // projections isn't supported. When a COG is not in EPSG:3857 (or
            // whatever the current view uses), the only way to see it is to
            // set the map view to one derived from the source. Last-added
            // GeoTIFF wins if multiple are present in different projections.
            if (
              layerConfig.type === "WebGLTile" &&
              layerConfig.props?.source?.type === "GeoTIFF"
            ) {
              const geoTIFFSource = newLayer.getSource?.();

              // Surface failures in the UI. geotiff.js can throw on unsupported
              // compression, unusual bit depths, BigTIFF variants, or tile-fetch
              // failures (CORS, 404). There are TWO failure phases we need to
              // listen for:
              //   1. `error` — metadata/header parse fails, or the initial
              //      source setup throws. Fires BEFORE tile requests start.
              //   2. `tileloaderror` — a specific tile fails to decode or
              //      fetch. Fires during rendering.
              // Without both listeners, failures in phase 1 are silent (no
              // tile requests happen, so phase 2 never fires either).
              // Throttle to one alert per layer to avoid N-tile spam.
              if (geoTIFFSource && typeof geoTIFFSource.on === "function") {
                let errorSurfaced = false;
                const surface = (phase) => (evt) => {
                  if (errorSurfaced) return;
                  errorSurfaced = true;
                  const detail = evt?.error?.message || evt?.message || "";
                  // Distinguish fetch/network failures from file-format
                  // failures. geotiff.js's BlockedSource bubbles up "Request
                  // failed" or "AggregateError" when byte-range requests
                  // fail (CORS, no Range support, 404, etc.). Different
                  // remediation than a format issue.
                  const looksLikeFetchFailure =
                    /request failed|AggregateError|CORS|blocked|Failed to fetch/i.test(
                      detail,
                    );
                  const message = looksLikeFetchFailure
                    ? `GeoTIFF layer "${name}" failed to fetch the file. ` +
                      `Check the Network tab — likely causes: CORS headers ` +
                      `missing on the hosting server, no HTTP Range support, ` +
                      `or the URL is unreachable.` +
                      (detail ? ` Detail: ${detail}.` : "")
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
              }

              if (
                geoTIFFSource &&
                typeof geoTIFFSource.getView === "function"
              ) {
                try {
                  const viewOptions = await geoTIFFSource.getView();
                  // Goal: switch the view's projection to the TIF's (so
                  // tiles can render), but show the same geographic area
                  // the user was already viewing. Falls back to the TIF's
                  // own extent only when the previous view doesn't overlap
                  // the TIF's footprint (otherwise user would stare at
                  // empty space outside the data).
                  //
                  // Why clamp the previous extent: if the user is zoomed
                  // out, calculateExtent can return values beyond the
                  // source projection's valid range (e.g., longitudes
                  // > 180° in EPSG:3857 world copies). Transforming those
                  // produces non-primary world-copy coordinates in the
                  // target projection, where the TIF's tiles don't exist —
                  // user only sees pixels after panning around the world.
                  // Clamping to the source projection's valid extent keeps
                  // the transform in the primary world copy.
                  const mapSize = map.getSize();
                  const prevView = map.getView();
                  const prevProjection = prevView.getProjection();
                  const newProjection = viewOptions.projection;
                  const tifExtent = viewOptions.extent;

                  // mapSize is undefined / [0, 0] before layout (jsdom,
                  // pre-render). Skip the cross-projection extent
                  // transform in that case — anything we'd compute would
                  // be NaN-laden. Without a valid mapSize, fit() also
                  // can't run.
                  const haveMapSize =
                    Array.isArray(mapSize) &&
                    mapSize.length === 2 &&
                    mapSize[0] > 0 &&
                    mapSize[1] > 0;

                  // Helper: extents [minX, minY, maxX, maxY] overlap?
                  const intersects = (a, b) =>
                    !(
                      a[2] < b[0] ||
                      a[0] > b[2] ||
                      a[3] < b[1] ||
                      a[1] > b[3]
                    );

                  // Initialize the new View with the TIF's center/zoom if
                  // provided in viewOptions — without them, an uninitialized
                  // View can cause OL's render pipeline to short-circuit
                  // (no tiles request, no setView event handlers complete).
                  // fit() (when invoked below) will override the initial
                  // values to fit the targetExtent precisely; the defaults
                  // here just ensure the View is in a renderable state for
                  // the case where fit() is skipped (no mapSize).
                  const newView = new View({
                    projection: newProjection,
                    center: viewOptions.center ?? [0, 0],
                    zoom: viewOptions.zoom ?? 0,
                  });

                  let targetExtent = null;
                  if (haveMapSize) {
                    const prevExtent = prevView.calculateExtent(mapSize);
                    // Clamp prev extent to source projection's valid range —
                    // when the user is zoomed out, calculateExtent can
                    // return values beyond the source projection's valid
                    // range (e.g., longitudes > 180° in EPSG:3857 world
                    // copies). Transforming those produces non-primary
                    // world-copy coordinates in the target projection.
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
                        // Use the transformed previous extent if it overlaps
                        // the TIF's data extent. If not (TIF is far from
                        // where the user was looking), fall back to the
                        // TIF's footprint so user sees something instead of
                        // empty space.
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

                  // Fall through to the TIF's own extent if the prev
                  // extent was unusable.
                  if (
                    !targetExtent &&
                    Array.isArray(tifExtent) &&
                    tifExtent.length === 4 &&
                    tifExtent.every(Number.isFinite)
                  ) {
                    targetExtent = tifExtent;
                  }

                  // fit() requires a valid mapSize. If we don't have one
                  // (jsdom, pre-layout), set the view without fitting —
                  // OL will use the View's default center/zoom, and fit
                  // will happen naturally on the first real render once
                  // the map has dimensions.
                  if (targetExtent && haveMapSize) {
                    newView.fit(targetExtent, { size: mapSize });
                  }
                  map.setView(newView);
                } catch (err) {
                  // A failure here (e.g., the COG header couldn't be read
                  // before view derivation) leaves the existing view in place.
                  // The layer simply won't render until the user corrects the
                  // source or the view.
                  console.warn(
                    `GeoTIFF auto-fit failed for layer "${name}":`,
                    err,
                  );
                }
              }
            }

            if (layerConfig.style) {
              // WebGLTile layers (GeoTIFF + ramp) carry a `style.color`
              // shader expression object that ol-mapbox-style's applyStyle
              // cannot consume. Apply via setStyle directly and skip the
              // applyStyle pipeline entirely.
              const isWebGLTileRampStyle =
                layerConfig.type === "WebGLTile" &&
                layerConfig.style &&
                typeof layerConfig.style === "object" &&
                !Array.isArray(layerConfig.style) &&
                "color" in layerConfig.style;

              if (isWebGLTileRampStyle) {
                if (typeof newLayer.setStyle === "function") {
                  newLayer.setStyle(layerConfig.style);
                }
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
            // Soft render guard: a GeoTIFF layer with an empty sources[]
            // array is an in-progress authoring state, not an error. Silently
            // skip so "failedLayers" doesn't surface a misleading warning.
            if (err && err.message === "GeoTIFFEmptySources") {
              return;
            }
            console.log(err);
            failedLayers.push(name);
          }
        }),
      );

      // Wait for new layers to load before removing old ones to prevent
      // flickering. Falls through immediately if no load promises exist.
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
};

export default memo(MapComponent);

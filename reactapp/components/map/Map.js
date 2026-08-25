import { memo, useEffect, useState, useRef, useContext } from "react";
import { Map, View } from "ol";
import moduleLoader, {
  applyAutoRamp,
  createJsonStyleFunction,
} from "components/map/ModuleLoader";
// Importing this registers the coordinate reference systems that layers name by
// code. Module evaluation completes before any render, so registration is in
// place before the layer effect below constructs a single source -- which
// matters, because layers are constructed concurrently and a registration that
// waited on anything async would race them.
import { isNativelyResolvable } from "components/map/projections";
import { CANCEL_REASON, errorKindFor } from "components/map/layerStatus";
import LayersControl from "components/map/LayersControl";
import FloatingMapControl from "components/map/FloatingMapControl";
import LegendControl from "components/map/LegendControl";
import DrawInteractions from "components/map/DrawInteractions";
import ExtentInteraction from "components/map/ExtentInteraction";
import {
  legendPropType,
  configurationPropType,
  mapDrawingPropType,
  reprojectVectorFeatures,
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

// Pinned on both sides, so the anchor spans the map's width and the floated copy
// inherits it. Same stacking-context escape as the legend and layer control.
const AlertAnchor = styled(FloatingMapControl)`
  position: absolute;
  top: 1rem;
  left: 1rem;
  right: 1rem;
`;
const ALERT_EDGES = ["top", "left", "right"];

const StyledAlert = styled(Alert)`
  margin: 0;
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

// Apply a layer config's style to an OL layer.
//
// Extracted from the add path so a *preserved* layer can be restyled too.
// Preservation keeps the layer instance, and the cosmetic prop sync handles only
// the props OL has first-class setters for -- so without this, editing a
// preserved layer's style rules would change nothing on the map.
async function applyLayerStyle(olLayer, layerConfig) {
  if (!layerConfig.style) return;

  const isWebGLTileRampStyle =
    layerConfig.type === "WebGLTile" &&
    layerConfig.style &&
    typeof layerConfig.style === "object" &&
    !Array.isArray(layerConfig.style) &&
    "color" in layerConfig.style;

  if (isWebGLTileRampStyle) {
    olLayer.setStyle(layerConfig.style);
    return;
  }

  try {
    await applyStyle(olLayer, layerConfig.style);
  } catch (err) {
    if (err.message !== "Cannot read properties of undefined (reading 'crs')") {
      const styleFunction = createJsonStyleFunction(layerConfig.style);
      if (typeof olLayer.setStyle === "function") {
        olLayer.setStyle(styleFunction);
      }
    }
  }
}

// Mirror a shapefile source's load state into React state so it can be
// rendered. The events are the only signal available: featuresloaderror carries
// no payload, so the typed failure is read off the controller when it fires.
function watchShapefileLoad(olLayer, layerName, setStatus) {
  const source = olLayer?.getSource?.();
  const controller = source?.get?.("shapefileController");
  if (!controller) return;

  const sync = () => {
    const failure = controller.getError();
    setStatus((previous) => ({
      ...previous,
      [layerName]: {
        state: controller.getStatus(),
        message: failure?.detail ?? null,
        kind: failure ? errorKindFor(failure) : null,
      },
    }));
  };

  source.on("featuresloadstart", sync);
  source.on("featuresloadend", sync);
  source.on("featuresloaderror", sync);
}

// Stop an in-flight shapefile load. Called when the layer is going away, so the
// fetch and decompression do not keep running for a layer nobody will see.
function abortShapefileLoad(olLayer, reason) {
  olLayer?.getSource?.()?.get?.("shapefileController")?.abort?.(reason);
}

const MapComponent = ({
  mapConfig,
  mapExtent,
  layers,
  legend,
  layerControl,
  mapDrawing,
  drawing,
  onMapClick,
  onMapHover,
  onMapMoveEnd,
  visualizationRef,
  dataviewerViz,
  runtimeLayerState,
}) => {
  const [errorMessage, setErrorMessage] = useState("");
  // Per-layer load state for client-parsed sources, keyed on layer name.
  // Mirrored into React state purely so it can be rendered; the source's own
  // controller remains the authority.
  const [shapefileStatus, setShapefileStatus] = useState({});
  const [layerControlUpdate, setLayerControlUpdate] = useState();
  const mapDivRef = useRef();
  const onMapClickCurrent = useRef();
  const onMapHoverCurrent = useRef();
  const onMapMoveEndCurrent = useRef();
  const onMapMoveEndPrimed = useRef(false);
  const [zoom, setZoom] = useState(4.5);
  const [lonLat, setLonLat] = useState([-10686671.12, 4721671.57]);
  const [projection, setProjection] = useState("EPSG:3857");
  const mapContext = useMapContext();
  const setMapReady = mapContext?.setMapReady;
  const mapReady = mapContext?.mapReady;
  const isFirstRender = useRef(true);
  const mapExtentVariableEvent = useRef();
  const currentLayers = useRef([]);
  const layerSyncToken = useRef(0);
  const activeFadeRef = useRef(null);
  const { setVariableInputValues } = useContext(VariableInputsContext);

  // Fade the incoming layers in over `duration` ms, then remove the outgoing
  // ones, so a storm swap dissolves instead of flashing. Any running fade is
  // finalized first so overlapping swaps don't leave a layer mid-fade.
  const crossfadeLayers = (map, incoming, outgoing, duration) => {
    if (activeFadeRef.current) activeFadeRef.current();
    const start = Date.now();
    let rafId = null;
    const finalize = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      incoming.forEach(({ layer, opacity }) => layer.setOpacity(opacity));
      outgoing.forEach((layer) => map.removeLayer(layer));
      activeFadeRef.current = null;
    };
    const step = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      incoming.forEach(({ layer, opacity }) => layer.setOpacity(opacity * t));
      if (t < 1) rafId = requestAnimationFrame(step);
      else finalize();
    };
    activeFadeRef.current = finalize;
    rafId = requestAnimationFrame(step);
  };

  // Surfaced here rather than only in the layers control, which is opt-in per
  // dashboard and collapsed to an icon by default. Routing status only there
  // would leave a viewer with nothing at all on any dashboard whose author
  // disabled it -- and a failure that renders as a blank layer is the one thing
  // this must not do. The layers control still carries the richer per-layer
  // detail when it is enabled.
  const shapefileEntries = Object.entries(shapefileStatus);
  const shapefileFailures = shapefileEntries.filter(
    ([, status]) => status.state === "error",
  );
  const shapefileLoading = shapefileEntries.filter(
    ([, status]) => status.state === "loading",
  );
  const shapefileAlert = shapefileFailures.length
    ? {
        variant: "danger",
        message: shapefileFailures
          .map(([name, status]) => `${name}: ${status.message}`)
          .join(" "),
      }
    : shapefileLoading.length
      ? {
          variant: "info",
          message: `Loading ${shapefileLoading
            .map(([name]) => name)
            .join(", ")}\u2026`,
        }
      : null;

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
        if (activeFadeRef.current) activeFadeRef.current();
        visualizationRef.current
          .getLayers()
          .getArray()
          .forEach((layer) => abortShapefileLoad(layer, CANCEL_REASON.UNMOUNT));
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

    // Move already-mounted vector features with the view, exactly as the raster
    // auto-fit path does. Features are parsed into the view projection when they
    // are added, so replacing the view leaves them holding the outgoing
    // projection's numbers -- drawn far off screen while still reporting the
    // right feature count. This path replaces the view too, and until now had no
    // sweep: a raster auto-fit adopts a projection without updating the state
    // this view is rebuilt from, so a later extent change reverts the projection
    // underneath the features.
    const outgoingCode = visualizationRef.current
      .getView()
      .getProjection()
      .getCode();
    visualizationRef.current.setView(mapViewConfig);
    reprojectVectorFeatures(
      visualizationRef.current,
      outgoingCode,
      mapViewConfig.getProjection().getCode(),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapExtent]);

  useEffect(() => {
    setErrorMessage(null);
    const updateLayers = async () => {
      const map = visualizationRef.current;
      const currentMapLayers = map.getLayers().getArray();
      // Identify this run so a newer frame can supersede it mid-load.
      layerSyncToken.current += 1;
      const myToken = layerSyncToken.current;

      // Clean up layers: determine which to keep and which to remove
      const layersToKeep = [];
      const layersToRemove = [];
      // Runtime-VectorLayers kept via the identity branch may have their
      // cosmetic props updated (opacity, name, zoom bounds) after the keep
      // decision. Collect those here and apply after the loop so the in-place
      // update doesn't interfere with layersToKeep membership checks.
      const runtimeLayerUpdates = [];
      // Preserved shapefile layers, collected the same way. Identity is the
      // layer's name plus its resolved source URL: rebuilding refetches and
      // reparses the whole archive, which an unrelated edit -- an opacity change
      // on another layer, one frame of a raster time-slider -- should not cost.
      const shapefileLayerUpdates = [];

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

          // Additive branch: the plugin-provenance check above is left exactly
          // as it was rather than generalized, so preservation for plugin layers
          // is untouched by this.
          if (
            currentLayer?.props?.source?.type === "Shapefile" &&
            currentLayer.type === "VectorLayer"
          ) {
            const incoming = (layers ?? []).find(
              (candidate) =>
                candidate?.props?.source?.type === "Shapefile" &&
                candidate?.props?.name === currentLayer.props.name &&
                candidate?.props?.source?.props?.url ===
                  currentLayer.props.source?.props?.url,
            );
            if (incoming) {
              layersToKeep.push(incoming.props.name);
              shapefileLayerUpdates.push({
                name: incoming.props.name,
                newProps: incoming.props,
                config: incoming,
              });
              return;
            }
          }

          const shouldKeep =
            newLayerProps.some((newProps) =>
              valuesEqual(newProps, currentLayer.props),
            ) && currentLayer.type !== "VectorLayer";
          if (shouldKeep) {
            layersToKeep.push(currentLayer.props.name);
          }
        });
      }

      // The removal sweep runs whenever the map actually holds layers, not only
      // when reconciliation state was recorded. A run that starts while a
      // previous one is still loading sees no recorded state, and gating removal
      // on it would let both runs' layers sit on the map -- features drawn twice,
      // and every clicked feature reported twice in the popup. With no recorded
      // state nothing is kept, so this rebuilds rather than duplicates.
      if (currentMapLayers.length) {
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
            // Stop any load still running for a layer that is going away.
            abortShapefileLoad(layer, CANCEL_REASON.REMOVED);
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

        // Same for preserved shapefile layers -- plus the style, which the
        // cosmetic sync does not carry. Without this a style-rule edit on a
        // preserved layer would change nothing, since the style is otherwise
        // only applied when a layer is constructed.
        shapefileLayerUpdates.forEach(({ name, newProps, config }) => {
          const olLayer = currentMapLayers.find((l) => l.get("name") === name);
          if (!olLayer) return;
          updateOlLayerProps(olLayer, newProps);
          if (!valuesEqual(olLayer.get("appliedStyle"), config.style)) {
            olLayer.set("appliedStyle", config.style);
            applyLayerStyle(olLayer, config);
          }
        });
      }

      // setup constants for handling new layers
      const customLayers = layers ?? [];
      let failedLayers = [];
      // Replacement layers added hidden until painted, then revealed on swap.
      const buffered = [];

      // Add or update layers in parallel
      const layerLoadPromises = [];
      await Promise.all(
        customLayers.map(async (layerConfig) => {
          const name = layerConfig.props?.name;
          if (layersToKeep.includes(name)) {
            return;
          }

          try {
            // Resolve a Zarr layer's ramp from the slice's real value range
            // before the source is built — `normalize` is read at construction.
            await applyAutoRamp(layerConfig);

            const newLayer = await moduleLoader(
              layerConfig,
              map.getView().getProjection().getCode(),
              // Read again when features are actually inserted. A source with a
              // long async load -- a shapefile -- can finish after a sibling
              // raster's auto-fit has already changed the view, and features
              // parsed into the outgoing projection are drawn far off screen
              // while still reporting the right count.
              () => map.getView().getProjection().getCode(),
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
                // Hide via opacity, not visibility: an invisible layer never
                // renders, so it would never load its tiles. Opacity 0 keeps
                // it loading; we restore the real opacity once it has painted.
                buffered.push({
                  layer: newLayer,
                  opacity: newLayer.getOpacity(),
                });
                newLayer.setOpacity(0);
              }
            }

            // A run that has already been superseded must not add its layer:
            // it is in no newer run's removal snapshot, so it would never be
            // collected -- leaving features drawn twice and every clicked
            // feature reported twice in the popup.
            if (myToken !== layerSyncToken.current) {
              abortShapefileLoad(newLayer, CANCEL_REASON.SUPERSEDED);
              return;
            }
            newLayer.set("appliedStyle", layerConfig.style);
            map.addLayer(newLayer);
            watchShapefileLoad(newLayer, name, setShapefileStatus);

            if (
              layerConfig.type === "WebGLTile" &&
              (layerConfig.props?.source?.type === "GeoTIFF" ||
                layerConfig.props?.source?.type === "Zarr")
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
                // Features already on the map were parsed into the outgoing
                // projection, so adopting the raster's leaves them holding the
                // wrong numbers -- a UTM raster over Guatemala left Web
                // Mercator coordinates being read as UTM metres, stranding the
                // dynamic layers off screen while still reporting the right
                // feature count. Move them with the view.
                const previousCode = prevProjection.getCode();
                const adoptedCode = newView.getProjection().getCode();

                // Adopt the raster's projection as the view projection only when
                // OpenLayers resolves it on its own. Registering a definition
                // makes a previously-unresolvable raster render, but it must not
                // also start changing the view: setView publishes the adopted
                // code into the map-extent variable other visualizations consume,
                // and saved center/zoom values would be reinterpreted in the new
                // projection's units. Widening this is its own change, verified
                // against live dashboards. Such a raster still renders here --
                // by reprojection rather than natively.
                if (!isNativelyResolvable(adoptedCode)) {
                  console.warn(
                    `Not adopting "${adoptedCode}" as the view projection for layer "${name}": it resolves from a registered definition rather than natively. The layer renders by reprojection.`,
                  );
                } else {
                  map.setView(newView);
                  reprojectVectorFeatures(map, previousCode, adoptedCode);
                }
              } catch (err) {
                console.warn(
                  `GeoTIFF auto-fit failed for layer "${name}":`,
                  err,
                );
              }
            }

            await applyLayerStyle(newLayer, layerConfig);
          } catch (err) {
            if (
              err &&
              (err.message === "GeoTIFFEmptySources" ||
                err.message === "ShapefileEmptySources")
            ) {
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

      // Reveal painted replacements, then drop old layers in one frame.
      // A superseded run keeps the old layer and discards its unshown buffers,
      // so fast playback skips frames instead of flashing or stalling.
      const superseded = myToken !== layerSyncToken.current;
      if (buffered.length > 0 && superseded) {
        buffered.forEach(({ layer }) => map.removeLayer(layer));
      } else if (buffered.length > 0) {
        crossfadeLayers(map, buffered, layersToRemove, 250);
      } else {
        layersToRemove.forEach((layer) => {
          map.removeLayer(layer);
        });
      }

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

        // Mirror the click registration for hover. Re-binding on layer
        // updates keeps the handler closure over current layers/state —
        // the same staleness fix the click handler already uses.
        if (onMapHover) {
          if (onMapHoverCurrent.current) {
            visualizationRef.current.un(
              "pointermove",
              onMapHoverCurrent.current,
            );
          }
          onMapHoverCurrent.current = async function (evt) {
            onMapHover(visualizationRef.current, evt);
          };
          visualizationRef.current.on("pointermove", onMapHoverCurrent.current);
        }

        // Mirror the hover registration for the map's moveend so the snapping
        // feature cache can refresh when the view changes (pan/zoom).
        if (onMapMoveEnd) {
          if (onMapMoveEndCurrent.current) {
            visualizationRef.current.un("moveend", onMapMoveEndCurrent.current);
          }
          onMapMoveEndCurrent.current = function () {
            onMapMoveEnd(visualizationRef.current);
          };
          visualizationRef.current.on("moveend", onMapMoveEndCurrent.current);
          // Prime the cache for the initial view: this registration lives in
          // an async layer-sync effect, so the map's first moveend fires
          // before the handler is attached and snapping would stay inert
          // until the first user pan. Guarded to run once per map instance —
          // this block re-runs on every layer update and the handler issues
          // real network fetches. The prime waits for the first run that
          // actually carries layers: the very first effect pass runs before
          // the parent's layer state resolves, and live-source snap caches
          // (GeoJSON/Feature Service) need their OL layers mounted to resolve.
          if (!onMapMoveEndPrimed.current && (layers?.length ?? 0) > 0) {
            onMapMoveEndPrimed.current = true;
            onMapMoveEndCurrent.current();
          }
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

      // Only the winning run records the rendered layers, so a slow superseded
      // run can't overwrite it with a stale config.
      if (!superseded) {
        currentLayers.current = layers ?? [];

        // Drop status for layers no longer on the map, so a rebuilt layer never
        // shows the previous instance's failure -- and a stale error never
        // suppresses the replacement's loading indication.
        const liveNames = new Set(
          map
            .getLayers()
            .getArray()
            .map((layer) => layer.get("name")),
        );
        setShapefileStatus((previous) => {
          const kept = Object.fromEntries(
            Object.entries(previous).filter(([name]) => liveNames.has(name)),
          );
          return Object.keys(kept).length === Object.keys(previous).length
            ? previous
            : kept;
        });
      }
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
          <AlertAnchor edges={ALERT_EDGES}>
            <StyledAlert
              key="failure"
              variant="danger"
              dismissible={true}
              onClose={() => setErrorMessage("")}
            >
              {errorMessage}
            </StyledAlert>
          </AlertAnchor>
        )}
        {shapefileAlert && (
          <AlertAnchor edges={ALERT_EDGES}>
            <StyledAlert
              variant={shapefileAlert.variant}
              role={shapefileAlert.variant === "danger" ? "alert" : "status"}
              aria-live="polite"
            >
              {shapefileAlert.message}
            </StyledAlert>
          </AlertAnchor>
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
            shapefileStatus={shapefileStatus}
            onRetryShapefile={(layerName) => {
              const layer = visualizationRef.current
                ?.getLayers()
                .getArray()
                .find((candidate) => candidate.get("name") === layerName);
              layer?.getSource?.()?.get?.("shapefileController")?.reset?.();
            }}
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
  onMapHover: PropTypes.func, // function for when user moves the cursor over the map
  onMapMoveEnd: PropTypes.func, // function for when the map view finishes moving (pan/zoom)
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

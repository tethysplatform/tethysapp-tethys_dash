import { memo, useEffect, useMemo, useState, useRef, useContext } from "react";
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
import { isNativelyResolvable } from "components/map/projectionCodes";
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
import { unByKey } from "ol/Observable";
import {
  GridItemContext,
  TabContext,
  VariableInputsContext,
} from "components/contexts/Contexts";
import { useViewGroupContext } from "components/contexts/ViewGroupContext";
import {
  isViewGroupMember,
  readViewGroupSettings,
  viewsAreEqual,
} from "components/map/viewGroup";
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

  // Kept on the layer so teardown can find them. The status map is keyed by
  // layer name, and a rebuilt layer reuses the name -- so a source that outlives
  // its layer with these still attached is able to write under a name a
  // different source now owns.
  olLayer.set("shapefileLoadKeys", [
    source.on("featuresloadstart", sync),
    source.on("featuresloadend", sync),
    source.on("featuresloaderror", sync),
  ]);
}

// Source types that can resolve a coordinate reference out of their own data,
// so their config carries no code to inspect.
const CRS_BEARING_SOURCES = [
  "GeoTIFF",
  "Zarr",
  "Shapefile",
  "GeoPackage",
  "GeoParquet",
];

// Whether a layer could need a projection definition registered. Answered from
// the config alone, before anything is fetched, so the projection machinery is
// loaded only for the dashboards that have a layer needing it.
function needsProjectionRegistry(layerConfig) {
  const source = layerConfig?.props?.source;
  if (CRS_BEARING_SOURCES.includes(source?.type)) return true;
  const code = source?.props?.projection;
  return typeof code === "string" && code !== "" && !isNativelyResolvable(code);
}

// Detach a shapefile source's load listeners. Paired with every abort: the
// loader already declines to report anything once superseded, and this closes
// the other half by making sure nothing is listening if it ever did.
function detachShapefileLoad(olLayer) {
  const keys = olLayer?.get?.("shapefileLoadKeys");
  if (!keys) return;
  unByKey(keys);
  olLayer.unset("shapefileLoadKeys");
}

// Stop an in-flight shapefile load and stop listening to it. Called when the
// layer is going away, so the fetch and decompression do not keep running for a
// layer nobody will see.
function abortShapefileLoad(olLayer, reason) {
  olLayer?.getSource?.()?.get?.("shapefileController")?.abort?.(reason);
  detachShapefileLoad(olLayer);
}

// Snapshot a view's state for the group. The center is copied because
// OpenLayers hands back the array it holds and mutates it in place during a
// gesture, which would silently rewrite a recorded baseline.
const readViewState = (view) => {
  const center = view.getCenter();
  return {
    center: Array.isArray(center) ? [...center] : center,
    resolution: view.getResolution(),
    rotation: view.getRotation(),
  };
};

// Rotation, then resolution, then center -- OpenLayers' own internal order. A
// combined change applied in any other order paints an intermediate state. The
// three setters cost one render between them, not three: the map's render
// scheduling is idempotent within a frame.
//
// Returns whether the view actually moved. `applyTargetState_` writes each
// property only when its constrained value differs from the one already held,
// so an apply of values the view is already at notifies nothing and schedules
// no frame -- and a caller that armed a read-back for it would be waiting for
// a frame that never comes. Measured after the fact rather than against
// `next`, so a clamped apply that did move counts as a move.
const applyViewState = (view, next) => {
  const beforeCenter = view.getCenter();
  const beforeResolution = view.getResolution();
  const beforeRotation = view.getRotation();
  if (typeof next.rotation === "number") {
    view.setRotation(next.rotation);
  }
  if (typeof next.resolution === "number" && next.resolution > 0) {
    view.setResolution(next.resolution);
  }
  if (Array.isArray(next.center)) {
    view.setCenter([...next.center]);
  }
  const afterCenter = view.getCenter();
  return (
    view.getRotation() !== beforeRotation ||
    view.getResolution() !== beforeResolution ||
    !Array.isArray(beforeCenter) ||
    !Array.isArray(afterCenter) ||
    afterCenter[0] !== beforeCenter[0] ||
    afterCenter[1] !== beforeCenter[1]
  );
};

// --- Coalescing `moveend` side effects (U4) -------------------------------
// OpenLayers gates `moveend` on the ANIMATING and INTERACTING view hints only
// (`ol/Map.js` `renderFrame_`). A view-group follower is driven by bare
// `setCenter` / `setResolution` and so holds neither hint: it emits `movestart`
// and `moveend` on every rendered frame for the whole duration of a peer's
// gesture. Both consumers of that event -- the extent-variable publisher, which
// re-runs an effect on every visualization on the dashboard, and the snap-cache
// refresh, which issues un-aborted network queries -- assume a human just
// stopped moving. They are therefore held until this member's own view has been
// stable for a settle window.
//
// The window is a tuning value: the cadence it guards against is one frame,
// so anything comfortably above ~16ms coalesces a gesture, and anything a
// viewer would not perceive as lag is short enough. 150ms is both.
const MOVE_SETTLE_MS = 150;

// Exact comparison, deliberately not the view group's tolerance helper: any
// change at all means motion is still in flight, and a slow drag whose
// per-frame delta sits under half a pixel would otherwise read as settled and
// let the storm straight through.
const viewStatesIdentical = (a, b) =>
  Boolean(a) &&
  Boolean(b) &&
  a.resolution === b.resolution &&
  a.rotation === b.rotation &&
  Array.isArray(a.center) &&
  Array.isArray(b.center) &&
  a.center[0] === b.center[0] &&
  a.center[1] === b.center[1];

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
  layerPrepStatus,
}) => {
  const [errorMessage, setErrorMessage] = useState("");
  // Per-layer load state, keyed on layer name, for every source read in the
  // browser. Mirrored into React state purely so it can be rendered; for a
  // shapefile the source's own controller remains the authority. Written by the
  // construct pass below and by the watcher on the deferred feature load.
  const [layerStatus, setLayerStatus] = useState({});
  const [layerControlUpdate, setLayerControlUpdate] = useState();

  // Settle a layer's entry at the end of its construct pass. `ready` mirrors
  // what the shapefile watcher writes on success; `idle` drops the entry, for a
  // layer that finished with nothing to report.
  const settleLayerStatus = (name, state) =>
    setLayerStatus((previous) => {
      if (state === "idle") {
        const { [name]: _dropped, ...rest } = previous;
        return rest;
      }
      return { ...previous, [name]: { state, message: null, kind: null } };
    });
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

  // --- Linked map view groups --------------------------------------------
  const viewGroupContext = useViewGroupContext();
  const { gridItemUUID, shouldLoad } = useContext(GridItemContext) ?? {};
  const { activeTabId } = useContext(TabContext) ?? {};
  // The group name is read off the resolved extent value, which has three
  // legacy shapes still in dashboards.
  const viewGroupName = readViewGroupSettings(mapExtent).viewGroup;
  // R27 and the rest of the membership rule live in `viewGroup.js`, shared
  // with the cursor half in `components/visualizations/Map.js`.
  const viewGroupEnabled = isViewGroupMember({
    viewGroupName,
    hasViewGroupContext: Boolean(viewGroupContext),
    dataviewerViz,
    activeTabId,
    gridItemUUID,
  });
  // The group this member is currently registered under, read by the
  // postrender handler and the apply callback, both of which outlive a render.
  const activeViewGroupRef = useRef(null);
  // The `View` object seen on the previous frame. A different one means the
  // view was replaced -- the extent effect or a raster auto-fit -- which is
  // never a user action (R20).
  const lastViewObjectRef = useRef(null);
  // What this member's view last settled at, as read back from the view
  // itself. Publishes are the difference against this (R21, R22).
  const viewGroupBaselineRef = useRef(null);
  // An apply is outstanding: record the read-back on the next frame instead of
  // publishing the difference.
  const viewGroupReadbackRef = useRef(false);
  // This member refused an apply because it was being interacted with. Only a
  // recorded refusal re-adopts when the interaction ends (R23).
  const viewGroupDeclinedRef = useRef(false);
  // A forced re-adopt, from a hidden tab becoming active again (R10).
  const viewGroupReadoptRef = useRef(false);
  // This membership has not yet taken the group's opening view. Consumed once,
  // on the first frame that can resolve it -- a bbox seed needs a viewport, so
  // a member that mounts with no area keeps the seed pending until it has one.
  const viewGroupSeedPendingRef = useRef(false);
  const viewGroupPostrenderRef = useRef(null);
  const viewGroupHandlerRef = useRef(null);
  const viewGroupApplyRef = useRef(null);
  const previousShouldLoadRef = useRef(shouldLoad);
  const [viewGroupMismatch, setViewGroupMismatch] = useState(null);

  // --- Coalesced `moveend` side effects (U4: R24, R29) --------------------
  // Unsettled motion is in flight on this member's own view. Held in a ref
  // because both consumers read it from inside their handlers (see
  // `deferMoveEndConsumer`).
  const viewUnsettledRef = useRef(false);
  const settleTimerRef = useRef(null);
  // Which consumers asked to run while the gate was shut, replayed once on the
  // settled flush. A set of flags, not a queue: the work is idempotent and only
  // the settled view is worth doing it for.
  const pendingMoveEndRef = useRef(null);
  // This member's view as of the previous frame, for the frame-to-frame
  // stability test that decides when motion has settled.
  const lastFrameViewRef = useRef(null);
  // R29's backstop: the last extent value actually handed to the variable
  // input, so an identical one is never published twice in a row.
  const lastPublishedExtentRef = useRef(null);
  const flushMoveEndRef = useRef(null);

  // Fade the incoming layers in over `duration` ms, then remove the outgoing
  // ones, so a storm swap dissolves instead of flashing. Any running fade is
  // finalized first so overlapping swaps don't leave a layer mid-fade.
  const crossfadeLayers = (map, incoming, outgoing, duration) => {
    if (activeFadeRef.current) activeFadeRef.current();
    const start = Date.now();
    let rafId = null;
    const finalize = () => {
      // Always scheduled by the time anything can call this: rAF is assigned
      // below before either `step` or a later crossfade can reach it.
      cancelAnimationFrame(rafId);
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
  // The prep phase runs in the parent, before any OL layer exists, so its
  // entries are merged in here rather than living in the state above. A layer
  // being prepared cannot also be constructing, so neither side overwrites a
  // more specific state belonging to the other.
  const mergedLayerStatus = useMemo(
    () => ({ ...layerPrepStatus, ...layerStatus }),
    [layerPrepStatus, layerStatus],
  );

  const statusEntries = Object.entries(mergedLayerStatus);
  const layerFailures = statusEntries.filter(
    ([, status]) => status.state === "error",
  );
  const layersLoading = statusEntries.filter(
    ([, status]) => status.state === "loading",
  );
  const layerAlert = layerFailures.length
    ? {
        variant: "danger",
        message: layerFailures
          .map(([name, status]) => `${name}: ${status.message}`)
          .join(" "),
      }
    : layersLoading.length
      ? {
          variant: "info",
          message: `Loading ${layersLoading
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
      if (settleTimerRef.current) {
        clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }
      pendingMoveEndRef.current = null;
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
    // A new extent -- and possibly a new variable name -- is a new
    // subscription, so the "already published this value" memo below starts
    // over rather than suppressing the first publish against it. A publish
    // deferred under the previous extent goes with it: it was asked for on
    // behalf of a subscription that no longer exists.
    lastPublishedExtentRef.current = null;
    pendingMoveEndRef.current = null;

    // Update zoom on view change. Only the DataViewer preview renders `zoom`
    // (the info panel below); on a dashboard map this wrote React state on
    // every frame the resolution changed, which for a view-group follower is
    // every frame of a peer's zoom -- and each of those re-renders makes both
    // floating map controls re-measure their anchor. The mount-time write in
    // this effect still seeds `defaultViewConfig`, so nothing else changes.
    if (dataviewerViz) {
      mapViewConfig.on("change:resolution", () => {
        setZoom(visualizationRef.current.getView().getZoom().toFixed(2));
      });
    }

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
            // The whole source is compared, not just the url. `projection` is
            // the only way to place a shapefile that carries no .prj, and
            // matching on url alone made editing it a silent no-op -- the layer
            // was preserved, so nothing re-read or re-interpreted it. Comparing
            // the source object also covers whatever props it gains next, and
            // the component cache keeps the resulting rebuild cheap when only a
            // non-url prop changed.
            const incoming = (layers ?? []).find(
              (candidate) =>
                candidate?.props?.source?.type === "Shapefile" &&
                candidate?.props?.name === currentLayer.props.name &&
                valuesEqual(
                  candidate?.props?.source,
                  currentLayer.props.source,
                ),
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
        // Every entry names a layer that is on the map -- the id comes from the
        // match that produced the entry, and nothing removes a layer between
        // that match and here -- so the lookup cannot miss and the tests cannot
        // reach the other branch. Kept explicit anyway: this reconciliation has
        // proved subtle enough to be worth the belt, and a miss here would
        // otherwise depend on `updateOlLayerProps` tolerating undefined, which
        // is a promise made by another module.
        runtimeLayerUpdates.forEach(({ layerId, newProps }) => {
          const olLayer = currentMapLayers.find(
            (l) => l.get("layerId") === layerId,
          );
          /* istanbul ignore else -- unreachable: see above */
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
          // Same invariant as above, but this one is load-bearing rather than
          // belt: the `.get`/`.set` below would throw on a miss and take the
          // whole layer sync with it, blanking the map.
          /* istanbul ignore if -- unreachable: the name comes from the match
             that produced this entry */
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

      // proj4, wkt-parser and the definition table are ~150 KiB and cost a
      // measurable registration pass, and most dashboards have no layer needing
      // any of it -- so the module is loaded here rather than imported
      // statically. Awaited before any layer is built: importing it registers
      // the table codes, and a layer that merely *names* one needs the
      // definition on hand by the time OpenLayers resolves it, with nothing
      // asking for it by name.
      //
      // The trigger is deliberately broad. A source that reads its own CRS out
      // of its data -- a GeoTIFF or Zarr from the file, a shapefile from its
      // .prj -- carries no code in its config to check, so the type is enough
      // to require it. The view projection is never a table code (it starts at
      // EPSG:3857 and the auto-fit only adopts natively-resolvable codes), so
      // there is nothing to register before this point.
      if (customLayers.some(needsProjectionRegistry)) {
        await import("components/map/projections");
      }

      // Which raster, if any, gets to set the view projection. Resolved from
      // the author's array before anything is built, so it is the same answer
      // for every layer in this run no matter what order they finish in.
      const viewProjectionOwner = customLayers.find(
        (candidate) =>
          candidate?.type === "WebGLTile" &&
          (candidate.props?.source?.type === "GeoTIFF" ||
            candidate.props?.source?.type === "Zarr"),
      );

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

          // Constructing a source is where the network cost of most layer
          // types actually lands -- a GeoTIFF reads its header, a Zarr decodes
          // a slice, a GeoPackage fetches the whole file. Only the shapefile
          // reported any of that, because only it defers work to an OL loader
          // with events to watch. Marking the pass itself covers every type.
          setLayerStatus((previous) => ({
            ...previous,
            [name]: { state: "loading", message: null, kind: null },
          }));

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
            watchShapefileLoad(newLayer, name, setLayerStatus);

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

              // One raster owns the view projection. Every GeoTIFF and Zarr
              // layer used to assert its own CRS on the map's single view, so a
              // dashboard mixing projections had them fighting -- each adoption
              // undoing the last, and each `setView` re-rendering every layer
              // and refetching the basemap. It only looked stable while they
              // all landed in the same frame.
              //
              // The others still render: OpenLayers reprojects a DataTile
              // source whose projection differs from the view's, so not owning
              // the view costs a reprojection, not a layer.
              //
              // The owner is the first such layer in the author's own array,
              // not the first to finish loading, so which projection the map
              // settles in does not depend on which file the network served
              // first -- and reordering the layers is how an author changes it.
              if (layerConfig === viewProjectionOwner) {
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
                  // Whether the view, as it stands, is already looking at this
                  // raster. The fit below uses it to decide whether to keep the
                  // current extent; the adoption guard further down uses it to
                  // decide whether there is anything to adopt at all.
                  let viewOverlapsRaster = false;
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
                        viewOverlapsRaster =
                          Array.isArray(tifExtent) &&
                          tifExtent.length === 4 &&
                          intersects(transformed, tifExtent);
                        targetExtent = viewOverlapsRaster
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

                  // Features already on the map were parsed into the outgoing
                  // projection, so adopting the raster's leaves them holding the
                  // wrong numbers -- a UTM raster over Guatemala left Web
                  // Mercator coordinates being read as UTM metres, stranding the
                  // dynamic layers off screen while still reporting the right
                  // feature count. Move them with the view.
                  const previousCode = prevProjection.getCode();
                  const adoptedCode = newView.getProjection().getCode();

                  // Every raster runs this block as it mounts, so a dashboard
                  // built on several rasters in one projection ran it several
                  // times -- and when the view is already in that projection and
                  // already looking at the raster, the work above rebuilds the
                  // view that is already on screen. `setView` is not free: it
                  // replaces the view outright, so every layer re-renders and the
                  // basemap refetches its tiles. Five rasters each arriving on
                  // their own schedule made that visible as five jumps.
                  const alreadyAdopted =
                    previousCode === adoptedCode && viewOverlapsRaster;

                  // Adopt the raster's projection as the view projection only when
                  // OpenLayers resolves it on its own. Registering a definition
                  // makes a previously-unresolvable raster render, but it must not
                  // also start changing the view: setView publishes the adopted
                  // code into the map-extent variable other visualizations consume,
                  // and saved center/zoom values would be reinterpreted in the new
                  // projection's units. Widening this is its own change, verified
                  // against live dashboards. Such a raster still renders here --
                  // by reprojection rather than natively.
                  if (alreadyAdopted) {
                    // The view already shows this raster in its own projection.
                  } else if (!isNativelyResolvable(adoptedCode)) {
                    console.warn(
                      `Not adopting "${adoptedCode}" as the view projection for layer "${name}": it resolves from a registered definition rather than natively. The layer renders by reprojection.`,
                    );
                  } else {
                    if (targetExtent && haveMapSize) {
                      newView.fit(targetExtent, { size: mapSize });
                    }
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
            }

            await applyLayerStyle(newLayer, layerConfig);

            // A shapefile is not finished when its layer is: its features are
            // pulled by OpenLayers once the layer renders, and the watcher
            // attached above owns the entry from here. Writing "ready" now
            // would blink the indicator off and straight back on.
            if (!newLayer.getSource?.()?.get?.("shapefileController")) {
              settleLayerStatus(name, "ready");
            }
          } catch (err) {
            // A half-authored source is silent rather than an error, so the
            // indicator stops with nothing said. Real failures are reported by
            // the aggregate message below, so the entry is cleared here too --
            // two danger alerts for one failure would say the same thing twice.
            settleLayerStatus(name, "idle");
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
            // R24. The gate is read from a ref *inside* the handler rather
            // than captured when it is bound: this handler is rebound on every
            // layer change and the extent publisher on every extent change, so
            // a gate captured in either closure goes stale against the other.
            if (deferMoveEndConsumer("snap")) return;
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
        setLayerStatus((previous) => {
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

  // Replay the consumers that were held back, recomputed from the live map
  // rather than replayed from the deferred event's frame: the settled view is
  // the one they were always meant to see, and the view has moved on since.
  const flushPendingMoveEnd = () => {
    const pending = pendingMoveEndRef.current;
    pendingMoveEndRef.current = null;
    const map = visualizationRef.current;
    if (!pending || !map) return;
    if (pending.extent) publishMapExtentVariable(map);
    if (pending.snap && onMapMoveEnd) onMapMoveEnd(map);
  };
  // The settle timer outlives the render that armed it, so it flushes through
  // a ref and never through a closed-over copy of the props.
  flushMoveEndRef.current = flushPendingMoveEnd;

  const markViewUnsettled = () => {
    viewUnsettledRef.current = true;
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    settleTimerRef.current = setTimeout(() => {
      settleTimerRef.current = null;
      viewUnsettledRef.current = false;
      flushMoveEndRef.current?.();
    }, MOVE_SETTLE_MS);
  };

  // Take the group's view on this member. Every adoption in this component
  // goes through here, for the two things that have to happen with the apply
  // rather than after it:
  //
  //  - The settle gate is shut here, at apply time. Within one frame
  //    OpenLayers dispatches `moveend` before `postrender` (`renderFrame_`),
  //    so a gate armed from the postrender handler is still open when that
  //    same frame's `moveend` runs and the first follower frame of every peer
  //    gesture leaks an intermediate extent out to the whole dashboard.
  //    `trackViewMotion` remains the thing that decides motion has stopped;
  //    this only decides when it has started.
  //  - A no-op apply schedules no frame at all, so the read-back it would
  //    otherwise arm could never be consumed -- and would be consumed instead
  //    by this member's next real move, swallowing that publish. Nothing moved
  //    and nothing is coming, so the baseline is simply recorded here.
  //
  // The baseline is re-read from the view rather than taken from the caller's
  // frame read: resolving a bbox seed fits the view on the way in, so the
  // caller's copy is not always what this member is actually at.
  const adoptGroupView = (view, next) => {
    if (!applyViewState(view, next)) {
      viewGroupBaselineRef.current = readViewState(view);
      return false;
    }
    markViewUnsettled();
    viewGroupReadbackRef.current = true;
    return true;
  };

  // Called once per rendered frame. Settling is measured on this member's own
  // view being stable across its own frames, never on applies having stopped
  // arriving: a follower that clamps keeps receiving applies whose read-back
  // never matches, so an apply-driven notion of "in flight" would never open
  // the gate and that member would stop publishing its extent altogether.
  const trackViewMotion = (view, current) => {
    const previous = lastFrameViewRef.current;
    lastFrameViewRef.current = current;
    // The condition is "my view moved without me being the interactor", not
    // "I was applied to" -- which also covers a keyboard pan and a
    // variable-driven extent change. A gesture the viewer is driving is
    // already coalesced by OpenLayers, which holds the INTERACTING hint and
    // suppresses `moveend` for the whole of it.
    if (view.getInteracting()) return;
    if (!previous || viewStatesIdentical(previous, current)) return;
    markViewUnsettled();
  };

  // True when the caller's work was deferred to the settled flush. Reads the
  // gate through the ref at call time, so both consumers see the same state
  // regardless of which effect bound them or when.
  const deferMoveEndConsumer = (key) => {
    if (!viewUnsettledRef.current) return false;
    pendingMoveEndRef.current = { ...pendingMoveEndRef.current, [key]: true };
    return true;
  };

  // Report this member's live projection code and read back the group's pin.
  // Always read from `map.getView().getProjection()`, never from the
  // `projection` state: a raster auto-fit adopts the raster's projection
  // without ever updating that state.
  const reportViewGroupProjection = (code) => {
    const groupName = activeViewGroupRef.current;
    if (!groupName || !viewGroupContext) return null;
    return viewGroupContext.reportMemberProjection(
      groupName,
      gridItemUUID,
      code,
    );
  };

  // Resolve the group's discovered seed into a concrete view state for this
  // map, and consume it. The seed is stored in view coordinates of the group's
  // (single, R6) projection, exactly as the extent effect reads them, so no
  // transform is involved.
  const resolveGroupSeed = (groupName, view) => {
    const seed = viewGroupContext.getGroupSeed(groupName);
    if (!seed) {
      viewGroupSeedPendingRef.current = false;
      return null;
    }

    if (seed.type === "center") {
      viewGroupSeedPendingRef.current = false;
      const code = view.getProjection().getCode();
      const [x, y] = seed.center;
      return {
        center: [code === "EPSG:3857" ? wrapMercatorX(x) : x, y],
        resolution: view.getResolutionForZoom(seed.zoom),
        rotation: 0,
      };
    }

    // AE11. A bbox only means something against a viewport, so the first
    // member that has one fits it and promotes the result to the group view.
    // Later members then adopt that rather than each fitting the same bbox to
    // its own aspect ratio and landing on a different resolution.
    const size = visualizationRef.current?.getSize();
    if (!size || !(size[0] > 0) || !(size[1] > 0)) return null;
    viewGroupSeedPendingRef.current = false;
    view.fit(seed.bbox, { size });
    const fitted = readViewState(view);
    // Promotion never overwrites a live view, so a group moved between this
    // member mounting and this frame keeps the view the viewer put it at.
    return viewGroupContext.seedGroupView(groupName, fitted) ?? fitted;
  };

  // The view a member joining a group opens at: the group's live view when it
  // has one, otherwise the seed a flagged member supplied. Returns null when
  // the group has neither, which is R4 -- the member keeps its own extent.
  const groupOpeningView = (groupName, view) => {
    const groupView = viewGroupContext.getGroupView(groupName);
    if (groupView) {
      viewGroupSeedPendingRef.current = false;
      return groupView;
    }
    if (!viewGroupSeedPendingRef.current) return null;
    return resolveGroupSeed(groupName, view);
  };

  // Receive another member's view. Registered once per membership, so it reads
  // everything it needs through refs rather than closing over a render.
  const applyGroupView = (nextView) => {
    const map = visualizationRef.current;
    if (!map || !nextView) return;
    const view = map.getView();
    const code = view.getProjection().getCode();
    const groupProjection = reportViewGroupProjection(code);
    // R6: out of the group entirely while the projections differ. The notice
    // is raised by the postrender handler, which runs on every frame.
    if (groupProjection && groupProjection !== code) return;
    // ANIMATING as well as INTERACTING: double-click zoom, keyboard
    // zoom and the Zoom control all run through `view.animate()`, which holds
    // neither the INTERACTING hint nor the pointer. Applying over one of them
    // cancels it mid-flight -- `applyTargetState_` calls `cancelAnimations()`
    // -- so this member's own in-flight move would be yanked away by a peer's.
    if (view.getInteracting() || view.getAnimating()) {
      // R23: the viewer is driving this map right now. Record the refusal so
      // the settled frame at the end of the gesture re-adopts -- an
      // unrecorded refusal is indistinguishable from a gesture that had
      // nothing to decline, and re-adopting after those would undo every
      // move the viewer makes.
      viewGroupDeclinedRef.current = true;
      return;
    }
    // R21: what this member actually settled at is read back on its own next
    // frame. Recording the applied values here instead would make a follower
    // whose view clamped publish the difference straight back.
    adoptGroupView(view, nextView);
  };
  viewGroupApplyRef.current = applyGroupView;

  // One handler, bound at the `Map` level: map-level listeners survive the two
  // `setView` calls above, view-level ones are silently dropped by them.
  // `postrender` is also frame-coalesced, so a combined pan-and-zoom publishes
  // once rather than pushing an intermediate state out on `change:resolution`.
  const handleViewGroupPostrender = () => {
    const map = visualizationRef.current;
    const groupName = activeViewGroupRef.current;
    if (!map || !groupName || !viewGroupContext) return;

    // Read the view state off the view, never off the event's frame state:
    // OpenLayers dispatches `postrender` unconditionally but builds no frame
    // state for a map with no area, so a member on a hidden tab hands the
    // handler a null one.
    const view = map.getView();
    // Read once per frame and shared by every branch below: nothing between
    // here and the tail mutates the view within one synchronous invocation --
    // the branches that do apply a view state all return.
    const current = readViewState(view);
    // Before any of the group bookkeeping and before any early return: a
    // member that is out of sync on projection still has a view that can be
    // moved programmatically, and its consumers still need the gate.
    // Registered here rather than on its own listener so an ungrouped map --
    // which no peer can drive, and for which OpenLayers' own hints already
    // coalesce every path -- keeps its per-frame cost at exactly zero (R2).
    if (mapExtent?.variable || onMapMoveEnd) trackViewMotion(view, current);
    const code = view.getProjection().getCode();
    const groupProjection = reportViewGroupProjection(code);

    if (groupProjection && groupProjection !== code) {
      // R6. The baseline is still tracked while out of sync, so a member whose
      // projection later matches again rejoins where it stands rather than
      // publishing the whole divergence as if the viewer had made it.
      lastViewObjectRef.current = view;
      viewGroupBaselineRef.current = current;
      viewGroupReadbackRef.current = false;
      viewGroupDeclinedRef.current = false;
      setViewGroupMismatch((previous) =>
        previous &&
        previous.mapCode === code &&
        previous.groupCode === groupProjection &&
        previous.groupName === groupName
          ? previous
          : { groupName, mapCode: code, groupCode: groupProjection },
      );
      return;
    }
    setViewGroupMismatch((previous) => (previous ? null : previous));

    // R20. A replaced `View` is never a user action -- the extent effect and
    // the raster auto-fit both build a new one -- so this member re-adopts the
    // group's view rather than publishing whatever the replacement landed on.
    if (lastViewObjectRef.current !== view) {
      lastViewObjectRef.current = view;
      const interacting = view.getInteracting() || view.getAnimating();
      // A fresh membership reaches this branch on its very first frame, which
      // is also where a late join lands: the group's live view when it has one,
      // and otherwise the seed a flagged member supplied for its opening view.
      const groupView = interacting
        ? viewGroupContext.getGroupView(groupName)
        : groupOpeningView(groupName, view);
      if (groupView && !interacting) {
        adoptGroupView(view, groupView);
        viewGroupDeclinedRef.current = false;
        return;
      }
      viewGroupBaselineRef.current = current;
      viewGroupReadbackRef.current = false;
      // Only reachable with a group view while the viewer is interacting, in
      // which case the re-adopt is deferred to the settled frame the same way
      // a declined apply is.
      viewGroupDeclinedRef.current = Boolean(groupView);
      return;
    }

    const settled = !view.getInteracting() && !view.getAnimating();
    if (
      settled &&
      (viewGroupReadoptRef.current || viewGroupDeclinedRef.current)
    ) {
      viewGroupReadoptRef.current = false;
      viewGroupDeclinedRef.current = false;
      const groupView = groupOpeningView(groupName, view);
      if (groupView) {
        adoptGroupView(view, groupView);
        return;
      }
    }

    if (viewGroupReadbackRef.current) {
      viewGroupReadbackRef.current = false;
      viewGroupBaselineRef.current = current;
      return;
    }

    // A bbox seed cannot be resolved by a member with no viewport, and a map
    // mounted on a hidden tab has none. The seed stays pending until a frame
    // that can resolve it arrives -- which is the frame the ResizeObserver
    // schedules when the member is first given area. No gesture can be in
    // flight at that point, since a zero-size map cannot be panned.
    if (settled && viewGroupSeedPendingRef.current) {
      const opening = groupOpeningView(groupName, view);
      if (opening) {
        adoptGroupView(view, opening);
        return;
      }
    }

    if (!viewGroupBaselineRef.current) {
      viewGroupBaselineRef.current = current;
      return;
    }
    if (viewsAreEqual(viewGroupBaselineRef.current, current)) return;

    viewGroupBaselineRef.current = current;
    viewGroupContext.publishView(groupName, gridItemUUID, {
      ...current,
      // R26: a source panned past the antimeridian would otherwise teleport
      // every follower a world away.
      center:
        code === "EPSG:3857" && Array.isArray(current.center)
          ? [wrapMercatorX(current.center[0]), current.center[1]]
          : current.center,
    });
  };
  viewGroupHandlerRef.current = handleViewGroupPostrender;

  useEffect(() => {
    if (!viewGroupEnabled) {
      activeViewGroupRef.current = null;
      setViewGroupMismatch(null);
      return;
    }

    activeViewGroupRef.current = viewGroupName;
    const unregister = viewGroupContext.registerMember(
      viewGroupName,
      gridItemUUID,
      { applyView: (nextView) => viewGroupApplyRef.current?.(nextView) },
    );
    // The group pins its projection from the first member to register, so the
    // pin is reported on joining rather than waiting for a frame.
    const map = visualizationRef.current;
    if (map) {
      viewGroupContext.reportMemberProjection(
        viewGroupName,
        gridItemUUID,
        map.getView().getProjection().getCode(),
      );
    }
    // A fresh membership has no history: the next frame re-adopts the group's
    // view rather than reading this map's own opening view as a move.
    lastViewObjectRef.current = null;
    viewGroupBaselineRef.current = null;
    viewGroupReadbackRef.current = false;
    viewGroupDeclinedRef.current = false;
    viewGroupSeedPendingRef.current = true;
    // Nothing else asks for the frame that adoption happens on, so a member
    // joining a group after mount -- the group name being set on a live map,
    // or its extent changing to carry one -- would sit un-synced until some
    // unrelated event redrew it. Same as the re-adopt path below.
    map?.render();

    return () => {
      activeViewGroupRef.current = null;
      unregister();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewGroupEnabled, viewGroupName, gridItemUUID, viewGroupContext]);

  useEffect(() => {
    // Captured rather than read in the cleanup: the mount effect above runs its
    // own cleanup first and nulls `visualizationRef` out from under this one.
    const map = visualizationRef.current;
    if (!map) return;

    if (viewGroupPostrenderRef.current) {
      map.un("postrender", viewGroupPostrenderRef.current);
      viewGroupPostrenderRef.current = null;
    }
    if (!viewGroupEnabled) return;

    const handler = () => viewGroupHandlerRef.current?.();
    viewGroupPostrenderRef.current = handler;
    map.on("postrender", handler);

    return () => {
      map.un("postrender", handler);
      if (viewGroupPostrenderRef.current === handler) {
        viewGroupPostrenderRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewGroupEnabled]);

  useEffect(() => {
    const wasLoaded = previousShouldLoadRef.current;
    previousShouldLoadRef.current = shouldLoad;
    // R10. A member that was mounted and hidden never unmounts, so the
    // registration effect never re-runs for it and nothing else would make it
    // pick the group's view up again on its way back.
    if (!viewGroupEnabled || !shouldLoad || wasLoaded) return;
    viewGroupReadoptRef.current = true;
    visualizationRef.current?.render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldLoad, viewGroupEnabled]);

  // R29. Publishing an extent re-runs an effect on every visualization on the
  // dashboard, so the same value is never published twice in a row -- a win
  // today for a `moveend` that lands back where it started, and the backstop
  // that makes any regression of the gate above degrade rather than collapse.
  const publishMapExtentVariable = (map) => {
    // The deferred flush runs up to a settle window after the `moveend` that
    // asked for it, and the extent -- and with it the variable name -- can
    // have changed in between. Without this the flush publishes under the key
    // `undefined`.
    if (!mapExtent?.variable) return;
    const view = map.getView();
    const projection = view.getProjection().getCode();
    const extent = view.calculateExtent(map.getSize());
    const signature = `${mapExtent.variable}|${projection}|${extent.join(",")}`;
    if (lastPublishedExtentRef.current === signature) return;
    lastPublishedExtentRef.current = signature;
    const rectangleGeom = fromExtent(extent);
    const geojson = JSON.parse(new GeoJSON().writeGeometry(rectangleGeom));
    setVariableInputValues((previousVariableInputValues) => ({
      ...previousVariableInputValues,
      ...{
        [mapExtent.variable]: {
          projection,
          geometries: [geojson],
        },
      },
    }));
  };

  const updateMapExtentVariable = (event) => {
    // R24. Same ref-read-inside-the-handler rule as the snap refresh.
    if (deferMoveEndConsumer("extent")) return;
    publishMapExtentVariable(event.map);
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
        {layerAlert && (
          <AlertAnchor edges={ALERT_EDGES}>
            <StyledAlert
              variant={layerAlert.variant}
              role={layerAlert.variant === "danger" ? "alert" : "status"}
              aria-live="polite"
            >
              {layerAlert.message}
            </StyledAlert>
          </AlertAnchor>
        )}
        {viewGroupMismatch && (
          <AlertAnchor edges={ALERT_EDGES}>
            <StyledAlert
              variant="warning"
              role="status"
              aria-live="polite"
              aria-label="View Group Projection Mismatch"
            >
              {`This map is not synced with the "${viewGroupMismatch.groupName}" ` +
                `view group: it is in ${viewGroupMismatch.mapCode} and the ` +
                `group is in ${viewGroupMismatch.groupCode}.`}
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
            layerStatus={mergedLayerStatus}
            onRetryLayer={(layerName) => {
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
      // Maps sharing a view group name pan, zoom and rotate together.
      viewGroup: PropTypes.string,
      isGroupInitialExtent: PropTypes.bool,
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
  // Layers still being prepared by the parent (style fetch, raster header
  // read). That phase precedes any OL layer, so the map cannot observe it and
  // is told instead; merged with the map's own per-layer state for display.
  layerPrepStatus: PropTypes.objectOf(
    PropTypes.shape({
      state: PropTypes.string,
    }),
  ),
  runtimeLayerState: PropTypes.shape({
    errorsByLayerId: PropTypes.object,
    retry: PropTypes.func,
    sessionNonce: PropTypes.string,
    gridItemUuid: PropTypes.string,
  }),
};

export default memo(MapComponent);

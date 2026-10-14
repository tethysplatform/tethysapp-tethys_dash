import { useContext, useEffect, useRef } from "react";
import { GridItemContext, TabContext } from "components/contexts/Contexts";
import { useLinkedExtentContext } from "components/contexts/LinkedExtentContext";
import {
  isLinkedExtentMember,
  readLinkedExtentGroup,
  readViewGroupSettings,
} from "components/map/viewGroup";
import { footprintKey, viewFootprint } from "components/map/linkedExtent";

function readFootprintInputs(map) {
  const view = map.getView();
  return {
    center: view.getCenter(),
    resolution: view.getResolution(),
    rotation: view.getRotation(),
    size: map.getSize(),
    projection: view.getProjection()?.getCode(),
  };
}

function hasArea(size) {
  return Array.isArray(size) && size[0] > 0 && size[1] > 0;
}

/**
 * Publish this map's on-screen footprint to its linked extent group.
 *
 * A member is "on screen" only while its tab is loaded and its map has an
 * area: a visited tab stays mounted at zero size and gets no rendered frames,
 * so registration alone would leave its last footprint standing forever.
 *
 * Bound at the `Map` level, never the `View`: the map replaces its View on an
 * extent change and on raster projection adoption, and view listeners are
 * dropped with it. `postrender` is frame-coalesced, and the footprint key
 * keeps an unchanged frame from publishing at all.
 */
export default function useLinkedExtentPublisher({
  visualizationRef,
  mapExtent,
  dataviewerViz,
}) {
  const registry = useLinkedExtentContext();
  const { gridItemUUID, shouldLoad } = useContext(GridItemContext) ?? {};
  const { activeTabId } = useContext(TabContext) ?? {};
  const groupName = readLinkedExtentGroup(mapExtent);
  const viewGroup = readViewGroupSettings(mapExtent).viewGroup;
  const enabled = isLinkedExtentMember({
    groupName,
    hasLinkedExtentContext: Boolean(registry),
    dataviewerViz,
    activeTabId,
    gridItemUUID,
  });

  const handleRef = useRef(null);
  const lastKeyRef = useRef(null);
  // `shouldLoad` is undefined outside a dashboard tab; only an explicit false
  // means hidden.
  const visibleRef = useRef(shouldLoad !== false);
  visibleRef.current = shouldLoad !== false;

  const publishCurrent = () => {
    const handle = handleRef.current;
    const map = visualizationRef.current;
    if (!handle || !map) return;
    const inputs = readFootprintInputs(map);
    if (!visibleRef.current || !hasArea(inputs.size)) {
      if (lastKeyRef.current !== "hidden") {
        lastKeyRef.current = "hidden";
        handle.publish(null);
      }
      return;
    }
    const key = footprintKey(inputs);
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;
    handle.publish(viewFootprint(inputs));
  };
  const publishRef = useRef(publishCurrent);
  publishRef.current = publishCurrent;

  useEffect(() => {
    const map = visualizationRef.current;
    if (!enabled || !map) return;

    const handle = registry.register(groupName, gridItemUUID, { viewGroup });
    handleRef.current = handle;
    lastKeyRef.current = null;

    const onFrame = () => publishRef.current();
    // A map shrunk to zero size renders no frame to publish its absence from.
    const onSize = () => {
      if (!hasArea(map.getSize())) publishRef.current();
    };
    map.on("postrender", onFrame);
    map.on("change:size", onSize);
    publishRef.current();
    map.render();

    return () => {
      map.un("postrender", onFrame);
      map.un("change:size", onSize);
      if (handleRef.current === handle) handleRef.current = null;
      handle.unregister();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, groupName, gridItemUUID, viewGroup, registry]);

  // A hidden tab gets no frames, so its absence is published here; on the way
  // back the next frame publishes the current footprint again.
  useEffect(() => {
    if (!handleRef.current) return;
    if (shouldLoad === false) {
      publishRef.current();
    } else {
      lastKeyRef.current = null;
      visualizationRef.current?.render();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldLoad]);
}

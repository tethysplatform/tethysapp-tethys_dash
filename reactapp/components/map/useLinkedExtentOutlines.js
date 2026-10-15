import { useContext, useEffect, useRef } from "react";
import Feature from "ol/Feature.js";
import Polygon from "ol/geom/Polygon.js";
import { unByKey } from "ol/Observable.js";
import { GridItemContext, TabContext } from "components/contexts/Contexts";
import { useLinkedExtentContext } from "components/contexts/LinkedExtentContext";
import {
  POPUP_TAB_ID,
  readLinkedExtentGroup,
  readViewGroupSettings,
} from "components/map/viewGroup";
import {
  LINKED_EXTENT_LAYER_KEY,
  footprintInProjection,
  outlinesToDraw,
} from "components/map/linkedExtent";

export const LINKED_EXTENT_MEMBER_KEY = "linkedExtentMember";

/**
 * Keep every Linked Extents layer on this map filled with the outlines of the
 * other members of its linked extent group.
 *
 * Outlines are rebuilt from registry state -- never trusted to survive on a
 * layer instance -- whenever a member's footprint changes, a Linked Extents
 * layer is added (a fresh build, or a rebuild after its style changed), and the
 * map's view is replaced. The layer is filled the moment it is added, before it
 * draws, so a rebuild never shows an empty frame.
 *
 * Reading is open to any map that names a group, including the DataViewer
 * preview, which only watches: it is never a member, and it excludes the
 * dashboard tile it is previewing, whose grid item UUID it shares.
 */
export default function useLinkedExtentOutlines({
  visualizationRef,
  mapExtent,
}) {
  const registry = useLinkedExtentContext();
  const { gridItemUUID } = useContext(GridItemContext) ?? {};
  const { activeTabId } = useContext(TabContext) ?? {};
  // A popup map never joins a group, so it has nothing to outline.
  const groupName =
    activeTabId === POPUP_TAB_ID ? null : readLinkedExtentGroup(mapExtent);
  const viewGroup = readViewGroupSettings(mapExtent).viewGroup;

  const stateRef = useRef();
  stateRef.current = { groupName, viewGroup, gridItemUUID };

  useEffect(() => {
    const map = visualizationRef.current;
    if (!map) return undefined;

    const outlineLayers = () =>
      map
        .getLayers()
        .getArray()
        .filter((layer) => layer.get(LINKED_EXTENT_LAYER_KEY));

    const populate = (change) => {
      const state = stateRef.current;
      // This map's own footprint is never drawn on it, so its own publishes
      // change nothing here -- and a map without the layer draws nothing.
      if (change?.memberId && change.memberId === state.gridItemUUID) return;
      const layers = outlineLayers();
      if (layers.length === 0) return;
      const projection = map.getView().getProjection().getCode();
      const outlines =
        state.groupName && registry
          ? outlinesToDraw(registry.getFootprints(state.groupName), {
              selfIds: [state.gridItemUUID],
              viewGroup: state.viewGroup,
            })
          : [];
      const rings = outlines
        .map((outline) => ({
          memberId: outline.memberId,
          ring: footprintInProjection(outline.ring, projection),
        }))
        .filter((outline) => outline.ring);

      layers.forEach((layer) => {
        const source = layer.getSource();
        if (!source) return;
        source.clear(true);
        source.addFeatures(
          rings.map(({ memberId, ring }) => {
            const feature = new Feature(new Polygon([ring]));
            feature.set(LINKED_EXTENT_MEMBER_KEY, memberId);
            return feature;
          }),
        );
      });
    };

    const unsubscribe =
      groupName && registry ? registry.subscribe(groupName, populate) : null;
    const addKey = map.getLayers().on("add", (event) => {
      if (event.element?.get?.(LINKED_EXTENT_LAYER_KEY)) populate();
    });
    const viewKey = map.on("change:view", () => populate());
    populate();

    return () => {
      unsubscribe?.();
      unByKey(addKey);
      unByKey(viewKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registry, groupName, viewGroup, gridItemUUID]);
}

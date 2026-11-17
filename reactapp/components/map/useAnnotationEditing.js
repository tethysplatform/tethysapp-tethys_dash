import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  EditingContext,
  GridItemContext,
  TabContext,
} from "components/contexts/Contexts";
import { POPUP_TAB_ID } from "components/map/viewGroup";
import {
  ANNOTATIONS_METADATA_KEY,
  normalizeAnnotationGroups,
  withAnnotationGroups,
} from "components/map/annotationGroups";

/**
 * The dashboard map's side of the annotation button: whether it is offered,
 * the groups it edits, how it writes them, and the open drawing session.
 *
 * Offered only while the dashboard is being edited, to a map tile that can
 * write its own grid item -- never in the data viewer or inside a popup
 * layout. The groups are read from the grid item's settings as saved, not
 * from the substituted copy the map draws: a `${Variable}` in annotation text
 * must be written back as the template, not as today's value.
 *
 * A write goes straight into the dashboard's unsaved edits through
 * `updateGridItem`, so the header's Save keeps it and its Cancel discards it.
 * It finds this tile by uuid and changes it against the latest tabs, so two
 * maps writing in one tick cannot undo each other.
 *
 * @param {{dataviewerViz?: boolean}} options
 * @returns {{annotationControl: object|null, sessionOpen: boolean}}
 *   `annotationControl` is the AnnotationControl's props, or null when the
 *   button is not offered.
 */
export default function useAnnotationEditing({ dataviewerViz }) {
  const { isEditing } = useContext(EditingContext) ?? {};
  const { activeTabId, updateGridItem } = useContext(TabContext) ?? {};
  const { gridItemUUID, gridItemMetadataString } =
    useContext(GridItemContext) ?? {};

  // Only the dashboard's own TabContext offers `updateGridItem`; the popup
  // modal and the popup layout editor mount synthetic ones without it. A tile
  // with no uuid has no way to be found again, so it is not offered either.
  const canEdit = Boolean(
    isEditing &&
    !dataviewerViz &&
    activeTabId !== POPUP_TAB_ID &&
    gridItemUUID &&
    typeof updateGridItem === "function",
  );

  const groups = useMemo(() => {
    try {
      const metadata = JSON.parse(gridItemMetadataString || "{}");
      return normalizeAnnotationGroups(metadata?.[ANNOTATIONS_METADATA_KEY]);
    } catch {
      return [];
    }
  }, [gridItemMetadataString]);

  const [session, setSession] = useState(null);

  // A session ends with the editing it belongs to: leaving edit mode (Save or
  // Cancel in the header) or switching tabs closes it. Its edits are already
  // in the dashboard's unsaved state, so nothing is lost by closing it.
  useEffect(() => {
    if (!canEdit) setSession(null);
  }, [canEdit]);
  const sessionTab = useRef(activeTabId);
  useEffect(() => {
    if (sessionTab.current !== activeTabId) {
      sessionTab.current = activeTabId;
      setSession(null);
    }
  }, [activeTabId]);

  const onGroupsChange = useCallback(
    (nextGroups) => {
      // Only the tab on screen can be edited, so it is the one this tile is
      // on; a tile it does not hold is not written at all.
      updateGridItem(activeTabId, gridItemUUID, (item) => {
        const metadataString = withAnnotationGroups(
          item.metadata_string,
          nextGroups,
        );
        return metadataString === null ||
          metadataString === item.metadata_string
          ? item
          : { ...item, metadata_string: metadataString };
      });
    },
    [updateGridItem, activeTabId, gridItemUUID],
  );

  const annotationControl = useMemo(
    () =>
      canEdit
        ? { groups, onGroupsChange, session, onSessionChange: setSession }
        : null,
    [canEdit, groups, onGroupsChange, session],
  );

  return { annotationControl, sessionOpen: Boolean(canEdit && session) };
}

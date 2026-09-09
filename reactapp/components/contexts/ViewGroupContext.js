import { createContext, useCallback, useContext, useMemo, useRef } from "react";
import PropTypes from "prop-types";
import { normalizeViewGroupName } from "components/map/viewGroup";

export const ViewGroupContext = createContext();

const NOOP_UNREGISTER = () => {};

// One entry per view group. The entry is mutable and lives in a ref: view
// state changes on every animation frame of a pan, and putting it in React
// state would re-render every consumer on the dashboard for each of them.
const createGroupEntry = () => ({
  // The group's current shared view, `{center, resolution, rotation}` or null
  // until a member first publishes (R9).
  view: null,
  // The projection code the group is pinned to, or null while unpinned. The
  // first member to report one pins it; a member whose live code differs
  // neither applies nor publishes (R6).
  projection: null,
  // The extent a flagged member supplies for the group's opening view. The
  // provider-side seed discovery that fills this in belongs to U3.
  pendingSeed: null,
  // Registered members, keyed by grid item UUID.
  members: new Map(),
});

/**
 * Dashboard-scoped registry of linked map view groups.
 *
 * Maps join a group by name, publish their own view and cursor changes into
 * it, and receive everyone else's through the callbacks they registered with.
 * The context value is built once so that a pan re-renders nobody.
 */
const ViewGroupProvider = ({ children }) => {
  const groupsRef = useRef(new Map());

  // Fan a value out to every member of a group except the one that published
  // it. Each callback is guarded on its own: a member torn down mid-frame
  // must not stop the rest of the group from receiving the update.
  const fanOut = useCallback((entry, groupName, sourceId, key, payload) => {
    // Snapshot first -- a callback may unregister its own member (or another)
    // while we are iterating.
    const members = Array.from(entry.members.entries());
    members.forEach(([memberId, member]) => {
      if (memberId === sourceId) return;
      const callback = member[key];
      if (typeof callback !== "function") return;
      try {
        callback(payload, { groupName, sourceId });
      } catch (error) {
        console.error(
          `View group "${groupName}": member "${memberId}" failed to handle ${key}`,
          error,
        );
      }
    });
  }, []);

  /**
   * Join a view group.
   *
   * @param {string} groupName raw (un-normalized) group name
   * @param {string} memberId grid item UUID
   * @param {{applyView: Function, applyCursor: Function}} handlers
   * @returns {Function} unregister for this registration only
   */
  const registerMember = useCallback(
    (groupName, memberId, handlers = {}) => {
      const name = normalizeViewGroupName(groupName);
      if (!name || memberId === null || memberId === undefined) {
        return NOOP_UNREGISTER;
      }

      let entry = groupsRef.current.get(name);
      if (!entry) {
        entry = createGroupEntry();
        groupsRef.current.set(name, entry);
      }

      const record = {
        applyView:
          typeof handlers.applyView === "function" ? handlers.applyView : null,
        applyCursor:
          typeof handlers.applyCursor === "function"
            ? handlers.applyCursor
            : null,
        // The member's own live projection code, once it reports one.
        projection: null,
      };
      entry.members.set(memberId, record);

      return () => {
        const current = groupsRef.current.get(name);
        if (!current) return;
        // Only drop the registration this closure created. A member that
        // re-registers (a group rename, a remount) installs a new record, and
        // the stale unregister must not take the new one down with it.
        if (current.members.get(memberId) !== record) return;
        current.members.delete(memberId);
        if (current.members.size === 0) {
          // Drop the whole entry with the last member so a view left behind by
          // a departed group cannot be resurrected by a later join.
          groupsRef.current.delete(name);
          return;
        }
        if (record.projection && current.projection === record.projection) {
          // The member that pinned the projection is leaving, so the pin is
          // re-evaluated from whoever is left rather than outliving them.
          const remaining = Array.from(current.members.values()).find(
            (member) => member.projection,
          );
          current.projection = remaining ? remaining.projection : null;
        }
      };
    },
    // groupsRef is stable; fanOut is not used here.
    [],
  );

  /**
   * Publish a view state to the rest of a group and record it as the group's
   * current view.
   *
   * @param {string} groupName
   * @param {string} memberId the publishing member, which is not called back
   * @param {{center: Array<number>, resolution: number, rotation: number}} view
   */
  const publishView = useCallback(
    (groupName, memberId, view) => {
      const name = normalizeViewGroupName(groupName);
      if (!name || !view) return;
      const entry = groupsRef.current.get(name);
      if (!entry) return;

      // Copy so a later mutation of the caller's array (OpenLayers reuses
      // coordinate arrays) cannot rewrite the group's recorded view.
      const nextView = {
        center: Array.isArray(view.center) ? [...view.center] : view.center,
        resolution: view.resolution,
        rotation: view.rotation,
      };
      entry.view = nextView;
      fanOut(entry, name, memberId, "applyView", nextView);
    },
    [fanOut],
  );

  /**
   * Publish a cursor position, in the group's projected map units, to the rest
   * of a group. A null coordinate clears the marker on the other members.
   *
   * @param {string} groupName
   * @param {string} memberId the publishing member, which is not called back
   * @param {Array<number>|null} coordinate
   */
  const publishCursor = useCallback(
    (groupName, memberId, coordinate) => {
      const name = normalizeViewGroupName(groupName);
      if (!name) return;
      const entry = groupsRef.current.get(name);
      if (!entry) return;

      const nextCoordinate = Array.isArray(coordinate)
        ? [...coordinate]
        : (coordinate ?? null);
      fanOut(entry, name, memberId, "applyCursor", nextCoordinate);
    },
    [fanOut],
  );

  /**
   * Report a member's live projection code and read back the group's pinned
   * one.
   *
   * The group pins its projection from the first member to report one, and a
   * member whose live code differs from the pin neither applies nor publishes
   * (R6). Members re-report every frame rather than only at registration,
   * because a raster auto-fit changes a map's view projection long after it
   * joined.
   *
   * @param {string} groupName
   * @param {string} memberId
   * @param {string|null} code the member's live projection code
   * @returns {string|null} the group's pinned projection code
   */
  const reportMemberProjection = useCallback((groupName, memberId, code) => {
    const name = normalizeViewGroupName(groupName);
    if (!name) return null;
    const entry = groupsRef.current.get(name);
    if (!entry) return null;
    const member = entry.members.get(memberId);
    if (member) member.projection = code ?? null;
    if (!entry.projection && code) entry.projection = code;
    return entry.projection;
  }, []);

  /**
   * Read a group's current shared view.
   *
   * @param {string} groupName
   * @returns {object|null} the view state, or null when the group has none
   */
  const getGroupView = useCallback((groupName) => {
    const name = normalizeViewGroupName(groupName);
    if (!name) return null;
    const entry = groupsRef.current.get(name);
    return entry ? entry.view : null;
  }, []);

  /**
   * Give a group an opening view. Seeding never overwrites a view the group
   * already holds -- a member that resolves a seed does so after the group may
   * already have moved -- and it never fans out, since a seed is adopted by
   * members as they register rather than pushed at them.
   *
   * @param {string} groupName
   * @param {object} view `{center, resolution, rotation}`
   * @returns {object|null} the group's view after seeding
   */
  const seedGroupView = useCallback((groupName, view) => {
    const name = normalizeViewGroupName(groupName);
    if (!name) return null;
    let entry = groupsRef.current.get(name);
    if (!entry) {
      // A seed can be discovered before any map has mounted, so the entry is
      // created here rather than only on registration.
      entry = createGroupEntry();
      groupsRef.current.set(name, entry);
    }
    if (entry.view || !view) return entry.view;
    entry.view = {
      center: Array.isArray(view.center) ? [...view.center] : view.center,
      resolution: view.resolution,
      rotation: view.rotation,
    };
    return entry.view;
  }, []);

  const contextValue = useMemo(
    () => ({
      registerMember,
      publishView,
      publishCursor,
      getGroupView,
      seedGroupView,
      reportMemberProjection,
    }),
    [
      registerMember,
      publishView,
      publishCursor,
      getGroupView,
      seedGroupView,
      reportMemberProjection,
    ],
  );

  return (
    <ViewGroupContext.Provider value={contextValue}>
      {children}
    </ViewGroupContext.Provider>
  );
};

ViewGroupProvider.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
  ]),
};

export default ViewGroupProvider;

export const useViewGroupContext = () => {
  const context = useContext(ViewGroupContext);
  if (!context) {
    return null; // instead of throwing -- maps render outside the provider too
  }
  return context;
};

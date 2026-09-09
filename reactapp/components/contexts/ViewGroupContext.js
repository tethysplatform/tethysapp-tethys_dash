import { createContext, useCallback, useContext, useMemo, useRef } from "react";
import PropTypes from "prop-types";
import {
  discoverGroupSeeds,
  normalizeViewGroupName,
} from "components/map/viewGroup";
import { TabContext } from "components/contexts/Contexts";

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
  // The extent a flagged member supplies for the group's opening view, as
  // discovered from the dashboard's stored grid items rather than from a
  // member. Null when no member of the group carries the flag, or when the
  // flagged member's extent seeds nothing.
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
  const { tabs } = useContext(TabContext) ?? {};

  // Seed discovery is done here, during the provider's own render, rather than
  // in an effect: effects run child-first, so a map's registration effect would
  // beat a provider effect to the store and the first member of a group would
  // find no seed. Rendering is child-last, so every group's seed is in place
  // before any map mounts. The scan only ever writes `pendingSeed`, never a
  // live view, so re-running it is idempotent.
  useMemo(() => {
    const discovered = discoverGroupSeeds(tabs);
    discovered.forEach((seed, name) => {
      let entry = groupsRef.current.get(name);
      if (!entry) {
        entry = createGroupEntry();
        groupsRef.current.set(name, entry);
      }
      entry.pendingSeed = seed;
    });
    // A group whose flagged member was removed or unflagged stops seeding.
    groupsRef.current.forEach((entry, name) => {
      if (discovered.has(name)) return;
      entry.pendingSeed = null;
      if (entry.members.size === 0) groupsRef.current.delete(name);
    });
  }, [tabs]);

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
        // Isolation is unchanged -- only the logging is deduplicated. A member
        // that throws consistently is driven once per rendered frame of a peer
        // gesture, so an unconditional log here floods the console at frame
        // rate and buries everything else. The first failure of each handler
        // says everything the later identical ones would.
        if (member.loggedFailures.has(key)) return;
        member.loggedFailures.add(key);
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
        // Handler keys this member has already been logged as failing, so a
        // consistently throwing member is reported once rather than on every
        // frame. Per record, so a re-registration reports afresh.
        loggedFailures: new Set(),
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
          // A view left behind by a departed group must not be resurrected by a
          // later join, so it goes with the last member. The discovered seed is
          // not the departed members' -- it is the dashboard's -- so it stays,
          // and a group that has none loses its entry entirely.
          if (current.pendingSeed) {
            current.view = null;
            current.projection = null;
            return;
          }
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
    // The pin is taken from the first member to report one, which is the
    // pre-raster projection. A group whose members have all since auto-fit to
    // a raster in another projection would stay pinned to a code none of them
    // holds any more, stranding every one of them as a permanent mismatch. So
    // a pin no registered member still reports is dropped before a new one is
    // taken, and the group re-pins on whoever is actually there.
    if (
      entry.projection &&
      !Array.from(entry.members.values()).some(
        (registered) => registered.projection === entry.projection,
      )
    ) {
      entry.projection = null;
    }
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
   * Read the seed a flagged member supplies for a group's opening view.
   *
   * Members read this at registration when the group holds no live view yet.
   * It is not cleared on read: the `x,y,zoom` form is adopted independently by
   * every member, and the bbox form stops being read once the first member
   * with a viewport promotes its fit through `seedGroupView`.
   *
   * @param {string} groupName
   * @returns {object|null} the parsed seed, or null when the group has none
   */
  const getGroupSeed = useCallback((groupName) => {
    const name = normalizeViewGroupName(groupName);
    if (!name) return null;
    const entry = groupsRef.current.get(name);
    return entry ? entry.pendingSeed : null;
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
      getGroupSeed,
      seedGroupView,
      reportMemberProjection,
    }),
    [
      registerMember,
      publishView,
      publishCursor,
      getGroupView,
      getGroupSeed,
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

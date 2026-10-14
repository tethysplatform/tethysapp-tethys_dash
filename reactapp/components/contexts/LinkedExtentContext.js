import { createContext, useCallback, useContext, useMemo, useRef } from "react";
import PropTypes from "prop-types";
import { normalizeViewGroupName } from "components/map/viewGroup";

export const LinkedExtentContext = createContext();

const NOOP_HANDLE = Object.freeze({ publish: () => {}, unregister: () => {} });
const NOOP_UNSUBSCRIBE = () => {};

// One entry per linked extent group. Mutable and held in a ref, like the view
// group registry: footprints change on every rendered frame of a pan, and
// React state would re-render every consumer on the dashboard for each one.
const createGroupEntry = () => ({
  // Registered members keyed by member id (a grid item UUID): each holds its
  // last published ring -- null while it has nothing on screen -- and the
  // view group it belongs to, so a subscriber can skip its own view peers.
  members: new Map(),
  // Callbacks told whenever any member's footprint changes.
  listeners: new Set(),
});

/**
 * Dashboard-scoped registry of linked extent groups.
 *
 * Unlike a view group, a linked extent group never moves anyone: each member
 * keeps its own view and only publishes the ground it currently covers, for a
 * Linked Extents layer on another member to outline. The two registries are
 * separate because a view group holds one shared view and pins a projection,
 * where this one holds a footprint per member and crosses projections.
 */
const LinkedExtentProvider = ({ children }) => {
  const groupsRef = useRef(new Map());

  const entryFor = useCallback((name) => {
    let entry = groupsRef.current.get(name);
    if (!entry) {
      entry = createGroupEntry();
      groupsRef.current.set(name, entry);
    }
    return entry;
  }, []);

  const dropIfEmpty = useCallback((name, entry) => {
    if (entry.members.size === 0 && entry.listeners.size === 0) {
      groupsRef.current.delete(name);
    }
  }, []);

  // Listeners are told which member changed, so one whose drawing that member
  // cannot affect -- its own map, a view-group peer -- can skip the work.
  const notify = useCallback((name, entry, memberId) => {
    // Snapshot: a listener may unsubscribe itself while we iterate.
    Array.from(entry.listeners).forEach((listener) => {
      try {
        listener({ memberId });
      } catch (error) {
        console.error(
          `Linked extent group "${name}": a listener failed`,
          error,
        );
      }
    });
  }, []);

  /**
   * Join a group. The returned handle publishes this member's footprint and
   * unregisters this registration only -- a stale handle from before a rename
   * or remount never takes the new registration down with it.
   *
   * @param {string} groupName raw (un-normalized) group name
   * @param {string} memberId grid item UUID
   * @param {{viewGroup?: string|null}} options
   */
  const register = useCallback(
    (groupName, memberId, { viewGroup = null } = {}) => {
      const name = normalizeViewGroupName(groupName);
      if (!name || memberId === null || memberId === undefined) {
        return NOOP_HANDLE;
      }
      const entry = entryFor(name);
      const record = { ring: null, viewGroup: viewGroup ?? null };
      entry.members.set(memberId, record);

      const isCurrent = () =>
        groupsRef.current.get(name)?.members.get(memberId) === record;

      return {
        publish: (ring) => {
          if (!isCurrent()) return;
          const next = ring ?? null;
          if (record.ring === next) return;
          record.ring = next;
          notify(name, entry, memberId);
        },
        unregister: () => {
          if (!isCurrent()) return;
          const hadRing = record.ring !== null;
          entry.members.delete(memberId);
          if (hadRing) notify(name, entry, memberId);
          dropIfEmpty(name, entry);
        },
      };
    },
    [entryFor, notify, dropIfEmpty],
  );

  /**
   * Be told whenever a group's footprints change. Subscribing does not make
   * the caller a member, so a read-only consumer -- the DataViewer preview --
   * can watch a group it is not in.
   */
  const subscribe = useCallback(
    (groupName, listener) => {
      const name = normalizeViewGroupName(groupName);
      if (!name || typeof listener !== "function") return NOOP_UNSUBSCRIBE;
      const entry = entryFor(name);
      entry.listeners.add(listener);
      return () => {
        const current = groupsRef.current.get(name);
        if (!current) return;
        current.listeners.delete(listener);
        dropIfEmpty(name, current);
      };
    },
    [entryFor, dropIfEmpty],
  );

  /** Every member of a group, with its current ring (possibly null). */
  const getFootprints = useCallback((groupName) => {
    const name = normalizeViewGroupName(groupName);
    const entry = name ? groupsRef.current.get(name) : null;
    if (!entry) return [];
    return Array.from(entry.members.entries()).map(([memberId, record]) => ({
      memberId,
      ring: record.ring,
      viewGroup: record.viewGroup,
    }));
  }, []);

  const contextValue = useMemo(
    () => ({ register, subscribe, getFootprints }),
    [register, subscribe, getFootprints],
  );

  return (
    <LinkedExtentContext.Provider value={contextValue}>
      {children}
    </LinkedExtentContext.Provider>
  );
};

LinkedExtentProvider.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
  ]),
};

export default LinkedExtentProvider;

/** The registry, or null outside a dashboard -- maps render outside it too. */
export const useLinkedExtentContext = () =>
  useContext(LinkedExtentContext) ?? null;

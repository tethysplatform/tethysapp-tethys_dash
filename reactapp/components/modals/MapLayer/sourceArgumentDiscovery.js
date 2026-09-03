import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getDependentVariableInputs,
  updateObjectWithVariableInputs,
} from "components/visualizations/utilities";
import { sourcePropertiesOptions } from "components/map/utilities";
import { listArrays, readMetadata } from "components/map/zarrReader";
import {
  s3UrlToHttps,
  listGeoPackageTables,
  invalidateGeoPackageTables,
  listGeoParquetColumns,
  invalidateGeoParquetColumns,
} from "components/map/ModuleLoader";
import {
  ERROR_KIND,
  errorKindFor,
  isRetryable,
} from "components/map/layerStatus";

// How long a read may run before the control says it is slow rather than just
// loading. The two routes are not comparable: a metadata read that takes this
// long is stuck, while a whole-file read that takes this long is ordinary for a
// large file and saying "slow" any earlier would be noise.
export const METADATA_SLOW_MS = 4000;
export const WHOLE_FILE_SLOW_MS = 12000;

// Shown for the one retryable failure kind. The browser reports an unreachable
// host and a blocked cross-origin request as the same opaque rejection, so the
// message has to name both rather than guess between them.
export const TRANSFER_REMEDY =
  "Check the URL is reachable and that the host sends CORS headers (Access-Control-Allow-Origin).";

/**
 * Turn a Zarr metadata read into slice options. The stored value is the slice
 * position; the label is whatever the store names that slice, falling back to
 * the position itself when the store carries no label array.
 */
function sliceOptions(meta) {
  const count = meta?.slice_count ?? 0;
  const labels = meta?.slice_labels ?? [];
  return Array.from({ length: count }, (_, index) => ({
    value: String(index),
    label: String(labels[index] ?? index),
  }));
}

const nameOptions = (names) =>
  (names ?? []).map((name) => ({ value: name, label: name }));

// Maps a declaration's route identifier to the function that reads it. This
// lives here rather than on the declaration so the source registry stays inert
// data: the registry is imported by nineteen modules, and a reader on the
// declaration would drag each reader's dependency chain into all of them.
const ROUTES = {
  zarrArrays: {
    slowAfter: METADATA_SLOW_MS,
    // `enumerated` is the whole point here: listArrays answers with no names
    // both for a store that holds none and for one that cannot be listed at
    // all, and only the first of those can testify that a saved value is gone.
    read: async ({ url }) => {
      const { names, enumerated } = await listArrays({ url });
      return { options: nameOptions(names), enumerated };
    },
  },
  zarrSlices: {
    slowAfter: METADATA_SLOW_MS,
    // Reports the count alongside the options: a stored slice is checked
    // against the range the array actually has, not against the option list.
    read: async ({ url, dependencies }) => {
      const meta = await readMetadata({ url, variable: dependencies.variable });
      return {
        options: sliceOptions(meta),
        sliceCount: meta?.slice_count ?? 0,
        enumerated: true,
      };
    },
  },
  geopackageTables: {
    slowAfter: WHOLE_FILE_SLOW_MS,
    invalidate: invalidateGeoPackageTables,
    read: async ({ url }) => ({
      options: nameOptions(await listGeoPackageTables(url)),
      enumerated: true,
    }),
  },
  geoparquetColumns: {
    slowAfter: WHOLE_FILE_SLOW_MS,
    invalidate: invalidateGeoParquetColumns,
    read: async ({ url }) => ({
      options: nameOptions(await listGeoParquetColumns(url)),
      enumerated: true,
    }),
  },
};

/**
 * The discoverable arguments a source type declares, as
 * `[{ argument, discover, type }]`. Reads the same registry the argument table
 * renders from, so a source opts in by declaration alone.
 */
export function discoverableArguments(sourceType) {
  const declaration = sourcePropertiesOptions[sourceType];
  if (!declaration) return [];
  return ["required", "optional"].flatMap((group) =>
    Object.entries(declaration[group] ?? [])
      .filter(([, spec]) => spec?.discover)
      .map(([argument, spec]) => ({
        argument,
        discover: spec.discover,
        type: spec.type,
      })),
  );
}

const hasUnresolvedTemplate = (value) =>
  typeof value === "string" && value.includes("${");

/**
 * Resolve one source-property value the way the render path will: variable
 * inputs substituted first, then the shared scheme normalizer. Discovery has to
 * target the same address the renderer targets, or an `s3://` store reports a
 * discovery failure for a layer that renders correctly.
 */
function resolveValue({
  value,
  normalizeScheme,
  variableInputValues,
  variableInputDateFormats,
}) {
  if (typeof value !== "string" || value === "") return null;
  let resolved = value;
  if (value.includes("${")) {
    try {
      const substituted = updateObjectWithVariableInputs({
        args: { value },
        variableInputs: variableInputValues ?? {},
        variableInputDateFormats: variableInputDateFormats ?? {},
      });
      resolved = substituted?.value ?? value;
    } catch {
      resolved = value;
    }
  }
  // A template the editor cannot resolve is not an address. Substitution leaves
  // an unknown variable as empty text rather than failing, which would turn
  // ".../${Storm}.zarr" into a real-looking ".../.zarr" and send a read at a
  // store that was never named - so an unsatisfied reference is checked for
  // before the result is trusted, not after.
  // `updateObjectWithVariableInputs` substitutes with `?? ""`, so it keeps 0 and
  // false. Testing falsiness here would refuse to read a url the renderer
  // resolves perfectly well - only an absent or blank value really collapses.
  const unsatisfied = getDependentVariableInputs(String(value)).some((name) => {
    const provided = (variableInputValues ?? {})[name];
    return provided === undefined || provided === null || provided === "";
  });
  if (unsatisfied || hasUnresolvedTemplate(resolved)) return null;
  return normalizeScheme ? s3UrlToHttps(resolved) : resolved;
}

/**
 * Translate a thrown reader error into the shape the shared error-kind
 * vocabulary reads. That vocabulary was written for the shapefile pipeline,
 * which reports failures as `{stage, reason}` values rather than throwing, so
 * browser errors need adapting rather than the vocabulary needing widening.
 */
export function failureFromError(error) {
  const detail = error?.message ?? String(error);
  const lowered = detail.toLowerCase();
  // A name the source does not contain is the author's input being wrong, and
  // no amount of retrying changes that. "not registered" belongs here too: a
  // file declaring a projection this app has no definition for will declare it
  // again on every retry, and offering a re-read there sends the author back
  // for a second identical failure with CORS advice attached to it.
  if (
    /not found|no such|does not contain|could not determine|not registered/.test(
      lowered,
    )
  ) {
    return { stage: "input", detail };
  }
  // The bytes arrived but are not what they claim to be. Also permanent.
  if (/parse|invalid|malformed|not a valid|unsupported/.test(lowered)) {
    return { stage: "parse", detail };
  }
  // Everything else - an opaque fetch rejection, a blocked cross-origin
  // request, a timeout - is a transfer problem and worth retrying.
  return { stage: "fetch", detail };
}

/**
 * Entries of a stored value that the source turned out not to offer.
 *
 * Nothing is corrected - the value stays exactly as the author left it. An
 * upstream rename says nothing about whether the author's intent was right,
 * and silently rewriting it would hide the very thing they need to see.
 */
export function staleEntries({ value, options, declaration, sliceCount }) {
  if (typeof value !== "string" || value === "") return [];

  const separator = declaration?.separator;
  const entries = separator
    ? value
        .split(separator)
        .map((part) => part.trim())
        .filter(Boolean)
    : [value];

  // A templated entry resolves per viewer, so the editor is in no position to
  // judge it. Applied per entry: one template among several must not silence
  // the check for its siblings.
  const judgeable = entries.filter((entry) => !hasUnresolvedTemplate(entry));

  // A slice is a position, so "absent" means out of range rather than not in a
  // set - an index left over from a previous array is a number the new array
  // simply does not go up to.
  if (typeof sliceCount === "number") {
    return judgeable.filter((entry) => {
      const position = Number(entry);
      return (
        !Number.isInteger(position) || position < 0 || position >= sliceCount
      );
    });
  }

  const available = new Set((options ?? []).map((option) => option.value));
  return judgeable.filter((entry) => !available.has(entry));
}

// One shared reference. The no-op guard in `update` compares by identity, so a
// fresh `[]` in a patch would defeat it for every state that carries no options.
const NO_OPTIONS = Object.freeze([]);

const EMPTY = Object.freeze({
  state: "idle",
  slow: false,
  options: NO_OPTIONS,
  sliceCount: undefined,
  enumerated: false,
  keyId: null,
  blockedBy: null,
  stale: NO_OPTIONS,
  failure: null,
  retryable: false,
});

/**
 * Lazily read the values a source's discoverable arguments can take.
 *
 * Nothing is read until `load(argument)` is called, which the control does when
 * the author opens its menu - the moment they have signalled they do not know
 * the answer. Results memoize per discovery key, so reopening is free and a key
 * change is what makes the next open read again.
 */
export default function useSourceArgumentDiscovery({
  sourceProps,
  variableInputValues,
  variableInputDateFormats,
}) {
  const [byArgument, setByArgument] = useState({});
  const cache = useRef(new Map());
  // Identifies the read that is allowed to publish. No reader accepts a
  // cancellation signal, so a superseded read cannot be aborted - it is
  // abandoned instead, and this is what stops it writing when it settles.
  const generation = useRef(new Map());
  const timers = useRef(new Map());
  // The keys as of the latest render. A read already in flight reads this to
  // notice its own key stopped being current - nothing else bumps the
  // generation when the author edits the url mid-read.
  const keysRef = useRef({});

  const sourceType = sourceProps?.type ?? null;
  const lastSourceType = useRef(sourceType);

  // Switching source type seeds the new type's rows from the old ones, so an
  // argument name shared across types carries its value over. Its discovery
  // state must not come with it: an option list or an absent-value flag from
  // one format would read as authoritative about a different one. Clearing the
  // generation map also abandons any read still in flight, so a late result
  // cannot publish into the new type.
  useEffect(() => {
    if (lastSourceType.current === sourceType) return;
    lastSourceType.current = sourceType;
    generation.current.clear();
    timers.current.forEach((timer) => clearTimeout(timer));
    timers.current.clear();
    setByArgument({});
  }, [sourceType]);

  // Reads are deliberately abandoned rather than aborted, but the slow-read
  // timers are ours: without this one fires long after the modal has closed.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const args = useMemo(() => discoverableArguments(sourceType), [sourceType]);

  // A discovery key is the resolved URL plus the resolved value of every
  // sibling the declaration says the route depends on. Zarr's slice list is
  // derived from whichever array is the reference, so choosing a different
  // array is itself an invalidation event - expressed as data on the
  // declaration rather than hardcoded here.
  const { keys, blocked } = useMemo(() => {
    const props = sourceProps?.props ?? {};
    const resolveOne = (value, normalizeScheme) =>
      resolveValue({
        value,
        normalizeScheme,
        variableInputValues,
        variableInputDateFormats,
      });
    const url = resolveOne(props.url, true);
    const built = {};
    // Why a key could not be built. "Enter a url" is the wrong thing to tell an
    // author whose url is fine but whose sibling argument is still blank.
    const blocked = {};
    args.forEach(({ argument, discover }) => {
      if (!url) {
        built[argument] = null;
        blocked[argument] = { reason: "url" };
        return;
      }
      const dependencies = {};
      let resolvable = true;
      let missingSibling = null;
      (discover.dependsOn ?? []).forEach((sibling) => {
        const resolved = resolveOne(props[sibling], false);
        if (!resolved) {
          resolvable = false;
          missingSibling = missingSibling ?? sibling;
        }
        dependencies[sibling] = resolved;
      });
      if (!resolvable)
        blocked[argument] = { reason: "dependency", missingSibling };
      built[argument] = resolvable
        ? {
            url,
            dependencies,
            id: `${discover.route}|${url}|${(discover.dependsOn ?? []).map((s) => dependencies[s]).join("|")}`,
          }
        : null;
    });
    return { keys: built, blocked };
  }, [args, sourceProps?.props, variableInputValues, variableInputDateFormats]);

  keysRef.current = keys;

  const update = useCallback((argument, patch) => {
    setByArgument((previous) => {
      const before = previous[argument];
      const after = { ...EMPTY, ...before, ...patch };
      // Re-opening an already-loaded menu asks for the same state again. Left
      // unguarded that publishes a fresh object every time and re-renders the
      // editor for a dropdown the author is only glancing at. A cached read
      // hands back the same options array by reference, so identity is enough.
      if (before && Object.keys(after).every((k) => after[k] === before[k])) {
        return previous;
      }
      return { ...previous, [argument]: after };
    });
  }, []);

  const run = useCallback(
    async (argument, { force } = {}) => {
      const entry = args.find((candidate) => candidate.argument === argument);
      const key = keys[argument];
      if (!entry) return;
      if (!key) {
        update(argument, {
          state: "nokey",
          failure: null,
          options: NO_OPTIONS,
          blockedBy: blocked[argument] ?? null,
        });
        return;
      }

      const route = ROUTES[entry.discover.route];
      // A declaration naming a route nothing implements would otherwise show an
      // empty menu, which reads as "this source has nothing" - the one thing it
      // must not be confused with.
      if (!route) {
        throw new Error(
          `No discovery route named "${entry.discover.route}" for argument "${argument}"`,
        );
      }

      if (force) {
        cache.current.delete(key.id);
        // The reader keeps its own cache behind this one. Clearing only the
        // memo would serve the same list straight back and the control would
        // spin without changing.
        route.invalidate?.(key.url);
      } else if (cache.current.has(key.id)) {
        const read = cache.current.get(key.id);
        update(argument, {
          state: read.options.length ? "ready" : "empty",
          options: read.options,
          sliceCount: read.sliceCount,
          enumerated: read.enumerated,
          keyId: key.id,
          failure: null,
          slow: false,
        });
        return;
      }

      const token = Symbol(argument);
      generation.current.set(argument, token);
      // Current means both "no newer read started" and "the key this read was
      // for is still the key the argument wants". Without the second half a
      // read begun against one url publishes into a different one.
      const current = () =>
        generation.current.get(argument) === token &&
        keysRef.current[argument]?.id === key.id;

      clearTimeout(timers.current.get(argument));
      // Stamped with the key it is loading for, or the entry would read as
      // belonging to the previous key and be hidden while the read runs.
      update(argument, {
        state: "loading",
        slow: false,
        failure: null,
        keyId: key.id,
      });
      const slowTimer = setTimeout(() => {
        if (current()) update(argument, { slow: true });
      }, route.slowAfter);
      timers.current.set(argument, slowTimer);

      try {
        const read = await route.read(key);
        if (!current()) return;
        cache.current.set(key.id, read);
        update(argument, {
          state: read.options.length ? "ready" : "empty",
          options: read.options,
          sliceCount: read.sliceCount,
          enumerated: read.enumerated,
          keyId: key.id,
          failure: null,
        });
      } catch (error) {
        if (!current()) return;
        const failure = failureFromError(error);
        const kind = errorKindFor(failure);
        update(argument, {
          state: "failed",
          options: NO_OPTIONS,
          keyId: key.id,
          retryable: isRetryable(kind),
          failure: {
            detail: failure.detail,
            remedy: kind === ERROR_KIND.FETCH ? TRANSFER_REMEDY : null,
          },
        });
      } finally {
        // Clear this read's own timer. Clearing by argument would cancel the
        // timer of whichever read superseded this one, and the live read would
        // never report itself slow.
        clearTimeout(slowTimer);
        if (timers.current.get(argument) === slowTimer) {
          timers.current.delete(argument);
        }
        if (current()) update(argument, { slow: false });
      }
    },
    [args, keys, blocked, update],
  );

  const load = useCallback((argument) => run(argument), [run]);
  const refresh = useCallback(
    (argument) => run(argument, { force: true }),
    [run],
  );

  // Staleness is derived rather than stored: it is a function of the value the
  // author currently has and the last read, and both change underneath it.
  const discoveries = useMemo(() => {
    const props = sourceProps?.props ?? {};
    const visible = {};
    args.forEach(({ argument, discover }) => {
      const stored = byArgument[argument] ?? EMPTY;
      // An entry belongs to the key it was read under. Editing the url does not
      // start a read - the next menu open does - so without this check the
      // previous store's options, and a warning derived from them, would sit
      // under a url they know nothing about.
      const currentKeyId = keys[argument]?.id ?? null;
      const entry =
        stored.keyId === null || stored.keyId === currentKeyId ? stored : EMPTY;

      // Only a source that was actually enumerated can testify that a value is
      // absent. A Zarr store without consolidated metadata reads as no names,
      // but that is "could not list", not "does not have" - flagging there
      // would accuse every valid hand-typed variable of being gone.
      const stale = entry.enumerated
        ? staleEntries({
            value: props[argument],
            options: entry.options,
            declaration: discover,
            sliceCount: entry.sliceCount,
          })
        : NO_OPTIONS;
      visible[argument] =
        entry === stored && stale === stored.stale
          ? stored
          : { ...entry, stale };
    });
    return visible;
  }, [args, byArgument, keys, sourceProps?.props]);

  return { discoveries, load, refresh };
}

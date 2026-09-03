import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { updateObjectWithVariableInputs } from "components/visualizations/utilities";
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
    read: async ({ url }) => nameOptions(await listArrays({ url })),
  },
  zarrSlices: {
    slowAfter: METADATA_SLOW_MS,
    read: async ({ url, dependencies }) =>
      sliceOptions(
        await readMetadata({ url, variable: dependencies.variable }),
      ),
  },
  geopackageTables: {
    slowAfter: WHOLE_FILE_SLOW_MS,
    invalidate: invalidateGeoPackageTables,
    read: async ({ url }) => nameOptions(await listGeoPackageTables(url)),
  },
  geoparquetColumns: {
    slowAfter: WHOLE_FILE_SLOW_MS,
    invalidate: invalidateGeoParquetColumns,
    read: async ({ url }) => nameOptions(await listGeoParquetColumns(url)),
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
  const referenced = String(value).match(/\$\{([^}]+)\}/g) ?? [];
  const unsatisfied = referenced.some((token) => {
    const name = token.slice(2, -1);
    return !(variableInputValues ?? {})[name];
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
  // no amount of retrying changes that.
  if (/not found|no such|does not contain|could not determine/.test(lowered)) {
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

const EMPTY = Object.freeze({
  state: "idle",
  slow: false,
  options: [],
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

  const args = useMemo(() => discoverableArguments(sourceType), [sourceType]);

  // A discovery key is the resolved URL plus the resolved value of every
  // sibling the declaration says the route depends on. Zarr's slice list is
  // derived from whichever array is the reference, so choosing a different
  // array is itself an invalidation event - expressed as data on the
  // declaration rather than hardcoded here.
  const keys = useMemo(() => {
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
    args.forEach(({ argument, discover }) => {
      if (!url) {
        built[argument] = null;
        return;
      }
      const dependencies = {};
      let resolvable = true;
      (discover.dependsOn ?? []).forEach((sibling) => {
        const resolved = resolveOne(props[sibling], false);
        if (!resolved) resolvable = false;
        dependencies[sibling] = resolved;
      });
      built[argument] = resolvable
        ? {
            url,
            dependencies,
            id: `${discover.route}|${url}|${(discover.dependsOn ?? []).map((s) => dependencies[s]).join("|")}`,
          }
        : null;
    });
    return built;
  }, [args, sourceProps?.props, variableInputValues, variableInputDateFormats]);

  keysRef.current = keys;

  const update = useCallback((argument, patch) => {
    setByArgument((previous) => ({
      ...previous,
      [argument]: { ...EMPTY, ...previous[argument], ...patch },
    }));
  }, []);

  const run = useCallback(
    async (argument, { force } = {}) => {
      const entry = args.find((candidate) => candidate.argument === argument);
      const key = keys[argument];
      if (!entry) return;
      if (!key) {
        update(argument, { state: "nokey", failure: null, options: [] });
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
        const options = cache.current.get(key.id);
        update(argument, {
          state: options.length ? "ready" : "empty",
          options,
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
      update(argument, { state: "loading", slow: false, failure: null });
      timers.current.set(
        argument,
        setTimeout(() => {
          if (current()) update(argument, { slow: true });
        }, route.slowAfter),
      );

      try {
        const options = await route.read(key);
        if (!current()) return;
        cache.current.set(key.id, options);
        update(argument, {
          state: options.length ? "ready" : "empty",
          options,
          failure: null,
        });
      } catch (error) {
        if (!current()) return;
        const failure = failureFromError(error);
        const kind = errorKindFor(failure);
        update(argument, {
          state: "failed",
          options: [],
          retryable: isRetryable(kind),
          failure: {
            detail: failure.detail,
            remedy: kind === ERROR_KIND.FETCH ? TRANSFER_REMEDY : null,
          },
        });
      } finally {
        clearTimeout(timers.current.get(argument));
        if (current()) update(argument, { slow: false });
      }
    },
    [args, keys, update],
  );

  const load = useCallback((argument) => run(argument), [run]);
  const refresh = useCallback(
    (argument) => run(argument, { force: true }),
    [run],
  );

  const discoveries = useMemo(() => {
    const visible = {};
    args.forEach(({ argument }) => {
      visible[argument] = byArgument[argument] ?? EMPTY;
    });
    return visible;
  }, [args, byArgument]);

  return { discoveries, load, refresh, keys };
}

import { useCallback, useMemo, useRef, useState } from "react";
import { updateObjectWithVariableInputs } from "components/visualizations/utilities";
import { acquireComponents } from "components/map/shapefile/acquire";
import { interpretShapefile } from "components/map/shapefile/index";
import { errorKindFor, ERROR_KIND } from "components/map/layerStatus";

// How long a pending read may run before the message escalates. A shapefile can
// take many seconds legitimately, and an indicator that never changes reads as a
// hang -- so the author retriggers the load and pays for it twice.
export const SLOW_LOAD_MS = 8000;

// What an author can actually do when the source cannot be fetched. Upload is
// not offered and a proxy is out of scope, so without naming this the author is
// told the cause and left with no move.
const FETCH_REMEDY =
  "If the host cannot be reached from a browser, convert the shapefile to GeoJSON and use the GeoJSON source instead.";

/**
 * Resolve a source URL for use in the editor.
 *
 * The editor holds the raw configuration, so a URL carrying a variable-input
 * template arrives here unsubstituted. Fetching it literally is guaranteed to
 * fail, which would make field discovery unusable for exactly the sources
 * variable inputs are most useful for.
 */
export function resolveShapefileUrl({
  sourceProps,
  variableInputValues,
  variableInputDateFormats,
}) {
  const url = sourceProps?.props?.url;
  if (typeof url !== "string" || url === "") return null;
  if (!url.includes("${")) return url;

  try {
    const substituted = updateObjectWithVariableInputs({
      args: { url },
      variableInputs: variableInputValues ?? {},
      variableInputDateFormats: variableInputDateFormats ?? {},
    });
    return substituted?.url ?? url;
  } catch {
    return url;
  }
}

// Every field name the saved configuration depends on, wherever it is recorded.
// Walked generically rather than by known path: rules nest conditions, and a
// field reference that moved would otherwise silently stop being checked.
export function collectReferencedFields({
  style,
  attributeProps,
  popupConfig,
}) {
  const referenced = new Set();

  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    Object.entries(node).forEach(([key, value]) => {
      if (
        (key === "conditionField" || key === "field") &&
        typeof value === "string" &&
        value !== ""
      ) {
        referenced.add(value);
      } else {
        walk(value);
      }
    });
  };

  walk(style);
  walk(popupConfig);

  // Attribute variables are keyed by field name, and omitted popup attributes
  // are lists of them.
  Object.values(attributeProps?.variables ?? {}).forEach((byField) =>
    Object.keys(byField ?? {}).forEach((field) => referenced.add(field)),
  );
  Object.values(attributeProps?.omitted ?? {}).forEach((list) =>
    (list ?? []).forEach((field) => referenced.add(field)),
  );

  return referenced;
}

/**
 * Author-triggered field discovery for a shapefile source.
 *
 * Not automatic. The style pane's own discovery effect re-runs whenever its
 * source props change, which for a typed URL means once per keystroke -- and
 * each run here is a multi-megabyte download. The editor already established
 * this pattern for remote GeoJSON with an explicit load action.
 *
 * Results are memoized against the resolved URL, so the style pane and the
 * attributes pane reading in turn cost one read between them.
 */
export function useShapefileDiscovery({
  sourceProps,
  layerName,
  variableInputValues,
  variableInputDateFormats,
  style,
  attributeProps,
  popupConfig,
}) {
  const [state, setState] = useState("idle");
  const [slow, setSlow] = useState(false);
  const [fields, setFields] = useState([]);
  const [failure, setFailure] = useState(null);
  const byUrl = useRef(new Map());

  const isShapefile = sourceProps?.type === "Shapefile";
  const resolvedUrl = isShapefile
    ? resolveShapefileUrl({
        sourceProps,
        variableInputValues,
        variableInputDateFormats,
      })
    : null;

  const load = useCallback(async () => {
    if (!resolvedUrl) return;

    const cached = byUrl.current.get(resolvedUrl);
    if (cached) {
      setFields(cached);
      setFailure(null);
      setState("ready");
      return;
    }

    setState("loading");
    setSlow(false);
    setFailure(null);
    const slowTimer = setTimeout(() => setSlow(true), SLOW_LOAD_MS);

    const report = (error) => {
      const kind = errorKindFor(error);
      setFailure({
        detail: error.detail,
        remedy: kind === ERROR_KIND.FETCH ? FETCH_REMEDY : null,
      });
      // Saved style rules, popup settings and attribute variables are left
      // exactly as they are: the source being unreachable says nothing about
      // whether the author's configuration is right.
      setState("error");
    };

    try {
      const acquired = await acquireComponents(resolvedUrl);
      if (acquired.cancelled) {
        setState("idle");
        return;
      }
      if (acquired.error) {
        report(acquired.error);
        return;
      }

      const interpreted = await interpretShapefile(acquired.components, {
        fallbackProjection: sourceProps?.props?.projection,
      });
      if (interpreted.error) {
        report(interpreted.error);
        return;
      }

      const discovered = Array.from(
        new Set(
          (interpreted.featureCollection.features ?? []).flatMap((feature) =>
            Object.keys(feature.properties ?? {}),
          ),
        ),
      );
      byUrl.current.set(resolvedUrl, discovered);
      setFields(discovered);
      setState("ready");
    } finally {
      clearTimeout(slowTimer);
      setSlow(false);
    }
  }, [resolvedUrl, sourceProps?.props?.projection]);

  // Field names the saved configuration references that the source does not
  // have. Storing no schema keeps the field list true to the source, but it
  // moves staleness into the rules that name those fields -- an upstream rename
  // leaves them matching nothing while the layer still renders, so nothing
  // fails and nobody is told.
  const drift = useMemo(() => {
    if (state !== "ready") return [];
    const available = new Set(fields);
    return Array.from(
      collectReferencedFields({ style, attributeProps, popupConfig }),
    )
      .filter((field) => !available.has(field))
      .sort();
  }, [state, fields, style, attributeProps, popupConfig]);

  return {
    isShapefile,
    resolvedUrl,
    state,
    slow,
    fields,
    failure,
    drift,
    layerName,
    load,
  };
}

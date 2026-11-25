import appAPI from "services/api/app";
import { spaceAndCapitalize } from "components/modals/utilities";
import {
  parseDateMath,
  parseDate,
  convertDatesToLocalISO,
  isPreset,
} from "components/inputs/dateUtils";
import { format } from "date-fns";
import {
  buildPreloadedVisualizationKey,
  takePreloadedVisualization,
} from "components/visualizations/preloadedVisualizationCache";

// In-memory cache of resolved image-visualization results, keyed by the
// request (source + resolved args). Image plugins are deterministic for a
// given args set, so a slider scrubbing back over already-fetched values — or
// a play-loop wrapping around — can reuse the prior result instead of
// re-hitting the backend, mirroring how a browser caches by request URL.
// Only `image`-type responses are stored; every other viz type still fetches
// fresh. Values are short URL strings, so a generous entry cap is cheap.
export const IMAGE_VIZ_CACHE_LIMIT = 2000;
const imageVizCache = new Map();

// Exported for unit tests of the null-coalescing branches; production code
// reaches the cache only through getVisualization.
export function buildImageVizCacheKey({ source, args }) {
  return JSON.stringify({ s: source ?? null, a: args ?? null });
}

// Preset sentinels ('latest') must re-resolve to the newest available resource
// on every load. A viz whose resolved args contain one bypasses the image
// cache entirely — otherwise the stable sentinel arg yields a stable cache key
// and a stale image is served instead of re-fetching.
function valueContainsPreset(value) {
  if (isPreset(value)) return true;
  if (Array.isArray(value)) return value.some(valueContainsPreset);
  if (value && typeof value === "object") {
    return Object.values(value).some(valueContainsPreset);
  }
  return false;
}

/**
 * Whether an arg type is a date the browser resolves: every type containing
 * "date" ("date", "date-hour", "date-range"), as DataInput renders a date
 * picker for each.
 */
export function isDateArgType(argType) {
  return typeof argType === "string" && argType.includes("date");
}

export function argsContainPreset(args, sourceArgs = {}) {
  if (!args || typeof args !== "object") return false;
  // Only date-typed args can legitimately hold a preset sentinel. Scoping to
  // them avoids disabling the cache when an unrelated arg's value happens to
  // equal "latest". date-range endpoints are nested, so recurse into values.
  return Object.entries(args).some(([key, value]) => {
    if (!isDateArgType(sourceArgs[key])) return false;
    return valueContainsPreset(value);
  });
}

// Exported for unit tests of the LRU read/evict logic; not part of the runtime
// API (production code reaches the cache only through getVisualization).
export function getCachedImageViz(key) {
  if (!imageVizCache.has(key)) return undefined;
  // Refresh recency so the LRU eviction below keeps hot frames.
  const value = imageVizCache.get(key);
  imageVizCache.delete(key);
  imageVizCache.set(key, value);
  return value;
}

export function setCachedImageViz(key, value) {
  if (imageVizCache.has(key)) imageVizCache.delete(key);
  imageVizCache.set(key, value);
  if (imageVizCache.size > IMAGE_VIZ_CACHE_LIMIT) {
    const oldest = imageVizCache.keys().next().value;
    imageVizCache.delete(oldest);
  }
}

/** Clears the image-visualization cache (used for test isolation). */
export function clearImageVizCache() {
  imageVizCache.clear();
}

/**
 * A number variable input's value as a number, or "" when it does not parse.
 *
 * parseFloat, not parseInt: a number input must accept decimals, and parseInt
 * turned every fractional value into its integer part (0.15 -> 0). NaN would
 * defeat hasVariableInputValue -- it is neither null nor "" -- so an unparseable
 * entry becomes "" instead, letting the empty-variable check report it.
 */
export function toNumberOrEmpty(value) {
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? "" : parsed;
}

/**
 * True when a variable input actually holds a value.
 *
 * Deliberately not a truthiness test. `0` and `false` are legitimate values for
 * number and checkbox inputs, and treating them as unset made a threshold of 0
 * report as "variable is empty" while substituting "" into the args.
 */
export function hasVariableInputValue(value) {
  return value !== undefined && value !== null && value !== "";
}

/**
 * The value a variable input publishes for its initial value: a number input
 * publishes a number (or "" when it does not parse), and a checkbox with no
 * initial value publishes false, since null is not a valid checkbox value.
 *
 * Shared by VariableInput and DashboardLoader's pre-render preload, so a
 * preloaded value is the same value the component would publish on mount.
 */
export function normalizeVariableInputValue({
  variable_options_source,
  initial_value,
}) {
  if (variable_options_source === "number") {
    return toNumberOrEmpty(initial_value);
  }
  if (variable_options_source === "checkbox" && initial_value === null) {
    return false;
  }
  return initial_value;
}

/**
 * The entries a variable input merges into the dashboard's variable input
 * values when it publishes `value`, or null when it publishes nothing.
 *
 * Truthiness plus 0 and false, not hasVariableInputValue: an initial value of
 * null or "" leaves the variable unset. An object value (a date range's
 * endpoints) also publishes each of its own keys.
 */
export function getPublishedVariableInputValues(variable_name, value) {
  if (!(value || value === false || value === 0)) return null;
  let published = { [variable_name]: value };
  if (typeof value === "object") {
    published = { ...published, ...value };
  }
  return published;
}

/**
 * The date format a variable input registers under its name, or null when its
 * value is not a date: date-type inputs use `metadata.format`, and a date
 * slider uses `metadata.outputFormat`.
 */
export function getVariableInputDateFormat({
  variable_options_source,
  metadata,
}) {
  if (
    typeof variable_options_source === "string" &&
    variable_options_source.includes("date")
  ) {
    return metadata?.format || null;
  }
  if (variable_options_source === "slider" && metadata?.dataType === "Date") {
    return metadata?.outputFormat || null;
  }
  return null;
}

/**
 * The preloaded-visualization cache key for a grid item's request: built from
 * its raw args and the variable inputs they reference, with the same
 * tokenizer the substituter uses. See buildPreloadedVisualizationKey for why
 * the inputs to substitution, not its output.
 */
export function buildPreloadedRequestKey({
  source,
  args,
  variableInputValues,
  variableInputDateFormats,
}) {
  return buildPreloadedVisualizationKey({
    source,
    args,
    variableInputValues,
    variableInputDateFormats,
    tokens: findUnresolvedVariableInputTokens(args),
  });
}

/**
 * Returns an array of warning messages when any variable inputs referenced by a
 * visualization's args have no value, or null if all inputs are populated.
 * Respects custom messaging configured in the grid item metadata.
 *
 * `optionalArgs` are the plugin's optional args (its metadata's
 * `optional_args`). A variable used only as one of them, as its whole value,
 * holds nothing back and shows no message: the plugin gets None for it and
 * decides what to show (see findGatingVariableInputTokens).
 */
export function checkForEmptyVariableInputs({
  metadataString,
  argsString,
  variableInputValues,
  optionalArgs = [],
}) {
  const metadata = JSON.parse(metadataString);
  // Walk the parsed args, NOT the JSON string, so the recursion can skip the
  // exempt subtrees (popupConfig, and a map layer's labels — see
  // FEATURE_SCAN_SKIP_KEYS). A flat regex over the JSON string would surface
  // popup-scoped variable inputs (e.g. `${Start Time}` declared inside the
  // popup) at the host level — those resolve inside the popup's own
  // FeatureScopedVariableInputs provider, not in the host context — and could
  // not tell a map layer's label template from an ordinary arg at all.
  const parsedArgs = JSON.parse(argsString);
  const allDependentVariableInputs = findGatingVariableInputTokens(
    parsedArgs,
    optionalArgs,
  );
  // Skip feature-scoped keys: they're populated by the
  // FeatureScopedVariableInputs provider on a per-feature basis and are
  // unbinding-by-design when no feature is active. Warning on every render
  // would spam the console.
  const dependentVariableInputs = allDependentVariableInputs.filter(
    (key) => !key.startsWith("feature."),
  );
  let warnings = [];

  if (
    !dependentVariableInputs.every((key) =>
      hasVariableInputValue(variableInputValues[key]),
    )
  ) {
    for (const dependentVariableInput of dependentVariableInputs) {
      if (!hasVariableInputValue(variableInputValues[dependentVariableInput])) {
        warnings.push(
          metadata.customMessaging?.[dependentVariableInput] ??
            `${dependentVariableInput} variable is empty`,
        );
      }
    }
  }

  if (warnings.length > 0 && metadata.customMessaging?.anyEmptyVariable) {
    warnings = [metadata.customMessaging.anyEmptyVariable];
  }

  return warnings.length > 0 ? warnings : null;
}

/**
 * Searches a nested visualization options array for an entry whose `source`
 * field matches `targetSource`. Returns the matching option object or null.
 */
export function findVisualizationBySource(data, targetSource) {
  for (const group of data) {
    for (const option of group.options) {
      if (option.source === targetSource) {
        return option;
      }
    }
  }
  return null;
}

/**
 * Returns a deduplicated list of variable input names referenced in `args`
 * using the `${variableName}` template syntax. Accepts either a string or an
 * object (which is JSON-serialised before scanning).
 */
export function getDependentVariableInputs(args) {
  const regex = /\${(.*?)}/g; // Matches ${variableName} placeholders
  const uniqueValues = new Set();

  if (typeof args !== "string") {
    args = JSON.stringify(args);
  }

  for (const match of args.matchAll(regex)) {
    uniqueValues.add(match[1]); // Extract the variable name
  }

  return [...uniqueValues];
}

/**
 * The arg type a plugin declares for a secret: a credential the author enters
 * once and the server stores encrypted, outside the tile's args. The arg keeps
 * its key in the saved args with the value "", which is all the browser is ever
 * served for it, and a typed value travels only in a pending entry (see
 * DashboardLoader) and in an editor's own requests.
 */
export const SECRET_ARG_TYPE = "secret";

/** The names of the args an args declaration types as secret. */
export function secretArgNames(argTypes) {
  if (!argTypes || typeof argTypes !== "object") return [];
  return Object.entries(argTypes)
    .filter(([, argType]) => argType === SECRET_ARG_TYPE)
    .map(([name]) => name);
}

/**
 * The plugin sources the visualization lists declare, each with the names of
 * its secret args: `AppContext`'s `visualizations` and `dynamicMapLayers`. A
 * source missing from the map is a plugin that is not installed, of whose args
 * nothing is known.
 *
 * @param {...Array} visualizationGroupLists Lists of `{label, options}` groups.
 * @returns {Map<string, Set<string>>} Plugin source -> its secret arg names.
 */
export function secretArgsBySource(...visualizationGroupLists) {
  const bySource = new Map();
  for (const groups of visualizationGroupLists) {
    for (const group of Array.isArray(groups) ? groups : []) {
      for (const option of group?.options ?? []) {
        if (typeof option?.source === "string") {
          bySource.set(option.source, new Set(secretArgNames(option.args)));
        }
      }
    }
  }
  return bySource;
}

/** A tile uuid as secrets are matched by it: in any case, null as "". */
export function normalizeTileUuid(tile) {
  return String(tile ?? "").toLowerCase();
}

/**
 * The key a secret goes by in the pending map: the tile's uuid, in any case,
 * the dynamic layer's `layerId` ("" for an arg of the tile itself), and the
 * arg's name. JSON, so no uuid, layer id or arg name can run into another.
 */
export function secretPlaceKey({ tile, layer, arg }) {
  return JSON.stringify([normalizeTileUuid(tile), layer || "", arg]);
}

/**
 * The pending secret values an editor's request for one tile or dynamic layer
 * adds to its args: each pending set entered there for its plugin `source`.
 * A pending clear adds nothing, since a blank secret arg already means "the
 * stored secret" to the server.
 *
 * @param {object} pendingSecrets The pending map (see DashboardLoader).
 * @param {object} place `{tile, layer, source}`.
 * @returns {object} `{argName: value}`, empty when none is pending.
 */
export function pendingSecretArgs(pendingSecrets, { tile, layer, source }) {
  const args = {};
  const wantedTile = normalizeTileUuid(tile);
  for (const entry of Object.values(pendingSecrets ?? {})) {
    if (
      typeof entry?.value === "string" &&
      entry.value !== "" &&
      normalizeTileUuid(entry.tile) === wantedTile &&
      (entry.layer || "") === (layer || "") &&
      entry.source === source
    ) {
      args[entry.arg] = entry.value;
    }
  }
  return args;
}

/**
 * Where a secret arg stands in an editor: "unset", "pendingSet" (one entered
 * and not saved yet), "pendingClear" (the stored one, to be cleared by the
 * next save) or "stored". A pending entry counts only for the plugin it was
 * entered for, and a stored secret only for the plugin it was stored for.
 *
 * @param {object} layout `pendingSecrets` and `isSecretStored`, from
 *   LayoutContext.
 * @param {object} place `{tile, layer, arg, source}`.
 * @returns {string} The status.
 */
export function secretArgStatus(
  { pendingSecrets, isSecretStored } = {},
  { tile, layer = "", arg, source } = {},
) {
  const pending = pendingSecrets?.[secretPlaceKey({ tile, layer, arg })];
  const pendingForPlugin = pending?.source === source ? pending : undefined;
  const stored = !!isSecretStored?.({ tile, layer, arg, source });
  if (typeof pendingForPlugin?.value === "string") return "pendingSet";
  if (pendingForPlugin && stored) return "pendingClear";
  if (stored) return "stored";
  return "unset";
}

// Whether a saved value holds a `${...}` token anywhere: the variable-input
// syntax the server's overlay of a viewer's request recognizes
// (saved_settings.TOKEN).
const HAS_TOKEN_RE = /\$\{[^}]+\}/;

// A value that is exactly one `${name}`. updateObjectWithVariableInputs gives
// such a value the variable's own type, or "" when the variable is empty, and
// findGatingVariableInputTokens exempts it in an optional arg for that reason.
const EXACT_VARIABLE_INPUT_TOKEN_RE = /^\$\{([^}]+)\}$/;

/**
 * The args a data request for a tile or dynamic layer sends.
 *
 * For a caller who may edit the dashboard (`allArgs`), every arg: such a
 * caller's request, sent with `allArgs`, runs as sent, work not saved yet
 * included. Anyone else's request runs the saved value of every arg but those
 * wired to a variable input and, on a tile, the date args the browser
 * resolves (tethysapp/tethysdash/saved_settings.py), so only those are sent:
 * an arg whose saved value holds a `${...}` token anywhere, and a tile's
 * date-typed arg. A secret arg is never sent blank, as it always is in the
 * args: the server holds its value. It goes only with a value an editor typed
 * (pendingSecretArgs), which only an editor's args hold.
 *
 * @param {object} options
 * @param {object} options.rawArgs The args as saved, tokens unresolved.
 * @param {object} options.resolvedArgs The same args, variable inputs filled in.
 * @param {object} [options.argTypes] The plugin's arg types, by name.
 * @param {string} options.kind "tile", or "layer" for a dynamic layer, which
 *   resolves no dates.
 * @param {boolean} options.allArgs Whether the caller may edit the dashboard.
 * @returns {object} The args to send.
 */
export function dataRequestArgs({
  rawArgs,
  resolvedArgs,
  argTypes,
  kind,
  allArgs,
}) {
  const secrets = secretArgNames(argTypes);
  const sent = {};
  for (const [name, value] of Object.entries(resolvedArgs ?? {})) {
    if (secrets.includes(name) && (value ?? "") === "") continue;
    if (
      allArgs ||
      HAS_TOKEN_RE.test(JSON.stringify(rawArgs?.[name] ?? null)) ||
      (kind === "tile" && isDateArgType(argTypes?.[name]))
    ) {
      sent[name] = value;
    }
  }
  return sent;
}

/**
 * The names of the args a tile or dynamic layer holds a stored secret for, as
 * the dashboard's `storedSecrets` list them, sorted. Lets a request that
 * relies on the stored secret tell when a save has stored or cleared one.
 */
export function storedSecretArgs(storedSecrets, { tile, layer }) {
  const wantedTile = normalizeTileUuid(tile);
  return (Array.isArray(storedSecrets) ? storedSecrets : [])
    .filter(
      (path) =>
        normalizeTileUuid(path?.tile) === wantedTile &&
        (path.layer || "") === (layer || ""),
    )
    .map((path) => path.arg)
    .sort();
}

/**
 * Fetches visualization data from the backend and updates viz state via the
 * provided `setVizType` / `setVizData` callbacks. Handles all built-in source
 * types (Map, Text, Custom Image) locally before calling the API. Emits
 * `vizWarning` when required variable inputs are empty and `vizError` on API
 * failure.
 *
 * `secretArgs` are the pending secret values an editor's request adds (see
 * pendingSecretArgs). They go into the request's args only: never into
 * `itemData.args`, which the caller keeps, nor into the image cache, which
 * no response of a plugin that declares a secret enters.
 *
 * `allArgs` says whether the caller may edit the dashboard: only then does
 * the request send every arg, and say so (see dataRequestArgs).
 *
 * `optionalArgs` are the plugin's optional args, which an empty variable does
 * not hold back (see checkForEmptyVariableInputs).
 */
export async function getVisualization({
  setVizType,
  setVizData,
  sourceType,
  sourceArgs,
  itemData,
  dashboardUUID,
  tileUUID,
  argsString,
  metadataString,
  variableInputValues,
  dashboardView,
  vizLoadingIcon = true,
  variableInputDateFormats = {},
  variableInputSliderMeta = {},
  refresh = false,
  secretArgs = null,
  allArgs,
  optionalArgs = [],
}) {
  const metadata = JSON.parse(metadataString);
  const emptyVariableWarnings = checkForEmptyVariableInputs({
    metadataString,
    argsString,
    variableInputValues,
    optionalArgs,
  });
  if (emptyVariableWarnings) {
    setVizType("vizWarning");
    setVizData({
      warnings: emptyVariableWarnings,
    });
    return;
  }

  if (itemData.source === "Map") {
    setVizType("map");
    // Restore each layer's popupConfig from the raw (unresolved) argsString so
    // that ${variable} template strings in popup gridItem args_string survive to
    // the popup visualization's own getVisualization call. Without this, the
    // Map-level updateObjectWithVariableInputs formats dates as locale strings
    // (e.g. "01/15/2024") which new Date() cannot parse, producing null args.
    //
    // A dynamic layer's plugin args are restored the same way, so its tokens
    // reach the runtime layer fetcher unresolved. The fetcher resolves them
    // itself, and has to see them to mask the map's own extent variable out
    // of the stamp that decides whether a paint zooms the map.
    //
    // Every other layer is built from its resolved source, so the raw source
    // goes alongside it as `rawSource` instead, for the same stamp (see
    // zoomOnChange.js).
    const rawLayers = JSON.parse(argsString).layers ?? [];
    const layers = (itemData.args.layers ?? []).map((layer, i) => {
      const rawPopupConfig = rawLayers[i]?.popupConfig;
      const rawPluginSource = rawLayers[i]?.configuration?.props?.pluginSource;
      const rawSource = rawLayers[i]?.configuration?.props?.source;
      let restored = rawPopupConfig
        ? { ...layer, popupConfig: rawPopupConfig }
        : layer;
      if (rawSource && !rawPluginSource) {
        restored = { ...restored, rawSource };
      }
      if (rawPluginSource) {
        const props = restored.configuration.props;
        restored = {
          ...restored,
          configuration: {
            ...restored.configuration,
            props: {
              ...props,
              pluginSource: {
                ...props.pluginSource,
                args: rawPluginSource.args,
              },
            },
          },
        };
      }
      return restored;
    });
    setVizData({
      baseMap: itemData.args.baseMap,
      layers,
      layerControl: itemData.args.layerControl,
      map_extent: itemData.args.map_extent,
      mapConfig: itemData.args.mapConfig,
      mapDrawing: itemData.args.mapDrawing,
      mapSelection: itemData.args.mapSelection,
    });

    return;
  } else if (itemData.source === "Text") {
    setVizType("text");
    setVizData({ text: itemData.args.text });

    return;
  } else if (itemData.source === "Custom Image") {
    const imageSource = itemData.args.image_source;
    const originalArgs = JSON.parse(argsString);
    const rawTemplate = originalArgs.image_source || "";
    const depVars = getDependentVariableInputs(rawTemplate);

    // If the image URL depends on a slider variable, generate all URLs
    // and use ImageSequence for instant frame switching
    const sliderVar = depVars.find(
      (v) => variableInputSliderMeta[v]?.values?.length > 0,
    );
    if (sliderVar) {
      const sliderValues = variableInputSliderMeta[sliderVar].values;
      const urls = sliderValues.map((val) => {
        const substituted = updateObjectWithVariableInputs({
          args: { ...originalArgs },
          variableInputs: { ...variableInputValues, [sliderVar]: val },
          variableInputDateFormats,
        });
        return substituted.image_source;
      });

      setVizType("imageSequence");
      setVizData({
        urls,
        activeUrl: imageSource,
        alt: "custom_image",
        imageError: metadata.customMessaging?.error,
      });
      return;
    }

    setVizType("image");
    setVizData({
      source: imageSource,
      alt: "custom_image",
      imageError: metadata.customMessaging?.error,
    });

    return;
  }

  itemData.args = updateObjectWithVariableInputs({
    args: JSON.parse(argsString),
    variableInputs: variableInputValues,
    variableInputDateFormats,
    sourceArgs,
    returnDatesAsLocalISO: true,
  });

  // Serve a previously-resolved image straight from cache (skipping both the
  // backend round-trip and the loader flash). Only image responses are ever
  // stored, so a hit is guaranteed to be an image. `refresh` (manual
  // refresh/retry) bypasses the cache and repopulates it below.
  const imageCacheKey = buildImageVizCacheKey(itemData);
  // A plugin that takes a secret answers for the secret it ran with, which
  // the cache key cannot see: a cached image could have come from another
  // secret, or another dashboard's.
  const skipImageCache =
    argsContainPreset(itemData.args, sourceArgs) ||
    secretArgNames(sourceArgs).length > 0;
  const sendsSecrets = !!secretArgs && Object.keys(secretArgs).length > 0;
  if (!refresh && !skipImageCache) {
    const cachedImage = getCachedImageViz(imageCacheKey);
    if (cachedImage !== undefined) {
      setVizType("image");
      setVizData({
        source: cachedImage,
        alt: itemData.source,
        imageError: metadata.customMessaging?.error,
      });
      return;
    }
  }

  // A plugin variable input DashboardLoader already started before the
  // dashboard rendered: await that request instead of running the plugin
  // again, whether it has settled or is still running past the preload's
  // budget. Taken, not read, so a later args change or a refresh fetches
  // normally. Only the dashboard's own tiles consume it -- the data viewer
  // previews a configuration rather than the loaded dashboard.
  const preloaded = dashboardView
    ? takePreloadedVisualization(
        itemData.requestId,
        buildPreloadedRequestKey({
          source: itemData.source,
          args: JSON.parse(argsString),
          variableInputValues,
          variableInputDateFormats,
        }),
      )
    : undefined;
  // A preloaded response ran with no pending secret.
  const usePreloaded = preloaded !== undefined && !refresh && !sendsSecrets;

  // No loader flash for a response that is already here; one still on its
  // way shows the loader like any other fetch.
  if (
    !(usePreloaded && preloaded.settled) &&
    vizLoadingIcon &&
    sourceType !== "map"
  ) {
    setVizType("loader");
  }

  const apiResponse = usePreloaded
    ? await preloaded.promise
    : await appAPI.getVisualizationData({
        dashboard: dashboardUUID,
        tile: tileUUID,
        source: itemData.source,
        args: {
          ...dataRequestArgs({
            rawArgs: JSON.parse(argsString),
            resolvedArgs: itemData.args,
            argTypes: sourceArgs,
            kind: "tile",
            allArgs,
          }),
          ...(sendsSecrets ? secretArgs : {}),
        },
        requestId: itemData.requestId,
        allArgs,
      });
  if (apiResponse.success === true) {
    let responseData = JSON.parse(JSON.stringify(apiResponse.data));
    if (typeof apiResponse.data === "string") {
      responseData = { value: apiResponse.data };
    }

    if (dashboardView) {
      responseData = updateObjectWithVariableInputs({
        args: responseData,
        variableInputs: variableInputValues,
      });
    }

    if (typeof apiResponse.data === "string") {
      responseData = responseData.value;
    }

    if (apiResponse.viz_type === "plotly") {
      setVizType("plotly");
      setVizData({
        data: responseData.data,
        layout: responseData.layout,
        config: responseData.config,
        // Plugin-driven subplot toggle opt-in (top-level figure keys).
        toggle_subplots: responseData.toggle_subplots,
        subplot_toggle: responseData.subplot_toggle,
        // Plugin-driven minimum plot size, in pixels (top-level keys).
        min_plot_height: responseData.min_plot_height,
        min_plot_width: responseData.min_plot_width,
      });
    } else if (apiResponse.viz_type === "card") {
      setVizType("card");
      setVizData({
        data: responseData.data,
        title: responseData.title,
        description: responseData.description,
      });
    } else if (apiResponse.viz_type === "table") {
      setVizType("table");
      setVizData({
        data: responseData.data,
        title: responseData.title,
        subtitle: responseData.subtitle,
      });
    } else if (apiResponse.viz_type === "image") {
      setVizType("image");
      setVizData({
        source: responseData,
        alt: itemData.source,
        imageError: metadata.customMessaging?.error,
      });
      if (!skipImageCache) {
        setCachedImageViz(imageCacheKey, responseData);
      }
    } else if (apiResponse.viz_type === "imageCollection") {
      setVizType("imageCollection");
      setVizData({
        urls: responseData.urls,
        title: responseData.title,
        columns: responseData.columns,
        imageError: metadata.customMessaging?.error,
      });
    } else if (apiResponse.viz_type === "map") {
      setVizType("map");
      setVizData({
        mapConfig: responseData.mapConfig,
        map_extent: responseData.map_extent,
        layers: responseData.layers,
        baseMap: responseData.baseMap,
        layerControl: responseData.layerControl,
      });
    } else if (apiResponse.viz_type === "custom") {
      setVizType("custom");
      setVizData({
        url: responseData.url,
        scope: responseData.scope,
        module: responseData.module,
        remoteType: responseData.remoteType ?? "webpack",
        props: responseData.props,
      });
    } else if (apiResponse.viz_type === "text") {
      setVizType("text");
      setVizData({
        text: responseData.text,
      });
    } else if (apiResponse.viz_type === "variable_input") {
      setVizType("variableInput");
      setVizData({
        variable_name: responseData.variable_name,
        initial_value: responseData.initial_value,
        show_label: responseData.show_label,
        variable_options_source: responseData.variable_options_source,
        metadata: responseData.metadata,
      });
    } else if (apiResponse.viz_type === "Live Chat") {
      setVizType("liveChat");
      setVizData({
        requestId: itemData.requestId,
        chatHistory: responseData.chatHistory,
      });
    } else {
      setVizType("vizWarning");
      setVizData({
        warnings: [
          `${apiResponse.viz_type} visualizations still need to be configured`,
        ],
      });
    }
  } else {
    setVizType("vizError");
    setVizData({
      error:
        metadata.customMessaging?.error ??
        apiResponse?.data?.error ??
        "Failed to retrieve data",
    });
  }
}

/**
 * Returns the grid item object with `i === gridItemI` from `gridItems`,
 * or undefined if no match is found.
 */
export function getGridItem(gridItems, gridItemI) {
  const result = gridItems.find((obj) => {
    return obj.i === gridItemI;
  });

  return result;
}

/**
 * Substitutes `${variableName}` template placeholders in `args` with the
 * corresponding values from `variableInputs`. Date-typed variable inputs are
 * formatted according to `variableInputDateFormats` before substitution.
 * An exact match like `"${foo}"` preserves the original value type; inline
 * matches within a longer string are stringified. Returns a new object with
 * all substitutions applied.
 */
export function updateObjectWithVariableInputs({
  args,
  variableInputs,
  variableInputDateFormats,
  sourceArgs = {},
  returnDatesAsLocalISO = false,
}) {
  const argsCopy = JSON.parse(JSON.stringify(args));
  const variableInputsCopy = JSON.parse(JSON.stringify(variableInputs));

  if (variableInputDateFormats) {
    for (let [variableInputKey, variableInputValue] of Object.entries(
      variableInputs,
    )) {
      const dateFormat = variableInputDateFormats[variableInputKey];
      if (dateFormat) {
        // Preset sentinels ('latest') are not dates — pass through verbatim so
        // the literal string survives substitution to the plugin's run().
        if (isPreset(variableInputValue)) {
          variableInputsCopy[variableInputKey] = variableInputValue;
          continue;
        }
        const updatedValue = parseDateMath({
          value: variableInputValue,
          dateFormat: dateFormat,
        });
        if (returnDatesAsLocalISO) {
          variableInputsCopy[variableInputKey] =
            convertDatesToLocalISO(updatedValue);
        } else {
          variableInputsCopy[variableInputKey] = format(
            updatedValue,
            dateFormat,
          );
        }
      }
    }
  }

  for (let gridItemsArg in argsCopy) {
    let value = argsCopy[gridItemsArg];

    if (typeof value !== "string") {
      value = JSON.stringify(value);
    }

    // FeatureScopedVariableInputs marks the merged context with this
    // sentinel. When absent we're at host scope, so unresolved
    // `${feature.<key>}` tokens must be PRESERVED for the popup to resolve
    // later. When present we're inside the popup scope and there is no
    // further resolution layer, so unresolved feature.* tokens fall back
    // to "" like any other missing variable.
    const inFeatureScope =
      variableInputsCopy.__tethysdash_feature_scope__ === true;

    // If value is exactly a variable input, preserve its type.
    // Matches the full string "${variableName}" with no surrounding text.
    const exactVarMatch = value.match(EXACT_VARIABLE_INPUT_TOKEN_RE);
    let updatedValuesWithVariableInputs;
    if (exactVarMatch) {
      const key = exactVarMatch[1];
      if (
        variableInputsCopy[key] === undefined &&
        key.startsWith("feature.") &&
        !inFeatureScope
      ) {
        updatedValuesWithVariableInputs = value;
      } else {
        // Nullish, not falsy: this branch exists to PRESERVE the value's type,
        // so a numeric 0 or a false checkbox must survive rather than collapse
        // to "". Matches the `?? ""` in the inline-replacement branch below.
        updatedValuesWithVariableInputs = variableInputsCopy[key] ?? "";
      }
    } else {
      // Value contains one or more inline ${variableName} placeholders mixed
      // with other text. Replaces each placeholder with its string equivalent.
      updatedValuesWithVariableInputs = value.replace(
        /\$\{([^}]+)\}/g,
        (_, key) => {
          if (
            variableInputsCopy[key] === undefined &&
            key.startsWith("feature.") &&
            !inFeatureScope
          ) {
            return "${" + key + "}";
          }
          if (typeof variableInputsCopy[key] === "object") {
            return JSON.stringify(variableInputsCopy[key]);
          }
          return variableInputsCopy[key] ?? "";
        },
      );
    }

    // Resolve relative ("now-1D") and absolute dates for any date-typed arg.
    // DataInput renders a date picker for every arg type containing "date"
    // (e.g. "date", "date-hour", "date-range"), so the resolver must cover them
    // all — not just exactly "date" — or relative dates leak to the API raw.
    const argType = sourceArgs[gridItemsArg];
    if (isDateArgType(argType)) {
      const dateFormat = variableInputDateFormats?.[gridItemsArg];

      if (argType === "date-range") {
        // Original value was an object → updatedValuesWithVariableInputs is a
        // JSON string here (see the stringify at the top of the loop). Parse it,
        // resolve each endpoint independently, then re-stringify so the
        // JSON.parse reassembly below restores the object shape.
        let rangeObj;
        try {
          rangeObj = JSON.parse(updatedValuesWithVariableInputs);
        } catch (e) {
          rangeObj = null;
        }
        if (
          rangeObj &&
          typeof rangeObj === "object" &&
          !Array.isArray(rangeObj)
        ) {
          for (const endpointKey of Object.keys(rangeObj)) {
            const endpointValue = rangeObj[endpointKey];
            if (typeof endpointValue === "string") {
              rangeObj[endpointKey] = convertDatesToLocalISO(
                parseDate(endpointValue, dateFormat),
              );
            }
          }
          updatedValuesWithVariableInputs = JSON.stringify(rangeObj);
        }
      } else {
        // Single date arg ("date", legacy "date-hour", etc.): value is a string.
        const parsedDate = parseDate(
          updatedValuesWithVariableInputs,
          dateFormat,
        );
        updatedValuesWithVariableInputs = convertDatesToLocalISO(parsedDate);
      }
    }

    if (typeof argsCopy[gridItemsArg] !== "string") {
      updatedValuesWithVariableInputs = JSON.parse(
        updatedValuesWithVariableInputs,
      );
    }
    argsCopy[gridItemsArg] = updatedValuesWithVariableInputs;
  }

  return argsCopy;
}

const FEATURE_TOKEN_RE = /\$\{(feature\.[^}]+)\}/g;
const VARIABLE_INPUT_TOKEN_RE = /\$\{([^}]+)\}/g;

// Object keys whose subtree is intentionally NOT scanned for unresolved
// tokens. Shared by BOTH scanners below. Each entry maps the key to the path
// its exemption is scoped to -- an ancestor that must appear somewhere above
// it, optionally plus the immediate parent it must sit under -- or `null` for
// "at any depth".
//
// The scoping is what keeps the exemption honest. These walkers run over EVERY
// visualization's args, not just the Map widget's, so a bare name match lets
// any plugin argument that merely happens to share the name suppress a real
// gate: a genuine `${feature.x}` beneath it would reach the plugin as an
// unresolved literal, and a genuine `${Some Input}` beneath it would never
// raise the unset-input warning. A distinctive compound name makes that
// collision unlikely; it does not make it impossible.
//
// `popupConfig` (any depth) — the Map widget's args carry a per-layer
// `popupConfig` (titleTemplate + nested popup gridItems' args_string) for
// round-tripping. Those tokens are meant to resolve later inside the popup's
// own FeatureScopedVariableInputs scope, NOT against the Map widget's host
// scope. Without this skip, opening any dashboard with a configured popup
// modal gates the entire Map widget on the popup's deferred tokens (both
// `${feature.*}` AND popup-internal variable input names such as
// `${Start Time}` declared by inner Variable Input grid items).
// It sits at `layers[i].popupConfig`, so it could be scoped exactly as `labels`
// is; it is deliberately left unscoped so its long-standing behaviour is
// untouched. Tightening it later is a one-line change here.
//
// `labels` (only at `layers[i].configuration.labels`) — a map layer's label
// template sits beside `configuration.style`, so the scope requires both a
// `layers` ancestor and `configuration` as the immediate parent. `labels` is a
// far more ordinary word than the keys above, and other visualizations really
// do use it — a plotly plugin's `subplot_toggle.labels`, a variable input's
// `metadata.labels` — so a bare-name match here would silently suppress a
// genuine gate on those. Pinning the full path is what keeps the exemption
// honest. A label is resolved per feature at draw
// time by the OpenLayers style function, so its `${feature.*}` references are
// never "unresolved" in the sense either scanner means. Both scanners must skip
// it, or a label alone can stop the map from rendering:
//   * the feature scanner gates the fetch in Base.js — one `${feature.station}`
//     in a label would flip the widget to `featurePending` and blank the map;
//   * the variable-input scanner feeds `checkForEmptyVariableInputs`, which
//     replaces the whole widget with a warning panel when any referenced input
//     is empty — and `hasVariableInputValue` counts "" as empty, so a viewer
//     clearing a text box referenced by a label would blank the map too.
// Accepted consequence: a variable input referenced ONLY inside a label
// template no longer raises the unset-input warning. That is the deliberate
// trade for not letting a label blank the map.
//
// `annotations` (only at `layers[i].configuration.annotations`) — an
// Annotations layer's authored lines and callouts, scoped exactly like
// `labels` and for the same reason. Callout text may reference a variable
// input, but a callout is not the map's data: an unset variable draws as empty
// text rather than replacing the whole map with the unset-input panel.
//
// Substitution is a separate path: `updateObjectWithVariableInputs` does not
// consult this set, so label templates and annotation text keep getting their
// variable inputs interpolated regardless of what is skipped here.
const FEATURE_SCAN_SKIP_KEYS = new Map([
  ["popupConfig", null],
  ["labels", { ancestor: "layers", parent: "configuration" }],
  ["annotations", { ancestor: "layers", parent: "configuration" }],
]);

// Does the path to the key being visited satisfy its scope? `null` means any
// depth; an object names an ancestor that must appear somewhere on the trail
// and, optionally, the immediate parent the key must sit directly under.
function skipScopeMatches(scope, trail) {
  if (scope === null) return true;
  return (
    (!scope.ancestor || trail.includes(scope.ancestor)) &&
    (!scope.parent || trail[trail.length - 1] === scope.parent)
  );
}

// Shared recursive walker. Returns the deduped set of capture-group-1 matches
// of `regex` across every string leaf, skipping any object key in `skipKeys`
// whose scoping ancestor (see the constant) is on the current path.
function collectTokens(value, regex, skipKeys) {
  const found = new Set();
  // Object keys on the path from the root to the node being visited, outermost
  // first. Array indices are not recorded, so `layers[0].configuration` leaves
  // the trail as ["layers", "configuration"]. Pushed and popped around each
  // descent so the walk stays a single pass; the linear `includes` below runs
  // only when a skip key name is actually hit.
  const trail = [];

  const visit = (v) => {
    if (typeof v === "string") {
      // Reset regex state — global regexes preserve `lastIndex` across
      // calls when they're shared at module scope.
      regex.lastIndex = 0;
      let match;
      while ((match = regex.exec(v)) !== null) {
        found.add(match[1]);
      }
    } else if (Array.isArray(v)) {
      for (const item of v) visit(item);
    } else if (v && typeof v === "object") {
      for (const key of Object.keys(v)) {
        if (skipKeys.has(key) && skipScopeMatches(skipKeys.get(key), trail)) {
          continue;
        }
        trail.push(key);
        visit(v[key]);
        trail.pop();
      }
    }
  };

  visit(value);
  return Array.from(found);
}

/**
 * Recursively walk an args object/array and return the unique set of
 * unresolved `${feature.<key>}` tokens still embedded in any string value.
 *
 * Used at edit time (popup layout editor) to detect that no feature is
 * currently in scope so the visualization fetch can be skipped in favor
 * of a friendly "awaiting feature selection" placeholder, instead of
 * letting plugins error out on the unresolved literal.
 *
 * Subtrees under keys in `FEATURE_SCAN_SKIP_KEYS` are skipped, each within the
 * path its entry scopes it to (`labelConfig` only inside a map's `layers`) —
 * see the constant for why.
 *
 * Returns an array of feature.<key> strings (without the `${}` wrapper),
 * deduplicated and in encounter order. Empty/non-string/non-object inputs
 * yield an empty array.
 */
export function findUnresolvedFeatureTokens(value) {
  return collectTokens(value, FEATURE_TOKEN_RE, FEATURE_SCAN_SKIP_KEYS);
}

/**
 * Recursively walk an args object/array and return the unique set of
 * `${<name>}` variable-input references embedded in any string value,
 * EXCLUDING the subtrees named in `FEATURE_SCAN_SKIP_KEYS` (popupConfig at any
 * depth, and labelConfig inside a map's `layers` — see the constant for why
 * each is exempt and how far each exemption reaches).
 *
 * Used by `checkForEmptyVariableInputs` so that a Map widget hosting a
 * popup modal whose inner gridItems define their own variable inputs
 * (e.g. `${Start Time}` supplied by a Variable Input grid item inside
 * the popup) does not gate the host map render on those popup-scoped
 * names. The host context will never have them — they're resolved inside
 * the popup's nested FeatureScopedVariableInputs provider when the popup
 * opens.
 *
 * Returns the capture-group-1 strings (without the `${}` wrapper),
 * deduplicated and in encounter order. Empty/non-string/non-object inputs
 * yield an empty array.
 */
export function findUnresolvedVariableInputTokens(value) {
  return collectTokens(value, VARIABLE_INPUT_TOKEN_RE, FEATURE_SCAN_SKIP_KEYS);
}

/**
 * The variable inputs whose emptiness holds a tile back: the tokens
 * `findUnresolvedVariableInputTokens` finds in `args`, less those used only
 * as an optional arg's whole value.
 *
 * Only an optional arg that is exactly one `${name}` exempts that name, since
 * only then does an empty variable reach the plugin as "", which it reads as
 * None. A template ("prefix ${name}") or an object or list holding the token
 * still holds the tile back. `feature.*` tokens are never exempt here: each
 * caller keeps its own handling of them.
 *
 * Shared by the tile's gate (checkForEmptyVariableInputs), the dashboard's
 * variable-input preload, and the editor's Custom Messaging list, so the three
 * agree on which variables can hold a tile back.
 *
 * @param {object} args - A tile's raw args, as saved.
 * @param {string[]} optionalArgs - The plugin's optional arg names.
 * @returns {string[]} Variable input names, deduplicated, in encounter order.
 */
export function findGatingVariableInputTokens(args, optionalArgs = []) {
  if (!optionalArgs?.length || !args || typeof args !== "object") {
    return findUnresolvedVariableInputTokens(args);
  }
  const scanned = Object.fromEntries(
    Object.entries(args).filter(([name, value]) => {
      if (!optionalArgs.includes(name) || typeof value !== "string") {
        return true;
      }
      const exact = value.match(EXACT_VARIABLE_INPUT_TOKEN_RE);
      const exempt = exact !== null && !exact[1].startsWith("feature.");
      return !exempt;
    }),
  );
  return findUnresolvedVariableInputTokens(scanned);
}

export const nonDropDownVariableInputTypes = [
  "text",
  "number",
  "checkbox",
  {
    label: "date",
    value: "date",
    sub_args: { metadata: "custom-DateMetadata" },
  },
  {
    label: "dropdown",
    value: "dropdown",
    sub_args: { metadata: "custom-DropdownMetadata" },
  },
  {
    label: "date-range",
    value: "date-range",
    sub_args: { metadata: "custom-DateRangeMetadata" },
  },
  {
    value: "slider",
    label: "slider",
    sub_args: { metadata: "custom-SliderMetadata" },
  },
  {
    value: "csv-uploader",
    label: "csv uploader",
    sub_args: { metadata: "custom-CSVUploaderMetadata" },
  },
];

export const baseMapLayers = [
  {
    label: "ArcGIS Map Service Base Maps",
    options: [
      {
        label: "World Light Gray Base",
        value:
          "https://server.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer",
      },
      {
        label: "World Dark Gray Base",
        value:
          "https://server.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer",
      },
      {
        label: "World Topo Map",
        value:
          "https://server.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer",
      },
      {
        label: "World Imagery",
        value:
          "https://server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer",
      },
      {
        label: "World Terrain Base",
        value:
          "https://server.arcgisonline.com/arcgis/rest/services/World_Terrain_Base/MapServer",
      },
      {
        label: "World Street Map",
        value:
          "https://server.arcgisonline.com/arcgis/rest/services/World_Street_Map/MapServer",
      },
      {
        label: "World Physical Map",
        value:
          "https://server.arcgisonline.com/arcgis/rest/services/World_Physical_Map/MapServer",
      },
      {
        label: "World Shaded Relief",
        value:
          "https://server.arcgisonline.com/arcgis/rest/services/World_Shaded_Relief/MapServer",
      },
      {
        label: "World Terrain Reference",
        value:
          "https://server.arcgisonline.com/arcgis/rest/services/World_Terrain_Reference/MapServer",
      },
      {
        label: "World Hillshade Dark",
        value:
          "https://server.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade_Dark/MapServer",
      },
      {
        label: "World Hillshade",
        value:
          "https://server.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade/MapServer",
      },
      {
        label: "World Boundaries and Places Alternate",
        value:
          "https://server.arcgisonline.com/arcgis/rest/services/Reference/World_Boundaries_and_Places_Alternate/MapServer",
      },
      {
        label: "World Boundaries and Places",
        value:
          "https://server.arcgisonline.com/arcgis/rest/services/Reference/World_Boundaries_and_Places/MapServer",
      },
      {
        label: "World Reference Overlay",
        value:
          "https://server.arcgisonline.com/arcgis/rest/services/Reference/World_Reference_Overlay/MapServer",
      },
      {
        label: "World Transportation",
        value:
          "https://server.arcgisonline.com/arcgis/rest/services/Reference/World_Transportation/MapServer",
      },
      {
        label: "World Ocean Base ",
        value:
          "https://server.arcgisonline.com/arcgis/rest/services/Ocean/World_Ocean_Base/MapServer",
      },
      {
        label: "World Ocean Reference",
        value:
          "https://server.arcgisonline.com/arcgis/rest/services/Ocean/World_Ocean_Reference/MapServer",
      },
    ],
  },
];

export function getBaseMapLayer(baseMapURL) {
  if (!baseMapURL.includes("/")) return null;

  const baseMapURLSplit = baseMapURL.split("/");
  const baseMapName = spaceAndCapitalize(
    baseMapURLSplit[baseMapURLSplit.length - 2],
  );
  const layer_dict = {
    type: "WebGLTile",
    props: {
      source: {
        type: "Image Tile",
        props: {
          url: baseMapURL + "/tile/{z}/{y}/{x}",
          attributions: 'Tiles © <a href="' + baseMapURL + '">ArcGIS</a>',
        },
      },
      name: baseMapName,
    },
  };

  return layer_dict;
}

/**
 * Recursively searches a nested select-options array for the first element
 * where `element[searchKey] === searchValue`. Descends into `element.options`
 * arrays. Returns the matching element or null.
 */
export function findSelectOptionByValue(
  data,
  searchValue,
  searchKey = "value",
) {
  for (const element of data) {
    if (element[searchKey] === searchValue || element === searchValue) {
      return element; // Return the matching element
    }

    if (element.options && Array.isArray(element.options)) {
      const found = findSelectOptionByValue(
        element.options,
        searchValue,
        searchKey,
      ); // Recursively search in options
      if (found) {
        return found; // Return the matching element from nested options
      }
    }
  }
  return null; // Return null if no match is found
}

/** Save a blob as a file the browser downloads. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}

export function downloadJSONFile(data, filename) {
  const jsonString = JSON.stringify(data, null, 2);
  downloadBlob(new Blob([jsonString], { type: "application/json" }), filename);
}

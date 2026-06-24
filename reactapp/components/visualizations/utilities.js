import appAPI from "services/api/app";
import { spaceAndCapitalize } from "components/modals/utilities";
import {
  parseDateMath,
  parseDate,
  convertDatesToLocalISO,
} from "components/inputs/dateUtils";
import { format } from "date-fns";

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
 * Returns an array of warning messages when any variable inputs referenced by a
 * visualization's args have no value, or null if all inputs are populated.
 * Respects custom messaging configured in the grid item metadata.
 */
export function checkForEmptyVariableInputs({
  metadataString,
  argsString,
  variableInputValues,
}) {
  const metadata = JSON.parse(metadataString);
  // Walk the parsed args, NOT the JSON string, so the recursion can skip the
  // popupConfig subtree. A flat regex over the JSON string would surface
  // popup-scoped variable inputs (e.g. `${Start Time}` declared inside the
  // popup) at the host level — those resolve inside the popup's own
  // FeatureScopedVariableInputs provider, not in the host context.
  const parsedArgs = JSON.parse(argsString);
  const allDependentVariableInputs =
    findUnresolvedVariableInputTokens(parsedArgs);
  // Skip feature-scoped keys: they're populated by the
  // FeatureScopedVariableInputs provider on a per-feature basis and are
  // unbinding-by-design when no feature is active. Warning on every render
  // would spam the console.
  const dependentVariableInputs = allDependentVariableInputs.filter(
    (key) => !key.startsWith("feature."),
  );
  let warnings = [];

  if (!dependentVariableInputs.every((key) => variableInputValues[key])) {
    for (const dependentVariableInput of dependentVariableInputs) {
      if (!variableInputValues[dependentVariableInput]) {
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
 * Fetches visualization data from the backend and updates viz state via the
 * provided `setVizType` / `setVizData` callbacks. Handles all built-in source
 * types (Map, Text, Custom Image) locally before calling the API. Emits
 * `vizWarning` when required variable inputs are empty and `vizError` on API
 * failure.
 */
export async function getVisualization({
  setVizType,
  setVizData,
  sourceType,
  sourceArgs,
  itemData,
  argsString,
  metadataString,
  variableInputValues,
  dashboardView,
  vizLoadingIcon = true,
  variableInputDateFormats = {},
  variableInputSliderMeta = {},
  refresh = false,
}) {
  const metadata = JSON.parse(metadataString);
  const emptyVariableWarnings = checkForEmptyVariableInputs({
    metadataString,
    argsString,
    variableInputValues,
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
    const rawLayers = JSON.parse(argsString).layers ?? [];
    const layers = (itemData.args.layers ?? []).map((layer, i) => {
      const rawPopupConfig = rawLayers[i]?.popupConfig;
      return rawPopupConfig ? { ...layer, popupConfig: rawPopupConfig } : layer;
    });
    setVizData({
      baseMap: itemData.args.baseMap,
      layers,
      layerControl: itemData.args.layerControl,
      map_extent: itemData.args.map_extent,
      mapConfig: itemData.args.mapConfig,
      mapDrawing: itemData.args.mapDrawing,
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
  if (!refresh) {
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

  if (vizLoadingIcon && sourceType !== "map") {
    setVizType("loader");
  }

  const apiResponse = await appAPI.getVisualizationData(itemData);
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
      setCachedImageViz(imageCacheKey, responseData);
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
    const exactVarMatch = value.match(/^\$\{([^}]+)\}$/);
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
        updatedValuesWithVariableInputs = variableInputsCopy[key] || "";
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
    if (typeof argType === "string" && argType.includes("date")) {
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
// tokens. The Map widget's args carry per-layer `popupConfig` (titleTemplate
// + nested popup gridItems' args_string) for round-tripping — those tokens
// are meant to resolve later inside the popup's own FeatureScopedVariableInputs
// scope, NOT against the Map widget's host scope. Without this skip, opening
// any dashboard with a configured popup modal gates the entire Map widget on
// the popup's deferred tokens (both `${feature.*}` AND popup-internal
// variable input names such as `${Start Time}` declared by inner Variable
// Input grid items).
const FEATURE_SCAN_SKIP_KEYS = new Set(["popupConfig"]);

// Shared recursive walker. Returns the deduped set of capture-group-1 matches
// of `regex` across every string leaf, skipping any object key in `skipKeys`.
function collectTokens(value, regex, skipKeys) {
  const found = new Set();

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
        if (skipKeys.has(key)) continue;
        visit(v[key]);
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
 * Subtrees under keys in `FEATURE_SCAN_SKIP_KEYS` are skipped — see the
 * constant for why.
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
 * EXCLUDING the popupConfig subtree.
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

export function downloadJSONFile(data, filename) {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}

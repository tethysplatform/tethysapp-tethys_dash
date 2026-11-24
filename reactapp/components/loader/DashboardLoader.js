import PropTypes from "prop-types";
import {
  useState,
  useEffect,
  useContext,
  useRef,
  memo,
  useCallback,
  useMemo,
} from "react";
import LoadingAnimation from "components/loader/LoadingAnimation";
import appAPI from "services/api/app";
import {
  VariableInputsContext,
  LayoutContext,
  EditingContext,
  DisabledEditingMovementContext,
  DataViewerModeContext,
  AvailableDashboardsContext,
  TabContext,
  AppContext,
} from "components/contexts/Contexts";
import ViewGroupProvider from "components/contexts/ViewGroupContext";
import LinkedExtentProvider from "components/contexts/LinkedExtentContext";
import {
  toNumberOrEmpty,
  secretArgsBySource,
  secretPlaceKey,
  normalizeTileUuid,
} from "components/visualizations/utilities";
import { readArgsValue } from "components/dashboard/importIdentity";
import Error from "components/error/Error";
import errorImage from "assets/error404.png";
import { preloadPluginVariableInputs } from "components/loader/variableInputPreload";
import { clearPreloadedVisualizations } from "components/visualizations/preloadedVisualizationCache";

/**
 * Scans grid items for the variable input values the dashboard owns: each
 * built-in Variable Input's initial value (and a date range's endpoints), and
 * a null placeholder for every map layer attribute variable.
 *
 * Returns `seeds` (key -> the seeded value, plus the Variable Input's options
 * source when its value needs the same coercion VariableInput applies), the
 * `dateFormats` those inputs register, `keysByTab`, the keys each tab owns,
 * and `uuidsByTab`, the grid item uuids each tab holds. Pure, so the value a
 * seed resolves to can be computed against the latest state inside a
 * functional update.
 */
function buildVariableInputSeeds(tabs) {
  const seeds = {};
  const dateFormats = {};
  const keysByTab = new Map();
  const uuidsByTab = new Map();

  for (let tab of tabs) {
    const tabKeys = new Set();
    const tabUUIDs = new Set();
    for (let gridItem of tab.gridItems) {
      if (gridItem.uuid) tabUUIDs.add(gridItem.uuid);
      let gridItemValues = {};
      const args = JSON.parse(gridItem.args_string);

      if (gridItem.source === "Variable Input") {
        gridItemValues[args.variable_name] = args.initial_value;

        if (args.initial_value && typeof args.initial_value === "object") {
          for (let [key, value] of Object.entries(args.initial_value)) {
            gridItemValues[key] = value;
          }
        }
      }

      if (gridItem.source === "Map") {
        const mapLayers = args.layers || [];
        for (let layer of mapLayers) {
          const layerVariableInputs = layer.attributeVariables || {};
          for (let layerAttributes of Object.values(layerVariableInputs)) {
            for (let attributeVariableInput of Object.values(layerAttributes)) {
              if (!(attributeVariableInput in seeds)) {
                gridItemValues[attributeVariableInput] = null;
              } else {
                // Already seeded, by an earlier grid item or tab, but this
                // tab uses it too: it owns the key, so updating the other
                // tab alone does not release it.
                tabKeys.add(attributeVariableInput);
              }
            }
          }
        }
      }

      for (let [key, value] of Object.entries(gridItemValues)) {
        let dateFormat;
        if (gridItem.source === "Variable Input") {
          if (args.variable_options_source.includes("date")) {
            dateFormat =
              args?.["variable_options_source.metadata"]?.format || "";
          } else if (
            args.variable_options_source === "slider" &&
            args["variable_options_source.metadata"]?.dataType === "Date"
          ) {
            dateFormat = args["variable_options_source.metadata"].outputFormat;
          }
        }

        seeds[key] = {
          value,
          variableOptionsSource:
            gridItem.source === "Variable Input"
              ? args.variable_options_source
              : null,
        };
        tabKeys.add(key);
        if (dateFormat) {
          dateFormats[key] = dateFormat;
        }
      }
    }
    keysByTab.set(tab.id, tabKeys);
    uuidsByTab.set(tab.id, tabUUIDs);
  }

  return { seeds, dateFormats, keysByTab, uuidsByTab };
}

/**
 * Merges seeds into `previousValues`. A key that already holds a value keeps
 * it, so an edit does not reset a variable the user has changed; `released`
 * keys, owned by a grid item that no longer exists, are removed. Every other
 * key -- a plugin variable input's value above all, which no scan can see --
 * is left as it is.
 */
function applyVariableInputSeeds(previousValues, seeds, released = []) {
  const nextValues = { ...previousValues };
  for (const key of released) {
    delete nextValues[key];
  }
  for (const [key, { value, variableOptionsSource }] of Object.entries(seeds)) {
    // Read after the release, so a key released here and seeded by a new
    // owner in the same pass starts from the new owner's value.
    let initialValue = nextValues[key] === undefined ? value : nextValues[key];

    if (variableOptionsSource === "checkbox" && initialValue === null) {
      initialValue = false;
    }

    // Seed the same type VariableInput itself publishes. Without this the
    // boot-time seed is the raw string ("0.3") while the mount effect
    // publishes a number (0.3), so the context value's type depended on which
    // landed last.
    if (variableOptionsSource === "number") {
      initialValue = toNumberOrEmpty(initialValue);
    }

    nextValues[key] = initialValue;
  }
  return nextValues;
}

function unionOfKeys(keysByTab) {
  const keys = new Set();
  for (const tabKeys of keysByTab.values()) {
    for (const key of tabKeys) keys.add(key);
  }
  return keys;
}

function readArgs(raw) {
  const args = readArgsValue(raw)?.args;
  return args && !Array.isArray(args) ? args : {};
}

/** `map` less the entries `shouldDrop(key, value)` picks; `map` if none. */
function omitEntries(map, shouldDrop) {
  const kept = Object.fromEntries(
    Object.entries(map).filter(([key, value]) => !shouldDrop(key, value)),
  );
  return Object.keys(kept).length === Object.keys(map).length ? map : kept;
}

/**
 * Every place grid items hold a plugin's args, as `{tile, layer, source,
 * args}`: each tile, top-level or in a layer popup at any depth, and each
 * dynamic layer of a Map tile (`layer` its `layerId`, "" for a tile). The
 * server finds the places a secret can be set the same way
 * (`iter_plugin_arg_paths` in saved_settings.py).
 */
function collectArgPlaces(gridItems, places = []) {
  for (const item of Array.isArray(gridItems) ? gridItems : []) {
    if (!item || typeof item !== "object") continue;
    const args = readArgs(item.args_string);
    const tile = typeof item.uuid === "string" && item.uuid ? item.uuid : null;
    if (tile) places.push({ tile, layer: "", source: item.source, args });
    if (item.source !== "Map") continue;
    for (const layer of Array.isArray(args.layers) ? args.layers : []) {
      const props = layer?.configuration?.props;
      const pluginSource = props?.pluginSource;
      if (
        tile &&
        pluginSource &&
        typeof pluginSource === "object" &&
        typeof props.layerId === "string" &&
        props.layerId
      ) {
        places.push({
          tile,
          layer: props.layerId,
          source: pluginSource.source,
          args: readArgs(pluginSource.args),
        });
      }
      collectArgPlaces(layer?.popupConfig?.gridItems, places);
    }
  }
  return places;
}

/** The places tabs hold plugin args, grouped by tile and layer. */
function argPlacesByKey(tabs) {
  const byKey = new Map();
  for (const tab of Array.isArray(tabs) ? tabs : []) {
    for (const place of collectArgPlaces(tab?.gridItems)) {
      const key = secretPlaceKey({ ...place, arg: "" });
      byKey.set(key, [...(byKey.get(key) ?? []), place]);
    }
  }
  return byKey;
}

/** The one place tabs hold a pending secret's arg, or null for none or many. */
function placeOf(placesByKey, { tile, layer }) {
  const matches = placesByKey.get(secretPlaceKey({ tile, layer, arg: "" }));
  return matches?.length === 1 ? matches[0] : null;
}

/**
 * The secret changes a save of `tabs` carries: one `{tile, layer, arg,
 * value}` for each pending entry still pointing at a secret arg of the plugin
 * it was entered for, `value` the secret to set or null to clear it.
 *
 * The rest is stale and dropped: a tile or layer deleted since, or one whose
 * plugin changed (the save sweeps the old plugin's stored secret anyway), an
 * arg no longer in its args, or one the plugin no longer declares secret. The
 * server refuses a whole save that sets a secret anywhere else.
 *
 * @param {object} pendingSecrets The pending map: secretPlaceKey -> `{tile,
 *   layer, arg, source, value}`.
 * @param {Array} tabs The tabs being saved.
 * @param {Map} secretArgsOf Plugin source -> its secret arg names.
 * @returns {Array} The changes, in the pending map's order.
 */
export function secretChangesToSave(pendingSecrets, tabs, secretArgsOf) {
  const entries = Object.values(pendingSecrets ?? {});
  if (entries.length === 0) return [];
  const placesByKey = argPlacesByKey(tabs);
  const changes = [];
  for (const entry of entries) {
    const place = placeOf(placesByKey, entry);
    if (
      place &&
      place.source === entry.source &&
      Object.prototype.hasOwnProperty.call(place.args, entry.arg) &&
      secretArgsOf.get(place.source)?.has(entry.arg)
    ) {
      changes.push({
        tile: entry.tile,
        layer: entry.layer || "",
        arg: entry.arg,
        value: entry.value,
      });
    }
  }
  return changes;
}

/**
 * What the dashboard knows about its stored secrets: the server's list of the
 * places holding one, and, for each, the plugin source its tile or layer was
 * saved with. A secret is stored for that plugin only, so an editor that has
 * switched the plugin since must not report it as set.
 */
function readSecretStatus(storedSecrets, tabs) {
  const stored = Array.isArray(storedSecrets) ? storedSecrets : [];
  const sources = new Map();
  if (stored.length === 0) return { stored, sources };
  const placesByKey = argPlacesByKey(tabs);
  for (const path of stored) {
    const place = placeOf(placesByKey, path);
    if (place) sources.set(secretPlaceKey(path), place.source);
  }
  return { stored, sources };
}

const NO_SECRET_STATUS = readSecretStatus([], []);

const DashboardLoader = ({
  children,
  id,
  name,
  uuid,
  publicDashboard,
  userPermission,
  permissions,
  unrestrictedPlacement,
  autoThumbnail = true,
  description,
  owner,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [variableInputValues, setVariableInputValues] = useState({});
  const [variableInputDateFormats, setVariableInputDateFormats] = useState({});
  const [variableInputSliderMeta, setVariableInputSliderMeta] = useState({});
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [notes, setNotes] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [disabledEditingMovement, setDisabledEditingMovement] = useState(false);
  const [inDataViewerMode, setInDataViewerMode] = useState(false);
  // Progress of the pre-render plugin variable input preload, or null when
  // none is running: { completed, total }.
  const [variableInputPreload, setVariableInputPreload] = useState(null);
  const { updateDashboard } = useContext(AvailableDashboardsContext);
  const { visualizations, dynamicMapLayers } = useContext(AppContext) ?? {};
  // Which places hold a stored secret, as the server last said (see
  // readSecretStatus). Never a value: the server serves none.
  const [secretStatus, setSecretStatus] = useState(NO_SECRET_STATUS);
  // Secrets an editor has entered or cleared since the last save:
  // secretPlaceKey -> {tile, layer, arg, source, value}, `value` the secret or
  // null to clear it. Never in the tiles' args, so nothing that reads the tabs
  // -- a preview, an export, the save's own tabs -- can carry one. They go
  // out only with a save of the tabs. Held in a ref as well as in state: the
  // memoized save reads the ref, so it always sends the latest entries.
  const [pendingSecrets, setPendingSecretsState] = useState({});
  const pendingSecretsRef = useRef({});
  // The entries a save of the tabs has read: sent, or dropped as stale. An
  // editor closed without saving puts back what it opened with, less these.
  const savedSecretEntries = useRef(new WeakSet());
  const originalTabs = useRef({});
  // tab id -> the variable input keys that tab's built-in grid items own.
  const ownedVariableInputKeys = useRef(new Map());
  // tab id -> the uuids of that tab's grid items, as of the last scan.
  const gridItemUUIDsByTab = useRef(new Map());
  // Plugin variable inputs publish values no scan can see, since they exist
  // only in a run() response, so they register them instead -- the preload,
  // and VariableInput whenever it publishes: grid item uuid ->
  // { variableName, keys }. A rebuild releases the keys of a grid item that
  // is gone. Unmounting is not the signal: switching tabs unmounts tiles.
  const pluginVariableInputOwners = useRef(new Map());
  const editable = ["admin", "editor"].includes(userPermission);

  useEffect(() => {
    // Set on unmount, so a dashboard left mid-load writes nothing afterwards.
    let abandoned = false;
    // Preloaded responses belong to the dashboard that fetched them.
    clearPreloadedVisualizations();

    const fetchDashboard = async () => {
      try {
        const response = await appAPI.getDashboard({ id });
        if (abandoned) return;
        if (response.success) {
          const dashboardTabs = response.dashboard.tabs;
          const { seeds, dateFormats } = updateVariableInputValuesWithGridItems(
            dashboardTabs,
            { replacesAllTabs: true },
          );
          originalTabs.current = dashboardTabs;
          setSecretStatus(
            readSecretStatus(response.dashboard.storedSecrets, dashboardTabs),
          );
          setNotes(response.dashboard.notes);
          setTabs(dashboardTabs);
          setActiveTabId(dashboardTabs[0].id);

          // Run plugin variable inputs before rendering, so visualizations
          // that reference them fetch once with a value instead of first
          // warning that the variable is empty. Bounded by the preload's
          // budget; whatever it does not finish loads in its own tile. The
          // dashboard always mounts outside the data viewer, where
          // VariableInput publishes, so there is no mode in which to skip it.
          //
          // Best-effort: a preload that throws costs only its head start,
          // never the dashboard, which renders and loads each tile normally.
          let preloaded = { values: {}, dateFormats: {}, owners: {} };
          try {
            preloaded = await preloadPluginVariableInputs({
              dashboardUUID: uuid,
              tabs: dashboardTabs,
              visualizations,
              variableInputValues: applyVariableInputSeeds({}, seeds),
              variableInputDateFormats: dateFormats,
              onProgress: setVariableInputPreload,
              isAbandoned: () => abandoned,
              // Every arg for a caller who may edit, as the tiles send them.
              allArgs: editable,
            });
          } catch (error) {
            // Fall through with nothing preloaded.
          }
          if (abandoned) return;
          for (const [gridItemUUID, owner] of Object.entries(
            preloaded.owners ?? {},
          )) {
            pluginVariableInputOwners.current.set(gridItemUUID, {
              variableName: owner.variableName,
              keys: new Set(owner.keys),
            });
          }
          setVariableInputValues((prev) => ({ ...prev, ...preloaded.values }));
          setVariableInputDateFormats((prev) => ({
            ...prev,
            ...preloaded.dateFormats,
          }));
          setVariableInputPreload(null);
          setIsLoaded(true);
        } else {
          setLoadError(true);
        }
      } catch (error) {
        if (!abandoned) setLoadError(true);
      }
    };

    fetchDashboard();
    return () => {
      abandoned = true;
      clearPreloadedVisualizations();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isEditing) {
      setDisabledEditingMovement(false);
    }
  }, [isEditing]);

  // Rebuilds the built-in variable input values from grid items. Called with
  // one tab (`updateTab`, which every drag and resize stop reaches) or with
  // the whole list (`replacesAllTabs`: boot, `updateTabs`, `resetTabs`).
  //
  // A merge, not a replacement: the rebuild owns only the keys its scan
  // computes, so values it cannot see -- a plugin variable input's, which
  // exists only in its run() response -- survive it. Removing a built-in
  // Variable Input still removes its value, because the keys each tab owned
  // last time are tracked and any key no tab owns any more is released.
  const updateVariableInputValuesWithGridItems = useCallback(
    (updatedTabs, { replacesAllTabs = false } = {}) => {
      const { seeds, dateFormats, keysByTab, uuidsByTab } =
        buildVariableInputSeeds(updatedTabs);

      const previousOwners = ownedVariableInputKeys.current;
      const nextOwners = replacesAllTabs ? new Map() : new Map(previousOwners);
      for (const [tabId, tabKeys] of keysByTab) {
        nextOwners.set(tabId, tabKeys);
      }
      ownedVariableInputKeys.current = nextOwners;
      const previouslyOwned = unionOfKeys(previousOwners);
      const stillOwned = unionOfKeys(nextOwners);
      const released = [...previouslyOwned].filter(
        (key) => !stillOwned.has(key),
      );

      // Plugin variable inputs: release the keys of every grid item the last
      // scan saw and this one does not. A one-tab update replaces only that
      // tab's uuids, so only a grid item that tab held can go. A grid item
      // no scan has seen yet (one in an imported tab) is left alone.
      const previousUUIDs = unionOfKeys(gridItemUUIDsByTab.current);
      const nextUUIDsByTab = replacesAllTabs
        ? new Map()
        : new Map(gridItemUUIDsByTab.current);
      for (const [tabId, tabUUIDs] of uuidsByTab) {
        nextUUIDsByTab.set(tabId, tabUUIDs);
      }
      gridItemUUIDsByTab.current = nextUUIDsByTab;
      const presentUUIDs = unionOfKeys(nextUUIDsByTab);
      const pluginOwners = pluginVariableInputOwners.current;
      const releasedPluginKeys = new Set();
      for (const [gridItemUUID, owner] of [...pluginOwners]) {
        if (
          previousUUIDs.has(gridItemUUID) &&
          !presentUUIDs.has(gridItemUUID)
        ) {
          pluginOwners.delete(gridItemUUID);
          for (const key of owner.keys) releasedPluginKeys.add(key);
        }
      }
      for (const key of releasedPluginKeys) {
        // Kept while another plugin variable input publishes it, or a
        // built-in one that already owned it still does. A built-in Variable
        // Input that only now takes the name is seeded fresh rather than
        // inheriting the deleted one's value.
        const ownedByPlugin = [...pluginOwners.values()].some((owner) =>
          owner.keys.has(key),
        );
        const ownedByBuiltIn = previouslyOwned.has(key) && stillOwned.has(key);
        if (!ownedByPlugin && !ownedByBuiltIn) released.push(key);
      }

      setVariableInputValues((prev) =>
        applyVariableInputSeeds(prev, seeds, released),
      );
      // Merge instead of replace: popup-internal Variable Inputs register
      // their date formats from inside their own subtree (they never appear
      // in tab.gridItems and so were invisible to this boot-time scan).
      // Replacing the whole map here would wipe those popup registrations
      // whenever the host dashboard's gridItems changed.
      setVariableInputDateFormats((prev) => ({
        ...prev,
        ...dateFormats,
      }));
      return { seeds, dateFormats };
    },
    [],
  );

  // VariableInput's publish path for a plugin variable input: records which
  // keys its grid item publishes, so a rebuild can release them once the
  // grid item is gone. A new variable name for the same grid item (the plugin
  // renamed it) releases the old name's keys at once.
  const registerPluginVariableInput = useCallback(
    (gridItemUUID, variableName, keys) => {
      if (!gridItemUUID || !variableName) return;
      const owners = pluginVariableInputOwners.current;
      const previous = owners.get(gridItemUUID);
      const renamed = previous && previous.variableName !== variableName;
      const nextKeys = new Set(keys);
      if (previous && !renamed) {
        for (const key of previous.keys) nextKeys.add(key);
      }
      owners.set(gridItemUUID, { variableName, keys: nextKeys });
      if (!renamed) return;

      const builtInOwned = unionOfKeys(ownedVariableInputKeys.current);
      const released = [...previous.keys].filter(
        (key) =>
          !nextKeys.has(key) &&
          !builtInOwned.has(key) &&
          ![...owners.values()].some((owner) => owner.keys.has(key)),
      );
      if (released.length === 0) return;
      setVariableInputValues((prev) => {
        const next = { ...prev };
        for (const key of released) delete next[key];
        return next;
      });
    },
    [],
  );

  const updateTab = useCallback(
    (tabId, updatedProperties) => {
      setTabs((prevTabs) =>
        prevTabs.map((tab) =>
          tab.id === tabId ? { ...tab, ...updatedProperties } : tab,
        ),
      );
      if ("gridItems" in updatedProperties) {
        updateVariableInputValuesWithGridItems([
          { id: tabId, ...updatedProperties },
        ]);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tabs, activeTabId, variableInputValues],
  );

  // Commit a whole tab list in one write: one `setTabs`, and one
  // variable-input rebuild over the complete list. Callers that edit grid
  // items on more than one tab at once use this rather than several
  // `updateTab` calls, and a tab missing from the list releases the variable
  // inputs it owned.
  const updateTabs = useCallback(
    (nextTabs) => {
      setTabs(nextTabs);
      updateVariableInputValuesWithGridItems(nextTabs, {
        replacesAllTabs: true,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [variableInputValues],
  );

  const updatePendingSecrets = useCallback((update) => {
    const next = update(pendingSecretsRef.current);
    if (next === pendingSecretsRef.current) return;
    pendingSecretsRef.current = next;
    setPendingSecretsState(next);
  }, []);

  const setPendingSecret = useCallback(
    ({ tile, layer = "", arg, source, value }) => {
      updatePendingSecrets((previous) => ({
        ...previous,
        [secretPlaceKey({ tile, layer, arg })]: {
          tile,
          layer: layer || "",
          arg,
          source,
          value,
        },
      }));
    },
    [updatePendingSecrets],
  );

  // Discards the pending entries of a tile or layer: of one arg, or of every
  // arg when none is named. Given `keepSource`, an entry entered for that
  // plugin is kept, so an editor's save drops only those for another plugin.
  const discardPendingSecrets = useCallback(
    ({ tile, layer = "", arg, keepSource }) => {
      const wantedTile = normalizeTileUuid(tile);
      updatePendingSecrets((previous) =>
        omitEntries(
          previous,
          (key, entry) =>
            String(entry.tile).toLowerCase() === wantedTile &&
            entry.layer === (layer || "") &&
            (arg === undefined || entry.arg === arg) &&
            (keepSource === undefined || entry.source !== keepSource),
        ),
      );
    },
    [updatePendingSecrets],
  );

  // Puts the pending entries back as they were when an editor opened:
  // `snapshot` is the pending map then. Every entry entered or cleared since
  // goes, and every one discarded since comes back, but for one a save of the
  // tabs has read since, which is done with.
  const restorePendingSecrets = useCallback(
    (snapshot) => {
      updatePendingSecrets(() =>
        omitEntries(snapshot ?? {}, (key, entry) =>
          savedSecretEntries.current.has(entry),
        ),
      );
    },
    [updatePendingSecrets],
  );

  // A secret stored for the plugin its tile or layer was saved with does not
  // run another, and the next save sweeps it.
  const isSecretStored = useCallback(
    ({ tile, layer = "", arg, source }) => {
      const savedSource = secretStatus.sources.get(
        secretPlaceKey({ tile, layer, arg }),
      );
      return savedSource !== undefined && savedSource === source;
    },
    [secretStatus],
  );

  const secretArgsOf = useMemo(
    () => secretArgsBySource(visualizations, dynamicMapLayers),
    [visualizations, dynamicMapLayers],
  );

  const resetTabs = useCallback(() => {
    setTabs(originalTabs.current);
    setActiveTabId(originalTabs.current[0].id);
    updateVariableInputValuesWithGridItems(originalTabs.current, {
      replacesAllTabs: true,
    });
    // Cancelling the edit cancels the secrets entered in it.
    updatePendingSecrets(() => ({}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalTabs, variableInputValues]);

  const saveLayoutContext = useCallback(
    async (newProperties) => {
      // Pending secrets ride only a save of the tabs, the one save the server
      // reads them with. Every other save -- a thumbnail, the dashboard's
      // settings -- neither sends nor clears them.
      const savesTabs = "tabs" in newProperties;
      const pendingSent = pendingSecretsRef.current;
      const secretChanges = savesTabs
        ? secretChangesToSave(pendingSent, newProperties.tabs, secretArgsOf)
        : [];
      const apiResponse = await updateDashboard({
        id,
        newProperties:
          secretChanges.length > 0
            ? { ...newProperties, secretChanges }
            : newProperties,
      });
      if (apiResponse["success"]) {
        const updatedDashboard = apiResponse.updated_dashboard;
        if (savesTabs) {
          const originalActiveTabIndex = tabs.findIndex(
            (tab) => tab.id === activeTabId,
          );
          setTabs(updatedDashboard.tabs);
          originalTabs.current = updatedDashboard.tabs;
          // A saved tab can come back under a new id (a tab added since the
          // load is named until the server assigns one), so re-key which
          // variable inputs each tab owns; the values themselves are as-is.
          const { keysByTab, uuidsByTab } = buildVariableInputSeeds(
            updatedDashboard.tabs,
          );
          ownedVariableInputKeys.current = keysByTab;
          gridItemUUIDsByTab.current = uuidsByTab;
          setActiveTabId(updatedDashboard.tabs[originalActiveTabIndex].id);
          setSecretStatus(
            readSecretStatus(
              updatedDashboard.storedSecrets,
              updatedDashboard.tabs,
            ),
          );
          // Every entry this save read is done with: sent, or dropped as
          // stale. One entered while the save was out is kept for the next.
          for (const entry of Object.values(pendingSent)) {
            savedSecretEntries.current.add(entry);
          }
          updatePendingSecrets((current) =>
            omitEntries(current, (key, entry) => pendingSent[key] === entry),
          );
        }
      }
      return apiResponse;
    },
    [
      updateDashboard,
      id,
      tabs,
      activeTabId,
      secretArgsOf,
      updatePendingSecrets,
    ],
  );

  const addTab = useCallback(() => {
    const tabName = `Tab ${tabs.length + 1}`;
    const newTab = {
      id: tabName,
      order: tabs.length,
      gridItems: [],
      name: tabName,
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newTab.id);
  }, [tabs]);

  const deleteTab = useCallback(
    (tabId) => {
      const newTabs = tabs.filter((tab) => tab.id !== tabId);
      setTabs(newTabs);
      if (activeTabId === tabId && newTabs.length > 0) {
        setActiveTabId(newTabs[0].id);
      }
    },
    [tabs, activeTabId],
  );

  const importTabs = useCallback((newTabs) => {
    setTabs((prevTabs) => {
      const startOrder = prevTabs.length;
      const tabsToAdd = newTabs.map((tab, index) => ({
        ...tab,
        order: startOrder + index,
      }));
      return [...prevTabs, ...tabsToAdd];
    });
  }, []);

  const reorderTabs = useCallback(
    (newOrder) => {
      setTabs(newOrder);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tabs],
  );

  const getActiveTab = useCallback(
    () => tabs.find((tab) => tab.id === activeTabId),
    [tabs, activeTabId],
  );

  const getTab = useCallback(
    (tabId) => tabs.find((tab) => tab.id === tabId),
    [tabs],
  );

  // Always call hooks in the same order
  const variableInputsContextValue = useMemo(
    () => ({
      variableInputValues,
      setVariableInputValues,
      variableInputDateFormats,
      setVariableInputDateFormats,
      variableInputSliderMeta,
      setVariableInputSliderMeta,
      registerPluginVariableInput,
    }),
    [
      variableInputValues,
      setVariableInputValues,
      variableInputDateFormats,
      setVariableInputDateFormats,
      variableInputSliderMeta,
      setVariableInputSliderMeta,
      registerPluginVariableInput,
    ],
  );

  const tabContextValue = useMemo(
    () => ({
      tabs,
      activeTabId,
      setActiveTabId,
      addTab,
      importTabs,
      updateTab,
      updateTabs,
      deleteTab,
      reorderTabs,
      resetTabs,
      getActiveTab,
      getTab,
    }),
    [
      tabs,
      activeTabId,
      addTab,
      importTabs,
      updateTab,
      updateTabs,
      deleteTab,
      reorderTabs,
      resetTabs,
      getActiveTab,
      getTab,
      setActiveTabId,
    ],
  );
  const layoutContextValue = useMemo(
    () => ({
      saveLayoutContext,
      id,
      uuid,
      name,
      notes,
      editable,
      publicDashboard,
      userPermission,
      permissions,
      unrestrictedPlacement,
      autoThumbnail,
      description,
      owner,
      // The places holding a stored secret, `{tile, layer, arg}` each.
      storedSecrets: secretStatus.stored,
      isSecretStored,
      pendingSecrets,
      setPendingSecret,
      discardPendingSecrets,
      restorePendingSecrets,
    }),
    [
      saveLayoutContext,
      id,
      uuid,
      name,
      notes,
      editable,
      publicDashboard,
      userPermission,
      permissions,
      unrestrictedPlacement,
      autoThumbnail,
      description,
      owner,
      secretStatus,
      isSecretStored,
      pendingSecrets,
      setPendingSecret,
      discardPendingSecrets,
      restorePendingSecrets,
    ],
  );
  const editingContextValue = useMemo(
    () => ({ isEditing, setIsEditing }),
    [isEditing, setIsEditing],
  );
  const disabledEditingMovementContextValue = useMemo(
    () => ({ disabledEditingMovement, setDisabledEditingMovement }),
    [disabledEditingMovement, setDisabledEditingMovement],
  );
  const dataViewerModeContextValue = useMemo(
    () => ({ inDataViewerMode, setInDataViewerMode }),
    [inDataViewerMode, setInDataViewerMode],
  );

  if (loadError) {
    return (
      <Error title="Dashboard Failed to Load" image={errorImage}>
        The dashboard failed to load. Please try again or contact admins.
      </Error>
    );
  }
  if (!isLoaded) {
    return (
      <LoadingAnimation
        text="Loading Dashboard..."
        detail={
          variableInputPreload
            ? `Loading variable inputs… (${variableInputPreload.completed} of ${variableInputPreload.total})`
            : undefined
        }
      />
    );
  }
  return (
    <VariableInputsContext.Provider value={variableInputsContextValue}>
      <TabContext.Provider value={tabContextValue}>
        <LayoutContext.Provider value={layoutContextValue}>
          <EditingContext.Provider value={editingContextValue}>
            <DisabledEditingMovementContext.Provider
              value={disabledEditingMovementContextValue}
            >
              <DataViewerModeContext.Provider
                value={dataViewerModeContextValue}
              >
                <ViewGroupProvider>
                  <LinkedExtentProvider>{children}</LinkedExtentProvider>
                </ViewGroupProvider>
              </DataViewerModeContext.Provider>
            </DisabledEditingMovementContext.Provider>
          </EditingContext.Provider>
        </LayoutContext.Provider>
      </TabContext.Provider>
    </VariableInputsContext.Provider>
  );
};

DashboardLoader.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
    PropTypes.object,
  ]),
  id: PropTypes.number,
  name: PropTypes.string,
  notes: PropTypes.string,
  editable: PropTypes.bool,
  publicDashboard: PropTypes.bool,
  description: PropTypes.string,
  unrestrictedPlacement: PropTypes.bool,
  autoThumbnail: PropTypes.bool,
  uuid: PropTypes.string,
  userPermission: PropTypes.string,
  permissions: PropTypes.arrayOf(
    PropTypes.shape({
      username: PropTypes.string,
      group: PropTypes.string,
      permission: PropTypes.string.isRequired,
    }),
  ),
  owner: PropTypes.string,
};

export default memo(DashboardLoader);

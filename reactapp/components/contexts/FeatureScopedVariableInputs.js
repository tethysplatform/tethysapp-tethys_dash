import { useCallback, useContext, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { VariableInputsContext } from "components/contexts/Contexts";

const FEATURE_PREFIX = "feature.";

// Sentinel key on the merged variableInputs map that signals descendants are
// inside a feature-scope (i.e., a popup). updateObjectWithVariableInputs
// uses it to choose between "preserve unresolved ${feature.<key>}" (host
// scope, leave for the popup to resolve later) and "resolve to empty
// string" (popup scope — there is no further resolution layer below).
export const FEATURE_SCOPE_MARKER = "__tethysdash_feature_scope__";

/**
 * Flatten a feature object's `attributes` into the dotted-key namespace
 * (`feature.<key>`). Keys are passed through unchanged — the substitution
 * regex (`/\$\{([^}]+)\}/g`) already accepts dots, spaces, parens.
 */
function flattenFeatureAttrs(feature) {
  const result = {};
  if (!feature || !feature.attributes) {
    return result;
  }
  for (const [key, value] of Object.entries(feature.attributes)) {
    result[`${FEATURE_PREFIX}${key}`] = value;
  }
  return result;
}

/**
 * Provides a nested view of `VariableInputsContext` that exposes the active
 * feature's attributes under the `feature.*` namespace to descendants while
 * leaving the host (parent) variable inputs untouched. Writes are split per
 * key:
 *   - keys starting with `feature.` route to the local scoped state
 *   - other keys fall through to the parent's setter
 *
 * The provided `setVariableInputValues` also accepts the functional updater
 * pattern: `setVariableInputValues((prev) => next)`. When called this way the
 * function is evaluated against the merged read view (parent + flattened
 * feature attrs + scoped state), and each resulting key is routed per the
 * rules above.
 */
const FeatureScopedVariableInputs = ({ feature, children }) => {
  const parent = useContext(VariableInputsContext) ?? {};
  const {
    variableInputValues: parentValues = {},
    setVariableInputValues: parentSetVariableInputValues = () => {},
    variableInputDateFormats,
    variableInputSliderMeta,
    setVariableInputSliderMeta,
  } = parent;

  const [scopedState, setScopedState] = useState({});

  const flattenedFeatureAttrs = useMemo(
    () => flattenFeatureAttrs(feature),
    [feature],
  );

  // Merged read view: parent → flattened feature attrs → scoped state.
  // The scoped state shadows the flattened attrs (so any in-modal mutation
  // wins). feature.* shadows host vars only when keys collide (host vars
  // remain readable as their bare name). The FEATURE_SCOPE_MARKER tells
  // descendants' substitution pass that we're inside the popup scope — see
  // updateObjectWithVariableInputs for how it's consumed.
  const mergedValues = useMemo(
    () => ({
      ...parentValues,
      ...flattenedFeatureAttrs,
      ...scopedState,
      [FEATURE_SCOPE_MARKER]: true,
    }),
    [parentValues, flattenedFeatureAttrs, scopedState],
  );

  /**
   * Split a flat object of `{ key: value }` into two buckets — feature.* keys
   * for the local scoped state and everything else for the parent setter.
   */
  const splitByPrefix = useCallback((nextObj) => {
    const featureUpdates = {};
    const parentUpdates = {};
    let hasFeatureKey = false;
    let hasParentKey = false;
    for (const [key, value] of Object.entries(nextObj)) {
      if (key.startsWith(FEATURE_PREFIX)) {
        featureUpdates[key] = value;
        hasFeatureKey = true;
      } else {
        parentUpdates[key] = value;
        hasParentKey = true;
      }
    }
    return { featureUpdates, parentUpdates, hasFeatureKey, hasParentKey };
  }, []);

  const setVariableInputValues = useCallback(
    (updater) => {
      // Functional updater path — evaluate against the current merged value
      // and route the resulting object per key.
      if (typeof updater === "function") {
        const next = updater(mergedValues);
        const { featureUpdates, parentUpdates, hasFeatureKey, hasParentKey } =
          splitByPrefix(next ?? {});
        if (hasFeatureKey) {
          setScopedState((prevScoped) => ({ ...prevScoped, ...featureUpdates }));
        }
        if (hasParentKey) {
          parentSetVariableInputValues((prevParent) => ({
            ...prevParent,
            ...parentUpdates,
          }));
        }
        return;
      }

      // Object path — split keys and dispatch to the relevant setters.
      const { featureUpdates, parentUpdates, hasFeatureKey, hasParentKey } =
        splitByPrefix(updater ?? {});
      if (hasFeatureKey) {
        setScopedState((prevScoped) => ({ ...prevScoped, ...featureUpdates }));
      }
      if (hasParentKey) {
        parentSetVariableInputValues((prevParent) => ({
          ...prevParent,
          ...parentUpdates,
        }));
      }
    },
    [mergedValues, parentSetVariableInputValues, splitByPrefix],
  );

  const contextValue = useMemo(
    () => ({
      variableInputValues: mergedValues,
      setVariableInputValues,
      variableInputDateFormats,
      variableInputSliderMeta,
      setVariableInputSliderMeta,
    }),
    [
      mergedValues,
      setVariableInputValues,
      variableInputDateFormats,
      variableInputSliderMeta,
      setVariableInputSliderMeta,
    ],
  );

  return (
    <VariableInputsContext.Provider value={contextValue}>
      {children}
    </VariableInputsContext.Provider>
  );
};

FeatureScopedVariableInputs.propTypes = {
  feature: PropTypes.shape({
    layerName: PropTypes.string,
    // eslint-disable-next-line react/forbid-prop-types
    attributes: PropTypes.object,
    // eslint-disable-next-line react/forbid-prop-types
    geometry: PropTypes.any,
  }),
  children: PropTypes.node,
};

FeatureScopedVariableInputs.defaultProps = {
  feature: null,
  children: null,
};

export default FeatureScopedVariableInputs;

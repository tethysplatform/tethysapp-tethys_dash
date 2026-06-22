import { useCallback, useContext, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { VariableInputsContext } from "components/contexts/Contexts";

const FEATURE_PREFIX = "feature.";
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

const FeatureScopedVariableInputs = ({ feature, children }) => {
  const {
    variableInputValues: parentValues,
    setVariableInputValues: parentSetVariableInputValues,
    variableInputDateFormats,
    setVariableInputDateFormats,
    variableInputSliderMeta,
    setVariableInputSliderMeta,
  } = useContext(VariableInputsContext);

  const [scopedState, setScopedState] = useState({});

  const flattenedFeatureAttrs = useMemo(
    () => flattenFeatureAttrs(feature),
    [feature],
  );

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
   *
   * Only forwards keys whose value actually CHANGED relative to
   * `mergedValues`. This is what makes the functional-updater pattern
   * `(prev) => ({...prev, X: Y})` safe: the spread re-includes every existing
   * key (including the immutable `feature.*` snapshot), and without this
   * diff filter those keys would land in `scopedState` and shadow the live
   * feature prop on the next feature switch in the multi-feature carousel.
   */
  const splitChanges = useCallback(
    (nextObj) => {
      const featureUpdates = {};
      const parentUpdates = {};
      let hasFeatureKey = false;
      let hasParentKey = false;
      for (const [key, value] of Object.entries(nextObj)) {
        if (key === FEATURE_SCOPE_MARKER) continue;
        if (Object.is(mergedValues[key], value)) continue;
        if (key.startsWith(FEATURE_PREFIX)) {
          featureUpdates[key] = value;
          hasFeatureKey = true;
        } else {
          parentUpdates[key] = value;
          hasParentKey = true;
        }
      }
      return { featureUpdates, parentUpdates, hasFeatureKey, hasParentKey };
    },
    [mergedValues],
  );

  const setVariableInputValues = useCallback(
    (updater) => {
      const next =
        typeof updater === "function" ? updater(mergedValues) : updater;
      if (!next || typeof next !== "object") return;

      const { featureUpdates, parentUpdates, hasFeatureKey, hasParentKey } =
        splitChanges(next);
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
    [mergedValues, parentSetVariableInputValues, splitChanges],
  );

  const contextValue = useMemo(
    () => ({
      variableInputValues: mergedValues,
      setVariableInputValues,
      variableInputDateFormats,
      setVariableInputDateFormats,
      variableInputSliderMeta,
      setVariableInputSliderMeta,
    }),
    [
      mergedValues,
      setVariableInputValues,
      variableInputDateFormats,
      setVariableInputDateFormats,
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

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
      if (typeof updater === "function") {
        const next = updater(mergedValues);
        const { featureUpdates, parentUpdates, hasFeatureKey, hasParentKey } =
          splitByPrefix(next ?? {});
        if (hasFeatureKey) {
          setScopedState((prevScoped) => ({
            ...prevScoped,
            ...featureUpdates,
          }));
        }
        if (hasParentKey) {
          parentSetVariableInputValues((prevParent) => ({
            ...prevParent,
            ...parentUpdates,
          }));
        }
        return;
      }

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

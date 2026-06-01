import {
  Suspense,
  memo,
  useCallback,
  useContext,
  useMemo,
} from "react";
import LoadingAnimation from "components/loader/LoadingAnimation";
import EmptyState from "components/visualizations/EmptyState";
import { VariableInputsContext } from "components/contexts/Contexts";
import PropTypes from "prop-types";
import useDynamicFederatedComponent from "./useDynamicFederatedComponent";

function ModuleLoader(props) {
  const { variableInputValues, setVariableInputValues } = useContext(
    VariableInputsContext,
  );

  const updateVariableInputValues = useCallback(
    (updatedValues) =>
      setVariableInputValues((prevStateValues) => ({
        ...prevStateValues,
        ...updatedValues,
      })),
    [setVariableInputValues],
  );

  const memoizedVariableInputValues = useMemo(
    () => variableInputValues,
    [variableInputValues],
  );

  // useDynamicFederatedComponent must run on every render to keep its
  // internal effects consistent. Branch on the result, not on whether
  // the hook is called.
  const { Component, failed } = useDynamicFederatedComponent({
    scope: props.scope,
    module: props.module,
    url: props.url,
    remoteType: props.remoteType || "webpack",
  });

  if (!props.module) {
    return (
      <EmptyState
        variant="info"
        title="No module specified"
        hint="This tile is waiting for a Module Federation source."
      />
    );
  }

  if (failed) {
    return (
      <EmptyState
        variant="error"
        title="Could not load module"
        hint="The remote module is unreachable. Try reloading; if it persists, the source has likely been removed."
        details={props.url}
      />
    );
  }

  return (
    <>
      {Component && (
        <Suspense fallback={<LoadingAnimation text="Loading Module..." />}>
          <Component
            {...props.props}
            ref={props.visualizationRef}
            variableInputValues={memoizedVariableInputValues}
            updateVariableInputValues={updateVariableInputValues}
          />
        </Suspense>
      )}
    </>
  );
}

ModuleLoader.propTypes = {
  props: PropTypes.object,
  module: PropTypes.string,
  url: PropTypes.string,
  scope: PropTypes.string,
  remoteType: PropTypes.oneOf(["webpack", "vite-esm"]),
  visualizationRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
};

export default memo(ModuleLoader);

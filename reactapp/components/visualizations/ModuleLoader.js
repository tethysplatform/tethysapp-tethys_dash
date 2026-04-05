import {
  Suspense,
  memo,
  useCallback,
  useContext,
  useMemo,
} from "react";
import LoadingAnimation from "components/loader/LoadingAnimation";
import { VariableInputsContext } from "components/contexts/Contexts";
import PropTypes from "prop-types";
import useDynamicFederatedComponent from "./useDynamicFederatedComponent";

function ModuleLoader(props) {
  console.log("[ModuleLoader] props:", props);
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

  if (!props.module) {
    return <h2>No system specified</h2>;
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { Component, failed } = useDynamicFederatedComponent({
    scope: props.scope,
    module: props.module,
    url: props.url,
    remoteType: props.remoteType || "webpack",
  });

  if (failed) {
    return <h2>Failed to load remote: {props.url}</h2>;
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

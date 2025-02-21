import React, {
  Suspense,
  memo,
  useCallback,
  useState,
  useContext,
  useEffect,
  useMemo,
} from "react";
import useDynamicScript from "hooks/useDynamicScript";
import LoadingAnimation from "components/loader/LoadingAnimation";
import { VariableInputsContext } from "components/contexts/Contexts";
import PropTypes from "prop-types";

function loadComponent(scope, module) {
  return async () => {
    if (!window[scope] || !window[scope].initialized) {
      // Initializes the share scope. This fills it with known provided modules from this build and all remotes
      await __webpack_init_sharing__("default");
      const container = window[scope]; // or get the container somewhere else
      // Initialize the container, it may provide shared modules
      await container.init(__webpack_share_scopes__.default);
    }
    const factory = await window[scope].get(module);
    const Module = factory();
    return Module;
  };
}

const DynamicComponent = ({ scope, module, url }) => {
  const [Component, setComponent] = useState();

  const { ready, failed } = useDynamicScript({
    url: module && url,
  });

  useEffect(() => {
    if (ready && !Component) {
      const loadedComponent = React.lazy(loadComponent(scope, module));
      setComponent(memo(loadedComponent));
    }
    // eslint-disable-next-line
  }, [Component, ready]);

  return { failed, Component };
};

function ModuleLoader(props) {
  const { variableInputValues, setVariableInputValues } = useContext(
    VariableInputsContext
  );
  const updateVariableInputValues = useCallback(
    (updatedValues) =>
      setVariableInputValues((prevStateValues) => ({
        ...prevStateValues,
        ...updatedValues,
      })),
    [setVariableInputValues]
  );
  const memoizedVariableInputValues = useMemo(
    () => variableInputValues,
    [variableInputValues]
  );

  if (!props.module) {
    return <h2>No system specified</h2>;
  }

  const { failed, Component } = DynamicComponent({
    scope: props.scope,
    module: props.module,
    url: props.url,
  });

  if (failed) {
    return <h2>Failed to load dynamic script: {props.url}</h2>;
  }

  return (
    <>
      {Component && (
        <Suspense fallback={<LoadingAnimation />}>
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
  visualizationRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
};

export default memo(ModuleLoader);

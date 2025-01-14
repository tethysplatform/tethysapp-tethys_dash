import React, { Suspense } from "react";
import styled from "styled-components";
import useDynamicScript from "hooks/useDynamicScript";
import LoadingAnimation from "components/loader/LoadingAnimation";
import PropTypes from "prop-types";
import useConditionalChecks from "hooks/useConditionalChecks";

const StyledErrorDiv = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
`;

function loadComponent(scope, module) {
  return async () => {
    // Initializes the share scope. This fills it with known provided modules from this build and all remotes
    await __webpack_init_sharing__("default");
    const container = window[scope]; // or get the container somewhere else
    // Initialize the container, it may provide shared modules
    await container.init(__webpack_share_scopes__.default);
    const factory = await window[scope].get(module);
    const Module = factory();
    return Module;
  };
}

function ModuleLoader(props) {
  const { passed, resultMessages } = useConditionalChecks(props.customErrors);

  const { ready, failed } = useDynamicScript({
    url: props.module && props.url,
  });

  if (!props.module) {
    return <h2>Not system specified</h2>;
  }

  if (!ready) {
    return <LoadingAnimation />;
  }

  if (failed) {
    return <h2>Failed to load dynamic script: {props.url}</h2>;
  }

  const Component = React.lazy(loadComponent(props.scope, props.module));

  return (
    passed ? (
      <Suspense fallback={<LoadingAnimation />}>
        <Component {...props.props} ref={props.visualizationRef} />
      </Suspense>
    ) : (
      // These will only show if the useConditionalChecks hook finds any failures
      // It will then map through all of the possible errors that occured.
      resultMessages.map((message, messageIndex) => (
        <StyledErrorDiv key={messageIndex}>
          <h2>{message}</h2>
        </StyledErrorDiv>
      ))
    )
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
  customErrors: PropTypes.arrayOf(
    PropTypes.shape({
      variableName: PropTypes.string,
      operator: PropTypes.string,
      comparison: PropTypes.string,
      resultMessage: PropTypes.string,
    })
  ),
};

export default ModuleLoader;

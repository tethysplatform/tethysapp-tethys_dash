import React, { useState, useEffect } from "react";
import { loadComponent } from "./remoteLoader";

export default function useDynamicFederatedComponent({
  scope,
  module,
  url,
  remoteType,
}) {
  const [Component, setComponent] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;

    if (!url || !module) {
      return;
    }

    setFailed(false);
    setComponent(null);

    const loader = loadComponent({ scope, module, url, remoteType });

    // istanbul ignore next - error handling tested separately, this is just state update
    const lazyComponent = React.lazy(() =>
      loader().catch(() => {
        if (mounted) {
          setFailed(true);
        }
        return { default: () => null };
      }),
    );

    // istanbul ignore next - error handling tested separately, this is just state update
    if (mounted) {
      setComponent(() => lazyComponent);
    }

    return () => {
      mounted = false;
    };
  }, [scope, module, url, remoteType]);

  return { Component, failed };
}

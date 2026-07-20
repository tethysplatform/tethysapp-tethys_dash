import PropTypes from "prop-types";
import React from "react";

import DebugError from "components/error/DebugError";
import GenericError from "components/error/GenericError";
import { getConfig } from "services/config";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      error: null,
      errorInfo: null,
      hasError: false,
    };
  }

  componentDidCatch(error, errorInfo) {
    // Catch errors in any components below and re-render with error message
    this.setState({
      error: error.toString(),
      errorInfo: errorInfo,
      hasError: true,
    });
    // You can also log error messages to an error reporting service here
  }

  render() {
    const DEBUG_MODE = getConfig().debug;
    if (this.state.hasError) {
      return !DEBUG_MODE ? (
        <GenericError />
      ) : (
        <DebugError error={this.state.error} errorInfo={this.state.errorInfo} />
      );
    }
    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.element),
    PropTypes.element,
    PropTypes.object,
  ]),
};

export default ErrorBoundary;

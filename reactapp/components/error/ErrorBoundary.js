import PropTypes from "prop-types";
import React from "react";

import DebugError from "components/error/DebugError";
import GenericError from "components/error/GenericError";

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
    const DEBUG_MODE = process.env.TETHYS_DEBUG_MODE === "true";
    if (this.state.hasError) {
      // Caller-supplied fallback takes precedence so the same boundary class
      // can serve both app-level (default GenericError/DebugError) and
      // per-tile (compact in-frame fallback) mount sites.
      const { fallback } = this.props;
      if (fallback !== undefined && fallback !== null) {
        return typeof fallback === "function"
          ? fallback(this.state.error, this.state.errorInfo)
          : fallback;
      }
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
  fallback: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
};

export default ErrorBoundary;

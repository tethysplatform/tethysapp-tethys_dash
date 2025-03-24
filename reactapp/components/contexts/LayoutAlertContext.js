import PropTypes from "prop-types";
import { useContext, createContext, useState, useEffect } from "react";

export const LayoutSuccessAlertContext = createContext();
const LayoutErrorAlertContext = createContext();
const LayoutWarningAlertContext = createContext();

const LayoutAlertContextProvider = ({ children }) => {
  const [successMessage, setSuccessMessage] = useState("");
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showErrorMessage, setShowErrorMessage] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  const [showWarningMessage, setShowWarningMessage] = useState(false);

  useEffect(() => {
    if (showSuccessMessage === true) {
      window.setTimeout(() => {
        setShowSuccessMessage(false);
      }, 5000);
    }
  }, [showSuccessMessage]);

  useEffect(() => {
    if (showErrorMessage === true) {
      window.setTimeout(() => {
        setShowErrorMessage(false);
      }, 5000);
    }
  }, [showErrorMessage]);

  useEffect(() => {
    if (showWarningMessage === true) {
      window.setTimeout(() => {
        setShowWarningMessage(false);
      }, 5000);
    }
  }, [showWarningMessage]);

  return (
    <LayoutSuccessAlertContext.Provider
      value={{
        successMessage,
        setSuccessMessage,
        showSuccessMessage,
        setShowSuccessMessage,
      }}
    >
      <LayoutErrorAlertContext.Provider
        value={{
          errorMessage,
          setErrorMessage,
          showErrorMessage,
          setShowErrorMessage,
        }}
      >
        <LayoutWarningAlertContext.Provider
          value={{
            warningMessage,
            setWarningMessage,
            showWarningMessage,
            setShowWarningMessage,
          }}
        >
          {children}
        </LayoutWarningAlertContext.Provider>
      </LayoutErrorAlertContext.Provider>
    </LayoutSuccessAlertContext.Provider>
  );
};

LayoutAlertContextProvider.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.arrayOf(PropTypes.object),
    PropTypes.node,
  ]),
};

export default LayoutAlertContextProvider;

export const useLayoutSuccessAlertContext = () => {
  return useContext(LayoutSuccessAlertContext);
};

export const useLayoutErrorAlertContext = () => {
  return useContext(LayoutErrorAlertContext);
};

export const useLayoutWarningAlertContext = () => {
  return useContext(LayoutWarningAlertContext);
};

import { createContext, useContext, useState } from "react";
import PropTypes from "prop-types";

export const ModalPriorityContext = createContext();

export const useModalPriority = () => {
  const context = useContext(ModalPriorityContext);
  if (!context) {
    throw new Error(
      "useModalPriority must be used within a ModalPriorityProvider"
    );
  }
  return context;
};

export const ModalPriorityProvider = ({ children }) => {
  const [showingPublicUserModal, setShowingPublicUserModal] = useState(false);
  const [publicUserModalChecked, setPublicUserModalChecked] = useState(false);
  const [showingIdleTimeoutModal, setShowingIdleTimeoutModal] = useState(false);
  const [appInfoModalWasOpen, setAppInfoModalWasOpen] = useState(false);

  return (
    <ModalPriorityContext.Provider
      value={{
        showingPublicUserModal,
        setShowingPublicUserModal,
        publicUserModalChecked,
        setPublicUserModalChecked,
        showingIdleTimeoutModal,
        setShowingIdleTimeoutModal,
        appInfoModalWasOpen,
        setAppInfoModalWasOpen,
      }}
    >
      {children}
    </ModalPriorityContext.Provider>
  );
};

ModalPriorityProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

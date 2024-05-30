import { useContext, createContext, useState } from "react";

const DashboardNotesModalShowContext = createContext();

const DashboardNotesModalShowContextProvider = ({ children }) => {
  const [showModal, setShowModal] = useState(false);

  return (
    <DashboardNotesModalShowContext.Provider value={[showModal, setShowModal]}>
      {children}
    </DashboardNotesModalShowContext.Provider>
  );

};

export default DashboardNotesModalShowContextProvider;

export const useDashboardNotesModalShowContext = () => {
  return useContext(DashboardNotesModalShowContext);
};
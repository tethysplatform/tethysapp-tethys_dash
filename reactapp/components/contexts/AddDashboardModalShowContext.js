import { useContext, createContext, useState } from "react";

const AddDashboardModalShowContext = createContext();

const AddDashboardModalShowContextProvider = ({ children }) => {
  const [showModal, setShowModal] = useState(false);

  return (
    <AddDashboardModalShowContext.Provider value={[showModal, setShowModal]}>
      {children}
    </AddDashboardModalShowContext.Provider>
  );

};

export default AddDashboardModalShowContextProvider;

export const useAddDashboardModalShowContext = () => {
  return useContext(AddDashboardModalShowContext);
};
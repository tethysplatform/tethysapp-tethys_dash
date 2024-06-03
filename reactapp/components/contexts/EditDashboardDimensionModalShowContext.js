import { useContext, createContext, useState } from "react";

const EditDashboardDimensionModalShowContext = createContext();

const EditDashboardDimensionModalShowContextProvider = ({ children }) => {
  const [showModal, setShowModal] = useState(false);

  return (
    <EditDashboardDimensionModalShowContext.Provider value={[showModal, setShowModal]}>
      {children}
    </EditDashboardDimensionModalShowContext.Provider>
  );

};

export default EditDashboardDimensionModalShowContextProvider;

export const useEditDashboardDimensionModalShowContext = () => {
  return useContext(EditDashboardDimensionModalShowContext);
};
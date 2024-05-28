import { useContext, createContext, useState } from "react";

const AvailableOptionsContext = createContext();

const AvailableOptionsContextProvider = ({ children }) => {
  const [selectOptions, setSelectOptions] = useState(null)

  return (
    <AvailableOptionsContext.Provider value={[selectOptions, setSelectOptions]}>
      {children}
    </AvailableOptionsContext.Provider>
  );

};

export default AvailableOptionsContextProvider;

export const useAvailableOptionsContext = () => {
  return useContext(AvailableOptionsContext);
};
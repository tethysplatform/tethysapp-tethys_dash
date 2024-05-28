import { useContext, createContext, useState } from "react";

const SelectedOptionContext = createContext();

const SelectedOptionContextProvider = ({ children }) => {
  const [selectedOption, setSelectedOption] = useState(null)

  return (
    <SelectedOptionContext.Provider value={[selectedOption, setSelectedOption]}>
      {children}
    </SelectedOptionContext.Provider>
  );

};

export default SelectedOptionContextProvider;

export const useSelectedOptionContext = () => {
  return useContext(SelectedOptionContext);
};
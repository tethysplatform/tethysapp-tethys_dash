import { useContext, createContext, useState } from "react";

const EditingContext = createContext();

const EditingContextProvider = ({ children }) => {
  const [isEditing, setIsEditing] = useState(false)

  return (
    <EditingContext.Provider value={[isEditing, setIsEditing]}>
      {children}
    </EditingContext.Provider>
  );

};

export default EditingContextProvider;

export const useEditingContext = () => {
  return useContext(EditingContext);
};
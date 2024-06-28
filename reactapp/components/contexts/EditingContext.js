import PropTypes from "prop-types";
import { useContext, createContext, useState } from "react";

const EditingContext = createContext();

const EditingContextProvider = ({ children }) => {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <EditingContext.Provider value={[isEditing, setIsEditing]}>
      {children}
    </EditingContext.Provider>
  );
};

EditingContextProvider.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
  ]),
};

export default EditingContextProvider;

export const useEditingContext = () => {
  return useContext(EditingContext);
};

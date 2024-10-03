import PropTypes from "prop-types";
import { useContext, createContext, useState } from "react";

const VariableInputValuesContext = createContext();

const VariableInputsContextProvider = ({ children }) => {
  const [variableInputValues, setVariableInputValues] = useState({});

  function updateVariableInputValuesWithGridItems(gridItems) {
    const updatedVariableInputValues = {};
    for (let gridItem of gridItems) {
      const args = JSON.parse(gridItem.args_string);

      if (gridItem.source === "Variable Input") {
        if (args.variable_name in variableInputValues) {
          updatedVariableInputValues[args.variable_name] =
            variableInputValues[args.variable_name];
        } else {
          updatedVariableInputValues[args.variable_name] =
            args.initial_value.value || args.initial_value;
        }
      }
    }
    setVariableInputValues(updatedVariableInputValues);
  }

  return (
    <VariableInputValuesContext.Provider
      value={[
        variableInputValues,
        setVariableInputValues,
        updateVariableInputValuesWithGridItems,
      ]}
    >
      {children}
    </VariableInputValuesContext.Provider>
  );
};

VariableInputsContextProvider.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
  ]),
};

export default VariableInputsContextProvider;

export const useVariableInputValuesContext = () => {
  return useContext(VariableInputValuesContext);
};

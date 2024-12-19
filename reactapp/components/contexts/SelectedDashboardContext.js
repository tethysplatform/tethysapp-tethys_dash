import PropTypes from "prop-types";
import { useContext, createContext, useState } from "react";
import { useVariableInputValuesContext } from "components/contexts/VariableInputsContext";

const LayoutContext = createContext();
const LayoutNameContext = createContext();
const LayoutLabelContext = createContext();
const LayoutAccessGroupsContext = createContext();
const LayoutNotesContext = createContext();
export const LayoutGridItemsContext = createContext();
const LayoutEditableContext = createContext();

const SelectedDashboardContextProvider = ({ children }) => {
  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [accessGroups, setAccessGroups] = useState([]);
  const [editable, setEditable] = useState(false);
  const [notes, setNotes] = useState("");
  const [gridItems, setGridItems] = useState([]);
  const { updateVariableInputValuesWithGridItems } =
    useVariableInputValuesContext();

  function resetLayoutContext() {
    setName("");
    setLabel("");
    setAccessGroups([]);
    setNotes("");
    setGridItems([]);
    setEditable(false);
    updateVariableInputValuesWithGridItems([]);
  }

  function setLayoutContext(dashboardContext) {
    setName(dashboardContext["name"]);
    setLabel(dashboardContext["label"]);
    setAccessGroups(dashboardContext["access_groups"]);
    setNotes(dashboardContext["notes"]);
    setGridItems(dashboardContext["gridItems"]);
    setEditable(dashboardContext["editable"]);
    updateVariableInputValuesWithGridItems(dashboardContext["gridItems"]);
  }

  function getLayoutContext() {
    return {
      name: name,
      label: label,
      access_groups: accessGroups,
      notes: notes,
      gridItems: gridItems,
      editable: editable,
    };
  }

  return (
    <LayoutContext.Provider
      value={{ setLayoutContext, resetLayoutContext, getLayoutContext }}
    >
      <LayoutNameContext.Provider value={{ name, setName }}>
        <LayoutLabelContext.Provider value={{ label, setLabel }}>
          <LayoutEditableContext.Provider value={editable}>
            <LayoutAccessGroupsContext.Provider
              value={{ accessGroups, setAccessGroups }}
            >
              <LayoutNotesContext.Provider value={{ notes, setNotes }}>
                <LayoutGridItemsContext.Provider
                  value={{ gridItems, setGridItems }}
                >
                  {children}
                </LayoutGridItemsContext.Provider>
              </LayoutNotesContext.Provider>
            </LayoutAccessGroupsContext.Provider>
          </LayoutEditableContext.Provider>
        </LayoutLabelContext.Provider>
      </LayoutNameContext.Provider>
    </LayoutContext.Provider>
  );
};

SelectedDashboardContextProvider.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
  ]),
};

export default SelectedDashboardContextProvider;

export const useLayoutContext = () => {
  return useContext(LayoutContext);
};

export const useLayoutNameContext = () => {
  return useContext(LayoutNameContext);
};

export const useLayoutLabelContext = () => {
  return useContext(LayoutLabelContext);
};

export const useLayoutNotesContext = () => {
  return useContext(LayoutNotesContext);
};

export const useLayoutGridItemsContext = () => {
  return useContext(LayoutGridItemsContext);
};

export const useLayoutEditableContext = () => {
  return useContext(LayoutEditableContext);
};

export const useLayoutAccessGroupsContext = () => {
  return useContext(LayoutAccessGroupsContext);
};

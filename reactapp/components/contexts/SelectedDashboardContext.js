import PropTypes from "prop-types";
import { useContext, createContext, useState } from "react";

const LayoutContext = createContext();
const LayoutNameContext = createContext();
const LayoutLabelContext = createContext();
const LayoutAccessGroupsContext = createContext();
const LayoutNotesContext = createContext();
const LayoutGridItemsContext = createContext();

const SelectedDashboardContextProvider = ({ children }) => {
  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [accessGroups, setAccessGroups] = useState("");
  const [editable, setEditable] = useState(false);
  const [notes, setNotes] = useState("");
  const [gridItems, setGridItems] = useState([]);

  function resetLayoutContext() {
    setName("");
    setLabel("");
    setAccessGroups([]);
    setNotes("");
    setGridItems([]);
    setEditable(false);
  }

  function setLayoutContext(dashboardContext) {
    setName(dashboardContext["name"]);
    setLabel(dashboardContext["label"]);
    setAccessGroups(dashboardContext["access_groups"]);
    setNotes(dashboardContext["notes"]);
    setGridItems(dashboardContext["gridItems"]);
    setEditable(dashboardContext["editable"]);
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
      value={[setLayoutContext, resetLayoutContext, getLayoutContext]}
    >
      <LayoutNameContext.Provider value={[name, setName]}>
        <LayoutLabelContext.Provider value={[label, setLabel]}>
          <LayoutAccessGroupsContext.Provider
            value={[accessGroups, setAccessGroups]}
          >
            <LayoutNotesContext.Provider value={[notes, setNotes]}>
              <LayoutGridItemsContext.Provider
                value={[gridItems, setGridItems]}
              >
                {children}
              </LayoutGridItemsContext.Provider>
            </LayoutNotesContext.Provider>
          </LayoutAccessGroupsContext.Provider>
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

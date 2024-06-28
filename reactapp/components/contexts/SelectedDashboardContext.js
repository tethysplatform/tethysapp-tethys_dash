import PropTypes from "prop-types";
import { useContext, createContext, useState } from "react";

const LayoutContext = createContext();
const LayoutNameContext = createContext();
const LayoutLabelContext = createContext();
const LayoutImageContext = createContext();
const LayoutNotesContext = createContext();
const LayoutRowDataContext = createContext();

const SelectedDashboardContextProvider = ({ children }) => {
  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [image, setImage] = useState("");
  const [notes, setNotes] = useState("");
  const [rowData, setRowData] = useState(null);

  function resetLayoutContext() {
    setName("");
    setLabel("");
    setImage("");
    setNotes("");
    setRowData({});
  }

  function setLayoutContext(dashboardContext) {
    setName(dashboardContext["name"]);
    setLabel(dashboardContext["label"]);
    setImage(dashboardContext["image"]);
    setNotes(dashboardContext["notes"]);
    setRowData(JSON.parse(dashboardContext["rowData"]));
  }

  function getLayoutContext() {
    return {
      name: name,
      label: label,
      image: image,
      notes: notes,
      rowData: JSON.stringify(rowData),
    };
  }

  return (
    <LayoutContext.Provider
      value={[setLayoutContext, resetLayoutContext, getLayoutContext]}
    >
      <LayoutNameContext.Provider value={[name, setName]}>
        <LayoutLabelContext.Provider value={[label, setLabel]}>
          <LayoutImageContext.Provider value={[image, setImage]}>
            <LayoutNotesContext.Provider value={[notes, setNotes]}>
              <LayoutRowDataContext.Provider value={[rowData, setRowData]}>
                {children}
              </LayoutRowDataContext.Provider>
            </LayoutNotesContext.Provider>
          </LayoutImageContext.Provider>
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

export const useLayoutImageContext = () => {
  return useContext(LayoutImageContext);
};

export const useLayoutNotesContext = () => {
  return useContext(LayoutNotesContext);
};

export const useLayoutRowDataContext = () => {
  return useContext(LayoutRowDataContext);
};

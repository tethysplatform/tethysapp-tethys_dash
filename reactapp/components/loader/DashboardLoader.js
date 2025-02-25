import PropTypes from "prop-types";
import { useState, useEffect, useContext, useRef } from "react";
import LoadingAnimation from "components/loader/LoadingAnimation";
import appAPI from "services/api/app";
import {
  AppContext,
  VariableInputsContext,
  LayoutContext,
  EditingContext,
  DisabledEditingMovementContext,
  DataViewerModeContext,
  AvailableDashboardsContext,
} from "components/contexts/Contexts";
import AppTourContextProvider from "components/contexts/AppTourContext";

const DashboardLoader = ({
  children,
  id,
  dashboardName,
  dashboardLabel,
  dashboardDescription,
  dashboardNotes,
  dashboardEditable,
  dashboardAccessGroups,
  dashboardGridItems,
}) => {
  const { csrf } = useContext(AppContext);

  const [isLoaded, setIsLoaded] = useState(false);
  const [variableInputValues, setVariableInputValues] = useState({});
  const [name, setName] = useState(dashboardName);
  const [label, setLabel] = useState(dashboardLabel);
  const [accessGroups, setAccessGroups] = useState(dashboardAccessGroups);
  const [editable, setEditable] = useState(dashboardEditable);
  const [notes, setNotes] = useState(dashboardNotes);
  const [gridItems, setGridItems] = useState(dashboardGridItems);
  const [isEditing, setIsEditing] = useState(false);
  const [disabledEditingMovement, setDisabledEditingMovement] = useState(false);
  const [inDataViewerMode, setInDataViewerMode] = useState(false);
  const { availableDashboards, setAvailableDashboards } = useContext(
    AvailableDashboardsContext
  );
  const originalMetadata = useRef({
    id,
    dashboardName,
    dashboardLabel,
    dashboardDescription,
    dashboardNotes,
    dashboardEditable,
    dashboardAccessGroups,
    dashboardGridItems,
  });

  useEffect(() => {
    setIsLoaded(true);
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (!isEditing) {
      setDisabledEditingMovement(false);
    }
  }, [isEditing]);

  function updateVariableInputValuesWithGridItems(gridItems) {
    const updatedVariableInputValues = {};
    for (let gridItem of gridItems) {
      const args = JSON.parse(gridItem.args_string);

      if (gridItem.source === "Variable Input") {
        if (args.variable_name in variableInputValues) {
          // Keep current selected value for dependent visualizations
          updatedVariableInputValues[args.variable_name] =
            variableInputValues[args.variable_name];
        } else {
          updatedVariableInputValues[args.variable_name] = args.initial_value;
        }
      }
    }
    setVariableInputValues(updatedVariableInputValues);
  }

  function setLayoutContext(dashboardContext) {
    setName(dashboardContext["name"]);
    setLabel(dashboardContext["label"]);
    setAccessGroups(dashboardContext["accessGroups"]);
    setNotes(dashboardContext["notes"]);
    setGridItems(dashboardContext["gridItems"]);
    setEditable(dashboardContext["editable"]);
    updateVariableInputValuesWithGridItems(dashboardContext["gridItems"]);
  }

  function getLayoutContext() {
    return {
      name: name,
      label: label,
      accessGroups: accessGroups,
      notes: notes,
      gridItems: gridItems,
      editable: editable,
    };
  }

  function resetLayoutContext() {
    setName(originalMetadata.current.dashboardName);
    setLabel(originalMetadata.current.dashboardLabel);
    setAccessGroups(originalMetadata.current.dashboardAccessGroups);
    setNotes(originalMetadata.current.dashboardNotes);
    setGridItems(originalMetadata.current.dashboardGridItems);
    setEditable(originalMetadata.current.dashboardEditable);
    updateVariableInputValuesWithGridItems(
      originalMetadata.current.dashboardGridItems
    );
  }

  async function saveLayoutContext(newProperties) {
    const originalDashboard = getLayoutContext();
    const originalName = originalDashboard["name"];
    const originalLabel = originalDashboard["label"];
    const originalAccessGroups = originalDashboard["accessGroups"];
    originalDashboard["originalName"] = originalName;
    originalDashboard["originalLabel"] = originalLabel;
    originalDashboard["originalAccessGroups"] = originalAccessGroups;

    const updatedLayoutContext = {
      ...originalDashboard,
      ...newProperties,
    };
    const apiResponse = await appAPI.updateDashboard(
      updatedLayoutContext,
      csrf
    );
    if (apiResponse["success"]) {
      let newavailableDashboards = Object.assign({}, availableDashboards);
      delete newavailableDashboards[originalName];

      const updatedDashboard = apiResponse["updated_dashboard"];
      const name = updatedDashboard["name"];
      newavailableDashboards[name] = updatedDashboard;
      setAvailableDashboards(newavailableDashboards);
      setLayoutContext(updatedDashboard);
      originalMetadata.current = {
        id: updatedDashboard.id,
        dashboardName: updatedDashboard.name,
        dashboardLabel: updatedDashboard.label,
        dashboardDescription: updatedDashboard.description,
        dashboardNotes: updatedDashboard.notes,
        dashboardEditable: updatedDashboard.editable,
        dashboardAccessGroups: updatedDashboard.accessGroups,
        dashboardGridItems: updatedDashboard.gridItems,
      };
    }
    return apiResponse;
  }

  if (!isLoaded) {
    return <LoadingAnimation />;
  } else {
    return (
      <VariableInputsContext.Provider
        value={{
          variableInputValues,
          setVariableInputValues,
          updateVariableInputValuesWithGridItems,
        }}
      >
        <LayoutContext.Provider
          value={{
            setLayoutContext,
            getLayoutContext,
            resetLayoutContext,
            saveLayoutContext,
          }}
        >
          <EditingContext.Provider value={{ isEditing, setIsEditing }}>
            <DisabledEditingMovementContext.Provider
              value={{
                disabledEditingMovement,
                setDisabledEditingMovement,
              }}
            >
              <DataViewerModeContext.Provider
                value={{
                  inDataViewerMode,
                  setInDataViewerMode,
                }}
              >
                <AppTourContextProvider>{children}</AppTourContextProvider>
              </DataViewerModeContext.Provider>
            </DisabledEditingMovementContext.Provider>
          </EditingContext.Provider>
        </LayoutContext.Provider>
      </VariableInputsContext.Provider>
    );
  }
};

DashboardLoader.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
    PropTypes.object,
  ]),
};

export default DashboardLoader;

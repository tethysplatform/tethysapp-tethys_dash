import PropTypes from "prop-types";
import { useState, useEffect, useContext, useRef } from "react";
import LoadingAnimation from "components/loader/LoadingAnimation";
import appAPI from "services/api/app";
import {
  VariableInputsContext,
  LayoutContext,
  EditingContext,
  DisabledEditingMovementContext,
  DataViewerModeContext,
  AvailableDashboardsContext,
} from "components/contexts/Contexts";
import AppTourContextProvider from "components/contexts/AppTourContext";
import Error from "components/error/Error";
import errorImage from "assets/error404.png";

const DashboardLoader = ({ children, id, name, editable }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [variableInputValues, setVariableInputValues] = useState({});
  const [notes, setNotes] = useState("");
  const [gridItems, setGridItems] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [disabledEditingMovement, setDisabledEditingMovement] = useState(false);
  const [inDataViewerMode, setInDataViewerMode] = useState(false);
  const { updateDashboard } = useContext(AvailableDashboardsContext);
  const originalLayoutContext = useRef({});

  useEffect(() => {
    const fetchDashboard = async () => {
      const response = await appAPI.getDashboard({ id, name });
      if (response.success) {
        setNotes(response.dashboard.notes);
        setGridItems(response.dashboard.gridItems);

        originalLayoutContext.current = {
          dashboardNotes: response.dashboard.notes,
          dashboardGridItems: response.dashboard.gridItems,
        };
      } else {
        setLoadError(true);
      }
    };

    fetchDashboard();
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
    setNotes(dashboardContext["notes"]);
    setGridItems(dashboardContext["gridItems"]);
    updateVariableInputValuesWithGridItems(dashboardContext["gridItems"]);
  }

  function getLayoutContext() {
    return {
      name,
      notes,
      gridItems,
      editable,
    };
  }

  function resetLayoutContext() {
    setNotes(originalLayoutContext.current.dashboardNotes);
    setGridItems(originalLayoutContext.current.dashboardGridItems);
    updateVariableInputValuesWithGridItems(
      originalLayoutContext.current.dashboardGridItems
    );
  }

  async function saveLayoutContext(newProperties) {
    const apiResponse = await updateDashboard(id, newProperties);
    if (apiResponse["success"]) {
      const updatedDashboard = apiResponse.updated_dashboard;
      setLayoutContext(updatedDashboard);
      originalLayoutContext.current = {
        dashboardNotes: updatedDashboard.notes,
        dashboardGridItems: updatedDashboard.gridItems,
      };
    }
    return apiResponse;
  }

  if (loadError) {
    return (
      <Error title="Dashboard Failed to Load" image={errorImage}>
        The dashboard failed to load. Please try again or contact admins.
      </Error>
    );
  } else if (!isLoaded) {
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

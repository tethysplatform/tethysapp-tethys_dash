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
import Error from "components/error/Error";
import errorImage from "assets/error404.png";

const DashboardLoader = ({
  children,
  id,
  name,
  notes,
  editable,
  accessGroups,
  description,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [variableInputValues, setVariableInputValues] = useState({});
  const [gridItems, setGridItems] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [disabledEditingMovement, setDisabledEditingMovement] = useState(false);
  const [inDataViewerMode, setInDataViewerMode] = useState(false);
  const { updateDashboard } = useContext(AvailableDashboardsContext);
  const originalGridItems = useRef({});

  useEffect(() => {
    const fetchDashboard = async () => {
      const response = await appAPI.getDashboard({ id });
      if (response.success) {
        updateGridItems(response.dashboard.gridItems);
        originalGridItems.current = response.dashboard.gridItems;
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

  function updateVariableInputValuesWithGridItems(updatedGridItems) {
    const updatedVariableInputValues = {};
    for (let gridItem of updatedGridItems) {
      const args = JSON.parse(gridItem.args_string);

      if (gridItem.source === "Variable Input") {
        if (args.variable_name in variableInputValues) {
          // Keep current selected value for dependent visualizations
          updatedVariableInputValues[args.variable_name] =
            variableInputValues[args.variable_name];
        } else {
          let initialValue = args.initial_value;
          if (
            args.variable_options_source === "checkbox" &&
            args.initial_value === null
          ) {
            initialValue = false;
          }
          updatedVariableInputValues[args.variable_name] = initialValue;
        }
      }
    }
    setVariableInputValues(updatedVariableInputValues);
  }

  function updateGridItems(updatedGridItems) {
    setGridItems(updatedGridItems);
    updateVariableInputValuesWithGridItems(updatedGridItems);
  }

  function getDashboardMetadata() {
    return {
      id,
      name,
      notes,
      gridItems,
      editable,
      accessGroups,
      description,
    };
  }

  function resetGridItems() {
    setGridItems(originalGridItems.current);
    updateVariableInputValuesWithGridItems(originalGridItems.current);
  }

  async function saveLayoutContext(newProperties) {
    const apiResponse = await updateDashboard({ id, newProperties });
    if (apiResponse["success"]) {
      const updatedDashboard = apiResponse.updated_dashboard;
      if ("gridItems" in newProperties) {
        setGridItems(updatedDashboard.gridItems);
        originalGridItems.current = updatedDashboard.gridItems;
      }
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
            updateGridItems,
            getDashboardMetadata,
            resetGridItems,
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
                {children}
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
  id: PropTypes.number,
  name: PropTypes.string,
  notes: PropTypes.string,
  editable: PropTypes.bool,
  accessGroups: PropTypes.arrayOf(PropTypes.string),
  description: PropTypes.string,
};

export default DashboardLoader;

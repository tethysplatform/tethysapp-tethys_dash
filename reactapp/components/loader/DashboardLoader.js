import PropTypes from "prop-types";
import { useState, useEffect, useContext, useRef, memo } from "react";
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
  uuid,
  publicDashboard,
  userPermission,
  permissions,
  unrestrictedPlacement,
  description,
  owner,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [variableInputValues, setVariableInputValues] = useState({});
  const [gridItems, setGridItems] = useState([]);
  const [notes, setNotes] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [disabledEditingMovement, setDisabledEditingMovement] = useState(false);
  const [inDataViewerMode, setInDataViewerMode] = useState(false);
  const { updateDashboard } = useContext(AvailableDashboardsContext);
  const originalGridItems = useRef({});
  const editable = ["admin", "editor"].includes(userPermission);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await appAPI.getDashboard({ id });
        if (response.success) {
          updateGridItems(response.dashboard.gridItems);
          originalGridItems.current = response.dashboard.gridItems;
          setNotes(response.dashboard.notes);
          setIsLoaded(true);
        } else {
          setLoadError(true);
        }
      } catch (error) {
        setLoadError(true);
      }
    };

    fetchDashboard();
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (!isEditing) {
      setDisabledEditingMovement(false);
    }
  }, [isEditing]);

  function updateVariableInputValuesWithGridItems(updatedGridItems) {
    const updatedVariableInputValues = JSON.parse(
      JSON.stringify(variableInputValues)
    );
    for (let gridItem of updatedGridItems) {
      const args = JSON.parse(gridItem.args_string);

      if (gridItem.source === "Variable Input") {
        if (!(args.variable_name in variableInputValues)) {
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
        }}
      >
        <LayoutContext.Provider
          value={{
            updateGridItems,
            resetGridItems,
            saveLayoutContext,
            id,
            uuid,
            name,
            notes,
            gridItems,
            editable,
            publicDashboard,
            userPermission,
            permissions,
            unrestrictedPlacement,
            description,
            owner,
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
  publicDashboard: PropTypes.bool,
  description: PropTypes.string,
  unrestrictedPlacement: PropTypes.bool,
  uuid: PropTypes.string,
  userPermission: PropTypes.string,
  permissions: PropTypes.arrayOf(
    PropTypes.shape({
      username: PropTypes.string,
      group: PropTypes.string,
      permission: PropTypes.string.isRequired,
    })
  ),
  owner: PropTypes.string,
};

export default memo(DashboardLoader);

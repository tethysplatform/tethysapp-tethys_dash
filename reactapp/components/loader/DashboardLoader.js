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
  TabContext,
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
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [notes, setNotes] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [disabledEditingMovement, setDisabledEditingMovement] = useState(false);
  const [inDataViewerMode, setInDataViewerMode] = useState(false);
  const { updateDashboard } = useContext(AvailableDashboardsContext);
  const originalTabs = useRef({});
  const editable = ["admin", "editor"].includes(userPermission);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await appAPI.getDashboard({ id });
        if (response.success) {
          updateVariableInputValuesWithGridItems(response.dashboard.tabs);
          originalTabs.current = response.dashboard.tabs;
          setNotes(response.dashboard.notes);
          setTabs(response.dashboard.tabs);
          setActiveTabId(response.dashboard.tabs[0].id);
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

  function updateVariableInputValuesWithGridItems(updatedTabs) {
    const updatedVariableInputValues = JSON.parse(
      JSON.stringify(variableInputValues)
    );
    for (let tab of updatedTabs) {
      for (let gridItem of tab.gridItems) {
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
    }
    setVariableInputValues(updatedVariableInputValues);
  }

  function updateTab(tabId, updatedProperties) {
    setTabs((prevTabs) =>
      prevTabs.map((tab) =>
        tab.id === tabId ? { ...tab, ...updatedProperties } : tab
      )
    );
    if ("gridItems" in updatedProperties) {
      updateVariableInputValuesWithGridItems([updatedProperties]);
    }
  }

  function resetTabs() {
    setTabs(originalTabs.current);
    setActiveTabId(originalTabs.current[0].id);
    updateVariableInputValuesWithGridItems(originalTabs.current);
  }

  async function saveLayoutContext(newProperties) {
    const apiResponse = await updateDashboard({ id, newProperties });
    if (apiResponse["success"]) {
      const updatedDashboard = apiResponse.updated_dashboard;
      if ("tabs" in newProperties) {
        const originalActiveTabIndex = tabs.findIndex(
          (tab) => tab.id === activeTabId
        );
        setTabs(updatedDashboard.tabs);
        originalTabs.current = updatedDashboard.tabs;
        setActiveTabId(updatedDashboard.tabs[originalActiveTabIndex].id);
      }
    }
    return apiResponse;
  }

  const addTab = () => {
    const tabName = `Tab ${tabs.length + 1}`;
    const newTab = {
      id: tabName,
      order: tabs.length,
      gridItems: [],
      name: tabName,
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newTab.id);
  };

  const deleteTab = (tabId) => {
    const newTabs = tabs.filter((tab) => tab.id !== tabId);
    setTabs(newTabs);
    if (activeTabId === tabId && newTabs.length > 0) {
      setActiveTabId(newTabs[0].id);
    }
  };

  const reorderTabs = (newOrder) => {
    setTabs(newOrder);
  };

  const getActiveTab = () => tabs.find((tab) => tab.id === activeTabId);

  const getTab = (tabId) => tabs.find((tab) => tab.id === tabId);

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
        <TabContext.Provider
          value={{
            tabs,
            activeTabId,
            setActiveTabId,
            addTab,
            updateTab,
            deleteTab,
            reorderTabs,
            resetTabs,
            getActiveTab,
            getTab,
          }}
        >
          <LayoutContext.Provider
            value={{
              saveLayoutContext,
              id,
              uuid,
              name,
              notes,
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
        </TabContext.Provider>
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

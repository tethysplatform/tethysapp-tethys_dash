import PropTypes from "prop-types";
import {
  useState,
  useEffect,
  useContext,
  useRef,
  memo,
  useCallback,
  useMemo,
} from "react";
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
  const [variableInputDateFormats, setVariableInputDateFormats] = useState({});
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

  const updateVariableInputValuesWithGridItems = useCallback(
    (updatedTabs) => {
      let updatedVariableInputValues = {};
      let updatedVariableInputDateFormats = {};
      // update to use any date range values as well
      // when a griditem is deleted, I want to remove its variable inputs as well

      for (let tab of updatedTabs) {
        for (let gridItem of tab.gridItems) {
          let gridItemValues = {};
          const args = JSON.parse(gridItem.args_string);

          if (gridItem.source === "Variable Input") {
            gridItemValues[args.variable_name] = args.initial_value;

            if (args.initial_value && typeof args.initial_value === "object") {
              for (let [key, value] of Object.entries(args.initial_value)) {
                gridItemValues[key] = value;
              }
            }
          }

          if (gridItem.source === "Map") {
            const mapLayers = JSON.parse(gridItem.args_string).layers || [];
            for (let layer of mapLayers) {
              const layerVariableInputs = layer.attributeVariables || {};
              for (let layerAttributes of Object.values(layerVariableInputs)) {
                for (let attributeVariableInput of Object.values(
                  layerAttributes,
                )) {
                  if (!(attributeVariableInput in updatedVariableInputValues)) {
                    gridItemValues[attributeVariableInput] = null;
                  }
                }
              }
            }
          }

          for (let [key, value] of Object.entries(gridItemValues)) {
            let initialValue =
              variableInputValues[key] === undefined
                ? value
                : variableInputValues[key];

            let dateFormat;
            if (gridItem.source === "Variable Input") {
              if (
                args.variable_options_source === "checkbox" &&
                initialValue === null
              ) {
                initialValue = false;
              }

              if (args.variable_options_source.includes("date")) {
                dateFormat =
                  args?.["variable_options_source.metadata"]?.format || "";
              } else if (
                args.variable_options_source === "slider" &&
                args["variable_options_source.metadata"]?.dataType !== "Number"
              ) {
                dateFormat =
                  args["variable_options_source.metadata"].outputFormat;
              }
            }

            updatedVariableInputValues[key] = initialValue;
            if (dateFormat) {
              updatedVariableInputDateFormats[key] = dateFormat;
            }
          }
        }
      }
      setVariableInputValues(updatedVariableInputValues);
      setVariableInputDateFormats(updatedVariableInputDateFormats);
    },
    [variableInputValues],
  );

  const updateTab = useCallback(
    (tabId, updatedProperties) => {
      setTabs((prevTabs) =>
        prevTabs.map((tab) =>
          tab.id === tabId ? { ...tab, ...updatedProperties } : tab,
        ),
      );
      if ("gridItems" in updatedProperties) {
        updateVariableInputValuesWithGridItems([updatedProperties]);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tabs, activeTabId, variableInputValues],
  );

  const resetTabs = useCallback(() => {
    setTabs(originalTabs.current);
    setActiveTabId(originalTabs.current[0].id);
    updateVariableInputValuesWithGridItems(originalTabs.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalTabs, variableInputValues]);

  const saveLayoutContext = useCallback(
    async (newProperties) => {
      const apiResponse = await updateDashboard({ id, newProperties });
      if (apiResponse["success"]) {
        const updatedDashboard = apiResponse.updated_dashboard;
        if ("tabs" in newProperties) {
          const originalActiveTabIndex = tabs.findIndex(
            (tab) => tab.id === activeTabId,
          );
          setTabs(updatedDashboard.tabs);
          originalTabs.current = updatedDashboard.tabs;
          setActiveTabId(updatedDashboard.tabs[originalActiveTabIndex].id);
        }
      }
      return apiResponse;
    },
    [updateDashboard, id, tabs, activeTabId],
  );

  const addTab = useCallback(() => {
    const tabName = `Tab ${tabs.length + 1}`;
    const newTab = {
      id: tabName,
      order: tabs.length,
      gridItems: [],
      name: tabName,
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newTab.id);
  }, [tabs]);

  const deleteTab = useCallback(
    (tabId) => {
      const newTabs = tabs.filter((tab) => tab.id !== tabId);
      setTabs(newTabs);
      if (activeTabId === tabId && newTabs.length > 0) {
        setActiveTabId(newTabs[0].id);
      }
    },
    [tabs, activeTabId],
  );

  const reorderTabs = useCallback(
    (newOrder) => {
      setTabs(newOrder);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tabs],
  );

  const getActiveTab = useCallback(
    () => tabs.find((tab) => tab.id === activeTabId),
    [tabs, activeTabId],
  );

  const getTab = useCallback(
    (tabId) => tabs.find((tab) => tab.id === tabId),
    [tabs],
  );

  // Always call hooks in the same order
  const variableInputsContextValue = useMemo(
    () => ({
      variableInputValues,
      setVariableInputValues,
      variableInputDateFormats,
    }),
    [variableInputValues, setVariableInputValues, variableInputDateFormats],
  );

  const tabContextValue = useMemo(
    () => ({
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
    }),
    [
      tabs,
      activeTabId,
      addTab,
      updateTab,
      deleteTab,
      reorderTabs,
      resetTabs,
      getActiveTab,
      getTab,
      setActiveTabId,
    ],
  );
  const layoutContextValue = useMemo(
    () => ({
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
    }),
    [
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
    ],
  );
  const editingContextValue = useMemo(
    () => ({ isEditing, setIsEditing }),
    [isEditing, setIsEditing],
  );
  const disabledEditingMovementContextValue = useMemo(
    () => ({ disabledEditingMovement, setDisabledEditingMovement }),
    [disabledEditingMovement, setDisabledEditingMovement],
  );
  const dataViewerModeContextValue = useMemo(
    () => ({ inDataViewerMode, setInDataViewerMode }),
    [inDataViewerMode, setInDataViewerMode],
  );

  if (loadError) {
    return (
      <Error title="Dashboard Failed to Load" image={errorImage}>
        The dashboard failed to load. Please try again or contact admins.
      </Error>
    );
  }
  if (!isLoaded) {
    return <LoadingAnimation text="Loading Dashboard..." />;
  }
  return (
    <VariableInputsContext.Provider value={variableInputsContextValue}>
      <TabContext.Provider value={tabContextValue}>
        <LayoutContext.Provider value={layoutContextValue}>
          <EditingContext.Provider value={editingContextValue}>
            <DisabledEditingMovementContext.Provider
              value={disabledEditingMovementContextValue}
            >
              <DataViewerModeContext.Provider
                value={dataViewerModeContextValue}
              >
                {children}
              </DataViewerModeContext.Provider>
            </DisabledEditingMovementContext.Provider>
          </EditingContext.Provider>
        </LayoutContext.Provider>
      </TabContext.Provider>
    </VariableInputsContext.Provider>
  );
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
    }),
  ),
  owner: PropTypes.string,
};

export default memo(DashboardLoader);

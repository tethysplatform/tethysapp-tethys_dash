import { act, useEffect } from "react";
import userEvent from "@testing-library/user-event";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DataViewerModal from "components/modals/DataViewer/DataViewer";
import {
  mockedDashboards,
  mockedVisualizationsWithDefaults,
} from "__tests__/utilities/constants";
import SelectedDashboardContextProvider, {
  useLayoutContext,
} from "components/contexts/SelectedDashboardContext";
import VariableInputsContextProvider, {
  useVariableInputValuesContext,
} from "components/contexts/VariableInputsContext";
import EditingContextProvider from "components/contexts/EditingContext";
import { DataViewerModeContext } from "components/contexts/DataViewerModeContext";
import PropTypes from "prop-types";
import AvailableDashboardsContextProvider from "components/contexts/AvailableDashboardsContext";
import { AppContext } from "components/contexts/AppContext";

const TestingComponent = (props) => {
  const { setLayoutContext } = useLayoutContext();
  const { variableInputValues } = useVariableInputValuesContext();
  const { setInDataViewerMode } = useDataViewerModeContext();

  useEffect(() => {
    setLayoutContext(props.layoutContext);
    setInDataViewerMode(true);
    // eslint-disable-next-line
  }, []);

  return (
    <>
      <DataViewerModal
        gridItemIndex={props.gridItemIndex}
        source={props.gridItemSource}
        argsString={props.gridItemArgsString}
        metadataString={props.gridItemMetadataString}
        gridItemI={props.gridItemI}
        showModal={props.showModal}
        handleModalClose={props.handleModalClose}
        setGridItemMessage={props.setGridItemMessage}
        setShowGridItemMessage={props.setShowGridItemMessage}
      />
      <p data-testid="variable-values">{JSON.stringify(variableInputValues)}</p>
    </>
  );
};

test("Dashboard Viewer Modal Custom Image", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  const gridItem = mockedDashboard.gridItems[0];
  const mockhandleModalClose = jest.fn();
  const mocksetGridItemMessage = jest.fn();
  const mocksetShowGridItemMessage = jest.fn();

  render(
    <AppContext.Provider
      value={{
        csrf: "csrf",
        dashboards: mockedDashboards,
        visualizations: mockedVisualizationsWithDefaults,
      }}
    >
        <VariableInputsContextProvider>
          <SelectedDashboardContextProvider>
            <AvailableDashboardsContextProvider>
              <EditingContextProvider>
                <DataViewerModeContext.Provider
                  value={{
                    inDataViewerMode: true,
                  }}
                >
                  <TestingComponent
                    layoutContext={mockedDashboard}
                    gridItemIndex={0}
                    gridItemSource={gridItem.source}
                    gridItemArgsString={gridItem.args_string}
                    gridItemMetadataString={gridItem.metadata_string}
                    gridItemI={gridItem.i}
                    showModal={true}
                    handleModalClose={mockhandleModalClose}
                    setGridItemMessage={mocksetGridItemMessage}
                    setShowGridItemMessage={mocksetShowGridItemMessage}
                  />
                </DataViewerModeContext.Provider>
              </EditingContextProvider>
            </AvailableDashboardsContextProvider>
          </SelectedDashboardContextProvider>
        </VariableInputsContextProvider>
    </AppContext.Provider>
  );

  expect(await screen.findByText("Select Cell Data")).toBeInTheDocument();
  expect(await screen.findByText("Visualization")).toBeInTheDocument();
  expect(await screen.findByText("Settings")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(
    await screen.findByText("A visualization must be chosen before saving")
  ).toBeInTheDocument();

  const visualizationTypeSelect = screen.getByLabelText("visualizationType");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(visualizationTypeSelect);
  });
  const customImageOption = await screen.findByText("Custom Image");
  fireEvent.click(customImageOption);
  expect(await screen.findByText("Image Source:")).toBeInTheDocument();
  const imageSourceInput = screen.getByLabelText("Image Source Input");

  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(
    await screen.findByText("All arguments must be filled out before saving")
  ).toBeInTheDocument();

  fireEvent.change(imageSourceInput, { target: { value: "some_png" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));

  expect(mockhandleModalClose).toHaveBeenCalledTimes(1);
  expect(mocksetShowGridItemMessage).toHaveBeenCalledTimes(1);
});

test("Dashboard Viewer Modal Variable Input", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  const gridItem = mockedDashboard.gridItems[0];
  const mockhandleModalClose = jest.fn();
  const mocksetGridItemMessage = jest.fn();
  const mocksetShowGridItemMessage = jest.fn();

  render(
    <AppContext.Provider
      value={{
        csrf: "csrf",
        dashboards: mockedDashboards,
        visualizations: mockedVisualizationsWithDefaults,
      }}
    >
        <VariableInputsContextProvider>
          <SelectedDashboardContextProvider>
            <AvailableDashboardsContextProvider>
              <EditingContextProvider>
                <DataViewerModeContext.Provider
                  value={{
                    inDataViewerMode: true,
                  }}
                >
                  <TestingComponent
                    layoutContext={mockedDashboard}
                    gridItemIndex={0}
                    gridItemSource={gridItem.source}
                    gridItemArgsString={gridItem.args_string}
                    gridItemMetadataString={gridItem.metadata_string}
                    gridItemI={gridItem.i}
                    showModal={true}
                    handleModalClose={mockhandleModalClose}
                    setGridItemMessage={mocksetGridItemMessage}
                    setShowGridItemMessage={mocksetShowGridItemMessage}
                  />
                </DataViewerModeContext.Provider>
              </EditingContextProvider>
            </AvailableDashboardsContextProvider>
          </SelectedDashboardContextProvider>
        </VariableInputsContextProvider>
    </AppContext.Provider>
  );

  expect(await screen.findByText("Select Cell Data")).toBeInTheDocument();
  expect(await screen.findByText("Visualization")).toBeInTheDocument();
  expect(await screen.findByText("Settings")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(
    await screen.findByText("A visualization must be chosen before saving")
  ).toBeInTheDocument();

  const visualizationTypeSelect = screen.getByLabelText("visualizationType");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(visualizationTypeSelect);
  });
  const customImageOption = await screen.findByText("Variable Input");
  fireEvent.click(customImageOption);
  expect(await screen.findByText("Variable Name:")).toBeInTheDocument();
  expect(
    await screen.findByText("Variable Options Source:")
  ).toBeInTheDocument();

  const variableNameInput = screen.getByLabelText("Variable Name Input");
  fireEvent.change(variableNameInput, { target: { value: "Test Variable" } });

  const variableOptionsSourceSelect = screen.getByLabelText(
    "Variable Options Source Input"
  );
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(variableOptionsSourceSelect);
  });
  const textOption = await screen.findByText("text");
  fireEvent.click(textOption);

  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(
    await screen.findByText("Initial value must be selected in the dropdown")
  ).toBeInTheDocument();

  const testVariableInput = await screen.findByLabelText("Test Variable Input");
  fireEvent.change(testVariableInput, { target: { value: "Some Value" } });

  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(mockhandleModalClose).toHaveBeenCalledTimes(1);
  expect(mocksetShowGridItemMessage).toHaveBeenCalledTimes(1);
});

test("Dashboard Viewer Modal Variable Input already exists", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  mockedDashboard.gridItems = [
    {
      i: "1",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "",
      args_string: "{}",
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
    {
      i: "2",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "Variable Input",
      args_string: JSON.stringify({
        variable_name: "Test Variable",
        variable_options_source: "text",
        initial_value: "some value",
      }),
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
  ];
  const gridItem = mockedDashboard.gridItems[0];
  const mockhandleModalClose = jest.fn();
  const mocksetGridItemMessage = jest.fn();
  const mocksetShowGridItemMessage = jest.fn();

  render(
    <AppContext.Provider
      value={{
        csrf: "csrf",
        dashboards: mockedDashboards,
        visualizations: mockedVisualizationsWithDefaults,
      }}
    >
        <VariableInputsContextProvider>
          <SelectedDashboardContextProvider>
            <AvailableDashboardsContextProvider>
              <EditingContextProvider>
                <DataViewerModeContext.Provider
                  value={{
                    inDataViewerMode: true,
                  }}
                >
                  <TestingComponent
                    layoutContext={mockedDashboard}
                    gridItemIndex={0}
                    gridItemSource={gridItem.source}
                    gridItemArgsString={gridItem.args_string}
                    gridItemMetadataString={gridItem.metadata_string}
                    gridItemI={gridItem.i}
                    showModal={true}
                    handleModalClose={mockhandleModalClose}
                    setGridItemMessage={mocksetGridItemMessage}
                    setShowGridItemMessage={mocksetShowGridItemMessage}
                  />
                </DataViewerModeContext.Provider>
              </EditingContextProvider>
            </AvailableDashboardsContextProvider>
          </SelectedDashboardContextProvider>
        </VariableInputsContextProvider>
    </AppContext.Provider>
  );

  expect(await screen.findByText("Select Cell Data")).toBeInTheDocument();
  expect(await screen.findByText("Visualization")).toBeInTheDocument();
  expect(await screen.findByText("Settings")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(
    await screen.findByText("A visualization must be chosen before saving")
  ).toBeInTheDocument();

  const visualizationTypeSelect = screen.getByLabelText("visualizationType");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(visualizationTypeSelect);
  });
  const customImageOption = await screen.findByText("Variable Input");
  fireEvent.click(customImageOption);
  expect(await screen.findByText("Variable Name:")).toBeInTheDocument();
  expect(
    await screen.findByText("Variable Options Source:")
  ).toBeInTheDocument();

  const variableNameInput = screen.getByLabelText("Variable Name Input");
  fireEvent.change(variableNameInput, { target: { value: "Test Variable" } });

  const variableOptionsSourceSelect = screen.getByLabelText(
    "Variable Options Source Input"
  );
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(variableOptionsSourceSelect);
  });
  const textOption = await screen.findByText("text");
  fireEvent.click(textOption);

  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(
    await screen.findByText(
      "Test Variable is already in use for a variable name"
    )
  ).toBeInTheDocument();
  fireEvent.change(variableNameInput, { target: { value: "Test Variable 2" } });

  const testVariableInput = await screen.findByLabelText(
    "Test Variable 2 Input"
  );
  fireEvent.change(testVariableInput, { target: { value: "Some Value" } });

  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(mockhandleModalClose).toHaveBeenCalledTimes(1);
  expect(mocksetShowGridItemMessage).toHaveBeenCalledTimes(1);
});

test("Dashboard Viewer Modal Update Existing Variable Input", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = updatedMockedDashboards.editable;
  mockedDashboard.gridItems = [
    {
      i: "1",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "",
      args_string: "{}",
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
    {
      i: "2",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "Variable Input",
      args_string: JSON.stringify({
        variable_name: "Test Variable",
        variable_options_source: "text",
        initial_value: "some value",
      }),
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
    {
      i: "3",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "",
      args_string: JSON.stringify({
        some_arg: true,
        some_arg2: "Variable Input:Test Variable",
        some_arg3: "some value",
      }),
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
  ];
  const gridItem = mockedDashboard.gridItems[1];
  const mockhandleModalClose = jest.fn();
  const mocksetGridItemMessage = jest.fn();
  const mocksetShowGridItemMessage = jest.fn();

  render(
    <AppContext.Provider
      value={{
        csrf: "csrf",
        dashboards: updatedMockedDashboards,
        visualizations: mockedVisualizationsWithDefaults,
      }}
    >
      <AvailableVisualizationsContext.Provider
        value={{
          availableVisualizations: mockedVisualizationsWithDefaults,
        }}
      >
        <VariableInputsContextProvider>
          <SelectedDashboardContextProvider>
            <AvailableDashboardsContextProvider>
              <EditingContextProvider>
                <DataViewerModeContext.Provider
                  value={{
                    inDataViewerMode: true,
                  }}
                >
                  <TestingComponent
                    layoutContext={mockedDashboard}
                    gridItemIndex={1}
                    gridItemSource={gridItem.source}
                    gridItemArgsString={gridItem.args_string}
                    gridItemMetadataString={gridItem.metadata_string}
                    gridItemI={gridItem.i}
                    showModal={true}
                    handleModalClose={mockhandleModalClose}
                    setGridItemMessage={mocksetGridItemMessage}
                    setShowGridItemMessage={mocksetShowGridItemMessage}
                  />
                </DataViewerModeContext.Provider>
              </EditingContextProvider>
            </AvailableDashboardsContextProvider>
          </SelectedDashboardContextProvider>
        </VariableInputsContextProvider>
    </AppContext.Provider>
  );

  expect(await screen.findByTestId("variable-values")).toHaveTextContent(
    JSON.stringify({
      "Test Variable": "some value",
    })
  );

  const variableNameInput = screen.getByLabelText("Variable Name Input");
  fireEvent.change(variableNameInput, { target: { value: "Test Variable 2" } });

  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(await screen.findByTestId("variable-values")).toHaveTextContent(
    JSON.stringify({
      "Test Variable 2": "some value",
    })
  );
  expect(mockhandleModalClose).toHaveBeenCalledTimes(1);
  expect(mocksetShowGridItemMessage).toHaveBeenCalledTimes(1);
});

test("Dashboard Viewer Modal Switch tabs", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  const gridItem = mockedDashboard.gridItems[0];
  const mockhandleModalClose = jest.fn();
  const mocksetGridItemMessage = jest.fn();
  const mocksetShowGridItemMessage = jest.fn();

  render(
    <AppContext.Provider
      value={{
        csrf: "csrf",
        dashboards: mockedDashboards,
        visualizations: mockedVisualizationsWithDefaults,
      }}
    >
        <VariableInputsContextProvider>
          <SelectedDashboardContextProvider>
            <AvailableDashboardsContextProvider>
              <EditingContextProvider>
                <DataViewerModeContext.Provider
                  value={{
                    inDataViewerMode: true,
                  }}
                >
                  <TestingComponent
                    layoutContext={mockedDashboard}
                    gridItemIndex={0}
                    gridItemSource={gridItem.source}
                    gridItemArgsString={gridItem.args_string}
                    gridItemMetadataString={gridItem.metadata_string}
                    gridItemI={gridItem.i}
                    showModal={true}
                    handleModalClose={mockhandleModalClose}
                    setGridItemMessage={mocksetGridItemMessage}
                    setShowGridItemMessage={mocksetShowGridItemMessage}
                  />
                </DataViewerModeContext.Provider>
              </EditingContextProvider>
            </AvailableDashboardsContextProvider>
          </SelectedDashboardContextProvider>
        </VariableInputsContextProvider>
    </AppContext.Provider>
  );

  expect(await screen.findByText("Select Cell Data")).toBeInTheDocument();
  expect(await screen.findByText("Visualization")).toBeInTheDocument();
  expect(await screen.findByText("Settings")).toBeInTheDocument();

  const visualizationTab = await screen.findByLabelText("visualizationTab");
  const settingsTab = await screen.findByLabelText("settingsTab");

  expect(visualizationTab).toHaveClass("active");
  expect(settingsTab).not.toHaveClass("active");
  fireEvent.click(await screen.findByText("Settings"));
  expect(settingsTab).toHaveClass("active");
  expect(visualizationTab).not.toHaveClass("active");
});

test("Dashboard Viewer Modal selected visualization types modal", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  const gridItem = mockedDashboard.gridItems[0];
  const mockhandleModalClose = jest.fn();
  const mocksetGridItemMessage = jest.fn();
  const mocksetShowGridItemMessage = jest.fn();

  render(
    <AppContext.Provider
      value={{
        csrf: "csrf",
        dashboards: mockedDashboards,
        visualizations: mockedVisualizationsWithDefaults,
      }}
    >
        <VariableInputsContextProvider>
          <SelectedDashboardContextProvider>
            <AvailableDashboardsContextProvider>
              <EditingContextProvider>
                <DataViewerModeContext.Provider
                  value={{
                    inDataViewerMode: true,
                  }}
                >
                  <TestingComponent
                    layoutContext={mockedDashboard}
                    gridItemIndex={0}
                    gridItemSource={gridItem.source}
                    gridItemArgsString={gridItem.args_string}
                    gridItemMetadataString={gridItem.metadata_string}
                    gridItemI={gridItem.i}
                    showModal={true}
                    handleModalClose={mockhandleModalClose}
                    setGridItemMessage={mocksetGridItemMessage}
                    setShowGridItemMessage={mocksetShowGridItemMessage}
                  />
                </DataViewerModeContext.Provider>
              </EditingContextProvider>
            </AvailableDashboardsContextProvider>
          </SelectedDashboardContextProvider>
        </VariableInputsContextProvider>
    </AppContext.Provider>
  );

  const visualizationSettingButton = await screen.findByLabelText(
    "visualizationSettingButton"
  );
  expect(visualizationSettingButton).toBeInTheDocument();
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(visualizationSettingButton);
  });

  const dataviewerModal = await screen.findByLabelText("DataViewer Modal");
  expect(dataviewerModal).toBeInTheDocument();
  expect(dataviewerModal).toHaveStyle({ "z-index": 1050 });

  const selectedVisualizationTypeModal = await screen.findByLabelText(
    "Selected Visualization Type Modal"
  );
  expect(selectedVisualizationTypeModal).toBeInTheDocument();

  // eslint-disable-next-line
  await act(async () => {
    await userEvent.keyboard("{Escape}");
  });
  await waitFor(async () => {
    expect(
      screen.queryByLabelText("Selected Visualization Type Modal")
    ).not.toBeInTheDocument();
  });
  expect(dataviewerModal).not.toHaveStyle({ "z-index": 1050 });
});

TestingComponent.propTypes = {
  editing: PropTypes.bool,
  layoutContext: PropTypes.object,
  gridItemSource: PropTypes.string,
  gridItemI: PropTypes.string,
  gridItemArgsString: PropTypes.string,
  gridItemMetadataString: PropTypes.string,
  gridItemIndex: PropTypes.number,
  showModal: PropTypes.bool,
  handleModalClose: PropTypes.func,
  setGridItemMessage: PropTypes.func,
  setShowGridItemMessage: PropTypes.func,
};

import { act, useEffect } from "react";
import userEvent from "@testing-library/user-event";
import {
  render,
  screen,
  within,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import DashboardItem from "components/dashboard/DashboardItem";
import { mockedDashboards } from "__tests__/utilities/constants";
import SelectedDashboardContextProvider, {
  useLayoutGridItemsContext,
  useLayoutContext,
} from "components/contexts/SelectedDashboardContext";
import VariableInputsContextProvider, {
  useVariableInputValuesContext,
} from "components/contexts/VariableInputsContext";
import EditingContextProvider, {
  useEditingContext,
} from "components/contexts/EditingContext";
import { confirm } from "components/dashboard/DeleteConfirmation";
import AvailableVisualizationsContextProvider from "components/contexts/AvailableVisualizationsContext";
import DataViewerModeContextProvider, {
  useDataViewerModeContext,
} from "components/contexts/DataViewerModeContext";
import { AppContext } from "components/contexts/AppContext";
import PropTypes from "prop-types";

jest.mock("components/dashboard/DeleteConfirmation", () => {
  return {
    confirm: jest.fn(),
  };
});
const mockedConfirm = jest.mocked(confirm);

const TestingComponent = (props) => {
  const { setLayoutContext } = useLayoutContext();
  const { gridItems } = useLayoutGridItemsContext();
  const { isEditing } = useEditingContext();
  const { inDataViewerMode } = useDataViewerModeContext();
  const { variableInputValues } = useVariableInputValuesContext();

  useEffect(() => {
    setLayoutContext(props.layoutContext);
    // eslint-disable-next-line
  }, []);

  return (
    <>
      <DashboardItem
        gridItemSource={props.gridItemSource}
        gridItemI={props.gridItemI}
        gridItemArgsString={props.gridItemArgsString}
        gridItemMetadataString={props.gridItemMetadataString}
        gridItemIndex={props.gridItemIndex}
      />
      <ul data-testid="grid-items">
        {gridItems.map((item, index) => {
          return (
            <div key={index}>
              <li>{item.i}</li>
              <li>{item.args_string}</li>
            </div>
          );
        })}
      </ul>
      <p data-testid="variable-values">{JSON.stringify(variableInputValues)}</p>
      <p>{isEditing ? "yes editing" : "not editing"}</p>
      <p>
        {inDataViewerMode ? "yes in dataviewer mode" : "not in dataviewer mode"}
      </p>
    </>
  );
};

test("Dashboard Item delete grid item", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  const gridItem = mockedDashboard.gridItems[0];
  mockedConfirm.mockResolvedValue(true);

  render(
    <VariableInputsContextProvider>
      <SelectedDashboardContextProvider>
        <EditingContextProvider>
          <DataViewerModeContextProvider>
            <TestingComponent
              layoutContext={mockedDashboard}
              gridItemSource={gridItem.source}
              gridItemI={gridItem.i}
              gridItemArgsString={gridItem.args_string}
              gridItemMetadataString={gridItem.metadata_string}
              gridItemIndex={0}
            />
          </DataViewerModeContextProvider>
        </EditingContextProvider>
      </SelectedDashboardContextProvider>
    </VariableInputsContextProvider>
  );

  const dropdownToggle = screen.getByRole("button");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(dropdownToggle);
  });

  expect(await screen.findByText("1")).toBeInTheDocument();
  expect(await screen.findByText("not editing")).toBeInTheDocument();

  const deleteGridItemButton = await screen.findByText("Delete");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(deleteGridItemButton);
  });

  expect(screen.queryByText("1")).not.toBeInTheDocument();
  expect(await screen.findByText("yes editing")).toBeInTheDocument();
});

test("Dashboard Item delete grid item cancel", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  const gridItem = mockedDashboard.gridItems[0];
  mockedConfirm.mockResolvedValue(false);

  render(
    <VariableInputsContextProvider>
      <SelectedDashboardContextProvider>
        <EditingContextProvider>
          <DataViewerModeContextProvider>
            <TestingComponent
              layoutContext={mockedDashboard}
              gridItemSource={gridItem.source}
              gridItemI={gridItem.i}
              gridItemArgsString={gridItem.args_string}
              gridItemMetadataString={gridItem.metadata_string}
              gridItemIndex={0}
            />
          </DataViewerModeContextProvider>
        </EditingContextProvider>
      </SelectedDashboardContextProvider>
    </VariableInputsContextProvider>
  );

  const dropdownToggle = screen.getByRole("button");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(dropdownToggle);
  });

  expect(await screen.findByText("1")).toBeInTheDocument();
  expect(await screen.findByText("not editing")).toBeInTheDocument();

  const deleteGridItemButton = await screen.findByText("Delete");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(deleteGridItemButton);
  });

  expect(await screen.findByText("1")).toBeInTheDocument();
  expect(await screen.findByText("not editing")).toBeInTheDocument();
});

test("Dashboard Item fullscreen but no source", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  const gridItem = mockedDashboard.gridItems[0];

  render(
    <VariableInputsContextProvider>
      <SelectedDashboardContextProvider>
        <EditingContextProvider>
          <DataViewerModeContextProvider>
            <TestingComponent
              layoutContext={mockedDashboard}
              gridItemSource={gridItem.source}
              gridItemI={gridItem.i}
              gridItemArgsString={gridItem.args_string}
              gridItemMetadataString={gridItem.metadata_string}
              gridItemIndex={0}
            />
          </DataViewerModeContextProvider>
        </EditingContextProvider>
      </SelectedDashboardContextProvider>
    </VariableInputsContextProvider>
  );

  const dropdownToggle = screen.getByRole("button");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(dropdownToggle);
  });

  expect(screen.queryByText("Fullscreen")).not.toBeInTheDocument();
});

test("Dashboard Item fullscreen", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  const gridItem = mockedDashboard.gridItems[0];
  gridItem.source = "Custom Image";
  gridItem.args_string = JSON.stringify({
    image_source: "https://www.aquaveo.com/images/aquaveo_logo.svg",
  });

  render(
    <VariableInputsContextProvider>
      <SelectedDashboardContextProvider>
        <EditingContextProvider>
          <DataViewerModeContextProvider>
            <TestingComponent
              layoutContext={mockedDashboard}
              gridItemSource={gridItem.source}
              gridItemI={gridItem.i}
              gridItemArgsString={gridItem.args_string}
              gridItemMetadataString={gridItem.metadata_string}
              gridItemIndex={0}
            />
          </DataViewerModeContextProvider>
        </EditingContextProvider>
      </SelectedDashboardContextProvider>
    </VariableInputsContextProvider>
  );

  const dropdownToggle = screen.getByRole("button");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(dropdownToggle);
  });

  const fullScreenButton = await screen.findByText("Fullscreen");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(fullScreenButton);
  });
  const fullscreenModal = await screen.findByRole("dialog");
  expect(fullscreenModal).toBeInTheDocument();
  expect(fullscreenModal).toHaveClass("fullscreen");

  const closeFullScreenButton = await screen.findByRole("button", {
    name: "Close",
  });
  // eslint-disable-next-line
  await act(async () => {
    fireEvent.click(closeFullScreenButton);
  });
  await waitFor(() => {
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

test("Dashboard Item edit item", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  const gridItem = mockedDashboard.gridItems[0];

  render(
    <AppContext.Provider value={{ csrf: "csrf" }}>
      <AvailableVisualizationsContextProvider>
        <VariableInputsContextProvider>
          <SelectedDashboardContextProvider>
            <EditingContextProvider>
              <DataViewerModeContextProvider>
                <TestingComponent
                  layoutContext={mockedDashboard}
                  gridItemSource={gridItem.source}
                  gridItemI={gridItem.i}
                  gridItemArgsString={gridItem.args_string}
                  gridItemMetadataString={gridItem.metadata_string}
                  gridItemIndex={0}
                />
              </DataViewerModeContextProvider>
            </EditingContextProvider>
          </SelectedDashboardContextProvider>
        </VariableInputsContextProvider>
      </AvailableVisualizationsContextProvider>
    </AppContext.Provider>
  );

  const dropdownToggle = screen.getByRole("button");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(dropdownToggle);
  });

  expect(await screen.findByText("not editing")).toBeInTheDocument();
  expect(await screen.findByText("not in dataviewer mode")).toBeInTheDocument();

  const editGridItemButton = await screen.findByText("Edit Visualization");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(editGridItemButton);
  });
  const dataViewerModal = await screen.findByRole("dialog");
  expect(dataViewerModal).toBeInTheDocument();
  expect(dataViewerModal).toHaveClass("dataviewer");

  expect(await screen.findByText("yes editing")).toBeInTheDocument();
  expect(await screen.findByText("yes in dataviewer mode")).toBeInTheDocument();

  const closeDataViewerModalButton = within(dataViewerModal).getByText("Close");
  // eslint-disable-next-line
  await act(async () => {
    fireEvent.click(closeDataViewerModalButton);
  });
  expect(await screen.findByText("not in dataviewer mode")).toBeInTheDocument();
});

test("Dashboard Item copy item", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  mockedDashboard.gridItems = [
    {
      i: "1",
      x: 0,
      y: 0,
      w: 10,
      h: 10,
      source: "",
      args_string: "{}",
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
    {
      i: "3",
      x: 0,
      y: 0,
      w: 30,
      h: 30,
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
      source: "",
      args_string: "{}",
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
  ];

  const gridItem = mockedDashboard.gridItems[2];
  render(
    <VariableInputsContextProvider>
      <SelectedDashboardContextProvider>
        <EditingContextProvider>
          <DataViewerModeContextProvider>
            <TestingComponent
              layoutContext={mockedDashboard}
              gridItemSource={gridItem.source}
              gridItemI={gridItem.i}
              gridItemArgsString={gridItem.args_string}
              gridItemMetadataString={gridItem.metadata_string}
              gridItemIndex={2}
            />
          </DataViewerModeContextProvider>
        </EditingContextProvider>
      </SelectedDashboardContextProvider>
    </VariableInputsContextProvider>
  );

  const dropdownToggle = screen.getByRole("button");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(dropdownToggle);
  });

  const createCopyButton = await screen.findByText("Create Copy");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(createCopyButton);
  });
  expect(await screen.findByText("4")).toBeInTheDocument();
  expect(await screen.findByText("yes editing")).toBeInTheDocument();
});

test("Dashboard Item copy item variable input", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  mockedDashboard.gridItems = [
    {
      i: "1",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "Variable Input",
      args_string: JSON.stringify({
        variable_name: "test_var",
        variable_options_source: "checkbox",
        initial_value: { value: true },
      }),
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
  ];
  const gridItem = mockedDashboard.gridItems[0];

  render(
    <AvailableVisualizationsContextProvider>
      <VariableInputsContextProvider>
        <SelectedDashboardContextProvider>
          <EditingContextProvider>
            <DataViewerModeContextProvider>
              <TestingComponent
                layoutContext={mockedDashboard}
                gridItemSource={gridItem.source}
                gridItemI={gridItem.i}
                gridItemArgsString={gridItem.args_string}
                gridItemMetadataString={gridItem.metadata_string}
                gridItemIndex={2}
              />
            </DataViewerModeContextProvider>
          </EditingContextProvider>
        </SelectedDashboardContextProvider>
      </VariableInputsContextProvider>
    </AvailableVisualizationsContextProvider>
  );

  const dropdownToggle = screen.getByRole("button");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(dropdownToggle);
  });

  const createCopyButton = await screen.findByText("Create Copy");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(createCopyButton);
  });
  expect(
    await screen.findByText(
      JSON.stringify({
        variable_name: "test_var",
        variable_options_source: "checkbox",
        initial_value: { value: true },
      })
    )
  ).toBeInTheDocument();
  expect(
    await screen.findByText(
      JSON.stringify({
        variable_name: "test_var_1",
        variable_options_source: "checkbox",
        initial_value: { value: true },
      })
    )
  ).toBeInTheDocument();
  expect(await screen.findByText("2")).toBeInTheDocument();
  expect(await screen.findByText("yes editing")).toBeInTheDocument();
});

test("Dashboard Item copy item variable input already exists", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  mockedDashboard.gridItems = [
    {
      i: "1",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "Variable Input",
      args_string: JSON.stringify({
        variable_name: "test_var",
        variable_options_source: "checkbox",
        initial_value: true,
      }),
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
    {
      i: "1",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "Variable Input",
      args_string: JSON.stringify({
        variable_name: "test_var_1",
        variable_options_source: "checkbox",
        initial_value: true,
      }),
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
  ];
  const gridItem = mockedDashboard.gridItems[0];

  render(
    <AvailableVisualizationsContextProvider>
      <VariableInputsContextProvider>
        <SelectedDashboardContextProvider>
          <EditingContextProvider>
            <DataViewerModeContextProvider>
              <TestingComponent
                layoutContext={mockedDashboard}
                gridItemSource={gridItem.source}
                gridItemI={gridItem.i}
                gridItemArgsString={gridItem.args_string}
                gridItemMetadataString={gridItem.metadata_string}
                gridItemIndex={2}
              />
            </DataViewerModeContextProvider>
          </EditingContextProvider>
        </SelectedDashboardContextProvider>
      </VariableInputsContextProvider>
    </AvailableVisualizationsContextProvider>
  );

  const dropdownToggle = screen.getByRole("button");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(dropdownToggle);
  });

  const createCopyButton = await screen.findByText("Create Copy");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(createCopyButton);
  });

  expect(
    await screen.findByText(
      JSON.stringify({
        variable_name: "test_var",
        variable_options_source: "checkbox",
        initial_value: true,
      })
    )
  ).toBeInTheDocument();
  expect(
    await screen.findByText(
      JSON.stringify({
        variable_name: "test_var_1",
        variable_options_source: "checkbox",
        initial_value: true,
      })
    )
  ).toBeInTheDocument();
  expect(
    await screen.findByText(
      JSON.stringify({
        variable_name: "test_var_2",
        variable_options_source: "checkbox",
        initial_value: true,
      })
    )
  ).toBeInTheDocument();
  expect(await screen.findByTestId("variable-values")).toHaveTextContent(
    JSON.stringify({
      test_var: true,
      test_var_1: true,
      test_var_2: true,
    })
  );
  expect(await screen.findByText("2")).toBeInTheDocument();
  expect(await screen.findByText("yes editing")).toBeInTheDocument();
});

test("Dashboard Item edit size", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  const gridItem = mockedDashboard.gridItems[0];
  gridItem.source = "Custom Image";
  gridItem.args_string = JSON.stringify({
    image_source: "https://www.aquaveo.com/images/aquaveo_logo.svg",
  });
  render(
    <VariableInputsContextProvider>
      <SelectedDashboardContextProvider>
        <EditingContextProvider>
          <DataViewerModeContextProvider>
            <TestingComponent
              layoutContext={mockedDashboard}
              gridItemSource={gridItem.source}
              gridItemI={gridItem.i}
              gridItemArgsString={gridItem.args_string}
              gridItemMetadataString={gridItem.metadata_string}
              gridItemIndex={2}
            />
          </DataViewerModeContextProvider>
        </EditingContextProvider>
      </SelectedDashboardContextProvider>
    </VariableInputsContextProvider>
  );

  const dropdownToggle = screen.getByRole("button");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(dropdownToggle);
  });

  const editSizeButton = await screen.findByText("Edit Size/Location");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(editSizeButton);
  });
  expect(await screen.findByText("yes editing")).toBeInTheDocument();
});

TestingComponent.propTypes = {
  editing: PropTypes.bool,
  layoutContext: PropTypes.object,
  gridItemSource: PropTypes.string,
  gridItemI: PropTypes.string,
  gridItemArgsString: PropTypes.string,
  gridItemMetadataString: PropTypes.string,
  gridItemIndex: PropTypes.number,
};

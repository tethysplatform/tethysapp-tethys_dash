import { act } from "react";
import userEvent from "@testing-library/user-event";
import {
  render,
  screen,
  within,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import DashboardItem from "components/dashboard/DashboardItem";
import {
  mockedDashboards,
  mockedVisualizationArgs,
} from "__tests__/utilities/constants";
import { confirm } from "components/dashboard/DeleteConfirmation";
import { DataViewerModeContext } from "components/contexts/DataViewerModeContext";
import {
  AppContext,
  EditingContext,
  LayoutGridItemsContext,
  LayoutContext,
  VariableInputsContext,
  LayoutEditableContext,
} from "components/contexts/Contexts";

// eslint-disable-next-line
jest.mock("components/modals/DataViewer/VisualizationPane", () => (props) => (
  <>
    <div>Visualization Pane</div>
  </>
));

// eslint-disable-next-line
jest.mock("components/modals/DataViewer/SettingsPane", () => (props) => (
  <>
    <div>Settings Pane</div>
  </>
));

jest.mock("components/dashboard/DeleteConfirmation", () => {
  return {
    confirm: jest.fn(),
  };
});
const mockedConfirm = jest.mocked(confirm);

test("Dashboard Item delete grid item", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  const gridItem = mockedDashboard.gridItems[0];
  mockedConfirm.mockResolvedValue(true);
  const mockSetIsEditing = jest.fn();
  const mockSetLayoutContext = jest.fn();
  const mockGetLayoutContext = jest.fn();

  mockGetLayoutContext.mockReturnValue(mockedDashboard);

  render(
    <EditingContext.Provider
      value={{ isEditing: false, setIsEditing: mockSetIsEditing }}
    >
      <LayoutGridItemsContext.Provider
        value={{ gridItems: mockedDashboard.gridItems }}
      >
        <LayoutContext.Provider
          value={{
            setLayoutContext: mockSetLayoutContext,
            getLayoutContext: mockGetLayoutContext,
          }}
        >
          <LayoutEditableContext.Provider
            value={{
              editableDashboard: true,
            }}
          >
            <VariableInputsContext.Provider
              value={{
                variableInputValues: [],
                setVariableInputValues: jest.fn(),
              }}
            >
              <DataViewerModeContext.Provider
                value={{ setInDataViewerMode: jest.fn() }}
              >
                <DashboardItem
                  gridItemSource={gridItem.source}
                  gridItemI={gridItem.i}
                  gridItemArgsString={gridItem.args_string}
                  gridItemMetadataString={gridItem.metadata_string}
                  gridItemIndex={0}
                />
              </DataViewerModeContext.Provider>
            </VariableInputsContext.Provider>
          </LayoutEditableContext.Provider>
        </LayoutContext.Provider>
      </LayoutGridItemsContext.Provider>
    </EditingContext.Provider>
  );

  const dropdownToggle = screen.getByRole("button");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(dropdownToggle);
  });

  const deleteGridItemButton = await screen.findByText("Delete");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(deleteGridItemButton);
  });

  expect(mockSetLayoutContext).toHaveBeenCalledWith({
    access_groups: [],
    editable: true,
    gridItems: [],
    id: 1,
    label: "test_label",
    name: "editable",
    notes: "test_notes",
  });
  expect(mockSetIsEditing).toHaveBeenCalledWith(true);
});

test("Dashboard Item delete grid item cancel", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  const gridItem = mockedDashboard.gridItems[0];
  mockedConfirm.mockResolvedValue(false);
  const mockSetIsEditing = jest.fn();
  const mockSetLayoutContext = jest.fn();

  render(
    <EditingContext.Provider
      value={{ isEditing: false, setIsEditing: mockSetIsEditing }}
    >
      <LayoutGridItemsContext.Provider
        value={{ gridItems: mockedDashboard.gridItems }}
      >
        <LayoutContext.Provider
          value={{
            setLayoutContext: mockSetLayoutContext,
            getLayoutContext: jest.fn(),
          }}
        >
          <LayoutEditableContext.Provider
            value={{
              editableDashboard: true,
            }}
          >
            <VariableInputsContext.Provider
              value={{
                variableInputValues: [],
                setVariableInputValues: jest.fn(),
              }}
            >
              <DataViewerModeContext.Provider
                value={{ setInDataViewerMode: jest.fn() }}
              >
                <DashboardItem
                  gridItemSource={gridItem.source}
                  gridItemI={gridItem.i}
                  gridItemArgsString={gridItem.args_string}
                  gridItemMetadataString={gridItem.metadata_string}
                  gridItemIndex={0}
                />
              </DataViewerModeContext.Provider>
            </VariableInputsContext.Provider>
          </LayoutEditableContext.Provider>
        </LayoutContext.Provider>
      </LayoutGridItemsContext.Provider>
    </EditingContext.Provider>
  );

  const dropdownToggle = screen.getByRole("button");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(dropdownToggle);
  });

  const deleteGridItemButton = await screen.findByText("Delete");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(deleteGridItemButton);
  });

  expect(mockSetLayoutContext).not.toHaveBeenCalled();
  expect(mockSetIsEditing).not.toHaveBeenCalled();
});

test("Dashboard Item fullscreen but no source", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  const gridItem = mockedDashboard.gridItems[0];

  render(
    <EditingContext.Provider
      value={{ isEditing: false, setIsEditing: jest.fn() }}
    >
      <LayoutGridItemsContext.Provider
        value={{ gridItems: mockedDashboard.gridItems }}
      >
        <LayoutContext.Provider
          value={{
            setLayoutContext: jest.fn(),
            getLayoutContext: jest.fn(),
          }}
        >
          <LayoutEditableContext.Provider
            value={{
              editableDashboard: true,
            }}
          >
            <VariableInputsContext.Provider
              value={{
                variableInputValues: [],
                setVariableInputValues: jest.fn(),
              }}
            >
              <DataViewerModeContext.Provider
                value={{ setInDataViewerMode: jest.fn() }}
              >
                <DashboardItem
                  gridItemSource={gridItem.source}
                  gridItemI={gridItem.i}
                  gridItemArgsString={gridItem.args_string}
                  gridItemMetadataString={gridItem.metadata_string}
                  gridItemIndex={0}
                />
              </DataViewerModeContext.Provider>
            </VariableInputsContext.Provider>
          </LayoutEditableContext.Provider>
        </LayoutContext.Provider>
      </LayoutGridItemsContext.Provider>
    </EditingContext.Provider>
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
    <EditingContext.Provider
      value={{ isEditing: false, setIsEditing: jest.fn() }}
    >
      <LayoutGridItemsContext.Provider
        value={{ gridItems: mockedDashboard.gridItems }}
      >
        <LayoutContext.Provider
          value={{
            setLayoutContext: jest.fn(),
            getLayoutContext: jest.fn(),
          }}
        >
          <LayoutEditableContext.Provider
            value={{
              editableDashboard: true,
            }}
          >
            <VariableInputsContext.Provider
              value={{
                variableInputValues: [],
                setVariableInputValues: jest.fn(),
              }}
            >
              <DataViewerModeContext.Provider
                value={{ setInDataViewerMode: jest.fn() }}
              >
                <DashboardItem
                  gridItemSource={gridItem.source}
                  gridItemI={gridItem.i}
                  gridItemArgsString={gridItem.args_string}
                  gridItemMetadataString={gridItem.metadata_string}
                  gridItemIndex={0}
                />
              </DataViewerModeContext.Provider>
            </VariableInputsContext.Provider>
          </LayoutEditableContext.Provider>
        </LayoutContext.Provider>
      </LayoutGridItemsContext.Provider>
    </EditingContext.Provider>
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
  const mockSetIsEditing = jest.fn();
  const mockSetInDataViewerMode = jest.fn();

  render(
    <EditingContext.Provider
      value={{ isEditing: false, setIsEditing: mockSetIsEditing }}
    >
      <LayoutGridItemsContext.Provider
        value={{ gridItems: mockedDashboard.gridItems }}
      >
        <LayoutContext.Provider
          value={{
            setLayoutContext: jest.fn(),
            getLayoutContext: jest.fn(),
          }}
        >
          <LayoutEditableContext.Provider
            value={{
              editableDashboard: true,
            }}
          >
            <VariableInputsContext.Provider
              value={{
                variableInputValues: [],
                setVariableInputValues: jest.fn(),
              }}
            >
              <DataViewerModeContext.Provider
                value={{ setInDataViewerMode: mockSetInDataViewerMode }}
              >
                <DashboardItem
                  gridItemSource={gridItem.source}
                  gridItemI={gridItem.i}
                  gridItemArgsString={gridItem.args_string}
                  gridItemMetadataString={gridItem.metadata_string}
                  gridItemIndex={0}
                />
              </DataViewerModeContext.Provider>
            </VariableInputsContext.Provider>
          </LayoutEditableContext.Provider>
        </LayoutContext.Provider>
      </LayoutGridItemsContext.Provider>
    </EditingContext.Provider>
  );

  const dropdownToggle = screen.getByRole("button");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(dropdownToggle);
  });

  const editGridItemButton = await screen.findByText("Edit Visualization");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(editGridItemButton);
  });
  const dataViewerModal = await screen.findByRole("dialog");
  expect(dataViewerModal).toBeInTheDocument();
  expect(dataViewerModal).toHaveClass("dataviewer");

  expect(mockSetIsEditing).toHaveBeenCalledWith(true);
  expect(mockSetInDataViewerMode).toHaveBeenCalledWith(true);

  const closeDataViewerModalButton = within(dataViewerModal).getByText("Close");
  // eslint-disable-next-line
  await act(async () => {
    fireEvent.click(closeDataViewerModalButton);
  });
  expect(mockSetInDataViewerMode).toHaveBeenCalledWith(false);
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
  const mockSetIsEditing = jest.fn();
  const mockSetLayoutContext = jest.fn();
  const mockGetLayoutContext = jest.fn();

  mockGetLayoutContext.mockReturnValue(mockedDashboard);

  render(
    <EditingContext.Provider
      value={{ isEditing: false, setIsEditing: mockSetIsEditing }}
    >
      <LayoutGridItemsContext.Provider
        value={{ gridItems: mockedDashboard.gridItems }}
      >
        <LayoutContext.Provider
          value={{
            setLayoutContext: mockSetLayoutContext,
            getLayoutContext: mockGetLayoutContext,
          }}
        >
          <LayoutEditableContext.Provider
            value={{
              editableDashboard: true,
            }}
          >
            <VariableInputsContext.Provider
              value={{
                variableInputValues: [],
                setVariableInputValues: jest.fn(),
              }}
            >
              <DataViewerModeContext.Provider
                value={{ setInDataViewerMode: jest.fn() }}
              >
                <DashboardItem
                  gridItemSource={gridItem.source}
                  gridItemI={gridItem.i}
                  gridItemArgsString={gridItem.args_string}
                  gridItemMetadataString={gridItem.metadata_string}
                  gridItemIndex={2}
                />
              </DataViewerModeContext.Provider>
            </VariableInputsContext.Provider>
          </LayoutEditableContext.Provider>
        </LayoutContext.Provider>
      </LayoutGridItemsContext.Provider>
    </EditingContext.Provider>
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

  expect(mockSetLayoutContext).toHaveBeenCalledWith({
    access_groups: [],
    editable: true,
    gridItems: [
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
      {
        i: "4",
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
    ],
    id: 1,
    label: "test_label",
    name: "editable",
    notes: "test_notes",
  });
  expect(mockSetIsEditing).toHaveBeenCalledWith(true);
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
  const mockSetIsEditing = jest.fn();
  const mockSetLayoutContext = jest.fn();
  const mockGetLayoutContext = jest.fn();
  const mockSetVariableInputValues = jest.fn();

  mockGetLayoutContext.mockReturnValue(mockedDashboard);

  render(
    <AppContext.Provider value={{ visualizationArgs: mockedVisualizationArgs }}>
      <EditingContext.Provider
        value={{ isEditing: false, setIsEditing: mockSetIsEditing }}
      >
        <LayoutGridItemsContext.Provider
          value={{ gridItems: mockedDashboard.gridItems }}
        >
          <LayoutContext.Provider
            value={{
              setLayoutContext: mockSetLayoutContext,
              getLayoutContext: mockGetLayoutContext,
            }}
          >
            <LayoutEditableContext.Provider
              value={{
                editableDashboard: true,
              }}
            >
              <VariableInputsContext.Provider
                value={{
                  variableInputValues: {
                    test_var: true,
                  },
                  setVariableInputValues: mockSetVariableInputValues,
                }}
              >
                <DataViewerModeContext.Provider
                  value={{ setInDataViewerMode: jest.fn() }}
                >
                  <DashboardItem
                    gridItemSource={gridItem.source}
                    gridItemI={gridItem.i}
                    gridItemArgsString={gridItem.args_string}
                    gridItemMetadataString={gridItem.metadata_string}
                    gridItemIndex={0}
                  />
                </DataViewerModeContext.Provider>
              </VariableInputsContext.Provider>
            </LayoutEditableContext.Provider>
          </LayoutContext.Provider>
        </LayoutGridItemsContext.Provider>
      </EditingContext.Provider>
    </AppContext.Provider>
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
  expect(mockSetVariableInputValues).toHaveBeenCalledWith({
    test_var: true,
  });
  expect(mockSetLayoutContext).toHaveBeenCalledWith({
    access_groups: [],
    editable: true,
    gridItems: [
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
      {
        i: "2",
        x: 0,
        y: 0,
        w: 20,
        h: 20,
        source: "Variable Input",
        args_string: JSON.stringify({
          variable_name: "test_var_1",
          variable_options_source: "checkbox",
          initial_value: { value: true },
        }),
        metadata_string: JSON.stringify({
          refreshRate: 0,
        }),
      },
    ],
    id: 1,
    label: "test_label",
    name: "editable",
    notes: "test_notes",
  });
  expect(mockSetIsEditing).toHaveBeenCalledWith(true);
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
        initial_value: { value: true },
      }),
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
        variable_name: "test_var_1",
        variable_options_source: "checkbox",
        initial_value: { value: true },
      }),
      metadata_string: JSON.stringify({
        refreshRate: 0,
      }),
    },
  ];
  const gridItem = mockedDashboard.gridItems[0];
  const mockSetIsEditing = jest.fn();
  const mockSetLayoutContext = jest.fn();
  const mockGetLayoutContext = jest.fn();
  const mockSetVariableInputValues = jest.fn();

  mockGetLayoutContext.mockReturnValue(mockedDashboard);

  render(
    <AppContext.Provider value={{ visualizationArgs: mockedVisualizationArgs }}>
      <EditingContext.Provider
        value={{ isEditing: false, setIsEditing: mockSetIsEditing }}
      >
        <LayoutGridItemsContext.Provider
          value={{ gridItems: mockedDashboard.gridItems }}
        >
          <LayoutContext.Provider
            value={{
              setLayoutContext: mockSetLayoutContext,
              getLayoutContext: mockGetLayoutContext,
            }}
          >
            <LayoutEditableContext.Provider
              value={{
                editableDashboard: true,
              }}
            >
              <VariableInputsContext.Provider
                value={{
                  variableInputValues: {
                    test_var: true,
                    test_var_1: true,
                  },
                  setVariableInputValues: mockSetVariableInputValues,
                }}
              >
                <DataViewerModeContext.Provider
                  value={{ setInDataViewerMode: jest.fn() }}
                >
                  <DashboardItem
                    gridItemSource={gridItem.source}
                    gridItemI={gridItem.i}
                    gridItemArgsString={gridItem.args_string}
                    gridItemMetadataString={gridItem.metadata_string}
                    gridItemIndex={0}
                  />
                </DataViewerModeContext.Provider>
              </VariableInputsContext.Provider>
            </LayoutEditableContext.Provider>
          </LayoutContext.Provider>
        </LayoutGridItemsContext.Provider>
      </EditingContext.Provider>
    </AppContext.Provider>
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
  expect(mockSetVariableInputValues).toHaveBeenCalledWith({
    test_var: true,
    test_var_1: true,
  });
  expect(mockSetLayoutContext).toHaveBeenCalledWith({
    access_groups: [],
    editable: true,
    gridItems: [
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
      {
        i: "2",
        x: 0,
        y: 0,
        w: 20,
        h: 20,
        source: "Variable Input",
        args_string: JSON.stringify({
          variable_name: "test_var_1",
          variable_options_source: "checkbox",
          initial_value: { value: true },
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
        source: "Variable Input",
        args_string: JSON.stringify({
          variable_name: "test_var_2",
          variable_options_source: "checkbox",
          initial_value: { value: true },
        }),
        metadata_string: JSON.stringify({
          refreshRate: 0,
        }),
      },
    ],
    id: 1,
    label: "test_label",
    name: "editable",
    notes: "test_notes",
  });
  expect(mockSetIsEditing).toHaveBeenCalledWith(true);
});

test("Dashboard Item edit size", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  const gridItem = mockedDashboard.gridItems[0];
  gridItem.source = "Custom Image";
  gridItem.args_string = JSON.stringify({
    image_source: "https://www.aquaveo.com/images/aquaveo_logo.svg",
  });
  const mockSetIsEditing = jest.fn();

  render(
    <EditingContext.Provider
      value={{ isEditing: false, setIsEditing: mockSetIsEditing }}
    >
      <LayoutGridItemsContext.Provider
        value={{ gridItems: mockedDashboard.gridItems }}
      >
        <LayoutContext.Provider
          value={{
            setLayoutContext: jest.fn(),
            getLayoutContext: jest.fn(),
          }}
        >
          <LayoutEditableContext.Provider
            value={{
              editableDashboard: true,
            }}
          >
            <VariableInputsContext.Provider
              value={{
                variableInputValues: {
                  test_var: true,
                  test_var_1: true,
                },
                setVariableInputValues: jest.fn(),
              }}
            >
              <DataViewerModeContext.Provider
                value={{ setInDataViewerMode: jest.fn() }}
              >
                <DashboardItem
                  gridItemSource={gridItem.source}
                  gridItemI={gridItem.i}
                  gridItemArgsString={gridItem.args_string}
                  gridItemMetadataString={gridItem.metadata_string}
                  gridItemIndex={0}
                />
              </DataViewerModeContext.Provider>
            </VariableInputsContext.Provider>
          </LayoutEditableContext.Provider>
        </LayoutContext.Provider>
      </LayoutGridItemsContext.Provider>
    </EditingContext.Provider>
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
  expect(mockSetIsEditing).toHaveBeenCalledWith(true);
});

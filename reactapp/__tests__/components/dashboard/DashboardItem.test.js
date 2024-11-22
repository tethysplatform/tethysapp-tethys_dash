import { act } from "react";
import userEvent from "@testing-library/user-event";
import { render, screen, within, fireEvent } from "@testing-library/react";
import DashboardItem from "components/dashboard/DashboardItem";
import { mockedDashboards } from "__tests__/utilities/constants";
import {
  useLayoutEditableContext,
  useLayoutGridItemsContext,
  useLayoutContext,
} from "components/contexts/SelectedDashboardContext";
import { useEditingContext } from "components/contexts/EditingContext";
import { useVariableInputValuesContext } from "components/contexts/VariableInputsContext";
import { useAvailableVisualizationsContext } from "components/contexts/AvailableVisualizationsContext";
import { confirm } from "components/dashboard/DeleteConfirmation";
import {
  useSetDataViewerModeContext,
  useInDataViewerModeContext,
} from "components/contexts/DataViewerModeContext";

jest.mock("components/contexts/EditingContext", () => {
  return {
    useEditingContext: jest.fn(),
  };
});

jest.mock("components/contexts/SelectedDashboardContext", () => {
  return {
    useLayoutContext: jest.fn(),
    useLayoutGridItemsContext: jest.fn(),
    useLayoutEditableContext: jest.fn(),
  };
});

jest.mock("components/contexts/VariableInputsContext", () => {
  return {
    useVariableInputValuesContext: jest.fn(),
  };
});

jest.mock("components/dashboard/DeleteConfirmation", () => {
  return {
    confirm: jest.fn(),
  };
});

jest.mock("components/contexts/AvailableVisualizationsContext", () => {
  return {
    useAvailableVisualizationsContext: jest.fn(),
  };
});

jest.mock("components/contexts/DataViewerModeContext", () => {
  return {
    useSetDataViewerModeContext: jest.fn(),
    useInDataViewerModeContext: jest.fn(),
  };
});

const mockedEditingContext = jest.mocked(useEditingContext);
const mockedLayoutGridItemsContext = jest.mocked(useLayoutGridItemsContext);
const mockedLayoutContext = jest.mocked(useLayoutContext);
const mockedVariableInputValuesContext = jest.mocked(
  useVariableInputValuesContext
);
const mockedEditableContext = jest.mocked(useLayoutEditableContext);
const mockedConfirm = jest.mocked(confirm);
const mockedAvailableVisualizationsContext = jest.mocked(
  useAvailableVisualizationsContext
);
const mockedSetDataViewerModeContext = jest.mocked(useSetDataViewerModeContext);
const mockedInDataViewerModeContext = jest.mocked(useInDataViewerModeContext);

test("Dashboard Item delete grid item", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.test));
  const variableInputValues = {};
  const isEditing = true;
  let inDataViewerMode = false;

  const setIsEditing = jest.fn();
  const mockGetLayoutContext = jest.fn(() => mockedDashboard);
  const mockSetLayoutContext = jest.fn();
  const mockResetLayoutContext = jest.fn();
  const setVariableInputValues = jest.fn();
  const setInDataViewerMode = jest.fn((x) => (inDataViewerMode = x));

  mockedEditingContext.mockReturnValue({isEditing, setIsEditing});
  mockedLayoutGridItemsContext.mockReturnValue([mockedDashboard.gridItems]);
  mockedLayoutContext.mockReturnValue([
    mockSetLayoutContext,
    mockResetLayoutContext,
    mockGetLayoutContext,
  ]);
  mockedVariableInputValuesContext.mockReturnValue({
    variableInputValues,
    setVariableInputValues,
  });
  mockedEditableContext.mockReturnValue(true);
  mockedConfirm.mockReturnValue(Promise.resolve(true));
  mockedSetDataViewerModeContext.mockReturnValue({setInDataViewerMode});
  mockedInDataViewerModeContext.mockReturnValue({inDataViewerMode});

  const gridItem = mockedDashboard.gridItems[0];
  render(
    <DashboardItem
      gridItemSource={gridItem.source}
      gridItemI={gridItem.i}
      gridItemArgsString={gridItem.args_string}
      gridItemMetadataString={gridItem.metadata_string}
      grid_item_index={0}
    />
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
    id: 1,
    name: "test",
    label: "test_label",
    notes: "test_notes",
    editable: true,
    access_groups: [],
    gridItems: [],
  });
  expect(setIsEditing).toHaveBeenCalledWith(true);
});

test("Dashboard Item delete grid item cancel", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.test));
  const variableInputValues = {};
  const isEditing = true;
  let inDataViewerMode = false;

  const setIsEditing = jest.fn();
  const mockGetLayoutContext = jest.fn(() => mockedDashboard);
  const mockSetLayoutContext = jest.fn();
  const mockResetLayoutContext = jest.fn();
  const setVariableInputValues = jest.fn();
  const setInDataViewerMode = jest.fn((x) => (inDataViewerMode = x));

  mockedEditingContext.mockReturnValue({isEditing, setIsEditing});
  mockedLayoutGridItemsContext.mockReturnValue([mockedDashboard.gridItems]);
  mockedLayoutContext.mockReturnValue([
    mockSetLayoutContext,
    mockResetLayoutContext,
    mockGetLayoutContext,
  ]);
  mockedVariableInputValuesContext.mockReturnValue({
    variableInputValues,
    setVariableInputValues,
  });
  mockedEditableContext.mockReturnValue(true);
  mockedConfirm.mockReturnValue(Promise.resolve(false));
  mockedSetDataViewerModeContext.mockReturnValue({setInDataViewerMode});
  mockedInDataViewerModeContext.mockReturnValue({inDataViewerMode});

  const gridItem = mockedDashboard.gridItems[0];
  render(
    <DashboardItem
      gridItemSource={gridItem.source}
      gridItemI={gridItem.i}
      gridItemArgsString={gridItem.args_string}
      gridItemMetadataString={gridItem.metadata_string}
      grid_item_index={0}
    />
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
});

test("Dashboard Item fullscreen but no source", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.test));
  const variableInputValues = {};
  const isEditing = true;
  let inDataViewerMode = false;

  const setIsEditing = jest.fn();
  const mockGetLayoutContext = jest.fn(() => mockedDashboard);
  const mockSetLayoutContext = jest.fn();
  const mockResetLayoutContext = jest.fn();
  const setVariableInputValues = jest.fn();
  const setInDataViewerMode = jest.fn((x) => (inDataViewerMode = x));

  mockedEditingContext.mockReturnValue({isEditing, setIsEditing});
  mockedLayoutGridItemsContext.mockReturnValue([mockedDashboard.gridItems]);
  mockedLayoutContext.mockReturnValue([
    mockSetLayoutContext,
    mockResetLayoutContext,
    mockGetLayoutContext,
  ]);
  mockedVariableInputValuesContext.mockReturnValue({
    variableInputValues,
    setVariableInputValues,
  });
  mockedEditableContext.mockReturnValue(true);
  mockedConfirm.mockReturnValue(Promise.resolve(true));
  mockedSetDataViewerModeContext.mockReturnValue({setInDataViewerMode});
  mockedInDataViewerModeContext.mockReturnValue({inDataViewerMode});

  const gridItem = mockedDashboard.gridItems[0];
  render(
    <DashboardItem
      gridItemSource={gridItem.source}
      gridItemI={gridItem.i}
      gridItemArgsString={gridItem.args_string}
      gridItemMetadataString={gridItem.metadata_string}
      grid_item_index={0}
    />
  );

  const dropdownToggle = screen.getByRole("button");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(dropdownToggle);
  });

  expect(screen.queryByText("Fullscreen")).not.toBeInTheDocument();
});

test("Dashboard Item fullscreen", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.test));
  const variableInputValues = {};
  const isEditing = true;
  let inDataViewerMode = false;
  const availableVisualizations = [];
  const availableVizArgs = [];

  const setIsEditing = jest.fn();
  const mockGetLayoutContext = jest.fn(() => mockedDashboard);
  const mockSetLayoutContext = jest.fn();
  const mockResetLayoutContext = jest.fn();
  const setVariableInputValues = jest.fn();
  const setInDataViewerMode = jest.fn((x) => (inDataViewerMode = x));

  mockedEditingContext.mockReturnValue({isEditing, setIsEditing});
  mockedLayoutGridItemsContext.mockReturnValue([mockedDashboard.gridItems]);
  mockedLayoutContext.mockReturnValue([
    mockSetLayoutContext,
    mockResetLayoutContext,
    mockGetLayoutContext,
  ]);
  mockedVariableInputValuesContext.mockReturnValue({
    variableInputValues,
    setVariableInputValues,
  });
  mockedEditableContext.mockReturnValue(true);
  mockedConfirm.mockReturnValue(Promise.resolve(true));
  mockedAvailableVisualizationsContext.mockReturnValue({
    availableVisualizations,
    availableVizArgs
  });
  mockedSetDataViewerModeContext.mockReturnValue({setInDataViewerMode});
  mockedInDataViewerModeContext.mockReturnValue({inDataViewerMode});

  const gridItem = mockedDashboard.gridItems[0];
  gridItem.source = "Custom Image";
  gridItem.args_string = JSON.stringify({
    image_source: "https://www.aquaveo.com/images/aquaveo_logo.svg",
  });
  render(
    <DashboardItem
      gridItemSource={gridItem.source}
      gridItemI={gridItem.i}
      gridItemArgsString={gridItem.args_string}
      gridItemMetadataString={gridItem.metadata_string}
      grid_item_index={0}
    />
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
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("Dashboard Item edit item", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.test));
  let isEditing = false;
  let inDataViewerMode = false;
  const variableInputValues = {};
  const availableVisualizations = [];
  const availableVizArgs = [];

  const setIsEditing = jest.fn((x) => (isEditing = x));
  const mockGetLayoutContext = jest.fn(() => mockedDashboard);
  const mockSetLayoutContext = jest.fn();
  const mockResetLayoutContext = jest.fn();
  const setVariableInputValues = jest.fn();
  const setInDataViewerMode = jest.fn((x) => (inDataViewerMode = x));

  mockedEditingContext.mockReturnValue({isEditing, setIsEditing});
  mockedLayoutGridItemsContext.mockReturnValue([mockedDashboard.gridItems]);
  mockedLayoutContext.mockReturnValue([
    mockSetLayoutContext,
    mockResetLayoutContext,
    mockGetLayoutContext,
  ]);
  mockedVariableInputValuesContext.mockReturnValue({
    variableInputValues,
    setVariableInputValues,
  });
  mockedEditableContext.mockReturnValue(true);
  mockedConfirm.mockReturnValue(Promise.resolve(true));
  mockedAvailableVisualizationsContext.mockReturnValue({
    availableVisualizations,
    availableVizArgs
  });
  mockedSetDataViewerModeContext.mockReturnValue({setInDataViewerMode});
  mockedInDataViewerModeContext.mockReturnValue({inDataViewerMode});

  const gridItem = mockedDashboard.gridItems[0];
  render(
    <DashboardItem
      gridItemSource={gridItem.source}
      gridItemI={gridItem.i}
      gridItemArgsString={gridItem.args_string}
      gridItemMetadataString={gridItem.metadata_string}
      grid_item_index={0}
    />
  );
  expect(isEditing).toBe(false);

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
  expect(setIsEditing).toHaveBeenCalledWith(true);
  expect(setInDataViewerMode).toHaveBeenCalledWith(true);

  const closeDataViewerModalButton = within(dataViewerModal).getByText("Close");
  // eslint-disable-next-line
  await act(async () => {
    fireEvent.click(closeDataViewerModalButton);
  });
  expect(setInDataViewerMode).toHaveBeenCalledWith(false);
});

test("Dashboard Item copy item", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.test));
  mockedDashboard.gridItems = [
    {
      i: "1",
      x: 0,
      y: 0,
      w: 10,
      h: 10,
      source: "",
      args_string: "{}",
      metadata_string: "{}",
    },
    {
      i: "3",
      x: 0,
      y: 0,
      w: 30,
      h: 30,
      source: "",
      args_string: "{}",
      metadata_string: "{}",
    },
    {
      i: "2",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "",
      args_string: "{}",
      metadata_string: "{}",
    },
  ];
  let isEditing = false;
  let inDataViewerMode = false;
  const variableInputValues = {};
  const availableVisualizations = [];
  const availableVizArgs = [];

  const setIsEditing = jest.fn((x) => (isEditing = x));
  const mockGetLayoutContext = jest.fn(() => mockedDashboard);
  const mockSetLayoutContext = jest.fn();
  const mockResetLayoutContext = jest.fn();
  const setVariableInputValues = jest.fn();
  const setInDataViewerMode = jest.fn((x) => (inDataViewerMode = x));

  mockedEditingContext.mockReturnValue({isEditing, setIsEditing});
  mockedLayoutGridItemsContext.mockReturnValue([mockedDashboard.gridItems]);
  mockedLayoutContext.mockReturnValue([
    mockSetLayoutContext,
    mockResetLayoutContext,
    mockGetLayoutContext,
  ]);
  mockedVariableInputValuesContext.mockReturnValue({
    variableInputValues,
    setVariableInputValues,
  });
  mockedEditableContext.mockReturnValue(true);
  mockedConfirm.mockReturnValue(Promise.resolve(true));
  mockedAvailableVisualizationsContext.mockReturnValue({
    availableVisualizations,
    availableVizArgs
  });
  mockedSetDataViewerModeContext.mockReturnValue({setInDataViewerMode});
  mockedInDataViewerModeContext.mockReturnValue({inDataViewerMode});

  const gridItem = mockedDashboard.gridItems[2];
  render(
    <DashboardItem
      gridItemSource={gridItem.source}
      gridItemI={gridItem.i}
      gridItemArgsString={gridItem.args_string}
      gridItemMetadataString={gridItem.metadata_string}
      grid_item_index={2}
    />
  );
  expect(isEditing).toBe(false);

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
    id: 1,
    name: "test",
    label: "test_label",
    notes: "test_notes",
    editable: true,
    access_groups: [],
    gridItems: [
      {
        i: "1",
        x: 0,
        y: 0,
        w: 10,
        h: 10,
        source: "",
        args_string: "{}",
        metadata_string: "{}",
      },
      {
        i: "3",
        x: 0,
        y: 0,
        w: 30,
        h: 30,
        source: "",
        args_string: "{}",
        metadata_string: "{}",
      },
      {
        i: "2",
        x: 0,
        y: 0,
        w: 20,
        h: 20,
        source: "",
        args_string: "{}",
        metadata_string: "{}",
      },
      {
        i: "4",
        x: 0,
        y: 0,
        w: 20,
        h: 20,
        source: "",
        args_string: "{}",
        metadata_string: "{}",
      },
    ],
  });
  expect(setIsEditing).toHaveBeenCalledWith(true);
});

test("Dashboard Item copy item variable input", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.test));
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
      metadata_string: "{}",
    },
  ];
  let isEditing = false;
  let inDataViewerMode = false;
  const variableInputValues = { test_var: "test_value" };
  const availableVisualizations = [];
  const availableVizArgs = [];

  const setIsEditing = jest.fn((x) => (isEditing = x));
  const mockGetLayoutContext = jest.fn(() => mockedDashboard);
  const mockSetLayoutContext = jest.fn();
  const mockResetLayoutContext = jest.fn();
  const setVariableInputValues = jest.fn();
  const setInDataViewerMode = jest.fn((x) => (inDataViewerMode = x));

  mockedEditingContext.mockReturnValue({isEditing, setIsEditing});
  mockedLayoutGridItemsContext.mockReturnValue([mockedDashboard.gridItems]);
  mockedLayoutContext.mockReturnValue([
    mockSetLayoutContext,
    mockResetLayoutContext,
    mockGetLayoutContext,
  ]);
  mockedVariableInputValuesContext.mockReturnValue({
    variableInputValues,
    setVariableInputValues,
  });
  mockedEditableContext.mockReturnValue(true);
  mockedConfirm.mockReturnValue(Promise.resolve(true));
  mockedAvailableVisualizationsContext.mockReturnValue({
    availableVisualizations,
    availableVizArgs
  });
  mockedSetDataViewerModeContext.mockReturnValue({setInDataViewerMode});
  mockedInDataViewerModeContext.mockReturnValue({inDataViewerMode});

  const gridItem = mockedDashboard.gridItems[0];
  render(
    <DashboardItem
      gridItemSource={gridItem.source}
      gridItemI={gridItem.i}
      gridItemArgsString={gridItem.args_string}
      gridItemMetadataString={gridItem.metadata_string}
      grid_item_index={0}
    />
  );
  expect(isEditing).toBe(false);

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
    id: 1,
    name: "test",
    label: "test_label",
    notes: "test_notes",
    editable: true,
    access_groups: [],
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
        metadata_string: "{}",
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
        metadata_string: "{}",
      },
    ],
  });
  expect(setIsEditing).toHaveBeenCalledWith(true);
  expect(setVariableInputValues).toHaveBeenCalledWith({
    test_var: "test_value",
    test_var_1: "test_value",
  });
});

test("Dashboard Item copy item variable input already exists", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.test));
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
      metadata_string: "{}",
    },
  ];
  let isEditing = false;
  let inDataViewerMode = false;
  const variableInputValues = { test_var: "test_value", test_var_1: "test_value" };
  const availableVisualizations = [];
  const availableVizArgs = [];

  const setIsEditing = jest.fn((x) => (isEditing = x));
  const mockGetLayoutContext = jest.fn(() => mockedDashboard);
  const mockSetLayoutContext = jest.fn();
  const mockResetLayoutContext = jest.fn();
  const setVariableInputValues = jest.fn();
  const setInDataViewerMode = jest.fn((x) => (inDataViewerMode = x));

  mockedEditingContext.mockReturnValue({isEditing, setIsEditing});
  mockedLayoutGridItemsContext.mockReturnValue([mockedDashboard.gridItems]);
  mockedLayoutContext.mockReturnValue([
    mockSetLayoutContext,
    mockResetLayoutContext,
    mockGetLayoutContext,
  ]);
  mockedVariableInputValuesContext.mockReturnValue({
    variableInputValues,
    setVariableInputValues,
  });
  mockedEditableContext.mockReturnValue(true);
  mockedConfirm.mockReturnValue(Promise.resolve(true));
  mockedAvailableVisualizationsContext.mockReturnValue({
    availableVisualizations,
    availableVizArgs
  });
  mockedSetDataViewerModeContext.mockReturnValue({setInDataViewerMode});
  mockedInDataViewerModeContext.mockReturnValue({inDataViewerMode});

  const gridItem = mockedDashboard.gridItems[0];
  render(
    <DashboardItem
      gridItemSource={gridItem.source}
      gridItemI={gridItem.i}
      gridItemArgsString={gridItem.args_string}
      gridItemMetadataString={gridItem.metadata_string}
      grid_item_index={0}
    />
  );
  expect(isEditing).toBe(false);

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
    id: 1,
    name: "test",
    label: "test_label",
    notes: "test_notes",
    editable: true,
    access_groups: [],
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
        metadata_string: "{}",
      },
      {
        i: "2",
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
        metadata_string: "{}",
      },
    ],
  });
  expect(setIsEditing).toHaveBeenCalledWith(true);
  expect(setVariableInputValues).toHaveBeenCalledWith({
    test_var: "test_value",
    test_var_1: "test_value",
    test_var_2: "test_value",
  });
});

test("Dashboard Item edit size", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.test));
  const variableInputValues = {};
  const isEditing = false;
  let inDataViewerMode = false;

  const setIsEditing = jest.fn();
  const mockGetLayoutContext = jest.fn(() => mockedDashboard);
  const mockSetLayoutContext = jest.fn();
  const mockResetLayoutContext = jest.fn();
  const setVariableInputValues = jest.fn();
  const setInDataViewerMode = jest.fn((x) => (inDataViewerMode = x));

  mockedEditingContext.mockReturnValue({isEditing, setIsEditing});
  mockedLayoutGridItemsContext.mockReturnValue([mockedDashboard.gridItems]);
  mockedLayoutContext.mockReturnValue([
    mockSetLayoutContext,
    mockResetLayoutContext,
    mockGetLayoutContext,
  ]);
  mockedVariableInputValuesContext.mockReturnValue({
    variableInputValues,
    setVariableInputValues,
  });
  mockedEditableContext.mockReturnValue(true);
  mockedConfirm.mockReturnValue(Promise.resolve(true));
  mockedSetDataViewerModeContext.mockReturnValue({setInDataViewerMode});
  mockedInDataViewerModeContext.mockReturnValue({inDataViewerMode});

  const gridItem = mockedDashboard.gridItems[0];
  gridItem.source = "Custom Image";
  gridItem.args_string = JSON.stringify({
    image_source: "https://www.aquaveo.com/images/aquaveo_logo.svg",
  });
  render(
    <DashboardItem
      gridItemSource={gridItem.source}
      gridItemI={gridItem.i}
      gridItemArgsString={gridItem.args_string}
      gridItemMetadataString={gridItem.metadata_string}
      grid_item_index={0}
    />
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
  expect(setIsEditing).toHaveBeenCalledWith(true);
});

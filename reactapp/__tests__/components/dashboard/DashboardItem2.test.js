import { act, useState } from "react";
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

test("Dashboard Item edit item", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.test));
  let isEditing = false;
  let inDataViewerMode = false;

  const mockSetIsEditing = jest.fn((x) => (isEditing = x));
  const mockGetLayoutContext = jest.fn(() => mockedDashboard);
  const mockSetLayoutContext = jest.fn();
  const mockResetLayoutContext = jest.fn();
  const mockSetVariableInputValues = jest.fn();
  const mockSetInDataViewerMode = jest.fn((x) => (inDataViewerMode = x));

  mockedEditingContext.mockReturnValue([isEditing, mockSetIsEditing]);
  mockedLayoutGridItemsContext.mockReturnValue([mockedDashboard.gridItems]);
  mockedLayoutContext.mockReturnValue([
    mockSetLayoutContext,
    mockResetLayoutContext,
    mockGetLayoutContext,
  ]);
  mockedVariableInputValuesContext.mockReturnValue([
    {},
    mockSetVariableInputValues,
  ]);
  mockedEditableContext.mockReturnValue(true);
  mockedConfirm.mockReturnValue(Promise.resolve(true));
  mockedAvailableVisualizationsContext.mockReturnValue([[], []]);
  mockedSetDataViewerModeContext.mockReturnValue(mockSetInDataViewerMode);
  mockedInDataViewerModeContext.mockReturnValue(inDataViewerMode);

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
  await act(async () => {
    await userEvent.click(dropdownToggle);
  });

  const editGridItemButton = await screen.findByText("Edit Visualization");
  await act(async () => {
    await userEvent.click(editGridItemButton);
  });
  const dataViewerModal = await screen.findByRole("dialog");
  expect(dataViewerModal).toBeInTheDocument();
  expect(dataViewerModal).toHaveClass("dataviewer");
  expect(mockSetIsEditing).toHaveBeenCalledWith(true);
  expect(mockSetInDataViewerMode).toHaveBeenCalledWith(true);

  const closeDataViewerModalButton = within(dataViewerModal).getByText("Close");
  await act(async () => {
    await userEvent.click(closeDataViewerModalButton);
  });
  expect(mockSetInDataViewerMode).toHaveBeenCalledWith(false);
});

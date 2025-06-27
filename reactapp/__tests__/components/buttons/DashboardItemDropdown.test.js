import { screen, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DashboardItemDropdown from "components/dashboard/DashboardItemDropdown";
import createLoadedComponent from "__tests__/utilities/customRender";
import { mockedDashboards } from "__tests__/utilities/constants";

test("DashboardItemDropdown for editable item but already in edit mode", async () => {
  const mockDeleteGridItem = jest.fn();
  const mockEditGridItem = jest.fn();
  const mockCopyGridItem = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <DashboardItemDropdown
          deleteGridItem={mockDeleteGridItem}
          editGridItem={mockEditGridItem}
          copyGridItem={mockCopyGridItem}
        />
      ),
      options: {
        initialDashboard: mockedDashboards.user[0],
        editableDashboard: true,
      },
    })
  );

  const dropdownToggle = await screen.findByRole("button");
  await userEvent.click(dropdownToggle);

  expect(await screen.findByText("Edit")).toBeInTheDocument();
  expect(await screen.findByText("Copy")).toBeInTheDocument();
  expect(await screen.findByText("Delete")).toBeInTheDocument();

  const editGridItemButton = await screen.findByText("Edit");
  await userEvent.click(editGridItemButton);
  expect(mockEditGridItem.mock.calls).toHaveLength(1);

  const copyGridItemButton = await screen.findByText("Copy");
  await userEvent.click(copyGridItemButton);
  expect(mockCopyGridItem.mock.calls).toHaveLength(1);

  const deleteGridItemButton = await screen.findByText("Delete");
  await userEvent.click(deleteGridItemButton);
  expect(mockDeleteGridItem.mock.calls).toHaveLength(1);
});

test("DashboardItemDropdown for editable item and not in edit mode", async () => {
  const mockDeleteGridItem = jest.fn();
  const mockEditGridItem = jest.fn();
  const mockCopyGridItem = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <DashboardItemDropdown
          deleteGridItem={mockDeleteGridItem}
          editGridItem={mockEditGridItem}
          copyGridItem={mockCopyGridItem}
        />
      ),
      options: {
        initialDashboard: mockedDashboards.user[0],
        editableDashboard: true,
      },
    })
  );

  const dropdownToggle = await screen.findByRole("button");
  await userEvent.click(dropdownToggle);

  expect(await screen.findByText("Edit")).toBeInTheDocument();
  expect(await screen.findByText("Copy")).toBeInTheDocument();
  expect(await screen.findByText("Delete")).toBeInTheDocument();

  const editGridItemButton = await screen.findByText("Edit");
  await userEvent.click(editGridItemButton);
  expect(mockEditGridItem.mock.calls).toHaveLength(1);

  const copyGridItemButton = await screen.findByText("Copy");
  await userEvent.click(copyGridItemButton);
  expect(mockCopyGridItem.mock.calls).toHaveLength(1);

  const deleteGridItemButton = await screen.findByText("Delete");
  await userEvent.click(deleteGridItemButton);
  expect(mockDeleteGridItem.mock.calls).toHaveLength(1);
});

import { screen, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DashboardItemDropdown from "components/dashboard/DashboardItemDropdown";
import createLoadedComponent from "__tests__/utilities/customRender";
import { mockedDashboards } from "__tests__/utilities/constants";

test("DashboardItemDropdown for noneditable item and no fullscreen", () => {
  render(
    createLoadedComponent({
      children: (
        <DashboardItemDropdown
          showFullscreen={null}
          deleteGridItem={jest.fn()}
          editGridItem={jest.fn()}
          editSize={jest.fn()}
          copyGridItem={jest.fn()}
        />
      ),
      options: { initialDashboard: mockedDashboards.public[0] },
    })
  );

  expect(screen.queryByText("Fullscreen")).not.toBeInTheDocument();
  expect(screen.queryByText("Edit Visualization")).not.toBeInTheDocument();
  expect(screen.queryByText("Edit Size/Location")).not.toBeInTheDocument();
  expect(screen.queryByText("Create Copy")).not.toBeInTheDocument();
  expect(screen.queryByText("Delete")).not.toBeInTheDocument();
});

test("DashboardItemDropdown for noneditable item but has fullscreen", async () => {
  const mockShowFullscreen = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <DashboardItemDropdown
          showFullscreen={mockShowFullscreen}
          deleteGridItem={jest.fn()}
          editGridItem={jest.fn()}
          editSize={jest.fn()}
          copyGridItem={jest.fn()}
        />
      ),
      options: {
        initialDashboard: mockedDashboards.public[0],
      },
    })
  );

  const dropdownToggle = await screen.findByRole("button");
  await userEvent.click(dropdownToggle);

  expect(await screen.findByText("Fullscreen")).toBeInTheDocument();
  expect(screen.queryByText("Edit Visualization")).not.toBeInTheDocument();
  expect(screen.queryByText("Edit Size/Location")).not.toBeInTheDocument();
  expect(screen.queryByText("Create Copy")).not.toBeInTheDocument();
  expect(screen.queryByText("Delete")).not.toBeInTheDocument();

  const fullScreenButton = await screen.findByText("Fullscreen");
  await userEvent.click(fullScreenButton);
  expect(mockShowFullscreen.mock.calls).toHaveLength(1);
});

test("DashboardItemDropdown for editable item but already in edit mode", async () => {
  const mockShowFullscreen = jest.fn();
  const mockDeleteGridItem = jest.fn();
  const mockEditGridItem = jest.fn();
  const mockCopyGridItem = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <DashboardItemDropdown
          showFullscreen={mockShowFullscreen}
          deleteGridItem={mockDeleteGridItem}
          editGridItem={mockEditGridItem}
          editSize={null}
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

  expect(await screen.findByText("Fullscreen")).toBeInTheDocument();
  expect(await screen.findByText("Edit Visualization")).toBeInTheDocument();
  expect(screen.queryByText("Edit Size/Location")).not.toBeInTheDocument();
  expect(await screen.findByText("Create Copy")).toBeInTheDocument();
  expect(await screen.findByText("Delete")).toBeInTheDocument();

  const fullScreenButton = await screen.findByText("Fullscreen");
  await userEvent.click(fullScreenButton);
  expect(mockShowFullscreen.mock.calls).toHaveLength(1);

  const editGridItemButton = await screen.findByText("Edit Visualization");
  await userEvent.click(editGridItemButton);
  expect(mockEditGridItem.mock.calls).toHaveLength(1);

  const copyGridItemButton = await screen.findByText("Create Copy");
  await userEvent.click(copyGridItemButton);
  expect(mockCopyGridItem.mock.calls).toHaveLength(1);

  const deleteGridItemButton = await screen.findByText("Delete");
  await userEvent.click(deleteGridItemButton);
  expect(mockDeleteGridItem.mock.calls).toHaveLength(1);
});

test("DashboardItemDropdown for editable item and not in edit mode", async () => {
  const mockShowFullscreen = jest.fn();
  const mockDeleteGridItem = jest.fn();
  const mockEditGridItem = jest.fn();
  const mockCopyGridItem = jest.fn();
  const mockEditSize = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <DashboardItemDropdown
          showFullscreen={mockShowFullscreen}
          deleteGridItem={mockDeleteGridItem}
          editGridItem={mockEditGridItem}
          editSize={mockEditSize}
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

  expect(await screen.findByText("Fullscreen")).toBeInTheDocument();
  expect(await screen.findByText("Edit Visualization")).toBeInTheDocument();
  expect(await screen.findByText("Edit Size/Location")).toBeInTheDocument();
  expect(await screen.findByText("Create Copy")).toBeInTheDocument();
  expect(await screen.findByText("Delete")).toBeInTheDocument();

  const fullScreenButton = await screen.findByText("Fullscreen");
  await userEvent.click(fullScreenButton);
  expect(mockShowFullscreen.mock.calls).toHaveLength(1);

  const editGridItemButton = await screen.findByText("Edit Visualization");
  await userEvent.click(editGridItemButton);
  expect(mockEditGridItem.mock.calls).toHaveLength(1);

  const editSizeButton = await screen.findByText("Edit Size/Location");
  await userEvent.click(editSizeButton);
  expect(mockEditSize.mock.calls).toHaveLength(1);

  const copyGridItemButton = await screen.findByText("Create Copy");
  await userEvent.click(copyGridItemButton);
  expect(mockCopyGridItem.mock.calls).toHaveLength(1);

  const deleteGridItemButton = await screen.findByText("Delete");
  await userEvent.click(deleteGridItemButton);
  expect(mockDeleteGridItem.mock.calls).toHaveLength(1);
});

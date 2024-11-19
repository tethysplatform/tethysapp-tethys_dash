import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import DashboardItemDropdown from "components/buttons/DashboardItemDropdown";
import { useLayoutEditableContext } from "components/contexts/SelectedDashboardContext";

jest.mock("components/contexts/SelectedDashboardContext", () => {
  return {
    useLayoutEditableContext: jest.fn(),
  };
});

const mockDeleteGridItem = jest.fn();
const mockEditGridItem = jest.fn();
const mockCopyGridItem = jest.fn();
const mockEditSize = jest.fn();
const mockShowFullscreen = jest.fn();

test("DashboardItemDropdown for noneditable item and no fullscreen", () => {
  render(
    <DashboardItemDropdown
      showFullscreen={null}
      deleteGridItem={mockDeleteGridItem}
      editGridItem={mockEditGridItem}
      editSize={mockEditSize}
      copyGridItem={mockCopyGridItem}
    />
  );

  expect(screen.queryByText("Fullscreen")).not.toBeInTheDocument();
  expect(screen.queryByText("Edit Visualization")).not.toBeInTheDocument();
  expect(screen.queryByText("Edit Size/Location")).not.toBeInTheDocument();
  expect(screen.queryByText("Create Copy")).not.toBeInTheDocument();
  expect(screen.queryByText("Delete")).not.toBeInTheDocument();
});

test("DashboardItemDropdown for noneditable item but has fullscreen", async () => {
  render(
    <DashboardItemDropdown
      showFullscreen={mockShowFullscreen}
      deleteGridItem={mockDeleteGridItem}
      editGridItem={mockEditGridItem}
      editSize={mockEditSize}
      copyGridItem={mockCopyGridItem}
    />
  );

  const dropdownToggle = screen.getByRole("button");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(dropdownToggle);
  });

  expect(await screen.findByText("Fullscreen")).toBeInTheDocument();
  expect(screen.queryByText("Edit Visualization")).not.toBeInTheDocument();
  expect(screen.queryByText("Edit Size/Location")).not.toBeInTheDocument();
  expect(screen.queryByText("Create Copy")).not.toBeInTheDocument();
  expect(screen.queryByText("Delete")).not.toBeInTheDocument();

  const fullScreenButton = await screen.findByText("Fullscreen");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(fullScreenButton);
  });
  expect(mockShowFullscreen.mock.calls).toHaveLength(1);
});

test("DashboardItemDropdown for editable item but already in edit mode", async () => {
  const mockedEditableContext = jest.mocked(useLayoutEditableContext);
  mockedEditableContext.mockReturnValue(true);
  render(
    <DashboardItemDropdown
      showFullscreen={mockShowFullscreen}
      deleteGridItem={mockDeleteGridItem}
      editGridItem={mockEditGridItem}
      editSize={null}
      copyGridItem={mockCopyGridItem}
    />
  );

  const dropdownToggle = screen.getByRole("button");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(dropdownToggle);
  });

  expect(await screen.findByText("Fullscreen")).toBeInTheDocument();
  expect(await screen.findByText("Edit Visualization")).toBeInTheDocument();
  expect(screen.queryByText("Edit Size/Location")).not.toBeInTheDocument();
  expect(await screen.findByText("Create Copy")).toBeInTheDocument();
  expect(await screen.findByText("Delete")).toBeInTheDocument();

  const fullScreenButton = await screen.findByText("Fullscreen");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(fullScreenButton);
  });
  expect(mockShowFullscreen.mock.calls).toHaveLength(1);

  const editGridItemButton = await screen.findByText("Edit Visualization");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(editGridItemButton);
  });
  expect(mockEditGridItem.mock.calls).toHaveLength(1);

  const copyGridItemButton = await screen.findByText("Create Copy");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(copyGridItemButton);
  });
  expect(mockCopyGridItem.mock.calls).toHaveLength(1);

  const deleteGridItemButton = await screen.findByText("Delete");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(deleteGridItemButton);
  });
  expect(mockDeleteGridItem.mock.calls).toHaveLength(1);
});

test("DashboardItemDropdown for editable item and not in edit mode", async () => {
  const mockedEditableContext = jest.mocked(useLayoutEditableContext);
  mockedEditableContext.mockReturnValue(true);
  render(
    <DashboardItemDropdown
      showFullscreen={mockShowFullscreen}
      deleteGridItem={mockDeleteGridItem}
      editGridItem={mockEditGridItem}
      editSize={mockEditSize}
      copyGridItem={mockCopyGridItem}
    />
  );

  const dropdownToggle = screen.getByRole("button");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(dropdownToggle);
  });

  expect(await screen.findByText("Fullscreen")).toBeInTheDocument();
  expect(await screen.findByText("Edit Visualization")).toBeInTheDocument();
  expect(await screen.findByText("Edit Size/Location")).toBeInTheDocument();
  expect(await screen.findByText("Create Copy")).toBeInTheDocument();
  expect(await screen.findByText("Delete")).toBeInTheDocument();

  const fullScreenButton = await screen.findByText("Fullscreen");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(fullScreenButton);
  });
  expect(mockShowFullscreen.mock.calls).toHaveLength(1);

  const editGridItemButton = await screen.findByText("Edit Visualization");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(editGridItemButton);
  });
  expect(mockEditGridItem.mock.calls).toHaveLength(1);

  const editSizeButton = await screen.findByText("Edit Size/Location");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(editSizeButton);
  });
  expect(mockEditSize.mock.calls).toHaveLength(1);

  const copyGridItemButton = await screen.findByText("Create Copy");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(copyGridItemButton);
  });
  expect(mockCopyGridItem.mock.calls).toHaveLength(1);

  const deleteGridItemButton = await screen.findByText("Delete");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(deleteGridItemButton);
  });
  expect(mockDeleteGridItem.mock.calls).toHaveLength(1);
});

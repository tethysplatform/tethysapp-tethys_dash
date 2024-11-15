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
  const { container } = render(
    <DashboardItemDropdown
      showFullscreen={null}
      deleteGridItem={mockDeleteGridItem}
      editGridItem={mockEditGridItem}
      editSize={mockEditSize}
      copyGridItem={mockCopyGridItem}
    />
  );

  expect(container.getElementsByClassName("dropdown-menu").length).toBe(0);
});

test("DashboardItemDropdown for noneditable item but has fullscreen", async () => {
  const { container } = render(
    <DashboardItemDropdown
      showFullscreen={mockShowFullscreen}
      deleteGridItem={mockDeleteGridItem}
      editGridItem={mockEditGridItem}
      editSize={mockEditSize}
      copyGridItem={mockCopyGridItem}
    />
  );

  const dropdownToggle = container.getElementsByClassName("dropdown-toggle")[0];
  const user = userEvent.setup();
  await act(async () => {
    await user.click(dropdownToggle);
  });

  const dropdownItems = container.getElementsByClassName("dropdown-item");
  expect(dropdownItems.length).toBe(1);

  const fullScreenButton = dropdownItems[0];
  await act(async () => {
    await user.click(fullScreenButton);
  });
  expect(mockShowFullscreen.mock.calls).toHaveLength(1);
});

test("DashboardItemDropdown for editable item but already in edit mode", async () => {
  const mockedEditableContext = jest.mocked(useLayoutEditableContext);
  mockedEditableContext.mockReturnValue(true);
  const { container } = render(
    <DashboardItemDropdown
      showFullscreen={mockShowFullscreen}
      deleteGridItem={mockDeleteGridItem}
      editGridItem={mockEditGridItem}
      editSize={null}
      copyGridItem={mockCopyGridItem}
    />
  );

  const dropdownToggle = container.getElementsByClassName("dropdown-toggle")[0];
  const user = userEvent.setup();
  await act(async () => {
    await user.click(dropdownToggle);
  });

  const dropdownItems = container.getElementsByClassName("dropdown-item");
  expect(dropdownItems.length).toBe(4);

  const fullScreenButton = dropdownItems[0];
  await act(async () => {
    await user.click(fullScreenButton);
  });
  expect(mockShowFullscreen.mock.calls).toHaveLength(1);

  const editGridItemButton = dropdownItems[1];
  await act(async () => {
    await user.click(editGridItemButton);
  });
  expect(mockEditGridItem.mock.calls).toHaveLength(1);

  const copyGridItemButton = dropdownItems[2];
  await act(async () => {
    await user.click(copyGridItemButton);
  });
  expect(mockCopyGridItem.mock.calls).toHaveLength(1);

  const deleteGridItemButton = dropdownItems[3];
  await act(async () => {
    await user.click(deleteGridItemButton);
  });
  expect(mockDeleteGridItem.mock.calls).toHaveLength(1);
});

test("DashboardItemDropdown for editable item and not in edit mode", async () => {
  const mockedEditableContext = jest.mocked(useLayoutEditableContext);
  mockedEditableContext.mockReturnValue(true);
  const { container } = render(
    <DashboardItemDropdown
      showFullscreen={mockShowFullscreen}
      deleteGridItem={mockDeleteGridItem}
      editGridItem={mockEditGridItem}
      editSize={mockEditSize}
      copyGridItem={mockCopyGridItem}
    />
  );

  const dropdownToggle = container.getElementsByClassName("dropdown-toggle")[0];
  const user = userEvent.setup();
  await act(async () => {
    await user.click(dropdownToggle);
  });

  const dropdownItems = container.getElementsByClassName("dropdown-item");
  expect(dropdownItems.length).toBe(5);

  const fullScreenButton = dropdownItems[0];
  await act(async () => {
    await user.click(fullScreenButton);
  });
  expect(mockShowFullscreen.mock.calls).toHaveLength(1);

  const editGridItemButton = dropdownItems[1];
  await act(async () => {
    await user.click(editGridItemButton);
  });
  expect(mockEditGridItem.mock.calls).toHaveLength(1);

  const editSizeButton = dropdownItems[2];
  await act(async () => {
    await user.click(editSizeButton);
  });
  expect(mockEditSize.mock.calls).toHaveLength(1);

  const copyGridItemButton = dropdownItems[3];
  await act(async () => {
    await user.click(copyGridItemButton);
  });
  expect(mockCopyGridItem.mock.calls).toHaveLength(1);

  const deleteGridItemButton = dropdownItems[4];
  await act(async () => {
    await user.click(deleteGridItemButton);
  });
  expect(mockDeleteGridItem.mock.calls).toHaveLength(1);
});

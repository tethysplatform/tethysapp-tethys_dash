import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import createLoadedComponent, {
  TabsPComponent,
} from "__tests__/utilities/customRender";
import DashboardTabs from "components/dashboard/DashboardTabs";
import { userDashboard } from "__tests__/utilities/constants";
import userEvent from "@testing-library/user-event";
import { confirm } from "components/inputs/DeleteConfirmation";
jest.mock("components/inputs/DeleteConfirmation", () => {
  return {
    confirm: jest.fn(),
  };
});
const mockedConfirm = jest.mocked(confirm);

test("Dashboard Tabs, single tab and not editing", async () => {
  render(
    createLoadedComponent({
      children: (
        <>
          <DashboardTabs />
          <TabsPComponent />
        </>
      ),
    }),
  );

  expect(await screen.findByLabelText("gridItemDiv")).toBeInTheDocument();

  const tablist = screen.queryByRole("tablist", { hidden: true });

  // Assert that it's in the document and not visible
  expect(tablist).toBeInTheDocument();
  expect(tablist).not.toBeVisible();
});

test("Dashboard Tabs, multiple tab and not editing", async () => {
  const expectedDashboard = JSON.parse(JSON.stringify(userDashboard));
  expectedDashboard.tabs = [
    {
      id: 1,
      name: "Tab 1",
      gridItems: [
        {
          id: 1,
          args_string: "{}",
          h: 20,
          i: "1",
          source: "",
          metadata_string: '{"refreshRate":0}',
          w: 28,
          x: 0,
          y: 0,
        },
      ],
    },
    {
      id: 2,
      name: "Tab 2",
      gridItems: [
        {
          id: 2,
          args_string: "{}",
          h: 20,
          i: "1",
          source: "",
          metadata_string: '{"refreshRate":0}',
          w: 28,
          x: 0,
          y: 0,
        },
      ],
    },
  ];

  render(
    createLoadedComponent({
      children: (
        <>
          <DashboardTabs />
          <TabsPComponent />
        </>
      ),
      options: { dashboards: { dashboards: [expectedDashboard] } },
    }),
  );

  const tablist = await screen.findByRole("tablist");

  expect(tablist).toBeInTheDocument();
  expect(tablist).toBeVisible();

  expect(screen.getAllByRole("tabpanel")).toHaveLength(2);
  await waitFor(() => {
    expect(screen.getAllByLabelText("gridItemDiv")).toHaveLength(2);
  });
});

test("Dashboard Tabs, single tab and editing", async () => {
  render(
    createLoadedComponent({
      children: (
        <>
          <DashboardTabs />
          <TabsPComponent />
        </>
      ),
      options: {
        inEditing: true,
      },
    }),
  );

  expect(await screen.findByLabelText("gridItemDiv")).toBeInTheDocument();

  // Find the tab lists
  const tablist = screen.getByRole("tablist");

  // Assert that it's in the document and visible
  expect(tablist).toBeInTheDocument();
  expect(tablist).toBeVisible();

  expect(screen.queryAllByRole("tabpanel")).toHaveLength(2); // includes add tab
});

test("Dashboard Tabs, multiple tab and editing", async () => {
  const expectedDashboard = JSON.parse(JSON.stringify(userDashboard));
  expectedDashboard.tabs = [
    {
      id: 1,
      name: "Tab 1",
      gridItems: [
        {
          id: 1,
          args_string: "{}",
          h: 20,
          i: "1",
          source: "",
          metadata_string: '{"refreshRate":0}',
          w: 28,
          x: 0,
          y: 0,
        },
      ],
    },
    {
      id: 2,
      name: "Tab 2",
      gridItems: [
        {
          id: 2,
          args_string: "{}",
          h: 20,
          i: "1",
          source: "",
          metadata_string: '{"refreshRate":0}',
          w: 28,
          x: 0,
          y: 0,
        },
      ],
    },
  ];

  render(
    createLoadedComponent({
      children: (
        <>
          <DashboardTabs />
          <TabsPComponent />
        </>
      ),
      options: {
        dashboards: { dashboards: [expectedDashboard] },
        inEditing: true,
      },
    }),
  );

  const tablist = await screen.findByRole("tablist");

  expect(tablist).toBeInTheDocument();
  expect(tablist).toBeVisible();

  expect(screen.getAllByRole("tabpanel")).toHaveLength(3); // includes add tab
  await waitFor(() => {
    expect(screen.getAllByLabelText("gridItemDiv")).toHaveLength(2);
  });
});

test("Dashboard Tabs, select tab", async () => {
  const expectedDashboard = JSON.parse(JSON.stringify(userDashboard));
  expectedDashboard.tabs = [
    {
      id: 1,
      name: "Tab 1",
      gridItems: [
        {
          id: 1,
          args_string: "{}",
          h: 20,
          i: "1",
          source: "",
          metadata_string: '{"refreshRate":0}',
          w: 28,
          x: 0,
          y: 0,
        },
      ],
    },
    {
      id: 2,
      name: "Tab 2",
      gridItems: [
        {
          id: 2,
          args_string: "{}",
          h: 20,
          i: "1",
          source: "",
          metadata_string: '{"refreshRate":0}',
          w: 28,
          x: 0,
          y: 0,
        },
      ],
    },
  ];

  render(
    createLoadedComponent({
      children: (
        <>
          <DashboardTabs />
          <TabsPComponent />
        </>
      ),
      options: {
        dashboards: { dashboards: [expectedDashboard] },
        inEditing: true,
      },
    }),
  );

  const tabName = expectedDashboard.tabs[1].name;
  const tabButtons = await screen.findAllByRole("tab");
  const tab2Button = tabButtons.find((btn) =>
    btn.textContent.includes("Tab 2"),
  );
  expect(tab2Button).toBeInTheDocument();
  expect(tab2Button).toHaveTextContent(tabName);
  await userEvent.click(tab2Button);
  // After selecting Tab 2, its tabpanel should be visible
  expect(screen.getByText(tabName)).toBeInTheDocument();
});

test("Dashboard Tabs, rename tab", async () => {
  const expectedDashboard = JSON.parse(JSON.stringify(userDashboard));
  expectedDashboard.tabs = [
    {
      id: 1,
      name: "Tab 1",
      gridItems: [
        {
          id: 1,
          args_string: "{}",
          h: 20,
          i: "1",
          source: "",
          metadata_string: '{"refreshRate":0}',
          w: 28,
          x: 0,
          y: 0,
        },
      ],
    },
    {
      id: 2,
      name: "Tab 2",
      gridItems: [
        {
          id: 2,
          args_string: "{}",
          h: 20,
          i: "1",
          source: "",
          metadata_string: '{"refreshRate":0}',
          w: 28,
          x: 0,
          y: 0,
        },
      ],
    },
  ];

  render(
    createLoadedComponent({
      children: (
        <>
          <DashboardTabs />
          <TabsPComponent />
        </>
      ),
      options: {
        dashboards: { dashboards: [expectedDashboard] },
        inEditing: true,
      },
    }),
  );

  const tabID = expectedDashboard.tabs[0].id;
  const tabName = expectedDashboard.tabs[0].name;
  let tabTitle = await screen.findByLabelText(`tab-title-${tabID}`);
  expect(tabTitle).toHaveTextContent(tabName);
  await userEvent.click(tabTitle);

  const input = await screen.findByLabelText(`name-input-${tabID}`);
  fireEvent.change(input, { target: { value: "Renamed Tab" } });
  fireEvent.blur(input);

  tabTitle = await screen.findByLabelText(`tab-title-${tabID}`);
  await waitFor(() => {
    expect(tabTitle).toHaveTextContent("Renamed Tab");
  });
});

test("Dashboard Tabs, add tab", async () => {
  render(
    createLoadedComponent({
      children: (
        <>
          <DashboardTabs />
          <TabsPComponent />
        </>
      ),
      options: {
        inEditing: true,
      },
    }),
  );

  let addTabTab = await screen.findByRole("tab", {
    name: "+",
  });
  expect(screen.queryByText("Tab 2")).not.toBeInTheDocument();
  expect(addTabTab).toBeInTheDocument();
  await userEvent.click(addTabTab);

  await waitFor(() => {
    expect(screen.getAllByRole("tabpanel")).toHaveLength(3);
  });
  expect(screen.getByText("Tab 1")).toBeInTheDocument();
  expect(screen.getByText("Tab 2")).toBeInTheDocument();
  expect(screen.getByText("+")).toBeInTheDocument();

  const tabButtons = await screen.findAllByRole("tab");
  const tab1Button = tabButtons.find((btn) =>
    btn.textContent.includes("Tab 1"),
  );
  const tab2Button = tabButtons.find((btn) =>
    btn.textContent.includes("Tab 2"),
  );
  expect(tab2Button).toBeInTheDocument();
  expect(tab2Button).toHaveTextContent("Tab 2");

  expect(tab1Button).toHaveAttribute("aria-selected", "false");
  expect(tab2Button).toHaveAttribute("aria-selected", "true");
  await userEvent.click(tab1Button);

  expect(tab2Button).toHaveAttribute("aria-selected", "false");
  expect(tab1Button).toHaveAttribute("aria-selected", "true");
  await userEvent.click(tab2Button);

  expect(tab1Button).toHaveAttribute("aria-selected", "false");
  expect(tab2Button).toHaveAttribute("aria-selected", "true");
});

test("handleTabNameKeyDown: Enter renames tab and exits edit mode", async () => {
  const expectedDashboard = JSON.parse(JSON.stringify(userDashboard));
  expectedDashboard.tabs = [{ id: 1, name: "Tab 1", gridItems: [] }];
  render(
    createLoadedComponent({
      children: (
        <>
          <DashboardTabs />
          <TabsPComponent />
        </>
      ),
      options: {
        dashboards: { dashboards: [expectedDashboard] },
        inEditing: true,
      },
    }),
  );
  // Enter edit mode
  const tabTitle = await screen.findByLabelText("tab-title-1");
  await userEvent.click(tabTitle);
  const input = await screen.findByLabelText("name-input-1");
  fireEvent.change(input, { target: { value: "Renamed Tab" } });
  fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
  // Should exit edit mode and update tab name
  await waitFor(() => {
    expect(screen.getByLabelText("tab-title-1")).toHaveTextContent(
      "Renamed Tab",
    );
  });
});

test("handleTabNameKeyDown: other key does not exit edit mode or change tab name", async () => {
  const expectedDashboard = JSON.parse(JSON.stringify(userDashboard));
  expectedDashboard.tabs = [{ id: 1, name: "Tab 1", gridItems: [] }];
  render(
    createLoadedComponent({
      children: (
        <>
          <DashboardTabs />
          <TabsPComponent />
        </>
      ),
      options: {
        dashboards: { dashboards: [expectedDashboard] },
        inEditing: true,
      },
    }),
  );
  // Enter edit mode
  const tabTitle = await screen.findByLabelText("tab-title-1");
  await userEvent.click(tabTitle);
  const input = await screen.findByLabelText("name-input-1");
  fireEvent.change(input, { target: { value: "Should Not Save" } });
  fireEvent.keyDown(input, { key: "a", code: "KeyA" });
  // Should still be in edit mode and not update tab name
  expect(screen.getByLabelText("name-input-1")).toBeInTheDocument();
  // Blur to exit edit mode
  fireEvent.blur(input);
  await waitFor(() => {
    expect(screen.getByLabelText("tab-title-1")).toHaveTextContent(
      "Should Not Save",
    );
  });
});

test("handleTabNameKeyDown: Escape cancels edit mode", async () => {
  const expectedDashboard = JSON.parse(JSON.stringify(userDashboard));
  expectedDashboard.tabs = [{ id: 1, name: "Tab 1", gridItems: [] }];
  render(
    createLoadedComponent({
      children: (
        <>
          <DashboardTabs />
          <TabsPComponent />
        </>
      ),
      options: {
        dashboards: { dashboards: [expectedDashboard] },
        inEditing: true,
      },
    }),
  );
  // Enter edit mode
  const tabTitle = await screen.findByLabelText("tab-title-1");
  await userEvent.click(tabTitle);
  const input = await screen.findByLabelText("name-input-1");
  fireEvent.change(input, { target: { value: "Should Not Save" } });
  fireEvent.keyDown(input, { key: "Escape", code: "Escape" });
  // Should exit edit mode and keep original name
  await waitFor(() => {
    expect(screen.getByLabelText("tab-title-1")).toHaveTextContent("Tab 1");
  });
});

test("deletes tab when confirmed", async () => {
  mockedConfirm.mockResolvedValueOnce(true);
  const expectedDashboard = JSON.parse(JSON.stringify(userDashboard));
  expectedDashboard.tabs = [
    { id: 1, name: "Tab 1", gridItems: [] },
    { id: 2, name: "Tab 2", gridItems: [] },
  ];
  render(
    createLoadedComponent({
      children: (
        <>
          <DashboardTabs />
          <TabsPComponent />
        </>
      ),
      options: {
        dashboards: { dashboards: [expectedDashboard] },
        inEditing: true,
      },
    }),
  );
  // Find delete button for Tab 2
  const tabTitles = await screen.findAllByLabelText(/tab-title-/);
  const tab2Title = tabTitles.find((t) => t.textContent === "Tab 2");
  expect(tab2Title).toBeInTheDocument();
  // eslint-disable-next-line
  const tab2DeleteBtn = tab2Title.parentElement.querySelector("button");
  expect(tab2DeleteBtn).toBeInTheDocument();
  await userEvent.click(tab2DeleteBtn);
  await waitFor(() => {
    expect(screen.queryByText("Tab 2")).not.toBeInTheDocument();
  });
  expect(screen.getByText("Tab 1")).toBeInTheDocument();
});

test("does not delete tab when cancelled", async () => {
  mockedConfirm.mockResolvedValueOnce(false);
  const expectedDashboard = JSON.parse(JSON.stringify(userDashboard));
  expectedDashboard.tabs = [
    { id: 1, name: "Tab 1", gridItems: [] },
    { id: 2, name: "Tab 2", gridItems: [] },
  ];
  render(
    createLoadedComponent({
      children: (
        <>
          <DashboardTabs />
          <TabsPComponent />
        </>
      ),
      options: {
        dashboards: { dashboards: [expectedDashboard] },
        inEditing: true,
      },
    }),
  );
  // Find delete button for Tab 2
  const tabTitles = await screen.findAllByLabelText(/tab-title-/);
  const tab2Title = tabTitles.find((t) => t.textContent === "Tab 2");
  expect(tab2Title).toBeInTheDocument();
  // eslint-disable-next-line
  const tab2DeleteBtn = tab2Title.parentElement.querySelector("button");
  expect(tab2DeleteBtn).toBeInTheDocument();
  await userEvent.click(tab2DeleteBtn);
  await waitFor(() => {
    expect(screen.getByText("Tab 2")).toBeInTheDocument();
  });
  expect(screen.getByText("Tab 1")).toBeInTheDocument();
});

test("deletes correct tab when multiple exist", async () => {
  mockedConfirm.mockResolvedValueOnce(true);
  const expectedDashboard = JSON.parse(JSON.stringify(userDashboard));
  expectedDashboard.tabs = [
    { id: 1, name: "Tab 1", gridItems: [] },
    { id: 2, name: "Tab 2", gridItems: [] },
    { id: 3, name: "Tab 3", gridItems: [] },
  ];
  render(
    createLoadedComponent({
      children: (
        <>
          <DashboardTabs />
          <TabsPComponent />
        </>
      ),
      options: {
        dashboards: { dashboards: [expectedDashboard] },
        inEditing: true,
      },
    }),
  );
  // Find delete button for Tab 3
  const tabTitles = await screen.findAllByLabelText(/tab-title-/);
  const tab3Title = tabTitles.find((t) => t.textContent === "Tab 3");
  expect(tab3Title).toBeInTheDocument();
  // eslint-disable-next-line
  const tab3DeleteBtn = tab3Title.parentElement.querySelector("button");
  expect(tab3DeleteBtn).toBeInTheDocument();
  await userEvent.click(tab3DeleteBtn);
  await waitFor(() => {
    expect(screen.queryByText("Tab 3")).not.toBeInTheDocument();
  });
  expect(screen.getByText("Tab 1")).toBeInTheDocument();
  expect(screen.getByText("Tab 2")).toBeInTheDocument();
});

test("Dashboard Tabs, drag and change tab order", async () => {
  const expectedDashboard = JSON.parse(JSON.stringify(userDashboard));
  expectedDashboard.tabs = [
    { id: 1, name: "Tab 1", gridItems: [] },
    { id: 2, name: "Tab 2", gridItems: [] },
    { id: 3, name: "Tab 3", gridItems: [] },
  ];
  render(
    createLoadedComponent({
      children: (
        <>
          <DashboardTabs />
          <TabsPComponent />
        </>
      ),
      options: {
        dashboards: { dashboards: [expectedDashboard] },
        inEditing: true,
      },
    }),
  );
  // Find tab titles
  const tabTitles = await screen.findAllByLabelText(/tab-title-/);
  const tab1Title = tabTitles.find((t) => t.textContent === "Tab 1");
  const tab3Title = tabTitles.find((t) => t.textContent === "Tab 3");
  expect(tab1Title).toBeInTheDocument();
  expect(tab3Title).toBeInTheDocument();
  // Simulate dragging Tab 1 onto Tab 3
  const dataTransfer = {
    effectAllowed: "move",
    dropEffect: "move",
    setData: jest.fn(),
    getData: jest.fn(),
  };

  fireEvent.dragStart(tab1Title, { dataTransfer });
  fireEvent.dragOver(tab3Title, { dataTransfer });
  fireEvent.drop(tab3Title, { dataTransfer });
  fireEvent.dragEnd(tab1Title, { dataTransfer });

  // After drag, Tab 1 should be after Tab 3
  const newTabTitles = screen.getAllByLabelText(/tab-title-/);
  const tabNames = newTabTitles.map((t) => t.textContent);
  expect(tabNames).toEqual(["Tab 2", "Tab 3", "Tab 1"]);
});

test("Dashboard Tabs, handleDragLeave clears drop target", async () => {
  const expectedDashboard = JSON.parse(JSON.stringify(userDashboard));
  expectedDashboard.tabs = [
    { id: 1, name: "Tab 1", gridItems: [] },
    { id: 2, name: "Tab 2", gridItems: [] },
  ];
  render(
    createLoadedComponent({
      children: (
        <>
          <DashboardTabs />
          <TabsPComponent />
        </>
      ),
      options: {
        dashboards: { dashboards: [expectedDashboard] },
        inEditing: true,
      },
    }),
  );
  // Find tab titles
  const tabTitles = await screen.findAllByLabelText(/tab-title-/);
  const tab1Title = tabTitles.find((t) => t.textContent === "Tab 1");
  const tab2Title = tabTitles.find((t) => t.textContent === "Tab 2");
  expect(tab1Title).toBeInTheDocument();
  expect(tab2Title).toBeInTheDocument();
  // Simulate drag over Tab 2
  const dataTransfer = {
    effectAllowed: "move",
    dropEffect: "move",
    setData: jest.fn(),
    getData: jest.fn(),
  };
  fireEvent.dragStart(tab1Title, { dataTransfer });
  fireEvent.dragOver(tab2Title, { dataTransfer });
  // Tab 2 should now be a drop target (has backgroundColor)
  const editableTabTitles = screen
    .getAllByText("Tab 2")
    // eslint-disable-next-line
    .map((node) => node.closest("div"));
  const dropTargetDiv = editableTabTitles.find((div) => div);
  expect(dropTargetDiv).toBeTruthy();
  // Use getComputedStyle to check backgroundColor
  const bgColor = window.getComputedStyle(dropTargetDiv).backgroundColor;
  expect(bgColor).toMatch(/rgba\(0, 123, 255/);
  // Simulate drag leave
  fireEvent.dragLeave(tab2Title);
  // Drop target style should be cleared
  const updatedBgColor = window.getComputedStyle(dropTargetDiv).backgroundColor;
  expect(updatedBgColor).not.toMatch(/rgba\(0, 123, 255/);
});

test("Dashboard Tabs, handleDragLeave does NOT clear drop target when contains returns true", async () => {
  const expectedDashboard = JSON.parse(JSON.stringify(userDashboard));
  expectedDashboard.tabs = [
    { id: 1, name: "Tab 1", gridItems: [] },
    { id: 2, name: "Tab 2", gridItems: [] },
  ];
  render(
    createLoadedComponent({
      children: (
        <>
          <DashboardTabs />
          <TabsPComponent />
        </>
      ),
      options: {
        dashboards: { dashboards: [expectedDashboard] },
        inEditing: true,
      },
    }),
  );
  // Find tab titles
  const tabTitles = await screen.findAllByLabelText(/tab-title-/);
  const tab1Title = tabTitles.find((t) => t.textContent === "Tab 1");
  const tab2Title = tabTitles.find((t) => t.textContent === "Tab 2");
  expect(tab1Title).toBeInTheDocument();
  expect(tab2Title).toBeInTheDocument();
  // Simulate drag over Tab 2
  const dataTransfer = {
    effectAllowed: "move",
    dropEffect: "move",
    setData: jest.fn(),
    getData: jest.fn(),
  };
  fireEvent.dragStart(tab1Title, { dataTransfer });
  fireEvent.dragOver(tab2Title, { dataTransfer });
  // Tab 2 should now be a drop target (has backgroundColor)
  const editableTabTitles = screen
    .getAllByText("Tab 2")
    // eslint-disable-next-line
    .map((node) => node.closest("div"));
  const dropTargetDiv = editableTabTitles.find((div) => div);
  expect(dropTargetDiv).toBeTruthy();
  // Use getComputedStyle to check backgroundColor
  const bgColor = window.getComputedStyle(dropTargetDiv).backgroundColor;
  expect(bgColor).toMatch(/rgba\(0, 123, 255/);
  // Simulate drag leave with contains returning true
  // We need to mock e.currentTarget.contains(e.relatedTarget) to return true
  const dragLeaveEvent = new Event("dragleave", { bubbles: true });
  Object.defineProperty(dragLeaveEvent, "currentTarget", {
    value: dropTargetDiv,
  });
  Object.defineProperty(dragLeaveEvent, "relatedTarget", {
    value: dropTargetDiv, // contained
  });
  // Spy on contains to return true
  dropTargetDiv.contains = jest.fn(() => true);
  dropTargetDiv.dispatchEvent(dragLeaveEvent);
  // Drop target style should remain unchanged
  const updatedBgColor = window.getComputedStyle(dropTargetDiv).backgroundColor;
  expect(updatedBgColor).toMatch(/rgba\(0, 123, 255/);
});

test("handleDragOver does not set drop target when draggedTabId equals tabId", async () => {
  const expectedDashboard = JSON.parse(JSON.stringify(userDashboard));
  expectedDashboard.tabs = [
    { id: 1, name: "Tab 1", gridItems: [] },
    { id: 2, name: "Tab 2", gridItems: [] },
  ];
  render(
    createLoadedComponent({
      children: (
        <>
          <DashboardTabs />
          <TabsPComponent />
        </>
      ),
      options: {
        dashboards: { dashboards: [expectedDashboard] },
        inEditing: true,
      },
    }),
  );
  // Find tab title for Tab 1
  const tabTitles = await screen.findAllByLabelText(/tab-title-/);
  const tab1Title = tabTitles.find((t) => t.textContent === "Tab 1");
  expect(tab1Title).toBeInTheDocument();
  // Simulate drag over Tab 1 (draggedTabId === tabId)
  const dataTransfer = {
    effectAllowed: "move",
    dropEffect: "move",
    setData: jest.fn(),
    getData: jest.fn(),
  };
  fireEvent.dragStart(tab1Title, { dataTransfer });
  fireEvent.dragOver(tab1Title, { dataTransfer });
  // Tab 1 should NOT be a drop target (backgroundColor remains unchanged)
  const editableTabTitles = screen
    .getAllByText("Tab 1")
    // eslint-disable-next-line
    .map((node) => node.closest("div"));
  const tab1Div = editableTabTitles.find((div) => div);
  expect(tab1Div).toBeTruthy();
  const bgColor = window.getComputedStyle(tab1Div).backgroundColor;
  expect(bgColor).not.toMatch(/rgba\(0, 123, 255/);
});

test("TabTitleInput onClick and onDragStart stop propagation and preserve edit mode", async () => {
  const expectedDashboard = JSON.parse(JSON.stringify(userDashboard));
  expectedDashboard.tabs = [{ id: 1, name: "Tab 1", gridItems: [] }];
  render(
    createLoadedComponent({
      children: (
        <>
          <DashboardTabs />
          <TabsPComponent />
        </>
      ),
      options: {
        dashboards: { dashboards: [expectedDashboard] },
        inEditing: true,
      },
    }),
  );
  // Enter edit mode
  const tabTitle = await screen.findByLabelText("tab-title-1");
  await userEvent.click(tabTitle);
  const input = await screen.findByLabelText("name-input-1");
  // Spy on stopPropagation
  const clickEvent = new MouseEvent("click", { bubbles: true });
  clickEvent.stopPropagation = jest.fn();
  input.dispatchEvent(clickEvent);
  expect(clickEvent.stopPropagation).toHaveBeenCalled();
  // DragStart
  const dragEvent = new Event("dragstart", { bubbles: true });
  dragEvent.stopPropagation = jest.fn();
  input.dispatchEvent(dragEvent);
  expect(dragEvent.stopPropagation).toHaveBeenCalled();
  // Should still be in edit mode
  expect(screen.getByLabelText("name-input-1")).toBeInTheDocument();
});

test("handleTabNameClick does not enter edit mode when tabId is not activeTabId", async () => {
  const expectedDashboard = JSON.parse(JSON.stringify(userDashboard));
  expectedDashboard.tabs = [
    { id: 1, name: "Tab 1", gridItems: [] },
    { id: 2, name: "Tab 2", gridItems: [] },
  ];
  render(
    createLoadedComponent({
      children: (
        <>
          <DashboardTabs />
          <TabsPComponent />
        </>
      ),
      options: {
        dashboards: { dashboards: [expectedDashboard] },
        inEditing: true,
      },
    }),
  );
  // Tab 1 is active by default, click Tab 2 title
  const tab2Title = await screen.findByLabelText("tab-title-2");
  await userEvent.click(tab2Title);
  // Should NOT show the input for editing Tab 2
  expect(screen.queryByLabelText("name-input-2")).toBeNull();
});

test("handleTabNameChange does not call updateTab when newName is only spaces", async () => {
  const expectedDashboard = JSON.parse(JSON.stringify(userDashboard));
  expectedDashboard.tabs = [{ id: 1, name: "Tab 1", gridItems: [] }];

  render(
    createLoadedComponent({
      children: (
        <>
          <DashboardTabs />
          <TabsPComponent />
        </>
      ),
      options: {
        dashboards: { dashboards: [expectedDashboard] },
        inEditing: true,
      },
    }),
  );
  // Enter edit mode
  const tabTitle = await screen.findByLabelText("tab-title-1");
  await userEvent.click(tabTitle);
  const input = await screen.findByLabelText("name-input-1");
  fireEvent.change(input, { target: { value: "   " } });
  fireEvent.blur(input);
  // Tab name should remain unchanged
  const tabTitleAfter = await screen.findByLabelText("tab-title-1");
  expect(tabTitleAfter).toHaveTextContent("Tab 1");
});

test("Dashboard Tabs, handleDrop does nothing when draggedTabId equals targetTabId", async () => {
  const expectedDashboard = JSON.parse(JSON.stringify(userDashboard));
  expectedDashboard.tabs = [
    { id: 1, name: "Tab 1", gridItems: [] },
    { id: 2, name: "Tab 2", gridItems: [] },
  ];

  render(
    createLoadedComponent({
      children: (
        <>
          <DashboardTabs />
          <TabsPComponent />
        </>
      ),
      options: {
        dashboards: { dashboards: [expectedDashboard] },
        inEditing: true,
      },
    }),
  );
  // Find tab title for Tab 1
  const tabTitles = await screen.findAllByLabelText(/tab-title-/);
  const tab1Title = tabTitles.find((t) => t.textContent === "Tab 1");
  expect(tab1Title).toBeInTheDocument();
  // Simulate drag start and drop on itself
  const dataTransfer = {
    effectAllowed: "move",
    dropEffect: "move",
    setData: jest.fn(),
    getData: jest.fn(),
  };
  fireEvent.dragStart(tab1Title, { dataTransfer });
  fireEvent.drop(tab1Title, { dataTransfer });

  // Drag state should be cleared (draggedTabId and dragOverTabId null)
  // This is indirectly tested by the absence of drop target style
  const editableTabTitles = screen
    .getAllByText("Tab 1")
    // eslint-disable-next-line
    .map((node) => node.closest("div"));
  const tab1Div = editableTabTitles.find((div) => div);
  expect(tab1Div).toBeTruthy();
  const bgColor = window.getComputedStyle(tab1Div).backgroundColor;
  expect(bgColor).not.toMatch(/rgba\(0, 123, 255/);
});

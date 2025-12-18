import DashboardLoader from "components/loader/DashboardLoader";
import { screen, render } from "@testing-library/react";
import { useContext } from "react";
import { AvailableDashboardsContext } from "components/contexts/Contexts";
import {
  userDashboard,
  mockedTextVariable,
  mockedCheckboxVariable,
} from "__tests__/utilities/constants";
import { server } from "__tests__/utilities/server";
import { rest } from "msw";
import userEvent from "@testing-library/user-event";
import {
  ContextLayoutPComponent,
  DataViewerPComponent,
  DisabledMovementPComponent,
  InputVariablePComponent,
  EditingPComponent,
  TabsPComponent,
} from "__tests__/utilities/customRender";
import {
  LayoutContext,
  EditingContext,
  DisabledEditingMovementContext,
  TabContext,
} from "components/contexts/Contexts";
import PropTypes from "prop-types";

const TestingComponent = ({
  TabID,
  updatedTabProperties,
  updatedDashboardProperties,
}) => {
  const { isEditing, setIsEditing } = useContext(EditingContext);
  const { disabledEditingMovement, setDisabledEditingMovement } = useContext(
    DisabledEditingMovementContext
  );
  const { resetGridItems, saveLayoutContext } = useContext(LayoutContext);
  const { updateTab } = useContext(TabContext);

  return (
    <>
      <button
        data-testid="editButton"
        onClick={() => setIsEditing(!isEditing)}
      ></button>
      <EditingPComponent />
      <InputVariablePComponent />
      <button
        data-testid="updatedTabButton"
        onClick={() => updateTab(TabID, updatedTabProperties)}
      ></button>
      <button
        data-testid="resetGridItemsButton"
        onClick={resetGridItems}
      ></button>
      <button
        data-testid="saveLayoutContextButton"
        onClick={() => saveLayoutContext(updatedDashboardProperties)}
      ></button>
      <ContextLayoutPComponent />
      <TabsPComponent />
      <button
        data-testid="movementButton"
        onClick={() => setDisabledEditingMovement(!disabledEditingMovement)}
      ></button>
      <DisabledMovementPComponent />
      <DataViewerPComponent />
    </>
  );
};

test("DashboardLoader", async () => {
  const mockUpdateDashboard = jest.fn();
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/dashboards/get/",
      (req, res, ctx) => {
        return res(
          ctx.delay(500),
          ctx.status(200),
          ctx.json({ success: true, dashboard: userDashboard }),
          ctx.set("Content-Type", "application/json")
        );
      }
    )
  );

  render(
    <AvailableDashboardsContext.Provider
      value={{ updateDashboard: mockUpdateDashboard }}
    >
      <DashboardLoader>Hello World!</DashboardLoader>
    </AvailableDashboardsContext.Provider>
  );

  expect(await screen.findByText("Loading Dashboard...")).toBeInTheDocument();
  expect(await screen.findByText("Hello World!")).toBeInTheDocument();
});

test("DashboardLoader 500 error", async () => {
  const mockUpdateDashboard = jest.fn();
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/dashboards/get/",
      (req, res, ctx) => {
        return res(
          ctx.delay(500),
          ctx.status(500),
          ctx.json({ error: "Internal Server Error" }),
          ctx.set("Content-Type", "application/json")
        );
      }
    )
  );

  render(
    <AvailableDashboardsContext.Provider
      value={{ updateDashboard: mockUpdateDashboard }}
    >
      <DashboardLoader>Hello World!</DashboardLoader>
    </AvailableDashboardsContext.Provider>
  );

  expect(await screen.findByText("Loading Dashboard...")).toBeInTheDocument();
  expect(
    await screen.findByText(
      "The dashboard failed to load. Please try again or contact admins."
    )
  ).toBeInTheDocument();
});

test("DashboardLoader API error", async () => {
  const mockUpdateDashboard = jest.fn();
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/dashboards/get/",
      (req, res, ctx) => {
        return res(
          ctx.delay(500),
          ctx.status(200),
          ctx.json({ success: false }),
          ctx.set("Content-Type", "application/json")
        );
      }
    )
  );

  render(
    <AvailableDashboardsContext.Provider
      value={{ updateDashboard: mockUpdateDashboard }}
    >
      <DashboardLoader>Hello World!</DashboardLoader>
    </AvailableDashboardsContext.Provider>
  );

  expect(await screen.findByText("Loading Dashboard...")).toBeInTheDocument();
  expect(
    await screen.findByText(
      "The dashboard failed to load. Please try again or contact admins."
    )
  ).toBeInTheDocument();
});

test("DashboardLoader edit and disable movement when not editing", async () => {
  const mockUpdateDashboard = jest.fn();

  render(
    <AvailableDashboardsContext.Provider
      value={{ updateDashboard: mockUpdateDashboard }}
    >
      <DashboardLoader>
        <TestingComponent />
      </DashboardLoader>
    </AvailableDashboardsContext.Provider>
  );

  expect(await screen.findByTestId("editing")).toHaveTextContent("not editing");
  expect(screen.getByTestId("disabledMovement")).toHaveTextContent(
    "allowed movement"
  );

  const editButton = screen.getByTestId("editButton");
  await userEvent.click(editButton);

  expect(await screen.findByTestId("editing")).toHaveTextContent("editing");
  expect(screen.getByTestId("disabledMovement")).toHaveTextContent(
    "allowed movement"
  );

  const movementButton = screen.getByTestId("movementButton");
  await userEvent.click(movementButton);

  expect(await screen.findByTestId("editing")).toHaveTextContent("editing");
  expect(await screen.findByTestId("disabledMovement")).toHaveTextContent(
    "disabled movement"
  );

  await userEvent.click(editButton);

  expect(await screen.findByTestId("editing")).toHaveTextContent("editing");
  expect(await screen.findByTestId("disabledMovement")).toHaveTextContent(
    "allowed movement"
  );
});

test("DashboardLoader updateGridItems and then reset", async () => {
  const mockUpdateDashboard = jest.fn();
  const updatedDashboard = JSON.parse(JSON.stringify(userDashboard));
  updatedDashboard.tabs[0].gridItems = [];

  render(
    <AvailableDashboardsContext.Provider
      value={{ updateDashboard: mockUpdateDashboard }}
    >
      <DashboardLoader {...userDashboard}>
        <TestingComponent TabID={1} updatedTabProperties={{ gridItems: [] }} />
      </DashboardLoader>
    </AvailableDashboardsContext.Provider>
  );

  let { tabs, ...dashboardContextProperties } = userDashboard;
  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({ ...dashboardContextProperties, editable: true })
  );
  expect(await screen.findByTestId("tabs-context")).toHaveTextContent(
    JSON.stringify({ tabs: [...tabs], activeTabId: tabs[0].id })
  );

  const updatedTabButton = await screen.findByTestId("updatedTabButton");
  await userEvent.click(updatedTabButton);

  ({ tabs, ...dashboardContextProperties } = updatedDashboard);
  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({ ...dashboardContextProperties, editable: true })
  );
  expect(await screen.findByTestId("tabs-context")).toHaveTextContent(
    JSON.stringify({ tabs: [...tabs], activeTabId: tabs[0].id })
  );

  const resetGridItemsButton = await screen.findByTestId(
    "resetGridItemsButton"
  );
  await userEvent.click(resetGridItemsButton);

  ({ tabs, ...dashboardContextProperties } = updatedDashboard);
  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({ ...dashboardContextProperties, editable: true })
  );
  expect(await screen.findByTestId("tabs-context")).toHaveTextContent(
    JSON.stringify({ tabs: [...tabs], activeTabId: tabs[0].id })
  );
});

test("DashboardLoader updateGridItems existing variable input", async () => {
  const mockUpdateDashboard = jest.fn();
  const updatedDashboard = JSON.parse(JSON.stringify(userDashboard));
  const mockedDashboard = JSON.parse(JSON.stringify(userDashboard));
  mockedDashboard.tabs[0].gridItems = [mockedTextVariable];

  const updatedTextVariable = JSON.parse(
    JSON.stringify(mockedCheckboxVariable)
  );
  updatedTextVariable.args_string = JSON.stringify({
    initial_value: "New initial value",
    variable_name: "Test Variable",
    variable_options_source: "text",
  });
  updatedDashboard.tabs[0].gridItems = [updatedTextVariable];

  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/dashboards/get/",
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({ success: true, dashboard: mockedDashboard }),
          ctx.set("Content-Type", "application/json")
        );
      }
    )
  );

  render(
    <AvailableDashboardsContext.Provider
      value={{ updateDashboard: mockUpdateDashboard }}
    >
      <DashboardLoader {...mockedDashboard}>
        <TestingComponent
          TabID={1}
          updatedTabProperties={{ gridItems: [updatedTextVariable] }}
        />
      </DashboardLoader>
    </AvailableDashboardsContext.Provider>
  );

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({
      "Test Variable": "",
    })
  );

  let { tabs, ...dashboardContextProperties } = mockedDashboard;
  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({ ...dashboardContextProperties, editable: true })
  );
  expect(await screen.findByTestId("tabs-context")).toHaveTextContent(
    JSON.stringify({ tabs: [...tabs], activeTabId: tabs[0].id })
  );

  const updatedTabButton = await screen.findByTestId("updatedTabButton");
  await userEvent.click(updatedTabButton);

  ({ tabs, ...dashboardContextProperties } = updatedDashboard);
  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({ ...dashboardContextProperties, editable: true })
  );
  expect(await screen.findByTestId("tabs-context")).toHaveTextContent(
    JSON.stringify({ tabs: [...tabs], activeTabId: tabs[0].id })
  );

  // Doesn't change input variables so that the existing variable input keeps the same value from before and not rerender everything in the page
  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({
      "Test Variable": "",
    })
  );
});

test("DashboardLoader updateGridItems add variable input", async () => {
  const mockUpdateDashboard = jest.fn();
  const updatedDashboard = JSON.parse(JSON.stringify(userDashboard));
  updatedDashboard.tabs[0].gridItems = [mockedTextVariable];

  render(
    <AvailableDashboardsContext.Provider
      value={{ updateDashboard: mockUpdateDashboard }}
    >
      <DashboardLoader {...userDashboard}>
        <TestingComponent
          TabID={1}
          updatedTabProperties={{ gridItems: [mockedTextVariable] }}
        />
      </DashboardLoader>
    </AvailableDashboardsContext.Provider>
  );

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({})
  );

  let { tabs, ...dashboardContextProperties } = userDashboard;
  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({ ...dashboardContextProperties, editable: true })
  );
  expect(await screen.findByTestId("tabs-context")).toHaveTextContent(
    JSON.stringify({ tabs: [...tabs], activeTabId: tabs[0].id })
  );

  const updatedTabButton = await screen.findByTestId("updatedTabButton");
  await userEvent.click(updatedTabButton);

  ({ tabs, ...dashboardContextProperties } = updatedDashboard);
  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({ ...dashboardContextProperties, editable: true })
  );
  expect(await screen.findByTestId("tabs-context")).toHaveTextContent(
    JSON.stringify({ tabs: [...tabs], activeTabId: tabs[0].id })
  );

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({
      "Test Variable": "",
    })
  );
});

test("DashboardLoader updateGridItems add checkbox variable input", async () => {
  const mockUpdateDashboard = jest.fn();
  const updatedDashboard = JSON.parse(JSON.stringify(userDashboard));

  const updatedTextVariable = JSON.parse(
    JSON.stringify(mockedCheckboxVariable)
  );
  updatedTextVariable.args_string = JSON.stringify({
    initial_value: null,
    variable_name: "Test Variable",
    variable_options_source: "checkbox",
  });
  updatedDashboard.tabs[0].gridItems = [updatedTextVariable];

  render(
    <AvailableDashboardsContext.Provider
      value={{ updateDashboard: mockUpdateDashboard }}
    >
      <DashboardLoader {...userDashboard}>
        <TestingComponent
          TabID={1}
          updatedTabProperties={{ gridItems: [updatedTextVariable] }}
        />
      </DashboardLoader>
    </AvailableDashboardsContext.Provider>
  );

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({})
  );

  let { tabs, ...dashboardContextProperties } = userDashboard;
  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({ ...dashboardContextProperties, editable: true })
  );
  expect(await screen.findByTestId("tabs-context")).toHaveTextContent(
    JSON.stringify({ tabs: [...tabs], activeTabId: tabs[0].id })
  );

  const updatedTabButton = await screen.findByTestId("updatedTabButton");
  await userEvent.click(updatedTabButton);

  ({ tabs, ...dashboardContextProperties } = updatedDashboard);
  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({ ...dashboardContextProperties, editable: true })
  );
  expect(await screen.findByTestId("tabs-context")).toHaveTextContent(
    JSON.stringify({ tabs: [...tabs], activeTabId: tabs[0].id })
  );

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({
      "Test Variable": false,
    })
  );
});

test("DashboardLoader save layout", async () => {
  const mockUpdateDashboard = jest.fn();

  mockUpdateDashboard.mockResolvedValue({
    success: true,
    updated_dashboard: {
      id: 1,
      name: "some dashboard updated",
      description: "some description",
      publicDashboard: true,
      image: "some_image.png",
    },
  });

  render(
    <AvailableDashboardsContext.Provider
      value={{ updateDashboard: mockUpdateDashboard }}
    >
      <DashboardLoader>
        <DashboardLoader {...userDashboard}>
          <TestingComponent
            updatedDashboardProperties={{ name: "some new name" }}
          />
        </DashboardLoader>
      </DashboardLoader>
    </AvailableDashboardsContext.Provider>
  );

  const saveLayoutContextButton = await screen.findByTestId(
    "saveLayoutContextButton"
  );
  await userEvent.click(saveLayoutContextButton);

  expect(mockUpdateDashboard).toHaveBeenCalledWith({
    id: 1,
    newProperties: { name: "some new name" },
  });
});

test("DashboardLoader save layout with griditems", async () => {
  const mockUpdateDashboard = jest.fn();
  const updatedDashboard = JSON.parse(JSON.stringify(userDashboard));
  updatedDashboard.tabs[0].gridItems = [];

  mockUpdateDashboard.mockResolvedValue({
    success: true,
    updated_dashboard: updatedDashboard,
  });

  render(
    <AvailableDashboardsContext.Provider
      value={{ updateDashboard: mockUpdateDashboard }}
    >
      <DashboardLoader>
        <DashboardLoader {...userDashboard}>
          <TestingComponent
            TabID={1}
            updatedDashboardProperties={{ tabs: [] }}
          />
        </DashboardLoader>
      </DashboardLoader>
    </AvailableDashboardsContext.Provider>
  );

  const saveLayoutContextButton = await screen.findByTestId(
    "saveLayoutContextButton"
  );
  await userEvent.click(saveLayoutContextButton);

  expect(mockUpdateDashboard).toHaveBeenCalledWith({
    id: 1,
    newProperties: { tabs: [] },
  });

  const { tabs, ...dashboardContextProperties } = updatedDashboard;
  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({ ...dashboardContextProperties, editable: true })
  );

  expect(await screen.findByTestId("tabs-context")).toHaveTextContent(
    JSON.stringify({ tabs: [...tabs], activeTabId: tabs[0].id })
  );
});

test("DashboardLoader save layout failed", async () => {
  const mockUpdateDashboard = jest.fn();

  mockUpdateDashboard.mockResolvedValue({
    success: false,
    error: "Failed to update dashboard",
  });

  render(
    <AvailableDashboardsContext.Provider
      value={{ updateDashboard: mockUpdateDashboard }}
    >
      <DashboardLoader>
        <DashboardLoader {...userDashboard}>
          <TestingComponent
            updatedDashboardProperties={{ name: "some new name" }}
          />
        </DashboardLoader>
      </DashboardLoader>
    </AvailableDashboardsContext.Provider>
  );

  const saveLayoutContextButton = await screen.findByTestId(
    "saveLayoutContextButton"
  );
  await userEvent.click(saveLayoutContextButton);

  expect(mockUpdateDashboard).toHaveBeenCalledWith({
    id: 1,
    newProperties: { name: "some new name" },
  });
});

test("DashboardLoader addTab", async () => {
  const mockUpdateDashboard = jest.fn();
  render(
    <AvailableDashboardsContext.Provider
      value={{ updateDashboard: mockUpdateDashboard }}
    >
      <DashboardLoader {...userDashboard}>
        <TabContext.Consumer>
          {({ tabs, addTab, activeTabId }) => (
            <>
              <button data-testid="addTabButton" onClick={addTab}>
                Add Tab
              </button>
              <div data-testid="tabs-length">{tabs.length}</div>
              <div data-testid="active-tab-id">{activeTabId}</div>
            </>
          )}
        </TabContext.Consumer>
      </DashboardLoader>
    </AvailableDashboardsContext.Provider>
  );

  expect(await screen.findByTestId("tabs-length")).toHaveTextContent("1");
  const addTabButton = screen.getByTestId("addTabButton");
  await userEvent.click(addTabButton);
  expect(await screen.findByTestId("tabs-length")).toHaveTextContent("2");
  expect(await screen.findByTestId("active-tab-id")).toHaveTextContent("Tab 2");
});

test("DashboardLoader updateTab name", async () => {
  const mockUpdateDashboard = jest.fn();
  render(
    <AvailableDashboardsContext.Provider
      value={{ updateDashboard: mockUpdateDashboard }}
    >
      <DashboardLoader {...userDashboard}>
        <TabContext.Consumer>
          {({ tabs, updateTab, activeTabId, getTab }) => (
            <>
              <button
                data-testid="updateTabButton"
                onClick={() => updateTab(activeTabId, { name: "Updated Tab" })}
              >
                Update Tab
              </button>
              <div data-testid="tabs-length">{tabs.length}</div>
              <div data-testid="active-tab-id">{activeTabId}</div>
              <div data-testid="active-tab-name">
                {getTab(activeTabId)?.name}
              </div>
            </>
          )}
        </TabContext.Consumer>
      </DashboardLoader>
    </AvailableDashboardsContext.Provider>
  );

  expect(await screen.findByTestId("tabs-length")).toHaveTextContent("1");
  expect(await screen.findByTestId("active-tab-id")).toHaveTextContent("1");
  expect(await screen.findByTestId("active-tab-name")).toHaveTextContent(
    "Tab 1"
  );

  const updateTabButton = screen.getByTestId("updateTabButton");
  await userEvent.click(updateTabButton);

  expect(await screen.findByTestId("tabs-length")).toHaveTextContent("1");
  expect(await screen.findByTestId("active-tab-id")).toHaveTextContent("1");
  expect(await screen.findByTestId("active-tab-name")).toHaveTextContent(
    "Updated Tab"
  );
});

test("DashboardLoader updateTab gridItems", async () => {
  const mockUpdateDashboard = jest.fn();

  const twoTabsDashboard = JSON.parse(JSON.stringify(userDashboard));
  twoTabsDashboard.tabs = [
    { ...userDashboard.tabs[0], id: 1, name: "Tab 1", order: 0 },
    { ...userDashboard.tabs[0], id: 2, name: "Tab 2", order: 1 },
  ];

  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/dashboards/get/",
      (req, res, ctx) => {
        return res(
          ctx.delay(500),
          ctx.status(200),
          ctx.json({ success: true, dashboard: twoTabsDashboard }),
          ctx.set("Content-Type", "application/json")
        );
      }
    )
  );

  render(
    <AvailableDashboardsContext.Provider
      value={{ updateDashboard: mockUpdateDashboard }}
    >
      <DashboardLoader {...twoTabsDashboard}>
        <TabContext.Consumer>
          {({ tabs, updateTab, activeTabId, getTab }) => (
            <>
              <button
                data-testid="updateTabButton"
                onClick={() => updateTab(activeTabId, { gridItems: [] })}
              >
                Update Tab
              </button>
              <div data-testid="tabs-length">{tabs.length}</div>
              <div data-testid="active-tab-grid-items">
                {JSON.stringify(getTab(activeTabId)?.gridItems)}
              </div>
            </>
          )}
        </TabContext.Consumer>
      </DashboardLoader>
    </AvailableDashboardsContext.Provider>
  );

  expect(await screen.findByTestId("active-tab-grid-items")).toHaveTextContent(
    JSON.stringify(twoTabsDashboard.tabs[0].gridItems)
  );

  const updateTabButton = screen.getByTestId("updateTabButton");
  await userEvent.click(updateTabButton);

  expect(await screen.findByTestId("active-tab-grid-items")).toHaveTextContent(
    JSON.stringify([])
  );
});

test("DashboardLoader deleteTab active", async () => {
  const mockUpdateDashboard = jest.fn();
  // Setup with two tabs
  const twoTabsDashboard = JSON.parse(JSON.stringify(userDashboard));
  twoTabsDashboard.tabs = [
    { ...userDashboard.tabs[0], id: 1, name: "Tab 1", order: 0 },
    { ...userDashboard.tabs[0], id: 2, name: "Tab 2", order: 1 },
  ];

  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/dashboards/get/",
      (req, res, ctx) => {
        return res(
          ctx.delay(500),
          ctx.status(200),
          ctx.json({ success: true, dashboard: twoTabsDashboard }),
          ctx.set("Content-Type", "application/json")
        );
      }
    )
  );

  render(
    <AvailableDashboardsContext.Provider
      value={{ updateDashboard: mockUpdateDashboard }}
    >
      <DashboardLoader {...twoTabsDashboard}>
        <TabContext.Consumer>
          {({ activeTabId, deleteTab, getActiveTab, getTab }) => (
            <>
              <button
                data-testid="deleteTabButton"
                onClick={() => deleteTab(twoTabsDashboard.tabs[0].id)}
              >
                Delete Tab
              </button>
              <div data-testid="active-tab-id">{activeTabId}</div>
              <div data-testid="active-tab-name">{getActiveTab()?.name}</div>
              <div data-testid="tab1-name">{getTab(1)?.name}</div>
              <div data-testid="tab2-name">{getTab(2)?.name}</div>
            </>
          )}
        </TabContext.Consumer>
      </DashboardLoader>
    </AvailableDashboardsContext.Provider>
  );

  expect(await screen.findByTestId("active-tab-id")).toHaveTextContent("1");
  expect(await screen.findByTestId("active-tab-name")).toHaveTextContent(
    "Tab 1"
  );
  expect(await screen.findByTestId("tab1-name")).toHaveTextContent("Tab 1");
  expect(await screen.findByTestId("tab2-name")).toHaveTextContent("Tab 2");

  const deleteTabButton = screen.getByTestId("deleteTabButton");
  await userEvent.click(deleteTabButton);
  expect(await screen.findByTestId("active-tab-id")).toHaveTextContent("2");
  expect(await screen.findByTestId("active-tab-name")).toHaveTextContent(
    "Tab 2"
  );
});

test("DashboardLoader deleteTab nonactive", async () => {
  const mockUpdateDashboard = jest.fn();
  // Setup with two tabs
  const twoTabsDashboard = JSON.parse(JSON.stringify(userDashboard));
  twoTabsDashboard.tabs = [
    { ...userDashboard.tabs[0], id: 1, name: "Tab 1", order: 0 },
    { ...userDashboard.tabs[0], id: 2, name: "Tab 2", order: 1 },
  ];

  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/dashboards/get/",
      (req, res, ctx) => {
        return res(
          ctx.delay(500),
          ctx.status(200),
          ctx.json({ success: true, dashboard: twoTabsDashboard }),
          ctx.set("Content-Type", "application/json")
        );
      }
    )
  );

  render(
    <AvailableDashboardsContext.Provider
      value={{ updateDashboard: mockUpdateDashboard }}
    >
      <DashboardLoader {...twoTabsDashboard}>
        <TabContext.Consumer>
          {({ activeTabId, deleteTab, getActiveTab, getTab }) => (
            <>
              <button
                data-testid="deleteTabButton"
                onClick={() => deleteTab(twoTabsDashboard.tabs[1].id)}
              >
                Delete Tab
              </button>
              <div data-testid="active-tab-id">{activeTabId}</div>
              <div data-testid="active-tab-name">{getActiveTab()?.name}</div>
              <div data-testid="tab1-name">{getTab(1)?.name}</div>
              <div data-testid="tab2-name">{getTab(2)?.name}</div>
            </>
          )}
        </TabContext.Consumer>
      </DashboardLoader>
    </AvailableDashboardsContext.Provider>
  );

  expect(await screen.findByTestId("active-tab-id")).toHaveTextContent("1");
  expect(await screen.findByTestId("active-tab-name")).toHaveTextContent(
    "Tab 1"
  );
  expect(await screen.findByTestId("tab1-name")).toHaveTextContent("Tab 1");
  expect(await screen.findByTestId("tab2-name")).toHaveTextContent("Tab 2");

  const deleteTabButton = screen.getByTestId("deleteTabButton");
  await userEvent.click(deleteTabButton);
  expect(await screen.findByTestId("active-tab-id")).toHaveTextContent("1");
  expect(await screen.findByTestId("active-tab-name")).toHaveTextContent(
    "Tab 1"
  );
});

test("DashboardLoader reorderTabs and resetTabs", async () => {
  const mockUpdateDashboard = jest.fn();
  // Setup with two tabs
  const twoTabsDashboard = JSON.parse(JSON.stringify(userDashboard));
  twoTabsDashboard.tabs = [
    { ...userDashboard.tabs[0], id: 1, name: "Tab 1", order: 0 },
    { ...userDashboard.tabs[0], id: 2, name: "Tab 2", order: 1 },
  ];

  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/dashboards/get/",
      (req, res, ctx) => {
        return res(
          ctx.delay(500),
          ctx.status(200),
          ctx.json({ success: true, dashboard: twoTabsDashboard }),
          ctx.set("Content-Type", "application/json")
        );
      }
    )
  );

  render(
    <AvailableDashboardsContext.Provider
      value={{ updateDashboard: mockUpdateDashboard }}
    >
      <DashboardLoader {...twoTabsDashboard}>
        <TabContext.Consumer>
          {({ tabs, reorderTabs, resetTabs }) => (
            <>
              <button
                data-testid="reorderTabsButton"
                onClick={() => reorderTabs([tabs[1], tabs[0]])}
              >
                Reorder Tabs
              </button>
              <button data-testid="resetTabsButton" onClick={resetTabs}>
                Reset Tabs
              </button>
              <div data-testid="first-tab-name">{tabs[0].name}</div>
            </>
          )}
        </TabContext.Consumer>
      </DashboardLoader>
    </AvailableDashboardsContext.Provider>
  );

  expect(await screen.findByTestId("first-tab-name")).toHaveTextContent(
    "Tab 1"
  );

  const reorderTabsButton = screen.getByTestId("reorderTabsButton");
  await userEvent.click(reorderTabsButton);
  expect(await screen.findByTestId("first-tab-name")).toHaveTextContent(
    "Tab 2"
  );

  const resetTabsButton = screen.getByTestId("resetTabsButton");
  await userEvent.click(resetTabsButton);

  expect(await screen.findByTestId("first-tab-name")).toHaveTextContent(
    "Tab 1"
  );
});

test("DashboardLoader getActiveTab and getTab", async () => {
  const mockUpdateDashboard = jest.fn();
  // Setup with two tabs
  const twoTabsDashboard = JSON.parse(JSON.stringify(userDashboard));
  twoTabsDashboard.tabs = [
    { ...userDashboard.tabs[0], id: 1, name: "Tab 1", order: 0 },
    { ...userDashboard.tabs[0], id: 2, name: "Tab 2", order: 1 },
  ];

  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/dashboards/get/",
      (req, res, ctx) => {
        return res(
          ctx.delay(500),
          ctx.status(200),
          ctx.json({ success: true, dashboard: twoTabsDashboard }),
          ctx.set("Content-Type", "application/json")
        );
      }
    )
  );

  render(
    <AvailableDashboardsContext.Provider
      value={{ updateDashboard: mockUpdateDashboard }}
    >
      <DashboardLoader {...twoTabsDashboard}>
        <TabContext.Consumer>
          {({ activeTabId, setActiveTabId, getActiveTab, getTab }) => (
            <>
              <button
                data-testid="setActiveTab2Button"
                onClick={() => setActiveTabId(2)}
              >
                Set Active Tab 2
              </button>
              <div data-testid="active-tab-id">{activeTabId}</div>
              <div data-testid="active-tab-name">{getActiveTab()?.name}</div>
              <div data-testid="tab1-name">{getTab(1)?.name}</div>
              <div data-testid="tab2-name">{getTab(2)?.name}</div>
            </>
          )}
        </TabContext.Consumer>
      </DashboardLoader>
    </AvailableDashboardsContext.Provider>
  );

  expect(await screen.findByTestId("active-tab-id")).toHaveTextContent("1");
  expect(await screen.findByTestId("active-tab-name")).toHaveTextContent(
    "Tab 1"
  );
  expect(await screen.findByTestId("tab1-name")).toHaveTextContent("Tab 1");
  expect(await screen.findByTestId("tab2-name")).toHaveTextContent("Tab 2");

  const setActiveTab2Button = screen.getByTestId("setActiveTab2Button");
  await userEvent.click(setActiveTab2Button);
  expect(await screen.findByTestId("active-tab-id")).toHaveTextContent("2");
  expect(await screen.findByTestId("active-tab-name")).toHaveTextContent(
    "Tab 2"
  );
});

TestingComponent.propTypes = {
  TabID: PropTypes.number.isRequired,
  updatedTabProperties: PropTypes.object,
  updatedDashboardProperties: PropTypes.object,
};

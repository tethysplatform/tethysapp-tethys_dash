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

  expect(await screen.findByText("Loading...")).toBeInTheDocument();
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

  expect(await screen.findByText("Loading...")).toBeInTheDocument();
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

  expect(await screen.findByText("Loading...")).toBeInTheDocument();
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

TestingComponent.propTypes = {
  TabID: PropTypes.number.isRequired,
  updatedTabProperties: PropTypes.object,
  updatedDashboardProperties: PropTypes.object,
};

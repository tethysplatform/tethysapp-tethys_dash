import DashboardLoader, {
  secretChangesToSave,
} from "components/loader/DashboardLoader";
import { handleGridItemExport } from "components/dashboard/DashboardItem";
import { screen, render, waitFor, act } from "@testing-library/react";
import appAPI from "services/api/app";
import * as variableInputPreload from "components/loader/variableInputPreload";
import { VARIABLE_INPUT_PRELOAD_BUDGET_MS } from "components/loader/variableInputPreload";
import { clearPreloadedVisualizations } from "components/visualizations/preloadedVisualizationCache";
import { useContext, useState } from "react";
import VariableInput from "components/visualizations/VariableInput";
import { AvailableDashboardsContext } from "components/contexts/Contexts";
import {
  userDashboard,
  mockedTextVariable,
  mockedCheckboxVariable,
  mockedDateRangeVariable,
  mockedMapBase,
  mockedSliderVariable,
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
  VariableInputDateFormatsPComponent,
} from "__tests__/utilities/customRender";
import {
  LayoutContext,
  EditingContext,
  DisabledEditingMovementContext,
  TabContext,
  AppContext,
  GridItemContext,
} from "components/contexts/Contexts";
import { secretPlaceKey } from "components/visualizations/utilities";
import PropTypes from "prop-types";

const TestingComponent = ({
  TabID,
  updatedTabProperties,
  updatedDashboardProperties,
}) => {
  const { isEditing, setIsEditing } = useContext(EditingContext);
  const { disabledEditingMovement, setDisabledEditingMovement } = useContext(
    DisabledEditingMovementContext,
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
      <VariableInputDateFormatsPComponent />
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
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
  );

  render(
    <AvailableDashboardsContext.Provider
      value={{ updateDashboard: mockUpdateDashboard }}
    >
      <DashboardLoader>Hello World!</DashboardLoader>
    </AvailableDashboardsContext.Provider>,
  );

  expect(await screen.findByTestId("loading-animation")).toBeInTheDocument();
  expect(await screen.findByText("Hello World!")).toBeInTheDocument();
});

test("DashboardLoader with Map", async () => {
  const mockUpdateDashboard = jest.fn();
  const dashboardWithMap = JSON.parse(JSON.stringify(userDashboard));
  const newMockedTextVariable = JSON.parse(JSON.stringify(mockedTextVariable));
  newMockedTextVariable.args_string = JSON.stringify({
    initial_value: "some value",
    variable_name: "LID",
    variable_options_source: "text",
  });
  const anotherMapGridItem = JSON.parse(JSON.stringify(mockedMapBase));
  anotherMapGridItem.args_string = JSON.stringify({
    baseMap:
      "https://server.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer",
    layers: [
      {
        configuration: {
          type: "ImageLayer",
          props: {
            name: "NWC",
            source: {
              type: "ESRI Image and Map Service",
              props: {
                url: "some_url",
              },
            },
          },
        },
        attributeVariables: {
          NWC: {
            nws_lid: "Diff LID",
          },
        },
      },
    ],
  });
  dashboardWithMap.tabs[0].gridItems = [
    newMockedTextVariable,
    mockedDateRangeVariable,
    mockedMapBase,
    anotherMapGridItem,
  ];

  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/dashboards/get/",
      (req, res, ctx) => {
        return res(
          ctx.delay(500),
          ctx.status(200),
          ctx.json({ success: true, dashboard: dashboardWithMap }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
  );

  render(
    <AvailableDashboardsContext.Provider
      value={{ updateDashboard: mockUpdateDashboard }}
    >
      <DashboardLoader {...dashboardWithMap}>
        <TestingComponent TabID={1} />
      </DashboardLoader>
    </AvailableDashboardsContext.Provider>,
  );

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({
      LID: "some value",
      "Test Variable": {
        "Start Date": "01/14/2026T00:00",
        "End Date": "01/16/2026T00:00",
      },
      "Start Date": "01/14/2026T00:00",
      "End Date": "01/16/2026T00:00",
      "Diff LID": null,
    }),
  );
  expect(
    await screen.findByTestId("variable-input-date-formats"),
  ).toHaveTextContent(
    JSON.stringify({
      "Test Variable": "MM/dd/yyyy'T'HH:mm",
      "Start Date": "MM/dd/yyyy'T'HH:mm",
      "End Date": "MM/dd/yyyy'T'HH:mm",
    }),
  );

  let { tabs, ...dashboardContextProperties } = dashboardWithMap;
  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({ ...dashboardContextProperties, editable: true }),
  );
  expect(await screen.findByTestId("tabs-context")).toHaveTextContent(
    JSON.stringify({ tabs: [...tabs], activeTabId: tabs[0].id }),
  );
});

test("DashboardLoader with Map and no layers", async () => {
  const mockUpdateDashboard = jest.fn();
  const dashboardWithMap = JSON.parse(JSON.stringify(userDashboard));
  const mapGridItem = JSON.parse(JSON.stringify(mockedMapBase));
  mapGridItem.args_string = JSON.stringify({
    baseMap:
      "https://server.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer",
  });
  dashboardWithMap.tabs[0].gridItems = [mapGridItem];

  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/dashboards/get/",
      (req, res, ctx) => {
        return res(
          ctx.delay(500),
          ctx.status(200),
          ctx.json({ success: true, dashboard: dashboardWithMap }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
  );

  render(
    <AvailableDashboardsContext.Provider
      value={{ updateDashboard: mockUpdateDashboard }}
    >
      <DashboardLoader {...dashboardWithMap}>
        <TestingComponent TabID={1} />
      </DashboardLoader>
    </AvailableDashboardsContext.Provider>,
  );

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({}),
  );

  let { tabs, ...dashboardContextProperties } = dashboardWithMap;
  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({ ...dashboardContextProperties, editable: true }),
  );
  expect(await screen.findByTestId("tabs-context")).toHaveTextContent(
    JSON.stringify({ tabs: [...tabs], activeTabId: tabs[0].id }),
  );
});

test("DashboardLoader with Map and no attributeVariables", async () => {
  const mockUpdateDashboard = jest.fn();
  const dashboardWithMap = JSON.parse(JSON.stringify(userDashboard));
  const mapGridItem = JSON.parse(JSON.stringify(mockedMapBase));
  mapGridItem.args_string = JSON.stringify({
    baseMap:
      "https://server.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer",
    layers: [
      {
        configuration: {
          type: "ImageLayer",
          props: {
            name: "NWC",
            source: {
              type: "ESRI Image and Map Service",
              props: {
                url: "some_url",
              },
            },
          },
        },
      },
    ],
  });
  dashboardWithMap.tabs[0].gridItems = [mapGridItem];

  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/dashboards/get/",
      (req, res, ctx) => {
        return res(
          ctx.delay(500),
          ctx.status(200),
          ctx.json({ success: true, dashboard: dashboardWithMap }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
  );

  render(
    <AvailableDashboardsContext.Provider
      value={{ updateDashboard: mockUpdateDashboard }}
    >
      <DashboardLoader {...dashboardWithMap}>
        <TestingComponent TabID={1} />
      </DashboardLoader>
    </AvailableDashboardsContext.Provider>,
  );

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({}),
  );

  let { tabs, ...dashboardContextProperties } = dashboardWithMap;
  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({ ...dashboardContextProperties, editable: true }),
  );
  expect(await screen.findByTestId("tabs-context")).toHaveTextContent(
    JSON.stringify({ tabs: [...tabs], activeTabId: tabs[0].id }),
  );
});

test("DashboardLoader with Number Slider", async () => {
  const mockUpdateDashboard = jest.fn();
  const dashboardWithSlider = JSON.parse(JSON.stringify(userDashboard));
  dashboardWithSlider.tabs[0].gridItems = [mockedSliderVariable];

  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/dashboards/get/",
      (req, res, ctx) => {
        return res(
          ctx.delay(500),
          ctx.status(200),
          ctx.json({ success: true, dashboard: dashboardWithSlider }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
  );

  render(
    <AvailableDashboardsContext.Provider
      value={{ updateDashboard: mockUpdateDashboard }}
    >
      <DashboardLoader {...dashboardWithSlider}>
        <TestingComponent TabID={1} />
      </DashboardLoader>
    </AvailableDashboardsContext.Provider>,
  );

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Test Variable": 50 }),
  );

  expect(
    await screen.findByTestId("variable-input-date-formats"),
  ).toHaveTextContent(JSON.stringify({}));

  let { tabs, ...dashboardContextProperties } = dashboardWithSlider;
  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({ ...dashboardContextProperties, editable: true }),
  );
  expect(await screen.findByTestId("tabs-context")).toHaveTextContent(
    JSON.stringify({ tabs: [...tabs], activeTabId: tabs[0].id }),
  );
});

test("DashboardLoader with Date Slider", async () => {
  const mockUpdateDashboard = jest.fn();
  const dashboardWithSlider = JSON.parse(JSON.stringify(userDashboard));
  const dateSliderVariable = JSON.parse(JSON.stringify(mockedSliderVariable));
  dateSliderVariable.args_string = JSON.stringify({
    initial_value: "01/14/2026T00:00",
    variable_name: "Test Variable",
    variable_options_source: "slider",
    "variable_options_source.metadata": {
      dataType: "Date",
      dateTimeDelta: "Day",
      rangeMode: false,
      min: "01/14/2026T00:00",
      max: "12/31/2026T23:59",
      initialValue: "01/14/2026T00:00",
      step: 1,
      outputFormat: "yyyy-MM-dd",
    },
  });
  dashboardWithSlider.tabs[0].gridItems = [dateSliderVariable];

  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/dashboards/get/",
      (req, res, ctx) => {
        return res(
          ctx.delay(500),
          ctx.status(200),
          ctx.json({ success: true, dashboard: dashboardWithSlider }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
  );

  render(
    <AvailableDashboardsContext.Provider
      value={{ updateDashboard: mockUpdateDashboard }}
    >
      <DashboardLoader {...dashboardWithSlider}>
        <TestingComponent TabID={1} />
      </DashboardLoader>
    </AvailableDashboardsContext.Provider>,
  );

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Test Variable": "01/14/2026T00:00" }),
  );

  expect(
    await screen.findByTestId("variable-input-date-formats"),
  ).toHaveTextContent(JSON.stringify({ "Test Variable": "yyyy-MM-dd" }));

  let { tabs, ...dashboardContextProperties } = dashboardWithSlider;
  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({ ...dashboardContextProperties, editable: true }),
  );
  expect(await screen.findByTestId("tabs-context")).toHaveTextContent(
    JSON.stringify({ tabs: [...tabs], activeTabId: tabs[0].id }),
  );
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
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
  );

  render(
    <AvailableDashboardsContext.Provider
      value={{ updateDashboard: mockUpdateDashboard }}
    >
      <DashboardLoader>Hello World!</DashboardLoader>
    </AvailableDashboardsContext.Provider>,
  );

  expect(await screen.findByTestId("loading-animation")).toBeInTheDocument();
  expect(
    await screen.findByText(
      "The dashboard failed to load. Please try again or contact admins.",
    ),
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
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
  );

  render(
    <AvailableDashboardsContext.Provider
      value={{ updateDashboard: mockUpdateDashboard }}
    >
      <DashboardLoader>Hello World!</DashboardLoader>
    </AvailableDashboardsContext.Provider>,
  );

  expect(await screen.findByTestId("loading-animation")).toBeInTheDocument();
  expect(
    await screen.findByText(
      "The dashboard failed to load. Please try again or contact admins.",
    ),
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
    </AvailableDashboardsContext.Provider>,
  );

  expect(await screen.findByTestId("editing")).toHaveTextContent("not editing");
  expect(screen.getByTestId("disabledMovement")).toHaveTextContent(
    "allowed movement",
  );

  const editButton = screen.getByTestId("editButton");
  await userEvent.click(editButton);

  expect(await screen.findByTestId("editing")).toHaveTextContent("editing");
  expect(screen.getByTestId("disabledMovement")).toHaveTextContent(
    "allowed movement",
  );

  const movementButton = screen.getByTestId("movementButton");
  await userEvent.click(movementButton);

  expect(await screen.findByTestId("editing")).toHaveTextContent("editing");
  expect(await screen.findByTestId("disabledMovement")).toHaveTextContent(
    "disabled movement",
  );

  await userEvent.click(editButton);

  expect(await screen.findByTestId("editing")).toHaveTextContent("editing");
  expect(await screen.findByTestId("disabledMovement")).toHaveTextContent(
    "allowed movement",
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
    </AvailableDashboardsContext.Provider>,
  );

  let { tabs, ...dashboardContextProperties } = userDashboard;
  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({ ...dashboardContextProperties, editable: true }),
  );
  expect(await screen.findByTestId("tabs-context")).toHaveTextContent(
    JSON.stringify({ tabs: [...tabs], activeTabId: tabs[0].id }),
  );

  const updatedTabButton = await screen.findByTestId("updatedTabButton");
  await userEvent.click(updatedTabButton);

  ({ tabs, ...dashboardContextProperties } = updatedDashboard);
  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({ ...dashboardContextProperties, editable: true }),
  );
  expect(await screen.findByTestId("tabs-context")).toHaveTextContent(
    JSON.stringify({ tabs: [...tabs], activeTabId: tabs[0].id }),
  );

  const resetGridItemsButton = await screen.findByTestId(
    "resetGridItemsButton",
  );
  await userEvent.click(resetGridItemsButton);

  ({ tabs, ...dashboardContextProperties } = updatedDashboard);
  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({ ...dashboardContextProperties, editable: true }),
  );
  expect(await screen.findByTestId("tabs-context")).toHaveTextContent(
    JSON.stringify({ tabs: [...tabs], activeTabId: tabs[0].id }),
  );
});

test("DashboardLoader updateGridItems existing variable input", async () => {
  const mockUpdateDashboard = jest.fn();
  const updatedDashboard = JSON.parse(JSON.stringify(userDashboard));
  const mockedDashboard = JSON.parse(JSON.stringify(userDashboard));
  mockedDashboard.tabs[0].gridItems = [mockedTextVariable];

  const updatedTextVariable = JSON.parse(
    JSON.stringify(mockedCheckboxVariable),
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
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
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
    </AvailableDashboardsContext.Provider>,
  );

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({
      "Test Variable": "",
    }),
  );

  let { tabs, ...dashboardContextProperties } = mockedDashboard;
  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({ ...dashboardContextProperties, editable: true }),
  );
  expect(await screen.findByTestId("tabs-context")).toHaveTextContent(
    JSON.stringify({ tabs: [...tabs], activeTabId: tabs[0].id }),
  );

  const updatedTabButton = await screen.findByTestId("updatedTabButton");
  await userEvent.click(updatedTabButton);

  ({ tabs, ...dashboardContextProperties } = updatedDashboard);
  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({ ...dashboardContextProperties, editable: true }),
  );
  expect(await screen.findByTestId("tabs-context")).toHaveTextContent(
    JSON.stringify({ tabs: [...tabs], activeTabId: tabs[0].id }),
  );

  // Doesn't change input variables so that the existing variable input keeps the same value from before and not rerender everything in the page
  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({
      "Test Variable": "",
    }),
  );
});

test("DashboardLoader updateGridItems existing date range variable input", async () => {
  const mockUpdateDashboard = jest.fn();
  const updatedDashboard = JSON.parse(JSON.stringify(userDashboard));
  const mockedDashboard = JSON.parse(JSON.stringify(userDashboard));
  mockedDashboard.tabs[0].gridItems = [mockedTextVariable];
  updatedDashboard.tabs[0].gridItems = [mockedDateRangeVariable];

  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/dashboards/get/",
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({ success: true, dashboard: mockedDashboard }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
  );

  render(
    <AvailableDashboardsContext.Provider
      value={{ updateDashboard: mockUpdateDashboard }}
    >
      <DashboardLoader {...mockedDashboard}>
        <TestingComponent
          TabID={1}
          updatedTabProperties={{ gridItems: [mockedDateRangeVariable] }}
        />
      </DashboardLoader>
    </AvailableDashboardsContext.Provider>,
  );

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({
      "Test Variable": "",
    }),
  );

  expect(
    await screen.findByTestId("variable-input-date-formats"),
  ).toHaveTextContent(JSON.stringify({}));

  let { tabs, ...dashboardContextProperties } = mockedDashboard;
  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({ ...dashboardContextProperties, editable: true }),
  );

  expect(await screen.findByTestId("tabs-context")).toHaveTextContent(
    JSON.stringify({ tabs: [...tabs], activeTabId: tabs[0].id }),
  );

  const updatedTabButton = await screen.findByTestId("updatedTabButton");
  await userEvent.click(updatedTabButton);

  ({ tabs, ...dashboardContextProperties } = updatedDashboard);
  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({ ...dashboardContextProperties, editable: true }),
  );
  expect(await screen.findByTestId("tabs-context")).toHaveTextContent(
    JSON.stringify({ tabs: [...tabs], activeTabId: tabs[0].id }),
  );

  await waitFor(() =>
    expect(screen.getByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({
        "Test Variable": "", //because it is using a previous value
        "Start Date": "01/14/2026T00:00",
        "End Date": "01/16/2026T00:00",
      }),
    ),
  );
  expect(
    await screen.findByTestId("variable-input-date-formats"),
  ).toHaveTextContent(
    JSON.stringify({
      "Test Variable": "MM/dd/yyyy'T'HH:mm",
      "Start Date": "MM/dd/yyyy'T'HH:mm",
      "End Date": "MM/dd/yyyy'T'HH:mm",
    }),
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
    </AvailableDashboardsContext.Provider>,
  );

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({}),
  );

  let { tabs, ...dashboardContextProperties } = userDashboard;
  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({ ...dashboardContextProperties, editable: true }),
  );
  expect(await screen.findByTestId("tabs-context")).toHaveTextContent(
    JSON.stringify({ tabs: [...tabs], activeTabId: tabs[0].id }),
  );

  const updatedTabButton = await screen.findByTestId("updatedTabButton");
  await userEvent.click(updatedTabButton);

  ({ tabs, ...dashboardContextProperties } = updatedDashboard);
  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({ ...dashboardContextProperties, editable: true }),
  );
  expect(await screen.findByTestId("tabs-context")).toHaveTextContent(
    JSON.stringify({ tabs: [...tabs], activeTabId: tabs[0].id }),
  );

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({
      "Test Variable": "",
    }),
  );
});

test("DashboardLoader updateGridItems add checkbox variable input", async () => {
  const mockUpdateDashboard = jest.fn();
  const updatedDashboard = JSON.parse(JSON.stringify(userDashboard));

  const updatedTextVariable = JSON.parse(
    JSON.stringify(mockedCheckboxVariable),
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
    </AvailableDashboardsContext.Provider>,
  );

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({}),
  );

  let { tabs, ...dashboardContextProperties } = userDashboard;
  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({ ...dashboardContextProperties, editable: true }),
  );
  expect(await screen.findByTestId("tabs-context")).toHaveTextContent(
    JSON.stringify({ tabs: [...tabs], activeTabId: tabs[0].id }),
  );

  const updatedTabButton = await screen.findByTestId("updatedTabButton");
  await userEvent.click(updatedTabButton);

  ({ tabs, ...dashboardContextProperties } = updatedDashboard);
  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({ ...dashboardContextProperties, editable: true }),
  );
  expect(await screen.findByTestId("tabs-context")).toHaveTextContent(
    JSON.stringify({ tabs: [...tabs], activeTabId: tabs[0].id }),
  );

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({
      "Test Variable": false,
    }),
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
    </AvailableDashboardsContext.Provider>,
  );

  const saveLayoutContextButton = await screen.findByTestId(
    "saveLayoutContextButton",
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
    </AvailableDashboardsContext.Provider>,
  );

  const saveLayoutContextButton = await screen.findByTestId(
    "saveLayoutContextButton",
  );
  await userEvent.click(saveLayoutContextButton);

  expect(mockUpdateDashboard).toHaveBeenCalledWith({
    id: 1,
    newProperties: { tabs: [] },
  });

  const { tabs, ...dashboardContextProperties } = updatedDashboard;
  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({ ...dashboardContextProperties, editable: true }),
  );

  expect(await screen.findByTestId("tabs-context")).toHaveTextContent(
    JSON.stringify({ tabs: [...tabs], activeTabId: tabs[0].id }),
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
    </AvailableDashboardsContext.Provider>,
  );

  const saveLayoutContextButton = await screen.findByTestId(
    "saveLayoutContextButton",
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
    </AvailableDashboardsContext.Provider>,
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
    </AvailableDashboardsContext.Provider>,
  );

  expect(await screen.findByTestId("tabs-length")).toHaveTextContent("1");
  expect(await screen.findByTestId("active-tab-id")).toHaveTextContent("1");
  expect(await screen.findByTestId("active-tab-name")).toHaveTextContent(
    "Tab 1",
  );

  const updateTabButton = screen.getByTestId("updateTabButton");
  await userEvent.click(updateTabButton);

  expect(await screen.findByTestId("tabs-length")).toHaveTextContent("1");
  expect(await screen.findByTestId("active-tab-id")).toHaveTextContent("1");
  expect(await screen.findByTestId("active-tab-name")).toHaveTextContent(
    "Updated Tab",
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
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
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
    </AvailableDashboardsContext.Provider>,
  );

  expect(await screen.findByTestId("active-tab-grid-items")).toHaveTextContent(
    JSON.stringify(twoTabsDashboard.tabs[0].gridItems),
  );

  const updateTabButton = screen.getByTestId("updateTabButton");
  await userEvent.click(updateTabButton);

  expect(await screen.findByTestId("active-tab-grid-items")).toHaveTextContent(
    JSON.stringify([]),
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
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
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
    </AvailableDashboardsContext.Provider>,
  );

  expect(await screen.findByTestId("active-tab-id")).toHaveTextContent("1");
  expect(await screen.findByTestId("active-tab-name")).toHaveTextContent(
    "Tab 1",
  );
  expect(await screen.findByTestId("tab1-name")).toHaveTextContent("Tab 1");
  expect(await screen.findByTestId("tab2-name")).toHaveTextContent("Tab 2");

  const deleteTabButton = screen.getByTestId("deleteTabButton");
  await userEvent.click(deleteTabButton);
  expect(await screen.findByTestId("active-tab-id")).toHaveTextContent("2");
  expect(await screen.findByTestId("active-tab-name")).toHaveTextContent(
    "Tab 2",
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
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
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
    </AvailableDashboardsContext.Provider>,
  );

  expect(await screen.findByTestId("active-tab-id")).toHaveTextContent("1");
  expect(await screen.findByTestId("active-tab-name")).toHaveTextContent(
    "Tab 1",
  );
  expect(await screen.findByTestId("tab1-name")).toHaveTextContent("Tab 1");
  expect(await screen.findByTestId("tab2-name")).toHaveTextContent("Tab 2");

  const deleteTabButton = screen.getByTestId("deleteTabButton");
  await userEvent.click(deleteTabButton);
  expect(await screen.findByTestId("active-tab-id")).toHaveTextContent("1");
  expect(await screen.findByTestId("active-tab-name")).toHaveTextContent(
    "Tab 1",
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
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
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
    </AvailableDashboardsContext.Provider>,
  );

  expect(await screen.findByTestId("first-tab-name")).toHaveTextContent(
    "Tab 1",
  );

  const reorderTabsButton = screen.getByTestId("reorderTabsButton");
  await userEvent.click(reorderTabsButton);
  expect(await screen.findByTestId("first-tab-name")).toHaveTextContent(
    "Tab 2",
  );

  const resetTabsButton = screen.getByTestId("resetTabsButton");
  await userEvent.click(resetTabsButton);

  expect(await screen.findByTestId("first-tab-name")).toHaveTextContent(
    "Tab 1",
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
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
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
    </AvailableDashboardsContext.Provider>,
  );

  expect(await screen.findByTestId("active-tab-id")).toHaveTextContent("1");
  expect(await screen.findByTestId("active-tab-name")).toHaveTextContent(
    "Tab 1",
  );
  expect(await screen.findByTestId("tab1-name")).toHaveTextContent("Tab 1");
  expect(await screen.findByTestId("tab2-name")).toHaveTextContent("Tab 2");

  const setActiveTab2Button = screen.getByTestId("setActiveTab2Button");
  await userEvent.click(setActiveTab2Button);
  expect(await screen.findByTestId("active-tab-id")).toHaveTextContent("2");
  expect(await screen.findByTestId("active-tab-name")).toHaveTextContent(
    "Tab 2",
  );
});

test("DashboardLoader updateTabs writes every tab in one commit", async () => {
  const mockUpdateDashboard = jest.fn();
  const tabOneVariable = JSON.parse(JSON.stringify(mockedTextVariable));
  tabOneVariable.args_string = JSON.stringify({
    initial_value: "one",
    variable_name: "Tab One Variable",
    variable_options_source: "text",
  });
  const tabTwoVariable = JSON.parse(JSON.stringify(mockedTextVariable));
  tabTwoVariable.id = 2;
  tabTwoVariable.uuid = "some-uuid-2";
  tabTwoVariable.i = "2";
  tabTwoVariable.args_string = JSON.stringify({
    initial_value: "two",
    variable_name: "Tab Two Variable",
    variable_options_source: "text",
  });

  const twoTabDashboard = JSON.parse(JSON.stringify(userDashboard));
  twoTabDashboard.tabs = [
    { id: 1, name: "Tab 1", gridItems: [tabOneVariable] },
    { id: 2, name: "Tab 2", gridItems: [tabTwoVariable] },
  ];

  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/dashboards/get/",
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({ success: true, dashboard: twoTabDashboard }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
  );

  // The commit edits a grid item on the NON-active tab. Doing this through
  // `updateTab` would rebuild the variable input values from only that tab and
  // blank "Tab One Variable"; `updateTabs` rebuilds over the whole list.
  const editedTabTwoVariable = JSON.parse(JSON.stringify(tabTwoVariable));
  editedTabTwoVariable.w = 5;
  const nextTabs = [
    { id: 1, name: "Tab 1", gridItems: [tabOneVariable] },
    { id: 2, name: "Tab 2", gridItems: [editedTabTwoVariable] },
  ];

  render(
    <AvailableDashboardsContext.Provider
      value={{ updateDashboard: mockUpdateDashboard }}
    >
      <DashboardLoader {...twoTabDashboard}>
        <InputVariablePComponent />
        <TabsPComponent />
        <TabContext.Consumer>
          {({ updateTabs }) => (
            <button
              data-testid="updateTabsButton"
              onClick={() => updateTabs(nextTabs)}
            ></button>
          )}
        </TabContext.Consumer>
      </DashboardLoader>
    </AvailableDashboardsContext.Provider>,
  );

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({
      "Tab One Variable": "one",
      "Tab Two Variable": "two",
    }),
  );

  const updateTabsButton = await screen.findByTestId("updateTabsButton");
  await userEvent.click(updateTabsButton);

  // One write covering both tabs...
  expect(await screen.findByTestId("tabs-context")).toHaveTextContent(
    JSON.stringify({ tabs: nextTabs, activeTabId: 1 }),
  );
  // ...and every tab's variable inputs survive it.
  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({
      "Tab One Variable": "one",
      "Tab Two Variable": "two",
    }),
  );
});

describe("DashboardLoader plugin variable input preload", () => {
  const pluginVisualizations = [
    {
      label: "Plugins",
      options: [
        {
          source: "station_picker",
          type: "variable_input",
          args: { basin: "text" },
        },
      ],
    },
  ];

  const pluginVariableInput = {
    ...mockedTextVariable,
    id: 7,
    uuid: "plugin-vi-uuid",
    i: "7",
    source: "station_picker",
    args_string: JSON.stringify({ basin: "willamette" }),
  };
  const builtInVariableInput = JSON.parse(JSON.stringify(mockedTextVariable));
  builtInVariableInput.args_string = JSON.stringify({
    initial_value: "built in",
    variable_name: "Built In",
    variable_options_source: "text",
  });

  const preloadDashboard = {
    ...JSON.parse(JSON.stringify(userDashboard)),
    tabs: [
      {
        id: 1,
        name: "Tab 1",
        gridItems: [builtInVariableInput, pluginVariableInput],
      },
      { id: 2, name: "Tab 2", gridItems: [] },
    ],
  };

  const stationResponse = {
    success: true,
    viz_type: "variable_input",
    data: {
      variable_name: "Station",
      initial_value: "SALEM",
      variable_options_source: "text",
    },
  };

  // The plugin variable input's own tile, publishing through the real
  // VariableInput. `variableName` stands in for what its run() returned.
  const PluginVariableInputTile = ({ variableName }) => (
    <GridItemContext.Provider
      value={{
        gridItemUUID: pluginVariableInput.uuid,
        gridItemSource: pluginVariableInput.source,
      }}
    >
      <VariableInput
        variable_name={variableName}
        initial_value="SALEM"
        variable_options_source="text"
        onChange={() => {}}
      />
    </GridItemContext.Provider>
  );
  PluginVariableInputTile.propTypes = { variableName: PropTypes.string };

  const renderPreloadingDashboard = ({
    visualizations = pluginVisualizations,
    children = null,
  } = {}) =>
    render(
      <AppContext.Provider value={{ visualizations, visualizationArgs: [] }}>
        <AvailableDashboardsContext.Provider
          value={{ updateDashboard: jest.fn() }}
        >
          <DashboardLoader {...preloadDashboard}>
            <InputVariablePComponent />
            <TabContext.Consumer>
              {({ updateTab }) => (
                <>
                  <button
                    data-testid="moveGridItemButton"
                    onClick={() =>
                      updateTab(1, {
                        gridItems: [
                          { ...builtInVariableInput, x: 5 },
                          pluginVariableInput,
                        ],
                      })
                    }
                  ></button>
                  <button
                    data-testid="removeBuiltInButton"
                    onClick={() =>
                      updateTab(1, { gridItems: [pluginVariableInput] })
                    }
                  ></button>
                  <button
                    data-testid="removePluginButton"
                    onClick={() =>
                      updateTab(1, { gridItems: [builtInVariableInput] })
                    }
                  ></button>
                  <button
                    data-testid="replacePluginWithBuiltInButton"
                    onClick={() =>
                      updateTab(1, {
                        gridItems: [
                          builtInVariableInput,
                          {
                            ...builtInVariableInput,
                            uuid: "new-built-in-uuid",
                            args_string: JSON.stringify({
                              initial_value: "fresh",
                              variable_name: "Station",
                              variable_options_source: "text",
                            }),
                          },
                        ],
                      })
                    }
                  ></button>
                  <button
                    data-testid="updateOtherTabButton"
                    onClick={() => updateTab(2, { gridItems: [] })}
                  ></button>
                </>
              )}
            </TabContext.Consumer>
            {children}
          </DashboardLoader>
        </AvailableDashboardsContext.Provider>
      </AppContext.Provider>,
    );

  let infoSpy;
  beforeEach(() => {
    // Loading status text is logged, not rendered; capture it for assertions.
    infoSpy = jest.spyOn(console, "info").mockImplementation(() => {});
    jest
      .spyOn(appAPI, "getDashboard")
      .mockResolvedValue({ success: true, dashboard: preloadDashboard });
  });

  afterEach(() => {
    clearPreloadedVisualizations();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test("shows its progress, then renders with the plugin's value", async () => {
    let resolvePlugin;
    const spy = jest.spyOn(appAPI, "getVisualizationData").mockReturnValue(
      new Promise((resolve) => {
        resolvePlugin = resolve;
      }),
    );

    renderPreloadingDashboard();

    const status = await screen.findByRole("status");
    expect(status).toBeInTheDocument();
    await waitFor(() =>
      expect(infoSpy).toHaveBeenCalledWith(
        "[loading]",
        "Loading Dashboard... — Loading variable inputs… (0 of 1)",
      ),
    );
    expect(screen.queryByTestId("input-variables")).not.toBeInTheDocument();
    // The user may edit the dashboard, so the request carries every arg and
    // says so.
    expect(spy).toHaveBeenCalledWith({
      dashboard: "user-uuid",
      tile: "plugin-vi-uuid",
      source: "station_picker",
      args: { basin: "willamette" },
      requestId: "plugin-vi-uuid",
      allArgs: true,
    });

    await act(async () => resolvePlugin(stationResponse));

    expect(await screen.findByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({ "Built In": "built in", Station: "SALEM" }),
    );
  });

  test("keeps the plugin's value through a layout update, and still releases a removed built-in", async () => {
    jest
      .spyOn(appAPI, "getVisualizationData")
      .mockResolvedValue(stationResponse);

    renderPreloadingDashboard();

    expect(await screen.findByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({ "Built In": "built in", Station: "SALEM" }),
    );

    // The drag/resize stop path: DashboardLayout.updateLayout -> updateTab.
    await userEvent.click(screen.getByTestId("moveGridItemButton"));
    expect(screen.getByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({ "Built In": "built in", Station: "SALEM" }),
    );

    await userEvent.click(screen.getByTestId("removeBuiltInButton"));
    expect(screen.getByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({ Station: "SALEM" }),
    );
  });

  test("renders at the budget without a hanging plugin, and ignores its late answer", async () => {
    jest.useFakeTimers();
    let resolvePlugin;
    jest.spyOn(appAPI, "getVisualizationData").mockReturnValue(
      new Promise((resolve) => {
        resolvePlugin = resolve;
      }),
    );

    renderPreloadingDashboard();
    // Let the dashboard arrive and the preload start; the budget runs from
    // there.
    await act(async () => {
      await Promise.resolve();
      jest.advanceTimersByTime(0);
    });
    expect(infoSpy).toHaveBeenCalledWith(
      "[loading]",
      "Loading Dashboard... — Loading variable inputs… (0 of 1)",
    );
    await act(async () => {
      jest.advanceTimersByTime(VARIABLE_INPUT_PRELOAD_BUDGET_MS - 1);
    });
    expect(screen.queryByTestId("input-variables")).not.toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(screen.getByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({ "Built In": "built in" }),
    );

    await act(async () => resolvePlugin(stationResponse));
    expect(screen.getByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({ "Built In": "built in" }),
    );
  });

  test("releases a deleted plugin variable input's value, but not for another tab's update", async () => {
    jest
      .spyOn(appAPI, "getVisualizationData")
      .mockResolvedValue(stationResponse);

    renderPreloadingDashboard();
    expect(await screen.findByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({ "Built In": "built in", Station: "SALEM" }),
    );

    // Another tab's update only considers that tab's grid items.
    await userEvent.click(screen.getByTestId("updateOtherTabButton"));
    expect(screen.getByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({ "Built In": "built in", Station: "SALEM" }),
    );

    await userEvent.click(screen.getByTestId("removePluginButton"));
    expect(screen.getByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({ "Built In": "built in" }),
    );
  });

  test("writes nothing when the dashboard is left before it answers", async () => {
    // Navigating away mid-load. The response lands on an unmounted component,
    // and anything written then is a React warning at best and a value from
    // the wrong dashboard at worst.
    let resolveDashboard;
    jest.spyOn(appAPI, "getDashboard").mockReturnValue(
      new Promise((resolve) => {
        resolveDashboard = resolve;
      }),
    );
    const getData = jest.spyOn(appAPI, "getVisualizationData");

    const { unmount } = renderPreloadingDashboard();
    expect(await screen.findByRole("status")).toBeInTheDocument();
    unmount();

    await act(async () => {
      resolveDashboard({ success: true, dashboard: preloadDashboard });
      for (let i = 0; i < 10; i += 1) await Promise.resolve();
    });
    // It stopped before even starting the preload.
    expect(getData).not.toHaveBeenCalled();
  });

  test("writes nothing when the dashboard is left during the preload", async () => {
    // One step later: the tabs are in hand and a plugin variable input is
    // still running when the dashboard goes away.
    let resolvePlugin;
    jest.spyOn(appAPI, "getVisualizationData").mockReturnValue(
      new Promise((resolve) => {
        resolvePlugin = resolve;
      }),
    );

    const { unmount } = renderPreloadingDashboard();
    await waitFor(() =>
      expect(infoSpy).toHaveBeenCalledWith(
        "[loading]",
        expect.stringContaining("Loading variable inputs"),
      ),
    );
    unmount();

    await act(async () => {
      resolvePlugin(stationResponse);
      for (let i = 0; i < 10; i += 1) await Promise.resolve();
    });
    expect(screen.queryByTestId("input-variables")).not.toBeInTheDocument();
  });

  test("renders without owners when the preload reports none", async () => {
    // The preload returns what it added, and a build of it that adds nothing
    // may report nothing at all; the dashboard still has to come up.
    jest
      .spyOn(variableInputPreload, "preloadPluginVariableInputs")
      .mockResolvedValue({ values: { Station: "SALEM" }, dateFormats: {} });

    renderPreloadingDashboard();

    expect(await screen.findByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({ "Built In": "built in", Station: "SALEM" }),
    );
  });

  test("shows the error page when the dashboard cannot be fetched", async () => {
    jest.spyOn(appAPI, "getDashboard").mockResolvedValue({ success: false });

    renderPreloadingDashboard();

    expect(
      await screen.findByText("Dashboard Failed to Load"),
    ).toBeInTheDocument();
  });

  test("writes no error when the fetch fails after the dashboard is left", async () => {
    // The other half of leaving mid-load: the request rejects rather than
    // resolving, and the error page must not be put up on an unmounted tree.
    let rejectDashboard;
    jest.spyOn(appAPI, "getDashboard").mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectDashboard = reject;
      }),
    );

    const { unmount } = renderPreloadingDashboard();
    await screen.findByRole("status");
    unmount();

    await act(async () => {
      rejectDashboard(new Error("network"));
      for (let i = 0; i < 10; i += 1) await Promise.resolve();
    });
    expect(
      screen.queryByText("Dashboard Failed to Load"),
    ).not.toBeInTheDocument();
  });

  describe("a plugin and a built-in that share a name", () => {
    // The built-in publishes "Station" from its args; the plugin publishes the
    // same name from its run(). Whichever goes away, the other is still
    // publishing it, so the value has to stay.
    const sharedBuiltIn = {
      ...builtInVariableInput,
      uuid: "shared-built-in-uuid",
      i: "9",
      args_string: JSON.stringify({
        initial_value: "shared",
        variable_name: "Station",
        variable_options_source: "text",
      }),
    };
    const sharedDashboard = {
      ...preloadDashboard,
      tabs: [
        {
          id: 1,
          name: "Tab 1",
          gridItems: [sharedBuiltIn, pluginVariableInput],
        },
        { id: 2, name: "Tab 2", gridItems: [] },
      ],
    };

    const renderShared = (children) => {
      jest
        .spyOn(appAPI, "getDashboard")
        .mockResolvedValue({ success: true, dashboard: sharedDashboard });
      jest
        .spyOn(appAPI, "getVisualizationData")
        .mockResolvedValue(stationResponse);
      return render(
        <AppContext.Provider
          value={{
            visualizations: pluginVisualizations,
            visualizationArgs: [],
          }}
        >
          <AvailableDashboardsContext.Provider
            value={{ updateDashboard: jest.fn() }}
          >
            <DashboardLoader {...sharedDashboard}>
              <InputVariablePComponent />
              <TabContext.Consumer>
                {({ updateTab }) => (
                  <button
                    data-testid="removeSharedPluginButton"
                    onClick={() => updateTab(1, { gridItems: [sharedBuiltIn] })}
                  ></button>
                )}
              </TabContext.Consumer>
              {children}
            </DashboardLoader>
          </AvailableDashboardsContext.Provider>
        </AppContext.Provider>,
      );
    };

    test("deleting the plugin leaves the built-in's value standing", async () => {
      renderShared();
      expect(await screen.findByTestId("input-variables")).toHaveTextContent(
        JSON.stringify({ Station: "SALEM" }),
      );

      await userEvent.click(screen.getByTestId("removeSharedPluginButton"));
      expect(screen.getByTestId("input-variables")).toHaveTextContent(
        JSON.stringify({ Station: "SALEM" }),
      );
    });

    test("renaming the plugin releases nothing the built-in still owns", async () => {
      const RenamingTile = () => {
        const [variableName, setVariableName] = useState("Station");
        return (
          <>
            <PluginVariableInputTile variableName={variableName} />
            <button
              data-testid="renameSharedButton"
              onClick={() => setVariableName("Gauge")}
            ></button>
          </>
        );
      };

      renderShared(<RenamingTile />);
      expect(await screen.findByTestId("input-variables")).toHaveTextContent(
        JSON.stringify({ Station: "SALEM" }),
      );

      await userEvent.click(screen.getByTestId("renameSharedButton"));
      await waitFor(() =>
        expect(screen.getByTestId("input-variables")).toHaveTextContent(
          JSON.stringify({ Station: "SALEM", Gauge: "SALEM" }),
        ),
      );
    });
  });

  test("keeps a key a second plugin variable input still publishes", async () => {
    // Two plugin variable inputs can publish the same name -- the same picker
    // on two tabs, or two plugins that agree on one. Deleting one must not take
    // the value with it while the other is still publishing it, or every
    // visualization bound to that name would go empty.
    const secondPlugin = {
      ...pluginVariableInput,
      id: 8,
      uuid: "plugin-vi-uuid-b",
      i: "8",
    };
    const twoPluginDashboard = {
      ...preloadDashboard,
      tabs: [
        {
          id: 1,
          name: "Tab 1",
          gridItems: [builtInVariableInput, pluginVariableInput, secondPlugin],
        },
        { id: 2, name: "Tab 2", gridItems: [] },
      ],
    };
    jest
      .spyOn(appAPI, "getDashboard")
      .mockResolvedValue({ success: true, dashboard: twoPluginDashboard });
    jest
      .spyOn(appAPI, "getVisualizationData")
      .mockResolvedValue(stationResponse);

    render(
      <AppContext.Provider
        value={{ visualizations: pluginVisualizations, visualizationArgs: [] }}
      >
        <AvailableDashboardsContext.Provider
          value={{ updateDashboard: jest.fn() }}
        >
          <DashboardLoader {...twoPluginDashboard}>
            <InputVariablePComponent />
            <TabContext.Consumer>
              {({ updateTab }) => (
                <button
                  data-testid="removeOnePluginButton"
                  onClick={() =>
                    updateTab(1, {
                      gridItems: [builtInVariableInput, pluginVariableInput],
                    })
                  }
                ></button>
              )}
            </TabContext.Consumer>
          </DashboardLoader>
        </AvailableDashboardsContext.Provider>
      </AppContext.Provider>,
    );

    expect(await screen.findByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({ "Built In": "built in", Station: "SALEM" }),
    );

    await userEvent.click(screen.getByTestId("removeOnePluginButton"));
    expect(screen.getByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({ "Built In": "built in", Station: "SALEM" }),
    );
  });

  test("seeds a built-in that takes a deleted plugin's name fresh", async () => {
    jest
      .spyOn(appAPI, "getVisualizationData")
      .mockResolvedValue(stationResponse);

    renderPreloadingDashboard();
    expect(await screen.findByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({ "Built In": "built in", Station: "SALEM" }),
    );

    await userEvent.click(screen.getByTestId("replacePluginWithBuiltInButton"));
    expect(screen.getByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({ "Built In": "built in", Station: "fresh" }),
    );
  });

  test("releases the old name when a plugin variable input is renamed", async () => {
    jest
      .spyOn(appAPI, "getVisualizationData")
      .mockResolvedValue(stationResponse);
    const RenamingTile = () => {
      const [variableName, setVariableName] = useState("Station");
      return (
        <>
          <PluginVariableInputTile variableName={variableName} />
          <button
            data-testid="renameButton"
            onClick={() => setVariableName("Gauge")}
          ></button>
        </>
      );
    };

    renderPreloadingDashboard({ children: <RenamingTile /> });
    expect(await screen.findByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({ "Built In": "built in", Station: "SALEM" }),
    );

    await userEvent.click(screen.getByTestId("renameButton"));
    await waitFor(() =>
      expect(screen.getByTestId("input-variables")).toHaveTextContent(
        JSON.stringify({ "Built In": "built in", Gauge: "SALEM" }),
      ),
    );

    // And the new name is the one a deletion releases.
    await userEvent.click(screen.getByTestId("removePluginButton"));
    expect(screen.getByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({ "Built In": "built in" }),
    );
  });

  test("keeps a plugin variable input's value when its tile unmounts for a tab switch", async () => {
    jest
      .spyOn(appAPI, "getVisualizationData")
      .mockResolvedValue(stationResponse);
    const SwitchingTabs = () => {
      const [onFirstTab, setOnFirstTab] = useState(true);
      return (
        <>
          {onFirstTab && <PluginVariableInputTile variableName="Station" />}
          <button
            data-testid="switchTabButton"
            onClick={() => setOnFirstTab(!onFirstTab)}
          ></button>
        </>
      );
    };

    renderPreloadingDashboard({ children: <SwitchingTabs /> });
    expect(await screen.findByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({ "Built In": "built in", Station: "SALEM" }),
    );

    await userEvent.click(screen.getByTestId("switchTabButton"));
    expect(screen.queryByText("Station")).not.toBeInTheDocument();
    // A layout update after the switch still finds the grid item present.
    await userEvent.click(screen.getByTestId("moveGridItemButton"));
    expect(screen.getByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({ "Built In": "built in", Station: "SALEM" }),
    );
  });

  test("renders the dashboard without preloaded values when the preload throws", async () => {
    const spy = jest.spyOn(appAPI, "getVisualizationData");

    // A malformed registry entry makes the preload's own helpers throw,
    // outside any request.
    renderPreloadingDashboard({ visualizations: [null] });

    expect(await screen.findByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({ "Built In": "built in" }),
    );
    expect(
      screen.queryByText("Dashboard Failed to Load"),
    ).not.toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });
});

test("keeps a map attribute variable another tab still uses when one tab is updated", async () => {
  const mapWithAttribute = JSON.parse(JSON.stringify(mockedMapBase));
  mapWithAttribute.args_string = JSON.stringify({
    baseMap: "some_base_map",
    layers: [{ attributeVariables: { NWC: { nws_lid: "Shared LID" } } }],
  });
  const twoTabDashboard = {
    ...JSON.parse(JSON.stringify(userDashboard)),
    tabs: [
      { id: 1, name: "Tab 1", gridItems: [mapWithAttribute] },
      {
        id: 2,
        name: "Tab 2",
        gridItems: [{ ...mapWithAttribute, uuid: "second-map-uuid" }],
      },
    ],
  };
  jest
    .spyOn(appAPI, "getDashboard")
    .mockResolvedValue({ success: true, dashboard: twoTabDashboard });

  render(
    <AvailableDashboardsContext.Provider value={{ updateDashboard: jest.fn() }}>
      <DashboardLoader {...twoTabDashboard}>
        <TestingComponent TabID={1} updatedTabProperties={{ gridItems: [] }} />
      </DashboardLoader>
    </AvailableDashboardsContext.Provider>,
  );

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Shared LID": null }),
  );
  // Tab 1, the first to seed it, drops its map; tab 2's map still uses it.
  await userEvent.click(screen.getByTestId("updatedTabButton"));
  expect(screen.getByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Shared LID": null }),
  );
  jest.restoreAllMocks();
});

describe("DashboardLoader pending secrets", () => {
  const SECRET = "pending-s3cret-value";
  const visualizations = [
    {
      label: "Plugins",
      options: [
        {
          source: "secret_plugin",
          value: "Secret Plugin",
          label: "Secret Plugin",
          type: "text",
          args: { station: "text", api_key: "secret" },
        },
        {
          source: "other_secret_plugin",
          value: "Other Secret Plugin",
          label: "Other Secret Plugin",
          type: "text",
          args: { api_key: "secret" },
        },
      ],
    },
  ];
  const dynamicMapLayers = [
    {
      label: "Dynamic Map Layers",
      options: [
        {
          source: "secret_layer",
          value: "Secret Layer",
          label: "Secret Layer",
          type: "map_layer",
          dynamic_map_layer: true,
          args: { token: "secret" },
        },
      ],
    },
  ];
  const secretArgsOf = new Map([
    ["secret_plugin", new Set(["api_key"])],
    ["other_secret_plugin", new Set(["api_key"])],
    ["secret_layer", new Set(["token"])],
    ["plain_plugin", new Set()],
  ]);

  const pluginTile = {
    id: 1,
    uuid: "tile-uuid",
    i: "1",
    x: 0,
    y: 0,
    w: 20,
    h: 20,
    source: "secret_plugin",
    args_string: JSON.stringify({ station: "A", api_key: "" }),
    metadata_string: "{}",
  };
  const popupTile = {
    uuid: "popup-uuid",
    i: "1",
    x: 0,
    y: 0,
    w: 4,
    h: 4,
    source: "secret_plugin",
    args_string: JSON.stringify({ station: "P", api_key: "" }),
    metadata_string: "{}",
  };
  const mapTile = {
    id: 2,
    uuid: "map-uuid",
    i: "2",
    x: 20,
    y: 0,
    w: 20,
    h: 20,
    source: "Map",
    args_string: JSON.stringify({
      layers: [
        {
          configuration: {
            type: "VectorLayer",
            props: {
              name: "Live",
              layerId: "layer-1",
              pluginSource: { source: "secret_layer", args: { token: "" } },
            },
          },
          popupConfig: { gridItems: [popupTile] },
        },
      ],
    }),
    metadata_string: "{}",
  };
  const secretDashboard = {
    ...userDashboard,
    tabs: [{ id: 1, name: "Tab 1", gridItems: [pluginTile, mapTile] }],
    storedSecrets: [{ tile: "tile-uuid", layer: "", arg: "api_key" }],
  };

  const tilePlace = { tile: "tile-uuid", layer: "", arg: "api_key" };
  const layerPlace = { tile: "map-uuid", layer: "layer-1", arg: "token" };
  const popupPlace = { tile: "popup-uuid", layer: "", arg: "api_key" };

  // The latest LayoutContext and TabContext values the dashboard provides.
  let contexts;
  const Capture = () => {
    contexts = {
      layout: useContext(LayoutContext),
      tab: useContext(TabContext),
    };
    return (
      <p data-testid="pending-count">
        {Object.keys(contexts.layout.pendingSecrets).length}
      </p>
    );
  };

  const savedResponse = (newProperties, storedSecrets) => ({
    success: true,
    updated_dashboard: {
      ...secretDashboard,
      ...newProperties,
      storedSecrets,
    },
  });

  const renderLoader = async (updateDashboard) => {
    server.use(
      rest.get(
        "http://api.test/apps/tethysdash/dashboards/get/",
        (req, res, ctx) =>
          res(
            ctx.status(200),
            ctx.json({ success: true, dashboard: secretDashboard }),
          ),
      ),
    );
    render(
      <AppContext.Provider value={{ visualizations, dynamicMapLayers }}>
        <AvailableDashboardsContext.Provider value={{ updateDashboard }}>
          <DashboardLoader {...secretDashboard}>
            <Capture />
          </DashboardLoader>
        </AvailableDashboardsContext.Provider>
      </AppContext.Provider>,
    );
    await screen.findByTestId("pending-count");
  };

  const setPending = (place, source, value) =>
    act(() => contexts.layout.setPendingSecret({ ...place, source, value }));

  const saveTabs = () =>
    act(() => contexts.layout.saveLayoutContext({ tabs: contexts.tab.tabs }));

  test("a save of the tabs sends each pending secret as one change, the tabs carry none, and the stored list follows the response", async () => {
    const updateDashboard = jest.fn(async ({ newProperties }) =>
      savedResponse(newProperties, [
        { tile: "map-uuid", layer: "layer-1", arg: "token" },
        { tile: "popup-uuid", layer: "", arg: "api_key" },
      ]),
    );
    await renderLoader(updateDashboard);

    expect(
      contexts.layout.isSecretStored({ ...tilePlace, source: "secret_plugin" }),
    ).toBe(true);
    expect(
      contexts.layout.isSecretStored({ ...layerPlace, source: "secret_layer" }),
    ).toBe(false);

    setPending(layerPlace, "secret_layer", SECRET);
    setPending(popupPlace, "secret_plugin", `${SECRET}-popup`);
    setPending(tilePlace, "secret_plugin", null);
    expect(screen.getByTestId("pending-count")).toHaveTextContent("3");

    await saveTabs();

    expect(updateDashboard).toHaveBeenCalledTimes(1);
    const { id, newProperties } = updateDashboard.mock.calls[0][0];
    expect(id).toBe(1);
    expect(newProperties.secretChanges).toEqual([
      { ...layerPlace, value: SECRET },
      { ...popupPlace, value: `${SECRET}-popup` },
      { ...tilePlace, value: null },
    ]);
    // Nothing but the changes carries a secret.
    const { secretChanges, ...rest } = newProperties;
    expect(JSON.stringify(rest)).not.toContain(SECRET);
    expect(JSON.stringify(contexts.tab.tabs)).not.toContain(SECRET);

    expect(screen.getByTestId("pending-count")).toHaveTextContent("0");
    expect(contexts.layout.storedSecrets).toEqual([
      { tile: "map-uuid", layer: "layer-1", arg: "token" },
      { tile: "popup-uuid", layer: "", arg: "api_key" },
    ]);
    expect(
      contexts.layout.isSecretStored({ ...layerPlace, source: "secret_layer" }),
    ).toBe(true);
    expect(
      contexts.layout.isSecretStored({ ...tilePlace, source: "secret_plugin" }),
    ).toBe(false);
  });

  test("a thumbnail save or a settings save leaves pending secrets in place and sends none", async () => {
    const updateDashboard = jest.fn(async ({ newProperties }) =>
      savedResponse(newProperties, secretDashboard.storedSecrets),
    );
    await renderLoader(updateDashboard);
    setPending(layerPlace, "secret_layer", SECRET);

    await act(() =>
      contexts.layout.saveLayoutContext({ image: "data:image/png;base64,AA" }),
    );
    await act(() => contexts.layout.saveLayoutContext({ name: "Renamed" }));

    expect(
      updateDashboard.mock.calls.map(([call]) => call.newProperties),
    ).toEqual([{ image: "data:image/png;base64,AA" }, { name: "Renamed" }]);
    expect(screen.getByTestId("pending-count")).toHaveTextContent("1");

    await saveTabs();
    expect(
      updateDashboard.mock.calls[2][0].newProperties.secretChanges,
    ).toEqual([{ ...layerPlace, value: SECRET }]);
  });

  test("Cancel discards pending secrets", async () => {
    const updateDashboard = jest.fn(async ({ newProperties }) =>
      savedResponse(newProperties, secretDashboard.storedSecrets),
    );
    await renderLoader(updateDashboard);
    setPending(layerPlace, "secret_layer", SECRET);

    act(() => contexts.tab.resetTabs());
    expect(screen.getByTestId("pending-count")).toHaveTextContent("0");

    await saveTabs();
    expect(updateDashboard.mock.calls[0][0].newProperties).not.toHaveProperty(
      "secretChanges",
    );
  });

  test("a pending secret for a tile deleted before the save is dropped, and the save goes ahead", async () => {
    const updateDashboard = jest.fn(async ({ newProperties }) =>
      savedResponse(newProperties, []),
    );
    await renderLoader(updateDashboard);
    setPending(tilePlace, "secret_plugin", SECRET);

    act(() => contexts.tab.updateTab(1, { gridItems: [mapTile] }));
    await saveTabs();

    const { newProperties } = updateDashboard.mock.calls[0][0];
    expect(newProperties).not.toHaveProperty("secretChanges");
    expect(JSON.stringify(newProperties)).not.toContain(SECRET);
    // Done with: it can never be sent.
    expect(screen.getByTestId("pending-count")).toHaveTextContent("0");
  });

  test("a save that fails keeps the pending secrets for the next", async () => {
    const updateDashboard = jest.fn(async () => ({
      success: false,
      message: "The dashboard could not be saved.",
    }));
    await renderLoader(updateDashboard);
    setPending(layerPlace, "secret_layer", SECRET);

    await saveTabs();

    expect(
      updateDashboard.mock.calls[0][0].newProperties.secretChanges,
    ).toEqual([{ ...layerPlace, value: SECRET }]);
    expect(screen.getByTestId("pending-count")).toHaveTextContent("1");
  });

  test("a secret entered while a save is out waits for the next save", async () => {
    let answer;
    const updateDashboard = jest.fn(
      ({ newProperties }) =>
        new Promise((resolve) => {
          answer = () =>
            resolve(
              savedResponse(newProperties, secretDashboard.storedSecrets),
            );
        }),
    );
    await renderLoader(updateDashboard);
    setPending(layerPlace, "secret_layer", SECRET);

    let saved;
    act(() => {
      saved = contexts.layout.saveLayoutContext({ tabs: contexts.tab.tabs });
    });
    setPending(popupPlace, "secret_plugin", `${SECRET}-later`);
    await act(async () => {
      answer();
      await saved;
    });

    expect(screen.getByTestId("pending-count")).toHaveTextContent("1");
    expect(contexts.layout.pendingSecrets).toEqual({
      [secretPlaceKey(popupPlace)]: {
        ...popupPlace,
        source: "secret_plugin",
        value: `${SECRET}-later`,
      },
    });
  });

  test("a secret is stored only for the plugin its tile was saved with", async () => {
    await renderLoader(jest.fn());

    expect(
      contexts.layout.isSecretStored({ ...tilePlace, source: "secret_plugin" }),
    ).toBe(true);
    expect(
      contexts.layout.isSecretStored({
        ...tilePlace,
        tile: "TILE-UUID",
        source: "secret_plugin",
      }),
    ).toBe(true);
    expect(
      contexts.layout.isSecretStored({
        ...tilePlace,
        source: "other_secret_plugin",
      }),
    ).toBe(false);
  });

  test("discarding a place's pending secrets leaves every other place's", async () => {
    await renderLoader(jest.fn());
    setPending(tilePlace, "secret_plugin", SECRET);
    setPending({ ...tilePlace, arg: "station" }, "secret_plugin", SECRET);
    setPending(layerPlace, "secret_layer", SECRET);

    act(() =>
      contexts.layout.discardPendingSecrets({
        tile: "TILE-UUID",
        layer: "",
        arg: "station",
      }),
    );
    expect(screen.getByTestId("pending-count")).toHaveTextContent("2");

    act(() => contexts.layout.discardPendingSecrets({ tile: "tile-uuid" }));
    expect(Object.values(contexts.layout.pendingSecrets)).toEqual([
      { ...layerPlace, source: "secret_layer", value: SECRET },
    ]);

    // Nothing to discard changes nothing.
    const before = contexts.layout.pendingSecrets;
    act(() => contexts.layout.discardPendingSecrets({ tile: "tile-uuid" }));
    expect(contexts.layout.pendingSecrets).toBe(before);
  });

  test("discarding keeps a place's pending secrets entered for the plugin named", async () => {
    await renderLoader(jest.fn());
    setPending(tilePlace, "secret_plugin", SECRET);
    setPending({ ...tilePlace, arg: "station" }, "other_secret_plugin", SECRET);
    setPending(layerPlace, "secret_layer", SECRET);

    act(() =>
      contexts.layout.discardPendingSecrets({
        tile: "tile-uuid",
        layer: "",
        keepSource: "secret_plugin",
      }),
    );
    expect(Object.values(contexts.layout.pendingSecrets)).toEqual([
      { ...tilePlace, source: "secret_plugin", value: SECRET },
      { ...layerPlace, source: "secret_layer", value: SECRET },
    ]);

    // Keeping no plugin's discards the place's every one.
    act(() =>
      contexts.layout.discardPendingSecrets({
        tile: "tile-uuid",
        layer: "",
        keepSource: null,
      }),
    );
    expect(Object.values(contexts.layout.pendingSecrets)).toEqual([
      { ...layerPlace, source: "secret_layer", value: SECRET },
    ]);
  });

  test("restoring puts the pending secrets back as an editor opened with them", async () => {
    await renderLoader(jest.fn());
    setPending(tilePlace, "secret_plugin", SECRET);
    const atOpen = contexts.layout.pendingSecrets;

    setPending(layerPlace, "secret_layer", SECRET);
    setPending(popupPlace, "secret_plugin", SECRET);
    act(() => contexts.layout.discardPendingSecrets({ tile: "tile-uuid" }));
    act(() => contexts.layout.restorePendingSecrets(atOpen));

    expect(contexts.layout.pendingSecrets).toEqual(atOpen);
    expect(screen.getByTestId("pending-count")).toHaveTextContent("1");
  });

  test("restoring never brings back a pending secret a save has read since", async () => {
    const updateDashboard = jest.fn(async ({ newProperties }) =>
      savedResponse(newProperties, secretDashboard.storedSecrets),
    );
    await renderLoader(updateDashboard);
    setPending(layerPlace, "secret_layer", SECRET);
    setPending({ ...tilePlace, tile: "deleted-uuid" }, "secret_plugin", SECRET);
    const atOpen = contexts.layout.pendingSecrets;

    // A save sent while the editor was opening reads both: one sent, one
    // dropped as stale.
    await saveTabs();
    expect(
      updateDashboard.mock.calls[0][0].newProperties.secretChanges,
    ).toEqual([{ ...layerPlace, value: SECRET }]);
    act(() => contexts.layout.restorePendingSecrets(atOpen));

    expect(contexts.layout.pendingSecrets).toEqual({});
  });

  test("what an export reads holds no pending secret", async () => {
    await renderLoader(jest.fn());
    setPending(tilePlace, "secret_plugin", SECRET);

    const exported = await handleGridItemExport(
      contexts.tab.tabs[0].gridItems[0],
      contexts.layout.uuid,
    );

    expect(exported.args_string).toEqual({ station: "A", api_key: "" });
    expect(JSON.stringify(exported)).not.toContain(SECRET);
    expect(JSON.stringify(contexts.tab.tabs)).not.toContain(SECRET);
    // The PNG export names its file from these.
    expect(contexts.layout.uuid).toBe("user-uuid");
    expect(contexts.layout.name).toBe("User Dashboard");
  });

  describe("secretChangesToSave", () => {
    const tabsWith = (...gridItems) => [{ id: 1, name: "Tab 1", gridItems }];
    const pendingFor = (...entries) =>
      Object.fromEntries(
        entries.map((entry) => [secretPlaceKey(entry), entry]),
      );

    test("keeps a pending secret for a secret arg of a tile, a dynamic layer or a popup tile", () => {
      const pending = pendingFor(
        {
          ...tilePlace,
          tile: "TILE-UUID",
          source: "secret_plugin",
          value: SECRET,
        },
        { ...layerPlace, source: "secret_layer", value: null },
        { ...popupPlace, source: "secret_plugin", value: SECRET },
      );

      expect(
        secretChangesToSave(
          pending,
          tabsWith(pluginTile, mapTile),
          secretArgsOf,
        ),
      ).toEqual([
        { ...tilePlace, tile: "TILE-UUID", value: SECRET },
        { ...layerPlace, value: null },
        { ...popupPlace, value: SECRET },
      ]);
    });

    test.each([
      [
        "its tile is gone",
        tabsWith(mapTile),
        { ...tilePlace, source: "secret_plugin" },
      ],
      [
        "its layer is gone",
        tabsWith(pluginTile, { ...mapTile, args_string: "{}" }),
        { ...layerPlace, source: "secret_layer" },
      ],
      [
        "its tile has another plugin since",
        tabsWith({ ...pluginTile, source: "other_secret_plugin" }),
        { ...tilePlace, source: "secret_plugin" },
      ],
      [
        "the arg is not in the tile's args",
        tabsWith({
          ...pluginTile,
          args_string: JSON.stringify({ station: "A" }),
        }),
        { ...tilePlace, source: "secret_plugin" },
      ],
      [
        "the plugin does not declare the arg secret",
        tabsWith(pluginTile),
        { ...tilePlace, arg: "station", source: "secret_plugin" },
      ],
      [
        "no installed plugin has the source",
        tabsWith({ ...pluginTile, source: "gone_plugin" }),
        { ...tilePlace, source: "gone_plugin" },
      ],
      [
        "more than one tile has the uuid",
        tabsWith(pluginTile, { ...pluginTile, id: 3 }),
        { ...tilePlace, source: "secret_plugin" },
      ],
    ])("drops a pending secret when %s", (_, tabs, entry) => {
      expect(
        secretChangesToSave(
          pendingFor({ ...entry, value: SECRET }),
          tabs,
          secretArgsOf,
        ),
      ).toEqual([]);
    });
  });
});

TestingComponent.propTypes = {
  TabID: PropTypes.number.isRequired,
  updatedTabProperties: PropTypes.object,
  updatedDashboardProperties: PropTypes.object,
};

import { act } from "react";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import DashboardSelector from "components/layout/DashboardSelector";
import { mockedDashboards } from "__tests__/utilities/constants";
import SelectedDashboardContextProvider, {
  useLayoutContext,
} from "components/contexts/SelectedDashboardContext";
import { useDashboardDropdownContext } from "components/contexts/AvailableDashboardsContext";
import VariableInputsContextProvider from "components/contexts/VariableInputsContext";
import EditingContextProvider from "components/contexts/EditingContext";
import { confirm } from "components/dashboard/DeleteConfirmation";
import AvailableDashboardsContextProvider from "components/contexts/AvailableDashboardsContext";
import { AppContext } from "components/contexts/Contexts";
import appAPI from "services/api/app";
import PropTypes from "prop-types";

jest.mock("components/dashboard/DeleteConfirmation", () => {
  return {
    confirm: jest.fn(),
  };
});
const mockedConfirm = jest.mocked(confirm);

const TestingComponent = (props) => {
  const { getLayoutContext } = useLayoutContext();
  const { selectedDashboardDropdownOption } = useDashboardDropdownContext();

  return (
    <>
      <DashboardSelector initialDashboard={props.initialDashboard} />
      <p data-testid="layout-context">{JSON.stringify(getLayoutContext())}</p>
      <p data-testid="selected-dropdown">
        {JSON.stringify(selectedDashboardDropdownOption)}
      </p>
    </>
  );
};

test("Dashboard Selector without initial", async () => {
  render(
    <AppContext.Provider value={"csrf"}>
      <VariableInputsContextProvider>
        <SelectedDashboardContextProvider>
          <AvailableDashboardsContextProvider>
            <EditingContextProvider>
              <TestingComponent />
            </EditingContextProvider>
          </AvailableDashboardsContextProvider>
        </SelectedDashboardContextProvider>
      </VariableInputsContextProvider>
    </AppContext.Provider>
  );

  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({
      name: "",
      label: "",
      access_groups: [],
      notes: "",
      gridItems: [],
      editable: false,
    })
  );
  expect(await screen.findByTestId("selected-dropdown")).toHaveTextContent(
    null
  );
});

test("Dashboard Selector with initial", async () => {
  // eslint-disable-next-line
  await act(() =>
    render(
      <AppContext.Provider value={"csrf"}>
        <VariableInputsContextProvider>
          <SelectedDashboardContextProvider>
            <AvailableDashboardsContextProvider>
              <EditingContextProvider>
                <TestingComponent initialDashboard={"editable"} />
              </EditingContextProvider>
            </AvailableDashboardsContextProvider>
          </SelectedDashboardContextProvider>
        </VariableInputsContextProvider>
      </AppContext.Provider>
    )
  );

  await waitFor(async () => {
    expect(await screen.findByTestId("layout-context")).toHaveTextContent(
      JSON.stringify({
        name: "editable",
        label: "test_label",
        access_groups: [],
        notes: "test_notes",
        gridItems: [
          {
            i: "1",
            x: 0,
            y: 0,
            w: 20,
            h: 20,
            source: "",
            args_string: "{}",
            metadata_string: JSON.stringify({
              refreshRate: 0,
            }),
          },
        ],
        editable: true,
      })
    );
  });
  expect(await screen.findByTestId("selected-dropdown")).toHaveTextContent(
    JSON.stringify({
      value: "editable",
      label: "test_label",
    })
  );
});

test("Dashboard Selector changing between public and user options", async () => {
  render(
    <AppContext.Provider value={"csrf"}>
      <VariableInputsContextProvider>
        <SelectedDashboardContextProvider>
          <AvailableDashboardsContextProvider>
            <EditingContextProvider>
              <TestingComponent />
            </EditingContextProvider>
          </AvailableDashboardsContextProvider>
        </SelectedDashboardContextProvider>
      </VariableInputsContextProvider>
    </AppContext.Provider>
  );

  expect(await screen.findByText("Select/Add Dashboard:")).toBeInTheDocument();
  const selector = await screen.findByRole("combobox");
  expect(selector).toBeInTheDocument();
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(selector);
  });

  expect(await screen.findByText("Create a New Dashboard")).toBeInTheDocument();
  const publicGroupHeading = await screen.findByText("Public");
  expect(publicGroupHeading).toBeInTheDocument();
  expect(publicGroupHeading).toHaveAttribute(
    "id",
    "react-select-4-group-1-heading"
  );
  const publicOption = await screen.findByText("test_label2");
  expect(publicOption).toBeInTheDocument();
  expect(publicOption).toHaveAttribute("id", "react-select-4-option-1-0");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(publicOption);
  });

  expect(screen.queryByLabelText("editButton")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("cancelButton")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("saveButton")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("addGridItemButton")).not.toBeInTheDocument();

  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(selector);
  });
  const userGroupHeading = await screen.findByText("User");
  expect(userGroupHeading).toBeInTheDocument();
  expect(userGroupHeading).toHaveAttribute(
    "id",
    "react-select-4-group-2-heading"
  );
  const userOption = await screen.findByText("test_label");
  expect(userOption).toBeInTheDocument();
  expect(userOption).toHaveAttribute("id", "react-select-4-option-2-0");

  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(userOption);
  });

  const editButton = screen.getByLabelText("editButton");
  expect(editButton).toBeInTheDocument();
  expect(screen.queryByLabelText("cancelButton")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("saveButton")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("addGridItemButton")).not.toBeInTheDocument();

  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(editButton);
  });

  expect(screen.queryByLabelText("editButton")).not.toBeInTheDocument();
  expect(screen.getByLabelText("cancelButton")).toBeInTheDocument();
  expect(screen.getByLabelText("saveButton")).toBeInTheDocument();
  expect(screen.getByLabelText("addGridItemButton")).toBeInTheDocument();
});

test("Dashboard Selector create new dashboard", async () => {
  render(
    <AppContext.Provider value={"csrf"}>
      <VariableInputsContextProvider>
        <SelectedDashboardContextProvider>
          <AvailableDashboardsContextProvider>
            <EditingContextProvider>
              <TestingComponent />
            </EditingContextProvider>
          </AvailableDashboardsContextProvider>
        </SelectedDashboardContextProvider>
      </VariableInputsContextProvider>
    </AppContext.Provider>
  );

  expect(await screen.findByText("Select/Add Dashboard:")).toBeInTheDocument();
  const selector = await screen.findByRole("combobox");
  expect(selector).toBeInTheDocument();
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(selector);
  });

  const newDashboardOption = await screen.findByText("Create a New Dashboard");
  expect(newDashboardOption).toBeInTheDocument();
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(newDashboardOption);
  });
  const newDashboardModal = await screen.findByRole("dialog");
  expect(newDashboardModal).toBeInTheDocument();
  expect(newDashboardModal).toHaveClass("newdashboard");
});

test("Dashboard Selector changing when editing, true confirm", async () => {
  mockedConfirm.mockResolvedValue(true);

  render(
    <AppContext.Provider value={"csrf"}>
      <VariableInputsContextProvider>
        <SelectedDashboardContextProvider>
          <AvailableDashboardsContextProvider>
            <EditingContextProvider>
              <TestingComponent />
            </EditingContextProvider>
          </AvailableDashboardsContextProvider>
        </SelectedDashboardContextProvider>
      </VariableInputsContextProvider>
    </AppContext.Provider>
  );

  expect(await screen.findByText("Select/Add Dashboard:")).toBeInTheDocument();
  const selector = await screen.findByRole("combobox");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(selector);
  });

  const userOption = await screen.findByText("test_label");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(userOption);
  });
  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({
      name: "editable",
      label: "test_label",
      access_groups: [],
      notes: "test_notes",
      gridItems: [
        {
          i: "1",
          x: 0,
          y: 0,
          w: 20,
          h: 20,
          source: "",
          args_string: "{}",
          metadata_string: JSON.stringify({
            refreshRate: 0,
          }),
        },
      ],
      editable: true,
    })
  );
  expect(await screen.findByTestId("selected-dropdown")).toHaveTextContent(
    JSON.stringify({
      value: "editable",
      label: "test_label",
    })
  );

  const editButton = screen.getByLabelText("editButton");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(editButton);
  });

  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(selector);
  });

  const publicOption = await screen.findByText("test_label2");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(publicOption);
  });
  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({
      name: "noneditable",
      label: "test_label2",
      access_groups: ["public"],
      notes: "test_notes2",
      gridItems: [
        {
          i: "1",
          x: 0,
          y: 0,
          w: 20,
          h: 20,
          source: "",
          args_string: "{}",
          metadata_string: JSON.stringify({
            refreshRate: 0,
          }),
        },
      ],
      editable: false,
    })
  );
  expect(await screen.findByTestId("selected-dropdown")).toHaveTextContent(
    JSON.stringify({
      value: "noneditable",
      label: "test_label2",
    })
  );
});

test("Dashboard Selector changing when editing, false confirm", async () => {
  mockedConfirm.mockResolvedValue(false);

  render(
    <AppContext.Provider value={"csrf"}>
      <VariableInputsContextProvider>
        <SelectedDashboardContextProvider>
          <AvailableDashboardsContextProvider>
            <EditingContextProvider>
              <TestingComponent />
            </EditingContextProvider>
          </AvailableDashboardsContextProvider>
        </SelectedDashboardContextProvider>
      </VariableInputsContextProvider>
    </AppContext.Provider>
  );

  expect(await screen.findByText("Select/Add Dashboard:")).toBeInTheDocument();
  const selector = await screen.findByRole("combobox");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(selector);
  });

  const userOption = await screen.findByText("test_label");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(userOption);
  });
  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({
      name: "editable",
      label: "test_label",
      access_groups: [],
      notes: "test_notes",
      gridItems: [
        {
          i: "1",
          x: 0,
          y: 0,
          w: 20,
          h: 20,
          source: "",
          args_string: "{}",
          metadata_string: JSON.stringify({
            refreshRate: 0,
          }),
        },
      ],
      editable: true,
    })
  );
  expect(await screen.findByTestId("selected-dropdown")).toHaveTextContent(
    JSON.stringify({
      value: "editable",
      label: "test_label",
    })
  );

  const editButton = screen.getByLabelText("editButton");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(editButton);
  });

  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(selector);
  });

  const publicOption = await screen.findByText("test_label2");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(publicOption);
  });
  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({
      name: "editable",
      label: "test_label",
      access_groups: [],
      notes: "test_notes",
      gridItems: [
        {
          i: "1",
          x: 0,
          y: 0,
          w: 20,
          h: 20,
          source: "",
          args_string: "{}",
          metadata_string: JSON.stringify({
            refreshRate: 0,
          }),
        },
      ],
      editable: true,
    })
  );
  expect(await screen.findByTestId("selected-dropdown")).toHaveTextContent(
    JSON.stringify({
      value: "editable",
      label: "test_label",
    })
  );
});

test("Dashboard Selector add and then cancel button", async () => {
  const copiedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  copiedMockedDashboards.editable = {
    id: 1,
    name: "editable",
    label: "test_label",
    notes: "test_notes",
    editable: true,
    access_groups: [],
    gridItems: [
      {
        i: "2",
        x: 0,
        y: 0,
        w: 20,
        h: 20,
        source: "",
        args_string: "{}",
        metadata_string: JSON.stringify({
          refreshRate: 0,
        }),
      },
      {
        i: "1",
        x: 0,
        y: 0,
        w: 20,
        h: 20,
        source: "",
        args_string: "{}",
        metadata_string: JSON.stringify({
          refreshRate: 0,
        }),
      },
      {
        i: "3",
        x: 0,
        y: 0,
        w: 20,
        h: 20,
        source: "",
        args_string: "{}",
        metadata_string: JSON.stringify({
          refreshRate: 0,
        }),
      },
    ],
  };

  appAPI.getDashboards = () => {
    return Promise.resolve(copiedMockedDashboards);
  };

  render(
    <AppContext.Provider value={"csrf"}>
      <VariableInputsContextProvider>
        <SelectedDashboardContextProvider>
          <AvailableDashboardsContextProvider>
            <EditingContextProvider>
              <TestingComponent />
            </EditingContextProvider>
          </AvailableDashboardsContextProvider>
        </SelectedDashboardContextProvider>
      </VariableInputsContextProvider>
    </AppContext.Provider>
  );

  expect(await screen.findByText("Select/Add Dashboard:")).toBeInTheDocument();
  const selector = await screen.findByRole("combobox");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(selector);
  });

  const userOption = await screen.findByText("test_label");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(userOption);
  });

  const editButton = screen.getByLabelText("editButton");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(editButton);
  });

  const addGridItemButton = screen.getByLabelText("addGridItemButton");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(addGridItemButton);
  });
  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({
      name: "editable",
      label: "test_label",
      access_groups: [],
      notes: "test_notes",
      gridItems: [
        {
          i: "2",
          x: 0,
          y: 0,
          w: 20,
          h: 20,
          source: "",
          args_string: "{}",
          metadata_string: JSON.stringify({
            refreshRate: 0,
          }),
        },
        {
          i: "1",
          x: 0,
          y: 0,
          w: 20,
          h: 20,
          source: "",
          args_string: "{}",
          metadata_string: JSON.stringify({
            refreshRate: 0,
          }),
        },
        {
          i: "3",
          x: 0,
          y: 0,
          w: 20,
          h: 20,
          source: "",
          args_string: "{}",
          metadata_string: JSON.stringify({
            refreshRate: 0,
          }),
        },
        {
          i: "4",
          x: 0,
          y: 0,
          w: 20,
          h: 20,
          source: "",
          args_string: "{}",
          metadata_string: JSON.stringify({
            refreshRate: 0,
          }),
        },
      ],
      editable: true,
    })
  );

  const cancelButton = screen.getByLabelText("cancelButton");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(cancelButton);
  });
  expect(await screen.findByTestId("layout-context")).toHaveTextContent(
    JSON.stringify({
      name: "editable",
      label: "test_label",
      access_groups: [],
      notes: "test_notes",
      gridItems: [
        {
          i: "2",
          x: 0,
          y: 0,
          w: 20,
          h: 20,
          source: "",
          args_string: "{}",
          metadata_string: JSON.stringify({
            refreshRate: 0,
          }),
        },
        {
          i: "1",
          x: 0,
          y: 0,
          w: 20,
          h: 20,
          source: "",
          args_string: "{}",
          metadata_string: JSON.stringify({
            refreshRate: 0,
          }),
        },
        {
          i: "3",
          x: 0,
          y: 0,
          w: 20,
          h: 20,
          source: "",
          args_string: "{}",
          metadata_string: JSON.stringify({
            refreshRate: 0,
          }),
        },
      ],
      editable: true,
    })
  );
  expect(screen.getByLabelText("editButton")).toBeInTheDocument();
  expect(screen.queryByLabelText("cancelButton")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("saveButton")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("addGridItemButton")).not.toBeInTheDocument();
});

TestingComponent.propTypes = {
  initialDashboard: PropTypes.string,
};

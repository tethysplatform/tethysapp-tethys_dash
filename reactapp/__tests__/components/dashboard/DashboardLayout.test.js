import { useEffect } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import DashboardLayout from "components/dashboard/DashboardLayout";
import {
  mockedDashboards,
  updatedDashboard,
} from "__tests__/utilities/constants";
import SelectedDashboardContextProvider, {
  useLayoutContext,
  useLayoutGridItemsContext,
} from "components/contexts/SelectedDashboardContext";
import VariableInputsContextProvider from "components/contexts/VariableInputsContext";
import LayoutAlertContextProvider from "components/contexts/LayoutAlertContext";
import AvailableDashboardsContextProvider from "components/contexts/AvailableDashboardsContext";
import RoutesContextProvider from "components/contexts/RoutesContext";
import { AppContext } from "components/contexts/AppContext";
import EditingContextProvider, {
  useEditingContext,
} from "components/contexts/EditingContext";
import {
  useLayoutSuccessAlertContext,
  useLayoutErrorAlertContext,
} from "components/contexts/LayoutAlertContext";
import appAPI from "services/api/app";
import PropTypes from "prop-types";

appAPI.getDashboards = () => {
  return Promise.resolve(mockedDashboards);
};
// eslint-disable-next-line
jest.mock("components/dashboard/DashboardItem", () => (props) => (
  <>
    <button data-testid="test-submit" type="submit" form="gridUpdate" />
    <br></br>
    <br></br>
  </>
));

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const TestingComponent = (props) => {
  const { setLayoutContext } = useLayoutContext();
  const { gridItems } = useLayoutGridItemsContext();
  const { isEditing, setIsEditing } = useEditingContext();
  const { successMessage, showSuccessMessage } = useLayoutSuccessAlertContext();
  const { errorMessage, showErrorMessage } = useLayoutErrorAlertContext();

  useEffect(() => {
    setLayoutContext(props.layoutContext);
    if (props.editing) {
      setIsEditing(props.editing);
    }
    // eslint-disable-next-line
  }, []);

  return (
    <>
      <DashboardLayout />
      <p data-testid="grid-items">{JSON.stringify(gridItems)}</p>
      <p>{showSuccessMessage && successMessage}</p>
      <p>{showErrorMessage && errorMessage}</p>
      <p>{isEditing ? "yes editing" : "not editing"}</p>
    </>
  );
};

test("Dashboard Layout resize and update layout", async () => {
  const mockedDashboard = {
    id: 1,
    name: "editable",
    label: "test_label",
    notes: "test_notes",
    editable: true,
    access_groups: [],
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
  };

  const { container } = render(
    <AppContext.Provider value={"csrf"}>
      <RoutesContextProvider>
        <VariableInputsContextProvider>
          <SelectedDashboardContextProvider>
            <AvailableDashboardsContextProvider>
              <EditingContextProvider>
                <LayoutAlertContextProvider>
                  <TestingComponent
                    editing={true}
                    layoutContext={mockedDashboard}
                  />
                </LayoutAlertContextProvider>
              </EditingContextProvider>
            </AvailableDashboardsContextProvider>
          </SelectedDashboardContextProvider>
        </VariableInputsContextProvider>
      </RoutesContextProvider>
    </AppContext.Provider>
  );

  // eslint-disable-next-line
  const resizeSpan = container.querySelector(".react-resizable-handle");
  expect(resizeSpan).toBeInTheDocument();
  fireEvent.mouseDown(resizeSpan, { clientX: 0, clientY: 0 });
  fireEvent.mouseMove(resizeSpan, { clientX: 100, clientY: 0 });
  fireEvent.mouseUp(resizeSpan);

  await sleep(1);
  expect(
    await screen.findByText(
      JSON.stringify([
        {
          args_string: "{}",
          h: 20,
          i: "1",
          source: "",
          metadata_string: JSON.stringify({
            refreshRate: 0,
          }),
          w: 28,
          x: 0,
          y: 0,
        },
      ])
    )
  ).toBeInTheDocument();
});

test("Dashboard Layout submit changes not editing", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  const mockUpdateDashboard = jest.fn();

  appAPI.updateDashboard = mockUpdateDashboard;

  render(
    <AppContext.Provider value={"csrf"}>
      <RoutesContextProvider>
        <VariableInputsContextProvider>
          <SelectedDashboardContextProvider>
            <AvailableDashboardsContextProvider>
              <EditingContextProvider>
                <LayoutAlertContextProvider>
                  <TestingComponent
                    editing={false}
                    layoutContext={mockedDashboard}
                  />
                </LayoutAlertContextProvider>
              </EditingContextProvider>
            </AvailableDashboardsContextProvider>
          </SelectedDashboardContextProvider>
        </VariableInputsContextProvider>
      </RoutesContextProvider>
    </AppContext.Provider>
  );

  const submitButton = screen.getByTestId("test-submit");
  fireEvent.click(submitButton);

  expect(mockUpdateDashboard).not.toHaveBeenCalled();
});

test("Dashboard Layout submit changes success", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  const newUpdatedDashboard = updatedDashboard;
  newUpdatedDashboard.label = "test_label";
  const mockUpdateDashboard = jest.fn().mockResolvedValue({
    success: true,
    updated_dashboard: newUpdatedDashboard,
  });
  appAPI.updateDashboard = mockUpdateDashboard;

  render(
    <AppContext.Provider value={"csrf"}>
      <RoutesContextProvider>
        <VariableInputsContextProvider>
          <SelectedDashboardContextProvider>
            <AvailableDashboardsContextProvider>
              <EditingContextProvider>
                <LayoutAlertContextProvider>
                  <TestingComponent
                    editing={true}
                    layoutContext={mockedDashboard}
                  />
                </LayoutAlertContextProvider>
              </EditingContextProvider>
            </AvailableDashboardsContextProvider>
          </SelectedDashboardContextProvider>
        </VariableInputsContextProvider>
      </RoutesContextProvider>
    </AppContext.Provider>
  );

  const submitButton = screen.getByTestId("test-submit");
  fireEvent.click(submitButton);

  expect(
    await screen.findByText("Change have been saved.")
  ).toBeInTheDocument();
  expect(await screen.findByText("not editing")).toBeInTheDocument();
});

test("Dashboard Layout submit changes fail", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  const mockUpdateDashboard = jest.fn().mockResolvedValue({
    success: false,
  });
  appAPI.updateDashboard = mockUpdateDashboard;

  render(
    <AppContext.Provider value={"csrf"}>
      <RoutesContextProvider>
        <VariableInputsContextProvider>
          <SelectedDashboardContextProvider>
            <AvailableDashboardsContextProvider>
              <EditingContextProvider>
                <LayoutAlertContextProvider>
                  <TestingComponent
                    editing={true}
                    layoutContext={mockedDashboard}
                  />
                </LayoutAlertContextProvider>
              </EditingContextProvider>
            </AvailableDashboardsContextProvider>
          </SelectedDashboardContextProvider>
        </VariableInputsContextProvider>
      </RoutesContextProvider>
    </AppContext.Provider>
  );

  const submitButton = screen.getByTestId("test-submit");
  fireEvent.click(submitButton);

  expect(
    await screen.findByText(
      "Failed to save changes. Check server logs for more information."
    )
  ).toBeInTheDocument();
  expect(await screen.findByText("yes editing")).toBeInTheDocument();
});

test("Dashboard Layout resize and enforce aspect ratio but no aspect ratio", async () => {
  const mockedDashboard = {
    id: 1,
    name: "editable",
    label: "test_label",
    notes: "test_notes",
    editable: true,
    access_groups: [],
    gridItems: [
      {
        i: "1",
        x: 0,
        y: 0,
        w: 20,
        h: 20,
        source: "",
        args_string: "{}",
        metadata_string: JSON.stringify({ enforceAspectRatio: true }),
      },
    ],
  };

  const { container } = render(
    <AppContext.Provider value={"csrf"}>
      <RoutesContextProvider>
        <VariableInputsContextProvider>
          <SelectedDashboardContextProvider>
            <AvailableDashboardsContextProvider>
              <EditingContextProvider>
                <LayoutAlertContextProvider>
                  <TestingComponent
                    editing={true}
                    layoutContext={mockedDashboard}
                  />
                </LayoutAlertContextProvider>
              </EditingContextProvider>
            </AvailableDashboardsContextProvider>
          </SelectedDashboardContextProvider>
        </VariableInputsContextProvider>
      </RoutesContextProvider>
    </AppContext.Provider>
  );

  // eslint-disable-next-line
  const resizeSpan = container.querySelector(".react-resizable-handle");
  expect(resizeSpan).toBeInTheDocument();
  fireEvent.mouseDown(resizeSpan, { clientX: 0, clientY: 0 });
  fireEvent.mouseMove(resizeSpan, { clientX: 100, clientY: 0 });
  fireEvent.mouseUp(resizeSpan);

  await sleep(1);
  expect(
    await screen.findByText(
      JSON.stringify([
        {
          args_string: "{}",
          h: 20,
          i: "1",
          source: "",
          metadata_string: JSON.stringify({ enforceAspectRatio: true }),
          w: 28,
          x: 0,
          y: 0,
        },
      ])
    )
  ).toBeInTheDocument();
});

test("Dashboard Layout resize and enforce aspect ratio", async () => {
  const mockedDashboard = {
    id: 1,
    name: "editable",
    label: "test_label",
    notes: "test_notes",
    editable: true,
    access_groups: [],
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
          enforceAspectRatio: true,
          aspectRatio: 2,
        }),
      },
    ],
  };

  const { container } = render(
    <AppContext.Provider value={"csrf"}>
      <RoutesContextProvider>
        <VariableInputsContextProvider>
          <SelectedDashboardContextProvider>
            <AvailableDashboardsContextProvider>
              <EditingContextProvider>
                <LayoutAlertContextProvider>
                  <TestingComponent
                    editing={true}
                    layoutContext={mockedDashboard}
                  />
                </LayoutAlertContextProvider>
              </EditingContextProvider>
            </AvailableDashboardsContextProvider>
          </SelectedDashboardContextProvider>
        </VariableInputsContextProvider>
      </RoutesContextProvider>
    </AppContext.Provider>
  );

  // eslint-disable-next-line
  const resizeSpan = container.querySelector(".react-resizable-handle");
  expect(resizeSpan).toBeInTheDocument();
  fireEvent.mouseDown(resizeSpan, { clientX: 0, clientY: 0 });
  fireEvent.mouseMove(resizeSpan, { clientX: 100, clientY: 0 });
  fireEvent.mouseUp(resizeSpan);

  await sleep(1);
  expect(
    await screen.findByText(
      JSON.stringify([
        {
          args_string: "{}",
          h: 14,
          i: "1",
          source: "",
          metadata_string: JSON.stringify({
            enforceAspectRatio: true,
            aspectRatio: 2,
          }),
          w: 28,
          x: 0,
          y: 0,
        },
      ])
    )
  ).toBeInTheDocument();

  fireEvent.mouseDown(resizeSpan, { clientX: 0, clientY: 0 });
  fireEvent.mouseMove(resizeSpan, { clientX: 0, clientY: 100 });
  fireEvent.mouseUp(resizeSpan);

  await sleep(1);
  expect(
    await screen.findByText(
      JSON.stringify([
        {
          args_string: "{}",
          h: 24,
          i: "1",
          source: "",
          metadata_string: JSON.stringify({
            enforceAspectRatio: true,
            aspectRatio: 2,
          }),
          w: 48,
          x: 0,
          y: 0,
        },
      ])
    )
  ).toBeInTheDocument();
});

TestingComponent.propTypes = {
  editing: PropTypes.bool,
  layoutContext: PropTypes.object,
};

import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import NewDashboardModal from "components/modals/NewDashboard";
import createLoadedComponent from "__tests__/utilities/customRender";
import appAPI from "services/api/app";
import { AppTourContext } from "components/contexts/Contexts";
import { server } from "__tests__/utilities/server";
import { rest } from "msw";

const TestingComponent = () => {
  const [showModal, setShowModal] = useState(true);

  return (
    <NewDashboardModal showModal={showModal} setShowModal={setShowModal} />
  );
};

test("New Dashboard Modal add dashboard success", async () => {
  server.use(
    rest.post(
      "http://api.test/apps/tethysdash/dashboards/add/",
      (req, res, ctx) => {
        return res(
          ctx.delay(500),
          ctx.status(200),
          ctx.json({
            success: true,
            new_dashboard: {
              id: 1,
              name: "editable_copy",
              label: "test_label Copy",
              notes: "test_notes",
              editable: true,
              accessGroups: [],
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
            },
          }),
          ctx.set("Content-Type", "application/json")
        );
      }
    )
  );

  render(
    createLoadedComponent({
      children: <TestingComponent />,
    })
  );

  expect(await screen.findByText("Create a new dashboard")).toBeInTheDocument();
  expect(await screen.findByText("Name")).toBeInTheDocument();

  const dashboardNameInput = await screen.findByLabelText("Name Input");
  fireEvent.change(dashboardNameInput, { target: { value: "new_name" } });

  const createDashboardInput = await screen.findByLabelText(
    "Create Dashboard Button"
  );
  expect(screen.getByText("Create")).toBeInTheDocument();
  await userEvent.click(createDashboardInput);

  expect(
    await screen.findByText(
      "All inputs must be filled out for creating a dashboard."
    )
  ).toBeInTheDocument();

  const descriptionInput = await screen.findByLabelText("Description Input");
  fireEvent.change(descriptionInput, { target: { value: "some description" } });
  expect(createDashboardInput).not.toBeDisabled();
  await userEvent.click(createDashboardInput);

  await waitFor(() => {
    expect(screen.getByText("Creating...")).toBeInTheDocument();
  });
  expect(createDashboardInput).toBeDisabled();

  await waitFor(() => {
    expect(
      screen.queryByText("Create a new dashboard")
    ).not.toBeInTheDocument();
  });
});

test("New Dashboard Modal add dashboard success with app tour", async () => {
  const mockAddDashboard = jest.fn();
  appAPI.addDashboard = mockAddDashboard;
  mockAddDashboard.mockResolvedValue({
    success: true,
    new_dashboard: {
      id: 1,
      name: "editable_copy",
      label: "test_label Copy",
      notes: "test_notes",
      editable: true,
      accessGroups: [],
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
    },
  });
  const mockSetAppTourStep = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <AppTourContext.Provider
          value={{
            setAppTourStep: mockSetAppTourStep,
            activeAppTour: true,
          }}
        >
          <TestingComponent />
        </AppTourContext.Provider>
      ),
    })
  );

  expect(await screen.findByText("Create a new dashboard")).toBeInTheDocument();
  expect(await screen.findByText("Name")).toBeInTheDocument();

  const dashboardNameInput = await screen.findByLabelText("Name Input");
  fireEvent.change(dashboardNameInput, { target: { value: "new_name" } });

  const createDashboardInput = await screen.findByLabelText(
    "Create Dashboard Button"
  );
  await userEvent.click(createDashboardInput);
  expect(
    await screen.findByText(
      "All inputs must be filled out for creating a dashboard."
    )
  ).toBeInTheDocument();

  const descriptionInput = await screen.findByLabelText("Description Input");
  fireEvent.change(descriptionInput, { target: { value: "some description" } });
  await userEvent.click(createDashboardInput);

  await waitFor(() => {
    expect(
      screen.queryByText("Create a new dashboard")
    ).not.toBeInTheDocument();
  });

  await waitFor(() =>
    expect(mockSetAppTourStep).toHaveBeenCalledWith(expect.any(Function))
  );
});

test("New Dashboard Modal add dashboard fail", async () => {
  const mockAddDashboard = jest.fn();
  appAPI.addDashboard = mockAddDashboard;
  mockAddDashboard.mockResolvedValue({
    success: false,
    message: "failed to add",
  });

  render(
    createLoadedComponent({
      children: <TestingComponent />,
    })
  );

  expect(await screen.findByText("Create a new dashboard")).toBeInTheDocument();
  expect(await screen.findByText("Name")).toBeInTheDocument();
  expect(await screen.findByText("Description")).toBeInTheDocument();

  const dashboardNameInput = await screen.findByLabelText("Name Input");
  fireEvent.change(dashboardNameInput, { target: { value: "new_name" } });

  const descriptionInput = await screen.findByLabelText("Description Input");
  fireEvent.change(descriptionInput, { target: { value: "some description" } });

  const createDashboardInput = await screen.findByLabelText(
    "Create Dashboard Button"
  );
  await userEvent.click(createDashboardInput);
  expect(await screen.findByText("failed to add")).toBeInTheDocument();

  const closeModalButton = await screen.findByLabelText("Close Modal Button");
  await userEvent.click(closeModalButton);
  await waitFor(() => {
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

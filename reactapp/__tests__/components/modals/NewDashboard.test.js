import { act, useState } from "react";
import userEvent from "@testing-library/user-event";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import NewDashboardModal from "components/modals/NewDashboard";
import renderWithLoaders, {
  EditingPComponent,
} from "__tests__/utilities/customRender";
import appAPI from "services/api/app";

const TestingComponent = () => {
  const [showModal, setShowModal] = useState(true);

  return (
    <>
      <NewDashboardModal showModal={showModal} setShowModal={setShowModal} />
      <EditingPComponent />
    </>
  );
};

test("New Dashboard Modal add dashboard success", async () => {
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

  renderWithLoaders({
    children: <TestingComponent />,
  });

  expect(await screen.findByText("Create a new dashboard")).toBeInTheDocument();
  expect(await screen.findByText("Dashboard Name")).toBeInTheDocument();

  const dashboardNameInput = await screen.findByLabelText(
    "Dashboard Name Input"
  );
  fireEvent.change(dashboardNameInput, { target: { value: "new_name" } });

  const createDashboardInput = await screen.findByLabelText(
    "Create Dashboard Button"
  );
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(createDashboardInput);
  });
  expect(screen.queryByText("Create a new dashboard")).not.toBeInTheDocument();
  expect(await screen.findByTestId("editing")).toHaveTextContent("editing");
});

test("New Dashboard Modal add dashboard fail", async () => {
  const mockAddDashboard = jest.fn();
  appAPI.addDashboard = mockAddDashboard;
  mockAddDashboard.mockResolvedValue({
    success: false,
    message: "failed to add",
  });

  renderWithLoaders({
    children: <TestingComponent />,
  });

  expect(await screen.findByText("Create a new dashboard")).toBeInTheDocument();
  expect(await screen.findByText("Dashboard Name")).toBeInTheDocument();

  const dashboardNameInput = await screen.findByLabelText(
    "Dashboard Name Input"
  );
  fireEvent.change(dashboardNameInput, { target: { value: "new_name" } });

  const createDashboardInput = await screen.findByLabelText(
    "Create Dashboard Button"
  );
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(createDashboardInput);
  });
  expect(await screen.findByText("failed to add")).toBeInTheDocument();

  const closeModalButton = await screen.findByLabelText("Close Modal Button");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(closeModalButton);
  });
  await waitFor(() => {
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

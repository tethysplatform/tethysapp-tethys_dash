import { useState, act } from "react";
import userEvent from "@testing-library/user-event";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DashboardEditorCanvas from "components/modals/DashboardEditor";
import {
  publicDashboard,
  updatedDashboard,
  userDashboard,
} from "__tests__/utilities/constants";
import { confirm } from "components/inputs/DeleteConfirmation";
import createLoadedComponent, {
  EditingPComponent,
} from "__tests__/utilities/customRender";
import appAPI from "services/api/app";
import { MemoryRouter } from "react-router-dom";
import { useNavigate } from "react-router-dom";

jest.mock("components/inputs/DeleteConfirmation", () => {
  return {
    confirm: jest.fn(),
  };
});
const mockedConfirm = jest.mocked(confirm);

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: jest.fn(),
}));

const { matchMedia } = window;

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // deprecated
      removeListener: jest.fn(), // deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
});

afterEach(() => {
  window.matchMedia = matchMedia;
  jest.restoreAllMocks();
});

const TestingComponent = () => {
  const [showCanvas, setShowCanvas] = useState(true);

  return (
    <MemoryRouter initialEntries={[`/dashboard/${userDashboard.uuid}`]}>
      <DashboardEditorCanvas
        showCanvas={showCanvas}
        setShowCanvas={setShowCanvas}
      />
      <EditingPComponent />
      <p>{showCanvas ? "yes show canvas" : "not show canvas"}</p>
    </MemoryRouter>
  );
};

test("Dashboard Editor Canvas edit and save", async () => {
  const navigateMock = jest.fn();
  useNavigate.mockReturnValue(navigateMock);
  const mockUpdateDashboard = jest.fn();

  mockUpdateDashboard.mockResolvedValue({
    success: true,
    updated_dashboard: updatedDashboard,
  });

  jest.spyOn(appAPI, "updateDashboard").mockImplementation(mockUpdateDashboard);

  render(
    createLoadedComponent({
      children: <TestingComponent />,
      options: {
        initialDashboard: userDashboard,
      },
    })
  );

  const unrestrictedPlacement = await screen.findByLabelText("On");
  fireEvent.click(unrestrictedPlacement);

  const descriptionInput = await screen.findByLabelText("Description Input");
  fireEvent.change(descriptionInput, { target: { value: "New Description" } });

  const nameInput = await screen.findByLabelText("Name Input");
  fireEvent.change(nameInput, { target: { value: "new_name" } });

  const textEditor = await screen.findByLabelText("textEditor");
  // eslint-disable-next-line
  await act(() => {
    fireEvent.input(textEditor, {
      target: {
        innerHTML: "<p>Hello world!</p>",
      },
    });
  });
  expect(await screen.findByText("Hello world!")).toBeInTheDocument();

  const saveButton = await screen.findByLabelText("Save Dashboard Button");
  await userEvent.click(saveButton);
  expect(mockUpdateDashboard).toHaveBeenCalledWith(
    {
      name: "new_name",
      description: "New Description",
      id: 1,
      notes: "<p>Hello world!</p>",
      unrestrictedPlacement: true,
    },
    "SxICmOkFldX4o4YVaySdZq9sgn0eRd3Ih6uFtY8BgU5tMyZc7n90oJ4M2My5i7cy"
  );
  expect(
    await screen.findByText("Successfully updated dashboard settings")
  ).toBeInTheDocument();

  const closeAlertButton = await screen.findByLabelText("Close alert");
  fireEvent.click(closeAlertButton);
  expect(
    screen.queryByText("Successfully updated dashboard settings")
  ).not.toBeInTheDocument();

  expect(navigateMock).toHaveBeenCalledTimes(0);

  const closeButton = screen.getByLabelText("Close");
  await userEvent.click(closeButton);

  await waitFor(() => {
    expect(screen.queryByText("Dashboard Settings")).not.toBeInTheDocument();
  });
});

test("Dashboard Editor Canvas edit desription only and save", async () => {
  const navigateMock = jest.fn();
  useNavigate.mockReturnValue(navigateMock);
  const mockUpdateDashboard = jest.fn();

  mockUpdateDashboard.mockResolvedValue({
    success: true,
    updated_dashboard: updatedDashboard,
  });

  jest.spyOn(appAPI, "updateDashboard").mockImplementation(mockUpdateDashboard);

  render(
    createLoadedComponent({
      children: <TestingComponent />,
      options: {
        initialDashboard: userDashboard,
      },
    })
  );

  const descriptionInput = await screen.findByLabelText("Description Input");
  fireEvent.change(descriptionInput, { target: { value: "New Description" } });

  const textEditor = await screen.findByLabelText("textEditor");
  // eslint-disable-next-line
  await act(() => {
    fireEvent.input(textEditor, {
      target: {
        innerHTML: "<p>Hello world!</p>",
      },
    });
  });
  expect(await screen.findByText("Hello world!")).toBeInTheDocument();

  const saveButton = await screen.findByLabelText("Save Dashboard Button");
  await userEvent.click(saveButton);
  expect(mockUpdateDashboard).toHaveBeenCalledWith(
    {
      name: "User Dashboard",
      description: "New Description",
      id: 1,
      notes: "<p>Hello world!</p>",
      unrestrictedPlacement: false,
    },
    "SxICmOkFldX4o4YVaySdZq9sgn0eRd3Ih6uFtY8BgU5tMyZc7n90oJ4M2My5i7cy"
  );
  expect(
    await screen.findByText("Successfully updated dashboard settings")
  ).toBeInTheDocument();

  const closeAlertButton = await screen.findByLabelText("Close alert");
  fireEvent.click(closeAlertButton);
  expect(
    screen.queryByText("Successfully updated dashboard settings")
  ).not.toBeInTheDocument();

  expect(navigateMock).toHaveBeenCalledTimes(0);
});

test("Dashboard Editor Canvas edit and save fail without message", async () => {
  const mockUpdateDashboard = jest.fn();

  mockUpdateDashboard.mockResolvedValue({ success: false });

  jest.spyOn(appAPI, "updateDashboard").mockImplementation(mockUpdateDashboard);

  render(
    createLoadedComponent({
      children: <TestingComponent />,
      options: {
        initialDashboard: userDashboard,
      },
    })
  );

  const descriptionInput = await screen.findByLabelText("Description Input");
  fireEvent.change(descriptionInput, { target: { value: "New Description" } });

  const saveButton = await screen.findByLabelText("Save Dashboard Button");
  await userEvent.click(saveButton);
  expect(mockUpdateDashboard).toHaveBeenCalledWith(
    {
      name: "User Dashboard",
      description: "New Description",
      id: 1,
      notes: "user_notes",
      unrestrictedPlacement: false,
    },
    "SxICmOkFldX4o4YVaySdZq9sgn0eRd3Ih6uFtY8BgU5tMyZc7n90oJ4M2My5i7cy"
  );
  expect(
    await screen.findByText(
      "Failed to update dashboard settings. Check server logs."
    )
  ).toBeInTheDocument();
});

test("Dashboard Editor Canvas edit and save fail with message", async () => {
  const mockUpdateDashboard = jest.fn();

  mockUpdateDashboard.mockResolvedValue({
    success: false,
    message: "failed to update",
  });

  jest.spyOn(appAPI, "updateDashboard").mockImplementation(mockUpdateDashboard);

  render(
    createLoadedComponent({
      children: <TestingComponent />,
      options: {
        initialDashboard: userDashboard,
      },
    })
  );

  const descriptionInput = await screen.findByLabelText("Description Input");
  fireEvent.change(descriptionInput, { target: { value: "New Description" } });

  const saveButton = await screen.findByLabelText("Save Dashboard Button");
  await userEvent.click(saveButton);
  expect(mockUpdateDashboard).toHaveBeenCalledWith(
    {
      name: "User Dashboard",
      description: "New Description",
      id: 1,
      notes: "user_notes",
      unrestrictedPlacement: false,
    },
    "SxICmOkFldX4o4YVaySdZq9sgn0eRd3Ih6uFtY8BgU5tMyZc7n90oJ4M2My5i7cy"
  );
  expect(await screen.findByText("failed to update")).toBeInTheDocument();
});

test("Dashboard Editor Canvas delete success", async () => {
  const navigateMock = jest.fn();
  useNavigate.mockReturnValue(navigateMock);
  const mockDeleteDashboard = jest.fn();

  mockDeleteDashboard.mockResolvedValue({
    success: true,
  });
  jest.spyOn(appAPI, "deleteDashboard").mockImplementation(mockDeleteDashboard);
  mockedConfirm.mockResolvedValue(true);

  render(
    createLoadedComponent({
      children: <TestingComponent />,
      options: {
        initialDashboard: userDashboard,
      },
    })
  );

  const deleteButton = await screen.findByLabelText("Delete Dashboard Button");
  await userEvent.click(deleteButton);
  expect(mockDeleteDashboard).toHaveBeenCalled();

  expect(navigateMock).toHaveBeenCalledWith("/");
});

test("Dashboard Editor Canvas delete fail", async () => {
  const navigateMock = jest.fn();
  useNavigate.mockReturnValue(navigateMock);
  const mockDeleteDashboard = jest.fn();

  mockDeleteDashboard.mockResolvedValue({
    success: false,
  });
  jest.spyOn(appAPI, "deleteDashboard").mockImplementation(mockDeleteDashboard);
  mockedConfirm.mockResolvedValue(true);

  render(
    createLoadedComponent({
      children: <TestingComponent />,
      options: {
        initialDashboard: userDashboard,
      },
    })
  );

  const deleteButton = await screen.findByLabelText("Delete Dashboard Button");
  await userEvent.click(deleteButton);
  expect(mockDeleteDashboard).toHaveBeenCalled();
  expect(await screen.findByTestId("editing")).toHaveTextContent("editing");
  expect(await screen.findByText("yes show canvas")).toBeInTheDocument();
  expect(
    await screen.findByText("Failed to delete dashboard")
  ).toBeInTheDocument();

  const closeAlertButton = await screen.findByLabelText("Close alert");
  fireEvent.click(closeAlertButton);
  expect(
    screen.queryByText("Failed to adelete dashboard. Check server logs.")
  ).not.toBeInTheDocument();

  expect(navigateMock).toHaveBeenCalledTimes(0);
});

test("Dashboard Editor Canvas delete not confirm", async () => {
  const navigateMock = jest.fn();
  useNavigate.mockReturnValue(navigateMock);
  const mockDeleteDashboard = jest.fn();
  jest.spyOn(appAPI, "deleteDashboard").mockImplementation(mockDeleteDashboard);
  mockedConfirm.mockResolvedValue(false);

  render(
    createLoadedComponent({
      children: <TestingComponent />,
      options: {
        initialDashboard: userDashboard,
      },
    })
  );

  const deleteButton = await screen.findByLabelText("Delete Dashboard Button");
  await userEvent.click(deleteButton);
  expect(mockDeleteDashboard).not.toHaveBeenCalled();
  expect(await screen.findByTestId("editing")).toHaveTextContent("not editing");
  expect(await screen.findByText("yes show canvas")).toBeInTheDocument();

  expect(navigateMock).toHaveBeenCalledTimes(0);
});

test("Dashboard Editor Canvas copy and success", async () => {
  const navigateMock = jest.fn();
  useNavigate.mockReturnValue(navigateMock);
  const mockCopyDashboard = jest.fn();
  mockCopyDashboard.mockResolvedValue({
    success: true,
    new_dashboard: {
      id: 2,
      name: "editable_copy",
      description: "test_description",
      notes: "test_notes",
      editable: true,
      uuid: 123456789,
    },
  });
  jest.spyOn(appAPI, "copyDashboard").mockImplementation(mockCopyDashboard);
  mockedConfirm.mockResolvedValue(true);

  render(
    createLoadedComponent({
      children: <TestingComponent />,
      options: {
        initialDashboard: userDashboard,
      },
    })
  );

  const copyButton = await screen.findByLabelText("Copy Dashboard Button");
  await userEvent.click(copyButton);
  expect(mockCopyDashboard).toHaveBeenCalledWith(
    { id: userDashboard.id, newName: `${userDashboard.name} - Copy` },
    "SxICmOkFldX4o4YVaySdZq9sgn0eRd3Ih6uFtY8BgU5tMyZc7n90oJ4M2My5i7cy"
  );

  expect(navigateMock).toHaveBeenCalledWith("/dashboard/123456789");
});

test("Dashboard Editor Canvas copy and fail with message", async () => {
  const navigateMock = jest.fn();
  useNavigate.mockReturnValue(navigateMock);
  const mockCopyDashboard = jest.fn();
  mockCopyDashboard.mockResolvedValue({
    success: false,
    message: "failed to copy for some reason",
  });
  jest.spyOn(appAPI, "copyDashboard").mockImplementation(mockCopyDashboard);

  render(
    createLoadedComponent({
      children: <TestingComponent />,
      options: {
        initialDashboard: userDashboard,
      },
    })
  );

  const copyButton = await screen.findByLabelText("Copy Dashboard Button");
  await userEvent.click(copyButton);
  expect(mockCopyDashboard).toHaveBeenCalledWith(
    { id: userDashboard.id, newName: `${userDashboard.name} - Copy` },
    "SxICmOkFldX4o4YVaySdZq9sgn0eRd3Ih6uFtY8BgU5tMyZc7n90oJ4M2My5i7cy"
  );
  expect(
    await screen.findByText("failed to copy for some reason")
  ).toBeInTheDocument();
  expect(navigateMock).toHaveBeenCalledTimes(0);
});

test("Dashboard Editor Canvas copy and fail without message", async () => {
  const navigateMock = jest.fn();
  useNavigate.mockReturnValue(navigateMock);
  const mockCopyDashboard = jest.fn();
  mockCopyDashboard.mockResolvedValue({
    success: false,
  });
  jest.spyOn(appAPI, "copyDashboard").mockImplementation(mockCopyDashboard);
  mockedConfirm.mockResolvedValue(true);

  render(
    createLoadedComponent({
      children: <TestingComponent />,
      options: {
        initialDashboard: userDashboard,
      },
    })
  );

  const copyButton = await screen.findByLabelText("Copy Dashboard Button");
  await userEvent.click(copyButton);
  expect(mockCopyDashboard).toHaveBeenCalledWith(
    { id: userDashboard.id, newName: `${userDashboard.name} - Copy` },
    "SxICmOkFldX4o4YVaySdZq9sgn0eRd3Ih6uFtY8BgU5tMyZc7n90oJ4M2My5i7cy"
  );
  expect(
    await screen.findByText("Failed to copy dashboard")
  ).toBeInTheDocument();
  expect(navigateMock).toHaveBeenCalledTimes(0);
});

test("Dashboard Editor Canvas show permissions modal", async () => {
  const navigateMock = jest.fn();
  useNavigate.mockReturnValue(navigateMock);
  const mockDeleteDashboard = jest.fn();

  mockDeleteDashboard.mockResolvedValue({
    success: true,
  });
  jest.spyOn(appAPI, "deleteDashboard").mockImplementation(mockDeleteDashboard);
  mockedConfirm.mockResolvedValue(true);

  render(
    createLoadedComponent({
      children: <TestingComponent />,
      options: {
        initialDashboard: userDashboard,
      },
    })
  );

  const managePermissionsButton = await screen.findByLabelText(
    "Manage Dashboard Permissions Button"
  );
  await userEvent.click(managePermissionsButton);

  expect(await screen.findByText("Manage Permissions")).toBeInTheDocument();
});

test("Dashboard Editor Canvas non admin", async () => {
  render(
    createLoadedComponent({
      children: <TestingComponent />,
      options: {
        initialDashboard: publicDashboard,
      },
    })
  );

  expect(
    screen.queryByLabelText("Unrestricted Grid Item Placement")
  ).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Description Input")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Name Input")).not.toBeInTheDocument();
  expect(
    screen.queryByLabelText("Save Dashboard Button")
  ).not.toBeInTheDocument();
  expect(
    screen.queryByLabelText("Delete Dashboard Button")
  ).not.toBeInTheDocument();
  expect(
    await screen.findByLabelText("Copy Dashboard Button")
  ).toBeInTheDocument();
  expect(
    screen.queryByLabelText("Manage Dashboard Permissions Button")
  ).not.toBeInTheDocument();
  expect(screen.queryByLabelText("textEditor")).not.toBeInTheDocument();

  expect(screen.getByText(publicDashboard.name)).toBeInTheDocument();
  expect(screen.getByText(publicDashboard.description)).toBeInTheDocument();
  expect(screen.getByText(publicDashboard.notes)).toBeInTheDocument();
});

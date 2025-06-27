import { useState, act } from "react";
import userEvent from "@testing-library/user-event";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DashboardEditorCanvas from "components/modals/DashboardEditor";
import {
  mockedDashboards,
  updatedDashboard,
} from "__tests__/utilities/constants";
import { confirm } from "components/inputs/DeleteConfirmation";
import createLoadedComponent, {
  EditingPComponent,
} from "__tests__/utilities/customRender";
import appAPI from "services/api/app";
import { MemoryRouter } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { AppTourContext } from "components/contexts/Contexts";

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
    <MemoryRouter initialEntries={["/dashboard/user/editable"]}>
      <DashboardEditorCanvas
        showCanvas={showCanvas}
        setShowCanvas={setShowCanvas}
      />
      <EditingPComponent />
      <p>{showCanvas ? "yes show canvas" : "not show canvas"}</p>
    </MemoryRouter>
  );
};

test("Dashboard Editor Canvas editable dashboard change sharing status", async () => {
  render(
    createLoadedComponent({
      children: <TestingComponent />,
      options: {
        initialDashboard: mockedDashboards.user[0],
        editableDashboard: true,
      },
    })
  );

  expect(await screen.findByText("Dashboard Settings")).toBeInTheDocument();
  expect(await screen.findByText("Name")).toBeInTheDocument();
  expect(await screen.findByLabelText("Name Input")).toBeInTheDocument();
  expect(await screen.findByText("Description")).toBeInTheDocument();
  expect(await screen.findByLabelText("Description Input")).toBeInTheDocument();
  expect(await screen.findByText("Sharing Status")).toBeInTheDocument();
  expect(await screen.findByText("Notes")).toBeInTheDocument();
  expect(await screen.findByLabelText("textEditor")).toBeInTheDocument();
  expect(await screen.findByText("Close")).toBeInTheDocument();
  expect(await screen.findByText("Copy dashboard")).toBeInTheDocument();
  expect(await screen.findByText("Delete dashboard")).toBeInTheDocument();
  expect(await screen.findByText("Save changes")).toBeInTheDocument();

  const publicRadioButton = screen.getByLabelText("Public");
  const privateRadioButton = screen.getByLabelText("Private");
  expect(publicRadioButton).toBeInTheDocument();
  expect(privateRadioButton).toBeInTheDocument();

  expect(publicRadioButton).not.toBeChecked();
  expect(privateRadioButton).toBeChecked();
  expect(screen.queryByText("Public URL")).not.toBeInTheDocument();

  fireEvent.click(publicRadioButton);

  expect(publicRadioButton).toBeChecked();
  expect(privateRadioButton).not.toBeChecked();
  expect(await screen.findByText("Public URL")).toBeInTheDocument();
  expect(
    await screen.findByText(
      "http://api.test/apps/tethysdash/dashboard/public/editable"
    )
  ).toBeInTheDocument();
});

test("Dashboard Editor Canvas copy public url failed", async () => {
  render(
    createLoadedComponent({
      children: <TestingComponent />,
      options: {
        initialDashboard: mockedDashboards.public[0],
      },
    })
  );

  expect(await screen.findByText("Dashboard Settings")).toBeInTheDocument();
  expect(await screen.findByText("Name")).toBeInTheDocument();
  expect(screen.queryByLabelText("Name Input")).not.toBeInTheDocument();
  expect(await screen.findByText("Description")).toBeInTheDocument();
  expect(screen.queryByLabelText("Description Input")).not.toBeInTheDocument();
  expect(screen.queryByText("Sharing Status")).not.toBeInTheDocument();
  expect(await screen.findByText("Notes")).toBeInTheDocument();
  expect(screen.queryByLabelText("textEditor")).not.toBeInTheDocument();
  expect(await screen.findByText("Close")).toBeInTheDocument();
  expect(await screen.findByText("Copy dashboard")).toBeInTheDocument();
  expect(screen.queryByText("Delete dashboard")).not.toBeInTheDocument();
  expect(screen.queryByText("Save changes")).not.toBeInTheDocument();

  expect(screen.queryByLabelText("Public")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Private")).not.toBeInTheDocument();
  expect(await screen.findByText("Public URL")).toBeInTheDocument();
  expect(
    await screen.findByText(
      "http://api.test/apps/tethysdash/dashboard/public/noneditable"
    )
  ).toBeInTheDocument();

  const copyClipboardButton = await screen.findByLabelText(
    "Copy Clipboard Button"
  );
  expect(copyClipboardButton).toBeInTheDocument();
  fireEvent.click(copyClipboardButton);
  await userEvent.hover(copyClipboardButton);
  expect(await screen.findByRole("tooltip")).toHaveTextContent(
    "Failed to Copy"
  );
});

test("Dashboard Editor Canvas noneditable and copy public url", async () => {
  const mockWriteText = jest.fn();
  Object.defineProperty(navigator, "clipboard", {
    value: {
      writeText: mockWriteText,
    },
  });

  render(
    createLoadedComponent({
      children: <TestingComponent />,
      options: {
        initialDashboard: mockedDashboards.public[0],
      },
    })
  );

  expect(await screen.findByText("Dashboard Settings")).toBeInTheDocument();
  expect(await screen.findByText("Name")).toBeInTheDocument();
  expect(screen.queryByLabelText("Name Input")).not.toBeInTheDocument();
  expect(await screen.findByText("Description")).toBeInTheDocument();
  expect(screen.queryByLabelText("Description Input")).not.toBeInTheDocument();
  expect(screen.queryByText("Sharing Status")).not.toBeInTheDocument();
  expect(await screen.findByText("Notes")).toBeInTheDocument();
  expect(screen.queryByLabelText("textEditor")).not.toBeInTheDocument();
  expect(await screen.findByText("Close")).toBeInTheDocument();
  expect(await screen.findByText("Copy dashboard")).toBeInTheDocument();
  expect(screen.queryByText("Delete dashboard")).not.toBeInTheDocument();
  expect(screen.queryByText("Save changes")).not.toBeInTheDocument();

  expect(screen.queryByLabelText("Public")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Private")).not.toBeInTheDocument();
  expect(await screen.findByText("Public URL")).toBeInTheDocument();
  expect(
    await screen.findByText(
      "http://api.test/apps/tethysdash/dashboard/public/noneditable"
    )
  ).toBeInTheDocument();

  const copyClipboardButton = await screen.findByLabelText(
    "Copy Clipboard Button"
  );
  await userEvent.hover(copyClipboardButton);

  const tooltip = screen.getByRole("tooltip");
  expect(tooltip).toBeInTheDocument();
  expect(tooltip).toHaveTextContent("Copy to clipboard");
  expect(copyClipboardButton).toBeInTheDocument();
  fireEvent.click(copyClipboardButton);
  expect(mockWriteText).toHaveBeenCalledWith(
    "http://api.test/apps/tethysdash/dashboard/public/noneditable"
  );
  await userEvent.hover(copyClipboardButton);
  expect(screen.getByRole("tooltip")).toHaveTextContent("Copied");
});

test("Dashboard Editor Canvas edit and save", async () => {
  const navigateMock = jest.fn();
  useNavigate.mockReturnValue(navigateMock);
  const mockUpdateDashboard = jest.fn();

  mockUpdateDashboard.mockResolvedValue({
    success: true,
    updated_dashboard: updatedDashboard,
  });
  appAPI.updateDashboard = mockUpdateDashboard;

  render(
    createLoadedComponent({
      children: <TestingComponent />,
      options: {
        initialDashboard: mockedDashboards.user[0],
        editableDashboard: true,
      },
    })
  );

  const publicRadioButton = await screen.findByLabelText("Public");
  fireEvent.click(publicRadioButton);

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
      accessGroups: ["public"],
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

  expect(navigateMock).toHaveBeenCalledWith("/dashboard/user/new_name");
});

test("Dashboard Editor Canvas edit desription only and save", async () => {
  const navigateMock = jest.fn();
  useNavigate.mockReturnValue(navigateMock);
  const mockUpdateDashboard = jest.fn();

  mockUpdateDashboard.mockResolvedValue({
    success: true,
    updated_dashboard: updatedDashboard,
  });
  appAPI.updateDashboard = mockUpdateDashboard;

  render(
    createLoadedComponent({
      children: <TestingComponent />,
      options: {
        initialDashboard: mockedDashboards.user[0],
        editableDashboard: true,
      },
    })
  );

  const publicRadioButton = await screen.findByLabelText("Public");
  fireEvent.click(publicRadioButton);

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
      accessGroups: ["public"],
      name: "editable",
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
  appAPI.updateDashboard = mockUpdateDashboard;

  render(
    createLoadedComponent({
      children: <TestingComponent />,
      options: {
        initialDashboard: mockedDashboards.user[0],
        editableDashboard: true,
      },
    })
  );

  const descriptionInput = await screen.findByLabelText("Description Input");
  fireEvent.change(descriptionInput, { target: { value: "New Description" } });

  const saveButton = await screen.findByLabelText("Save Dashboard Button");
  await userEvent.click(saveButton);
  expect(mockUpdateDashboard).toHaveBeenCalledWith(
    {
      accessGroups: [],
      name: "editable",
      description: "New Description",
      id: 1,
      notes: "test_notes",
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
  appAPI.updateDashboard = mockUpdateDashboard;

  render(
    createLoadedComponent({
      children: <TestingComponent />,
      options: {
        initialDashboard: mockedDashboards.user[0],
        editableDashboard: true,
      },
    })
  );

  const descriptionInput = await screen.findByLabelText("Description Input");
  fireEvent.change(descriptionInput, { target: { value: "New Description" } });

  const saveButton = await screen.findByLabelText("Save Dashboard Button");
  await userEvent.click(saveButton);
  expect(mockUpdateDashboard).toHaveBeenCalledWith(
    {
      accessGroups: [],
      name: "editable",
      description: "New Description",
      id: 1,
      notes: "test_notes",
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
  appAPI.deleteDashboard = mockDeleteDashboard;
  mockedConfirm.mockResolvedValue(true);

  render(
    createLoadedComponent({
      children: <TestingComponent />,
      options: {
        initialDashboard: mockedDashboards.user[0],
        editableDashboard: true,
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
  appAPI.deleteDashboard = mockDeleteDashboard;
  mockedConfirm.mockResolvedValue(true);

  render(
    createLoadedComponent({
      children: <TestingComponent />,
      options: {
        initialDashboard: mockedDashboards.user[0],
        editableDashboard: true,
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
  appAPI.deleteDashboard = mockDeleteDashboard;
  mockedConfirm.mockResolvedValue(false);

  render(
    createLoadedComponent({
      children: <TestingComponent />,
      options: {
        initialDashboard: mockedDashboards.user[0],
        editableDashboard: true,
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
      accessGroups: [],
    },
  });
  appAPI.copyDashboard = mockCopyDashboard;
  mockedConfirm.mockResolvedValue(true);

  render(
    createLoadedComponent({
      children: <TestingComponent />,
      options: {
        initialDashboard: mockedDashboards.user[0],
      },
    })
  );

  const copyButton = await screen.findByLabelText("Copy Dashboard Button");
  await userEvent.click(copyButton);
  expect(mockCopyDashboard).toHaveBeenCalledWith(
    { id: 1, newName: "editable - Copy" },
    "SxICmOkFldX4o4YVaySdZq9sgn0eRd3Ih6uFtY8BgU5tMyZc7n90oJ4M2My5i7cy"
  );

  expect(navigateMock).toHaveBeenCalledWith("/dashboard/user/editable_copy");
});

test("Dashboard Editor Canvas copy and fail with message", async () => {
  const navigateMock = jest.fn();
  useNavigate.mockReturnValue(navigateMock);
  const mockCopyDashboard = jest.fn();
  mockCopyDashboard.mockResolvedValue({
    success: false,
    message: "failed to copy for some reason",
  });
  appAPI.copyDashboard = mockCopyDashboard;

  render(
    createLoadedComponent({
      children: <TestingComponent />,
      options: {
        initialDashboard: mockedDashboards.user[0],
      },
    })
  );

  const copyButton = await screen.findByLabelText("Copy Dashboard Button");
  await userEvent.click(copyButton);
  expect(mockCopyDashboard).toHaveBeenCalledWith(
    { id: 1, newName: "editable - Copy" },
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
  appAPI.copyDashboard = mockCopyDashboard;
  mockedConfirm.mockResolvedValue(true);

  render(
    createLoadedComponent({
      children: <TestingComponent />,
      options: {
        initialDashboard: mockedDashboards.user[0],
      },
    })
  );

  const copyButton = await screen.findByLabelText("Copy Dashboard Button");
  await userEvent.click(copyButton);
  expect(mockCopyDashboard).toHaveBeenCalledWith(
    { id: 1, newName: "editable - Copy" },
    "SxICmOkFldX4o4YVaySdZq9sgn0eRd3Ih6uFtY8BgU5tMyZc7n90oJ4M2My5i7cy"
  );
  expect(
    await screen.findByText("Failed to copy dashboard")
  ).toBeInTheDocument();
  expect(navigateMock).toHaveBeenCalledTimes(0);
});

test("Dashboard Editor Canvas close", async () => {
  const mockSetAppTourStep = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <AppTourContext.Provider
          value={{
            activeAppTour: false,
            setAppTourStep: mockSetAppTourStep,
          }}
        >
          <TestingComponent />
        </AppTourContext.Provider>
      ),
      options: {
        initialDashboard: mockedDashboards.user[0],
      },
    })
  );

  const cancelDashboardEditorButton = await screen.findByLabelText(
    "Cancel Dashboard Editor Button"
  );
  await userEvent.click(cancelDashboardEditorButton);

  await waitFor(() => {
    expect(screen.queryByText("Dashboard Settings")).not.toBeInTheDocument();
  });

  expect(mockSetAppTourStep).toHaveBeenCalledTimes(0);
});

test("Dashboard Editor Canvas close in app tour", async () => {
  const mockSetAppTourStep = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <AppTourContext.Provider
          value={{
            activeAppTour: true,
            setAppTourStep: mockSetAppTourStep,
          }}
        >
          <TestingComponent />
        </AppTourContext.Provider>
      ),
      options: {
        initialDashboard: mockedDashboards.user[0],
      },
    })
  );

  const cancelDashboardEditorButton = await screen.findByLabelText(
    "Cancel Dashboard Editor Button"
  );
  await userEvent.click(cancelDashboardEditorButton);

  await waitFor(() => {
    expect(screen.queryByText("Dashboard Settings")).not.toBeInTheDocument();
  });

  expect(mockSetAppTourStep).toHaveBeenCalledWith(33);
});

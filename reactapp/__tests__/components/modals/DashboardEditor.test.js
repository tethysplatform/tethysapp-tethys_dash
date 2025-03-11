import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { render, screen, fireEvent } from "@testing-library/react";
import DashboardNotes from "components/modals/DashboardNotes";
import {
  mockedDashboards,
  updatedDashboard,
} from "__tests__/utilities/constants";
import { confirm } from "components/inputs/DeleteConfirmation";
import createLoadedComponent, {
  EditingPComponent,
} from "__tests__/utilities/customRender";
import appAPI from "services/api/app";

jest.mock("components/inputs/DeleteConfirmation", () => {
  return {
    confirm: jest.fn(),
  };
});
const mockedConfirm = jest.mocked(confirm);

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
    <>
      <DashboardNotes showCanvas={showCanvas} setShowCanvas={setShowCanvas} />
      <EditingPComponent />
      <p>{showCanvas ? "yes show canvas" : "not show canvas"}</p>
    </>
  );
};

test("Dashboard Editor Canvas editable dashboard change sharing status", async () => {
  render(
    createLoadedComponent({
      children: <TestingComponent />,
      options: {
        initialDashboard: mockedDashboards.user[0],
      },
    })
  );

  expect(await screen.findByText("Dashboard Settings")).toBeInTheDocument();
  expect(await screen.findByText("Name")).toBeInTheDocument();
  expect(await screen.findByLabelText("Name Input")).toBeInTheDocument();
  expect(await screen.findByText("Label")).toBeInTheDocument();
  expect(await screen.findByLabelText("Label Input")).toBeInTheDocument();
  expect(await screen.findByText("Sharing Status")).toBeInTheDocument();
  expect(await screen.findByText("Notes:")).toBeInTheDocument();
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
  expect(screen.queryByText("Public URL:")).not.toBeInTheDocument();

  fireEvent.click(publicRadioButton);

  expect(publicRadioButton).toBeChecked();
  expect(privateRadioButton).not.toBeChecked();
  expect(await screen.findByText("Public URL:")).toBeInTheDocument();
  expect(
    await screen.findByText(
      "http://api.test/apps/tethysdash/dashboard/editable"
    )
  ).toBeInTheDocument();
});

test("Dashboard Editor Canvas copy public url failed", async () => {
  render(
    createLoadedComponent({
      children: <TestingComponent />,
      options: {
        initialDashboard: mockedDashboards.noneditable.name,
      },
    })
  );

  expect(await screen.findByText("Dashboard Settings")).toBeInTheDocument();
  expect(await screen.findByText("Name:")).toBeInTheDocument();
  expect(screen.queryByLabelText("Name Input")).not.toBeInTheDocument();
  expect(await screen.findByText("Label:")).toBeInTheDocument();
  expect(screen.queryByLabelText("Label Input")).not.toBeInTheDocument();
  expect(screen.queryByText("Sharing Status:")).not.toBeInTheDocument();
  expect(await screen.findByText("Notes:")).toBeInTheDocument();
  expect(screen.queryByLabelText("textEditor")).not.toBeInTheDocument();
  expect(await screen.findByText("Close")).toBeInTheDocument();
  expect(await screen.findByText("Copy dashboard")).toBeInTheDocument();
  expect(screen.queryByText("Delete dashboard")).not.toBeInTheDocument();
  expect(screen.queryByText("Save changes")).not.toBeInTheDocument();

  expect(screen.queryByLabelText("Public")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Private")).not.toBeInTheDocument();
  expect(await screen.findByText("Public URL:")).toBeInTheDocument();
  expect(
    await screen.findByText(
      "http://api.test/apps/tethysdash/dashboard/noneditable"
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
        initialDashboard: mockedDashboards.noneditable.name,
      },
    })
  );

  expect(await screen.findByText("Dashboard Settings")).toBeInTheDocument();
  expect(await screen.findByText("Name:")).toBeInTheDocument();
  expect(screen.queryByLabelText("Name Input")).not.toBeInTheDocument();
  expect(await screen.findByText("Label:")).toBeInTheDocument();
  expect(screen.queryByLabelText("Label Input")).not.toBeInTheDocument();
  expect(screen.queryByText("Sharing Status:")).not.toBeInTheDocument();
  expect(await screen.findByText("Notes:")).toBeInTheDocument();
  expect(screen.queryByLabelText("textEditor")).not.toBeInTheDocument();
  expect(await screen.findByText("Close")).toBeInTheDocument();
  expect(await screen.findByText("Copy dashboard")).toBeInTheDocument();
  expect(screen.queryByText("Delete dashboard")).not.toBeInTheDocument();
  expect(screen.queryByText("Save changes")).not.toBeInTheDocument();

  expect(screen.queryByLabelText("Public")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Private")).not.toBeInTheDocument();
  expect(await screen.findByText("Public URL:")).toBeInTheDocument();
  expect(
    await screen.findByText(
      "http://api.test/apps/tethysdash/dashboard/noneditable"
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
    "http://api.test/apps/tethysdash/dashboard/noneditable"
  );
  await userEvent.hover(copyClipboardButton);
  expect(screen.getByRole("tooltip")).toHaveTextContent("Copied");
});

test("Dashboard Editor Canvas edit and save", async () => {
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
      },
    })
  );

  const publicRadioButton = screen.getByLabelText("Public");
  fireEvent.click(publicRadioButton);

  const labelInput = await screen.findByLabelText("Label Input");
  fireEvent.change(labelInput, { target: { value: "New Label" } });
  expect(await screen.findByText("Label")).toBeInTheDocument();
  expect(await screen.findByLabelText("Label Input")).toBeInTheDocument();

  const nameInput = await screen.findByLabelText("Name Input");
  fireEvent.change(nameInput, { target: { value: "new_name" } });
  expect(await screen.findByText("Name")).toBeInTheDocument();
  expect(await screen.findByLabelText("Name Input")).toBeInTheDocument();

  const textArea = await screen.findByLabelText("textEditor");
  await userEvent.click(textArea);
  await userEvent.keyboard("Here are some notes");
  expect(await screen.findByText("Here are some notes")).toBeInTheDocument();

  const saveButton = await screen.findByLabelText("Save Dashboard Button");
  await userEvent.click(saveButton);
  expect(mockUpdateDashboard).toHaveBeenCalledWith(
    {
      accessGroups: ["public"],
      editable: true,
      gridItems: [
        {
          args_string: "{}",
          h: 20,
          i: "1",
          metadata_string: '{"refreshRate":0}',
          source: "",
          w: 20,
          x: 0,
          y: 0,
        },
      ],
      label: "New Label",
      name: "new_name",
      notes: "Here are some notes",
      originalAccessGroups: [],
      originalLabel: "test_label",
      originalName: "editable",
    },
    "Token"
  );
  expect(
    await screen.findByText("Successfully updated dashboard settings")
  ).toBeInTheDocument();

  const closeAlertButton = await screen.findByLabelText("Close alert");
  fireEvent.click(closeAlertButton);
  expect(
    screen.queryByText("Successfully updated dashboard settings")
  ).not.toBeInTheDocument();
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
      },
    })
  );

  const labelInput = await screen.findByLabelText("Label Input");
  fireEvent.change(labelInput, { target: { value: "New Label" } });
  expect(await screen.findByText("Label")).toBeInTheDocument();
  expect(await screen.findByLabelText("Label Input")).toBeInTheDocument();

  const saveButton = await screen.findByLabelText("Save Dashboard Button");
  await userEvent.click(saveButton);
  expect(mockUpdateDashboard).toHaveBeenCalledWith(
    {
      accessGroups: [],
      editable: true,
      gridItems: [
        {
          args_string: "{}",
          h: 20,
          i: "1",
          metadata_string: '{"refreshRate":0}',
          source: "",
          w: 20,
          x: 0,
          y: 0,
        },
      ],
      label: "New Label",
      name: "",
      notes: "",
      originalAccessGroups: [],
      originalLabel: "test_label",
      originalName: "editable",
    },
    "Token"
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
      },
    })
  );

  const labelInput = await screen.findByLabelText("Label Input");
  fireEvent.change(labelInput, { target: { value: "New Label" } });
  expect(await screen.findByText("Label")).toBeInTheDocument();
  expect(labelInput).toBeInTheDocument();

  const saveButton = await screen.findByLabelText("Save Dashboard Button");
  await userEvent.click(saveButton);
  expect(mockUpdateDashboard).toHaveBeenCalledWith(
    {
      accessGroups: [],
      editable: true,
      gridItems: [
        {
          args_string: "{}",
          h: 20,
          i: "1",
          metadata_string: '{"refreshRate":0}',
          source: "",
          w: 20,
          x: 0,
          y: 0,
        },
      ],
      label: "New Label",
      name: "",
      notes: "",
      originalAccessGroups: [],
      originalLabel: "test_label",
      originalName: "editable",
    },
    "Token"
  );
  expect(await screen.findByText("failed to update")).toBeInTheDocument();
});

test("Dashboard Editor Canvas delete success", async () => {
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
      },
    })
  );

  const deleteButton = await screen.findByLabelText("Delete Dashboard Button");
  await userEvent.click(deleteButton);
  expect(mockDeleteDashboard).toHaveBeenCalled();
  expect(await screen.findByTestId("editing")).toHaveTextContent("editing");
  expect(await screen.findByText("not show canvas")).toBeInTheDocument();
});

test("Dashboard Editor Canvas delete fail", async () => {
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
      },
    })
  );

  const deleteButton = await screen.findByLabelText("Delete Dashboard Button");
  await userEvent.click(deleteButton);
  expect(mockDeleteDashboard).toHaveBeenCalled();
  expect(await screen.findByTestId("editing")).toHaveTextContent("editing");
  expect(await screen.findByText("yes show canvas")).toBeInTheDocument();
  expect(
    await screen.findByText("Failed to delete dashboard. Check server logs.")
  ).toBeInTheDocument();

  const closeAlertButton = await screen.findByLabelText("Close alert");
  fireEvent.click(closeAlertButton);
  expect(
    screen.queryByText("Failed to adelete dashboard. Check server logs.")
  ).not.toBeInTheDocument();
});

test("Dashboard Editor Canvas delete not confirm", async () => {
  const mockDeleteDashboard = jest.fn();
  appAPI.deleteDashboard = mockDeleteDashboard;
  mockedConfirm.mockResolvedValue(false);

  render(
    createLoadedComponent({
      children: <TestingComponent />,
      options: {
        initialDashboard: mockedDashboards.user[0],
      },
    })
  );

  const deleteButton = await screen.findByLabelText("Delete Dashboard Button");
  await userEvent.click(deleteButton);
  expect(mockDeleteDashboard).not.toHaveBeenCalled();
  expect(await screen.findByTestId("editing")).toHaveTextContent("not editing");
  expect(await screen.findByText("yes show canvas")).toBeInTheDocument();
});

test("Dashboard Editor Canvas copy and not confirm", async () => {
  const mockAddDashboard = jest.fn();
  appAPI.addDashboard = mockAddDashboard;
  mockedConfirm.mockResolvedValue(false);

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
  expect(mockAddDashboard).not.toHaveBeenCalled();
});

test("Dashboard Editor Canvas copy and confirm and success", async () => {
  const mockAddDashboard = jest.fn();
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
  appAPI.addDashboard = mockAddDashboard;
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
  expect(mockAddDashboard).toHaveBeenCalled();
  expect(
    await screen.findByText("Successfully copied dashboard")
  ).toBeInTheDocument();
  const nameInput = await screen.findByLabelText("Name Input");
  const labelInput = await screen.findByLabelText("Label Input");
  expect(nameInput.value).toBe("editable_copy");
  expect(labelInput.value).toBe("test_label Copy");
});

test("Dashboard Editor Canvas copy and confirm and fail with message", async () => {
  const mockAddDashboard = jest.fn();
  mockAddDashboard.mockResolvedValue({
    success: false,
    message: "failed to copy for some reason",
  });
  appAPI.addDashboard = mockAddDashboard;
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
  expect(mockAddDashboard).toHaveBeenCalled();
  expect(
    await screen.findByText("failed to copy for some reason")
  ).toBeInTheDocument();
});

test("Dashboard Editor Canvas copy and confirm and fail without message", async () => {
  const mockAddDashboard = jest.fn();
  mockAddDashboard.mockResolvedValue({
    success: false,
  });
  appAPI.addDashboard = mockAddDashboard;
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
  expect(mockAddDashboard).toHaveBeenCalled();
  expect(
    await screen.findByText("Failed to copy dashboard. Check server logs.")
  ).toBeInTheDocument();
});

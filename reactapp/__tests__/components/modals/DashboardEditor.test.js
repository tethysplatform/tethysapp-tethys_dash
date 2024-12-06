import { act, useEffect, useState } from "react";
import userEvent from "@testing-library/user-event";
import { render, screen, fireEvent } from "@testing-library/react";
import DashboardEditorCanvas from "components/modals/DashboardEditor";
import { mockedDashboards } from "__tests__/utilities/constants";
import SelectedDashboardContextProvider, {
  useLayoutContext,
} from "components/contexts/SelectedDashboardContext";
import VariableInputsContextProvider from "components/contexts/VariableInputsContext";
import EditingContextProvider, {
  EditingContext,
} from "components/contexts/EditingContext";
import DataViewerModeContextProvider from "components/contexts/DataViewerModeContext";
import PropTypes from "prop-types";
import AvailableDashboardsContextProvider, {
  AvailableDashboardsContext,
} from "components/contexts/AvailableDashboardsContext";
import { AppContext } from "components/contexts/AppContext";
import { confirm } from "components/dashboard/DeleteConfirmation";

jest.mock("components/dashboard/DeleteConfirmation", () => {
  return {
    confirm: jest.fn(),
  };
});
const mockedConfirm = jest.mocked(confirm);

const TestingComponent = (props) => {
  const { setLayoutContext } = useLayoutContext();
  const [showCanvas, setShowCanvas] = useState(true);

  useEffect(() => {
    setLayoutContext(props.layoutContext);
    // eslint-disable-next-line
  }, []);

  return (
    <>
      <DashboardEditorCanvas
        showCanvas={showCanvas}
        setShowCanvas={setShowCanvas}
      />
      <p>{showCanvas ? "yes show canvas" : "not show canvas"}</p>
    </>
  );
};

test("Dashboard Editor Canvas editable dashboard change sharing status", async () => {
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
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));

  render(
    <AppContext.Provider value={{ csrf: "csrf", dashboards: mockedDashboards }}>
      <VariableInputsContextProvider>
        <SelectedDashboardContextProvider>
          <AvailableDashboardsContextProvider>
            <EditingContextProvider>
              <DataViewerModeContextProvider>
                <TestingComponent layoutContext={mockedDashboard} />
              </DataViewerModeContextProvider>
            </EditingContextProvider>
          </AvailableDashboardsContextProvider>
        </SelectedDashboardContextProvider>
      </VariableInputsContextProvider>
    </AppContext.Provider>
  );

  expect(await screen.findByText("Dashboard Settings")).toBeInTheDocument();
  expect(await screen.findByText("Name:")).toBeInTheDocument();
  expect(await screen.findByLabelText("Name Input")).toBeInTheDocument();
  expect(await screen.findByText("Label:")).toBeInTheDocument();
  expect(await screen.findByLabelText("Label Input")).toBeInTheDocument();
  expect(await screen.findByText("Sharing Status:")).toBeInTheDocument();
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
  const mockedDashboard = JSON.parse(
    JSON.stringify(mockedDashboards.noneditable)
  );

  render(
    <AppContext.Provider value={{ csrf: "csrf", dashboards: mockedDashboards }}>
      <VariableInputsContextProvider>
        <SelectedDashboardContextProvider>
          <AvailableDashboardsContextProvider>
            <EditingContextProvider>
              <DataViewerModeContextProvider>
                <TestingComponent layoutContext={mockedDashboard} />
              </DataViewerModeContextProvider>
            </EditingContextProvider>
          </AvailableDashboardsContextProvider>
        </SelectedDashboardContextProvider>
      </VariableInputsContextProvider>
    </AppContext.Provider>
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
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.hover(copyClipboardButton);
  });
  expect(screen.getByRole("tooltip")).toHaveTextContent("Failed to Copy");
});

test("Dashboard Editor Canvas noneditable and copy public url", async () => {
  const mockWriteText = jest.fn();
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
  Object.defineProperty(navigator, "clipboard", {
    value: {
      writeText: mockWriteText,
    },
  });
  const mockedDashboard = JSON.parse(
    JSON.stringify(mockedDashboards.noneditable)
  );

  render(
    <AppContext.Provider value={{ csrf: "csrf", dashboards: mockedDashboards }}>
      <VariableInputsContextProvider>
        <SelectedDashboardContextProvider>
          <AvailableDashboardsContextProvider>
            <EditingContextProvider>
              <DataViewerModeContextProvider>
                <TestingComponent layoutContext={mockedDashboard} />
              </DataViewerModeContextProvider>
            </EditingContextProvider>
          </AvailableDashboardsContextProvider>
        </SelectedDashboardContextProvider>
      </VariableInputsContextProvider>
    </AppContext.Provider>
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
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.hover(copyClipboardButton);
  });

  const tooltip = screen.getByRole("tooltip");
  expect(tooltip).toBeInTheDocument();
  expect(tooltip).toHaveTextContent("Copy to clipboard");
  expect(copyClipboardButton).toBeInTheDocument();
  fireEvent.click(copyClipboardButton);
  expect(mockWriteText).toHaveBeenCalledWith(
    "http://api.test/apps/tethysdash/dashboard/noneditable"
  );
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.hover(copyClipboardButton);
  });
  expect(screen.getByRole("tooltip")).toHaveTextContent("Copied");
});

test("Dashboard Editor Canvas edit and save", async () => {
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
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  const mockDeleteDashboard = jest.fn();
  const mockUpdateDashboard = jest.fn();
  const mockCopyCurrentDashboard = jest.fn();

  mockUpdateDashboard.mockResolvedValue({ success: true });

  render(
    <AppContext.Provider value={{ csrf: "csrf" }}>
      <VariableInputsContextProvider>
        <SelectedDashboardContextProvider>
          <AvailableDashboardsContext.Provider
            value={{
              deleteDashboard: mockDeleteDashboard,
              updateDashboard: mockUpdateDashboard,
              copyCurrentDashboard: mockCopyCurrentDashboard,
            }}
          >
            <EditingContextProvider>
              <DataViewerModeContextProvider>
                <TestingComponent layoutContext={mockedDashboard} />
              </DataViewerModeContextProvider>
            </EditingContextProvider>
          </AvailableDashboardsContext.Provider>
        </SelectedDashboardContextProvider>
      </VariableInputsContextProvider>
    </AppContext.Provider>
  );
  const publicRadioButton = screen.getByLabelText("Public");
  fireEvent.click(publicRadioButton);

  const labelInput = await screen.findByLabelText("Label Input");
  fireEvent.change(labelInput, { target: { value: "New Label" } });
  expect(await screen.findByText("Label:")).toBeInTheDocument();
  expect(await screen.findByLabelText("Label Input")).toBeInTheDocument();

  const nameInput = await screen.findByLabelText("Name Input");
  fireEvent.change(nameInput, { target: { value: "new_name" } });
  expect(await screen.findByText("Name:")).toBeInTheDocument();
  expect(await screen.findByLabelText("Name Input")).toBeInTheDocument();

  const textArea = await screen.findByLabelText("textEditor");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(textArea);
  });
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.keyboard("Here are some notes");
  });
  expect(await screen.findByText("Here are some notes")).toBeInTheDocument();

  const saveButton = await screen.findByLabelText("Save Dashboard Button");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(saveButton);
  });
  expect(mockUpdateDashboard).toHaveBeenCalledWith({
    access_groups: ["public"],
    label: "New Label",
    name: "new_name",
    notes: "Here are some notes",
  });
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
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  const mockDeleteDashboard = jest.fn();
  const mockUpdateDashboard = jest.fn();
  const mockCopyCurrentDashboard = jest.fn();

  mockUpdateDashboard.mockResolvedValue({ success: false });

  render(
    <AppContext.Provider value={{ csrf: "csrf" }}>
      <VariableInputsContextProvider>
        <SelectedDashboardContextProvider>
          <AvailableDashboardsContext.Provider
            value={{
              deleteDashboard: mockDeleteDashboard,
              updateDashboard: mockUpdateDashboard,
              copyCurrentDashboard: mockCopyCurrentDashboard,
            }}
          >
            <EditingContextProvider>
              <DataViewerModeContextProvider>
                <TestingComponent layoutContext={mockedDashboard} />
              </DataViewerModeContextProvider>
            </EditingContextProvider>
          </AvailableDashboardsContext.Provider>
        </SelectedDashboardContextProvider>
      </VariableInputsContextProvider>
    </AppContext.Provider>
  );

  const labelInput = await screen.findByLabelText("Label Input");
  fireEvent.change(labelInput, { target: { value: "New Label" } });
  expect(await screen.findByText("Label:")).toBeInTheDocument();
  expect(await screen.findByLabelText("Label Input")).toBeInTheDocument();

  const saveButton = await screen.findByLabelText("Save Dashboard Button");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(saveButton);
  });
  expect(mockUpdateDashboard).toHaveBeenCalledWith({
    access_groups: [],
    label: "New Label",
    name: "",
    notes: "",
  });
  expect(
    await screen.findByText(
      "Failed to update dashboard settings. Check server logs."
    )
  ).toBeInTheDocument();
});

test("Dashboard Editor Canvas edit and save fail with message", async () => {
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
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  const mockDeleteDashboard = jest.fn();
  const mockUpdateDashboard = jest.fn();
  const mockCopyCurrentDashboard = jest.fn();

  mockUpdateDashboard.mockResolvedValue({
    success: false,
    message: "failed to update",
  });

  render(
    <AppContext.Provider value={{ csrf: "csrf" }}>
      <VariableInputsContextProvider>
        <SelectedDashboardContextProvider>
          <AvailableDashboardsContext.Provider
            value={{
              deleteDashboard: mockDeleteDashboard,
              updateDashboard: mockUpdateDashboard,
              copyCurrentDashboard: mockCopyCurrentDashboard,
            }}
          >
            <EditingContextProvider>
              <DataViewerModeContextProvider>
                <TestingComponent layoutContext={mockedDashboard} />
              </DataViewerModeContextProvider>
            </EditingContextProvider>
          </AvailableDashboardsContext.Provider>
        </SelectedDashboardContextProvider>
      </VariableInputsContextProvider>
    </AppContext.Provider>
  );

  const labelInput = await screen.findByLabelText("Label Input");
  fireEvent.change(labelInput, { target: { value: "New Label" } });
  expect(await screen.findByText("Label:")).toBeInTheDocument();
  expect(labelInput).toBeInTheDocument();

  const saveButton = await screen.findByLabelText("Save Dashboard Button");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(saveButton);
  });
  expect(mockUpdateDashboard).toHaveBeenCalledWith({
    access_groups: [],
    label: "New Label",
    name: "",
    notes: "",
  });
  expect(await screen.findByText("failed to update")).toBeInTheDocument();
});

test("Dashboard Editor Canvas delete success", async () => {
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
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  const mockDeleteDashboard = jest.fn();
  const mockUpdateDashboard = jest.fn();
  const mockCopyCurrentDashboard = jest.fn();
  const mockSetIsEditing = jest.fn();

  mockDeleteDashboard.mockResolvedValue({
    success: true,
  });

  render(
    <AppContext.Provider value={{ csrf: "csrf" }}>
      <VariableInputsContextProvider>
        <SelectedDashboardContextProvider>
          <AvailableDashboardsContext.Provider
            value={{
              deleteDashboard: mockDeleteDashboard,
              updateDashboard: mockUpdateDashboard,
              copyCurrentDashboard: mockCopyCurrentDashboard,
            }}
          >
            <EditingContext.Provider value={{ setIsEditing: mockSetIsEditing }}>
              <DataViewerModeContextProvider>
                <TestingComponent layoutContext={mockedDashboard} />
              </DataViewerModeContextProvider>
            </EditingContext.Provider>
          </AvailableDashboardsContext.Provider>
        </SelectedDashboardContextProvider>
      </VariableInputsContextProvider>
    </AppContext.Provider>
  );

  const deleteButton = await screen.findByLabelText("Delete Dashboard Button");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(deleteButton);
  });
  expect(mockDeleteDashboard).toHaveBeenCalled();
  expect(mockSetIsEditing).toHaveBeenCalled();
  expect(await screen.findByText("not show canvas")).toBeInTheDocument();
});

test("Dashboard Editor Canvas delete fail", async () => {
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
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  const mockDeleteDashboard = jest.fn();
  const mockUpdateDashboard = jest.fn();
  const mockCopyCurrentDashboard = jest.fn();
  const mockSetIsEditing = jest.fn();

  mockDeleteDashboard.mockResolvedValue({
    success: false,
  });

  render(
    <AppContext.Provider value={{ csrf: "csrf" }}>
      <VariableInputsContextProvider>
        <SelectedDashboardContextProvider>
          <AvailableDashboardsContext.Provider
            value={{
              deleteDashboard: mockDeleteDashboard,
              updateDashboard: mockUpdateDashboard,
              copyCurrentDashboard: mockCopyCurrentDashboard,
            }}
          >
            <EditingContext.Provider value={{ setIsEditing: mockSetIsEditing }}>
              <DataViewerModeContextProvider>
                <TestingComponent layoutContext={mockedDashboard} />
              </DataViewerModeContextProvider>
            </EditingContext.Provider>
          </AvailableDashboardsContext.Provider>
        </SelectedDashboardContextProvider>
      </VariableInputsContextProvider>
    </AppContext.Provider>
  );

  const deleteButton = await screen.findByLabelText("Delete Dashboard Button");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(deleteButton);
  });
  expect(mockDeleteDashboard).toHaveBeenCalled();
  expect(mockSetIsEditing).not.toHaveBeenCalled();
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
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  const mockDeleteDashboard = jest.fn();
  const mockUpdateDashboard = jest.fn();
  const mockCopyCurrentDashboard = jest.fn();
  const mockSetIsEditing = jest.fn();

  mockDeleteDashboard.mockResolvedValue({
    success: false,
    confirmExit: true,
  });

  render(
    <AppContext.Provider value={{ csrf: "csrf" }}>
      <VariableInputsContextProvider>
        <SelectedDashboardContextProvider>
          <AvailableDashboardsContext.Provider
            value={{
              deleteDashboard: mockDeleteDashboard,
              updateDashboard: mockUpdateDashboard,
              copyCurrentDashboard: mockCopyCurrentDashboard,
            }}
          >
            <EditingContext.Provider value={{ setIsEditing: mockSetIsEditing }}>
              <DataViewerModeContextProvider>
                <TestingComponent layoutContext={mockedDashboard} />
              </DataViewerModeContextProvider>
            </EditingContext.Provider>
          </AvailableDashboardsContext.Provider>
        </SelectedDashboardContextProvider>
      </VariableInputsContextProvider>
    </AppContext.Provider>
  );

  const deleteButton = await screen.findByLabelText("Delete Dashboard Button");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(deleteButton);
  });
  expect(mockDeleteDashboard).toHaveBeenCalled();
  expect(mockSetIsEditing).not.toHaveBeenCalled();
  expect(await screen.findByText("yes show canvas")).toBeInTheDocument();
});

test("Dashboard Editor Canvas copy and not confirm", async () => {
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
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  const mockDeleteDashboard = jest.fn();
  const mockUpdateDashboard = jest.fn();
  const mockCopyCurrentDashboard = jest.fn();
  const mockSetIsEditing = jest.fn();
  mockedConfirm.mockResolvedValue(false);

  render(
    <AppContext.Provider value={{ csrf: "csrf" }}>
      <VariableInputsContextProvider>
        <SelectedDashboardContextProvider>
          <AvailableDashboardsContext.Provider
            value={{
              deleteDashboard: mockDeleteDashboard,
              updateDashboard: mockUpdateDashboard,
              copyCurrentDashboard: mockCopyCurrentDashboard,
            }}
          >
            <EditingContext.Provider value={{ setIsEditing: mockSetIsEditing }}>
              <DataViewerModeContextProvider>
                <TestingComponent layoutContext={mockedDashboard} />
              </DataViewerModeContextProvider>
            </EditingContext.Provider>
          </AvailableDashboardsContext.Provider>
        </SelectedDashboardContextProvider>
      </VariableInputsContextProvider>
    </AppContext.Provider>
  );

  const copyButton = await screen.findByLabelText("Copy Dashboard Button");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(copyButton);
  });
  expect(mockCopyCurrentDashboard).not.toHaveBeenCalled();
});

test("Dashboard Editor Canvas copy and confirm and success", async () => {
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
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  const mockDeleteDashboard = jest.fn();
  const mockUpdateDashboard = jest.fn();
  const mockCopyCurrentDashboard = jest.fn();
  const mockSetIsEditing = jest.fn();
  mockedConfirm.mockResolvedValue(true);

  mockCopyCurrentDashboard.mockResolvedValue({
    success: true,
    new_dashboard: {
      id: 1,
      name: "editable_copy",
      label: "test_label Copy",
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
    },
  });

  render(
    <AppContext.Provider value={{ csrf: "csrf" }}>
      <VariableInputsContextProvider>
        <SelectedDashboardContextProvider>
          <AvailableDashboardsContext.Provider
            value={{
              deleteDashboard: mockDeleteDashboard,
              updateDashboard: mockUpdateDashboard,
              copyCurrentDashboard: mockCopyCurrentDashboard,
            }}
          >
            <EditingContext.Provider value={{ setIsEditing: mockSetIsEditing }}>
              <DataViewerModeContextProvider>
                <TestingComponent layoutContext={mockedDashboard} />
              </DataViewerModeContextProvider>
            </EditingContext.Provider>
          </AvailableDashboardsContext.Provider>
        </SelectedDashboardContextProvider>
      </VariableInputsContextProvider>
    </AppContext.Provider>
  );

  const copyButton = await screen.findByLabelText("Copy Dashboard Button");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(copyButton);
  });
  expect(mockCopyCurrentDashboard).toHaveBeenCalled();
  expect(
    await screen.findByText("Successfully copied dashboard")
  ).toBeInTheDocument();
  const nameInput = await screen.findByLabelText("Name Input");
  const labelInput = await screen.findByLabelText("Label Input");
  expect(nameInput.value).toBe("editable_copy");
  expect(labelInput.value).toBe("test_label Copy");
});

test("Dashboard Editor Canvas copy and confirm and fail with message", async () => {
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
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  const mockDeleteDashboard = jest.fn();
  const mockUpdateDashboard = jest.fn();
  const mockCopyCurrentDashboard = jest.fn();
  const mockSetIsEditing = jest.fn();
  mockedConfirm.mockResolvedValue(true);

  mockCopyCurrentDashboard.mockResolvedValue({
    success: false,
    message: "failed to copy for some reason",
  });

  render(
    <AppContext.Provider value={{ csrf: "csrf" }}>
      <VariableInputsContextProvider>
        <SelectedDashboardContextProvider>
          <AvailableDashboardsContext.Provider
            value={{
              deleteDashboard: mockDeleteDashboard,
              updateDashboard: mockUpdateDashboard,
              copyCurrentDashboard: mockCopyCurrentDashboard,
            }}
          >
            <EditingContext.Provider value={{ setIsEditing: mockSetIsEditing }}>
              <DataViewerModeContextProvider>
                <TestingComponent layoutContext={mockedDashboard} />
              </DataViewerModeContextProvider>
            </EditingContext.Provider>
          </AvailableDashboardsContext.Provider>
        </SelectedDashboardContextProvider>
      </VariableInputsContextProvider>
    </AppContext.Provider>
  );

  const copyButton = await screen.findByLabelText("Copy Dashboard Button");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(copyButton);
  });
  expect(mockCopyCurrentDashboard).toHaveBeenCalled();
  expect(
    await screen.findByText("failed to copy for some reason")
  ).toBeInTheDocument();
});

test("Dashboard Editor Canvas copy and confirm and fail without message", async () => {
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
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  const mockDeleteDashboard = jest.fn();
  const mockUpdateDashboard = jest.fn();
  const mockCopyCurrentDashboard = jest.fn();
  const mockSetIsEditing = jest.fn();
  mockedConfirm.mockResolvedValue(true);

  mockCopyCurrentDashboard.mockResolvedValue({
    success: false,
  });

  render(
    <AppContext.Provider value={{ csrf: "csrf" }}>
      <VariableInputsContextProvider>
        <SelectedDashboardContextProvider>
          <AvailableDashboardsContext.Provider
            value={{
              deleteDashboard: mockDeleteDashboard,
              updateDashboard: mockUpdateDashboard,
              copyCurrentDashboard: mockCopyCurrentDashboard,
            }}
          >
            <EditingContext.Provider value={{ setIsEditing: mockSetIsEditing }}>
              <DataViewerModeContextProvider>
                <TestingComponent layoutContext={mockedDashboard} />
              </DataViewerModeContextProvider>
            </EditingContext.Provider>
          </AvailableDashboardsContext.Provider>
        </SelectedDashboardContextProvider>
      </VariableInputsContextProvider>
    </AppContext.Provider>
  );

  const copyButton = await screen.findByLabelText("Copy Dashboard Button");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(copyButton);
  });
  expect(mockCopyCurrentDashboard).toHaveBeenCalled();
  expect(
    await screen.findByText("Failed to copy dashboard. Check server logs.")
  ).toBeInTheDocument();
});

TestingComponent.propTypes = {
  layoutContext: PropTypes.object,
};

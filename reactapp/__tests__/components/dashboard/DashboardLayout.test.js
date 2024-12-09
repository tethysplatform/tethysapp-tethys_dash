import { render, screen, fireEvent } from "@testing-library/react";
import DashboardLayout from "components/dashboard/DashboardLayout";
import DashboardLayoutAlerts from "components/dashboard/DashboardLayoutAlerts";
import {
  mockedDashboards,
  updatedDashboard,
} from "__tests__/utilities/constants";
import {
  AvailableDashboardsContext,
  LayoutGridItemsContext,
  LayoutContext,
  EditingContext,
} from "components/contexts/Contexts";
import LayoutAlertContextProvider from "components/contexts/LayoutAlertContext";

// eslint-disable-next-line
jest.mock("components/dashboard/DashboardItem", () => (props) => (
  <>
    <button data-testid="test-submit" type="submit" form="gridUpdate" />
    <br></br>
    <br></br>
  </>
));

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

  const mockSetLayoutContext = jest.fn();
  const mockGetLayoutContext = jest.fn();
  mockGetLayoutContext.mockReturnValue(mockedDashboard);

  const { container } = render(
    <AvailableDashboardsContext.Provider value={{ updateDashboard: jest.fn() }}>
      <LayoutGridItemsContext.Provider
        value={{ gridItems: mockedDashboard.gridItems }}
      >
        <LayoutContext.Provider
          value={{
            setLayoutContext: mockSetLayoutContext,
            getLayoutContext: mockGetLayoutContext,
          }}
        >
          <EditingContext.Provider
            value={{ isEditing: true, setIsEditing: jest.fn() }}
          >
            <LayoutAlertContextProvider>
              <DashboardLayout />
            </LayoutAlertContextProvider>
          </EditingContext.Provider>
        </LayoutContext.Provider>
      </LayoutGridItemsContext.Provider>
    </AvailableDashboardsContext.Provider>
  );

  // eslint-disable-next-line
  const resizeSpan = container.querySelector(".react-resizable-handle");
  expect(resizeSpan).toBeInTheDocument();
  fireEvent.mouseDown(resizeSpan, { clientX: 0, clientY: 0 });
  fireEvent.mouseMove(resizeSpan, { clientX: 100, clientY: 0 });
  fireEvent.mouseUp(resizeSpan);

  expect(mockSetLayoutContext).toHaveBeenCalledWith({
    access_groups: [],
    editable: true,
    gridItems: [
      {
        args_string: "{}",
        h: 20,
        i: "1",
        metadata_string: JSON.stringify({ refreshRate: 0 }),
        source: "",
        w: 28,
        x: 0,
        y: 0,
      },
    ],
    id: 1,
    label: "test_label",
    name: "editable",
    notes: "test_notes",
  });
});

test("Dashboard Layout submit changes not editing", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  const mockUpdateDashboard = jest.fn();
  const mockGetLayoutContext = jest.fn();
  mockGetLayoutContext.mockReturnValue(mockedDashboard);

  render(
    <AvailableDashboardsContext.Provider
      value={{ updateDashboard: mockUpdateDashboard }}
    >
      <LayoutGridItemsContext.Provider
        value={{ gridItems: mockedDashboard.gridItems }}
      >
        <LayoutContext.Provider
          value={{
            setLayoutContext: jest.fn(),
            getLayoutContext: mockGetLayoutContext,
          }}
        >
          <EditingContext.Provider
            value={{ isEditing: false, setIsEditing: jest.fn() }}
          >
            <LayoutAlertContextProvider>
              <DashboardLayout />
            </LayoutAlertContextProvider>
          </EditingContext.Provider>
        </LayoutContext.Provider>
      </LayoutGridItemsContext.Provider>
    </AvailableDashboardsContext.Provider>
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
  const mockGetLayoutContext = jest.fn();
  const mockSetIsEditing = jest.fn();
  mockGetLayoutContext.mockReturnValue(mockedDashboard);

  render(
    <AvailableDashboardsContext.Provider
      value={{ updateDashboard: mockUpdateDashboard }}
    >
      <LayoutGridItemsContext.Provider
        value={{ gridItems: mockedDashboard.gridItems }}
      >
        <LayoutContext.Provider
          value={{
            setLayoutContext: jest.fn(),
            getLayoutContext: mockGetLayoutContext,
          }}
        >
          <EditingContext.Provider
            value={{ isEditing: true, setIsEditing: mockSetIsEditing }}
          >
            <LayoutAlertContextProvider>
              <DashboardLayoutAlerts />
              <DashboardLayout />
            </LayoutAlertContextProvider>
          </EditingContext.Provider>
        </LayoutContext.Provider>
      </LayoutGridItemsContext.Provider>
    </AvailableDashboardsContext.Provider>
  );

  const submitButton = screen.getByTestId("test-submit");
  fireEvent.click(submitButton);

  expect(
    await screen.findByText("Change have been saved.")
  ).toBeInTheDocument();
  expect(mockSetIsEditing).toHaveBeenCalledWith(false);
});

test("Dashboard Layout submit changes fail", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(mockedDashboards.editable));
  const mockUpdateDashboard = jest.fn().mockResolvedValue({
    success: false,
  });
  const mockGetLayoutContext = jest.fn();
  const mockSetIsEditing = jest.fn();
  mockGetLayoutContext.mockReturnValue(mockedDashboard);

  render(
    <AvailableDashboardsContext.Provider
      value={{ updateDashboard: mockUpdateDashboard }}
    >
      <LayoutGridItemsContext.Provider
        value={{ gridItems: mockedDashboard.gridItems }}
      >
        <LayoutContext.Provider
          value={{
            setLayoutContext: jest.fn(),
            getLayoutContext: mockGetLayoutContext,
          }}
        >
          <EditingContext.Provider
            value={{ isEditing: true, setIsEditing: mockSetIsEditing }}
          >
            <LayoutAlertContextProvider>
              <DashboardLayoutAlerts />
              <DashboardLayout />
            </LayoutAlertContextProvider>
          </EditingContext.Provider>
        </LayoutContext.Provider>
      </LayoutGridItemsContext.Provider>
    </AvailableDashboardsContext.Provider>
  );

  const submitButton = screen.getByTestId("test-submit");
  fireEvent.click(submitButton);

  expect(
    await screen.findByText(
      "Failed to save changes. Check server logs for more information."
    )
  ).toBeInTheDocument();
  expect(mockSetIsEditing).not.toHaveBeenCalled();
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

  const mockSetLayoutContext = jest.fn();
  const mockGetLayoutContext = jest.fn();
  mockGetLayoutContext.mockReturnValue(mockedDashboard);

  const { container } = render(
    <AvailableDashboardsContext.Provider value={{ updateDashboard: jest.fn() }}>
      <LayoutGridItemsContext.Provider
        value={{ gridItems: mockedDashboard.gridItems }}
      >
        <LayoutContext.Provider
          value={{
            setLayoutContext: mockSetLayoutContext,
            getLayoutContext: mockGetLayoutContext,
          }}
        >
          <EditingContext.Provider
            value={{ isEditing: true, setIsEditing: jest.fn() }}
          >
            <LayoutAlertContextProvider>
              <DashboardLayout />
            </LayoutAlertContextProvider>
          </EditingContext.Provider>
        </LayoutContext.Provider>
      </LayoutGridItemsContext.Provider>
    </AvailableDashboardsContext.Provider>
  );

  // eslint-disable-next-line
  const resizeSpan = container.querySelector(".react-resizable-handle");
  expect(resizeSpan).toBeInTheDocument();
  fireEvent.mouseDown(resizeSpan, { clientX: 0, clientY: 0 });
  fireEvent.mouseMove(resizeSpan, { clientX: 100, clientY: 0 });
  fireEvent.mouseUp(resizeSpan);

  expect(mockSetLayoutContext).toHaveBeenCalledWith({
    access_groups: [],
    editable: true,
    gridItems: [
      {
        args_string: "{}",
        h: 20,
        i: "1",
        metadata_string: JSON.stringify({
          enforceAspectRatio: true,
        }),
        source: "",
        w: 28,
        x: 0,
        y: 0,
      },
    ],
    id: 1,
    label: "test_label",
    name: "editable",
    notes: "test_notes",
  });
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

  const mockSetLayoutContext = jest.fn();
  const mockGetLayoutContext = jest.fn();
  mockGetLayoutContext.mockReturnValue(mockedDashboard);

  const { container } = render(
    <AvailableDashboardsContext.Provider value={{ updateDashboard: jest.fn() }}>
      <LayoutGridItemsContext.Provider
        value={{ gridItems: mockedDashboard.gridItems }}
      >
        <LayoutContext.Provider
          value={{
            setLayoutContext: mockSetLayoutContext,
            getLayoutContext: mockGetLayoutContext,
          }}
        >
          <EditingContext.Provider
            value={{ isEditing: true, setIsEditing: jest.fn() }}
          >
            <LayoutAlertContextProvider>
              <DashboardLayout />
            </LayoutAlertContextProvider>
          </EditingContext.Provider>
        </LayoutContext.Provider>
      </LayoutGridItemsContext.Provider>
    </AvailableDashboardsContext.Provider>
  );

  // eslint-disable-next-line
  const resizeSpan = container.querySelector(".react-resizable-handle");
  expect(resizeSpan).toBeInTheDocument();
  fireEvent.mouseDown(resizeSpan, { clientX: 0, clientY: 0 });
  fireEvent.mouseMove(resizeSpan, { clientX: 100, clientY: 0 });
  fireEvent.mouseUp(resizeSpan);

  expect(mockSetLayoutContext).toHaveBeenCalledWith({
    access_groups: [],
    editable: true,
    gridItems: [
      {
        args_string: "{}",
        h: 14,
        i: "1",
        metadata_string: JSON.stringify({
          enforceAspectRatio: true,
          aspectRatio: 2,
        }),
        source: "",
        w: 28,
        x: 0,
        y: 0,
      },
    ],
    id: 1,
    label: "test_label",
    name: "editable",
    notes: "test_notes",
  });

  fireEvent.mouseDown(resizeSpan, { clientX: 0, clientY: 0 });
  fireEvent.mouseMove(resizeSpan, { clientX: 0, clientY: 100 });
  fireEvent.mouseUp(resizeSpan);

  expect(mockSetLayoutContext).toHaveBeenCalledWith({
    access_groups: [],
    editable: true,
    gridItems: [
      {
        args_string: "{}",
        h: 24,
        i: "1",
        metadata_string: JSON.stringify({
          enforceAspectRatio: true,
          aspectRatio: 2,
        }),
        source: "",
        w: 48,
        x: 0,
        y: 0,
      },
    ],
    id: 1,
    label: "test_label",
    name: "editable",
    notes: "test_notes",
  });
});

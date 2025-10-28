/* eslint-disable react/prop-types */
import { render, screen } from "@testing-library/react";
import DashboardView from "views/Dashboard";
import { MemoryRouter } from "react-router-dom";
import {
  userDashboard,
  publicDashboard,
  editorDashboard,
  adminDashboard,
} from "__tests__/utilities/constants";

// Mock the child components
jest.mock("components/dashboard/DashboardTabs", () => {
  return function MockDashboardTabs() {
    return <div data-testid="dashboard-tabs">DashboardTabs</div>;
  };
});

jest.mock("components/dashboard/DashboardLayoutAlerts", () => {
  return function MockDashboardLayoutAlerts() {
    return (
      <div data-testid="dashboard-layout-alerts">DashboardLayoutAlerts</div>
    );
  };
});

jest.mock("components/contexts/LayoutAlertContext", () => {
  const actual = jest.requireActual("components/contexts/LayoutAlertContext");
  return {
    ...actual,
    __esModule: true,
    default: function MockLayoutAlertContextProvider({ children }) {
      return <div data-testid="layout-alert-context-provider">{children}</div>;
    },
  };
});

jest.mock("components/layout/Header", () => ({
  DashboardHeader: function MockDashboardHeader() {
    return <div data-testid="dashboard-header">DashboardHeader</div>;
  },
}));

jest.mock("components/loader/DashboardLoader", () => {
  return function MockDashboardLoader({ children, ...props }) {
    return (
      <div data-testid="dashboard-loader" data-props={JSON.stringify(props)}>
        {children}
      </div>
    );
  };
});

describe("DashboardView", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders all components in correct structure", async () => {
    const dashboardProps = {
      id: 1,
      name: "Test Dashboard",
      description: "Test Description",
      notes: "Test Notes",
      editable: true,
      publicDashboard: false,
      gridItems: [
        {
          id: 1,
          i: "1",
          x: 0,
          y: 0,
          w: 20,
          h: 20,
          source: "Test Source",
          args_string: '{"test": "value"}',
          metadata_string: '{"refreshRate": 0}',
        },
      ],
    };

    render(
      <MemoryRouter>
        <DashboardView {...dashboardProps} />
      </MemoryRouter>
    );

    // Verify DashboardLoader is rendered with correct props
    const dashboardLoader = screen.getByTestId("dashboard-loader");
    expect(dashboardLoader).toBeInTheDocument();

    const loaderProps = JSON.parse(dashboardLoader.getAttribute("data-props"));
    expect(loaderProps.id).toBe(1);
    expect(loaderProps.name).toBe("Test Dashboard");
    expect(loaderProps.description).toBe("Test Description");
    expect(loaderProps.notes).toBe("Test Notes");
    expect(loaderProps.editable).toBe(true);
    expect(loaderProps.publicDashboard).toBe(false);
    expect(loaderProps.gridItems).toEqual(dashboardProps.gridItems);

    // Verify component hierarchy
    expect(
      screen.getByTestId("layout-alert-context-provider")
    ).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-header")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-layout-alerts")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-tabs")).toBeInTheDocument();
  });

  test("renders with minimal props", () => {
    render(
      <MemoryRouter>
        <DashboardView />
      </MemoryRouter>
    );

    expect(screen.getByTestId("dashboard-loader")).toBeInTheDocument();
    expect(
      screen.getByTestId("layout-alert-context-provider")
    ).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-header")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-layout-alerts")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-tabs")).toBeInTheDocument();
  });

  test("renders with number id prop", () => {
    const dashboardProps = {
      id: 123,
    };

    render(
      <MemoryRouter>
        <DashboardView {...dashboardProps} />
      </MemoryRouter>
    );

    const dashboardLoader = screen.getByTestId("dashboard-loader");
    const loaderProps = JSON.parse(dashboardLoader.getAttribute("data-props"));
    expect(loaderProps.id).toBe(123);
  });

  test("renders with string name prop", () => {
    const dashboardProps = {
      name: "My Test Dashboard",
    };

    render(
      <MemoryRouter>
        <DashboardView {...dashboardProps} />
      </MemoryRouter>
    );

    const dashboardLoader = screen.getByTestId("dashboard-loader");
    const loaderProps = JSON.parse(dashboardLoader.getAttribute("data-props"));
    expect(loaderProps.name).toBe("My Test Dashboard");
  });

  test("renders with string description prop", () => {
    const dashboardProps = {
      description: "A detailed description of the dashboard",
    };

    render(
      <MemoryRouter>
        <DashboardView {...dashboardProps} />
      </MemoryRouter>
    );

    const dashboardLoader = screen.getByTestId("dashboard-loader");
    const loaderProps = JSON.parse(dashboardLoader.getAttribute("data-props"));
    expect(loaderProps.description).toBe(
      "A detailed description of the dashboard"
    );
  });

  test("renders with string notes prop", () => {
    const dashboardProps = {
      notes: "Important notes about this dashboard",
    };

    render(
      <MemoryRouter>
        <DashboardView {...dashboardProps} />
      </MemoryRouter>
    );

    const dashboardLoader = screen.getByTestId("dashboard-loader");
    const loaderProps = JSON.parse(dashboardLoader.getAttribute("data-props"));
    expect(loaderProps.notes).toBe("Important notes about this dashboard");
  });

  test("renders with editable boolean prop set to true", () => {
    const dashboardProps = {
      editable: true,
    };

    render(
      <MemoryRouter>
        <DashboardView {...dashboardProps} />
      </MemoryRouter>
    );

    const dashboardLoader = screen.getByTestId("dashboard-loader");
    const loaderProps = JSON.parse(dashboardLoader.getAttribute("data-props"));
    expect(loaderProps.editable).toBe(true);
  });

  test("renders with editable boolean prop set to false", () => {
    const dashboardProps = {
      editable: false,
    };

    render(
      <MemoryRouter>
        <DashboardView {...dashboardProps} />
      </MemoryRouter>
    );

    const dashboardLoader = screen.getByTestId("dashboard-loader");
    const loaderProps = JSON.parse(dashboardLoader.getAttribute("data-props"));
    expect(loaderProps.editable).toBe(false);
  });

  test("renders with publicDashboard boolean prop set to true", () => {
    const dashboardProps = {
      publicDashboard: true,
    };

    render(
      <MemoryRouter>
        <DashboardView {...dashboardProps} />
      </MemoryRouter>
    );

    const dashboardLoader = screen.getByTestId("dashboard-loader");
    const loaderProps = JSON.parse(dashboardLoader.getAttribute("data-props"));
    expect(loaderProps.publicDashboard).toBe(true);
  });

  test("renders with publicDashboard boolean prop set to false", () => {
    const dashboardProps = {
      publicDashboard: false,
    };

    render(
      <MemoryRouter>
        <DashboardView {...dashboardProps} />
      </MemoryRouter>
    );

    const dashboardLoader = screen.getByTestId("dashboard-loader");
    const loaderProps = JSON.parse(dashboardLoader.getAttribute("data-props"));
    expect(loaderProps.publicDashboard).toBe(false);
  });

  test("renders with empty gridItems array", () => {
    const dashboardProps = {
      gridItems: [],
    };

    render(
      <MemoryRouter>
        <DashboardView {...dashboardProps} />
      </MemoryRouter>
    );

    const dashboardLoader = screen.getByTestId("dashboard-loader");
    const loaderProps = JSON.parse(dashboardLoader.getAttribute("data-props"));
    expect(loaderProps.gridItems).toEqual([]);
  });

  test("renders with single gridItem", () => {
    const gridItem = {
      id: 1,
      i: "1",
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      source: "Test Source",
      args_string: '{"test": "value"}',
      metadata_string: '{"refreshRate": 0}',
    };

    const dashboardProps = {
      gridItems: [gridItem],
    };

    render(
      <MemoryRouter>
        <DashboardView {...dashboardProps} />
      </MemoryRouter>
    );

    const dashboardLoader = screen.getByTestId("dashboard-loader");
    const loaderProps = JSON.parse(dashboardLoader.getAttribute("data-props"));
    expect(loaderProps.gridItems).toEqual([gridItem]);
  });

  test("renders with multiple gridItems", () => {
    const gridItems = [
      {
        id: 1,
        i: "1",
        x: 0,
        y: 0,
        w: 20,
        h: 20,
        source: "Test Source 1",
        args_string: '{"test": "value1"}',
        metadata_string: '{"refreshRate": 0}',
      },
      {
        id: 2,
        i: "2",
        x: 20,
        y: 0,
        w: 20,
        h: 20,
        source: "Test Source 2",
        args_string: '{"test": "value2"}',
        metadata_string: '{"refreshRate": 5}',
      },
    ];

    const dashboardProps = {
      gridItems: gridItems,
    };

    render(
      <MemoryRouter>
        <DashboardView {...dashboardProps} />
      </MemoryRouter>
    );

    const dashboardLoader = screen.getByTestId("dashboard-loader");
    const loaderProps = JSON.parse(dashboardLoader.getAttribute("data-props"));
    expect(loaderProps.gridItems).toEqual(gridItems);
  });

  test("renders with gridItem containing all required properties", () => {
    const gridItem = {
      id: 999,
      i: "test-id",
      x: 10,
      y: 15,
      w: 30,
      h: 25,
      source: "Complex Source",
      args_string: '{"complex": "args", "nested": {"property": "value"}}',
      metadata_string: '{"refreshRate": 10, "enforceAspectRatio": true}',
    };

    const dashboardProps = {
      gridItems: [gridItem],
    };

    render(
      <MemoryRouter>
        <DashboardView {...dashboardProps} />
      </MemoryRouter>
    );

    const dashboardLoader = screen.getByTestId("dashboard-loader");
    const loaderProps = JSON.parse(dashboardLoader.getAttribute("data-props"));
    expect(loaderProps.gridItems[0]).toEqual(gridItem);
    expect(loaderProps.gridItems[0].id).toBe(999);
    expect(loaderProps.gridItems[0].i).toBe("test-id");
    expect(loaderProps.gridItems[0].x).toBe(10);
    expect(loaderProps.gridItems[0].y).toBe(15);
    expect(loaderProps.gridItems[0].w).toBe(30);
    expect(loaderProps.gridItems[0].h).toBe(25);
    expect(loaderProps.gridItems[0].source).toBe("Complex Source");
    expect(loaderProps.gridItems[0].args_string).toBe(
      '{"complex": "args", "nested": {"property": "value"}}'
    );
    expect(loaderProps.gridItems[0].metadata_string).toBe(
      '{"refreshRate": 10, "enforceAspectRatio": true}'
    );
  });

  test("renders with all props and complex data", () => {
    const complexGridItems = [
      {
        id: 1,
        i: "complex-1",
        x: 0,
        y: 0,
        w: 50,
        h: 30,
        source: "Plugin Source A",
        args_string:
          '{"url": "https://example.com", "params": {"key": "value"}}',
        metadata_string: '{"refreshRate": 30, "title": "Complex Item 1"}',
      },
      {
        id: 2,
        i: "complex-2",
        x: 50,
        y: 0,
        w: 50,
        h: 30,
        source: "Plugin Source B",
        args_string: '{"data": [1, 2, 3, 4, 5]}',
        metadata_string:
          '{"refreshRate": 0, "title": "Complex Item 2", "enforceAspectRatio": false}',
      },
    ];

    const dashboardProps = {
      id: 42,
      name: "Complex Dashboard",
      description: "This is a complex dashboard with multiple items",
      notes: "These are detailed notes about the dashboard functionality",
      editable: true,
      publicDashboard: false,
      gridItems: complexGridItems,
    };

    render(
      <MemoryRouter>
        <DashboardView {...dashboardProps} />
      </MemoryRouter>
    );

    const dashboardLoader = screen.getByTestId("dashboard-loader");
    const loaderProps = JSON.parse(dashboardLoader.getAttribute("data-props"));

    expect(loaderProps.id).toBe(42);
    expect(loaderProps.name).toBe("Complex Dashboard");
    expect(loaderProps.description).toBe(
      "This is a complex dashboard with multiple items"
    );
    expect(loaderProps.notes).toBe(
      "These are detailed notes about the dashboard functionality"
    );
    expect(loaderProps.editable).toBe(true);
    expect(loaderProps.publicDashboard).toBe(false);
    expect(loaderProps.gridItems).toEqual(complexGridItems);
    expect(loaderProps.gridItems).toHaveLength(2);

    // Verify all components are rendered
    expect(
      screen.getByTestId("layout-alert-context-provider")
    ).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-header")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-layout-alerts")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-tabs")).toBeInTheDocument();
  });

  test("renders with null and undefined props", () => {
    const dashboardProps = {
      id: null,
      name: undefined,
      description: null,
      notes: undefined,
      editable: null,
      publicDashboard: undefined,
      gridItems: null,
    };

    render(
      <MemoryRouter>
        <DashboardView {...dashboardProps} />
      </MemoryRouter>
    );

    const dashboardLoader = screen.getByTestId("dashboard-loader");
    const loaderProps = JSON.parse(dashboardLoader.getAttribute("data-props"));

    expect(loaderProps.id).toBeNull();
    expect("name" in loaderProps).toBe(false); // undefined props are not serialized
    expect(loaderProps.description).toBeNull();
    expect("notes" in loaderProps).toBe(false);
    expect(loaderProps.editable).toBeNull();
    expect("publicDashboard" in loaderProps).toBe(false);
    expect(loaderProps.gridItems).toBeNull();

    // Components should still render
    expect(
      screen.getByTestId("layout-alert-context-provider")
    ).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-header")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-layout-alerts")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-tabs")).toBeInTheDocument();
  });

  test("preserves original component structure without router", () => {
    // Test that the component doesn't require router to render basic structure
    const dashboardProps = {
      id: 1,
      name: "Test Dashboard",
    };

    render(<DashboardView {...dashboardProps} />);

    expect(screen.getByTestId("dashboard-loader")).toBeInTheDocument();
    expect(
      screen.getByTestId("layout-alert-context-provider")
    ).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-header")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-layout-alerts")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-tabs")).toBeInTheDocument();
  });

  // Test PropTypes validation by checking component renders without console errors
  test("accepts valid PropTypes", () => {
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const validProps = {
      id: 123,
      name: "Valid Dashboard",
      description: "Valid description",
      notes: "Valid notes",
      editable: true,
      publicDashboard: false,
      gridItems: [
        {
          id: 1,
          i: "1",
          x: 0,
          y: 0,
          w: 20,
          h: 20,
          source: "Valid Source",
          args_string: '{"valid": "args"}',
          metadata_string: '{"valid": "metadata"}',
        },
      ],
    };

    render(
      <MemoryRouter>
        <DashboardView {...validProps} />
      </MemoryRouter>
    );

    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  test("component renders with realistic dashboard data", () => {
    render(
      <MemoryRouter>
        <DashboardView {...userDashboard} />
      </MemoryRouter>
    );

    const dashboardLoader = screen.getByTestId("dashboard-loader");
    const loaderProps = JSON.parse(dashboardLoader.getAttribute("data-props"));
    expect(loaderProps.id).toBe(userDashboard.id);
    expect(loaderProps.name).toBe(userDashboard.name);
    expect(loaderProps.description).toBe(userDashboard.description);
  });

  test("component renders with public dashboard data", () => {
    render(
      <MemoryRouter>
        <DashboardView {...publicDashboard} />
      </MemoryRouter>
    );

    const dashboardLoader = screen.getByTestId("dashboard-loader");
    const loaderProps = JSON.parse(dashboardLoader.getAttribute("data-props"));
    expect(loaderProps.publicDashboard).toBe(true);
    expect(loaderProps.id).toBe(publicDashboard.id);
  });

  test("component renders with editor dashboard data", () => {
    render(
      <MemoryRouter>
        <DashboardView {...editorDashboard} />
      </MemoryRouter>
    );

    const dashboardLoader = screen.getByTestId("dashboard-loader");
    const loaderProps = JSON.parse(dashboardLoader.getAttribute("data-props"));
    expect(loaderProps.id).toBe(editorDashboard.id);
    expect(loaderProps.name).toBe(editorDashboard.name);
  });

  test("component renders with admin dashboard data", () => {
    render(
      <MemoryRouter>
        <DashboardView {...adminDashboard} />
      </MemoryRouter>
    );

    const dashboardLoader = screen.getByTestId("dashboard-loader");
    const loaderProps = JSON.parse(dashboardLoader.getAttribute("data-props"));
    expect(loaderProps.id).toBe(adminDashboard.id);
    expect(loaderProps.name).toBe(adminDashboard.name);
  });
});

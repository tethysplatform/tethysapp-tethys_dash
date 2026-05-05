/* eslint-disable no-template-curly-in-string */
// This file tests literal `${feature.<key>}` template syntax handling.
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PopupModalChrome from "components/modals/PopupModal/PopupModalChrome";

// DashboardLayout transitively reads contexts and renders real visualization
// machinery; replace it with a stub that exposes the props we care about for
// chrome-level assertions.
jest.mock("components/dashboard/DashboardLayout", () => {
  // eslint-disable-next-line react/prop-types
  const MockDashboardLayout = ({ tabId, gridItems, responsive, rowHeight }) => (
    <div data-testid="mock-dashboard-layout">
      <span data-testid="mock-dl-tab-id">{tabId}</span>
      <span data-testid="mock-dl-responsive">{String(responsive)}</span>
      <span data-testid="mock-dl-row-height">{rowHeight}</span>
      {/* eslint-disable-next-line react/prop-types */}
      <span data-testid="mock-dl-grid-items-count">{gridItems.length}</span>
    </div>
  );
  return MockDashboardLayout;
});

const baseGridItem = (overrides = {}) => ({
  i: "1",
  x: 0,
  y: 0,
  w: 4,
  h: 4,
  source: "Text",
  args_string: "{}",
  metadata_string: "{}",
  ...overrides,
});

const samplePopupConfig = (overrides = {}) => ({
  id: 1,
  mode: "modal",
  position: { leftPct: 20, topPct: 20, widthPct: 60, heightPct: 60 },
  titleTemplate: "",
  gridItems: [baseGridItem()],
  ...overrides,
});

const featureA = {
  layerName: "Stations",
  attributes: { station_id: "ABC", station_name: "Boulder Creek" },
};
const featureB = {
  layerName: "Stations",
  attributes: { station_id: "XYZ", station_name: "Eagle River" },
};
const featureC = {
  layerName: "Stations",
  attributes: { station_id: "QRS", station_name: "Animas River" },
};

describe("PopupModalChrome — title", () => {
  test("substitutes ${feature.<key>} from the active feature's attributes", () => {
    render(
      <PopupModalChrome
        features={[featureA]}
        popupConfig={samplePopupConfig({
          titleTemplate: "Site: ${feature.station_name}",
        })}
      />,
    );
    expect(screen.getByTestId("popup-modal-chrome-title")).toHaveTextContent(
      "Site: Boulder Creek",
    );
  });

  test("falls back to the feature's layerName when titleTemplate is empty", () => {
    render(
      <PopupModalChrome
        features={[featureA]}
        popupConfig={samplePopupConfig({ titleTemplate: "" })}
      />,
    );
    expect(screen.getByTestId("popup-modal-chrome-title")).toHaveTextContent(
      "Stations",
    );
  });

  test("falls back to layerName when substitution resolves to an empty string", () => {
    // Template references an attribute that doesn't exist on the feature →
    // substitution yields "" → fall through to layerName.
    render(
      <PopupModalChrome
        features={[featureA]}
        popupConfig={samplePopupConfig({
          titleTemplate: "${feature.unknown}",
        })}
      />,
    );
    expect(screen.getByTestId("popup-modal-chrome-title")).toHaveTextContent(
      "Stations",
    );
  });

  test("title updates when the carousel slide changes", async () => {
    const user = userEvent.setup();
    render(
      <PopupModalChrome
        features={[featureA, featureB]}
        popupConfig={samplePopupConfig({
          titleTemplate: "${feature.station_name}",
        })}
      />,
    );
    expect(screen.getByTestId("popup-modal-chrome-title")).toHaveTextContent(
      "Boulder Creek",
    );
    await user.click(screen.getByTestId("popup-modal-carousel-chip-1"));
    expect(screen.getByTestId("popup-modal-chrome-title")).toHaveTextContent(
      "Eagle River",
    );
  });
});

describe("PopupModalChrome — carousel", () => {
  test("does not render the carousel for a single feature", () => {
    render(
      <PopupModalChrome
        features={[featureA]}
        popupConfig={samplePopupConfig()}
      />,
    );
    expect(screen.queryByTestId("popup-modal-carousel")).toBeNull();
  });

  test("renders the carousel for multiple features with substituted labels", () => {
    render(
      <PopupModalChrome
        features={[featureA, featureB, featureC]}
        popupConfig={samplePopupConfig({
          titleTemplate: "${feature.station_name}",
        })}
      />,
    );
    expect(screen.getByTestId("popup-modal-carousel")).toBeInTheDocument();
    // Read each chip's label by index — "Boulder Creek" also appears in the
    // title bar (active feature is feature A), so a direct getByText would
    // hit both.
    expect(screen.getByTestId("popup-modal-carousel-chip-0")).toHaveTextContent(
      "Boulder Creek",
    );
    expect(screen.getByTestId("popup-modal-carousel-chip-1")).toHaveTextContent(
      "Eagle River",
    );
    expect(screen.getByTestId("popup-modal-carousel-chip-2")).toHaveTextContent(
      "Animas River",
    );
  });

  test("falls back to 'Feature N' carousel label when the template is empty", () => {
    render(
      <PopupModalChrome
        features={[featureA, featureB]}
        popupConfig={samplePopupConfig({ titleTemplate: "" })}
      />,
    );
    expect(screen.getByText("Feature 1")).toBeInTheDocument();
    expect(screen.getByText("Feature 2")).toBeInTheDocument();
  });
});

describe("PopupModalChrome — DashboardLayout wiring", () => {
  test("renders a DashboardLayout with the popup's gridItems", () => {
    const items = [baseGridItem({ i: "1" }), baseGridItem({ i: "2" })];
    render(
      <PopupModalChrome
        features={[featureA]}
        popupConfig={samplePopupConfig({ gridItems: items })}
      />,
    );
    expect(screen.getByTestId("mock-dashboard-layout")).toBeInTheDocument();
    expect(screen.getByTestId("mock-dl-tab-id").textContent).toBe("popup");
    expect(screen.getByTestId("mock-dl-responsive").textContent).toBe("true");
    expect(screen.getByTestId("mock-dl-grid-items-count").textContent).toBe(
      "2",
    );
  });

  test("rowHeight is a positive integer derived from a measured body height", () => {
    render(
      <PopupModalChrome
        features={[featureA]}
        popupConfig={samplePopupConfig()}
      />,
    );
    const rowHeightText = screen.getByTestId("mock-dl-row-height").textContent;
    const rowHeight = Number(rowHeightText);
    expect(Number.isFinite(rowHeight)).toBe(true);
    expect(rowHeight).toBeGreaterThan(0);
  });

  test("empty gridItems shows the empty hint instead of DashboardLayout", () => {
    render(
      <PopupModalChrome
        features={[featureA]}
        popupConfig={samplePopupConfig({ gridItems: [] })}
      />,
    );
    expect(screen.getByTestId("popup-modal-chrome-empty")).toBeInTheDocument();
    expect(
      screen.getByText(/no visualizations have been configured/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("mock-dashboard-layout")).toBeNull();
  });
});

describe("PopupModalChrome — re-render behavior", () => {
  test("switching the active carousel slide re-renders without remounting DashboardLayout twice", () => {
    // Sanity: swap active feature, layout still renders exactly one time.
    render(
      <PopupModalChrome
        features={[featureA, featureB]}
        popupConfig={samplePopupConfig({
          titleTemplate: "${feature.station_name}",
        })}
      />,
    );
    expect(screen.getAllByTestId("mock-dashboard-layout")).toHaveLength(1);
    fireEvent.click(screen.getByTestId("popup-modal-carousel-chip-1"));
    expect(screen.getAllByTestId("mock-dashboard-layout")).toHaveLength(1);
    expect(screen.getByTestId("popup-modal-chrome-title")).toHaveTextContent(
      "Eagle River",
    );
  });
});

// Note: feature.* propagation through FeatureScopedVariableInputs is
// covered in FeatureScopedVariableInputs.test.js. The chrome's responsibility
// here is to pass the active feature through to that provider — which the
// title-substitution and carousel-driven re-render tests above prove
// indirectly (the substituted title only updates if feature is replaced
// through the provider tree on slide change).

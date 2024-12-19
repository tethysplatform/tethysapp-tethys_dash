import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import selectEvent from "react-select-event";

import DashboardSelect from "components/inputs/DashboardSelect";

describe("DashboardSelect Component", () => {
  const options = [
    { value: "dashboard1", label: "Dashboard 1", color: "lightblue" },
    { value: "dashboard2", label: "Dashboard 2", color: "lightgreen" },
  ];

  it("renders the label correctly", () => {
    render(<DashboardSelect options={options} />);
    expect(screen.getByLabelText("Select/Add Dashboard:")).toBeInTheDocument();
  });

  it("renders the select component with provided options", async () => {
    render(<DashboardSelect options={options} />);
    const select = screen.getByLabelText("Select/Add Dashboard:");

    // Open the dropdown
    await selectEvent.openMenu(select);

    // Check if the options are rendered
    expect(screen.getByText("Dashboard 1")).toBeInTheDocument();
    expect(screen.getByText("Dashboard 2")).toBeInTheDocument();
  });

  it("selects an option from the dropdown", async () => {
    render(<DashboardSelect options={options} />);
    const select = screen.getByLabelText("Select/Add Dashboard:");

    // Select an option
    await selectEvent.select(select, "Dashboard 1");

    // Verify that the option is selected
    expect(screen.getByText("Dashboard 1")).toBeInTheDocument();
  });

  it("handles keyboard navigation", async () => {
    render(<DashboardSelect options={options} />);
    const select = screen.getByLabelText("Select/Add Dashboard:");

    // Open the dropdown
    await selectEvent.openMenu(select);

    // Navigate through the options using keyboard
    userEvent.keyboard("{ArrowDown}");
    userEvent.keyboard("{Enter}");

    // Verify the selected option
    expect(screen.getByText("Dashboard 1")).toBeInTheDocument();
  });

  it("displays a placeholder when no value is selected", () => {
    render(<DashboardSelect options={options} placeholder="Choose..." />);
    expect(screen.getByText("Choose...")).toBeInTheDocument();
  });
});

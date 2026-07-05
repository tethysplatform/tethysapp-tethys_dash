import { render, screen, fireEvent } from "@testing-library/react";
import SubplotToggleControl from "components/visualizations/SubplotToggleControl";

const panes = [
  { id: "x|y", label: "Temperature" },
  { id: "x2|y3", label: "Pressure" },
  { id: "x3|y5", label: "Wind" },
];

describe("SubplotToggleControl", () => {
  it("renders nothing when there are fewer than two panes", () => {
    const { container } = render(
      <SubplotToggleControl
        panes={[panes[0]]}
        visiblePaneIds={["x|y"]}
        onToggle={jest.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("keeps the checkbox list collapsed until the toggle button is clicked", () => {
    render(
      <SubplotToggleControl
        panes={panes}
        visiblePaneIds={panes.map((p) => p.id)}
        onToggle={jest.fn()}
      />,
    );
    expect(screen.queryByLabelText("Temperature")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Toggle subplots"));
    expect(screen.getByLabelText("Temperature")).toBeInTheDocument();
    expect(screen.getByLabelText("Wind")).toBeInTheDocument();
  });

  it("reflects visibility state and emits toggle events", () => {
    const onToggle = jest.fn();
    render(
      <SubplotToggleControl
        panes={panes}
        visiblePaneIds={["x|y", "x3|y5"]} // Pressure hidden
        onToggle={onToggle}
      />,
    );
    fireEvent.click(screen.getByLabelText("Toggle subplots"));

    expect(screen.getByLabelText("Temperature")).toBeChecked();
    expect(screen.getByLabelText("Pressure")).not.toBeChecked();

    fireEvent.click(screen.getByLabelText("Temperature")); // uncheck
    expect(onToggle).toHaveBeenCalledWith("x|y", false);

    fireEvent.click(screen.getByLabelText("Pressure")); // check
    expect(onToggle).toHaveBeenCalledWith("x2|y3", true);
  });
});

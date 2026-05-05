import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RampPicker from "components/modals/MapLayer/RampPicker";

const RAMP_NAMES = ["viridis", "turbo", "RdYlBu", "grayscale"];

describe("RampPicker", () => {
  test("renders all four ramp options by name", () => {
    render(<RampPicker selectedRamp={null} onChange={() => {}} />);

    for (const name of RAMP_NAMES) {
      expect(
        screen.getByRole("radio", { name: `Select ${name} ramp` }),
      ).toBeInTheDocument();
    }
  });

  test("each option has a gradient swatch element", () => {
    render(<RampPicker selectedRamp={null} onChange={() => {}} />);

    for (const name of RAMP_NAMES) {
      const swatch = screen.getByTestId(`ramp-swatch-${name}`);
      expect(swatch).toBeInTheDocument();
    }
  });

  test("clicking a ramp option calls onChange with the ramp name", async () => {
    const onChange = jest.fn();
    render(<RampPicker selectedRamp={null} onChange={onChange} />);

    await userEvent.click(screen.getByTestId("ramp-option-turbo"));
    expect(onChange).toHaveBeenCalledWith("turbo");

    await userEvent.click(screen.getByTestId("ramp-option-RdYlBu"));
    expect(onChange).toHaveBeenCalledWith("RdYlBu");
  });

  test("selectedRamp='viridis' marks viridis row as selected", () => {
    render(<RampPicker selectedRamp="viridis" onChange={() => {}} />);

    const viridis = screen.getByTestId("ramp-option-viridis");
    expect(viridis).toHaveAttribute("aria-checked", "true");
    expect(viridis).toHaveAttribute("data-selected", "true");

    const turbo = screen.getByTestId("ramp-option-turbo");
    expect(turbo).toHaveAttribute("aria-checked", "false");
  });

  test("selectedRamp=null marks no row as selected", () => {
    render(<RampPicker selectedRamp={null} onChange={() => {}} />);

    for (const name of RAMP_NAMES) {
      const row = screen.getByTestId(`ramp-option-${name}`);
      expect(row).toHaveAttribute("aria-checked", "false");
    }
  });

  test("keyboard Enter on a focused row fires onChange", async () => {
    const onChange = jest.fn();
    render(<RampPicker selectedRamp={null} onChange={onChange} />);

    const viridis = screen.getByTestId("ramp-option-viridis");
    viridis.focus();
    expect(viridis).toHaveFocus();

    await userEvent.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("viridis");
  });

  test("rows are button-like with accessible names", () => {
    render(<RampPicker selectedRamp={null} onChange={() => {}} />);

    for (const name of RAMP_NAMES) {
      const row = screen.getByRole("radio", { name: `Select ${name} ramp` });
      expect(row.tagName.toLowerCase()).toBe("button");
    }
  });

  test("picker container has role=radiogroup with accessible label", () => {
    render(<RampPicker selectedRamp={null} onChange={() => {}} />);

    const group = screen.getByRole("radiogroup", {
      name: /color ramp picker/i,
    });
    expect(group).toBeInTheDocument();
  });
});

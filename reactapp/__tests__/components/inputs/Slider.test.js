// Slider.test.jsx
import { act } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Slider from "components/inputs/Slider";

// Helper to advance timers in a controlled way
const advanceTimers = async (ms) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};

describe("Slider Component", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("renders with label and initial value (number mode)", () => {
    const handleChange = jest.fn();

    render(
      <Slider
        label="Test Slider"
        step={1}
        min={0}
        max={10}
        initialValue={5}
        outputFormat="{{n}}"
        dataType="Number"
        onChange={handleChange}
      />
    );

    expect(screen.getByText(/Test Slider/i)).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    // First onChange should fire on mount
    expect(handleChange).toHaveBeenCalledWith("5");
  });

  it("changes value when slider moved (number mode)", async () => {
    const handleChange = jest.fn();

    const { container } = render(
      <Slider
        step={1}
        min={0}
        max={10}
        initialValue={0}
        outputFormat="{{n}}"
        dataType="Number"
        onChange={handleChange}
      />
    );

    fireEvent.mouseDown(container.querySelector(".rc-slider"), {
      clientX: 5,
    });

    expect(handleChange).toHaveBeenLastCalledWith("10");
    expect(screen.getByLabelText("Display Value")).toHaveTextContent("10");
  });

  it("wraps to min when exceeding max in play mode (number mode)", async () => {
    const handleChange = jest.fn();

    render(
      <Slider
        step={2}
        min={0}
        max={4}
        initialValue={4}
        outputFormat="{{n}}"
        dataType="Number"
        onChange={handleChange}
        speeds={[{ label: "Fast", value: 100 }]}
      />
    );

    const playBtn = screen.getByRole("button", { name: /play/i });
    fireEvent.click(playBtn);

    await advanceTimers(100); // increment -> wrap to min
    expect(handleChange).toHaveBeenLastCalledWith("0");
  });

  it("renders and updates in date mode", () => {
    const handleChange = jest.fn();
    const min = "2025-01-01T00:00:00.000";
    const max = "2025-01-05T00:00:00.000";

    render(
      <Slider
        step={1}
        min={min}
        max={max}
        initialValue={min}
        outputFormat="yyyy-MM-dd"
        dataType="Date"
        dateTimeDelta="Days"
        onChange={handleChange}
      />
    );

    const minLabel = screen.getByText("2025-01-01", { selector: "strong" });
    expect(minLabel).toBeInTheDocument();
    const maxLabel = screen.getByText("2025-01-05", { selector: "strong" });
    expect(maxLabel).toBeInTheDocument();
    expect(handleChange).toHaveBeenCalledWith("2025-01-01");
  });

  it("increments dates correctly in play mode", async () => {
    const handleChange = jest.fn();
    const min = "2025-01-01T00:00:00.000";
    const max = "2025-01-03T00:00:00.000";

    render(
      <Slider
        step={1}
        min={min}
        max={max}
        initialValue={min}
        outputFormat="yyyy-MM-dd"
        dataType="Date"
        dateTimeDelta="Days"
        onChange={handleChange}
        speeds={[{ label: "Fast", value: 100 }]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /play/i }));
    await advanceTimers(100);

    // Date should increment by 1 day
    expect(handleChange).toHaveBeenLastCalledWith("2025-01-02");
  });

  it("stops playing when Stop button clicked", async () => {
    const handleChange = jest.fn();

    render(
      <Slider
        step={1}
        min={0}
        max={2}
        initialValue={0}
        outputFormat="{{n}}"
        dataType="Number"
        onChange={handleChange}
        speeds={[{ label: "Fast", value: 100 }]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /play/i }));
    fireEvent.click(screen.getByRole("button", { name: /stop/i }));

    await advanceTimers(300);
    // No further increments after stop
    expect(handleChange).toHaveBeenLastCalledWith("0");
  });

  it("changes speed when select updated", () => {
    render(
      <Slider
        step={1}
        min={0}
        max={10}
        initialValue={0}
        outputFormat="{{n}}"
        dataType="Number"
        onChange={() => {}}
      />
    );

    const select = screen.getByLabelText(/speed select/i);
    fireEvent.change(select, { target: { value: "200" } });
    expect(select.value).toBe("200");
  });
});

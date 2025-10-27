// Slider.test.jsx
import { act } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { spyElementPrototypes } from "rc-util/lib/test/domHook";
import Slider from "components/inputs/Slider";

// Helper to advance timers in a controlled way
const advanceTimers = async (ms) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};

describe("Slider Component", () => {
  beforeAll(() => {
    spyElementPrototypes(HTMLElement, {
      getBoundingClientRect: () => ({
        top: 0,
        bottom: 100,
        left: 0,
        right: 100,
        width: 100,
        height: 100,
      }),
    });
  });

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("renders with label and initial value (number mode)", () => {
    const handleChange = jest.fn();

    const { rerender } = render(
      <Slider
        label="Test Slider"
        step={1}
        min={0}
        max={10}
        initialValue={5}
        outputFormat="{{n:3}}F"
        dataType="Number"
        onChange={handleChange}
      />
    );

    expect(screen.getByText(/Test Slider/i)).toBeInTheDocument();
    expect(screen.getByText("000F")).toBeInTheDocument();
    expect(screen.getByText("010F")).toBeInTheDocument();
    expect(screen.getByText("005F")).toBeInTheDocument();
    // First onChange should fire on mount
    expect(handleChange).toHaveBeenCalledWith("005F");

    rerender(
      <Slider
        label="Test Slider"
        step={1}
        min={0}
        max={10}
        initialValue={7}
        outputFormat="{{n:3}}F"
        dataType="Number"
        onChange={handleChange}
      />
    );

    expect(screen.getByText("007F")).toBeInTheDocument();
    expect(handleChange).toHaveBeenCalledWith("007F");

    rerender(
      <Slider
        label="Test Slider"
        step={1}
        min={0}
        max={10}
        initialRange={7}
        rangeMode={true}
        outputFormat="{{n:3}}F"
        dataType="Number"
        onChange={handleChange}
      />
    );

    expect(screen.getByText("000F - 010F")).toBeInTheDocument();
    expect(handleChange).toHaveBeenCalledWith("000F,010F");
  });

  it("render slider and then change to rangemode", () => {
    const handleChange = jest.fn();

    const { rerender } = render(
      <Slider
        label="Test Slider"
        step={1}
        min={0}
        max={10}
        initialValue={5}
        outputFormat="{{n:3}}F"
        dataType="Number"
        onChange={handleChange}
      />
    );

    expect(screen.getByText(/Test Slider/i)).toBeInTheDocument();
    expect(screen.getByText("000F")).toBeInTheDocument();
    expect(screen.getByText("010F")).toBeInTheDocument();
    expect(screen.getByLabelText("Display Value")).toHaveTextContent("005F");
    // First onChange should fire on mount
    expect(handleChange).toHaveBeenCalledWith("005F");

    rerender(
      <Slider
        label="Test Slider"
        step={1}
        min={0}
        max={10}
        initialRange={[2, 8]}
        rangeMode={true}
        outputFormat="{{n:3}}F"
        dataType="Number"
        onChange={handleChange}
      />
    );

    expect(screen.getByLabelText("Display Value")).toHaveTextContent(
      "002F - 008F"
    );
    expect(handleChange).toHaveBeenCalledWith("002F,008F");

    rerender(
      <Slider
        label="Test Slider"
        step={1}
        min={0}
        max={10}
        initialRange={5}
        rangeMode={true}
        outputFormat="{{n:3}}F"
        dataType="Number"
        onChange={handleChange}
      />
    );

    expect(screen.getByLabelText("Display Value")).toHaveTextContent(
      "000F - 010F"
    );
    expect(handleChange).toHaveBeenCalledWith("000F,010F");

    rerender(
      <Slider
        label="Test Slider"
        step={1}
        min={0}
        max={10}
        initialRange={5}
        outputFormat="{{n:3}}F"
        dataType="Number"
        onChange={handleChange}
      />
    );

    expect(screen.getByLabelText("Display Value")).toHaveTextContent("000F");
    expect(handleChange).toHaveBeenCalledWith("000F");
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

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    fireEvent.mouseDown(container.querySelector(".rc-slider"), {
      clientX: 100,
    });

    expect(handleChange).toHaveBeenLastCalledWith("10");
    expect(screen.getByLabelText("Display Value")).toHaveTextContent("10");
  });

  it("go to first number step", async () => {
    const handleChange = jest.fn();

    render(
      <Slider
        step={1}
        min={0}
        max={10}
        initialValue={5}
        outputFormat="{{n}}"
        dataType="Number"
        onChange={handleChange}
      />
    );

    const firstStep = screen.getByLabelText("go to first");
    fireEvent.click(firstStep);

    expect(handleChange).toHaveBeenLastCalledWith("0");
    expect(screen.getByLabelText("Display Value")).toHaveTextContent("0");
  });

  it("go to first number step in rangemode", async () => {
    const handleChange = jest.fn();

    render(
      <Slider
        step={1}
        min={0}
        max={10}
        initialRange={[5, 8]}
        rangeMode={true}
        outputFormat="{{n}}"
        dataType="Number"
        onChange={handleChange}
      />
    );

    const firstStep = screen.getByLabelText("go to first");
    fireEvent.click(firstStep);

    expect(handleChange).toHaveBeenLastCalledWith("0,3");
    expect(screen.getByLabelText("Display Value")).toHaveTextContent("0 - 3");
  });

  it("go to previous number step", async () => {
    const handleChange = jest.fn();

    render(
      <Slider
        step={1}
        min={0}
        max={10}
        initialValue={5}
        outputFormat="{{n}}"
        dataType="Number"
        onChange={handleChange}
      />
    );

    const previousStep = screen.getByLabelText("previous step");
    fireEvent.click(previousStep);

    expect(handleChange).toHaveBeenLastCalledWith("4");
    expect(screen.getByLabelText("Display Value")).toHaveTextContent("4");
  });

  it("go to previous number step in rangemode", async () => {
    const handleChange = jest.fn();

    render(
      <Slider
        step={1}
        min={0}
        max={10}
        initialRange={[5, 8]}
        rangeMode={true}
        outputFormat="{{n}}"
        dataType="Number"
        onChange={handleChange}
      />
    );

    const previousStep = screen.getByLabelText("previous step");
    fireEvent.click(previousStep);

    expect(handleChange).toHaveBeenLastCalledWith("4,7");
    expect(screen.getByLabelText("Display Value")).toHaveTextContent("4 - 7");
  });

  it("go to next number step", async () => {
    const handleChange = jest.fn();

    render(
      <Slider
        step={1}
        min={0}
        max={10}
        initialValue={5}
        outputFormat="{{n}}"
        dataType="Number"
        onChange={handleChange}
      />
    );

    const nextStep = screen.getByLabelText("next step");
    fireEvent.click(nextStep);

    expect(handleChange).toHaveBeenLastCalledWith("6");
    expect(screen.getByLabelText("Display Value")).toHaveTextContent("6");
  });

  it("go to next number step in rangemode", async () => {
    const handleChange = jest.fn();

    render(
      <Slider
        step={1}
        min={0}
        max={10}
        initialRange={[5, 8]}
        rangeMode={true}
        outputFormat="{{n}}"
        dataType="Number"
        onChange={handleChange}
      />
    );

    const nextStep = screen.getByLabelText("next step");
    fireEvent.click(nextStep);

    expect(handleChange).toHaveBeenLastCalledWith("6,9");
    expect(screen.getByLabelText("Display Value")).toHaveTextContent("6 - 9");
  });

  it("go to last number step", async () => {
    const handleChange = jest.fn();

    render(
      <Slider
        step={1}
        min={0}
        max={10}
        initialValue={5}
        outputFormat="{{n}}"
        dataType="Number"
        onChange={handleChange}
      />
    );

    const lastStep = screen.getByLabelText("go to last");
    fireEvent.click(lastStep);

    expect(handleChange).toHaveBeenLastCalledWith("10");
    expect(screen.getByLabelText("Display Value")).toHaveTextContent("10");
  });

  it("go to last number step in rangemode", async () => {
    const handleChange = jest.fn();

    render(
      <Slider
        step={1}
        min={0}
        max={10}
        initialRange={[5, 8]}
        rangeMode={true}
        outputFormat="{{n}}"
        dataType="Number"
        onChange={handleChange}
      />
    );

    const lastStep = screen.getByLabelText("go to last");
    fireEvent.click(lastStep);

    expect(handleChange).toHaveBeenLastCalledWith("7,10");
    expect(screen.getByLabelText("Display Value")).toHaveTextContent("7 - 10");
  });

  it("go to first date step", async () => {
    const handleChange = jest.fn();
    const min = "2025-01-01T00:00:00.000";
    const max = "2025-01-05T00:00:00.000";

    render(
      <Slider
        step={1}
        min={min}
        max={max}
        initialValue={"2025-01-03T00:00:00.000"}
        outputFormat="yyyy-MM-dd"
        dataType="Date"
        dateTimeDelta="Days"
        onChange={handleChange}
      />
    );

    const firstStep = screen.getByLabelText("go to first");
    fireEvent.click(firstStep);

    expect(handleChange).toHaveBeenLastCalledWith("2025-01-01");
    expect(screen.getByLabelText("Display Value")).toHaveTextContent(
      "2025-01-01"
    );
  });

  it("go to first date step in rangemode", async () => {
    const handleChange = jest.fn();
    const min = "2025-01-01T00:00:00.000";
    const max = "2025-01-05T00:00:00.000";

    render(
      <Slider
        step={1}
        min={min}
        max={max}
        initialRange={["2025-01-03T00:00:00.000", "2025-01-04T00:00:00.000"]}
        rangeMode={true}
        outputFormat="yyyy-MM-dd"
        dataType="Date"
        dateTimeDelta="Days"
        onChange={handleChange}
      />
    );

    const firstStep = screen.getByLabelText("go to first");
    fireEvent.click(firstStep);

    expect(handleChange).toHaveBeenLastCalledWith("2025-01-01,2025-01-02");
    expect(screen.getByLabelText("Display Value")).toHaveTextContent(
      "2025-01-01 - 2025-01-02"
    );
  });

  it("go to previous date step", async () => {
    const handleChange = jest.fn();
    const min = "2025-01-01T00:00:00.000";
    const max = "2025-01-05T00:00:00.000";

    render(
      <Slider
        step={1}
        min={min}
        max={max}
        initialValue={"2025-01-03T00:00:00.000"}
        outputFormat="yyyy-MM-dd"
        dataType="Date"
        dateTimeDelta="Days"
        onChange={handleChange}
      />
    );

    const previousStep = screen.getByLabelText("previous step");
    fireEvent.click(previousStep);

    expect(handleChange).toHaveBeenLastCalledWith("2025-01-02");
    expect(screen.getByLabelText("Display Value")).toHaveTextContent(
      "2025-01-02"
    );
  });

  it("go to previous date step in rangemode", async () => {
    const handleChange = jest.fn();
    const min = "2025-01-01T00:00:00.000";
    const max = "2025-01-05T00:00:00.000";

    render(
      <Slider
        step={1}
        min={min}
        max={max}
        initialRange={["2025-01-03T00:00:00.000", "2025-01-04T00:00:00.000"]}
        rangeMode={true}
        outputFormat="yyyy-MM-dd"
        dataType="Date"
        dateTimeDelta="Days"
        onChange={handleChange}
      />
    );

    const previousStep = screen.getByLabelText("previous step");
    fireEvent.click(previousStep);

    expect(handleChange).toHaveBeenLastCalledWith("2025-01-02,2025-01-03");
    expect(screen.getByLabelText("Display Value")).toHaveTextContent(
      "2025-01-02 - 2025-01-03"
    );
  });

  it("go to next date step", async () => {
    const handleChange = jest.fn();
    const min = "2025-01-01T00:00:00.000";
    const max = "2025-01-05T00:00:00.000";

    render(
      <Slider
        step={1}
        min={min}
        max={max}
        initialValue={"2025-01-03T00:00:00.000"}
        outputFormat="yyyy-MM-dd"
        dataType="Date"
        dateTimeDelta="Days"
        onChange={handleChange}
      />
    );

    const nextStep = screen.getByLabelText("next step");
    fireEvent.click(nextStep);

    expect(handleChange).toHaveBeenLastCalledWith("2025-01-04");
    expect(screen.getByLabelText("Display Value")).toHaveTextContent(
      "2025-01-04"
    );
  });

  it("go to next date step in rangemode", async () => {
    const handleChange = jest.fn();
    const min = "2025-01-01T00:00:00.000";
    const max = "2025-01-05T00:00:00.000";

    render(
      <Slider
        step={1}
        min={min}
        max={max}
        initialRange={["2025-01-03T00:00:00.000", "2025-01-04T00:00:00.000"]}
        rangeMode={true}
        outputFormat="yyyy-MM-dd"
        dataType="Date"
        dateTimeDelta="Days"
        onChange={handleChange}
      />
    );

    const nextStep = screen.getByLabelText("next step");
    fireEvent.click(nextStep);

    expect(handleChange).toHaveBeenLastCalledWith("2025-01-04,2025-01-05");
    expect(screen.getByLabelText("Display Value")).toHaveTextContent(
      "2025-01-04 - 2025-01-05"
    );
  });

  it("go to last date step", async () => {
    const handleChange = jest.fn();
    const min = "2025-01-01T00:00:00.000";
    const max = "2025-01-05T00:00:00.000";

    render(
      <Slider
        step={1}
        min={min}
        max={max}
        initialValue={"2025-01-03T00:00:00.000"}
        outputFormat="yyyy-MM-dd"
        dataType="Date"
        dateTimeDelta="Days"
        onChange={handleChange}
      />
    );

    const lastStep = screen.getByLabelText("go to last");
    fireEvent.click(lastStep);

    expect(handleChange).toHaveBeenLastCalledWith("2025-01-05");
    expect(screen.getByLabelText("Display Value")).toHaveTextContent(
      "2025-01-05"
    );
  });

  it("go to last date step in rangemode", async () => {
    const handleChange = jest.fn();
    const min = "2025-01-01T00:00:00.000";
    const max = "2025-01-05T00:00:00.000";

    render(
      <Slider
        step={1}
        min={min}
        max={max}
        initialRange={["2025-01-03T00:00:00.000", "2025-01-04T00:00:00.000"]}
        rangeMode={true}
        outputFormat="yyyy-MM-dd"
        dataType="Date"
        dateTimeDelta="Days"
        onChange={handleChange}
      />
    );

    const lastStep = screen.getByLabelText("go to last");
    fireEvent.click(lastStep);

    expect(handleChange).toHaveBeenLastCalledWith("2025-01-04,2025-01-05");
    expect(screen.getByLabelText("Display Value")).toHaveTextContent(
      "2025-01-04 - 2025-01-05"
    );
  });

  it("changes value when slider moved (date mode)", async () => {
    const handleChange = jest.fn();
    const min = "2025-01-01T00:00:00.000";
    const max = "2025-01-05T00:00:00.000";

    const { container } = render(
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

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    fireEvent.mouseDown(container.querySelector(".rc-slider"), {
      clientX: 100,
    });

    expect(handleChange).toHaveBeenLastCalledWith("2025-01-05");
    expect(screen.getByLabelText("Display Value")).toHaveTextContent(
      "2025-01-05"
    );
  });

  it("changes value when slider moved in range mode (date mode)", async () => {
    const handleChange = jest.fn();
    const min = "2025-01-01T00:00:00.000";
    const max = "2025-01-10T00:00:00.000";
    const initialRange = ["2025-01-08T00:00:00.000", "2025-01-09T00:00:00.000"];

    const { container } = render(
      <Slider
        step={1}
        min={min}
        max={max}
        outputFormat="yyyy-MM-dd"
        dataType="Date"
        dateTimeDelta="Days"
        onChange={handleChange}
        speeds={[{ label: "Fast", value: 100 }]}
        rangeMode={true}
        initialRange={initialRange}
      />
    );

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    fireEvent.mouseDown(container.querySelector(".rc-slider"), {
      clientX: 100,
    });

    expect(handleChange).toHaveBeenLastCalledWith("2025-01-08,2025-01-10");
    expect(screen.getByLabelText("Display Value")).toHaveTextContent(
      "2025-01-08 - 2025-01-10"
    );
  });

  it("changes value when slider moved in range mode (number mode)", async () => {
    const handleChange = jest.fn();
    const min = 0;
    const max = 10;
    const initialRange = [7, 9];

    const { container } = render(
      <Slider
        step={1}
        min={min}
        max={max}
        outputFormat="{{n}}"
        dataType="Number"
        onChange={handleChange}
        speeds={[{ label: "Fast", value: 100 }]}
        rangeMode={true}
        initialRange={initialRange}
      />
    );

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    fireEvent.mouseDown(container.querySelector(".rc-slider"), {
      clientX: 100,
    });

    expect(handleChange).toHaveBeenLastCalledWith("7,10");
    expect(screen.getByLabelText("Display Value")).toHaveTextContent("7 - 10");
  });

  it("wraps to min when exceeding max in play mode (number mode)", async () => {
    const handleChange = jest.fn();

    render(
      <Slider
        step={1}
        min={0}
        max={4}
        initialValue={3}
        outputFormat="{{n}}"
        dataType="Number"
        onChange={handleChange}
        speeds={[{ label: "Fast", value: 100 }]}
      />
    );

    const playBtn = screen.getByRole("button", { name: /play/i });
    fireEvent.click(playBtn);

    await advanceTimers(100);
    expect(handleChange).toHaveBeenLastCalledWith("4");

    await advanceTimers(100); // increment -> wrap to min
    expect(handleChange).toHaveBeenLastCalledWith("0");
  });

  it("wraps to min when exceeding max in play mode (date mode)", async () => {
    const handleChange = jest.fn();
    const min = "2025-01-01T00:00:00.000";
    const max = "2025-01-05T00:00:00.000";

    render(
      <Slider
        step={1}
        min={min}
        max={max}
        initialValue={"2025-01-04T00:00:00.000"}
        outputFormat="yyyy-MM-dd"
        dataType="Date"
        dateTimeDelta="Days"
        onChange={handleChange}
        speeds={[{ label: "Fast", value: 100 }]}
      />
    );

    const playBtn = screen.getByRole("button", { name: /play/i });
    fireEvent.click(playBtn);

    await advanceTimers(100);
    expect(handleChange).toHaveBeenLastCalledWith("2025-01-05");

    await advanceTimers(100); // increment -> wrap to min
    expect(handleChange).toHaveBeenLastCalledWith("2025-01-01");
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

  it("renders and updates in date mode bad format", () => {
    const handleChange = jest.fn();
    const min = "2025-01-01T00:00:00.000";
    const max = "2025-01-05T00:00:00.000";

    render(
      <Slider
        step={1}
        min={min}
        max={max}
        initialValue={min}
        outputFormat="YY"
        dataType="Date"
        dateTimeDelta="Days"
        onChange={handleChange}
      />
    );

    const minLabel = screen.getByLabelText("Min Value");
    expect(
      within(minLabel).getByText("2025-01-01T00:00:00.000")
    ).toBeInTheDocument();

    const maxLabel = screen.getByLabelText("Max Value");
    expect(
      within(maxLabel).getByText("2025-01-05T00:00:00.000")
    ).toBeInTheDocument();

    expect(handleChange).toHaveBeenCalledWith("2025-01-01T00:00:00.000");
  });

  it("increments dates correctly in play mode in range mode", async () => {
    const handleChange = jest.fn();
    const min = "2025-01-01T00:00:00.000";
    const max = "2025-01-10T00:00:00.000";
    const initialRange = ["2025-01-08T00:00:00.000", "2025-01-09T00:00:00.000"];

    render(
      <Slider
        step={1}
        min={min}
        max={max}
        outputFormat="yyyy-MM-dd"
        dataType="Date"
        dateTimeDelta="Days"
        onChange={handleChange}
        speeds={[{ label: "Fast", value: 100 }]}
        rangeMode={true}
        initialRange={initialRange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /play/i }));
    await advanceTimers(100);

    // Date should increment by 1 day
    expect(screen.getByLabelText("Display Value")).toHaveTextContent(
      "2025-01-09 - 2025-01-10"
    );
    expect(handleChange).toHaveBeenLastCalledWith("2025-01-09,2025-01-10");

    await advanceTimers(100);

    // Date should increment by 1 day
    expect(screen.getByLabelText("Display Value")).toHaveTextContent(
      "2025-01-01 - 2025-01-02"
    );
    expect(handleChange).toHaveBeenLastCalledWith("2025-01-01,2025-01-02");
  });

  it("increments numbers correctly in play mode in range mode", async () => {
    const handleChange = jest.fn();
    const min = 0;
    const max = 10;
    const initialRange = [7, 9];

    render(
      <Slider
        step={1}
        min={min}
        max={max}
        outputFormat="{{n}}"
        dataType="Number"
        onChange={handleChange}
        speeds={[{ label: "Fast", value: 100 }]}
        rangeMode={true}
        initialRange={initialRange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /play/i }));
    await advanceTimers(100);

    // Date should increment by 1 day
    expect(screen.getByLabelText("Display Value")).toHaveTextContent("8 - 10");
    expect(handleChange).toHaveBeenLastCalledWith("8,10");

    await advanceTimers(100);

    // Date should increment by 1 day
    expect(screen.getByLabelText("Display Value")).toHaveTextContent("0 - 2");
    expect(handleChange).toHaveBeenLastCalledWith("0,2");
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

  it("renders and updates in date mode, no date value", () => {
    const handleChange = jest.fn();
    const min = "2025-01-01T00:00:00.000";
    const max = "2025-01-05T00:00:00.000";

    render(
      <Slider
        step={1}
        min={min}
        max={max}
        initialValue={""}
        outputFormat="yyyy-MM-dd"
        dataType="Date"
        dateTimeDelta="Days"
        onChange={handleChange}
      />
    );

    const minLabel = screen.getByLabelText("Min Value");
    expect(within(minLabel).getByText("2025-01-01")).toBeInTheDocument();

    const maxLabel = screen.getByLabelText("Max Value");
    expect(within(maxLabel).getByText("2025-01-05")).toBeInTheDocument();

    expect(screen.getByLabelText("Display Value")).toHaveTextContent("");
    expect(handleChange).toHaveBeenCalledWith("");
  });

  it("renders with label but missing initial values", () => {
    const handleChange = jest.fn();

    render(
      <Slider
        label="Test Slider"
        step={1}
        min={0}
        max={10}
        outputFormat="{{n}}"
        dataType="Number"
        onChange={handleChange}
      />
    );

    const minLabel = screen.getByLabelText("Min Value");
    expect(within(minLabel).getByText("0")).toBeInTheDocument();

    const maxLabel = screen.getByLabelText("Max Value");
    expect(within(maxLabel).getByText("10")).toBeInTheDocument();

    expect(screen.getByLabelText("Display Value")).toHaveTextContent("0");

    expect(handleChange).toHaveBeenCalledWith("0");
  });

  it("renders with label and rangemode but missing initial values", () => {
    const handleChange = jest.fn();

    render(
      <Slider
        label="Test Slider"
        step={1}
        min={0}
        max={10}
        outputFormat="{{n}}"
        dataType="Number"
        onChange={handleChange}
        rangeMode={true}
      />
    );

    const minLabel = screen.getByLabelText("Min Value");
    expect(within(minLabel).getByText("0")).toBeInTheDocument();

    const maxLabel = screen.getByLabelText("Max Value");
    expect(within(maxLabel).getByText("10")).toBeInTheDocument();

    expect(screen.getByLabelText("Display Value")).toHaveTextContent("0 - 10");

    expect(handleChange).toHaveBeenCalledWith("0,10");
  });
});

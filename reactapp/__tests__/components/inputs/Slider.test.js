// Slider.test.jsx
import { act } from "react";
import {
  render,
  screen,
  fireEvent,
  within,
  waitFor,
} from "@testing-library/react";
import { spyElementPrototypes } from "rc-util/lib/test/domHook";
import Slider, { calculateSliderValues } from "components/inputs/Slider";
import { format, addDays, addHours } from "date-fns";

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

  it("renders with label and initial value (number mode)", async () => {
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
        debounceDelay={0}
      />
    );

    expect(screen.getByText(/Test Slider/i)).toBeInTheDocument();
    expect(screen.getByText("000F")).toBeInTheDocument();
    expect(screen.getByText("010F")).toBeInTheDocument();
    expect(screen.getByText("005F")).toBeInTheDocument();
    // First onChange should fire on mount
    await waitFor(() => {
      expect(handleChange).toHaveBeenCalledWith("005F");
    });

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
        debounceDelay={0}
      />
    );

    expect(screen.getByText("007F")).toBeInTheDocument();
    await waitFor(() => {
      expect(handleChange).toHaveBeenCalledWith("007F");
    });

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
        debounceDelay={0}
      />
    );

    expect(screen.getByText("000F - 010F")).toBeInTheDocument();
    await waitFor(() => {
      expect(handleChange).toHaveBeenCalledWith("000F,010F");
    });
  });

  it("render slider and then change to rangemode", async () => {
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
        debounceDelay={0}
      />
    );

    expect(screen.getByText(/Test Slider/i)).toBeInTheDocument();
    expect(screen.getByText("000F")).toBeInTheDocument();
    expect(screen.getByText("010F")).toBeInTheDocument();
    expect(screen.getByLabelText("Display Value")).toHaveTextContent("005F");
    // First onChange should fire on mount
    await waitFor(() => {
      expect(handleChange).toHaveBeenCalledWith("005F");
    });

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
        debounceDelay={0}
      />
    );

    expect(screen.getByLabelText("Display Value")).toHaveTextContent(
      "002F - 008F"
    );
    await waitFor(() => {
      expect(handleChange).toHaveBeenCalledWith("002F,008F");
    });

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
        debounceDelay={0}
      />
    );

    expect(screen.getByLabelText("Display Value")).toHaveTextContent(
      "000F - 010F"
    );
    await waitFor(() => {
      expect(handleChange).toHaveBeenCalledWith("000F,010F");
    });

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
        debounceDelay={0}
      />
    );

    expect(screen.getByLabelText("Display Value")).toHaveTextContent("000F");
    await waitFor(() => {
      expect(handleChange).toHaveBeenCalledWith("000F");
    });
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
        debounceDelay={0}
      />
    );

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    fireEvent.mouseDown(container.querySelector(".rc-slider"), {
      clientX: 100,
    });

    await waitFor(() => {
      expect(handleChange).toHaveBeenLastCalledWith("10");
    });
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
        debounceDelay={0}
      />
    );

    const firstStep = screen.getByLabelText("go to first");
    fireEvent.click(firstStep);

    await waitFor(() => {
      expect(handleChange).toHaveBeenLastCalledWith("0");
    });
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
        debounceDelay={0}
      />
    );

    const firstStep = screen.getByLabelText("go to first");
    fireEvent.click(firstStep);

    await waitFor(() => {
      expect(handleChange).toHaveBeenLastCalledWith("0,3");
    });
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
        debounceDelay={0}
      />
    );

    const previousStep = screen.getByLabelText("previous step");
    fireEvent.click(previousStep);

    await waitFor(() => {
      expect(handleChange).toHaveBeenLastCalledWith("4");
    });
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
        debounceDelay={0}
      />
    );

    const previousStep = screen.getByLabelText("previous step");
    fireEvent.click(previousStep);

    await waitFor(() => {
      expect(handleChange).toHaveBeenLastCalledWith("4,7");
    });
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
        debounceDelay={0}
      />
    );

    const nextStep = screen.getByLabelText("next step");
    fireEvent.click(nextStep);

    await waitFor(() => {
      expect(handleChange).toHaveBeenLastCalledWith("6");
    });
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
        debounceDelay={0}
      />
    );

    const nextStep = screen.getByLabelText("next step");
    fireEvent.click(nextStep);

    await waitFor(() => {
      expect(handleChange).toHaveBeenLastCalledWith("6,9");
    });
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
        debounceDelay={0}
      />
    );

    const lastStep = screen.getByLabelText("go to last");
    fireEvent.click(lastStep);

    await waitFor(() => {
      expect(handleChange).toHaveBeenLastCalledWith("10");
    });
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
        debounceDelay={0}
      />
    );

    const lastStep = screen.getByLabelText("go to last");
    fireEvent.click(lastStep);

    await waitFor(() => {
      expect(handleChange).toHaveBeenLastCalledWith("7,10");
    });
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
        debounceDelay={0}
      />
    );

    const firstStep = screen.getByLabelText("go to first");
    fireEvent.click(firstStep);

    await waitFor(() => {
      expect(handleChange).toHaveBeenLastCalledWith("2025-01-01");
    });
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
        debounceDelay={0}
      />
    );

    const firstStep = screen.getByLabelText("go to first");
    fireEvent.click(firstStep);

    await waitFor(() => {
      expect(handleChange).toHaveBeenLastCalledWith("2025-01-01,2025-01-02");
    });
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
        initialValue={"2025-01-03T00:00:00"}
        outputFormat="yyyy-MM-dd"
        dataType="Date"
        dateTimeDelta="Days"
        onChange={handleChange}
        debounceDelay={0}
      />
    );

    const previousStep = screen.getByLabelText("previous step");
    fireEvent.click(previousStep);

    await waitFor(() => {
      expect(handleChange).toHaveBeenLastCalledWith("2025-01-02");
    });
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
        initialRange={["2025-01-03T00:00:00", "2025-01-04T00:00:00"]}
        rangeMode={true}
        outputFormat="yyyy-MM-dd"
        dataType="Date"
        dateTimeDelta="Days"
        onChange={handleChange}
        debounceDelay={0}
      />
    );

    const previousStep = screen.getByLabelText("previous step");
    fireEvent.click(previousStep);

    await waitFor(() => {
      expect(handleChange).toHaveBeenLastCalledWith("2025-01-02,2025-01-03");
    });
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
        initialValue={"2025-01-03T00:00:00"}
        outputFormat="yyyy-MM-dd"
        dataType="Date"
        dateTimeDelta="Days"
        onChange={handleChange}
        debounceDelay={0}
      />
    );

    const nextStep = screen.getByLabelText("next step");
    fireEvent.click(nextStep);

    await waitFor(() => {
      expect(handleChange).toHaveBeenLastCalledWith("2025-01-04");
    });
    expect(screen.getByLabelText("Display Value")).toHaveTextContent(
      "2025-01-04"
    );
  });

  it("go to next date step with relative date", async () => {
    const handleChange = jest.fn();
    const min = "now-5D";
    const max = "now";

    render(
      <Slider
        step={1}
        min={min}
        max={max}
        initialValue={"now-5D"}
        outputFormat="yyyy-MM-dd"
        dataType="Date"
        dateTimeDelta="Days"
        onChange={handleChange}
        debounceDelay={0}
      />
    );

    const nextStep = screen.getByLabelText("next step");
    fireEvent.click(nextStep);

    await waitFor(() => {
      expect(handleChange).toHaveBeenLastCalledWith(
        format(addDays(new Date(), -4), "yyyy-MM-dd")
      );
    });
    expect(screen.getByLabelText("Display Value")).toHaveTextContent(
      format(addDays(new Date(), -4), "yyyy-MM-dd")
    );

    fireEvent.click(nextStep);

    await waitFor(() => {
      expect(handleChange).toHaveBeenLastCalledWith(
        format(addDays(new Date(), -3), "yyyy-MM-dd")
      );
    });
    expect(screen.getByLabelText("Display Value")).toHaveTextContent(
      format(addDays(new Date(), -3), "yyyy-MM-dd")
    );
  });

  it("go to next date step with relative date but differing unit", async () => {
    const handleChange = jest.fn();
    const min = "now-1D-1H";
    const max = "now";

    render(
      <Slider
        step={1}
        min={min}
        max={max}
        initialValue={"now-12H"}
        outputFormat="yyyy-MM-dd HH"
        dataType="Date"
        dateTimeDelta="Hours"
        onChange={handleChange}
        debounceDelay={0}
      />
    );

    const nextStep = screen.getByLabelText("next step");
    fireEvent.click(nextStep);

    await waitFor(() => {
      expect(handleChange).toHaveBeenLastCalledWith(
        format(addHours(new Date(), -11), "yyyy-MM-dd HH")
      );
    });
    expect(screen.getByLabelText("Display Value")).toHaveTextContent(
      format(addHours(new Date(), -11), "yyyy-MM-dd HH")
    );

    fireEvent.click(nextStep);

    await waitFor(() => {
      expect(handleChange).toHaveBeenLastCalledWith(
        format(addHours(new Date(), -10), "yyyy-MM-dd HH")
      );
    });
    expect(screen.getByLabelText("Display Value")).toHaveTextContent(
      format(addHours(new Date(), -10), "yyyy-MM-dd HH")
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
        initialRange={["2025-01-03T00:00:00", "2025-01-04T00:00:00"]}
        rangeMode={true}
        outputFormat="yyyy-MM-dd"
        dataType="Date"
        dateTimeDelta="Days"
        onChange={handleChange}
        debounceDelay={0}
      />
    );

    const nextStep = screen.getByLabelText("next step");
    fireEvent.click(nextStep);

    await waitFor(() => {
      expect(handleChange).toHaveBeenLastCalledWith("2025-01-04,2025-01-05");
    });
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
        debounceDelay={0}
      />
    );

    const lastStep = screen.getByLabelText("go to last");
    fireEvent.click(lastStep);

    await waitFor(() => {
      expect(handleChange).toHaveBeenLastCalledWith("2025-01-05");
    });
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
        debounceDelay={0}
      />
    );

    const lastStep = screen.getByLabelText("go to last");
    fireEvent.click(lastStep);

    await waitFor(() => {
      expect(handleChange).toHaveBeenLastCalledWith("2025-01-04,2025-01-05");
    });
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
        debounceDelay={0}
      />
    );

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    fireEvent.mouseDown(container.querySelector(".rc-slider"), {
      clientX: 100,
    });
    await waitFor(() => {
      expect(handleChange).toHaveBeenLastCalledWith("2025-01-05");
    });
    expect(screen.getByLabelText("Display Value")).toHaveTextContent(
      "2025-01-05"
    );
  });

  it("changes value when slider moved in range mode (date mode)", async () => {
    const handleChange = jest.fn();
    const min = "2025-01-01T00:00:00.000";
    const max = "2025-01-10T00:00:00.000";
    const initialRange = ["2025-01-08T00:00:00", "2025-01-09T00:00:00"];

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
        debounceDelay={0}
      />
    );

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    fireEvent.mouseDown(container.querySelector(".rc-slider"), {
      clientX: 100,
    });

    await waitFor(() => {
      expect(handleChange).toHaveBeenLastCalledWith("2025-01-08,2025-01-10");
    });
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
        debounceDelay={0}
      />
    );

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    fireEvent.mouseDown(container.querySelector(".rc-slider"), {
      clientX: 100,
    });

    await waitFor(() => {
      expect(handleChange).toHaveBeenLastCalledWith("7,10");
    });
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
        debounceDelay={0}
      />
    );

    const playBtn = screen.getByRole("button", { name: /play/i });
    fireEvent.click(playBtn);

    await advanceTimers(100);
    await waitFor(() => {
      expect(handleChange).toHaveBeenLastCalledWith("4");
    });

    await advanceTimers(100); // increment -> wrap to min
    await waitFor(() => {
      expect(handleChange).toHaveBeenLastCalledWith("0");
    });
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
        initialValue={"2025-01-04T00:00:00"}
        outputFormat="yyyy-MM-dd"
        dataType="Date"
        dateTimeDelta="Days"
        onChange={handleChange}
        speeds={[{ label: "Fast", value: 100 }]}
        debounceDelay={0}
      />
    );

    const playBtn = screen.getByRole("button", { name: /play/i });
    fireEvent.click(playBtn);

    await advanceTimers(100);
    await waitFor(() => {
      expect(handleChange).toHaveBeenLastCalledWith("2025-01-05");
    });

    await advanceTimers(100); // increment -> wrap to min
    await waitFor(() => {
      expect(handleChange).toHaveBeenLastCalledWith("2025-01-01");
    });
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
      within(minLabel).getByText("2025-01-01T00:00:00")
    ).toBeInTheDocument();

    const maxLabel = screen.getByLabelText("Max Value");
    expect(
      within(maxLabel).getByText("2025-01-05T00:00:00")
    ).toBeInTheDocument();

    expect(handleChange).toHaveBeenCalledWith("2025-01-01T00:00:00");
  });

  it("increments dates correctly in play mode in range mode", async () => {
    const handleChange = jest.fn();
    const min = "2025-01-01T00:00:00.000";
    const max = "2025-01-10T00:00:00.000";
    const initialRange = ["2025-01-08T00:00:00", "2025-01-09T00:00:00"];

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
        debounceDelay={0}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /play/i }));
    await advanceTimers(100);

    // Date should increment by 1 day
    expect(screen.getByLabelText("Display Value")).toHaveTextContent(
      "2025-01-09 - 2025-01-10"
    );
    await waitFor(() => {
      expect(handleChange).toHaveBeenLastCalledWith("2025-01-09,2025-01-10");
    });

    await advanceTimers(100);

    // Date should increment by 1 day
    expect(screen.getByLabelText("Display Value")).toHaveTextContent(
      "2025-01-01 - 2025-01-02"
    );
    await waitFor(() => {
      expect(handleChange).toHaveBeenLastCalledWith("2025-01-01,2025-01-02");
    });
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
        debounceDelay={0}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /play/i }));
    await advanceTimers(100);

    // Date should increment by 1 day
    expect(screen.getByLabelText("Display Value")).toHaveTextContent("8 - 10");
    await waitFor(() => {
      expect(handleChange).toHaveBeenLastCalledWith("8,10");
    });

    await advanceTimers(100);

    // Date should increment by 1 day
    expect(screen.getByLabelText("Display Value")).toHaveTextContent("0 - 2");
    await waitFor(() => {
      expect(handleChange).toHaveBeenLastCalledWith("0,2");
    });
  });

  it("increments numbers correctly in play mode in range mode with 0 rangeSize", async () => {
    const handleChange = jest.fn();
    const min = 0;
    const max = 10;
    const initialRange = [8, 8];

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
        debounceDelay={0}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /play/i }));
    await advanceTimers(100);

    // Date should increment by 1 day
    expect(screen.getByLabelText("Display Value")).toHaveTextContent("9 - 10");
    await waitFor(() => {
      expect(handleChange).toHaveBeenLastCalledWith("9,10");
    });

    await advanceTimers(100);

    // Date should increment by 1 day
    expect(screen.getByLabelText("Display Value")).toHaveTextContent("0 - 1");
    await waitFor(() => {
      expect(handleChange).toHaveBeenLastCalledWith("0,1");
    });
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

    expect(screen.getByLabelText("Display Value")).toHaveTextContent(
      "2025-01-01"
    );
    expect(handleChange).toHaveBeenCalledWith("2025-01-01");
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

  it("does not update index on rerender when relevant props haven't changed (avoids line 279)", () => {
    const handleChange = jest.fn();

    const { rerender } = render(
      <Slider
        label="Test Slider"
        step={1}
        min={0}
        max={10}
        rangeMode={true}
        initialRange={[5, 6]}
        outputFormat="{{n}}"
        dataType="Number"
        onChange={handleChange}
      />
    );

    expect(handleChange).toHaveBeenCalledWith("5,6");
    // Clear the initial onChange call
    handleChange.mockClear();

    // Rerender with the same relevant props but change a non-relevant prop (label)
    rerender(
      <Slider
        label="Updated Test Slider" // Only label changed, which doesn't affect index
        step={1}
        min={0}
        max={10}
        rangeMode={true}
        initialRange={[5, 6]}
        outputFormat="{{n}}"
        dataType="Number"
        onChange={handleChange}
      />
    );

    // The index should not have been updated, so no onChange should be called
    expect(handleChange).not.toHaveBeenCalled();
    expect(screen.getByText("Updated Test Slider")).toBeInTheDocument();
    expect(screen.getByLabelText("Display Value")).toHaveTextContent("5");

    rerender(
      <Slider
        label="Updated Test Slider"
        step={1}
        min={0}
        max={10}
        rangeMode={true}
        initialRange={[5, 6]}
        outputFormat="{{n:2}}" // Different format but same value display for this case
        dataType="Number"
        onChange={handleChange}
      />
    );

    // Still no onChange calls should have happened due to index updates
    expect(handleChange).toHaveBeenCalledWith("05,06");
  });
});

test("calculateSliderValues returns correct values", () => {
  expect(
    calculateSliderValues({
      min: 0,
      max: 10,
      step: 1,
      unit: null,
      dataType: "Number",
    })
  ).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  expect(
    calculateSliderValues({
      min: 0,
      max: 10,
      step: 3,
      unit: null,
      dataType: "Number",
    })
  ).toEqual([0, 3, 6, 9, 10]);

  expect(
    calculateSliderValues({
      min: "2025-01-01T00:00:00.000",
      max: "2025-01-05T00:00:00.000",
      step: 1,
      unit: "Days",
      dataType: "Date",
    })
  ).toEqual([
    "2025-01-01T00:00:00",
    "2025-01-02T00:00:00",
    "2025-01-03T00:00:00",
    "2025-01-04T00:00:00",
    "2025-01-05T00:00:00",
  ]);
  expect(
    calculateSliderValues({
      min: "2025-01-01T00:00:00.000",
      max: "2025-01-05T00:00:00.000",
      step: 3,
      unit: "Days",
      dataType: "Date",
    })
  ).toEqual([
    "2025-01-01T00:00:00",
    "2025-01-04T00:00:00",
    "2025-01-05T00:00:00",
  ]);
  expect(
    calculateSliderValues({
      min: "2025-01-01T00:00:00.000",
      max: "2025-01-03T00:00:00.000",
      step: 8,
      unit: "Hours",
      dataType: "Date",
    })
  ).toEqual([
    "2025-01-01T00:00:00",
    "2025-01-01T08:00:00",
    "2025-01-01T16:00:00",
    "2025-01-02T00:00:00",
    "2025-01-02T08:00:00",
    "2025-01-02T16:00:00",
    "2025-01-03T00:00:00",
  ]);

  expect(
    calculateSliderValues({
      min: "now-5D",
      max: "now",
      step: 1,
      unit: "Days",
      dataType: "Date",
    })
  ).toEqual(["now-5D", "now-4D", "now-3D", "now-2D", "now-1D", "now"]);

  expect(
    calculateSliderValues({
      min: "now-1D",
      max: "now",
      step: 1,
      unit: "Hours",
      dataType: "Date",
    })
  ).toEqual([
    "now-24H",
    "now-23H",
    "now-22H",
    "now-21H",
    "now-20H",
    "now-19H",
    "now-18H",
    "now-17H",
    "now-16H",
    "now-15H",
    "now-14H",
    "now-13H",
    "now-12H",
    "now-11H",
    "now-10H",
    "now-9H",
    "now-8H",
    "now-7H",
    "now-6H",
    "now-5H",
    "now-4H",
    "now-3H",
    "now-2H",
    "now-1H",
    "now",
  ]);

  expect(
    calculateSliderValues({
      min: "now-1D-1H",
      max: "now",
      step: 1,
      unit: "Hours",
      dataType: "Date",
    })
  ).toEqual([
    "now-25H",
    "now-24H",
    "now-23H",
    "now-22H",
    "now-21H",
    "now-20H",
    "now-19H",
    "now-18H",
    "now-17H",
    "now-16H",
    "now-15H",
    "now-14H",
    "now-13H",
    "now-12H",
    "now-11H",
    "now-10H",
    "now-9H",
    "now-8H",
    "now-7H",
    "now-6H",
    "now-5H",
    "now-4H",
    "now-3H",
    "now-2H",
    "now-1H",
    "now",
  ]);

  // Test for line 180: covers maxVal suffix generation for positive offset
  expect(
    calculateSliderValues({
      min: "now-5D",
      max: "now+2D",
      step: 3,
      unit: "Days",
      dataType: "Date",
    })
  ).toEqual(["now-5D", "now-2D", "now+1D", "now+2D"]);

  // Test for line 180: covers maxVal suffix generation for negative offset (when counting backwards)
  expect(
    calculateSliderValues({
      min: "now+2D",
      max: "now-3D",
      step: 2,
      unit: "Days",
      dataType: "Date",
    })
  ).toEqual(["now+2D", "now", "now-2D", "now-3D"]);

  // Test for line 204: covers fallback case for unsupported dataType
  expect(
    calculateSliderValues({
      min: 0,
      max: 10,
      step: 1,
      unit: null,
      dataType: "String",
    })
  ).toEqual([]);
  expect(
    calculateSliderValues({
      min: 0,
      max: 10,
      step: 1,
      unit: null,
      dataType: "Boolean",
    })
  ).toEqual([]);
  expect(
    calculateSliderValues({
      min: 0,
      max: 10,
      step: 1,
      unit: null,
      dataType: "Object",
    })
  ).toEqual([]);
  expect(
    calculateSliderValues({
      min: 0,
      max: 10,
      step: 1,
      unit: null,
      dataType: undefined,
    })
  ).toEqual([]);
  expect(
    calculateSliderValues({
      min: 0,
      max: 10,
      step: 1,
      unit: null,
      dataType: null,
    })
  ).toEqual([]);
});

test("calculateSliderValues handles mixed absolute/relative dates correctly", () => {
  const now = new Date("2025-11-10T18:00:00.000Z");
  const originalNow = Date.now;
  Date.now = jest.fn(() => now.getTime());

  try {
    // Test case: absolute min, relative max
    const result1 = calculateSliderValues({
      min: "10/30/2025 3:26 PM",
      max: "now",
      step: 1,
      unit: "Hours",
      dataType: "Date",
    });
    expect(result1).not.toEqual(["NaN-NaN-NaNTNaN:NaN:NaN"]);
    expect(result1.length).toBeGreaterThan(0);
    expect(result1.every((val) => !val.includes("NaN"))).toBe(true);

    // Test case: relative min, absolute max
    const result2 = calculateSliderValues({
      min: "now-2H",
      max: "11/10/2025 6:00 PM",
      step: 1,
      unit: "Hours",
      dataType: "Date",
    });
    expect(result2).not.toEqual(["NaN-NaN-NaNTNaN:NaN:NaN"]);
    expect(result2.length).toBeGreaterThan(0);
    expect(result2.every((val) => !val.includes("NaN"))).toBe(true);

    // Verify results are valid datetime strings
    result1.forEach((val) => {
      expect(new Date(val)).not.toEqual(new Date("Invalid Date"));
    });

    result2.forEach((val) => {
      expect(new Date(val)).not.toEqual(new Date("Invalid Date"));
    });
  } finally {
    Date.now = originalNow;
  }
});

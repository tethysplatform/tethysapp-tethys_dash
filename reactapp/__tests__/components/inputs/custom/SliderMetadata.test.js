import SliderMetadata from "components/inputs/custom/SliderMetadata";
import { render, screen, fireEvent } from "@testing-library/react";
import selectEvent from "react-select-event";
import userEvent from "@testing-library/user-event";

test("SliderMetadata with empty values, select Number, then date", async () => {
  const mockOnChange = jest.fn();
  const values = {};

  render(
    <SliderMetadata
      onChange={mockOnChange}
      values={values}
      visualizationRef={null}
    />
  );

  expect(screen.getByText("Slider Mode")).toBeInTheDocument();
  const singleValueRadio = screen.getByLabelText("Single Value");
  const rangeValueRadio = screen.getByLabelText("Range");
  expect(singleValueRadio).toBeInTheDocument();
  expect(rangeValueRadio).toBeInTheDocument();

  expect(singleValueRadio.checked).toBe(true);
  expect(rangeValueRadio.checked).toBe(false);

  const dataTypeSelect = screen.getByLabelText("Data Type Input");
  expect(dataTypeSelect).toBeInTheDocument();
  await selectEvent.select(dataTypeSelect, "Number");

  expect(await screen.findByText("Minimum")).toBeInTheDocument();
  expect(screen.getByText("Maximum")).toBeInTheDocument();
  expect(screen.getByText("Initial Value")).toBeInTheDocument();
  expect(screen.getByText("Step")).toBeInTheDocument();
  expect(screen.getByText("Output Format")).toBeInTheDocument();

  let minInput = screen.getByLabelText("Minimum Input");
  let maxInput = screen.getByLabelText("Maximum Input");
  let initialValueInput = screen.getByLabelText("Initial Value Input");
  let stepInput = screen.getByLabelText("Step Input");
  let outputFormatInput = screen.getByLabelText("Output Format Input");

  expect(mockOnChange).toHaveBeenCalledTimes(1);
  expect(mockOnChange).toHaveBeenLastCalledWith(null);

  fireEvent.change(minInput, { target: { value: "0" } });
  fireEvent.change(maxInput, { target: { value: "100" } });
  fireEvent.change(stepInput, { target: { value: "1" } });
  fireEvent.change(outputFormatInput, { target: { value: "{{n}}" } });

  // onChange null because initial Value is empty
  expect(mockOnChange).toHaveBeenCalledTimes(2);
  expect(mockOnChange).toHaveBeenLastCalledWith(null);

  fireEvent.change(initialValueInput, { target: { value: "50" } });

  expect(mockOnChange).toHaveBeenCalledTimes(3);
  expect(mockOnChange).toHaveBeenLastCalledWith({
    dataType: "Number",
    rangeMode: false,
    min: 0,
    max: 100,
    initialValue: 50,
    step: 1,
    outputFormat: "{{n}}",
  });

  await selectEvent.select(dataTypeSelect, "Date");
  expect(mockOnChange).toHaveBeenCalledTimes(4);
  expect(mockOnChange).toHaveBeenLastCalledWith(null);

  expect(await screen.findByText("Minimum")).toBeInTheDocument();
  expect(screen.getByText("Maximum")).toBeInTheDocument();
  expect(screen.getByText("Initial Value")).toBeInTheDocument();
  expect(screen.getByText("Step")).toBeInTheDocument();
  const timeDeltaInput = screen.getByLabelText("Time Delta Input");
  expect(timeDeltaInput).toBeInTheDocument();
  expect(screen.getByText("Output Format")).toBeInTheDocument();

  minInput = screen.getByRole("textbox", { name: /Minimum/i });
  maxInput = screen.getByRole("textbox", { name: /Maximum/i });
  initialValueInput = screen.getByRole("textbox", { name: /Initial Value/i });
  stepInput = screen.getByLabelText("Step Input");
  outputFormatInput = screen.getByLabelText("Output Format Input");

  fireEvent.change(minInput, { target: { value: "01/01/2020 12:00 AM" } });
  fireEvent.change(maxInput, { target: { value: "01/10/2020 12:00 AM" } });
  fireEvent.change(initialValueInput, {
    target: { value: "01/05/2020 12:00 AM" },
  });
  fireEvent.change(stepInput, { target: { value: "1" } });
  fireEvent.change(outputFormatInput, { target: { value: "MM/dd/yyyy" } });

  expect(mockOnChange).toHaveBeenCalledTimes(5);
  expect(mockOnChange).toHaveBeenLastCalledWith({
    dataType: "Date",
    min: "01/01/2020 12:00 AM",
    max: "01/10/2020 12:00 AM",
    initialValue: "01/05/2020 12:00 AM",
    step: 1,
    outputFormat: "MM/dd/yyyy",
    dateTimeDelta: "Days",
    rangeMode: false,
  });
});

test("SliderMetadata with existing number, turn on range mode", async () => {
  const mockOnChange = jest.fn();
  const values = {
    dataType: "Number",
    rangeMode: false,
    min: 0,
    max: 100,
    initialValue: 50,
    step: 1,
    outputFormat: "{{n}}",
  };

  render(
    <SliderMetadata
      onChange={mockOnChange}
      values={values}
      visualizationRef={null}
    />
  );

  expect(screen.getByText("Slider Mode")).toBeInTheDocument();
  const singleValueRadio = screen.getByLabelText("Single Value");
  const rangeValueRadio = screen.getByLabelText("Range");
  expect(singleValueRadio).toBeInTheDocument();
  expect(rangeValueRadio).toBeInTheDocument();

  expect(singleValueRadio.checked).toBe(true);
  expect(rangeValueRadio.checked).toBe(false);

  await userEvent.click(rangeValueRadio);

  expect(singleValueRadio.checked).toBe(false);
  expect(rangeValueRadio.checked).toBe(true);

  expect(mockOnChange).toHaveBeenCalledTimes(2);
  expect(mockOnChange).toHaveBeenLastCalledWith(null);

  const minInput = screen.getByLabelText("Minimum Input");
  const maxInput = screen.getByLabelText("Maximum Input");
  const rangeStartInput = screen.getByLabelText("Range Start Input");
  const rangeEndInput = screen.getByLabelText("Range End Input");
  const stepInput = screen.getByLabelText("Step Input");
  const outputFormatInput = screen.getByLabelText("Output Format Input");

  expect(minInput.value).toBe("0");
  expect(maxInput.value).toBe("100");
  expect(rangeStartInput.value).toBe("");
  expect(rangeEndInput.value).toBe("");
  expect(stepInput.value).toBe("1");
  expect(outputFormatInput.value).toBe("{{n}}");

  fireEvent.change(rangeStartInput, { target: { value: "20" } });

  // onChange null because range end is empty
  expect(mockOnChange).toHaveBeenCalledTimes(3);
  expect(mockOnChange).toHaveBeenLastCalledWith(null);

  fireEvent.change(rangeEndInput, { target: { value: "80" } });

  expect(mockOnChange).toHaveBeenCalledTimes(4);
  expect(mockOnChange).toHaveBeenLastCalledWith({
    dataType: "Number",
    rangeMode: true,
    min: 0,
    max: 100,
    initialRange: [20, 80],
    step: 1,
    outputFormat: "{{n}}",
  });
});

test("SliderMetadata with existing date, turn on range mode", async () => {
  const mockOnChange = jest.fn();
  const values = {
    dataType: "Date",
    min: "01/01/2020 12:00 AM",
    max: "01/10/2020 12:00 AM",
    initialValue: "01/05/2020 12:00 AM",
    step: 1,
    outputFormat: "MM/dd/yyyy",
    dateTimeDelta: "Days",
    rangeMode: false,
  };

  render(
    <SliderMetadata
      onChange={mockOnChange}
      values={values}
      visualizationRef={null}
    />
  );

  expect(screen.getByText("Slider Mode")).toBeInTheDocument();
  const singleValueRadio = screen.getByLabelText("Single Value");
  const rangeValueRadio = screen.getByLabelText("Range");
  expect(singleValueRadio).toBeInTheDocument();
  expect(rangeValueRadio).toBeInTheDocument();

  expect(singleValueRadio.checked).toBe(true);
  expect(rangeValueRadio.checked).toBe(false);

  await userEvent.click(rangeValueRadio);

  expect(singleValueRadio.checked).toBe(false);
  expect(rangeValueRadio.checked).toBe(true);

  expect(mockOnChange).toHaveBeenCalledTimes(2);
  expect(mockOnChange).toHaveBeenLastCalledWith(null);

  const minInput = screen.getByRole("textbox", { name: /Minimum/i });
  const maxInput = screen.getByRole("textbox", { name: /Maximum/i });
  const rangeStartInput = screen.getByRole("textbox", { name: /Range Start/i });
  const rangeEndInput = screen.getByRole("textbox", { name: /Range End/i });
  const stepInput = screen.getByLabelText("Step Input");
  const outputFormatInput = screen.getByLabelText("Output Format Input");

  expect(minInput.value).toBe("01/01/2020 12:00 AM");
  expect(maxInput.value).toBe("01/10/2020 12:00 AM");
  expect(rangeStartInput.value).toBe("");
  expect(rangeEndInput.value).toBe("");
  expect(stepInput.value).toBe("1");
  expect(outputFormatInput.value).toBe("MM/dd/yyyy");

  fireEvent.change(rangeStartInput, {
    target: { value: "01/01/2020 12:00 AM" },
  });

  // onChange null because range end is empty
  expect(mockOnChange).toHaveBeenCalledTimes(3);
  expect(mockOnChange).toHaveBeenLastCalledWith(null);

  fireEvent.change(rangeEndInput, { target: { value: "01/03/2020 12:00 AM" } });

  expect(mockOnChange).toHaveBeenCalledTimes(4);
  expect(mockOnChange).toHaveBeenLastCalledWith({
    dataType: "Date",
    min: "01/01/2020 12:00 AM",
    max: "01/10/2020 12:00 AM",
    initialRange: ["01/01/2020 12:00 AM", "01/03/2020 12:00 AM"],
    step: 1,
    outputFormat: "MM/dd/yyyy",
    dateTimeDelta: "Days",
    rangeMode: true,
  });
});

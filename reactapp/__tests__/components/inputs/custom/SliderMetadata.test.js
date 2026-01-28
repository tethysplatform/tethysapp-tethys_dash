import SliderMetadata from "components/inputs/custom/SliderMetadata";
import { render, screen, fireEvent } from "@testing-library/react";
import selectEvent from "react-select-event";
import userEvent from "@testing-library/user-event";
import {
  DataViewerModeContext,
  VariableInputsContext,
} from "components/contexts/Contexts";

test("SliderMetadata with empty values, select Number, then date", async () => {
  const mockOnChange = jest.fn();
  const values = {};

  render(
    <DataViewerModeContext.Provider value={{ inDataViewerMode: false }}>
      <VariableInputsContext.Provider value={{ variableInputValues: {} }}>
        <SliderMetadata
          onChange={mockOnChange}
          values={values}
          visualizationRef={null}
        />
      </VariableInputsContext.Provider>
    </DataViewerModeContext.Provider>,
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
  let initialValueDropdown = screen.getByLabelText("Initial Value");
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

  selectEvent.openMenu(initialValueDropdown);
  let rangeStartOption = await screen.findByText("50");
  fireEvent.click(rangeStartOption);

  expect(mockOnChange).toHaveBeenCalledTimes(3);
  expect(mockOnChange).toHaveBeenLastCalledWith({
    dataType: "Number",
    rangeMode: false,
    min: 0,
    max: 100,
    initialValue: 50,
    step: 1,
    outputFormat: "{{n}}",
    speedOptions: [2000, 1000, 500, 250, 100],
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
  stepInput = screen.getByLabelText("Step Input");
  outputFormatInput = screen.getByLabelText("Output Format Input");

  fireEvent.change(minInput, { target: { value: "01/01/2020 12:00 AM" } });
  fireEvent.change(maxInput, { target: { value: "01/10/2020 12:00 AM" } });
  fireEvent.change(stepInput, { target: { value: "1" } });

  initialValueDropdown = screen.getByLabelText("Initial Value");
  selectEvent.openMenu(initialValueDropdown);
  rangeStartOption = await screen.findByText("2020-01-05T00:00:00");
  fireEvent.click(rangeStartOption);

  fireEvent.change(outputFormatInput, { target: { value: "MM/dd/yyyy" } });

  expect(mockOnChange).toHaveBeenCalledTimes(7);
  expect(mockOnChange).toHaveBeenLastCalledWith({
    dataType: "Date",
    min: "01/01/2020 12:00 AM",
    max: "01/10/2020 12:00 AM",
    initialValue: "2020-01-05T00:00:00",
    step: 1,
    outputFormat: "MM/dd/yyyy",
    dateTimeDelta: "Days",
    rangeMode: false,
    speedOptions: [2000, 1000, 500, 250, 100],
  });

  const extraSlowSpeedOption = screen.getByLabelText(/Extra Slow/i);
  expect(extraSlowSpeedOption).toBeInTheDocument();
  await userEvent.click(extraSlowSpeedOption);

  expect(mockOnChange).toHaveBeenCalledTimes(8);
  expect(mockOnChange).toHaveBeenLastCalledWith({
    dataType: "Date",
    min: "01/01/2020 12:00 AM",
    max: "01/10/2020 12:00 AM",
    initialValue: "2020-01-05T00:00:00",
    step: 1,
    outputFormat: "MM/dd/yyyy",
    dateTimeDelta: "Days",
    rangeMode: false,
    speedOptions: [1000, 500, 250, 100],
  });

  await userEvent.click(extraSlowSpeedOption);

  expect(mockOnChange).toHaveBeenCalledTimes(9);
  expect(mockOnChange).toHaveBeenLastCalledWith({
    dataType: "Date",
    min: "01/01/2020 12:00 AM",
    max: "01/10/2020 12:00 AM",
    initialValue: "2020-01-05T00:00:00",
    step: 1,
    outputFormat: "MM/dd/yyyy",
    dateTimeDelta: "Days",
    rangeMode: false,
    speedOptions: [2000, 1000, 500, 250, 100],
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
    <VariableInputsContext.Provider value={{ variableInputValues: {} }}>
      <SliderMetadata
        onChange={mockOnChange}
        values={values}
        visualizationRef={null}
      />
    </VariableInputsContext.Provider>,
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
  const rangeStartDropdown = screen.getByLabelText("Range Start");
  const rangeEndDropdown = screen.getByLabelText("Range End");
  const stepInput = screen.getByLabelText("Step Input");
  const outputFormatInput = screen.getByLabelText("Output Format Input");

  expect(minInput.value).toBe("0");
  expect(maxInput.value).toBe("100");
  expect(rangeStartDropdown.value).toBe("");
  expect(rangeEndDropdown.value).toBe("");
  expect(stepInput.value).toBe("1");
  expect(outputFormatInput.value).toBe("{{n}}");

  selectEvent.openMenu(rangeStartDropdown);
  const rangeStartOption = await screen.findByText("20");
  fireEvent.click(rangeStartOption);

  // onChange null because range end is empty
  expect(mockOnChange).toHaveBeenCalledTimes(3);
  expect(mockOnChange).toHaveBeenLastCalledWith(null);

  selectEvent.openMenu(rangeEndDropdown);
  const rangeEndOption = await screen.findByText("80");
  fireEvent.click(rangeEndOption);

  expect(mockOnChange).toHaveBeenCalledTimes(4);
  expect(mockOnChange).toHaveBeenLastCalledWith({
    dataType: "Number",
    rangeMode: true,
    min: 0,
    max: 100,
    initialRange: [20, 80],
    step: 1,
    outputFormat: "{{n}}",
    speedOptions: [2000, 1000, 500, 250, 100],
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
    <DataViewerModeContext.Provider value={{ inDataViewerMode: false }}>
      <VariableInputsContext.Provider value={{ variableInputValues: {} }}>
        <SliderMetadata
          onChange={mockOnChange}
          values={values}
          visualizationRef={null}
        />
      </VariableInputsContext.Provider>
    </DataViewerModeContext.Provider>,
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
  const stepInput = screen.getByLabelText("Step Input");
  const rangeStartDropdown = screen.getByLabelText("Range Start");
  const rangeEndDropdown = screen.getByLabelText("Range End");
  const outputFormatInput = screen.getByLabelText("Output Format Input");

  expect(minInput.value).toBe("01/01/2020 12:00 AM");
  expect(maxInput.value).toBe("01/10/2020 12:00 AM");
  expect(rangeStartDropdown.value).toBe("");
  expect(rangeEndDropdown.value).toBe("");
  expect(stepInput.value).toBe("1");
  expect(outputFormatInput.value).toBe("MM/dd/yyyy");

  selectEvent.openMenu(rangeStartDropdown);
  const rangeStartOption = await screen.findByText("2020-01-01T00:00:00");
  fireEvent.click(rangeStartOption);

  // onChange null because range end is empty
  expect(mockOnChange).toHaveBeenCalledTimes(3);
  expect(mockOnChange).toHaveBeenLastCalledWith(null);

  selectEvent.openMenu(rangeEndDropdown);
  const rangeEndOption = await screen.findByText("2020-01-03T00:00:00");
  fireEvent.click(rangeEndOption);

  expect(mockOnChange).toHaveBeenCalledTimes(4);
  expect(mockOnChange).toHaveBeenLastCalledWith({
    dataType: "Date",
    min: "01/01/2020 12:00 AM",
    max: "01/10/2020 12:00 AM",
    initialRange: ["2020-01-01T00:00:00", "2020-01-03T00:00:00"],
    step: 1,
    outputFormat: "MM/dd/yyyy",
    dateTimeDelta: "Days",
    rangeMode: true,
    speedOptions: [2000, 1000, 500, 250, 100],
  });
});

import { render, screen, fireEvent } from "@testing-library/react";
import DataRadioSelect from "components/inputs/DataRadioSelect";

describe("DataRadioSelect Component", () => {
  const mockOnChange = jest.fn();
  const radioOptions = [
    { label: "Option 1", value: "option1" },
    { label: "Option 2", value: "option2" },
    { label: "Option 3", value: "option3" },
  ];

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders the label", () => {
    render(
      <DataRadioSelect
        label="Test Label"
        selectedRadio=""
        radioOptions={radioOptions}
        onChange={mockOnChange}
      />
    );
    expect(screen.getByText("Test Label")).toBeInTheDocument();
  });

  it("renders the correct number of radio buttons", () => {
    render(
      <DataRadioSelect
        label="Test Label"
        selectedRadio=""
        radioOptions={radioOptions}
        onChange={mockOnChange}
      />
    );
    const radioButtons = screen.getAllByRole("radio");
    expect(radioButtons).toHaveLength(radioOptions.length);
  });

  it("sets the correct label and value for each radio button", () => {
    render(
      <DataRadioSelect
        label="Test Label"
        selectedRadio=""
        radioOptions={radioOptions}
        onChange={mockOnChange}
      />
    );

    radioOptions.forEach((option) => {
      const radio = screen.getByLabelText(option.label);
      expect(radio).toBeInTheDocument();
      expect(radio).toHaveAttribute("value", option.value);
    });
  });

  it("marks the correct radio button as checked", () => {
    render(
      <DataRadioSelect
        label="Test Label"
        selectedRadio="option2"
        radioOptions={radioOptions}
        onChange={mockOnChange}
      />
    );

    const selectedRadio = screen.getByLabelText("Option 2");
    expect(selectedRadio).toBeChecked();
  });

  it("does not check any radio buttons if no selection is made", () => {
    render(
      <DataRadioSelect
        label="Test Label"
        selectedRadio=""
        radioOptions={radioOptions}
        onChange={mockOnChange}
      />
    );

    radioOptions.forEach((option) => {
      const radio = screen.getByLabelText(option.label);
      expect(radio).not.toBeChecked();
    });
  });

  it("calls the onChange handler when a radio button is clicked", () => {
    render(
      <DataRadioSelect
        label="Test Label"
        selectedRadio=""
        radioOptions={radioOptions}
        onChange={mockOnChange}
      />
    );

    const radioToSelect = screen.getByLabelText("Option 3");
    fireEvent.click(radioToSelect);

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith(expect.anything());
  });
});

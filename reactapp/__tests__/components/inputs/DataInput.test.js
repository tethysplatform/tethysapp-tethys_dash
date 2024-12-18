import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import selectEvent from "react-select-event";
import { useLayoutGridItemsContext } from "components/contexts/SelectedDashboardContext";
import { useDataViewerModeContext } from "components/contexts/DataViewerModeContext";
import DataInput from "components/inputs/DataInput";
import { act } from "react";

// Mock contexts
jest.mock("components/contexts/SelectedDashboardContext", () => ({
  useLayoutGridItemsContext: jest.fn(),
}));

jest.mock("components/contexts/DataViewerModeContext", () => ({
  useDataViewerModeContext: jest.fn(),
}));

describe("DataInput Component", () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    useLayoutGridItemsContext.mockReturnValue({ gridItems: [] });
    useDataViewerModeContext.mockReturnValue({ inDataViewerMode: false });
  });

  test("renders DataSelect dropdown and handles selection", async () => {
    const options = [
      { label: "Option 1", value: "option1" },
      { label: "Option 2", value: "option2" },
    ];

    render(
      <DataInput
        objValue={{ label: "Test Dropdown", type: options, value: "" }}
        onChange={mockOnChange}
        index={0}
      />
    );

    const dropdown = screen.getByLabelText("Test Dropdown Input");

    // Verify dropdown rendering
    expect(dropdown).toBeInTheDocument();

    // Use react-select-event to select an option
    await selectEvent.select(dropdown, "Option 1");

    // Ensure onChange is triggered with the correct value
    expect(mockOnChange).toHaveBeenCalledWith(
      { label: "Option 1", value: "option1" },
      0
    );
  });

  test("renders checkbox and handles change", () => {
    render(
      <DataInput
        objValue={{ label: "Test Checkbox", type: "checkbox", value: true }}
        onChange={mockOnChange}
        index={0}
      />
    );

    const checkbox = screen.getByLabelText("Test Checkbox Input");

    // Verify checkbox rendering
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toBeChecked();

    // Simulate a change
    fireEvent.click(checkbox);

    // Ensure onChange is triggered with the correct value
    expect(mockOnChange).toHaveBeenCalledWith(false, 0);
  });

  test("renders radio buttons and handles selection", () => {
    const valueOptions = [
      { label: "Option 1", value: "option1" },
      { label: "Option 2", value: "option2" },
    ];

    render(
      <DataInput
        objValue={{
          label: "Test Radio",
          type: "radio",
          value: "option1",
          valueOptions,
        }}
        onChange={mockOnChange}
        index={0}
      />
    );

    const option1 = screen.getByLabelText("Option 1");
    const option2 = screen.getByLabelText("Option 2");

    // Verify radio buttons rendering
    expect(option1).toBeChecked();
    expect(option2).not.toBeChecked();

    // Simulate selecting another option
    fireEvent.click(option2);

    // Ensure onChange is triggered with the correct value
    expect(mockOnChange).toHaveBeenCalledWith("option2", 0);
  });

  test("renders text input and handles typing", async () => {
    const user = userEvent.setup();
    const {rerender} = render(
      <DataInput
        objValue={{ label: "Test Text", type: "text", value: "initial" }}
        onChange={mockOnChange}
        index={0}
      />
    );

    const textInput = screen.getByLabelText("Test Text Input");

    // Verify text input rendering
    expect(textInput).toBeInTheDocument();
    expect(textInput).toHaveValue("initial");

    // Simulate typing
    await act(async () => {
      await user.type(textInput, "new value");
    });

    rerender(
      <DataInput
        objValue={{ label: "Test Text", type: "text", value: "new value" }}
        onChange={mockOnChange}
        index={0}
      />
    );

    // Ensure onChange is triggered with the correct value
    expect(textInput).toHaveValue("new value");
  });
});

import { screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import selectEvent from "react-select-event";
import DataInput from "components/inputs/DataInput";
import { act } from "react";
import renderWithLoaders from "__tests__/utilities/customRender";
import {
  mockedTextVariable,
  mockedDashboards,
} from "__tests__/utilities/constants";

describe("DataInput Component", () => {
  const mockOnChange = jest.fn();

  test("renders DataSelect dropdown and handles selection", async () => {
    const options = [
      { label: "Option 1", value: "option1" },
      { label: "Option 2", value: "option2" },
    ];

    renderWithLoaders({
      children: (
        <DataInput
          objValue={{ label: "Test Dropdown", type: options, value: "" }}
          onChange={mockOnChange}
          index={0}
        />
      ),
    });

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

  test("renders DataSelect dropdown in dataviewer mode and no variable inputs as options", async () => {
    const options = [
      { label: "Option 1", value: "option1" },
      { label: "Option 2", value: "option2" },
    ];

    renderWithLoaders({
      children: (
        <DataInput
          objValue={{ label: "Test Dropdown", type: options, value: "" }}
          onChange={mockOnChange}
          index={0}
        />
      ),
      options: {
        inDataViewerMode: true,
      },
    });

    const dropdown = screen.getByLabelText("Test Dropdown Input");

    // Open the dropdown
    await selectEvent.openMenu(dropdown);

    // Check if the options are rendered
    expect(screen.getByText("Option 1")).toBeInTheDocument();
    expect(screen.getByText("Option 2")).toBeInTheDocument();
    expect(screen.queryByText("Variable Inputs")).not.toBeInTheDocument();
    expect(screen.queryByText("Test Variable")).not.toBeInTheDocument();
  });

  test("renders DataSelect dropdown in dataviewer mode and has variable inputs as options", async () => {
    const options = [
      { label: "Option 1", value: "option1" },
      { label: "Option 2", value: "option2" },
    ];
    const dashboards = JSON.parse(JSON.stringify(mockedDashboards));
    dashboards.editable.gridItems = [mockedTextVariable];

    renderWithLoaders({
      children: (
        <DataInput
          objValue={{ label: "Test Dropdown", type: options, value: "" }}
          onChange={mockOnChange}
          index={0}
        />
      ),
      options: {
        dashboards: dashboards,
        inDataViewerMode: true,
        initialDashboard: dashboards.editable.name,
      },
    });

    const dropdown = screen.getByLabelText("Test Dropdown Input");

    // Open the dropdown
    await selectEvent.openMenu(dropdown);

    // Check if the options are rendered
    expect(screen.getByText("Option 1")).toBeInTheDocument();
    expect(screen.getByText("Option 2")).toBeInTheDocument();
    expect(screen.getByText("Variable Inputs")).toBeInTheDocument();
    expect(screen.getByText("Test Variable")).toBeInTheDocument();
  });

  test("renders checkbox and handles change", () => {
    renderWithLoaders({
      children: (
        <DataInput
          objValue={{ label: "Test Checkbox", type: "checkbox", value: true }}
          onChange={mockOnChange}
          index={0}
        />
      ),
    });

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
    renderWithLoaders({
      children: (
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
      ),
    });

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

  test("renders text input and handles typing. make sure enter does not submit form", async () => {
    const user = userEvent.setup();
    const mockHandleSubmit = jest.fn();

    renderWithLoaders({
      children: (
        <form onSubmit={mockHandleSubmit}>
          <DataInput
            objValue={{ label: "Test Text", type: "text", value: "initial" }}
            onChange={mockOnChange}
            index={0}
          />
        </form>
      ),
    });

    const textInput = screen.getByLabelText("Test Text Input");

    // Verify text input rendering
    expect(textInput).toBeInTheDocument();
    expect(textInput).toHaveValue("initial");

    // Simulate typing
    await act(async () => {
      await user.type(textInput, "M");
    });

    // Ensure onChange is triggered with the correct value
    expect(mockOnChange).toHaveBeenCalledWith("initialM", 0);

    // Ensure Enter does not submit a form
    await userEvent.keyboard("{Enter}");
    expect(mockHandleSubmit).toHaveBeenCalledTimes(0);
  });
});

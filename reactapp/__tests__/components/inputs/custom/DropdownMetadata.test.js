import DropdownMetadata from "components/inputs/custom/DropdownMetadata";
import { fireEvent, render, screen } from "@testing-library/react";

describe("DropdownMetadata", () => {
  test("renders and selects options correctly", () => {
    const onChange = jest.fn();

    render(
      <DropdownMetadata
        onChange={onChange}
        values={{
          choices: [
            { label: "Option 1", value: "option1" },
            { label: "Option 2", value: "option2" },
          ],
        }}
      />,
    );

    const option1LabelInput = screen.getByLabelText("Choice 1 label");
    const option1ValueInput = screen.getByLabelText("Choice 1 value");
    const option2LabelInput = screen.getByLabelText("Choice 2 label");
    const option2ValueInput = screen.getByLabelText("Choice 2 value");

    expect(option1LabelInput).toHaveValue("Option 1");
    expect(option1ValueInput).toHaveValue("option1");
    expect(option2LabelInput).toHaveValue("Option 2");
    expect(option2ValueInput).toHaveValue("option2");

    fireEvent.change(option1LabelInput, {
      target: { value: "Updated Option 1" },
    });
    expect(onChange).toHaveBeenCalledWith({
      choices: [
        { label: "Updated Option 1", value: "option1" },
        { label: "Option 2", value: "option2" },
      ],
    });
  });

  test("renders without choices", () => {
    const onChange = jest.fn();

    render(<DropdownMetadata onChange={onChange} values={null} />);

    expect(screen.queryByLabelText("Choice 1 label")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Choice 1 value")).not.toBeInTheDocument();

    const labelInput = screen.getByLabelText("New choice label");
    const valueInput = screen.getByLabelText("New choice value");

    fireEvent.change(labelInput, { target: { value: "New Choice" } });
    fireEvent.change(valueInput, { target: { value: "new_choice" } });

    const button = screen.getByLabelText("Add choice");
    fireEvent.click(button);
    expect(onChange).toHaveBeenCalledWith({
      choices: [{ label: "New Choice", value: "new_choice" }],
    });
  });

  test("renders, move choice up", () => {
    const onChange = jest.fn();

    render(
      <DropdownMetadata
        onChange={onChange}
        values={{
          choices: [
            { label: "Option 1", value: "option1" },
            { label: "Option 2", value: "option2" },
          ],
        }}
      />,
    );

    const button = screen.getByLabelText("Move choice 2 up");
    fireEvent.click(button);
    expect(onChange).toHaveBeenCalledWith({
      choices: [
        { label: "Option 2", value: "option2" },
        { label: "Option 1", value: "option1" },
      ],
    });
  });

  test("renders, move choice down", () => {
    const onChange = jest.fn();

    render(
      <DropdownMetadata
        onChange={onChange}
        values={{
          choices: [
            { label: "Option 1", value: "option1" },
            { label: "Option 2", value: "option2" },
          ],
        }}
      />,
    );

    const button = screen.getByLabelText("Move choice 1 down");
    fireEvent.click(button);
    expect(onChange).toHaveBeenCalledWith({
      choices: [
        { label: "Option 2", value: "option2" },
        { label: "Option 1", value: "option1" },
      ],
    });
  });

  test("renders, delete choice", () => {
    const onChange = jest.fn();

    render(
      <DropdownMetadata
        onChange={onChange}
        values={{
          choices: [
            { label: "Option 1", value: "option1" },
            { label: "Option 2", value: "option2" },
          ],
        }}
      />,
    );

    const button = screen.getByLabelText("Remove choice 2");
    fireEvent.click(button);
    expect(onChange).toHaveBeenCalledWith({
      choices: [{ label: "Option 1", value: "option1" }],
    });
  });

  test("renders, edit label", () => {
    const onChange = jest.fn();

    render(
      <DropdownMetadata
        onChange={onChange}
        values={{
          choices: [
            { label: "Option 1", value: "option1" },
            { label: "Option 2", value: "option2" },
          ],
        }}
      />,
    );

    const labelInput = screen.getByLabelText("Choice 1 label");

    fireEvent.change(labelInput, { target: { value: "Updated Choice" } });

    expect(onChange).toHaveBeenCalledWith({
      choices: [
        { label: "Updated Choice", value: "option1" },
        { label: "Option 2", value: "option2" },
      ],
    });
  });

  test("renders, edit value", () => {
    const onChange = jest.fn();

    render(
      <DropdownMetadata
        onChange={onChange}
        values={{
          choices: [
            { label: "Option 1", value: "option1" },
            { label: "Option 2", value: "option2" },
          ],
        }}
      />,
    );

    const valueInput = screen.getByLabelText("Choice 1 value");

    fireEvent.change(valueInput, { target: { value: "updated_choice" } });

    expect(onChange).toHaveBeenCalledWith({
      choices: [
        { label: "Option 1", value: "updated_choice" },
        { label: "Option 2", value: "option2" },
      ],
    });
  });
});

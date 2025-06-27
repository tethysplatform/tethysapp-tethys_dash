import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InputTable from "components/inputs/InputTable";

it("InputTable", async () => {
  const label = "Test Table";
  const onChange = jest.fn();
  const values = [{ "field 1": true, "field 2": "value 2" }];
  render(<InputTable label={label} onChange={onChange} values={values} />);

  // field 1 should be a checkbox
  expect(screen.getByText("field 1")).toBeInTheDocument();
  const checkbox = screen.getByRole("checkbox");
  expect(checkbox).toBeInTheDocument();
  fireEvent.click(checkbox);
  expect(checkbox).not.toBeChecked();

  // field 2 should be a textbox
  expect(screen.getByText("field 2")).toBeInTheDocument();
  const field2Input = screen.getByLabelText("field 2 Input 0");
  expect(field2Input).toBeInTheDocument();
  expect(field2Input.value).toBe("value 2");

  // make sure a new row is not created on tab
  field2Input.focus();
  await userEvent.tab();

  expect(screen.queryAllByRole("textbox").length).toBe(1);
});

it("InputTable hidden fields", async () => {
  const label = "Test Table";
  const onChange = jest.fn();
  const values = [{ "field 1": true, "field 2": { some: "object" } }];
  render(
    <InputTable
      label={label}
      onChange={onChange}
      values={values}
      hiddenFields={["field 1"]}
      disabledFields={["field 2"]}
    />
  );

  // field 1 should be a checkbox
  expect(screen.queryByText("field 1")).not.toBeInTheDocument();
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();

  // field 2 should be a stringified object
  expect(
    screen.getByText(JSON.stringify({ some: "object" }))
  ).toBeInTheDocument();
});

it("InputTable allow row creation", async () => {
  const label = "Test Table";
  const onChange = jest.fn();
  const values = [{ "field 1": "value 1", "field 2": "value 2" }];
  render(
    <InputTable
      label={label}
      onChange={onChange}
      values={values}
      allowRowCreation={true}
    />
  );

  // check that 2 textboxes were rendered
  expect(screen.getByText("field 1")).toBeInTheDocument();
  const field1Input = screen.getByLabelText("field 1 Input 0");
  expect(field1Input).toBeInTheDocument();

  expect(screen.getByText("field 2")).toBeInTheDocument();
  const field2Input = screen.getByLabelText("field 2 Input 0");
  expect(field2Input).toBeInTheDocument();

  // tab should only add new row if the last column is tabbed on
  field1Input.focus();
  await userEvent.tab();
  expect(screen.queryAllByRole("textbox").length).toBe(2);

  // tab on last column creates a new row if allowRowCreation is true
  field2Input.focus();
  await userEvent.tab();
  expect(screen.queryAllByRole("textbox").length).toBe(4);

  // type into field 1 in new row
  const secondToLastTextbox = screen.queryAllByRole("textbox")[2];
  await userEvent.type(secondToLastTextbox, "t");

  // backspace into field 2 shouldnt really do anything because the other input in the row is not empty
  const lastTextbox = screen.queryAllByRole("textbox")[3];
  await userEvent.type(lastTextbox, "{Backspace}");
  expect(screen.queryAllByRole("textbox").length).toBe(4);

  // deleting text in field 1 and then backspaces in field 2 now should delete the row
  await userEvent.type(secondToLastTextbox, "{backspace}");
  await userEvent.type(lastTextbox, "{backspace}");
  expect(screen.queryAllByRole("textbox").length).toBe(2);
  expect(field1Input).toHaveFocus();
});

it("InputTable allow row creation with checkbox at end", async () => {
  const label = "Test Table";
  const onChange = jest.fn();
  const values = [{ "field 1": "value 1", "field 2": true }];
  render(
    <InputTable
      label={label}
      onChange={onChange}
      values={values}
      allowRowCreation={true}
    />
  );

  expect(screen.getAllByRole("textbox").length).toBe(1);
  expect(screen.getAllByRole("checkbox").length).toBe(1);

  // tab on last textbox should create new row
  const checkbox = screen.getByRole("checkbox");
  checkbox.focus();
  await userEvent.tab();
  expect(screen.getAllByRole("textbox").length).toBe(2);
  expect(screen.getAllByRole("checkbox").length).toBe(2);

  // type into last textbox should just update input
  const lastTextbox = screen.queryAllByRole("textbox")[1];
  await userEvent.type(lastTextbox, "t");
  expect(screen.getAllByRole("textbox").length).toBe(2);
  expect(screen.getAllByRole("checkbox").length).toBe(2);

  // backspace into last textbox makes it empty
  await userEvent.type(lastTextbox, "{Backspace}");
  expect(screen.getAllByRole("textbox").length).toBe(2);
  expect(screen.getAllByRole("checkbox").length).toBe(2);

  // backspace into last textbox when empty deletes the row
  await userEvent.type(lastTextbox, "{Backspace}");
  expect(screen.getAllByRole("textbox").length).toBe(1);
  expect(screen.getAllByRole("checkbox").length).toBe(1);
});

it("InputTable Disabled Fields", async () => {
  const label = "Test Table";
  const onChange = jest.fn();
  const values = [
    { "field 1": "value 1", "field 2": "value 2", "field 3": "value 3" },
  ];
  render(
    <InputTable
      label={label}
      onChange={onChange}
      values={values}
      disabledFields={["field 1", "field 3"]}
    />
  );

  expect(screen.getByText("field 1")).toBeInTheDocument();
  expect(screen.getByText("value 1")).toBeInTheDocument();
  expect(screen.getByText("field 3")).toBeInTheDocument();
  expect(screen.getByText("value 3")).toBeInTheDocument();

  expect(screen.getByText("field 2")).toBeInTheDocument();
  const field2Input = screen.getByLabelText("field 2 Input 0");
  expect(field2Input).toBeInTheDocument();

  expect(screen.queryAllByRole("textbox").length).toBe(1);
});

it("InputTable Placeholders", async () => {
  const label = "Test Table";
  const onChange = jest.fn();
  const values = [
    {
      "field 1": {
        value: "value 1",
        placeholder: "here is a field 1 placeholder",
      },
      "field 2": "value 2",
    },
  ];
  const placeholders = [
    {
      "field 1": "here is a field 1 placeholder",
    },
  ];
  render(
    <InputTable
      label={label}
      onChange={onChange}
      values={values}
      placeholders={placeholders}
    />
  );

  expect(screen.getByText("field 1")).toBeInTheDocument();
  const field1Input = screen.getByLabelText("field 1 Input 0");
  expect(field1Input).toBeInTheDocument();
  expect(field1Input.placeholder).toBe("here is a field 1 placeholder");

  expect(screen.getByText("field 2")).toBeInTheDocument();
  const field2Input = screen.getByLabelText("field 2 Input 0");
  expect(field2Input).toBeInTheDocument();
  expect(field2Input.placeholder).toBe("");
});

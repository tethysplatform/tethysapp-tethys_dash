import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InputTable from "components/inputs/InputTable";
import selectEvent from "react-select-event";

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
    />,
  );

  // field 1 should be a checkbox
  expect(screen.queryByText("field 1")).not.toBeInTheDocument();
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();

  // field 2 should be a stringified object
  expect(
    screen.getByText(JSON.stringify({ some: "object" })),
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
    />,
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
    />,
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
    />,
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
    />,
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

describe("InputTable select rows", () => {
  const renderTable = ({
    values,
    types,
    selectConfigs,
    placeholders,
    onChange = jest.fn(),
  }) => {
    render(
      <InputTable
        label="Test Table"
        onChange={onChange}
        values={values}
        types={types}
        selectConfigs={selectConfigs}
        placeholders={placeholders}
      />,
    );
  };

  const OPTIONS = [
    { value: "depth", label: "depth" },
    { value: "elev", label: "elev" },
  ];

  it('renders a combobox for a row typed "select" and a text input otherwise', async () => {
    renderTable({
      values: [{ value: "" }, { value: "" }],
      types: ["select", "text"],
      selectConfigs: [{ options: OPTIONS }],
    });

    // The select row answers to the same accessible name a text row would, so
    // callers do not have to know which branch rendered it.
    expect(screen.getByLabelText("value Input 0")).toHaveAttribute(
      "role",
      "combobox",
    );
    expect(screen.getByLabelText("value Input 1").tagName).toBe("INPUT");
    expect(screen.getAllByRole("combobox").length).toBe(1);
  });

  it("writes the chosen option's value back as a plain string", async () => {
    const onChange = jest.fn();
    renderTable({
      values: [{ value: "" }],
      types: ["select"],
      selectConfigs: [{ options: OPTIONS }],
      onChange,
    });

    await selectEvent.select(screen.getByLabelText("value Input 0"), "elev");

    // Not the {value,label} object: every other row type stores a string, and
    // isRowEmpty/getEmptyRow both compare against "".
    expect(onChange).toHaveBeenCalledWith({
      newValue: "elev",
      rowIndex: 0,
      field: "value",
    });
  });

  it("accepts a typed value that is not among the options", async () => {
    const onChange = jest.fn();
    renderTable({
      values: [{ value: "" }],
      types: ["select"],
      selectConfigs: [{ options: OPTIONS }],
      onChange,
    });

    const dropdown = screen.getByLabelText("value Input 0");
    await userEvent.type(dropdown, "salinity");
    await userEvent.click(await screen.findByText('Use "salinity"'));

    // The creatable variant tags typed entries with __isNew__; the row must
    // still receive the bare string.
    expect(onChange).toHaveBeenCalledWith({
      newValue: "salinity",
      rowIndex: 0,
      field: "value",
    });
  });

  it("displays an option's label while storing its value", async () => {
    const onChange = jest.fn();
    renderTable({
      values: [{ value: "" }],
      types: ["select"],
      selectConfigs: [
        { options: [{ value: "sea_surface_height", label: "Surface height" }] },
      ],
      onChange,
    });

    const dropdown = screen.getByLabelText("value Input 0");
    await selectEvent.select(dropdown, "Surface height");

    expect(onChange).toHaveBeenCalledWith({
      newValue: "sea_surface_height",
      rowIndex: 0,
      field: "value",
    });
    expect(screen.getByText("Surface height")).toBeInTheDocument();
  });

  it("seeds a saved value that no option matches so it stays selected", async () => {
    renderTable({
      values: [{ value: "gone_from_the_store" }],
      types: ["select"],
      selectConfigs: [{ options: OPTIONS }],
    });

    // A saved value the source no longer offers must remain visible and
    // editable rather than being silently dropped on render.
    expect(screen.getByText("gone_from_the_store")).toBeInTheDocument();
  });

  it("renders row content beneath that row's select only", async () => {
    renderTable({
      values: [{ value: "" }, { value: "" }],
      types: ["select", "select"],
      selectConfigs: [
        { options: OPTIONS, content: <span>row zero note</span> },
        { options: OPTIONS },
      ],
    });

    // Row 0 only -- the slot is what gives per-row failure text and the
    // re-read control somewhere to live inside the table markup, and it is
    // useless if it bleeds onto every row.
    const [, rowZero, rowOne] = screen.getAllByRole("row");
    expect(within(rowZero).getByText("row zero note")).toBeInTheDocument();
    expect(within(rowOne).queryByText("row zero note")).not.toBeInTheDocument();
  });

  it("never falls through to the plain input branch", async () => {
    renderTable({
      values: [{ value: "" }],
      types: ["select"],
      selectConfigs: [{ options: OPTIONS }],
    });

    // The fallback branch feeds types[rowIndex] straight to <input type=...>,
    // which would render type="select" -- an unknown type the browser falls
    // back to text for, silently replacing the dropdown with a text box.
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("passes the loading flag and menu-open callback through to the control", async () => {
    const onMenuOpen = jest.fn();
    renderTable({
      values: [{ value: "" }],
      types: ["select"],
      selectConfigs: [{ options: [], isLoading: true, onMenuOpen }],
    });

    const dropdown = screen.getByLabelText("value Input 0");
    await selectEvent.openMenu(dropdown);

    // Lazily reading on menu-open is the whole fetch trigger; without this
    // channel nothing would ever ask for values.
    expect(onMenuOpen).toHaveBeenCalled();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("accepts a typed entry while a read is loading and after one failed", async () => {
    const onChange = jest.fn();
    renderTable({
      values: [{ value: "" }],
      types: ["select"],
      // No options and a read in flight: the author who knows the name must
      // still be able to enter it.
      selectConfigs: [{ options: [], isLoading: true }],
      onChange,
    });

    const dropdown = screen.getByLabelText("value Input 0");
    await userEvent.type(dropdown, "depth");
    await userEvent.click(await screen.findByText('Use "depth"'));

    expect(onChange).toHaveBeenCalledWith({
      newValue: "depth",
      rowIndex: 0,
      field: "value",
    });
  });

  it("joins a multiselect's selections with the declared separator", async () => {
    const onChange = jest.fn();
    renderTable({
      values: [{ value: "depth" }],
      types: ["multiselect"],
      selectConfigs: [{ options: OPTIONS, separator: "," }],
      onChange,
    });

    await selectEvent.select(screen.getByLabelText("value Input 0"), "elev");

    // Stored in the source's own format, not as an array: the reader splits
    // this string on commas.
    expect(onChange).toHaveBeenCalledWith({
      newValue: "depth,elev",
      rowIndex: 0,
      field: "value",
    });
  });

  it("seeds a multiselect from a comma-separated value, tolerating whitespace", async () => {
    renderTable({
      values: [{ value: "elev, depth" }],
      types: ["multiselect"],
      selectConfigs: [{ options: OPTIONS, separator: "," }],
    });

    // The reader's own column parsing trims before matching, so an untrimmed
    // seed would show " depth" -- an entry that matches no fetched option.
    expect(screen.getByText("elev")).toBeInTheDocument();
    expect(screen.getByText("depth")).toBeInTheDocument();
    expect(screen.queryByText(" depth")).not.toBeInTheDocument();
  });

  it("keeps a typed entry that is not among the options in the joined value", async () => {
    const onChange = jest.fn();
    renderTable({
      values: [{ value: "depth" }],
      types: ["multiselect"],
      selectConfigs: [{ options: OPTIONS, separator: "," }],
      onChange,
    });

    const dropdown = screen.getByLabelText("value Input 0");
    await userEvent.type(dropdown, "salinity");
    await userEvent.click(await screen.findByText('Use "salinity"'));

    expect(onChange).toHaveBeenCalledWith({
      newValue: "depth,salinity",
      rowIndex: 0,
      field: "value",
    });
  });

  it("removes only the deselected entry from a multiselect", async () => {
    const onChange = jest.fn();
    renderTable({
      values: [{ value: "depth,elev" }],
      types: ["multiselect"],
      selectConfigs: [{ options: OPTIONS, separator: "," }],
      onChange,
    });

    // react-select renders one remove control per selected entry.
    await userEvent.click(screen.getAllByRole("button")[0]);

    expect(onChange).toHaveBeenCalledWith({
      newValue: "elev",
      rowIndex: 0,
      field: "value",
    });
  });

  it("takes multiplicity from the declared type, never from the stored value", async () => {
    renderTable({
      values: [{ value: "depth,elev" }],
      // Declared single-valued even though the value contains the separator.
      types: ["select"],
      selectConfigs: [{ options: OPTIONS, separator: "," }],
    });

    // One selection holding the literal text, not two entries: a single-valued
    // argument whose value legitimately contains a comma must not be split.
    expect(screen.getByText("depth,elev")).toBeInTheDocument();
    expect(screen.queryByText("depth")).not.toBeInTheDocument();
    expect(screen.queryByText("elev")).not.toBeInTheDocument();
  });

  it("shows the row's placeholder on an empty select", async () => {
    renderTable({
      values: [{ value: "" }],
      types: ["select"],
      selectConfigs: [{ options: OPTIONS }],
      placeholders: [{ value: "Variable / array name" }],
    });

    expect(screen.getByText("Variable / array name")).toBeInTheDocument();
  });
});

it("does not hand focus to the first input when a non-control cell is clicked", async () => {
  // The table used to be wrapped in a <label>. A label with no `for` labels its
  // first labelable descendant, so clicking anything inside it that is not
  // itself a control handed focus to that first input -- which shut a dropdown
  // in a later row the moment the mouse came up.
  const user = userEvent.setup();
  render(
    <InputTable
      label="Source Properties"
      onChange={jest.fn()}
      values={[
        { property: "url", value: "https://host/store.zarr" },
        { property: "variable", value: "" },
      ]}
      disabledFields={["property"]}
      types={["text", "select"]}
      selectConfigs={[
        null,
        {
          options: [{ value: "depth", label: "depth" }],
          onMenuOpen: jest.fn(),
        },
      ]}
    />,
  );

  const urlInput = screen.getByLabelText("value Input 0");
  await user.click(screen.getByText("variable"));
  expect(urlInput).not.toHaveFocus();
});

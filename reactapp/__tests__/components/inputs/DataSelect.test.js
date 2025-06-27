import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DataSelect from "components/inputs/DataSelect";
import selectEvent from "react-select-event";

it("DataSelect", async () => {
  const label = "Some Label";
  const options = [
    { value: "value 1", label: "label 1" },
    { value: "value 2", label: "label 2" },
  ];
  const selectedOption = null;
  const onChange = jest.fn();

  render(
    <DataSelect
      label={label}
      selectedOption={selectedOption}
      onChange={onChange}
      options={options}
    />
  );

  const dropdown = await screen.findByRole("combobox");
  await selectEvent.openMenu(dropdown);

  expect(screen.getByText("label 1")).toBeInTheDocument();
  expect(screen.getByText("label 2")).toBeInTheDocument();

  await selectEvent.select(dropdown, "label 1");
  expect(onChange.mock.calls[0][0]).toStrictEqual({
    value: "value 1",
    label: "label 1",
  });

  await userEvent.type(dropdown, "My New Option");
  expect(await screen.findByText('Use "My New Option"')).toBeInTheDocument();
  await userEvent.click(screen.getByText('Use "My New Option"'));

  expect(onChange.mock.calls[1][0]).toStrictEqual({
    label: "My New Option",
    value: "My New Option",
    __isNew__: true,
  });
});

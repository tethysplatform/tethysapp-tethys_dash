import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MultiInput from "components/inputs/MultiInput";

it("MultiInput", async () => {
  const label = "Test Multi Input";
  const onChange = jest.fn();
  const values = [];

  const { rerender } = render(
    <MultiInput label={label} onChange={onChange} values={values} />
  );

  expect(screen.getByText("Test Multi Input")).toBeInTheDocument();

  const input = screen.getByRole("textbox");

  // nothing is added when enter pressed on empty string
  await userEvent.type(input, " {enter}");
  expect(screen.queryByRole("button")).not.toBeInTheDocument();

  // type into input and hit enter to add a new row for the submitted value
  await userEvent.type(input, "Some Input Value{enter}");
  expect(await screen.findByRole("button")).toBeInTheDocument();
  expect(await screen.findByText("Some Input Value")).toBeInTheDocument();

  // press the x on the submitted values to remove it
  const removeButton = await screen.findByText("x");
  fireEvent.click(removeButton);
  expect(screen.queryByText("Some Input Value")).not.toBeInTheDocument();

  rerender(
    <MultiInput label={label} onChange={onChange} values={["Some new Value"]} />
  );
  expect(await screen.findByText("Some new Value")).toBeInTheDocument();
});

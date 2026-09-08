import { render, screen } from "@testing-library/react";
import TextArea from "components/inputs/TextArea";

it("tells a required field's author the limit", () => {
  render(
    <TextArea label="Notes" value="" maxLength={200} onChange={jest.fn()} />,
  );
  expect(screen.getByLabelText("Notes Input")).toHaveAttribute(
    "placeholder",
    "Enter up to 200 characters",
  );
});

it("says so when the field is optional", () => {
  render(
    <TextArea
      label="Notes"
      value=""
      maxLength={200}
      optional
      onChange={jest.fn()}
    />,
  );
  expect(screen.getByLabelText("Notes Input")).toHaveAttribute(
    "placeholder",
    "Optional. Up to 200 characters",
  );
});

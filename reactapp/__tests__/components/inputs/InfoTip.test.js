import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InfoTip from "components/inputs/InfoTip";
import CheckboxInput from "components/inputs/CheckboxInput";

test("InfoTip shows its explanation on hover and on keyboard focus", async () => {
  render(<InfoTip label="Fill Viewport">Fills the screen.</InfoTip>);

  expect(screen.queryByText("Fills the screen.")).not.toBeInTheDocument();
  await userEvent.hover(screen.getByLabelText("Fill Viewport help"));
  expect(await screen.findByText("Fills the screen.")).toBeInTheDocument();
});

test("InfoTip is reachable with the keyboard", async () => {
  render(<InfoTip label="Fill Viewport">Fills the screen.</InfoTip>);

  await userEvent.tab();
  expect(screen.getByLabelText("Fill Viewport help")).toHaveFocus();
  expect(await screen.findByText("Fills the screen.")).toBeInTheDocument();
});

test("CheckboxInput puts the info icon before its label, and only when given one", () => {
  const { rerender } = render(
    <CheckboxInput
      label="Fill Viewport"
      type="checkbox"
      value={false}
      onChange={() => {}}
      infoTip="Fills the screen."
    />,
  );

  const help = screen.getByLabelText("Fill Viewport help");
  const label = screen.getByText("Fill Viewport");
  // DOCUMENT_POSITION_FOLLOWING: the label comes after the icon.
  expect(help.compareDocumentPosition(label) & 4).toBeTruthy();

  rerender(
    <CheckboxInput
      label="Fill Viewport"
      type="checkbox"
      value={false}
      onChange={() => {}}
    />,
  );
  expect(screen.queryByLabelText("Fill Viewport help")).not.toBeInTheDocument();
});

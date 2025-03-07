import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { confirm } from "components/inputs/DeleteConfirmation";

const TestingComponent = () => {
  const [confirmed, setConfirmed] = useState(true);

  async function showConfirmation() {
    setConfirmed(await confirm("Are you sure you want this?"));
  }

  return (
    <>
      <button onClick={showConfirmation}></button>
      <p>{confirmed ? "confirmed" : "not confirmed"}</p>
    </>
  );
};

test("confirm ok", async () => {
  render(<TestingComponent />);

  expect(await screen.findByText("confirmed")).toBeInTheDocument();

  const button = screen.getByRole("button");
  await userEvent.click(button);
  expect(
    await screen.findByText("Are you sure you want this?")
  ).toBeInTheDocument();
  const cancelButton = await screen.findByText("Cancel");
  expect(cancelButton).toBeInTheDocument();
  expect(await screen.findByText("OK")).toBeInTheDocument();
  await userEvent.click(cancelButton);
  expect(await screen.findByText("not confirmed")).toBeInTheDocument();

  await userEvent.click(button);
  const OKButton = await screen.findByText("OK");
  await userEvent.click(OKButton);
  expect(await screen.findByText("confirmed")).toBeInTheDocument();

  await userEvent.click(button);
  await userEvent.keyboard("{Escape}");
  expect(await screen.findByText("not confirmed")).toBeInTheDocument();
});

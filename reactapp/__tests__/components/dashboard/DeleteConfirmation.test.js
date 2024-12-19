import { act, useState } from "react";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { confirm } from "components/dashboard/DeleteConfirmation";

const TestingComponent = () => {
  const [confirmed, setConfirmed] = useState(true);

  async function showConfirmation() {
    setConfirmed(await confirm("Are you sure you want this?"));
  }

  return (
    <>
      <button onClick={showConfirmation}></button>
      <p>{confirmed ? "yes" : "no"}</p>
    </>
  );
};

test("confirm ok", async () => {
  render(<TestingComponent />);

  expect(await screen.findByText("yes")).toBeInTheDocument();

  const button = screen.getByRole("button");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(button);
  });
  expect(
    await screen.findByText("Are you sure you want this?")
  ).toBeInTheDocument();
  const cancelButton = await screen.findByText("Cancel");
  expect(cancelButton).toBeInTheDocument();
  expect(await screen.findByText("OK")).toBeInTheDocument();
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(cancelButton);
  });
  expect(await screen.findByText("no")).toBeInTheDocument();

  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(button);
  });
  const OKButton = await screen.findByText("OK");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(OKButton);
  });
  expect(await screen.findByText("yes")).toBeInTheDocument();

  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(button);
  });
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.keyboard("{Escape}");
  });
  expect(await screen.findByText("no")).toBeInTheDocument();
});

import { act, useState } from "react";
import userEvent from "@testing-library/user-event";
import { render, screen, within, fireEvent } from "@testing-library/react";
import CustomAlert from "components/dashboard/CustomAlert";

const TestingComponent = () => {
  const [showAlert, setShowAlert] = useState(true);
  function showAlertMessage() {
    setShowAlert(true);
  }

  return (
    <>
      <button data-testid="showAlert" onClick={showAlertMessage}></button>
      <CustomAlert
        alertType={"warning"}
        showAlert={showAlert}
        setShowAlert={setShowAlert}
        alertMessage={"Some Alert Message"}
      />
    </>
  );
};

test("CustomAlert context", async () => {
  jest.useFakeTimers();

  render(<TestingComponent />);

  expect(await screen.findByText("Some Alert Message")).toBeInTheDocument();

  act(() => {
    jest.advanceTimersByTime(7000);
  });

  expect(screen.queryByText("Some Alert Message")).not.toBeInTheDocument();

  const showAlertButton = await screen.findByTestId("showAlert");
  userEvent.click(showAlertButton);
  expect(await screen.findByText("Some Alert Message")).toBeInTheDocument();

  const alertElement = screen.getByRole("alert");
  const closeAlertButton = within(alertElement).getByRole("button");
  expect(closeAlertButton).toBeInTheDocument();
  fireEvent.click(closeAlertButton);
  expect(screen.queryByText("Some Alert Message")).not.toBeInTheDocument();

  jest.useRealTimers();
});

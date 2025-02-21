import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import FullscreenPlotModal from "components/modals/FullscreenPlot";
import PropTypes from "prop-types";

const TestingComponent = () => {
  const [showModal, setShowmodal] = useState(true);

  function handleModalClose() {
    setShowmodal(false);
  }

  return (
    <>
      <FullscreenPlotModal
        showModal={showModal}
        handleModalClose={handleModalClose}
      >
        Hello World
      </FullscreenPlotModal>
    </>
  );
};

test("fullscreen modal and close", async () => {
  render(<TestingComponent />);

  expect(await screen.findByText("Hello World")).toBeInTheDocument();
  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  expect(await screen.findByRole("dialog")).toHaveClass("fullscreen");

  const closeButton = await screen.findByLabelText("Close");
  fireEvent.click(closeButton);

  await waitFor(() => {
    expect(screen.queryByText("Hello World")).not.toBeInTheDocument();
  });
});

TestingComponent.propTypes = {
  layoutContext: PropTypes.object,
};

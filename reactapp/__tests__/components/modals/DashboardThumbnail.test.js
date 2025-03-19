import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DashboardThumbnailModal from "components/modals/DashboardThumbnail";
import createLoadedComponent from "__tests__/utilities/customRender";
import PropTypes from "prop-types";

const TestingComponent = ({ onUpdateThumbnail }) => {
  const [showModal, setShowModal] = useState(true);

  return (
    <div>
      <DashboardThumbnailModal
        showModal={showModal}
        setShowModal={setShowModal}
        onUpdateThumbnail={onUpdateThumbnail}
      />
    </div>
  );
};

test("DashboardThumbnailModal", async () => {
  const onUpdateThumbnail = jest.fn();

  global.FileReader = class {
    readAsDataURL() {
      this.onloadend();
    }
    onloadend = jest.fn();
    result = "data:image/png;base64,testImage"; // Mocked image data URL
  };

  render(
    createLoadedComponent({
      children: <TestingComponent onUpdateThumbnail={onUpdateThumbnail} />,
    })
  );

  expect(
    await screen.findByText("Update Dashboard Thumbnail")
  ).toBeInTheDocument();

  const file = new File(["dummy content"], "test-image.png", {
    type: "image/png",
  });
  const input = screen.getByTestId("file-input");
  await userEvent.upload(input, file);

  const updateThumbnailButton = screen.getByLabelText(
    "Update Thumbnail Button"
  );

  await waitFor(() => {
    expect(screen.getByAltText("Uploaded")).toBeInTheDocument();
  });
  await userEvent.click(updateThumbnailButton);

  await waitFor(async () => {
    expect(onUpdateThumbnail).toHaveBeenCalledWith(
      "data:image/png;base64,testImage"
    );
  });
});

test("DashboardThumbnailModal no file", async () => {
  const onUpdateThumbnail = jest.fn();

  global.FileReader = class {
    readAsDataURL() {
      this.onloadend();
    }
    onloadend = jest.fn();
    result = "data:image/png;base64,testImage"; // Mocked image data URL
  };

  render(
    createLoadedComponent({
      children: <TestingComponent onUpdateThumbnail={onUpdateThumbnail} />,
    })
  );

  expect(
    await screen.findByText("Update Dashboard Thumbnail")
  ).toBeInTheDocument();

  const input = screen.getByTestId("file-input");
  fireEvent.change(input, {
    target: { files: [] },
  });

  await waitFor(() => {
    expect(screen.queryByAltText("Uploaded")).not.toBeInTheDocument();
  });
});

test("DashboardThumbnailModal close", async () => {
  const onUpdateThumbnail = jest.fn();

  render(
    createLoadedComponent({
      children: <TestingComponent onUpdateThumbnail={onUpdateThumbnail} />,
    })
  );

  expect(
    await screen.findByText("Update Dashboard Thumbnail")
  ).toBeInTheDocument();

  const closeThumbnailModalButton = await screen.findByLabelText(
    "Close Thumbnail Modal Button"
  );
  await userEvent.click(closeThumbnailModalButton);

  await waitFor(() => {
    expect(
      screen.queryByText("Update Dashboard Thumbnail")
    ).not.toBeInTheDocument();
  });
});

TestingComponent.propTypes = {
  onUpdateThumbnail: PropTypes.func,
};

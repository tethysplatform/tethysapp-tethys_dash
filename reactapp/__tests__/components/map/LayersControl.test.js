import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LayersControl from "components/map/LayersControl";

test("LayersControl update layers", async () => {
  const mockedImageArcGISLayerProps = { name: "ImageArcGISLayer" };
  const getVisibleMock = jest.fn();
  const setVisibleMock = jest.fn();
  const mockedImageArcGISLayer = {
    get: jest.fn((key) => mockedImageArcGISLayerProps[key]),
    getVisible: getVisibleMock,
    setVisible: setVisibleMock,
  };

  const { rerender } = render(
    <LayersControl layers={[mockedImageArcGISLayer]} />
  );
  expect(screen.queryByText("ImageArcGISLayer")).not.toBeInTheDocument();
  expect(getVisibleMock).toHaveBeenCalledTimes(0);

  const showLayersButton = await screen.findByLabelText("Show Layers Control");
  fireEvent.click(showLayersButton);

  expect(await screen.findByText("ImageArcGISLayer")).toBeInTheDocument();
  expect(getVisibleMock).toHaveBeenCalledTimes(1);

  const setVisibleButton = await screen.findByLabelText(
    "ImageArcGISLayer Set Visible"
  );
  fireEvent.click(setVisibleButton);
  expect(setVisibleMock).toHaveBeenCalledTimes(1);

  const mockedLayerProps = {};
  const mockedLayer = {
    get: jest.fn((key) => mockedLayerProps[key]),
    getVisible: jest.fn(),
    setVisible: jest.fn(),
  };

  rerender(<LayersControl layers={[mockedLayer]} />);
  expect(screen.queryByText("ImageArcGISLayer")).not.toBeInTheDocument();
  expect(await screen.findByText("Layer 1")).toBeInTheDocument();

  const closeLayersButton = await screen.findByLabelText(
    "Close Layers Control"
  );
  fireEvent.click(closeLayersButton);
  expect(screen.queryByText("Layer 1")).not.toBeInTheDocument();
});

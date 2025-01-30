import { render, screen, fireEvent } from "@testing-library/react";
import { MapContext } from "components/contexts/Contexts";
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

  const mockGetArray = jest.fn();
  mockGetArray.mockReturnValue([mockedImageArcGISLayer]);
  const mockGetLayers = {
    getArray: mockGetArray,
  };
  const mockMap = {
    getLayers: jest.fn(() => mockGetLayers),
  };

  const updater = true;
  const { rerender } = render(
    <MapContext.Provider value={{ map: mockMap }}>
      <LayersControl updater={updater} />
    </MapContext.Provider>
  );
  expect(screen.queryByText("ImageArcGISLayer")).not.toBeInTheDocument();
  expect(getVisibleMock).toHaveBeenCalledTimes(1);

  const showLayersButton = await screen.findByLabelText("Show Layers Control");
  fireEvent.click(showLayersButton);

  expect(await screen.findByText("ImageArcGISLayer")).toBeInTheDocument();

  const setVisibleCheckbox = await screen.findByLabelText(
    "ImageArcGISLayer Set Visible"
  );
  fireEvent.click(setVisibleCheckbox);
  expect(setVisibleCheckbox.checked).toEqual(false);
  expect(setVisibleMock).toHaveBeenCalledTimes(1);

  const mockedLayerProps = {};
  const mockedLayer = {
    get: jest.fn((key) => mockedLayerProps[key]),
    getVisible: jest.fn(),
    setVisible: jest.fn(),
  };
  mockGetArray.mockReturnValue([mockedLayer]);
  rerender(
    <MapContext.Provider value={{ map: mockMap }}>
      <LayersControl updater={!updater} />
    </MapContext.Provider>
  );
  expect(screen.queryByText("ImageArcGISLayer")).not.toBeInTheDocument();
  expect(await screen.findByText("Layer 1")).toBeInTheDocument();

  const closeLayersButton = await screen.findByLabelText(
    "Close Layers Control"
  );
  fireEvent.click(closeLayersButton);
  expect(screen.queryByText("Layer 1")).not.toBeInTheDocument();
});

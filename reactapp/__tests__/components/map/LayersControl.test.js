import { render, screen, fireEvent } from "@testing-library/react";
import LayersControl from "components/map/LayersControl";

test("LayersControl update layers", async () => {
  let visualizationRef;
  let updater;

  // map object is not defined yet
  visualizationRef = { current: undefined };
  updater = null;
  const { rerender } = render(
    <LayersControl updater={updater} visualizationRef={visualizationRef} />
  );
  const showLayersButton = await screen.findByLabelText("Show Layers Control");
  fireEvent.click(showLayersButton);

  const mapLayersDiv = await screen.findByLabelText("Map Layers");
  // eslint-disable-next-line
  expect(mapLayersDiv.children.length).toBe(0);

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
  visualizationRef = {
    current: {
      getLayers: jest.fn(() => mockGetLayers),
    },
  };

  updater = true;
  rerender(
    <LayersControl updater={updater} visualizationRef={visualizationRef} />
  );
  // eslint-disable-next-line
  expect(mapLayersDiv.children.length).toBe(1);
  expect(getVisibleMock).toHaveBeenCalledTimes(1);
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
    <LayersControl updater={!updater} visualizationRef={visualizationRef} />
  );
  expect(screen.queryByText("ImageArcGISLayer")).not.toBeInTheDocument();
  expect(await screen.findByText("Layer 1")).toBeInTheDocument();

  const closeLayersButton = await screen.findByLabelText(
    "Close Layers Control"
  );
  fireEvent.click(closeLayersButton);
  expect(screen.queryByText("Layer 1")).not.toBeInTheDocument();
});

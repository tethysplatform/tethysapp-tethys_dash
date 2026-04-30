import { render, screen, fireEvent } from "@testing-library/react";
import LayersControl, { parseProgress } from "components/map/LayersControl";
import { WebsocketContext } from "components/contexts/WebSocketContext";

test("LayersControl update layers", async () => {
  let visualizationRef;
  let updater;

  // map object is not defined yet
  visualizationRef = { current: undefined };
  updater = null;
  const { rerender } = render(
    <LayersControl updater={updater} visualizationRef={visualizationRef} />,
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
    <LayersControl updater={updater} visualizationRef={visualizationRef} />,
  );
  // eslint-disable-next-line
  expect(mapLayersDiv.children.length).toBe(1);
  expect(getVisibleMock).toHaveBeenCalledTimes(1);
  expect(await screen.findByText("ImageArcGISLayer")).toBeInTheDocument();

  const setVisibleCheckbox = await screen.findByLabelText(
    "ImageArcGISLayer Set Visible",
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
    <LayersControl updater={!updater} visualizationRef={visualizationRef} />,
  );
  expect(screen.queryByText("ImageArcGISLayer")).not.toBeInTheDocument();
  expect(await screen.findByText("Layer 1")).toBeInTheDocument();

  const closeLayersButton = await screen.findByLabelText(
    "Close Layers Control",
  );
  fireEvent.click(closeLayersButton);
  expect(screen.queryByText("Layer 1")).not.toBeInTheDocument();
});

// --- Runtime dynamic_map_layer progress + error indicators ------------------

function makeRuntimeOlLayer({
  name = "Runtime Layer",
  layerId = "layer-1",
  visible = true,
}) {
  const props = { name, layerId };
  return {
    get: (key) => props[key],
    getVisible: () => visible,
    setVisible: jest.fn(),
  };
}

function mountLayersControl({
  olLayer,
  runtimeLayerState = {},
  websocketValue = {},
  expanded = true,
}) {
  const mockGetLayers = { getArray: () => [olLayer] };
  const visualizationRef = {
    current: { getLayers: () => mockGetLayers },
  };
  const { rerender } = render(
    <WebsocketContext.Provider value={websocketValue}>
      <LayersControl
        visualizationRef={visualizationRef}
        runtimeLayerState={runtimeLayerState}
        updater={false}
      />
    </WebsocketContext.Provider>,
  );
  if (expanded) {
    const toggle = screen.queryByLabelText("Show Layers Control");
    if (toggle) fireEvent.click(toggle);
  }
  return { rerender, visualizationRef };
}

test("LayersControl shows progress bar for runtime layer with WebSocket percentage", async () => {
  const olLayer = makeRuntimeOlLayer({ layerId: "layer-1" });
  const getMessageForRequest = jest.fn((rid) => {
    if (rid === "nonce:grid:layer-1") {
      return JSON.stringify({
        requestId: rid,
        message: "computing",
        percentageComplete: 42,
        layerId: "layer-1",
      });
    }
    return undefined;
  });

  mountLayersControl({
    olLayer,
    runtimeLayerState: {
      errorsByLayerId: {},
      retry: jest.fn(),
      sessionNonce: "nonce",
      gridItemUuid: "grid",
    },
    websocketValue: { getMessageForRequest },
  });

  const liveRegion = await screen.findByRole("status");
  expect(liveRegion).toHaveAttribute("aria-live", "polite");
  expect(liveRegion.getAttribute("aria-label")).toMatch(/42%/);
});

test("LayersControl hides progress bar once an error is recorded", async () => {
  const olLayer = makeRuntimeOlLayer({ layerId: "layer-1" });
  const getMessageForRequest = jest.fn(() =>
    JSON.stringify({ percentageComplete: 50 }),
  );

  mountLayersControl({
    olLayer,
    runtimeLayerState: {
      errorsByLayerId: {
        "layer-1": { message: "boom", kind: "error" },
      },
      retry: jest.fn(),
      sessionNonce: "nonce",
      gridItemUuid: "grid",
    },
    websocketValue: { getMessageForRequest },
  });

  // Error badge visible, progress bar suppressed.
  expect(await screen.findByRole("alert")).toHaveTextContent("boom");
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

test("LayersControl Retry button fires retry callback for generic errors", async () => {
  const olLayer = makeRuntimeOlLayer({ layerId: "layer-1" });
  const retry = jest.fn();

  mountLayersControl({
    olLayer,
    runtimeLayerState: {
      errorsByLayerId: {
        "layer-1": { message: "boom", kind: "error" },
      },
      retry,
      sessionNonce: "nonce",
      gridItemUuid: "grid",
    },
  });

  const retryBtn = await screen.findByLabelText("Retry Runtime Layer");
  fireEvent.click(retryBtn);
  expect(retry).toHaveBeenCalledWith("layer-1");
});

test("LayersControl hides Retry for plugin-unavailable errors", async () => {
  const olLayer = makeRuntimeOlLayer({ layerId: "layer-1" });

  mountLayersControl({
    olLayer,
    runtimeLayerState: {
      errorsByLayerId: {
        "layer-1": { message: "Plugin not available", kind: "unavailable" },
      },
      retry: jest.fn(),
      sessionNonce: "nonce",
      gridItemUuid: "grid",
    },
  });

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Plugin not available",
  );
  // kind="unavailable" → no Retry button (author must remove/replace).
  expect(
    screen.queryByLabelText("Retry Runtime Layer"),
  ).not.toBeInTheDocument();
});

test("LayersControl renders static (non-runtime) layers without progress or error UI", async () => {
  const staticLayer = {
    get: (key) => (key === "name" ? "Static Layer" : undefined),
    getVisible: () => true,
    setVisible: jest.fn(),
  };
  mountLayersControl({
    olLayer: staticLayer,
    runtimeLayerState: undefined,
    websocketValue: { getMessageForRequest: jest.fn() },
  });
  expect(await screen.findByText("Static Layer")).toBeInTheDocument();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

describe("parseProgress", () => {
  test("returns percentageComplete from valid message", () => {
    const message = JSON.stringify({
      percentageComplete: 75,
    });
    expect(parseProgress(message)).toBe(75);
  });

  test("returns null if percentageComplete is missing", () => {
    const message = JSON.stringify({
      message: "computing",
    });
    expect(parseProgress(message)).toBeNull();
  });

  test("returns null for invalid JSON", () => {
    const message = "not a json";
    expect(parseProgress(message)).toBeNull();
  });
});

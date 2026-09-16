import { render, screen, fireEvent } from "@testing-library/react";
import LayersControl from "components/map/LayersControl";
import { WebsocketContext } from "components/contexts/WebSocketContext";
import { makeMapDiv } from "__tests__/utilities/mapDiv";

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

test("LayersControl reports no loading state -- the map banner owns that", async () => {
  // This panel is collapsed by default, so a hairline bar inside it was the
  // least visible place to say a layer is working. Loading is reported by the
  // map's banner instead; the panel keeps only what is layer-specific and
  // actionable, which is the failure and its retry.
  const olLayer = makeRuntimeOlLayer({ layerId: "layer-1" });
  const getMessageForRequest = jest.fn(() =>
    JSON.stringify({ percentageComplete: 42 }),
  );

  mountLayersControl({
    olLayer,
    runtimeLayerState: { errorsByLayerId: {}, retry: jest.fn() },
    websocketValue: { getMessageForRequest },
    layerStatus: { "Runtime Layer": { state: "loading" } },
  });

  expect(
    await screen.findByLabelText("Runtime Layer Set Visible"),
  ).toBeInTheDocument();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
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
    },
    websocketValue: { getMessageForRequest },
  });

  // Error badge visible; nothing reports loading here any more.
  expect(await screen.findByRole("alert")).toHaveTextContent("boom");
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

test("LayersControl shows a failure message with no action on it", async () => {
  const olLayer = makeRuntimeOlLayer({ layerId: "layer-1" });

  mountLayersControl({
    olLayer,
    runtimeLayerState: {
      errorsByLayerId: {
        "layer-1": { message: "Plugin not available", kind: "unavailable" },
      },
    },
  });

  // The map's banner reports which layers failed and why; this repeats it
  // against the layer it belongs to. There is nothing to click -- a failed
  // layer is recovered by reloading, not from inside this panel.
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Plugin not available",
  );
  expect(
    screen.queryByRole("button", { name: /retry/i }),
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

describe("LayersControl height cap", () => {
  // The two floating controls are visually symmetric siblings on the same map,
  // so they must size by the same rule. jsdom does no layout; the declared
  // max-height is what is pinned here.
  beforeEach(() => {
    window.innerHeight = 2000;
  });
  const renderExpanded = async (mapDivRef) => {
    render(
      <LayersControl
        updater={null}
        visualizationRef={{ current: undefined }}
        mapDivRef={mapDivRef}
      />,
    );
    fireEvent.click(await screen.findByLabelText("Show Layers Control"));
    return screen.findByLabelText("Layers Control");
  };

  test("caps at three quarters of the map div, matching the legend", async () => {
    expect(await renderExpanded({ current: makeMapDiv(800) })).toHaveStyle({
      maxHeight: "600px",
    });
  });

  test("falls back to the viewport cap with no map div to measure", async () => {
    expect(await renderExpanded(undefined)).toHaveStyle({ maxHeight: "35vh" });
  });

  test("leaves the collapsed control uncapped at its fixed size", async () => {
    render(
      <LayersControl
        updater={null}
        visualizationRef={{ current: undefined }}
        mapDivRef={{ current: makeMapDiv(800) }}
      />,
    );
    expect(await screen.findByLabelText("Layers Control")).toHaveStyle({
      maxHeight: "none",
      height: "40px",
    });
  });
});

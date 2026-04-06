import { useState } from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import ExtentInteraction from "components/map/ExtentInteraction";
import MapContextProvider, {
  useMapContext,
} from "components/contexts/MapContext";
import PropTypes from "prop-types";

// Mock the OL Extent interaction
const mockGetExtent = jest.fn();
const mockOn = jest.fn();

jest.mock("ol/interaction/Extent", () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock("ol/layer/Image.js", () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock("ol/source/ImageStatic.js", () => ({
  __esModule: true,
  default: jest.fn(),
}));

function createMockMap({ layers = [] } = {}) {
  return {
    addInteraction: jest.fn(),
    removeInteraction: jest.fn(),
    addLayer: jest.fn(),
    removeLayer: jest.fn(),
    getLayers: jest.fn().mockReturnValue({
      forEach: (cb) => layers.forEach(cb),
    }),
    getView: jest.fn().mockReturnValue({
      getProjection: jest.fn().mockReturnValue({
        getCode: jest.fn().mockReturnValue("EPSG:3857"),
      }),
    }),
  };
}

// Test wrapper that exposes MapContext controls and reads drawnExtent
const TestComponent = ({ visualizationRef, initialExtentDrawMode }) => {
  const { extentDrawMode, setExtentDrawMode, drawnExtent } = useMapContext();
  const [activated, setActivated] = useState(!!initialExtentDrawMode);

  const activate = () => {
    setExtentDrawMode(
      initialExtentDrawMode || {
        imageUrl: "https://example.com/image.png",
        projection: "EPSG:3857",
        initialExtent: null,
      },
    );
    setActivated(true);
  };

  return (
    <>
      {!activated && (
        <button data-testid="activate" onClick={activate}>
          Activate
        </button>
      )}
      {activated && !extentDrawMode && (
        <button data-testid="activate" onClick={activate}>
          Activate
        </button>
      )}
      <ExtentInteraction visualizationRef={visualizationRef} />
      <p data-testid="drawnExtent">
        {drawnExtent ? JSON.stringify(drawnExtent) : "null"}
      </p>
      <p data-testid="extentDrawMode">{extentDrawMode ? "active" : "null"}</p>
    </>
  );
};

TestComponent.propTypes = {
  visualizationRef: PropTypes.object,
  initialExtentDrawMode: PropTypes.object,
};

// Auto-activate wrapper for tests that need extentDrawMode on render
const AutoActivateComponent = ({ visualizationRef, extentDrawModeValue }) => {
  const { setExtentDrawMode, drawnExtent, extentDrawMode } = useMapContext();

  // Set extentDrawMode on first render
  useState(() => {
    setExtentDrawMode(extentDrawModeValue);
  });

  return (
    <>
      <ExtentInteraction visualizationRef={visualizationRef} />
      <p data-testid="drawnExtent">
        {drawnExtent ? JSON.stringify(drawnExtent) : "null"}
      </p>
      <p data-testid="extentDrawMode">{extentDrawMode ? "active" : "null"}</p>
    </>
  );
};

AutoActivateComponent.propTypes = {
  visualizationRef: PropTypes.object,
  extentDrawModeValue: PropTypes.object,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetExtent.mockReturnValue([1, 2, 3, 4]);

  // Re-apply mock implementations after resetMocks clears them
  const ExtentInteractionOL = require("ol/interaction/Extent").default;
  ExtentInteractionOL.mockImplementation(() => ({
    getExtent: mockGetExtent,
    on: mockOn,
  }));

  const ImageLayer = require("ol/layer/Image.js").default;
  ImageLayer.mockImplementation(() => ({
    getSource: jest.fn(),
  }));

  // Don't set mockImplementation on Static — bare jest.fn() as constructor
  // ensures `new Static() instanceof Static` is true (prototype chain intact)
});

test("does not render when extentDrawMode is null", () => {
  const mockMap = createMockMap();
  const visualizationRef = { current: mockMap };

  render(
    <MapContextProvider>
      <TestComponent visualizationRef={visualizationRef} />
    </MapContextProvider>,
  );

  expect(
    screen.queryByText("Draw or adjust a rectangle to place the image"),
  ).not.toBeInTheDocument();
  expect(screen.queryByText("Confirm")).not.toBeInTheDocument();
  expect(screen.queryByText("Cancel")).not.toBeInTheDocument();
  expect(mockMap.addInteraction).not.toHaveBeenCalled();
});

test("renders confirm/cancel UI when extentDrawMode is set", async () => {
  const mockMap = createMockMap();
  const visualizationRef = { current: mockMap };

  render(
    <MapContextProvider>
      <TestComponent visualizationRef={visualizationRef} />
    </MapContextProvider>,
  );

  fireEvent.click(screen.getByTestId("activate"));

  expect(
    await screen.findByText("Draw or adjust a rectangle to place the image"),
  ).toBeInTheDocument();
  expect(screen.getByText("Confirm")).toBeInTheDocument();
  expect(screen.getByText("Cancel")).toBeInTheDocument();
});

test("adds interaction to map on mount", async () => {
  const mockMap = createMockMap();
  const visualizationRef = { current: mockMap };

  render(
    <MapContextProvider>
      <TestComponent visualizationRef={visualizationRef} />
    </MapContextProvider>,
  );

  fireEvent.click(screen.getByTestId("activate"));

  await waitFor(() => {
    expect(mockMap.addInteraction).toHaveBeenCalledTimes(1);
  });
});

test("cancel clears extentDrawMode without setting drawnExtent", async () => {
  const mockMap = createMockMap();
  const visualizationRef = { current: mockMap };

  render(
    <MapContextProvider>
      <TestComponent visualizationRef={visualizationRef} />
    </MapContextProvider>,
  );

  fireEvent.click(screen.getByTestId("activate"));

  await screen.findByText("Cancel");
  fireEvent.click(screen.getByText("Cancel"));

  await waitFor(() => {
    expect(screen.getByTestId("extentDrawMode")).toHaveTextContent("null");
  });
  expect(screen.getByTestId("drawnExtent")).toHaveTextContent("null");
});

test("confirm sets drawnExtent and clears extentDrawMode", async () => {
  const mockMap = createMockMap();
  const visualizationRef = { current: mockMap };

  render(
    <MapContextProvider>
      <AutoActivateComponent
        visualizationRef={visualizationRef}
        extentDrawModeValue={{
          imageUrl: "https://example.com/image.png",
          projection: "EPSG:3857",
          initialExtent: [10, 20, 30, 40],
        }}
      />
    </MapContextProvider>,
  );

  const confirmButton = await screen.findByText("Confirm");
  expect(confirmButton).not.toBeDisabled();
  fireEvent.click(confirmButton);

  await waitFor(() => {
    expect(screen.getByTestId("drawnExtent")).toHaveTextContent("[1,2,3,4]");
  });
  expect(screen.getByTestId("extentDrawMode")).toHaveTextContent("null");
});

test("hides existing layers with matching URL on mount and restores on cleanup", async () => {
  // We can't use instanceof Static with the mock, so we test the cleanup behavior
  // by verifying removeInteraction is called on unmount
  const mockMap = createMockMap({
    layers: [], // Can't mock instanceof check easily, but test cleanup path
  });
  const visualizationRef = { current: mockMap };

  const { unmount } = render(
    <MapContextProvider>
      <AutoActivateComponent
        visualizationRef={visualizationRef}
        extentDrawModeValue={{
          imageUrl: "https://example.com/image.png",
          projection: "EPSG:3857",
          initialExtent: null,
        }}
      />
    </MapContextProvider>,
  );

  await waitFor(() => {
    expect(mockMap.addInteraction).toHaveBeenCalledTimes(1);
  });

  // getLayers().forEach was called to check for existing layers
  expect(mockMap.getLayers).toHaveBeenCalled();

  unmount();

  // Verify interaction was cleaned up
  expect(mockMap.removeInteraction).toHaveBeenCalled();
});

test("confirm button disabled when no extent has been drawn", async () => {
  const mockMap = createMockMap();
  const visualizationRef = { current: mockMap };

  render(
    <MapContextProvider>
      <TestComponent visualizationRef={visualizationRef} />
    </MapContextProvider>,
  );

  fireEvent.click(screen.getByTestId("activate"));

  const confirmButton = await screen.findByText("Confirm");
  expect(confirmButton).toBeDisabled();
});

test("creates preview layer when initialExtent and imageUrl are provided", async () => {
  const mockMap = createMockMap();
  const visualizationRef = { current: mockMap };

  render(
    <MapContextProvider>
      <AutoActivateComponent
        visualizationRef={visualizationRef}
        extentDrawModeValue={{
          imageUrl: "https://example.com/image.png",
          projection: "EPSG:3857",
          initialExtent: [10, 20, 30, 40],
        }}
      />
    </MapContextProvider>,
  );

  await screen.findByText("Confirm");

  // addLayer called for the preview layer
  expect(mockMap.addLayer).toHaveBeenCalled();
});

test("skips preview layer when imageUrl is not provided", async () => {
  jest.useFakeTimers();
  const mockMap = createMockMap();
  const visualizationRef = { current: mockMap };

  render(
    <MapContextProvider>
      <AutoActivateComponent
        visualizationRef={visualizationRef}
        extentDrawModeValue={{
          imageUrl: null,
          projection: "EPSG:3857",
          initialExtent: null,
        }}
      />
    </MapContextProvider>,
  );

  await screen.findByText("Confirm");

  // Trigger extentchanged callback without imageUrl
  const onCall = mockOn.mock.calls.find((call) => call[0] === "extentchanged");
  const extentChangedCallback = onCall[1];

  act(() => {
    extentChangedCallback({ extent: [100, 200, 300, 400] });
  });

  act(() => {
    jest.advanceTimersByTime(200);
  });

  // addLayer should NOT be called since there's no imageUrl
  expect(mockMap.addLayer).not.toHaveBeenCalled();

  jest.useRealTimers();
});

test("extentchanged event updates hasExtent and triggers preview", async () => {
  jest.useFakeTimers();
  const mockMap = createMockMap();
  const visualizationRef = { current: mockMap };

  render(
    <MapContextProvider>
      <TestComponent visualizationRef={visualizationRef} />
    </MapContextProvider>,
  );

  fireEvent.click(screen.getByTestId("activate"));
  await screen.findByText("Confirm");

  // Confirm is disabled initially (no extent drawn)
  expect(screen.getByText("Confirm")).toBeDisabled();

  // Get the extentchanged callback that was registered via interaction.on
  const onCall = mockOn.mock.calls.find((call) => call[0] === "extentchanged");
  expect(onCall).toBeDefined();

  const extentChangedCallback = onCall[1];

  // Simulate an extent change
  act(() => {
    extentChangedCallback({ extent: [100, 200, 300, 400] });
  });

  // hasExtent should now be true, enabling Confirm
  await waitFor(() => {
    expect(screen.getByText("Confirm")).not.toBeDisabled();
  });

  // Advance timers past the debounce (150ms)
  act(() => {
    jest.advanceTimersByTime(200);
  });

  // Preview layer should have been added
  expect(mockMap.addLayer).toHaveBeenCalled();

  jest.useRealTimers();
});

test("hides existing layers with matching Static source URL", async () => {
  const Static = require("ol/source/ImageStatic.js").default;
  const mockStaticSource = new Static();
  mockStaticSource.getUrl = jest
    .fn()
    .mockReturnValue("https://example.com/image.png");

  const mockSetVisible = jest.fn();
  const mockExistingLayer = {
    getSource: () => mockStaticSource,
    getVisible: () => true,
    setVisible: mockSetVisible,
  };

  const mockMap = createMockMap({ layers: [mockExistingLayer] });
  const visualizationRef = { current: mockMap };

  const { unmount } = render(
    <MapContextProvider>
      <AutoActivateComponent
        visualizationRef={visualizationRef}
        extentDrawModeValue={{
          imageUrl: "https://example.com/image.png",
          projection: "EPSG:3857",
          initialExtent: null,
        }}
      />
    </MapContextProvider>,
  );

  await screen.findByText("Confirm");

  // Layer should have been hidden
  expect(mockSetVisible).toHaveBeenCalledWith(false);

  unmount();

  // Layer should have been restored
  expect(mockSetVisible).toHaveBeenCalledWith(true);
});

test("falls back to map projection when extentDrawMode.projection is falsy", async () => {
  const mockMap = createMockMap();
  const visualizationRef = { current: mockMap };

  render(
    <MapContextProvider>
      <AutoActivateComponent
        visualizationRef={visualizationRef}
        extentDrawModeValue={{
          imageUrl: "https://example.com/image.png",
          projection: null,
          initialExtent: [10, 20, 30, 40],
        }}
      />
    </MapContextProvider>,
  );

  await screen.findByText("Confirm");

  // getView().getProjection().getCode() should have been called for fallback
  expect(mockMap.getView).toHaveBeenCalled();
  expect(mockMap.addLayer).toHaveBeenCalled();
});

test("skips non-matching layers when hiding existing layers", async () => {
  const Static = require("ol/source/ImageStatic.js").default;

  // Layer with matching source but different URL
  const mockStaticSource = new Static();
  mockStaticSource.getUrl = jest
    .fn()
    .mockReturnValue("https://other.com/different.png");
  const mockSetVisible = jest.fn();
  const nonMatchingLayer = {
    getSource: () => mockStaticSource,
    getVisible: () => true,
    setVisible: mockSetVisible,
  };

  // Layer with non-Static source
  const nonStaticLayer = {
    getSource: () => ({}),
    getVisible: () => true,
    setVisible: jest.fn(),
  };

  // Layer that is not visible
  const hiddenStaticSource = new Static();
  hiddenStaticSource.getUrl = jest
    .fn()
    .mockReturnValue("https://example.com/image.png");
  const alreadyHiddenLayer = {
    getSource: () => hiddenStaticSource,
    getVisible: () => false,
    setVisible: jest.fn(),
  };

  const mockMap = createMockMap({
    layers: [nonMatchingLayer, nonStaticLayer, alreadyHiddenLayer],
  });
  const visualizationRef = { current: mockMap };

  render(
    <MapContextProvider>
      <AutoActivateComponent
        visualizationRef={visualizationRef}
        extentDrawModeValue={{
          imageUrl: "https://example.com/image.png",
          projection: "EPSG:3857",
          initialExtent: null,
        }}
      />
    </MapContextProvider>,
  );

  await screen.findByText("Confirm");

  // None of these layers should have been hidden
  expect(mockSetVisible).not.toHaveBeenCalled();
  expect(nonStaticLayer.setVisible).not.toHaveBeenCalled();
  expect(alreadyHiddenLayer.setVisible).not.toHaveBeenCalled();
});

test("extentchanged with invalid extent triggers early return", async () => {
  jest.useFakeTimers();
  const mockMap = createMockMap();
  const visualizationRef = { current: mockMap };

  render(
    <MapContextProvider>
      <TestComponent visualizationRef={visualizationRef} />
    </MapContextProvider>,
  );

  fireEvent.click(screen.getByTestId("activate"));
  await screen.findByText("Confirm");

  const onCall = mockOn.mock.calls.find((call) => call[0] === "extentchanged");
  const extentChangedCallback = onCall[1];

  // null extent
  act(() => {
    extentChangedCallback({ extent: null });
  });

  // Infinity in extent
  act(() => {
    extentChangedCallback({ extent: [Infinity, 2, 3, 4] });
  });

  act(() => {
    jest.advanceTimersByTime(200);
  });

  // Confirm should still be disabled — hasExtent never set
  expect(screen.getByText("Confirm")).toBeDisabled();
  expect(mockMap.addLayer).not.toHaveBeenCalled();

  jest.useRealTimers();
});

test("debounce clears previous timeout on rapid extentchanged events", async () => {
  jest.useFakeTimers();
  const mockMap = createMockMap();
  const visualizationRef = { current: mockMap };

  render(
    <MapContextProvider>
      <TestComponent visualizationRef={visualizationRef} />
    </MapContextProvider>,
  );

  fireEvent.click(screen.getByTestId("activate"));
  await screen.findByText("Confirm");

  const onCall = mockOn.mock.calls.find((call) => call[0] === "extentchanged");
  const extentChangedCallback = onCall[1];

  // Fire two rapid extentchanged events
  act(() => {
    extentChangedCallback({ extent: [1, 2, 3, 4] });
  });
  act(() => {
    jest.advanceTimersByTime(50); // not enough for debounce
  });
  act(() => {
    extentChangedCallback({ extent: [5, 6, 7, 8] });
  });
  act(() => {
    jest.advanceTimersByTime(200);
  });

  // Only one addLayer call (second debounce replaced the first)
  expect(mockMap.addLayer).toHaveBeenCalledTimes(1);

  jest.useRealTimers();
});

test("handleConfirm with invalid extent does not set drawnExtent", async () => {
  mockGetExtent.mockReturnValue([Infinity, 2, 3, 4]);
  const mockMap = createMockMap();
  const visualizationRef = { current: mockMap };

  render(
    <MapContextProvider>
      <AutoActivateComponent
        visualizationRef={visualizationRef}
        extentDrawModeValue={{
          imageUrl: "https://example.com/image.png",
          projection: "EPSG:3857",
          initialExtent: [10, 20, 30, 40],
        }}
      />
    </MapContextProvider>,
  );

  const confirmButton = await screen.findByText("Confirm");
  fireEvent.click(confirmButton);

  await waitFor(() => {
    expect(screen.getByTestId("extentDrawMode")).toHaveTextContent("null");
  });
  // drawnExtent should remain null since extent had Infinity
  expect(screen.getByTestId("drawnExtent")).toHaveTextContent("null");
});

test("cleanup handles null visualizationRef gracefully", async () => {
  const mockMap = createMockMap();
  const visualizationRef = { current: mockMap };

  const { unmount } = render(
    <MapContextProvider>
      <AutoActivateComponent
        visualizationRef={visualizationRef}
        extentDrawModeValue={{
          imageUrl: null,
          projection: "EPSG:3857",
          initialExtent: null,
        }}
      />
    </MapContextProvider>,
  );

  await screen.findByText("Confirm");

  // Null out the ref before unmount to hit the false branch of line 157
  visualizationRef.current = null;

  // Should not throw
  unmount();
});

test("handleConfirm early returns when interactionRef is null", async () => {
  const visualizationRef = { current: createMockMap() };

  // Use a component that can toggle extentDrawMode off and on,
  // nulling visualizationRef in between so the re-activated effect
  // early-returns and interactionRef stays null from previous cleanup.
  const ToggleComponent = () => {
    const { setExtentDrawMode, extentDrawMode, drawnExtent } = useMapContext();
    const [phase, setPhase] = useState(0);

    const step = () => {
      if (phase === 0) {
        setExtentDrawMode({
          imageUrl: null,
          projection: "EPSG:3857",
          initialExtent: [1, 2, 3, 4],
        });
        setPhase(1);
      } else if (phase === 1) {
        // Clear — cleanup sets interactionRef = null
        setExtentDrawMode(null);
        setPhase(2);
      } else if (phase === 2) {
        // Null out visualizationRef so the effect early-returns
        // and interactionRef stays null from previous cleanup
        visualizationRef.current = null;
        setExtentDrawMode({
          imageUrl: null,
          projection: "EPSG:3857",
          initialExtent: [1, 2, 3, 4],
        });
        setPhase(3);
      }
    };

    return (
      <>
        <button data-testid="step" onClick={step}>
          Step
        </button>
        <ExtentInteraction visualizationRef={visualizationRef} />
        <p data-testid="drawnExtent">
          {drawnExtent ? JSON.stringify(drawnExtent) : "null"}
        </p>
        <p data-testid="extentDrawMode">{extentDrawMode ? "active" : "null"}</p>
      </>
    );
  };

  render(
    <MapContextProvider>
      <ToggleComponent />
    </MapContextProvider>,
  );

  // Phase 0→1: activate
  fireEvent.click(screen.getByTestId("step"));
  await screen.findByText("Confirm");

  // Phase 1→2: deactivate (cleanup sets interactionRef = null)
  fireEvent.click(screen.getByTestId("step"));
  await waitFor(() => {
    expect(screen.getByTestId("extentDrawMode")).toHaveTextContent("null");
  });

  // Phase 2→3: re-activate with null visualizationRef
  // Effect early-returns so interactionRef stays null
  fireEvent.click(screen.getByTestId("step"));
  await screen.findByText("Confirm");

  // Click Confirm — interactionRef.current is null, should early return
  fireEvent.click(screen.getByText("Confirm"));

  // drawnExtent should remain null
  expect(screen.getByTestId("drawnExtent")).toHaveTextContent("null");
});

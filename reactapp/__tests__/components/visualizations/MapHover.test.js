// MapVisualization: hover queries and the order click and hover results are
// shown in.
import {
  mockedQueryLayerFeatures,
  TestingComponent,
  renderSyncMap,
  syncLayer,
} from "__tests__/utilities/mapVisualizationHarness";
import { useRef } from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import createLoadedComponent from "__tests__/utilities/customRender";
import { Map } from "ol";
import VariableInput from "components/visualizations/VariableInput";
import Overlay from "ol/Overlay";
import {
  mockedTextVariable,
  userDashboard,
} from "__tests__/utilities/constants";
import MapContextProvider, {
  useMapContext,
} from "components/contexts/MapContext";
import MapVisualization from "components/visualizations/Map";
import { clearClientSourceCaches } from "components/map/ModuleLoader";

// The GeoParquet/Zarr read caches are module-scoped and live for the page's
// lifetime by design, so each test must start from an empty one.
beforeEach(() => {
  clearClientSourceCaches();
});

test("Hovering a hover+modal layer opens the table but not the modal", async () => {
  // The modal is click-only. Streamflow is both `tablePopupType: "hover"` and
  // `mode: "modal"`, so without the popupSource gate the derived open-state
  // would pop the modal on hover.
  const hoverModal = syncLayer("HoverModal");
  hoverModal.configuration.props.name = "HoverModal";
  hoverModal.tablePopupType = "hover";

  mockedQueryLayerFeatures.mockResolvedValue([
    {
      attributes: { station_id: "HHH" },
      geometry: { x: 90, y: 90 },
      layerName: "HoverModal",
    },
  ]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");

  const HoverHarness = () => {
    const visualizationRef = useRef();
    const { mapReady } = useMapContext();
    return (
      <div>
        <MapVisualization
          mapConfig={{}}
          viewConfig={{}}
          layers={[hoverModal]}
          baseMap={null}
          layerControl={false}
          visualizationRef={visualizationRef}
        />
        {mapReady && <p>Map Ready</p>}
        <button
          type="button"
          onClick={() =>
            visualizationRef.current?.dispatchEvent({
              type: "pointermove",
              coordinate: [10, 20],
            })
          }
        >
          hover-feature
        </button>
      </div>
    );
  };

  render(
    createLoadedComponent({
      children: (
        <MapContextProvider>
          <HoverHarness />
        </MapContextProvider>
      ),
    }),
  );
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  fireEvent.click(screen.getByText("hover-feature"));

  // The table popup opens at the cursor...
  await waitFor(() => {
    expect(popSetPosition).toHaveBeenCalledWith([10, 20]);
  });
  // ...and the modal stays shut even though this layer configures one.
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("A hover+modal layer joins the union, hiding the overlay while it is active", async () => {
  // Streamflow's shape: mode "modal" with tablePopupType "hover", so on click
  // it belongs to the modal but never to the table. It still takes a place in
  // the shared list so it stays reachable; the overlay hides while it is the
  // selected feature.
  const hoverModal = syncLayer("HoverModal");
  hoverModal.configuration.props.name = "HoverModal";
  hoverModal.tablePopupType = "hover";

  mockedQueryLayerFeatures.mockImplementation((layer) =>
    Promise.resolve([
      layer.configuration.props.name === "HoverModal"
        ? {
            attributes: { station_id: "HHH" },
            geometry: { x: 90, y: 90 },
            layerName: "HoverModal",
          }
        : {
            attributes: { station_id: "AAA" },
            geometry: { x: 10, y: 10 },
            layerName: "Both",
          },
    ]),
  );
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");

  renderSyncMap([syncLayer(), hoverModal]);
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  await waitFor(() => {
    expect(popSetPosition).toHaveBeenLastCalledWith([10, 10]);
  });
  // Both features are in the union even though only one is table-eligible.
  expect(
    await screen.findByTestId("popup-modal-carousel-pagination"),
  ).toHaveTextContent("1 / 2");

  fireEvent.click(screen.getByTestId("popup-modal-carousel-next"));

  // Its modal shows; the table overlay hides because it has no table popup.
  await waitFor(() => {
    expect(popSetPosition).toHaveBeenLastCalledWith(undefined);
  });
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(
    screen.getByTestId("popup-modal-carousel-pagination"),
  ).toHaveTextContent("2 / 2");
});

test("Map hover — pointermove queries only hover-tagged layers and positions the overlay", async () => {
  // The hover handler subscribes to OL's pointermove event. It must query
  // only layers with tablePopupType === "hover" and open the table overlay
  // at the cursor; it must never open the modal.
  mockedQueryLayerFeatures.mockResolvedValue([
    {
      attributes: { field1: "value" },
      geometry: { x: 0, y: 0 },
      layerName: "HoverLayer",
    },
  ]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");

  const layers = [
    {
      tablePopupType: "hover",
      configuration: {
        type: "ImageLayer",
        props: {
          name: "HoverLayer",
          source: {
            type: "ESRI Image and Map Service",
            props: { url: "hover_url" },
          },
        },
      },
    },
    {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "ClickLayer",
          source: {
            type: "ESRI Image and Map Service",
            props: { url: "click_url" },
          },
        },
      },
    },
  ];
  const clickCoordinates = [10, 20];
  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          onMapPointerMove={true}
          clickCoordinates={clickCoordinates}
          mapProps={{
            mapConfig: {},
            viewConfig: {},
            layers,
            baseMap: null,
            layerControl: false,
          }}
        />
      </MapContextProvider>
    ),
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  // Only the hover-tagged layer is queried by the hover handler.
  await waitFor(() => {
    expect(mockedQueryLayerFeatures.mock.calls.length).toBe(1);
  });
  expect(
    mockedQueryLayerFeatures.mock.calls[0][0].configuration.props.name,
  ).toBe("HoverLayer");

  // The overlay positions itself at the cursor coordinate.
  await waitFor(() => {
    expect(popSetPosition).toHaveBeenCalledWith(clickCoordinates);
  });

  // No modal opens from a hover event.
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("Map hover attribute variables update text variable input", async () => {
  // Hover-opened popups should drive variable inputs the same way click
  // does — enables hover-driven dashboards where other widgets follow
  // the hovered feature. The hover query is debounced (~1 write per
  // cursor pause), so downstream re-fetches are bounded.
  mockedQueryLayerFeatures.mockResolvedValue([
    {
      attributes: { field1: "hover value" },
      geometry: { x: 10, y: 10 },
      layerName: "Hover Layer",
    },
  ]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const handleChange = jest.fn();
  const dashboard = JSON.parse(JSON.stringify(userDashboard));
  dashboard.tabs[0].gridItems = [mockedTextVariable];
  const varInputArgs = JSON.parse(mockedTextVariable.args_string);

  const layers = [
    {
      tablePopupType: "hover",
      configuration: {
        type: "ImageLayer",
        props: {
          name: "Hover Layer",
          source: {
            type: "ESRI Image and Map Service",
            props: { url: "hover_url" },
          },
        },
      },
      attributeVariables: { "Hover Layer": { field1: "Test Variable" } },
    },
  ];
  const hoverCoordinates = [10, 20];
  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          onMapPointerMove={true}
          clickCoordinates={hoverCoordinates}
          mapProps={{
            mapConfig: {},
            viewConfig: {},
            layers,
            baseMap: null,
            layerControl: false,
          }}
        />
        <VariableInput
          variable_name={varInputArgs.variable_name}
          initial_value={varInputArgs.initial_value}
          variable_options_source={varInputArgs.variable_options_source}
          onChange={handleChange}
        />
      </MapContextProvider>
    ),
    options: { dashboards: { dashboards: [dashboard] } },
  });
  render(LoadedComponent);

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({ "Test Variable": "" }),
  );
  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  // After the hover debounce settles and the query resolves, the variable
  // input should hold the hovered feature's field1 value.
  await waitFor(async () => {
    expect(await screen.findByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({
        "Test Variable": "hover value",
      }),
    );
  });
});

test("Map hover honors per-layer attribute aliases and omitted fields", async () => {
  // Covers the alias-merge and omitted-attribute-merge reducer bodies in
  // runHoverQuery (the `Object.assign(combined, current.attributeAliases)`
  // and `Object.assign(combined, current.omittedPopupAttributes)` lines).
  // Both refs are read by the rendered Popup, so the only way the aliased
  // header text appears and the omitted field disappears is if both
  // reducers executed against the hover-eligible layer set.
  mockedQueryLayerFeatures.mockResolvedValue([
    {
      attributes: {
        gauge_id: "FTDC1",
        stage: "12.3",
        secret: "hidden",
      },
      geometry: { x: 0, y: 0 },
      layerName: "Hover Layer",
    },
  ]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);

  const layers = [
    {
      tablePopupType: "hover",
      attributeAliases: {
        "Hover Layer": { gauge_id: "Gauge", stage: "Stage Ft" },
      },
      omittedPopupAttributes: { "Hover Layer": ["secret"] },
      configuration: {
        type: "ImageLayer",
        props: {
          name: "Hover Layer",
          source: {
            type: "ESRI Image and Map Service",
            props: { url: "hover_url" },
          },
        },
      },
    },
  ];
  const hoverCoordinates = [10, 20];
  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          onMapPointerMove={true}
          clickCoordinates={hoverCoordinates}
          mapProps={{
            mapConfig: {},
            viewConfig: {},
            layers,
            baseMap: null,
            layerControl: false,
          }}
        />
      </MapContextProvider>
    ),
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  // Aliased headers from the alias reducer.
  expect(await screen.findByText("Gauge")).toBeInTheDocument();
  expect(await screen.findByText("Stage Ft")).toBeInTheDocument();
  // Original (unaliased) field names must not appear once the alias is in
  // place — this proves the reducer body executed (otherwise the popup
  // would render the raw "gauge_id" / "stage" headers).
  expect(screen.queryByText("gauge_id")).not.toBeInTheDocument();
  expect(screen.queryByText("stage")).not.toBeInTheDocument();
  // Omitted attribute from the omitted reducer.
  expect(screen.queryByText("secret")).not.toBeInTheDocument();
  expect(screen.queryByText("hidden")).not.toBeInTheDocument();
});

test("Map hover closes the popup when a later hover lands on empty space", async () => {
  // Covers the close-on-empty branch in runHoverQuery: when a hover popup
  // is already open (hoverActiveRef.current === true) and a subsequent
  // hover settles on a location with no features, setPopupContent(null)
  // + setPosition(undefined) fires and hoverActiveRef is reset.
  let callCount = 0;
  mockedQueryLayerFeatures.mockImplementation(async () => {
    callCount++;
    if (callCount === 1) {
      return [
        {
          attributes: { f: "v" },
          geometry: { x: 0, y: 0 },
          layerName: "Hover Layer",
        },
      ];
    }
    return [];
  });
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");

  const layers = [
    {
      tablePopupType: "hover",
      configuration: {
        type: "ImageLayer",
        props: {
          name: "Hover Layer",
          source: {
            type: "ESRI Image and Map Service",
            props: { url: "hover_url" },
          },
        },
      },
    },
  ];
  const featureCoords = [10, 20];
  const emptyCoords = [200, 300];

  // Manual harness — need two pointermove dispatches at different
  // coordinates with the popup-open state observed in between.
  const TwoMoveHarness = () => {
    const visualizationRef = useRef();
    const { mapReady } = useMapContext();
    return (
      <div>
        <MapVisualization
          visualizationRef={visualizationRef}
          mapConfig={{}}
          viewConfig={{}}
          layers={layers}
          baseMap={null}
          layerControl={false}
        />
        <p>{mapReady ? "Map Ready" : "Map Not Ready"}</p>
        <button
          type="button"
          onClick={() =>
            visualizationRef.current?.dispatchEvent({
              type: "pointermove",
              coordinate: featureCoords,
            })
          }
        >
          hover-feature
        </button>
        <button
          type="button"
          onClick={() =>
            visualizationRef.current?.dispatchEvent({
              type: "pointermove",
              coordinate: emptyCoords,
            })
          }
        >
          hover-empty
        </button>
      </div>
    );
  };

  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TwoMoveHarness />
      </MapContextProvider>
    ),
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  // Step 1: hover on the feature → popup opens at featureCoords.
  fireEvent.click(screen.getByText("hover-feature"));
  await waitFor(() => {
    expect(popSetPosition).toHaveBeenCalledWith(featureCoords);
  });
  expect(callCount).toBe(1);

  // Step 2: hover on empty space → the hover handler runs again, query
  // returns nothing, and the close-on-empty branch hides the overlay.
  fireEvent.click(screen.getByText("hover-empty"));
  await waitFor(() => {
    expect(popSetPosition).toHaveBeenLastCalledWith(undefined);
  });
  expect(callCount).toBe(2);
});

test("Map hover ignores pointermove when the cursor is over the popup itself", async () => {
  // Covers the cursor-over-popup guard in onMapHover: when
  // evt.originalEvent.target is inside popupContainerRef.current, the
  // handler returns immediately AND clears any pending debounce. Without
  // the guard, the cursor sitting on the popup would query the empty map
  // coordinate UNDER the popup and dismiss it via close-on-empty.
  mockedQueryLayerFeatures.mockResolvedValue([
    {
      attributes: { f: "v" },
      geometry: { x: 0, y: 0 },
      layerName: "Hover Layer",
    },
  ]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);

  const layers = [
    {
      tablePopupType: "hover",
      configuration: {
        type: "ImageLayer",
        props: {
          name: "Hover Layer",
          source: {
            type: "ESRI Image and Map Service",
            props: { url: "hover_url" },
          },
        },
      },
    },
  ];
  const featureCoords = [10, 20];

  const HoverOverPopupHarness = () => {
    const visualizationRef = useRef();
    const { mapReady } = useMapContext();
    return (
      <div>
        <MapVisualization
          visualizationRef={visualizationRef}
          mapConfig={{}}
          viewConfig={{}}
          layers={layers}
          baseMap={null}
          layerControl={false}
        />
        <p>{mapReady ? "Map Ready" : "Map Not Ready"}</p>
        <button
          type="button"
          onClick={() =>
            visualizationRef.current?.dispatchEvent({
              type: "pointermove",
              coordinate: featureCoords,
            })
          }
        >
          hover-feature
        </button>
        <button
          type="button"
          onClick={() => {
            // Dispatch a pointermove whose originalEvent.target lives
            // inside the popup container. The handler must short-circuit.
            const popupContent = screen.getByLabelText("Map Popup Content");
            visualizationRef.current?.dispatchEvent({
              type: "pointermove",
              coordinate: [500, 500],
              originalEvent: { target: popupContent },
            });
          }}
        >
          hover-over-popup
        </button>
      </div>
    );
  };

  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <HoverOverPopupHarness />
      </MapContextProvider>
    ),
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  // Step 1: open the hover popup over the feature.
  fireEvent.click(screen.getByText("hover-feature"));
  await waitFor(() => {
    expect(mockedQueryLayerFeatures).toHaveBeenCalledTimes(1);
  });
  // Confirm the popup body is actually present in the DOM before we use
  // it as the originalEvent.target.
  await screen.findByLabelText("Map Popup Content");

  // Step 2: pointermove with originalEvent.target inside the popup. The
  // guard returns early — no second query should be scheduled.
  fireEvent.click(screen.getByText("hover-over-popup"));

  // Wait past the debounce window. If the guard didn't work, a second
  // query would fire here.
  await new Promise((resolve) => setTimeout(resolve, 400));
  await waitFor(() =>
    expect(mockedQueryLayerFeatures).toHaveBeenCalledTimes(1),
  );
});

test("Map hover cursor-over-popup also cancels a pending debounce", async () => {
  // Covers the inner `clearTimeout(hoverDebounceRef.current)` of the
  // cursor-over-popup guard. The earlier "ignores pointermove" test lets
  // the debounce settle (popup opens) before firing the over-popup event,
  // so by then the timer is already cleared. This test fires both events
  // synchronously: the first starts a debounce; the second lands on the
  // popup before that debounce expires, so the guard must clear the
  // pending timer to suppress the query entirely.
  mockedQueryLayerFeatures.mockResolvedValue([
    {
      attributes: { f: "v" },
      geometry: { x: 0, y: 0 },
      layerName: "Hover Layer",
    },
  ]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);

  const layers = [
    {
      tablePopupType: "hover",
      configuration: {
        type: "ImageLayer",
        props: {
          name: "Hover Layer",
          source: {
            type: "ESRI Image and Map Service",
            props: { url: "hover_url" },
          },
        },
      },
    },
  ];
  const featureCoords = [10, 20];

  const PendingDebounceHarness = () => {
    const visualizationRef = useRef();
    const { mapReady } = useMapContext();
    return (
      <div>
        <MapVisualization
          visualizationRef={visualizationRef}
          mapConfig={{}}
          viewConfig={{}}
          layers={layers}
          baseMap={null}
          layerControl={false}
        />
        <p>{mapReady ? "Map Ready" : "Map Not Ready"}</p>
        <button
          type="button"
          onClick={() => {
            // Fire both events inside the same tick. The "Map Popup
            // Content" element exists in the DOM from the popupContent
            // useEffect's first render (with "No Attributes Found" as
            // the body), so we can target it before any hover has opened
            // a real popup.
            visualizationRef.current?.dispatchEvent({
              type: "pointermove",
              coordinate: featureCoords,
            });
            const popupContent = screen.getByLabelText("Map Popup Content");
            visualizationRef.current?.dispatchEvent({
              type: "pointermove",
              coordinate: [500, 500],
              originalEvent: { target: popupContent },
            });
          }}
        >
          fire-both
        </button>
      </div>
    );
  };

  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <PendingDebounceHarness />
      </MapContextProvider>
    ),
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  // Pre-condition: the popup container is in the DOM even before any
  // hover has fired (initial useEffect renders "No Attributes Found").
  await screen.findByLabelText("Map Popup Content");

  fireEvent.click(screen.getByText("fire-both"));

  // Wait past the debounce window. If the second event's guard had not
  // cleared the first event's debounce, the query would have fired.
  await new Promise((resolve) => setTimeout(resolve, 400));
  expect(mockedQueryLayerFeatures).not.toHaveBeenCalled();
});

test("Map hover swipe updates variable inputs but never touches the highlight layer", async () => {
  // Covers the hover-side branch of onSwipe:
  //   - L503: with valid popupContent the selectedFeature bail is skipped
  //   - L509 (false branch): hoverActiveRef.current === true, so the
  //     highlight gate is skipped (the highlight layer doesn't exist for
  //     hover-opened popups). updateVariableInputsForFeature still runs.
  // The existing click swipe test covers the true branch of L509.
  // Positioned so "first" really is the nearest to the hover coordinate
  // ([10, 20]) and therefore lands in slot 0 under proximity ranking. This
  // test is about swipe mechanics, not ordering, so the fixture is placed to
  // keep the names matching the slots rather than to assert a rank.
  mockedQueryLayerFeatures.mockResolvedValue([
    {
      attributes: { field1: "first" },
      geometry: { x: 10, y: 20 },
      layerName: "Hover Layer",
    },
    {
      attributes: { field1: "second" },
      geometry: { x: 100, y: 200 },
      layerName: "Hover Layer",
    },
  ]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  // Spy on the highlight-layer source clear to prove it stays untouched
  // on hover swipe. addHighlightFeatures uses the same source.
  const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");
  const dashboard = JSON.parse(JSON.stringify(userDashboard));
  dashboard.tabs[0].gridItems = [mockedTextVariable];
  const varInputArgs = JSON.parse(mockedTextVariable.args_string);

  const layers = [
    {
      tablePopupType: "hover",
      attributeVariables: { "Hover Layer": { field1: "Test Variable" } },
      configuration: {
        type: "ImageLayer",
        props: {
          name: "Hover Layer",
          source: {
            type: "ESRI Image and Map Service",
            props: { url: "hover_url" },
          },
        },
      },
    },
  ];
  const hoverCoords = [10, 20];
  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          onMapPointerMove={true}
          clickCoordinates={hoverCoords}
          mapProps={{
            mapConfig: {},
            viewConfig: {},
            layers,
            baseMap: null,
            layerControl: false,
          }}
        />
        <VariableInput
          variable_name={varInputArgs.variable_name}
          initial_value={varInputArgs.initial_value}
          variable_options_source={varInputArgs.variable_options_source}
          onChange={jest.fn()}
        />
      </MapContextProvider>
    ),
    options: { dashboards: { dashboards: [dashboard] } },
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  // After the hover debounce settles, the variable input reflects the
  // first feature and the popup has both features in its swiper.
  await waitFor(async () => {
    expect(await screen.findByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({ "Test Variable": "first" }),
    );
  });

  // Snapshot how many layers had been added BEFORE the swipe. The hover
  // handler must not create a highlight layer in response to a swipe.
  const addLayerCallsBeforeSwipe = addLayerSpy.mock.calls.length;

  // Click "Next Swiper" — fires the internal onSwipe with activeIndex=1.
  // L509 false branch: hoverActiveRef is true, highlight ops skipped.
  // updateVariableInputsForFeature still runs and writes "second".
  const nextSwiper = screen.getByLabelText("Next Swiper");
  fireEvent.click(nextSwiper);

  await waitFor(async () => {
    expect(await screen.findByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({ "Test Variable": "second" }),
    );
  });

  // No highlight layer was lazily added during the swipe. The click
  // handler is what creates it, and click was never dispatched here.
  expect(addLayerSpy.mock.calls.length).toBe(addLayerCallsBeforeSwipe);
});

test("Map hover layer with no config name is still queried (filter falls back to true)", async () => {
  // Covers the L797 fallback "return true" branch in runHoverQuery's
  // layer filter: when item.configuration.props.name is missing (or the
  // OL layer with that name hasn't been added to the map yet), the
  // filter defaults to queryable=true as a safe fallback.
  mockedQueryLayerFeatures.mockResolvedValue([
    {
      attributes: { field1: "anon" },
      geometry: { x: 0, y: 0 },
      layerName: "Anon Layer",
    },
  ]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");

  const layers = [
    {
      tablePopupType: "hover",
      configuration: {
        type: "ImageLayer",
        // props.name intentionally absent so the filter hits the
        // !name short-circuit on L798.
        props: {
          source: {
            type: "ESRI Image and Map Service",
            props: { url: "hover_url" },
          },
        },
      },
    },
  ];
  const hoverCoords = [10, 20];
  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          onMapPointerMove={true}
          clickCoordinates={hoverCoords}
          mapProps={{
            mapConfig: {},
            viewConfig: {},
            layers,
            baseMap: null,
            layerControl: false,
          }}
        />
      </MapContextProvider>
    ),
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  // The unnamed hover layer is still queried — the filter defaults to
  // "include" when it can't determine visibility.
  await waitFor(() => {
    expect(mockedQueryLayerFeatures).toHaveBeenCalledTimes(1);
  });
  await waitFor(() => {
    expect(popSetPosition).toHaveBeenCalledWith(hoverCoords);
  });
});

test("Map hover swallows queryLayerFeatures rejections without crashing", async () => {
  // Covers the catch (error) block at the bottom of runHoverQuery's
  // queryCalls map. A rejected query must not crash the handler — it
  // contributes nothing to the results and the popup stays empty.
  mockedQueryLayerFeatures.mockRejectedValue(new Error("network unreachable"));
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");

  const layers = [
    {
      tablePopupType: "hover",
      configuration: {
        type: "ImageLayer",
        props: {
          name: "Hover Layer",
          source: {
            type: "ESRI Image and Map Service",
            props: { url: "hover_url" },
          },
        },
      },
    },
  ];
  const hoverCoords = [10, 20];
  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          onMapPointerMove={true}
          clickCoordinates={hoverCoords}
          mapProps={{
            mapConfig: {},
            viewConfig: {},
            layers,
            baseMap: null,
            layerControl: false,
          }}
        />
      </MapContextProvider>
    ),
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  // The query was attempted (and rejected) but the catch swallowed it.
  await waitFor(() => {
    expect(mockedQueryLayerFeatures).toHaveBeenCalledTimes(1);
  });

  // Wait past the debounce window. The popup must not be opened — all
  // results were empty arrays returned by the catch, so nonEmpty is [].
  await new Promise((resolve) => setTimeout(resolve, 300));
  const positionCalls = popSetPosition.mock.calls.map(([arg]) => arg);
  expect(positionCalls).not.toContainEqual(hoverCoords);
});

test("Map hover after click — forEach iterates the unnamed marker and skips it", async () => {
  // Covers the L789 false branch: `if (name)` skips OL layers whose
  // get("name") returns undefined. The click handler adds a marker
  // layer and (lazily) a highlight layer; neither has a name. Triggering
  // hover AFTER a click puts those unnamed layers in the forEach path.
  mockedQueryLayerFeatures.mockImplementation(async (layer) => {
    if (layer.configuration.props.name === "ClickLayer") {
      return [
        {
          attributes: { field1: "click-value" },
          geometry: { x: 0, y: 0 },
          layerName: "ClickLayer",
        },
      ];
    }
    return [
      {
        attributes: { field1: "hover-value" },
        geometry: { x: 0, y: 0 },
        layerName: "HoverLayer",
      },
    ];
  });
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);

  const layers = [
    {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "ClickLayer",
          source: {
            type: "ESRI Image and Map Service",
            props: { url: "click_url" },
          },
        },
      },
    },
    {
      tablePopupType: "hover",
      configuration: {
        type: "ImageLayer",
        props: {
          name: "HoverLayer",
          source: {
            type: "ESRI Image and Map Service",
            props: { url: "hover_url" },
          },
        },
      },
    },
  ];

  const ClickThenHoverHarness = () => {
    const visualizationRef = useRef();
    const { mapReady } = useMapContext();
    return (
      <div>
        <MapVisualization
          visualizationRef={visualizationRef}
          mapConfig={{}}
          viewConfig={{}}
          layers={layers}
          baseMap={null}
          layerControl={false}
        />
        <p>{mapReady ? "Map Ready" : "Map Not Ready"}</p>
        <button
          type="button"
          onClick={() =>
            visualizationRef.current?.dispatchEvent({
              type: "singleclick",
              coordinate: [10, 20],
            })
          }
        >
          fire-click
        </button>
        <button
          type="button"
          onClick={() =>
            visualizationRef.current?.dispatchEvent({
              type: "pointermove",
              coordinate: [30, 40],
            })
          }
        >
          fire-hover
        </button>
      </div>
    );
  };

  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <ClickThenHoverHarness />
      </MapContextProvider>
    ),
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  // Step 1: click. The click handler adds an unnamed marker layer (and
  // lazily a highlight layer) to the map. After this, map.getLayers()
  // includes those unnamed OL layers.
  fireEvent.click(screen.getByText("fire-click"));
  await waitFor(() => {
    const callsForClickLayer = mockedQueryLayerFeatures.mock.calls.filter(
      ([layer]) => layer.configuration.props.name === "ClickLayer",
    );
    expect(callsForClickLayer.length).toBeGreaterThanOrEqual(1);
  });

  // Step 2: hover. runHoverQuery's forEach iterates ALL OL layers,
  // including the unnamed marker. The `if (name)` check skips them.
  fireEvent.click(screen.getByText("fire-hover"));
  await waitFor(() => {
    const callsForHoverLayer = mockedQueryLayerFeatures.mock.calls.filter(
      ([layer]) => layer.configuration.props.name === "HoverLayer",
    );
    expect(callsForHoverLayer.length).toBeGreaterThanOrEqual(1);
  });
  // The hover handler must not have crashed on the unnamed layers — if
  // L789 were `olLayerVisibility.set(undefined, ...)` instead of guarded,
  // the filter on L798 would then incorrectly look up undefined and the
  // HoverLayer query would not have fired.
});

test("Map hover skips a hidden layer (visibility map returns false)", async () => {
  // Covers the L800 false branch in runHoverQuery's filter:
  //   return olLayerVisibility.get(name) === true;
  // When the user hides a hover layer via the layer control,
  // olLayer.getVisible() returns false. The filter must drop the layer
  // from hoverLayers so no query fires. Same shape as the existing
  // "Map click skips layers the user has hidden" test.
  mockedQueryLayerFeatures.mockResolvedValue([
    {
      attributes: { f: "v" },
      geometry: { x: 0, y: 0 },
      layerName: "HoverHidden",
    },
  ]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");

  const layers = [
    {
      tablePopupType: "hover",
      configuration: {
        type: "ImageLayer",
        layerVisibility: false,
        props: {
          name: "HoverHidden",
          source: {
            type: "ESRI Image and Map Service",
            props: { url: "hidden_url" },
          },
        },
      },
    },
    {
      tablePopupType: "hover",
      configuration: {
        type: "ImageLayer",
        props: {
          name: "HoverVisible",
          source: {
            type: "ESRI Image and Map Service",
            props: { url: "visible_url" },
          },
        },
      },
    },
  ];

  // Like the existing hidden-click test, we need to wait for both OL
  // layers to be mounted before firing the pointermove, otherwise the
  // visibility map could be empty when the filter runs.
  const HiddenHoverHarness = () => {
    const visualizationRef = useRef();
    const { mapReady } = useMapContext();
    return (
      <div>
        <MapVisualization
          visualizationRef={visualizationRef}
          mapConfig={{}}
          viewConfig={{}}
          layers={layers}
          baseMap={null}
          layerControl={false}
        />
        <p>{mapReady ? "Map Ready" : "Map Not Ready"}</p>
        <button
          type="button"
          onClick={() =>
            visualizationRef.current?.dispatchEvent({
              type: "pointermove",
              coordinate: [10, 20],
            })
          }
        >
          fire-hover
        </button>
      </div>
    );
  };

  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <HiddenHoverHarness />
      </MapContextProvider>
    ),
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  await waitFor(() => {
    const addedNames = addLayerSpy.mock.calls.map(
      (call) => call[0].values_?.name,
    );
    expect(addedNames).toEqual(
      expect.arrayContaining(["HoverHidden", "HoverVisible"]),
    );
  });

  fireEvent.click(screen.getByText("fire-hover"));

  await waitFor(() => {
    expect(mockedQueryLayerFeatures.mock.calls.length).toBe(1);
  });
  // Only the visible hover layer was queried — the hidden one was
  // dropped by the visibility map's `=== true` check.
  expect(
    mockedQueryLayerFeatures.mock.calls[0][0].configuration.props.name,
  ).toBe("HoverVisible");
});

test("Map hover handles a non-array 'zoomed' result without crashing", async () => {
  // Covers the L846 short-circuit `if (!Array.isArray(features)) return
  // features;` inside runHoverQuery's queryCalls.map. When
  // queryLayerFeatures returns a non-array sentinel (the click handler
  // uses "zoomed" to suppress the popup when the zoom-to-query threshold
  // triggers), the hover handler must pass it through verbatim — the
  // outer filter then drops it because it's not an array.
  mockedQueryLayerFeatures.mockResolvedValue("zoomed");
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");

  const layers = [
    {
      tablePopupType: "hover",
      configuration: {
        type: "ImageLayer",
        props: {
          name: "Hover Layer",
          source: {
            type: "ESRI Image and Map Service",
            props: { url: "hover_url" },
          },
        },
      },
    },
  ];
  const hoverCoords = [10, 20];
  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          onMapPointerMove={true}
          clickCoordinates={hoverCoords}
          mapProps={{
            mapConfig: {},
            viewConfig: {},
            layers,
            baseMap: null,
            layerControl: false,
          }}
        />
      </MapContextProvider>
    ),
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  // Query was called; "zoomed" passed through the early-return; the
  // results filter dropped it; no popup opens.
  await waitFor(() => {
    expect(mockedQueryLayerFeatures).toHaveBeenCalledTimes(1);
  });
  await new Promise((resolve) => setTimeout(resolve, 300));
  const positionCalls = popSetPosition.mock.calls.map(([arg]) => arg);
  expect(positionCalls).not.toContainEqual(hoverCoords);
});

test("Map hover early-bails when no hover-tagged layers exist", async () => {
  // Covers the L800 true branch in runHoverQuery:
  //   if (hoverLayers.length === 0) return;
  // When the map has only click-tagged layers, a pointermove still
  // arrives at onMapHover, but after debounce the filter produces an
  // empty hoverLayers and the handler must return before doing any
  // alias/variable/query work — including not calling queryLayerFeatures.
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);

  const layers = [
    {
      // Default tablePopupType is "click" — no hover behavior.
      configuration: {
        type: "ImageLayer",
        props: {
          name: "ClickOnly",
          source: {
            type: "ESRI Image and Map Service",
            props: { url: "click_url" },
          },
        },
      },
    },
  ];
  const hoverCoords = [10, 20];
  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          onMapPointerMove={true}
          clickCoordinates={hoverCoords}
          mapProps={{
            mapConfig: {},
            viewConfig: {},
            layers,
            baseMap: null,
            layerControl: false,
          }}
        />
      </MapContextProvider>
    ),
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  // Wait past the debounce window. The handler must NOT have called
  // queryLayerFeatures — no hover-tagged layers means an early return.
  await new Promise((resolve) => setTimeout(resolve, 400));
  expect(mockedQueryLayerFeatures).not.toHaveBeenCalled();
});

test("Map hover drops a null element instead of handing it to the popup", async () => {
  // A query result may contain a non-object element; runHoverQuery's map passes
  // it through verbatim. Popup dereferences every entry it receives, so letting
  // one reach popupContent threw "Cannot read properties of null (reading
  // 'layerName')" from a useEffect — asynchronously, after the commit, which
  // meant the uncaught error could surface inside an unrelated later test.
  // Non-objects are now filtered out before the popup ever sees them.
  mockedQueryLayerFeatures.mockResolvedValue([null]);
  const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");

  const layers = [
    {
      tablePopupType: "hover",
      configuration: {
        type: "ImageLayer",
        props: {
          name: "Hover Layer",
          source: {
            type: "ESRI Image and Map Service",
            props: { url: "hover_url" },
          },
        },
      },
    },
  ];
  const hoverCoords = [10, 20];
  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          onMapPointerMove={true}
          clickCoordinates={hoverCoords}
          mapProps={{
            mapConfig: {},
            viewConfig: {},
            layers,
            baseMap: null,
            layerControl: false,
          }}
        />
      </MapContextProvider>
    ),
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  // Let the debounced query and its continuation settle before asserting an
  // absence — otherwise the assertion outruns the async chain and passes
  // whether or not the null was filtered.
  await waitFor(() => expect(mockedQueryLayerFeatures).toHaveBeenCalled());
  await new Promise((resolve) => setTimeout(resolve, 50));

  // The null contributes nothing, so no popup is opened at the hover
  // coordinate and nothing downstream dereferences it.
  expect(popSetPosition).not.toHaveBeenCalledWith(hoverCoords);
  expect(screen.getByText("Map Ready")).toBeInTheDocument();
});

test("Map hover debounce restarts on a second pointermove, dropping the first", async () => {
  // Covers the clearTimeout in onMapHover's debounce-restart path: two
  // pointermove events fired in rapid succession must result in exactly
  // ONE query (the second one), proving the first debounce was cancelled.
  mockedQueryLayerFeatures.mockResolvedValue([]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);

  const layers = [
    {
      tablePopupType: "hover",
      configuration: {
        type: "ImageLayer",
        props: {
          name: "Hover Layer",
          source: {
            type: "ESRI Image and Map Service",
            props: { url: "hover_url" },
          },
        },
      },
    },
  ];
  const firstCoords = [10, 20];
  const secondCoords = [50, 60];

  const RapidMoveHarness = () => {
    const visualizationRef = useRef();
    const { mapReady } = useMapContext();
    return (
      <div>
        <MapVisualization
          visualizationRef={visualizationRef}
          mapConfig={{}}
          viewConfig={{}}
          layers={layers}
          baseMap={null}
          layerControl={false}
        />
        <p>{mapReady ? "Map Ready" : "Map Not Ready"}</p>
        <button
          type="button"
          onClick={() => {
            // Fire both events synchronously inside the same tick so the
            // second arrives before the first's 250ms debounce expires.
            visualizationRef.current?.dispatchEvent({
              type: "pointermove",
              coordinate: firstCoords,
            });
            visualizationRef.current?.dispatchEvent({
              type: "pointermove",
              coordinate: secondCoords,
            });
          }}
        >
          fire-both
        </button>
      </div>
    );
  };

  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <RapidMoveHarness />
      </MapContextProvider>
    ),
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  fireEvent.click(screen.getByText("fire-both"));

  // After the debounce window elapses, exactly one query call has fired
  // (the second coordinate's) and the first event's debounce was
  // cancelled.
  await waitFor(() => {
    expect(mockedQueryLayerFeatures).toHaveBeenCalledTimes(1);
  });
  // Wait a bit longer to make sure no extra query trickles in.
  await new Promise((resolve) => setTimeout(resolve, 300));
  await waitFor(() =>
    expect(mockedQueryLayerFeatures).toHaveBeenCalledTimes(1),
  );
  // The lone call used the second coordinate.
  expect(mockedQueryLayerFeatures.mock.calls[0][2]).toEqual(secondCoords);
});

describe("click and hover result ordering", () => {
  // Ranking runs at the two aggregation seams, so these assert the wiring; the
  // comparator itself is unit-tested in components/map/utilities.test.js.
  //
  // Under jsdom Swiper never assigns an active-slide class, so slot 0 is read
  // through the overlay anchor: the popup-sync effect positions the overlay on
  // the ACTIVE feature's geometry, and the active index is reset to 0 on every
  // new popupContent.
  const plainLayer = (name, sourceType = "ESRI Image and Map Service") => ({
    name,
    configuration: {
      type: "ImageLayer",
      props: {
        name,
        source: { type: sourceType, props: { url: `${name}_url` } },
      },
    },
  });

  test("a click opens the popup on the nearest feature, not the first returned", async () => {
    // The click fires at [10, 20]; "far" is ~22 away and "near" ~2.8, and
    // "far" is returned first to prove arrival order is not what decides.
    mockedQueryLayerFeatures.mockResolvedValue([
      { attributes: { id: "far" }, geometry: { x: 0, y: 0 }, layerName: "L" },
      {
        attributes: { id: "near" },
        geometry: { x: 12, y: 22 },
        layerName: "L",
      },
    ]);
    jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
    const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");

    renderSyncMap([plainLayer("L")]);
    expect(await screen.findByText("Map Ready")).toBeInTheDocument();

    await waitFor(() =>
      expect(popSetPosition).toHaveBeenLastCalledWith([12, 22]),
    );
  });

  test("a raster band reading sinks below a vector hit that is further away", async () => {
    // The raster builders report the click coordinate as their own geometry,
    // so a plain distance sort would hand them slot 0 on every click.
    mockedQueryLayerFeatures.mockImplementation(async (layer) =>
      layer.configuration.props.name === "Raster"
        ? [
            {
              attributes: { "Band 1": 42 },
              geometry: { type: "Point", coordinates: [10, 20] },
              layerName: "Raster",
            },
          ]
        : [
            {
              attributes: { id: "gauge" },
              geometry: { x: 16, y: 26 },
              layerName: "Vector",
            },
          ],
    );
    jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
    const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");

    renderSyncMap([plainLayer("Raster", "GeoTIFF"), plainLayer("Vector")]);
    expect(await screen.findByText("Map Ready")).toBeInTheDocument();

    await waitFor(() =>
      expect(popSetPosition).toHaveBeenLastCalledWith([16, 26]),
    );
  });

  test("a hover opens the popup on the nearest feature", async () => {
    // Hover leaves the overlay pinned at the cursor (the popup-sync effect
    // returns early for a hover-opened popup), so slot 0 is read through
    // variable-input publication, which follows the active feature on hover.
    mockedQueryLayerFeatures.mockResolvedValue([
      {
        attributes: { field1: "far" },
        geometry: { x: 0, y: 0 },
        layerName: "H",
      },
      {
        attributes: { field1: "near" },
        geometry: { x: 11, y: 21 },
        layerName: "H",
      },
    ]);
    jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);

    const dashboard = JSON.parse(JSON.stringify(userDashboard));
    dashboard.tabs[0].gridItems = [mockedTextVariable];
    const varInputArgs = JSON.parse(mockedTextVariable.args_string);

    const hoverLayer = {
      tablePopupType: "hover",
      attributeVariables: { H: { field1: "Test Variable" } },
      configuration: {
        type: "ImageLayer",
        props: {
          name: "H",
          source: {
            type: "ESRI Image and Map Service",
            props: { url: "h_url" },
          },
        },
      },
    };

    const LoadedComponent = createLoadedComponent({
      children: (
        <MapContextProvider>
          <TestingComponent
            onMapPointerMove={true}
            clickCoordinates={[10, 20]}
            mapProps={{
              mapConfig: {},
              viewConfig: {},
              layers: [hoverLayer],
              baseMap: null,
              layerControl: false,
            }}
          />
          <VariableInput
            variable_name={varInputArgs.variable_name}
            initial_value={varInputArgs.initial_value}
            variable_options_source={varInputArgs.variable_options_source}
            onChange={jest.fn()}
          />
        </MapContextProvider>
      ),
      options: { dashboards: { dashboards: [dashboard] } },
    });
    render(LoadedComponent);
    expect(await screen.findByText("Map Ready")).toBeInTheDocument();

    // "far" arrived first but "near" is ~2.2 from the cursor versus ~22.
    await waitFor(async () => {
      expect(await screen.findByTestId("input-variables")).toHaveTextContent(
        JSON.stringify({ "Test Variable": "near" }),
      );
    });
  });
});

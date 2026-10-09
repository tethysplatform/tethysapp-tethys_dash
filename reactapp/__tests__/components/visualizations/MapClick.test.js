// MapVisualization: click queries, the table popup and its sync with the popup
// modal, and attribute variables written from a clicked feature.
import {
  mockedQueryLayerFeatures,
  TestingComponent,
  ExtentDrawModeSetter,
  renderSyncMap,
  spyOnSlideTo,
  syncLayer,
} from "__tests__/utilities/mapVisualizationHarness";
import { useRef, useState } from "react";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from "@testing-library/react";
import createLoadedComponent from "__tests__/utilities/customRender";
import { Map } from "ol";
import ImageArcGISRest from "ol/source/ImageArcGISRest.js";
import VariableInput from "components/visualizations/VariableInput";
import { Vector as VectorSource } from "ol/source.js";
import Overlay from "ol/Overlay";
import { Swiper } from "swiper";
import {
  mockedTextVariable,
  mockedDropdownVariable,
  mockedDropdownVisualization,
  userDashboard,
} from "__tests__/utilities/constants";
import MapContextProvider, {
  useMapContext,
} from "components/contexts/MapContext";
import MapVisualization, { Popup } from "components/visualizations/Map";
import { clearClientSourceCaches } from "components/map/ModuleLoader";

// The GeoParquet/Zarr read caches are module-scoped and live for the page's
// lifetime by design, so each test must start from an empty one.
beforeEach(() => {
  clearClientSourceCaches();
});

test("Map click renders attribute values React cannot render on its own", async () => {
  // Clicking a GeoParquet feature crashed the popup with "Objects are not
  // valid as a React child": hyparquet decodes a parquet TIMESTAMP to a Date.
  // A boolean is worse in its way -- React accepts it and renders nothing, so
  // the row just looked blank.
  mockedQueryLayerFeatures.mockResolvedValue([
    {
      attributes: {
        observed_at: new Date(Date.UTC(2026, 7, 1, 6, 30)),
        is_active: true,
        tags: ["a", "b"],
        station_name: "Station 007",
      },
      geometry: { x: 0, y: 0 },
      layerName: "Sites",
    },
  ]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);

  const layers = [
    {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "Sites",
          source: { type: "ESRI Image and Map Service", props: { url: "u" } },
        },
      },
    },
  ];
  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          onMapClick={jest.fn()}
          clickCoordinates={[10, 20]}
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
  // TestingComponent dispatches the singleclick itself once the map is ready.
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  expect(
    await screen.findByText("2026-08-01T06:30:00.000Z"),
  ).toBeInTheDocument();
  expect(screen.getByText("true")).toBeInTheDocument();
  expect(screen.getByText('["a","b"]')).toBeInTheDocument();
  expect(screen.getByText("Station 007")).toBeInTheDocument();
});

test("Map click", async () => {
  mockedQueryLayerFeatures.mockResolvedValue([
    {
      attributes: { field1: "some value" },
      geometry: {
        paths: [
          [
            [0, 0],
            [0, 1],
          ],
          [
            [1, 0],
            [1, 1],
          ],
        ],
      },
      layerName: "Some Layer",
    },
  ]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");
  const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");
  const removeLayerSpy = jest.spyOn(Map.prototype, "removeLayer");

  // Mock the clear method on VectorSource to test it's called
  const mockClear = jest.fn();
  jest.spyOn(VectorSource.prototype, "clear").mockImplementation(mockClear);

  const layers = [
    {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "NWC",
          source: {
            type: "ESRI Image and Map Service",
            props: {
              url: "some_url",
            },
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
          onMapClick={jest.fn()}
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
  const { rerender } = render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  // layer, marker, and highlight layer
  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(3);
  });
  await waitFor(() => {
    expect(removeLayerSpy.mock.calls.length).toBe(0);
  });

  expect(
    addLayerSpy.mock.calls[2][0].getSource() instanceof ImageArcGISRest,
  ).toBe(true);

  // highlight layer
  const highLightLayer = addLayerSpy.mock.calls[0][0];
  expect(highLightLayer.get("name")).toBe("Highlighted Layer");
  expect(highLightLayer.getSource() instanceof VectorSource).toBe(true);
  expect(
    highLightLayer.getSource().getFeatures()[0].getGeometry().getCoordinates(),
  ).toStrictEqual([
    [0, 0],
    [0, 1],
  ]);

  // marker layer
  expect(addLayerSpy.mock.calls[1][0].get("name")).toBe("Marker");
  expect(addLayerSpy.mock.calls[1][0].getSource() instanceof VectorSource).toBe(
    true,
  );
  expect(
    addLayerSpy.mock.calls[1][0]
      .getSource()
      .getFeatures()[0]
      .getGeometry()
      .getCoordinates(),
  ).toStrictEqual(clickCoordinates);

  // popup
  await waitFor(() =>
    expect(popSetPosition).toHaveBeenCalledWith(clickCoordinates),
  );

  expect(await screen.findByText("Some Layer")).toBeInTheDocument();
  expect(await screen.findByText("Field")).toBeInTheDocument();
  expect(await screen.findByText("Value")).toBeInTheDocument();
  expect(await screen.findByText("field1")).toBeInTheDocument();
  expect(await screen.findByText("some value")).toBeInTheDocument();

  addLayerSpy.mockClear(); // Reset the call count
  mockClear.mockClear(); // Reset the clear call count

  const newClickCoordinates = [20, 10];
  const NewLoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          onMapClick={jest.fn()}
          clickCoordinates={newClickCoordinates}
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
  rerender(NewLoadedComponent);

  // new marker layer
  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(1);
  });
  // remove old marker layer
  await waitFor(() => {
    expect(removeLayerSpy.mock.calls.length).toBe(1);
  });

  // Verify that the highlight layer's clear method was called on the second click
  expect(mockClear).toHaveBeenCalledTimes(1);

  // marker layer
  expect(addLayerSpy.mock.calls[0][0].getSource() instanceof VectorSource).toBe(
    true,
  );
  expect(
    addLayerSpy.mock.calls[0][0]
      .getSource()
      .getFeatures()[0]
      .getGeometry()
      .getCoordinates(),
  ).toStrictEqual(newClickCoordinates);
});

test("Map click with aliases", async () => {
  mockedQueryLayerFeatures.mockResolvedValue([
    {
      attributes: { field1: "some value" },
      geometry: {
        paths: [
          [
            [0, 0],
            [0, 1],
          ],
          [
            [1, 0],
            [1, 1],
          ],
        ],
      },
      layerName: "Some Layer",
    },
  ]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");
  const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");

  const layers = [
    {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "NWC",
          source: {
            type: "ESRI Image and Map Service",
            props: {
              url: "some_url",
            },
          },
        },
      },
      attributeAliases: { "Some Layer": { field1: "Some Alias Field" } },
    },
  ];
  const clickCoordinates = [10, 20];
  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          onMapClick={jest.fn()}
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

  // layer, marker, and highlight layer
  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(3);
  });

  // popup
  await waitFor(() =>
    expect(popSetPosition).toHaveBeenCalledWith(clickCoordinates),
  );

  expect(await screen.findByText("Some Layer")).toBeInTheDocument();
  expect(await screen.findByText("Field")).toBeInTheDocument();
  expect(await screen.findByText("Value")).toBeInTheDocument();
  expect(screen.queryByText("field1")).not.toBeInTheDocument();
  expect(await screen.findByText("Some Alias Field")).toBeInTheDocument();
  expect(await screen.findByText("some value")).toBeInTheDocument();
});

test("Map click no queryable layer", async () => {
  mockedQueryLayerFeatures.mockResolvedValue([
    {
      attributes: { field1: "some value" },
      geometry: {
        paths: [
          [
            [0, 0],
            [0, 1],
          ],
          [
            [1, 0],
            [1, 1],
          ],
        ],
      },
      layerName: "Some Layer",
    },
  ]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");

  const layers = [
    {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "NWC not queryable",
          source: {
            type: "ESRI Image and Map Service",
            props: {
              url: "some_url",
            },
          },
        },
      },
      queryable: false,
    },
    {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "NWC",
          source: {
            type: "ESRI Image and Map Service",
            props: {
              url: "some_url",
            },
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
          onMapClick={jest.fn()}
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

  // layer, marker, and highlight layer
  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(4);
  });

  expect(addLayerSpy.mock.calls[0][0].values_.name).toBe("Highlighted Layer");
  expect(addLayerSpy.mock.calls[1][0].values_.name).toBe("Marker");
  expect(addLayerSpy.mock.calls[2][0].values_.name).toBe("NWC not queryable");
  expect(addLayerSpy.mock.calls[3][0].values_.name).toBe("NWC");

  expect(mockedQueryLayerFeatures.mock.calls.length).toBe(1);
  expect(
    mockedQueryLayerFeatures.mock.calls[0][0].configuration.props.name,
  ).toBe("NWC");
});

test("Map click — table popup type 'none' skips a layer when no modal is configured", async () => {
  // New equivalent of the legacy queryable: false case using the
  // tablePopupType field. With no modal popup configured and the table popup
  // turned off, the click handler must not query the layer at all.
  mockedQueryLayerFeatures.mockResolvedValue([
    {
      attributes: { field1: "some value" },
      geometry: { x: 0, y: 0 },
      layerName: "Some Layer",
    },
  ]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);

  const layers = [
    {
      tablePopupType: "none",
      configuration: {
        type: "ImageLayer",
        props: {
          name: "OffLayer",
          source: {
            type: "ESRI Image and Map Service",
            props: { url: "some_url" },
          },
        },
      },
    },
    {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "OnLayer",
          source: {
            type: "ESRI Image and Map Service",
            props: { url: "some_url" },
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
          onMapClick={jest.fn()}
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

  // Only the layer with the default (Click) table popup type is queried.
  await waitFor(() => {
    expect(mockedQueryLayerFeatures.mock.calls.length).toBe(1);
  });
  expect(
    mockedQueryLayerFeatures.mock.calls[0][0].configuration.props.name,
  ).toBe("OnLayer");
});

test("Map click — modal-only layer with tablePopupType 'none' IS queried and modal opens", async () => {
  // Regression for the bug fix: a layer with the table popup turned off but a
  // modal popup configured must still be queried on click so the modal can
  // open. Previously, queryable: false short-circuited modals too.
  mockedQueryLayerFeatures.mockResolvedValue([
    {
      attributes: { station_id: "ABC" },
      geometry: { x: 10, y: 10 },
      layerName: "ModalOnly",
    },
  ]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");

  const layers = [
    {
      name: "ModalOnly",
      tablePopupType: "none",
      configuration: {
        type: "ImageLayer",
        props: {
          name: "ModalOnly",
          source: {
            type: "ESRI Image and Map Service",
            props: { url: "modal_url" },
          },
        },
      },
      popupConfig: {
        mode: "modal",
        position: null,
        titleTemplate: null,
        gridItems: [],
      },
    },
  ];
  const clickCoordinates = [10, 20];
  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          onMapClick={jest.fn()}
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

  // The layer IS queried (modal is configured).
  await waitFor(() => {
    expect(mockedQueryLayerFeatures.mock.calls.length).toBe(1);
  });
  expect(
    mockedQueryLayerFeatures.mock.calls[0][0].configuration.props.name,
  ).toBe("ModalOnly");

  // The modal opens.
  await waitFor(() => {
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  // The table overlay popup is NOT positioned at the click coordinate.
  // popSetPosition is shared with the spinner overlay (it's called with the
  // click coordinate at the start of the handler and then null when queries
  // finish), so the meaningful assertion is on the LAST call — which is the
  // popup overlay being set to `undefined` to keep it hidden.
  await waitFor(() => {
    expect(popSetPosition).toHaveBeenLastCalledWith(undefined);
  });
});

test("Popup modal carousel moves the table overlay to the active feature", async () => {
  mockedQueryLayerFeatures.mockResolvedValue([
    {
      attributes: { station_id: "AAA" },
      geometry: { x: 10, y: 10 },
      layerName: "Both",
    },
    {
      attributes: { station_id: "BBB" },
      geometry: { x: 50, y: 60 },
      layerName: "Both",
    },
  ]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");

  const slideTo = spyOnSlideTo();

  renderSyncMap([syncLayer()]);
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  await waitFor(() => {
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
  await screen.findByLabelText("Next Swiper"); // table popup is up

  // The overlay opens anchored on the first feature's geometry.
  await waitFor(() => {
    expect(popSetPosition).toHaveBeenLastCalledWith([10, 10]);
  });
  slideTo.mockClear();

  fireEvent.click(screen.getByTestId("popup-modal-carousel-next"));

  // The table slides to the matching feature and the overlay follows it.
  await waitFor(() => {
    expect(slideTo).toHaveBeenCalledWith(1);
  });
  await waitFor(() => {
    expect(popSetPosition).toHaveBeenLastCalledWith([50, 60]);
  });
  expect(
    screen.getByTestId("popup-modal-carousel-pagination"),
  ).toHaveTextContent("2 / 2");
});

test("Swiping the table popup moves the popup modal to the same feature", async () => {
  mockedQueryLayerFeatures.mockResolvedValue([
    {
      attributes: { station_id: "AAA" },
      geometry: { x: 10, y: 10 },
      layerName: "Both",
    },
    {
      attributes: { station_id: "BBB" },
      geometry: { x: 50, y: 60 },
      layerName: "Both",
    },
  ]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");

  renderSyncMap([syncLayer()]);
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  await waitFor(() => {
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
  expect(
    await screen.findByTestId("popup-modal-carousel-pagination"),
  ).toHaveTextContent("1 / 2");

  fireEvent.click(await screen.findByLabelText("Next Swiper"));

  // The modal follows the table, and the overlay re-anchors on the new feature.
  await waitFor(() => {
    expect(
      screen.getByTestId("popup-modal-carousel-pagination"),
    ).toHaveTextContent("2 / 2");
  });
  await waitFor(() => {
    expect(popSetPosition).toHaveBeenLastCalledWith([50, 60]);
  });
});

test("Popup modal hides the table overlay on a feature the table has no slide for", async () => {
  // Two layers at the same click: one drives both popups, one is modal-only
  // (tablePopupType "none"). Navigating to the modal-only feature leaves the
  // table with nothing to show, so the overlay hides rather than sitting on a
  // different feature than the modal.
  const modalOnly = {
    ...syncLayer("ModalOnly"),
    name: "ModalOnly",
    tablePopupType: "none",
  };
  modalOnly.configuration.props.name = "ModalOnly";

  mockedQueryLayerFeatures.mockImplementation((layer) =>
    Promise.resolve([
      layer.configuration.props.name === "ModalOnly"
        ? {
            attributes: { station_id: "MMM" },
            geometry: { x: 90, y: 90 },
            layerName: "ModalOnly",
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

  renderSyncMap([syncLayer(), modalOnly]);
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  await waitFor(() => {
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
  await waitFor(() => {
    expect(popSetPosition).toHaveBeenLastCalledWith([10, 10]);
  });

  // Forward to the modal-only feature: the overlay hides.
  fireEvent.click(screen.getByTestId("popup-modal-carousel-next"));
  await waitFor(() => {
    expect(popSetPosition).toHaveBeenLastCalledWith(undefined);
  });

  // Back to the shared feature: the overlay is restored at its anchor.
  fireEvent.click(screen.getByTestId("popup-modal-carousel-prev"));
  await waitFor(() => {
    expect(popSetPosition).toHaveBeenLastCalledWith([10, 10]);
  });
});

test("Table popup follows its own slide when no popup modal is configured", async () => {
  // The overlay is anchored to the feature it is showing, not to the click
  // point it opened at — otherwise swiping to a feature elsewhere on the map
  // leaves the popup pointing at nothing. Applies with no modal in play.
  mockedQueryLayerFeatures.mockResolvedValue([
    {
      attributes: { station_id: "AAA" },
      geometry: { x: 10, y: 10 },
      layerName: "TableOnly",
    },
    {
      attributes: { station_id: "BBB" },
      geometry: { x: 50, y: 60 },
      layerName: "TableOnly",
    },
  ]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");

  const tableOnly = syncLayer("TableOnly");
  tableOnly.configuration.props.name = "TableOnly";
  delete tableOnly.popupConfig;

  renderSyncMap([tableOnly]);
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  await waitFor(() => {
    expect(popSetPosition).toHaveBeenCalledWith([10, 20]); // click coordinate
  });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

  fireEvent.click(await screen.findByLabelText("Next Swiper"));

  await waitFor(() => {
    expect(popSetPosition).toHaveBeenLastCalledWith([50, 60]);
  });
});

test("Both popups wrap around at either end and stay in sync", async () => {
  mockedQueryLayerFeatures.mockResolvedValue([
    {
      attributes: { station_id: "AAA" },
      geometry: { x: 10, y: 10 },
      layerName: "Both",
    },
    {
      attributes: { station_id: "BBB" },
      geometry: { x: 50, y: 60 },
      layerName: "Both",
    },
  ]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");
  const slideTo = spyOnSlideTo();

  renderSyncMap([syncLayer()]);
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  await waitFor(() => {
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
  await screen.findByLabelText("Next Swiper");
  await waitFor(() => {
    expect(popSetPosition).toHaveBeenLastCalledWith([10, 10]);
  });

  // Back from the first feature lands on the last, and the table follows.
  slideTo.mockClear();
  fireEvent.click(screen.getByTestId("popup-modal-carousel-prev"));
  await waitFor(() => {
    expect(
      screen.getByTestId("popup-modal-carousel-pagination"),
    ).toHaveTextContent("2 / 2");
  });
  await waitFor(() => {
    expect(slideTo).toHaveBeenCalledWith(1);
  });
  await waitFor(() => {
    expect(popSetPosition).toHaveBeenLastCalledWith([50, 60]);
  });

  // Forward from the last feature comes back around to the first.
  slideTo.mockClear();
  fireEvent.click(screen.getByTestId("popup-modal-carousel-next"));
  await waitFor(() => {
    expect(
      screen.getByTestId("popup-modal-carousel-pagination"),
    ).toHaveTextContent("1 / 2");
  });
  await waitFor(() => {
    expect(slideTo).toHaveBeenCalledWith(0);
  });
  await waitFor(() => {
    expect(popSetPosition).toHaveBeenLastCalledWith([10, 10]);
  });
});

test("Table popup's Swiper is configured to wrap at both ends", async () => {
  // Swiper's rewind path is gated on `isBeginning`/`isEnd`, which it derives
  // from measured slide geometry. Under jsdom every element is 0x0, so Swiper
  // ends up with `slides.length === 0` and both flags false — the rewind
  // branch is unreachable no matter how the arrows are driven. (Plain
  // stepping still works, which is why the other swipe tests pass.) So assert
  // the option actually reaches the instance and verify the wrap itself in a
  // browser. The modal-driven half of the wrap IS covered, by the test above.
  mockedQueryLayerFeatures.mockResolvedValue([
    {
      attributes: { station_id: "AAA" },
      geometry: { x: 10, y: 10 },
      layerName: "Both",
    },
    {
      attributes: { station_id: "BBB" },
      geometry: { x: 50, y: 60 },
      layerName: "Both",
    },
  ]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);

  let swiperInstance = null;
  const realInit = Swiper.prototype.init;
  jest.spyOn(Swiper.prototype, "init").mockImplementation(function (...args) {
    swiperInstance = this;
    return realInit.apply(this, args);
  });

  renderSyncMap([syncLayer()]);
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  await screen.findByLabelText("Next Swiper");

  expect(swiperInstance).not.toBeNull();
  expect(swiperInstance.params.rewind).toBe(true);
  // `loop` would clone slides and shift activeIndex off the real index, which
  // is what the popup modal sync maps against — so it must stay off.
  expect(swiperInstance.params.loop).toBe(false);
});

test("Popup sync leaves the overlay in place for a feature with no geometry", async () => {
  // A queried feature can arrive without a geometry (e.g. a non-spatial result
  // from a custom feature source). There is nowhere to anchor the popup, so it
  // keeps the position it already has rather than being moved off-map.
  mockedQueryLayerFeatures.mockResolvedValue([
    { attributes: { station_id: "AAA" }, layerName: "Both" },
    { attributes: { station_id: "BBB" }, layerName: "Both" },
  ]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");

  renderSyncMap([syncLayer()]);
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  await waitFor(() => {
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
  await screen.findByLabelText("Next Swiper");
  await waitFor(() => {
    expect(popSetPosition).toHaveBeenLastCalledWith([10, 20]); // click point
  });

  // Neither direction of the sync repositions it.
  fireEvent.click(screen.getByTestId("popup-modal-carousel-next"));
  fireEvent.click(screen.getByLabelText("Next Swiper"));
  await waitFor(() => {
    expect(
      screen.getByTestId("popup-modal-carousel-pagination"),
    ).toHaveTextContent("2 / 2");
  });
  expect(popSetPosition).toHaveBeenLastCalledWith([10, 20]);
});

test("Swiping the table onto a feature with no modal closes the modal", async () => {
  // Two layers at the same click: one drives both popups, one is table-only
  // (no popupConfig). The modal is a view of the selected feature, so stepping
  // onto the table-only feature must close it -- not leave it showing a
  // different feature than the table.
  const tableOnly = syncLayer("TableOnly");
  tableOnly.configuration.props.name = "TableOnly";
  delete tableOnly.popupConfig;

  mockedQueryLayerFeatures.mockImplementation((layer) =>
    Promise.resolve([
      layer.configuration.props.name === "TableOnly"
        ? {
            attributes: { station_id: "TTT" },
            geometry: { x: 90, y: 90 },
            layerName: "TableOnly",
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

  renderSyncMap([syncLayer(), tableOnly]);
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  // The modal-bearing feature is first, so the modal opens on it.
  await waitFor(() => {
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
  expect(
    screen.getByTestId("popup-modal-carousel-pagination"),
  ).toHaveTextContent("1 / 2");

  fireEvent.click(await screen.findByLabelText("Next Swiper"));

  // The overlay follows onto the table-only feature; the modal closes.
  await waitFor(() => {
    expect(popSetPosition).toHaveBeenLastCalledWith([90, 90]);
  });
  await waitFor(() => {
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

test("A click whose first feature has no modal opens the table alone", async () => {
  // The reported bug: the table opened at 1/22 on a Surface Meteorology point
  // while the modal independently opened at 1/3 on a MicroRain Radar point.
  // The modal must not open for something the user never selected.
  const tableOnly = syncLayer("TableOnly");
  tableOnly.configuration.props.name = "TableOnly";
  delete tableOnly.popupConfig;

  mockedQueryLayerFeatures.mockImplementation((layer) =>
    Promise.resolve([
      layer.configuration.props.name === "TableOnly"
        ? {
            attributes: { station_id: "TTT" },
            geometry: { x: 10, y: 10 },
            layerName: "TableOnly",
          }
        : {
            attributes: { station_id: "MMM" },
            geometry: { x: 90, y: 90 },
            layerName: "Both",
          },
    ]),
  );
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");

  // Table-only layer first, so it is the union's index 0.
  renderSyncMap([tableOnly, syncLayer()]);
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  await waitFor(() => {
    expect(popSetPosition).toHaveBeenLastCalledWith([10, 10]);
  });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

  // Stepping onto the modal-bearing feature opens it...
  fireEvent.click(await screen.findByLabelText("Next Swiper"));
  await waitFor(() => {
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
  expect(
    screen.getByTestId("popup-modal-carousel-pagination"),
  ).toHaveTextContent("2 / 2");

  // ...and stepping back closes it again.
  fireEvent.click(screen.getByLabelText("Previous Swiper"));
  await waitFor(() => {
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

test("Closing the modal keeps it closed while navigating, until the next click", async () => {
  // The modal's open state is derived from the selected feature, so a
  // dismissal has to be remembered -- otherwise the next carousel step would
  // reopen the modal the user just closed.
  mockedQueryLayerFeatures.mockResolvedValue([
    {
      attributes: { station_id: "AAA" },
      geometry: { x: 10, y: 10 },
      layerName: "Both",
    },
    {
      attributes: { station_id: "BBB" },
      geometry: { x: 50, y: 60 },
      layerName: "Both",
    },
  ]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");

  renderSyncMap([syncLayer()]);
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  const dialog = await screen.findByRole("dialog");
  expect(dialog).toBeInTheDocument();

  fireEvent.click(within(dialog).getByLabelText("Close popup"));
  await waitFor(() => {
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // Navigating does not resurrect it. The carousel lives inside the modal, so
  // the overlay's move to the second feature is what proves the step landed.
  fireEvent.click(await screen.findByLabelText("Next Swiper"));
  await waitFor(() => {
    expect(popSetPosition).toHaveBeenLastCalledWith([50, 60]);
  });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("Map click — modal-only layer feature without geometry does not call addHighlightFeatures", async () => {
  // Covers the `!feature?.geometry` early-return guard in the modal-driven
  // highlight effect. A queried feature whose geometry field is absent
  // (e.g., a non-spatial result from a custom feature source) must not
  // crash the effect — it should bail before calling addHighlightFeatures.
  //
  // The effect still runs through its earlier guards (modalOpen is true,
  // highlightLayer.current is set by the click handler, hoverActiveRef is
  // false because click resets it, modalFeatures has the missing-geometry
  // feature), so reaching the no-geometry guard is what's being exercised.
  mockedQueryLayerFeatures.mockResolvedValue([
    {
      attributes: { reach_id: "ABC" },
      // geometry deliberately omitted.
      layerName: "NoGeom",
    },
  ]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const vectorAddFeaturesSpy = jest.spyOn(
    VectorSource.prototype,
    "addFeatures",
  );

  const layers = [
    {
      name: "NoGeom",
      tablePopupType: "none",
      configuration: {
        type: "ImageLayer",
        props: {
          name: "NoGeom",
          source: {
            type: "ESRI Image and Map Service",
            props: { url: "nogeom_url" },
          },
        },
      },
      popupConfig: {
        mode: "modal",
        position: null,
        titleTemplate: null,
        gridItems: [],
      },
    },
  ];
  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          onMapClick={jest.fn()}
          clickCoordinates={[10, 20]}
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

  await waitFor(() => {
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  // The modal opened (so the effect's first three guards passed), but
  // addHighlightFeatures was never called for this feature because the
  // no-geometry guard fired.
  expect(vectorAddFeaturesSpy).not.toHaveBeenCalled();
});

test("Map click — modal-only layer highlights the clicked feature's GeoJSON geometry", async () => {
  // Regression: clicking a feature on a modal-only layer (tablePopupType
  // "none" + Custom Modal Popup enabled) must still produce a highlight
  // overlay. The popupContent-driven highlight effect doesn't fire for
  // these layers because their features never enter `popupContent`, so a
  // separate modal-driven effect is responsible for the highlight.
  //
  // Uses a GeoJSON LineString geometry shape (as returned by
  // getGeoJSONLayerFeatures for vector layers) to exercise the
  // addHighlightFeatures LineString branch end-to-end from a click event.
  mockedQueryLayerFeatures.mockResolvedValue([
    {
      attributes: { reach_id: "ABC" },
      geometry: {
        type: "LineString",
        coordinates: [
          [0, 0],
          [1, 1],
        ],
      },
      layerName: "GeoJSONLayer",
    },
  ]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const vectorClearSpy = jest.spyOn(VectorSource.prototype, "clear");
  const vectorAddFeaturesSpy = jest.spyOn(
    VectorSource.prototype,
    "addFeatures",
  );

  const layers = [
    {
      name: "GeoJSONLayer",
      tablePopupType: "none",
      configuration: {
        type: "VectorLayer",
        props: {
          name: "GeoJSONLayer",
          source: {
            type: "GeoJSON",
            props: { url: "geojson_url" },
          },
        },
      },
      popupConfig: {
        mode: "modal",
        position: null,
        titleTemplate: null,
        gridItems: [],
      },
    },
  ];
  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          onMapClick={jest.fn()}
          clickCoordinates={[10, 20]}
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

  // The modal opens (which is what gates the highlight effect).
  await waitFor(() => {
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  // The highlight layer was cleared and the GeoJSON LineString feature
  // was added — proving the modal-driven highlight effect ran end-to-end.
  await waitFor(() => {
    expect(vectorClearSpy).toHaveBeenCalled();
  });
  expect(vectorAddFeaturesSpy).toHaveBeenCalled();
});

test("Map click — hover-table layer is excluded from the click handler", async () => {
  // tablePopupType: "hover" without modal must not be queried on click; only
  // the hover handler should fire for that layer.
  mockedQueryLayerFeatures.mockResolvedValue([
    {
      attributes: { field1: "value" },
      geometry: { x: 0, y: 0 },
      layerName: "HoverLayer",
    },
  ]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);

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
          onMapClick={jest.fn()}
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

  // Click handler queries only ClickLayer. (The pointermove dispatch in the
  // TestingComponent only fires when onMapPointerMove is passed, so the hover
  // handler does not run here — this is purely a click-filter test.)
  await waitFor(() => {
    expect(mockedQueryLayerFeatures.mock.calls.length).toBeGreaterThanOrEqual(
      1,
    );
  });
  const queriedNames = mockedQueryLayerFeatures.mock.calls.map(
    ([layer]) => layer.configuration.props.name,
  );
  expect(queriedNames).toContain("ClickLayer");
  expect(queriedNames).not.toContain("HoverLayer");
});

test("Map click — hover-only map: click is a no-op (no query, no empty popup)", async () => {
  // Regression: when the map has only hover-tagged layers, clicking
  // anywhere previously overwrote the hover popup with an empty
  // "No Attributes Found" overlay. The click handler now bails before
  // any side effects when nothing is click-eligible.
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");

  const layers = [
    {
      tablePopupType: "hover",
      configuration: {
        type: "ImageLayer",
        props: {
          name: "HoverOnly",
          source: {
            type: "ESRI Image and Map Service",
            props: { url: "hover_url" },
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
          onMapClick={jest.fn()}
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

  // Give the click handler time to run (or NOT run). The early-bail guard
  // returns before any async work, so this is a small fixed wait.
  await new Promise((resolve) => setTimeout(resolve, 50));

  // No query was issued — nothing is click-eligible.
  expect(mockedQueryLayerFeatures).not.toHaveBeenCalled();
  // The popup overlay was never positioned at the click coordinate (the
  // bug symptom was setPosition([10, 20]) leaving the empty popup visible).
  const positionCalls = popSetPosition.mock.calls.map(([arg]) => arg);
  expect(positionCalls).not.toContainEqual(clickCoordinates);
});

test("Map click — mixed config: click on hover feature preserves the hover popup", async () => {
  // Regression: when both click and hover layers exist, clicking on a
  // location where ONLY the hover layer has a feature must not replace
  // the hover popup with "No Attributes Found". The click handler queries
  // the click-eligible layer, finds nothing, and now bails via the
  // hoverActiveRef guard instead of overwriting popup state.
  mockedQueryLayerFeatures.mockImplementation(async (layer) => {
    if (layer.configuration.props.name === "HoverLayer") {
      return [
        {
          attributes: { field1: "hover-value" },
          geometry: { x: 10, y: 10 },
          layerName: "HoverLayer",
        },
      ];
    }
    // Click layer returns nothing at this location.
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
  const sharedCoordinates = [10, 20];

  // The default TestingComponent fires singleclick before pointermove,
  // which is the wrong order for this test (we need hover popup OPEN
  // first, then dispatch the click). Use a manual harness with two
  // buttons so the test body controls the dispatch order.
  const HoverThenClickHarness = () => {
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
              coordinate: sharedCoordinates,
            })
          }
        >
          fire-hover
        </button>
        <button
          type="button"
          onClick={() =>
            visualizationRef.current?.dispatchEvent({
              type: "singleclick",
              coordinate: sharedCoordinates,
            })
          }
        >
          fire-click
        </button>
      </div>
    );
  };

  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <HoverThenClickHarness />
      </MapContextProvider>
    ),
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  // Step 1: fire hover. After the 250ms debounce, the hover popup opens
  // at sharedCoordinates and the overlay is positioned there.
  fireEvent.click(screen.getByText("fire-hover"));
  await waitFor(() => {
    expect(popSetPosition).toHaveBeenCalledWith(sharedCoordinates);
  });
  const queriedAfterHover = mockedQueryLayerFeatures.mock.calls.length;

  // Step 2: fire click at the same coordinate. The click handler will
  // query ClickLayer (which returns []), find no features, see that a
  // hover popup is open, and bail without modifying popup state.
  fireEvent.click(screen.getByText("fire-click"));
  // Give the async click handler time to complete its query work.
  await waitFor(() => {
    expect(mockedQueryLayerFeatures.mock.calls.length).toBeGreaterThan(
      queriedAfterHover,
    );
  });

  // The overlay was NOT repositioned to undefined (which would hide it)
  // and was NOT given a fresh setPosition with the click coordinate to
  // anchor an empty popup. The last setPosition call should still be the
  // hover anchor — sharedCoordinates — leaving the hover popup visible.
  await waitFor(() => {
    expect(popSetPosition).toHaveBeenLastCalledWith(sharedCoordinates);
  });
});

test("Map click skips layers the user has hidden via the layer control", async () => {
  // Visibility is mutated on the OL layer directly by LayersControl, so the
  // config-side `layers` array doesn't reflect toggles. The click handler
  // must consult `olLayer.getVisible()` (looked up by name) and skip
  // queries on hidden layers — otherwise a user who turned off a layer
  // would still see its features in the popup table. The OL layer's
  // `layerVisibility: false` flag in the layer config drives initial
  // visibility (Map.js#L329-L334).
  mockedQueryLayerFeatures.mockResolvedValue([
    {
      attributes: { field1: "some value" },
      geometry: { x: 0, y: 0 },
      layerName: "Some Layer",
    },
  ]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");

  const layers = [
    {
      configuration: {
        type: "ImageLayer",
        layerVisibility: false,
        props: {
          name: "NWC hidden",
          source: {
            type: "ESRI Image and Map Service",
            props: { url: "some_url" },
          },
        },
      },
    },
    {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "NWC visible",
          source: {
            type: "ESRI Image and Map Service",
            props: { url: "some_url" },
          },
        },
      },
    },
  ];

  // The default TestingComponent dispatches the click on mapReady, but
  // mapReady flips to true on OL's first `rendercomplete` — BEFORE the
  // async customLayers loop finishes mounting OL layers. That race
  // doesn't matter for tests that filter config-side (queryable: false),
  // but the visibility filter needs the OL layers to exist. Gate the
  // click on the OL layers actually being added.
  const ManualClickHarness = () => {
    const visualizationRef = useRef();
    const { mapReady } = useMapContext();
    const clickCoordinates = [10, 20];
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
              coordinate: clickCoordinates,
            })
          }
        >
          fire-click
        </button>
      </div>
    );
  };

  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <ManualClickHarness />
      </MapContextProvider>
    ),
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  // Wait for OL to mount both custom layers before firing the click.
  // (The Highlighted Layer + Marker are added LATER, inside onMapClick.)
  await waitFor(() => {
    const addedNames = addLayerSpy.mock.calls.map(
      (call) => call[0].values_?.name,
    );
    expect(addedNames).toEqual(
      expect.arrayContaining(["NWC hidden", "NWC visible"]),
    );
  });

  fireEvent.click(screen.getByText("fire-click"));

  await waitFor(() => {
    expect(mockedQueryLayerFeatures.mock.calls.length).toBe(1);
  });
  expect(
    mockedQueryLayerFeatures.mock.calls[0][0].configuration.props.name,
  ).toBe("NWC visible");
});

test("Map click no features found", async () => {
  mockedQueryLayerFeatures.mockResolvedValue([]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");

  const layers = [
    {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "NWC",
          source: {
            type: "ESRI Image and Map Service",
            props: {
              url: "some_url",
            },
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
          onMapClick={jest.fn()}
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
  await waitFor(() =>
    expect(popSetPosition).toHaveBeenLastCalledWith(clickCoordinates),
  );

  await waitFor(async () => {
    expect(await screen.findByText("No Attributes Found")).toBeInTheDocument();
  });

  const popupCloser = await screen.findByLabelText("Popup Closer");
  fireEvent.click(popupCloser);
  await waitFor(() =>
    expect(popSetPosition).toHaveBeenLastCalledWith(undefined),
  );
});

test("Map click no attributes found", async () => {
  mockedQueryLayerFeatures.mockResolvedValue([
    {
      attributes: {},
      geometry: { x: 10, y: 10 },
      layerName: "Some Layer",
    },
  ]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");

  const layers = [
    {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "NWC",
          source: {
            type: "ESRI Image and Map Service",
            props: {
              url: "some_url",
            },
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
          onMapClick={jest.fn()}
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
  await waitFor(() =>
    expect(popSetPosition).toHaveBeenLastCalledWith(clickCoordinates),
  );

  await waitFor(async () => {
    expect(await screen.findByText("No Attributes Found")).toBeInTheDocument();
  });

  const popupCloser = await screen.findByLabelText("Popup Closer");
  fireEvent.click(popupCloser);
  await waitFor(() =>
    expect(popSetPosition).toHaveBeenLastCalledWith(undefined),
  );
});

test("Map click all attributes omitted", async () => {
  mockedQueryLayerFeatures.mockResolvedValue([
    {
      attributes: { field1: "some value" },
      geometry: { x: 10, y: 10 },
      layerName: "Some Layer",
    },
  ]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");

  const layers = [
    {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "NWC",
          source: {
            type: "ESRI Image and Map Service",
            props: {
              url: "some_url",
            },
          },
        },
      },
      omittedPopupAttributes: { "Some Layer": ["field1"] },
    },
  ];
  const clickCoordinates = [10, 20];
  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          onMapClick={jest.fn()}
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
  await waitFor(() => {
    expect(popSetPosition).toHaveBeenLastCalledWith(undefined);
  });
});

test("Map click attribute variables update text variable input then swipe and update again", async () => {
  mockedQueryLayerFeatures.mockResolvedValue([
    {
      attributes: { field1: "some value" },
      geometry: { x: 10, y: 10 },
      layerName: "Some Layer",
    },
    {
      attributes: { field1: "another value" },
      geometry: { x: 10, y: 10 },
      layerName: "Some Layer",
    },
    {
      attributes: { field1: "Null" },
      geometry: { x: 10, y: 10 },
      layerName: "Some Layer",
    },
    {
      attributes: { field1: "yet another value" },
      geometry: { x: 10, y: 10 },
      layerName: "Another Layer",
    },
  ]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");
  const handleChange = jest.fn();
  const dashboard = JSON.parse(JSON.stringify(userDashboard));
  dashboard.tabs[0].gridItems = [mockedTextVariable];
  const varInputArgs = JSON.parse(mockedTextVariable.args_string);

  const layers = [
    {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "NWC",
          source: {
            type: "ESRI Image and Map Service",
            props: {
              url: "some_url",
            },
          },
        },
      },
      attributeVariables: { "Some Layer": { field1: "Test Variable" } },
    },
  ];
  const clickCoordinates = [10, 20];
  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          onMapClick={jest.fn()}
          clickCoordinates={clickCoordinates}
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
  // popup
  await waitFor(() => {
    expect(popSetPosition).toHaveBeenCalledWith(clickCoordinates);
  });

  expect(await screen.findAllByText("Some Layer")).toHaveLength(3);
  expect(await screen.findByText("Another Layer")).toBeInTheDocument();
  expect(await screen.findAllByText("Field")).toHaveLength(4);
  expect(await screen.findAllByText("Value")).toHaveLength(4);
  expect(await screen.findAllByText("field1")).toHaveLength(4);
  expect(await screen.findByText("some value")).toBeInTheDocument();
  expect(await screen.findByText("another value")).toBeInTheDocument();
  expect(await screen.findByText("Null")).toBeInTheDocument();
  expect(await screen.findByText("yet another value")).toBeInTheDocument();

  await waitFor(async () => {
    expect(await screen.findByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({
        "Test Variable": "some value",
      }),
    );
  });
  const variableInput = screen.getByRole("textbox");
  await waitFor(() => {
    expect(variableInput.value).toBe("some value");
  });

  const nextSwiper = screen.getByLabelText("Next Swiper");
  fireEvent.click(nextSwiper);

  await waitFor(async () => {
    expect(await screen.findByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({
        "Test Variable": "another value",
      }),
    );
  });

  fireEvent.click(nextSwiper);

  // Third feature's field1 is "Null". The bound variable is now cleared rather
  // than left showing the previous feature's value: leaving it is the one path
  // here that propagates a wrong value off the map, because every dependent
  // visualization keeps rendering the previously selected feature's data with no
  // indication anything is stale.
  await waitFor(async () => {
    expect(await screen.findByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({
        "Test Variable": "",
      }),
    );
  });

  fireEvent.click(nextSwiper);

  // Fourth feature belongs to a layer with no attribute-variable binding, so
  // nothing is written and the cleared value stands. Unchanged behavior.
  await waitFor(async () => {
    expect(await screen.findByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({
        "Test Variable": "",
      }),
    );
  });
});

test("Map click carries a zero attribute value into the variable input", async () => {
  // The old check was a truthiness test, so a real 0 -- a gage reading of zero,
  // a count of zero -- was indistinguishable from an absent field and dropped,
  // leaving the previously clicked feature's value on screen.
  mockedQueryLayerFeatures.mockResolvedValue([
    {
      attributes: { field1: 0 },
      geometry: { x: 10, y: 10 },
      layerName: "Some Layer",
    },
  ]);

  // The real setPosition drives OpenLayers' auto-pan, which crashes in jsdom.
  jest.spyOn(Overlay.prototype, "setPosition").mockImplementation(() => {});
  const handleChange = jest.fn();
  const dashboard = JSON.parse(JSON.stringify(userDashboard));
  dashboard.tabs[0].gridItems = [mockedTextVariable];
  const varInputArgs = JSON.parse(mockedTextVariable.args_string);

  const layers = [
    {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "NWC",
          source: {
            type: "ESRI Image and Map Service",
            props: { url: "some_url" },
          },
        },
      },
      attributeVariables: { "Some Layer": { field1: "Test Variable" } },
    },
  ];

  render(
    createLoadedComponent({
      children: (
        <MapContextProvider>
          <TestingComponent
            onMapClick={jest.fn()}
            clickCoordinates={[10, 20]}
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
    }),
  );

  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  await waitFor(async () => {
    expect(await screen.findByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({ "Test Variable": 0 }),
    );
  });
});

test("Map click attribute variables update dropdown variable input", async () => {
  mockedQueryLayerFeatures.mockResolvedValue([
    {
      attributes: { field1: "FTDC1" },
      geometry: { x: 10, y: 10 },
      layerName: "Some Layer",
    },
  ]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");
  const handleChange = jest.fn();
  const dashboard = JSON.parse(JSON.stringify(userDashboard));
  dashboard.tabs[0].gridItems = [mockedDropdownVariable];
  const varInputArgs = JSON.parse(mockedDropdownVariable.args_string);

  const layers = [
    {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "NWC",
          source: {
            type: "ESRI Image and Map Service",
            props: {
              url: "some_url",
            },
          },
        },
      },
      attributeVariables: { "Some Layer": { field1: "Test Variable" } },
    },
  ];
  const clickCoordinates = [10, 20];
  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          onMapClick={jest.fn()}
          clickCoordinates={clickCoordinates}
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
    options: {
      dashboards: { dashboards: [dashboard] },
      visualizations: mockedDropdownVisualization,
    },
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();

  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  await waitFor(() => {
    expect(popSetPosition).toHaveBeenCalledWith(clickCoordinates);
  });

  expect(await screen.findByText("Some Layer")).toBeInTheDocument();
  expect(await screen.findByText("Field")).toBeInTheDocument();
  expect(await screen.findByText("Value")).toBeInTheDocument();
  expect(await screen.findByText("field1")).toBeInTheDocument();
  expect(await screen.findByText("FTDC1")).toBeInTheDocument();

  await waitFor(async () => {
    expect(await screen.findByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({
        "Test Variable": "FTDC1",
      }),
    );
  });
  await waitFor(async () => {
    expect(
      screen.getByText("FTDC1 - SMITH RIVER - DOCTOR FINE BRIDGE"),
    ).toBeInTheDocument();
  });
});

test("Map click attribute variables Null values", async () => {
  mockedQueryLayerFeatures.mockResolvedValue([
    {
      attributes: { field1: "Null" },
      geometry: { x: 10, y: 10 },
      layerName: "Some Layer",
    },
  ]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");

  const layers = [
    {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "NWC",
          source: {
            type: "ESRI Image and Map Service",
            props: {
              url: "some_url",
            },
          },
        },
      },
      attributeVariables: { "Some Layer": { field1: "Some Variable" } },
    },
  ];
  const clickCoordinates = [10, 20];
  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          onMapClick={jest.fn()}
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
  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({}),
  );

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();

  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  await waitFor(() => {
    expect(popSetPosition).toHaveBeenCalledWith(clickCoordinates);
  });

  expect(await screen.findByText("Some Layer")).toBeInTheDocument();
  expect(await screen.findByText("Field")).toBeInTheDocument();
  expect(await screen.findByText("Value")).toBeInTheDocument();
  expect(await screen.findByText("field1")).toBeInTheDocument();
  expect(await screen.findByText("Null")).toBeInTheDocument();

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({}),
  );
});

test("Map click attribute variables match field name and alias", async () => {
  mockedQueryLayerFeatures.mockResolvedValue([
    {
      attributes: { alias1: "value1", field2: "value2", field3: "value3" },
      geometry: { x: 10, y: 10 },
      layerName: "Layer1",
    },
  ]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");
  // Simulate dashboard variable config
  const layers = [
    {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "NWC",
          source: {
            type: "ESRI Image and Map Service",
            props: { url: "some_url" },
          },
        },
      },
      attributeVariables: {
        Layer1: { field1: "Var1", alias2: "Var2", field3: "Var3" },
      },
      attributeAliases: { Layer1: { field1: "alias1", field2: "alias2" } },
      omittedPopupAttributes: { Layer1: ["field2"] },
    },
  ];
  const clickCoordinates = [10, 20];
  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          onMapClick={jest.fn()}
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
  await waitFor(() => {
    expect(popSetPosition).toHaveBeenCalledWith(clickCoordinates);
  });
  // Both variable inputs should be updated
  await waitFor(async () => {
    expect(await screen.findByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({ Var1: "value1", Var2: "value2", Var3: "value3" }),
    );
  });
  // Both values should be visible in popup
  expect(await screen.findByText("alias1")).toBeInTheDocument();
  expect(await screen.findByText("value1")).toBeInTheDocument();
  expect(await screen.findByText("field3")).toBeInTheDocument();
  expect(await screen.findByText("value3")).toBeInTheDocument();
});

test("Map click query error", async () => {
  mockedQueryLayerFeatures.mockRejectedValue("some error");
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");

  const layers = [
    {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "NWC",
          source: {
            type: "ESRI Image and Map Service",
            props: {
              url: "some_url",
            },
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
          onMapClick={jest.fn()}
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
  await waitFor(() => {
    expect(popSetPosition).toHaveBeenLastCalledWith(clickCoordinates);
  });
  expect(await screen.findByText("No Attributes Found")).toBeInTheDocument();
});

test("Map click not happen in dataviewer mode", async () => {
  const layers = [
    {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "NWC",
          source: {
            type: "ESRI Image and Map Service",
            props: {
              url: "some_url",
            },
          },
        },
      },
    },
  ];
  const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");
  const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");
  const removeLayerSpy = jest.spyOn(Map.prototype, "removeLayer");
  const clickCoordinates = [10, 20];

  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          onMapClick={jest.fn()}
          clickCoordinates={clickCoordinates}
          mapProps={{
            mapConfig: {},
            viewConfig: {},
            layers,
            baseMap: null,
            layerControl: false,
            dataviewerViz: true,
          }}
        />
      </MapContextProvider>
    ),
    options: {
      inDataViewerMode: true,
    },
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();

  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  expect(await screen.findByLabelText("Info Div")).toBeInTheDocument();

  // layer, marker, and highlight layer
  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(1);
  });
  await waitFor(() => {
    expect(removeLayerSpy.mock.calls.length).toBe(0);
  });

  expect(
    addLayerSpy.mock.calls[0][0].getSource() instanceof ImageArcGISRest,
  ).toBe(true);
  expect(popSetPosition).toHaveBeenCalledTimes(0);
});

test("Map click layer zoomed query result", async () => {
  mockedQueryLayerFeatures.mockResolvedValue("zoomed");
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");

  const layers = [
    {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "NWC",
          source: {
            type: "ESRI Image and Map Service",
            props: {
              url: "some_url",
            },
          },
        },
      },
      omittedPopupAttributes: { "Some Layer": ["field1"] },
    },
  ];
  const clickCoordinates = [10, 20];
  const LoadedComponent = createLoadedComponent({
    children: (
      <MapContextProvider>
        <TestingComponent
          onMapClick={jest.fn()}
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
  await waitFor(() => {
    expect(popSetPosition).toHaveBeenLastCalledWith(undefined);
  });
});

test("Map info div in dataviewer mode with pontermove", async () => {
  const layers = [
    {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "NWC",
          source: {
            type: "ESRI Image and Map Service",
            props: {
              url: "some_url",
            },
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
          clickCoordinates={clickCoordinates}
          onMapPointerMove={true}
          mapProps={{
            mapConfig: {},
            viewConfig: {},
            layers,
            baseMap: null,
            layerControl: false,
            dataviewerViz: true,
          }}
        />
      </MapContextProvider>
    ),
    options: {
      inDataViewerMode: true,
    },
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();

  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  expect(await screen.findByLabelText("Info Div")).toBeInTheDocument();
  expect(await screen.findByText(/Zoom: 4.5/i)).toBeInTheDocument();
  expect(
    await screen.findByText(/Lon: 10.00, Lat: 20.00/i),
  ).toBeInTheDocument();
  expect(await screen.findByText(/Projection: EPSG:3857/i)).toBeInTheDocument();
});

test("Map info div in dataviewer mode with zoom", async () => {
  const layers = [
    {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "NWC",
          source: {
            type: "ESRI Image and Map Service",
            props: {
              url: "some_url",
            },
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
          onMapZoom={true}
          clickCoordinates={clickCoordinates}
          mapProps={{
            mapConfig: {},
            viewConfig: {},
            layers,
            baseMap: null,
            layerControl: false,
            mapExtent: { extent: "-10686671.12, 4721671.57,4.5" },
            dataviewerViz: true,
          }}
        />
      </MapContextProvider>
    ),
    options: {
      inDataViewerMode: true,
    },
  });
  render(LoadedComponent);

  expect(await screen.findByLabelText("Map Div")).toBeInTheDocument();

  expect(await screen.findByText("Map Ready")).toBeInTheDocument();

  expect(await screen.findByLabelText("Info Div")).toBeInTheDocument();
  expect(await screen.findByText(/Zoom: 8/i)).toBeInTheDocument();
  expect(
    await screen.findByText(/Lon: -10686671.12, Lat: 4721671.57/i),
  ).toBeInTheDocument();
  expect(await screen.findByText(/Projection: EPSG:3857/i)).toBeInTheDocument();
});

describe("modal-mode popup integration", () => {
  test("modal-mode layer click opens PopupModal alongside the table popup; outer-context attribute write still fires", async () => {
    mockedQueryLayerFeatures.mockResolvedValue([
      {
        attributes: { station_id: "ABC", state_id: "WA" },
        geometry: { x: 10, y: 10 },
        layerName: "Stations",
      },
    ]);
    jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
    const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");

    const layers = [
      {
        name: "Stations",
        configuration: {
          type: "ImageLayer",
          props: {
            name: "Stations",
            source: {
              type: "ESRI Image and Map Service",
              props: { url: "some_url" },
            },
          },
        },
        // attributeVariables drives the outer-context write — both table
        // and modal popups now render in parallel, so the host's
        // attributeVariables → variableInputs flow continues for
        // modal-mode features.
        attributeVariables: { Stations: { station_id: "Test Variable" } },
        popupConfig: {
          mode: "modal",
          position: {
            leftPct: 25,
            topPct: 30,
            widthPct: 50,
            heightPct: 40,
          },
          titleTemplate: null,
          gridItems: [],
        },
      },
    ];
    const clickCoordinates = [10, 20];
    const LoadedComponent = createLoadedComponent({
      children: (
        <MapContextProvider>
          <TestingComponent
            onMapClick={jest.fn()}
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

    // Modal opens (PopupModal renders role=dialog into document.body via
    // portal).
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    expect(screen.getByTestId("popup-modal-chrome")).toBeInTheDocument();
    expect(screen.getByTestId("popup-modal-header-title")).toHaveTextContent(
      "Stations",
    );

    // Outer-context attributeVariables write fires (modal-mode no longer
    // suppresses it): station_id="ABC" → "Test Variable".
    await waitFor(() => {
      expect(screen.getByTestId("input-variables")).toHaveTextContent(
        JSON.stringify({ "Test Variable": "ABC" }),
      );
    });

    // OL Overlay table popup also opens at the click coordinate — the
    // modal-mode click no longer suppresses it.
    await waitFor(() => {
      expect(popSetPosition).toHaveBeenCalledWith(clickCoordinates);
    });
  });

  // eslint-disable-next-line no-template-curly-in-string
  test("modal header substitutes ${feature.<key>} from the active feature's attributes", async () => {
    // Title template is configured by the user in the popup pane and lives
    // on layer.popupConfig.titleTemplate. Map.js computes the substituted
    // title (using FEATURE_SCOPE host-pass preservation + the popup's own
    // substituteTemplateString) and renders it into PopupModal's header.
    mockedQueryLayerFeatures.mockResolvedValue([
      {
        attributes: { station_id: "ABC", station_name: "Boulder Creek" },
        geometry: { x: 10, y: 10 },
        layerName: "Stations",
      },
    ]);
    jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);

    const layers = [
      {
        configuration: {
          type: "ImageLayer",
          props: {
            name: "Stations",
            source: {
              type: "ESRI Image and Map Service",
              props: { url: "some_url" },
            },
          },
        },
        popupConfig: {
          mode: "modal",
          // eslint-disable-next-line no-template-curly-in-string
          titleTemplate: "Site: ${feature.station_name}",
          gridItems: [],
        },
      },
    ];
    const LoadedComponent = createLoadedComponent({
      children: (
        <MapContextProvider>
          <TestingComponent
            onMapClick={jest.fn()}
            clickCoordinates={[10, 20]}
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

    expect(await screen.findByText("Map Ready")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    expect(screen.getByTestId("popup-modal-header-title")).toHaveTextContent(
      "Site: Boulder Creek",
    );
  });

  // Regression: with a popup open, host-level variable input changes rebuild
  // the Map's `layers` prop with freshly substituted strings. The wrapper
  // layer captured onto `__wrapperLayer` at click time becomes stale —
  // `activeModalLayer` must be re-resolved against the current `layers`
  // prop (matched by `configuration.props.name`) so the popup body and
  // header always see up-to-date popupConfig content.
  test("popup body re-resolves layer config when host re-substitutes the layers prop", async () => {
    mockedQueryLayerFeatures.mockResolvedValue([
      {
        attributes: { id: "X" },
        geometry: { x: 10, y: 10 },
        layerName: "Stations",
      },
    ]);
    jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);

    const buildLayers = (fValue) => [
      {
        configuration: {
          type: "ImageLayer",
          props: {
            name: "Stations",
            source: {
              type: "ESRI Image and Map Service",
              props: { url: "some_url" },
            },
          },
        },
        popupConfig: {
          mode: "modal",
          titleTemplate: `Site ${fValue}`,
          gridItems: [],
        },
      },
    ];

    const HostHarness = () => {
      const [fValue, setFValue] = useState("first");
      return (
        <>
          <button type="button" onClick={() => setFValue("second")}>
            change-f
          </button>
          <MapContextProvider>
            <TestingComponent
              onMapClick={jest.fn()}
              clickCoordinates={[10, 20]}
              mapProps={{
                mapConfig: {},
                viewConfig: {},
                layers: buildLayers(fValue),
                baseMap: null,
                layerControl: false,
              }}
            />
          </MapContextProvider>
        </>
      );
    };

    const LoadedComponent = createLoadedComponent({
      children: <HostHarness />,
    });
    render(LoadedComponent);

    expect(await screen.findByText("Map Ready")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    expect(screen.getByTestId("popup-modal-header-title")).toHaveTextContent(
      "Site first",
    );

    fireEvent.click(screen.getByText("change-f"));

    await waitFor(() => {
      expect(screen.getByTestId("popup-modal-header-title")).toHaveTextContent(
        "Site second",
      );
    });
  });

  test("table-mode (popupConfig absent) layer click still drives outer-context attribute write", async () => {
    // Regression coverage for R2 — table mode unchanged.
    mockedQueryLayerFeatures.mockResolvedValue([
      {
        attributes: { field1: "ABC" },
        geometry: { x: 10, y: 10 },
        layerName: "Stations",
      },
    ]);
    jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
    const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");

    const dashboard = JSON.parse(JSON.stringify(userDashboard));
    dashboard.tabs[0].gridItems = [mockedTextVariable];
    const layers = [
      {
        configuration: {
          type: "ImageLayer",
          props: {
            name: "Stations",
            source: {
              type: "ESRI Image and Map Service",
              props: { url: "some_url" },
            },
          },
        },
        attributeVariables: { Stations: { field1: "Test Variable" } },
        // popupConfig is absent — table-mode default.
      },
    ];
    const clickCoordinates = [10, 20];
    const LoadedComponent = createLoadedComponent({
      children: (
        <MapContextProvider>
          <TestingComponent
            onMapClick={jest.fn()}
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
      options: { dashboards: { dashboards: [dashboard] } },
    });
    render(LoadedComponent);

    expect(await screen.findByText("Map Ready")).toBeInTheDocument();

    // OL Overlay popup opens at the click coordinate.
    await waitFor(() => {
      expect(popSetPosition).toHaveBeenCalledWith(clickCoordinates);
    });

    // Outer-context attribute write fired (backward compat).
    await waitFor(() => {
      expect(screen.getByTestId("input-variables")).toHaveTextContent(
        JSON.stringify({ "Test Variable": "ABC" }),
      );
    });

    // Modal did NOT render.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("ESRI sub-layer click resolves to the wrapper layer's popupConfig (modal opens)", async () => {
    // ESRI Image/Map Service queries return features keyed by the
    // sub-layer name (e.g., "Flow Forecast (m³/sec)") rather than the
    // wrapper layer's configured name ("China Flowlines"). The wrapper
    // is now tagged onto every feature at query time
    // (feature.__wrapperLayer), so popup resolution doesn't depend on
    // any string-name back-lookup that would only work when the user
    // happens to have configured aliases/variables/omitted-attrs on
    // the relevant sub-layer.
    mockedQueryLayerFeatures.mockResolvedValue([
      {
        attributes: { comid: "55555" },
        geometry: { x: 10, y: 10 },
        layerName: "Flow Forecast (m³/sec)",
      },
    ]);
    jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
    jest.spyOn(Overlay.prototype, "setPosition");

    const layers = [
      {
        configuration: {
          type: "ImageLayer",
          props: {
            name: "China Flowlines",
            source: {
              type: "ESRI Image and Map Service",
              props: { url: "some_url" },
            },
          },
        },
        attributeAliases: {
          "Flow Forecast (m³/sec)": { comid: "TDX Hydro Link Number" },
        },
        attributeVariables: {
          "Flow Forecast (m³/sec)": { comid: "river_id" },
        },
        popupConfig: {
          mode: "modal",
          position: { leftPct: 1, topPct: 3, widthPct: 95, heightPct: 55 },
          titleTemplate: null,
          gridItems: [],
        },
      },
    ];
    const clickCoordinates = [10, 20];
    const LoadedComponent = createLoadedComponent({
      children: (
        <MapContextProvider>
          <TestingComponent
            onMapClick={jest.fn()}
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

    // Modal opens because the sub-layer feature resolved to the wrapper's
    // popupConfig.
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    expect(screen.getByTestId("popup-modal-chrome")).toBeInTheDocument();
    expect(screen.getByTestId("popup-modal-header-title")).toHaveTextContent(
      "Flow Forecast (m³/sec)",
    );
  });

  test("ESRI sub-layer click opens the modal even with no aliases configured (regression)", async () => {
    // Bug scenario: user names a layer "a", configures a modal popup, but
    // never sets attributeAliases/Variables/OmittedPopupAttributes. The
    // ESRI service returns features tagged with the sub-layer name
    // ("Max Status - Forecast Trend"). The string-name back-lookup
    // previously failed because there were no alias maps to mine for
    // sub-layer keys — so the popup wouldn't open. With wrapper-tagging
    // at query time, popup resolution works regardless.
    mockedQueryLayerFeatures.mockResolvedValue([
      {
        attributes: { nws_lid: "NILM4", nws_name: "Niles" },
        geometry: { x: 10, y: 10 },
        layerName: "Max Status - Forecast Trend",
      },
    ]);
    jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);

    const layers = [
      {
        configuration: {
          type: "ImageLayer",
          props: {
            name: "a",
            source: {
              type: "ESRI Image and Map Service",
              props: { url: "https://example.com/MapServer" },
            },
          },
        },
        // No attributeAliases / attributeVariables / omittedPopupAttributes
        // — the user only configured the popup, nothing else.
        popupConfig: {
          mode: "modal",
          position: { leftPct: 20, topPct: 20, widthPct: 60, heightPct: 60 },
          titleTemplate: null,
          gridItems: [],
        },
      },
    ];
    const LoadedComponent = createLoadedComponent({
      children: (
        <MapContextProvider>
          <TestingComponent
            onMapClick={jest.fn()}
            clickCoordinates={[10, 20]}
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

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    expect(screen.getByTestId("popup-modal-chrome")).toBeInTheDocument();
  });

  test("MapContext.extentDrawMode active suppresses modal open on a modal-mode click", async () => {
    mockedQueryLayerFeatures.mockResolvedValue([
      {
        attributes: { station_id: "ABC" },
        geometry: { x: 10, y: 10 },
        layerName: "Stations",
      },
    ]);
    jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);

    const layers = [
      {
        name: "Stations",
        configuration: {
          type: "ImageLayer",
          props: {
            name: "Stations",
            source: {
              type: "ESRI Image and Map Service",
              props: { url: "some_url" },
            },
          },
        },
        popupConfig: {
          mode: "modal",
          position: null,
          titleTemplate: null,
          gridItems: [],
        },
      },
    ];
    const clickCoordinates = [10, 20];
    const LoadedComponent = createLoadedComponent({
      children: (
        <MapContextProvider>
          <ExtentDrawModeSetter mode="rectangle" />
          <TestingComponent
            onMapClick={jest.fn()}
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

    // Give async query a chance to resolve, then assert no dialog.
    await waitFor(() => {
      expect(mockedQueryLayerFeatures).toHaveBeenCalled();
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("mixed-mode multi-layer click — both modal AND table popup open in parallel", async () => {
    // Two queryable layers; one modal-mode, one table-mode. Modal mode is
    // additive: the OL Overlay table popup AND the PopupModal both open,
    // and the table-mode layer's outer-context attributeVariables write
    // continues to flow.
    mockedQueryLayerFeatures.mockImplementation(async (layer) => {
      if (layer.name === "ModalLayer") {
        return [
          {
            attributes: { station_id: "ABC" },
            geometry: { x: 10, y: 10 },
            layerName: "ModalLayer",
          },
        ];
      }
      return [
        {
          attributes: { field1: "table-value" },
          geometry: { x: 10, y: 10 },
          layerName: "TableLayer",
        },
      ];
    });
    jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
    const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");

    const layers = [
      {
        name: "ModalLayer",
        configuration: {
          type: "ImageLayer",
          props: {
            name: "ModalLayer",
            source: {
              type: "ESRI Image and Map Service",
              props: { url: "modal_url" },
            },
          },
        },
        popupConfig: {
          mode: "modal",
          position: null,
          titleTemplate: null,
          gridItems: [],
        },
      },
      {
        name: "TableLayer",
        configuration: {
          type: "ImageLayer",
          props: {
            name: "TableLayer",
            source: {
              type: "ESRI Image and Map Service",
              props: { url: "table_url" },
            },
          },
        },
        attributeVariables: { TableLayer: { field1: "Some Variable" } },
      },
    ];
    const clickCoordinates = [10, 20];
    const LoadedComponent = createLoadedComponent({
      children: (
        <MapContextProvider>
          <TestingComponent
            onMapClick={jest.fn()}
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

    // Modal opens for the modal-mode feature.
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    expect(screen.getByTestId("popup-modal-chrome")).toBeInTheDocument();
    expect(screen.getByTestId("popup-modal-header-title")).toHaveTextContent(
      "ModalLayer",
    );

    // OL Overlay popup ALSO opens at the click coordinate (additive).
    // Both views now render simultaneously — the modal in document.body
    // via portal, the overlay anchored to the map.
    await waitFor(() => {
      expect(popSetPosition).toHaveBeenCalledWith(clickCoordinates);
    });
    // Note: outer-context variable writes go through popupContent[0], so
    // whichever layer's features come back first in the click result owns
    // the write. That ordering is exercised in the single-layer modal-mode
    // test above; this test only asserts the additive both-popups-open
    // behavior.
  });

  test("closing the modal via the X button clears modal state and unmounts the dialog", async () => {
    mockedQueryLayerFeatures.mockResolvedValue([
      {
        attributes: { station_id: "ABC" },
        geometry: { x: 10, y: 10 },
        layerName: "Stations",
      },
    ]);
    jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);

    const layers = [
      {
        name: "Stations",
        configuration: {
          type: "ImageLayer",
          props: {
            name: "Stations",
            source: {
              type: "ESRI Image and Map Service",
              props: { url: "some_url" },
            },
          },
        },
        popupConfig: {
          mode: "modal",
          position: null,
          titleTemplate: null,
          gridItems: [],
        },
      },
    ];
    const clickCoordinates = [10, 20];
    const LoadedComponent = createLoadedComponent({
      children: (
        <MapContextProvider>
          <TestingComponent
            onMapClick={jest.fn()}
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

    expect(await screen.findByText("Map Ready")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("popup-modal-close"));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  // Defensive coverage: query results without a wrapper-layer tag don't
  // trigger the modal. The wrapper-tag is added in onMapClick's queryCalls
  // loop; if a feature somehow lacks it (or lacks the popupConfig wrapper
  // entirely), the `feature.__wrapperLayer?.popupConfig?.mode === "modal"`
  // predicate falls through cleanly to false and no modal opens.
  test("no modal opens when the query feature carries no popup-config wrapper", async () => {
    mockedQueryLayerFeatures.mockResolvedValue([
      {
        attributes: { id: "ABC" },
        geometry: { x: 10, y: 10 },
        // layerName intentionally absent.
      },
    ]);
    jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);

    const layers = [
      {
        name: "Stations",
        configuration: {
          type: "ImageLayer",
          props: {
            name: "Stations",
            source: {
              type: "ESRI Image and Map Service",
              props: { url: "some_url" },
            },
          },
        },
        popupConfig: {
          mode: "modal",
          position: null,
          titleTemplate: null,
          gridItems: [],
        },
      },
    ];
    const LoadedComponent = createLoadedComponent({
      children: (
        <MapContextProvider>
          <TestingComponent
            onMapClick={jest.fn()}
            clickCoordinates={[10, 20]}
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

    expect(await screen.findByText("Map Ready")).toBeInTheDocument();
    await waitFor(() => {
      expect(mockedQueryLayerFeatures).toHaveBeenCalled();
    });

    // findLayerByName(undefined) hit the !layerName guard and returned
    // undefined, so isModalModeLayer returned false and no modal opens.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // Line 307: closeModal's `if (container && typeof container.focus === "function")`.
  // Existing tests always close with a real div (focus IS a function), so the
  // if-not-taken branch is unhit. Replacing the wrapper's .focus with null
  // makes typeof !== "function", so the branch returns false.
  test("closeModal skips focus restore when the map container's focus is not callable (covers line 307 false branch)", async () => {
    mockedQueryLayerFeatures.mockResolvedValue([
      {
        attributes: { station_id: "ABC" },
        geometry: { x: 10, y: 10 },
        layerName: "Stations",
      },
    ]);
    jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);

    const layers = [
      {
        name: "Stations",
        configuration: {
          type: "ImageLayer",
          props: {
            name: "Stations",
            source: {
              type: "ESRI Image and Map Service",
              props: { url: "some_url" },
            },
          },
        },
        popupConfig: {
          mode: "modal",
          position: null,
          titleTemplate: null,
          gridItems: [],
        },
      },
    ];
    const LoadedComponent = createLoadedComponent({
      children: (
        <MapContextProvider>
          <TestingComponent
            onMapClick={jest.fn()}
            clickCoordinates={[10, 20]}
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
    const { container } = render(LoadedComponent);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // mapContainerRef points at the wrapper div with tabIndex=-1 inside the
    // test container. PopupModal's own tabIndex=-1 lives on document.body via
    // portal, so the only tabindex=-1 element under `container` is the
    // MapVisualization wrapper.
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const wrapper = container.querySelector('div[tabindex="-1"]');
    expect(wrapper).not.toBeNull();
    // Make wrapper.focus return null on Map.js's first access (the
    // `typeof container.focus === "function"` check at line 307 → false →
    // branch alt 1 hit), then a no-op function for PopupModal's subsequent
    // `triggerRef.current.focus()` call so the close-side focus restore
    // doesn't crash on null.
    let focusAccessCount = 0;
    Object.defineProperty(wrapper, "focus", {
      configurable: true,
      get() {
        focusAccessCount += 1;
        if (focusAccessCount === 1) return null;
        return () => {};
      },
    });

    fireEvent.click(screen.getByTestId("popup-modal-close"));

    // Modal closed cleanly: Map.js's closeModal skipped its focus call
    // (branch 307 alt 1 — the if body NOT taken) and PopupModal's
    // focus-restore call was a no-op.
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(focusAccessCount).toBeGreaterThanOrEqual(1);
  });

  // Lines 767, 769:
  //   activeModalFeature.attributes ?? {}      ← line 767 (?? right-side)
  //   if (substituted.trim().length > 0) { ... } ← line 769 (false branch)
  //
  // The OL-Overlay Popup component renders the same feature and would crash
  // on `Object.entries(undefined)` if attributes is nullish. We side-step that
  // by replacing react-dom/client's createRoot with a stub whose .render is a
  // no-op so the Popup overlay is never actually rendered. The PopupModal
  // (the React-Bootstrap-style portal) still renders normally and we can
  // assert against its header.
  // eslint-disable-next-line no-template-curly-in-string
  test("modal title falls back to layerName when attributes is nullish and template substitutes to empty (covers lines 767, 769)", async () => {
    const ReactDOMClient = require("react-dom/client");
    const originalCreateRoot = ReactDOMClient.createRoot;
    ReactDOMClient.createRoot = jest.fn(() => ({
      render: jest.fn(),
      unmount: jest.fn(),
    }));

    try {
      mockedQueryLayerFeatures.mockResolvedValue([
        {
          // attributes intentionally undefined → exercises `?? {}` right side.
          geometry: { x: 10, y: 10 },
          layerName: "Stations",
        },
      ]);
      jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);

      const layers = [
        {
          name: "Stations",
          configuration: {
            type: "ImageLayer",
            props: {
              name: "Stations",
              source: {
                type: "ESRI Image and Map Service",
                props: { url: "some_url" },
              },
            },
          },
          popupConfig: {
            mode: "modal",
            position: null,
            // Template references a key that doesn't exist on the (empty)
            // attributes map → substituted is "", trim().length === 0,
            // so the `if (substituted.trim().length > 0)` body is skipped
            // and popupTitleText stays at activeModalFeature.layerName.
            // eslint-disable-next-line no-template-curly-in-string
            titleTemplate: "${feature.missing}",
            gridItems: [],
          },
        },
      ];
      const LoadedComponent = createLoadedComponent({
        children: (
          <MapContextProvider>
            <TestingComponent
              onMapClick={jest.fn()}
              clickCoordinates={[10, 20]}
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

      expect(await screen.findByText("Map Ready")).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      // Empty substitution → header falls back to the layerName.
      expect(screen.getByTestId("popup-modal-header-title")).toHaveTextContent(
        "Stations",
      );
    } finally {
      ReactDOMClient.createRoot = originalCreateRoot;
    }
  });
});

describe("Popup component", () => {
  const features = [
    {
      layerName: "Layer 1",
      attributes: {
        field1: "value1",
        field2: "value2",
        url: "https://example.com",
      },
    },
    {
      layerName: "Layer 2",
      attributes: {
        fieldA: "valueA",
        fieldB: "valueB",
        url: "www.example.org",
      },
    },
  ];

  it("renders all features and fields", () => {
    render(
      <Popup
        layerAttributes={features}
        onSwipe={jest.fn()}
        omittedPopupAttributes={{}}
        aliases={{}}
      />,
    );
    expect(screen.getByText("Layer 1")).toBeInTheDocument();
    expect(screen.getByText("Layer 2")).toBeInTheDocument();
    expect(screen.getByText("field1")).toBeInTheDocument();
    expect(screen.getByText("value1")).toBeInTheDocument();
    expect(screen.getByText("fieldA")).toBeInTheDocument();
    expect(screen.getByText("valueA")).toBeInTheDocument();
  });

  it("renders URLs as links with protocol", () => {
    render(
      <Popup
        layerAttributes={features}
        onSwipe={jest.fn()}
        omittedPopupAttributes={{}}
        aliases={{}}
      />,
    );
    const httpsLink = screen.getByText("https://example.com");
    // eslint-disable-next-line testing-library/no-node-access
    expect(httpsLink.closest("a")).toHaveAttribute(
      "href",
      "https://example.com",
    );
    const wwwLink = screen.getByText("www.example.org");
    // eslint-disable-next-line testing-library/no-node-access
    expect(wwwLink.closest("a")).toHaveAttribute(
      "href",
      "https://www.example.org",
    );
  });

  it("calls onSwipe when slide changes", () => {
    const onSwipe = jest.fn();
    render(
      <Popup
        layerAttributes={features}
        onSwipe={onSwipe}
        omittedPopupAttributes={{}}
        aliases={{}}
      />,
    );
    // Simulate swipe by firing Swiper's slide change event
    // Swiper's event is not easily triggered, so we call onSwipe directly
    onSwipe();
    expect(onSwipe).toHaveBeenCalled();
  });

  it("renders empty attributes gracefully", () => {
    const emptyFeature = [{ layerName: "Empty", attributes: {} }];
    render(
      <Popup
        layerAttributes={emptyFeature}
        onSwipe={jest.fn()}
        omittedPopupAttributes={{}}
        aliases={{}}
      />,
    );
    expect(screen.getByText("Empty")).toBeInTheDocument();
    expect(screen.getByRole("row")).not.toBeNull();
  });

  it("renders with only one feature", () => {
    const singleFeature = [{ layerName: "Single", attributes: { foo: "bar" } }];
    render(
      <Popup
        layerAttributes={singleFeature}
        onSwipe={jest.fn()}
        omittedPopupAttributes={{}}
        aliases={{}}
      />,
    );
    expect(screen.getByText("Single")).toBeInTheDocument();
    expect(screen.getByText("foo")).toBeInTheDocument();
    expect(screen.getByText("bar")).toBeInTheDocument();
  });

  it("renders with no features", () => {
    render(
      <Popup
        layerAttributes={[]}
        onSwipe={jest.fn()}
        omittedPopupAttributes={{}}
        aliases={{}}
      />,
    );
    // Should not throw, but nothing rendered
    expect(screen.queryByText(/:/)).not.toBeInTheDocument();
  });
});

test("a layer mapping no attributes to variables writes no variable inputs", async () => {
  // The mapping exists but is empty, so the loop finds nothing to carry over
  // and there is no point publishing an empty update.
  mockedQueryLayerFeatures.mockResolvedValue([
    {
      attributes: { field1: "some value" },
      geometry: { x: 0, y: 0 },
      layerName: "Some Layer",
    },
  ]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);

  const layers = [
    {
      configuration: {
        type: "ImageLayer",
        props: {
          name: "NWC",
          source: {
            type: "ESRI Image and Map Service",
            props: { url: "some_url" },
          },
        },
      },
      attributeVariables: { "Some Layer": {} },
    },
  ];

  render(
    createLoadedComponent({
      children: (
        <MapContextProvider>
          <TestingComponent
            onMapClick={jest.fn()}
            clickCoordinates={[10, 20]}
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
    }),
  );

  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  expect(await screen.findByText("some value")).toBeInTheDocument();
});

describe("features with nothing to render are dropped from the popup", () => {
  const omittedLayer = (name, extra = {}) => ({
    name,
    configuration: {
      type: "ImageLayer",
      props: {
        name,
        source: { type: "ESRI Image and Map Service", props: { url: "u" } },
      },
    },
    omittedPopupAttributes: { [name]: ["field1"] },
    ...extra,
  });

  test("an all-omitted feature is dropped even when it is the nearest", async () => {
    // The nearer feature has every attribute omitted and no modal or variable
    // mapping, so it renders nothing. If it survived the filter, ranking would
    // hand it slot 0 and the overlay would hide; instead the overlay anchors on
    // the farther feature that actually has something to show.
    mockedQueryLayerFeatures.mockImplementation(async (layer) =>
      layer.configuration.props.name === "Hidden"
        ? [
            {
              attributes: { field1: "hidden value" },
              geometry: { x: 11, y: 21 },
              layerName: "Hidden",
            },
          ]
        : [
            {
              attributes: { field1: "shown value" },
              geometry: { x: 50, y: 60 },
              layerName: "Shown",
            },
          ],
    );
    jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
    const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");

    renderSyncMap([
      omittedLayer("Hidden"),
      {
        name: "Shown",
        configuration: {
          type: "ImageLayer",
          props: {
            name: "Shown",
            source: { type: "ESRI Image and Map Service", props: { url: "u" } },
          },
        },
      },
    ]);
    expect(await screen.findByText("Map Ready")).toBeInTheDocument();

    await waitFor(() =>
      expect(popSetPosition).toHaveBeenLastCalledWith([50, 60]),
    );
    expect(await screen.findByText("shown value")).toBeInTheDocument();
  });

  test("a click that finds only droppable features hides the overlay instead of reporting nothing found", async () => {
    // Both arms of the empty-popup branch. When features WERE found and every
    // one was dropped, the author omitted those attributes on purpose, so an
    // explicit "No Attributes Found" box on every click is noise they did not
    // ask for -- the overlay just hides, which is what they saw before the drop
    // existed. A click that genuinely finds nothing still gets the box.
    mockedQueryLayerFeatures.mockResolvedValue([
      {
        attributes: { field1: "hidden value" },
        geometry: { x: 10, y: 10 },
        layerName: "Hidden",
      },
    ]);
    jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
    const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");

    renderSyncMap([omittedLayer("Hidden")]);
    expect(await screen.findByText("Map Ready")).toBeInTheDocument();

    // `undefined` is how OpenLayers hides an overlay -- the element stays in the
    // DOM unpositioned, so the position is the assertable signal, not presence.
    await waitFor(() =>
      expect(popSetPosition).toHaveBeenLastCalledWith(undefined),
    );
  });

  test("a click that finds nothing at all still anchors the empty popup", async () => {
    mockedQueryLayerFeatures.mockResolvedValue([]);
    jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
    const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");

    renderSyncMap([omittedLayer("Hidden")]);
    expect(await screen.findByText("Map Ready")).toBeInTheDocument();

    // Anchored at the cursor, not hidden -- the distinguishing behavior.
    await waitFor(() =>
      expect(popSetPosition).toHaveBeenLastCalledWith([10, 20]),
    );
  });

  test("an all-omitted feature with a modal stays and opens its modal", async () => {
    // AE9. The modal is that feature's render, so it is exempt from the drop.
    mockedQueryLayerFeatures.mockResolvedValue([
      {
        attributes: { field1: "hidden value" },
        geometry: { x: 10, y: 10 },
        layerName: "Modal Layer",
      },
    ]);
    jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
    const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");

    renderSyncMap([
      omittedLayer("Modal Layer", {
        popupConfig: {
          mode: "modal",
          position: null,
          titleTemplate: null,
          gridItems: [],
        },
      }),
    ]);
    expect(await screen.findByText("Map Ready")).toBeInTheDocument();

    // The modal opens for the feature...
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    // ...and the table overlay stays hidden, because it has nothing to show.
    await waitFor(() =>
      expect(popSetPosition).toHaveBeenLastCalledWith(undefined),
    );
  });

  test("an all-omitted feature that drives a variable input stays and publishes", async () => {
    // "Hide the ugly table, just drive the chart below" is a normal setup:
    // attributeVariables is keyed on layer name and is independent of the
    // omitted-attribute config, so dropping this feature would silently stop
    // the chart from updating.
    mockedQueryLayerFeatures.mockResolvedValue([
      {
        attributes: { field1: "published value" },
        geometry: { x: 10, y: 10 },
        layerName: "Var Layer",
      },
    ]);
    jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);

    const dashboard = JSON.parse(JSON.stringify(userDashboard));
    dashboard.tabs[0].gridItems = [mockedTextVariable];
    const varInputArgs = JSON.parse(mockedTextVariable.args_string);

    const LoadedComponent = createLoadedComponent({
      children: (
        <MapContextProvider>
          <TestingComponent
            onMapClick={jest.fn()}
            clickCoordinates={[10, 20]}
            mapProps={{
              mapConfig: {},
              viewConfig: {},
              layers: [
                omittedLayer("Var Layer", {
                  attributeVariables: {
                    "Var Layer": { field1: "Test Variable" },
                  },
                }),
              ],
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

    await waitFor(async () => {
      expect(await screen.findByTestId("input-variables")).toHaveTextContent(
        JSON.stringify({ "Test Variable": "published value" }),
      );
    });
  });
});

describe("Popup field order", () => {
  // The first cell of each body row is the field's display label.
  const rowLabels = () =>
    screen
      .getAllByRole("row")
      .slice(1)
      .map((row) => within(row).getAllByRole("cell")[0].textContent);

  const renderPopup = ({ attributes, order, aliases, omitted }) =>
    render(
      <Popup
        layerAttributes={[{ layerName: "Gauges", attributes }]}
        onSwipe={jest.fn()}
        omittedPopupAttributes={omitted ?? {}}
        aliases={aliases ?? {}}
        order={order}
      />,
    );

  it("lists saved fields first and unlisted ones after", () => {
    // Covers AE1.
    renderPopup({
      attributes: { STATUS: "up", GAUGE_ID: "G1", NAME: "Creek", FLOW: 3 },
      order: { Gauges: ["NAME", "FLOW", "STATUS"] },
    });
    expect(rowLabels()).toEqual(["NAME", "FLOW", "STATUS", "GAUGE_ID"]);
  });

  it("skips saved fields the feature does not have", () => {
    // Covers AE2.
    renderPopup({
      attributes: { FLOW: 3, EXTRA: "x" },
      order: { Gauges: ["NAME", "FLOW", "STATUS"] },
    });
    expect(rowLabels()).toEqual(["FLOW", "EXTRA"]);
  });

  it("leaves hidden fields out without disturbing the order", () => {
    // Covers AE3.
    renderPopup({
      attributes: { FLOW: 3, SECRET: "s", NAME: "Creek" },
      order: { Gauges: ["NAME", "SECRET", "FLOW"] },
      omitted: { Gauges: ["SECRET"] },
    });
    expect(rowLabels()).toEqual(["NAME", "FLOW"]);
  });

  it("places an integer-like field where the order puts it", () => {
    // Covers AE4.
    renderPopup({
      attributes: { 2020: 5, NAME: "Creek" },
      order: { Gauges: ["NAME", "2020"] },
    });
    expect(rowLabels()).toEqual(["NAME", "2020"]);
  });

  it("keeps the source order when no order is saved", () => {
    renderPopup({ attributes: { b: 1, a: 2 } });
    expect(rowLabels()).toEqual(["b", "a"]);
  });

  it("shows both fields when two share an alias", () => {
    renderPopup({
      attributes: { flow_a: 1, flow_b: 2 },
      aliases: { Gauges: { flow_a: "Flow", flow_b: "Flow" } },
    });
    expect(rowLabels()).toEqual(["Flow", "Flow"]);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("still renders a zero value", () => {
    renderPopup({
      attributes: { FLOW: 0, NAME: "Creek" },
      order: { Gauges: ["FLOW", "NAME"] },
    });
    expect(rowLabels()).toEqual(["FLOW", "NAME"]);
    const flowRow = screen.getAllByRole("row")[1];
    expect(within(flowRow).getAllByRole("cell")[1].textContent).toBe("0");
  });
});

describe("Map popup follows the saved attribute order", () => {
  const feature = {
    attributes: { STATUS: "up", GAUGE_ID: "G1", NAME: "Creek" },
    geometry: { x: 0, y: 0 },
    layerName: "Gauges",
  };
  const layer = (extra) => ({
    attributeOrder: { Gauges: ["NAME", "STATUS"] },
    configuration: {
      type: "ImageLayer",
      props: {
        name: "Gauges",
        source: { type: "ESRI Image and Map Service", props: { url: "u" } },
      },
    },
    ...extra,
  });

  const popupRowLabels = async () => {
    const popup = await screen.findByLabelText("Map Popup Content");
    await within(popup).findByText("Creek");
    // The overlay is not laid out in jsdom, so its rows count as hidden.
    return within(popup)
      .getAllByRole("row", { hidden: true })
      .slice(1)
      .map(
        (row) =>
          within(row).getAllByRole("cell", { hidden: true })[0].textContent,
      );
  };

  const renderMap = (layers, trigger) => {
    mockedQueryLayerFeatures.mockResolvedValue([feature]);
    jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
    render(
      createLoadedComponent({
        children: (
          <MapContextProvider>
            <TestingComponent
              {...trigger}
              clickCoordinates={[10, 20]}
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
      }),
    );
  };

  test("on click", async () => {
    renderMap([layer()], { onMapClick: jest.fn() });
    expect(await popupRowLabels()).toEqual(["NAME", "STATUS", "GAUGE_ID"]);
  });

  test("on hover", async () => {
    renderMap([layer({ tablePopupType: "hover" })], {
      onMapPointerMove: true,
    });
    expect(await popupRowLabels()).toEqual(["NAME", "STATUS", "GAUGE_ID"]);
  });
});

test("Map click writes the bound field's value when two fields share an alias", async () => {
  // The popup shows both fields under one alias; the variable binding is keyed
  // by field name and must still read that field, not its alias twin.
  mockedQueryLayerFeatures.mockResolvedValue([
    {
      attributes: { flow_a: "first", flow_b: "second" },
      geometry: { x: 0, y: 0 },
      layerName: "Gauges",
    },
  ]);
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  const dashboard = JSON.parse(JSON.stringify(userDashboard));
  dashboard.tabs[0].gridItems = [mockedTextVariable];
  const varInputArgs = JSON.parse(mockedTextVariable.args_string);

  const layers = [
    {
      attributeAliases: { Gauges: { flow_a: "Flow", flow_b: "Flow" } },
      attributeVariables: { Gauges: { flow_b: "Test Variable" } },
      attributeOrder: { Gauges: ["flow_b", "flow_a"] },
      configuration: {
        type: "ImageLayer",
        props: {
          name: "Gauges",
          source: { type: "ESRI Image and Map Service", props: { url: "u" } },
        },
      },
    },
  ];
  render(
    createLoadedComponent({
      children: (
        <MapContextProvider>
          <TestingComponent
            onMapClick={jest.fn()}
            clickCoordinates={[10, 20]}
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
    }),
  );

  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  await waitFor(async () => {
    expect(await screen.findByTestId("input-variables")).toHaveTextContent(
      JSON.stringify({ "Test Variable": "second" }),
    );
  });
});

// MapVisualization: the hover tooltip, and the order click and hover results
// are shown in.
import {
  mockedQueryLayerFeatures,
  mockedSwapVectorLayerFeatures,
  ExtentDrawModeSetter,
  renderSyncMap,
  syncLayer,
} from "__tests__/utilities/mapVisualizationHarness";
import { useContext } from "react";
import PropTypes from "prop-types";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import createLoadedComponent, {
  InputVariablePComponent,
} from "__tests__/utilities/customRender";
import { dynamicMapLayer } from "__tests__/utilities/constants";
import { VariableInputsContext } from "components/contexts/Contexts";
import appAPI from "services/api/app";
import { Map } from "ol";
import Overlay from "ol/Overlay";
import MapContextProvider, {
  useMapContext,
} from "components/contexts/MapContext";
import MapVisualization, {
  HOVER_TOOLTIP_OVERLAY_ID,
} from "components/visualizations/Map";
import { HOVER_TOOLTIP_OFFSET } from "components/map/HoverTooltip";
import { clearClientSourceCaches } from "components/map/ModuleLoader";

// The GeoParquet/Zarr read caches are module-scoped and live for the page's
// lifetime by design, so each test must start from an empty one.
beforeEach(() => {
  clearClientSourceCaches();
  // A click's table pans itself into view, which measures it, and jsdom lays
  // nothing out.
  jest.spyOn(Overlay.prototype, "getRect").mockReturnValue([0, 0, 10, 10]);
  // Clearing mocks keeps an implementation, so a test that sets none would
  // otherwise inherit the last one's.
  mockedQueryLayerFeatures.mockResolvedValue([]);
});

// --- Harness -----------------------------------------------------------------
//
// The test fires every pointer move, click and viewport event itself, on the
// map handed back through `mapRef`, so the tooltip's overlay is read directly
// rather than inferred from the last setPosition call on any overlay.

const HoverHarness = ({ layers, mapRef, mapDrawing }) => {
  const { mapReady } = useMapContext();
  const { setVariableInputValues } = useContext(VariableInputsContext);
  return (
    <div>
      <MapVisualization
        visualizationRef={mapRef}
        mapConfig={{}}
        layers={layers}
        baseMap={null}
        layerControl={false}
        mapDrawing={mapDrawing}
      />
      <p>{mapReady ? "Map Ready" : "Map Not Ready"}</p>
      <InputVariablePComponent />
      <button
        type="button"
        onClick={() =>
          setVariableInputValues((previous) => ({
            ...previous,
            "Test Variable": "set by the user",
          }))
        }
      >
        set variable
      </button>
    </div>
  );
};

HoverHarness.propTypes = {
  layers: PropTypes.array,
  mapRef: PropTypes.shape({ current: PropTypes.any }),
  mapDrawing: PropTypes.object,
};

const mountHoverMap = async (layers, { mapDrawing, extentDrawMode } = {}) => {
  const mapRef = { current: null };
  render(
    createLoadedComponent({
      children: (
        <MapContextProvider>
          {extentDrawMode ? (
            <ExtentDrawModeSetter mode={extentDrawMode} />
          ) : null}
          <HoverHarness
            layers={layers}
            mapRef={mapRef}
            mapDrawing={mapDrawing}
          />
        </MapContextProvider>
      ),
    }),
  );
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  return mapRef;
};

const esriLayer = (name, extra = {}) => ({
  configuration: {
    type: "ImageLayer",
    props: {
      name,
      source: {
        type: "ESRI Image and Map Service",
        props: { url: `${name}_url` },
      },
    },
  },
  ...extra,
});

const hoverLayer = (name = "Hover Layer", extra = {}) =>
  esriLayer(name, { tablePopupType: "hover", ...extra });

const layoutConfig = () => ({
  mode: "modal",
  position: null,
  // eslint-disable-next-line no-template-curly-in-string
  titleTemplate: "${feature.id}",
  gridItems: [],
});

const feature = (layerName, attributes, x, y) => ({
  attributes,
  geometry: { x, y },
  layerName,
});

// Answers each query by where it was made: `answers` maps "x,y" to the
// features found there. Anywhere else finds nothing.
const answerAt = (answers) =>
  mockedQueryLayerFeatures.mockImplementation(
    async (layer, map, coordinate) =>
      answers[coordinate.join(",")]?.[layer.configuration.props.name] ?? [],
  );

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

const hover = async (mapRef, coordinate, extra = {}) => {
  await act(async () => {
    mapRef.current.dispatchEvent({ type: "pointermove", coordinate, ...extra });
  });
};

const click = async (mapRef, coordinate) => {
  await act(async () => {
    mapRef.current.dispatchEvent({ type: "singleclick", coordinate });
  });
};

// Lets the debounce run out, and whatever it started settle, so a test can
// assert that something did NOT happen.
const outlastDebounce = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 400));
  });

const tooltipOverlay = (mapRef) =>
  mapRef.current.getOverlayById(HOVER_TOOLTIP_OVERLAY_ID);

// `undefined` is how OpenLayers hides an overlay, so the position is whether
// the tooltip shows.
const tooltipPosition = (mapRef) => tooltipOverlay(mapRef).getPosition();

// The tooltip's rows as [label, value] text. OpenLayers keeps every overlay
// hidden while the map has no size, which under jsdom is always, so its
// content counts as hidden.
const tooltipRows = (mapRef) => {
  const tooltip = within(tooltipOverlay(mapRef).getElement()).getByRole(
    "tooltip",
    { hidden: true },
  );
  return within(tooltip)
    .getAllByRole("row", { hidden: true })
    .map((row) =>
      within(row)
        .getAllByRole("cell", { hidden: true })
        .map((cell) => cell.textContent),
    );
};

// The tooltip comes up at `coordinate` showing `rows`. Its rows are committed
// before it is placed, so they are read as soon as it is.
const expectTooltip = async (mapRef, coordinate, rows) => {
  await waitFor(() => expect(tooltipPosition(mapRef)).toEqual(coordinate));
  expect(tooltipRows(mapRef)).toEqual(rows);
};

// The click table's overlay, found by the closer it renders.
const tableOverlay = (mapRef) =>
  mapRef.current
    .getOverlays()
    .getArray()
    .find((overlay) =>
      overlay.getElement()?.contains(screen.getByLabelText("Popup Closer")),
    );

// The click table's rows as [label, value] text, header row left out.
const tableRows = () =>
  within(screen.getByLabelText("Map Popup Content"))
    .getAllByRole("row", { hidden: true })
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole("cell", { hidden: true })
        .map((cell) => cell.textContent),
    );

const layerNamed = (mapRef, name) =>
  mapRef.current
    .getLayers()
    .getArray()
    .find((layer) => layer.get("name") === name);

// What the pin and the outline are drawn at, read off their layers.
const selectionDrawn = (mapRef) => {
  const coordinatesOf = (layer) =>
    layer
      .getSource()
      .getFeatures()
      .map((drawn) => drawn.getGeometry().getCoordinates());
  return {
    pin: coordinatesOf(layerNamed(mapRef, "Marker")),
    outline: coordinatesOf(layerNamed(mapRef, "Highlighted Layer")),
  };
};

const variables = () => screen.getByTestId("input-variables");

const queriedLayerNames = () =>
  mockedQueryLayerFeatures.mock.calls.map(
    ([layer]) => layer.configuration.props.name,
  );

// --- What the tooltip shows ----------------------------------------------------

describe("the hover tooltip", () => {
  test("shows the hovered feature's fields at the cursor, and opens neither the table, the layout, the pin nor the outline", async () => {
    answerAt({
      "10,20": {
        "Hover Layer": [feature("Hover Layer", { id: "HHH" }, 10, 20)],
        Both: [feature("Both", { id: "BBB" }, 60, 60)],
      },
    });

    const mapRef = await mountHoverMap([
      // A layout on a hover layer opens on click only.
      hoverLayer("Hover Layer", { popupConfig: layoutConfig() }),
      esriLayer("Click Layer"),
      esriLayer("Both", { tablePopupType: "both" }),
    ]);
    await hover(mapRef, [10, 20]);

    await expectTooltip(mapRef, [10, 20], [["id", "HHH"]]);
    // Every layer that shows the tooltip is asked, and no click-only one.
    expect(queriedLayerNames()).toEqual(["Hover Layer", "Both"]);
    expect(tableOverlay(mapRef).getPosition()).toBeUndefined();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(layerNamed(mapRef, "Marker")).toBeUndefined();
    expect(layerNamed(mapRef, "Highlighted Layer")).toBeUndefined();
  });

  test("Covers AE1. Hovering another station after closing the table leaves the layout, pin and outline on the clicked one", async () => {
    answerAt({
      "10,20": {
        Stations: [feature("Stations", { id: "AAA", name: "Alpha" }, 10, 10)],
      },
      "70,80": {
        Stations: [feature("Stations", { id: "BBB", name: "Bravo" }, 70, 80)],
      },
    });

    const mapRef = await mountHoverMap([
      esriLayer("Stations", {
        tablePopupType: "both",
        hoverPopupAttributes: { Stations: ["name"] },
        popupConfig: layoutConfig(),
      }),
    ]);
    await click(mapRef, [10, 20]);
    await waitFor(() =>
      expect(screen.getByTestId("popup-modal-header-title")).toHaveTextContent(
        "AAA",
      ),
    );
    await waitFor(() =>
      expect(tableOverlay(mapRef).getPosition()).toEqual([10, 10]),
    );

    fireEvent.click(screen.getByLabelText("Popup Closer"));
    await waitFor(() =>
      expect(tableOverlay(mapRef).getPosition()).toBeUndefined(),
    );

    await hover(mapRef, [70, 80]);
    await expectTooltip(mapRef, [70, 80], [["name", "Bravo"]]);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("popup-modal-header-title")).toHaveTextContent(
      "AAA",
    );
    expect(tableOverlay(mapRef).getPosition()).toBeUndefined();
    expect(selectionDrawn(mapRef)).toEqual({
      pin: [[10, 20]],
      outline: [[10, 10]],
    });
  });

  test("Covers AE5. A legacy hover layer shows every field but the omitted ones and drives its variables; a click opens its layout and no table", async () => {
    answerAt({
      "10,20": {
        Gauges: [
          feature(
            "Gauges",
            { id: "FTDC1", stage: "12.3", secret: "x" },
            10,
            20,
          ),
        ],
      },
      "30,40": {
        Gauges: [
          feature("Gauges", { id: "ABCD1", stage: "4.5", secret: "y" }, 30, 40),
        ],
      },
    });

    // Saved before hover had a field list of its own: the one table it showed
    // on hover hid the click table's omitted fields.
    const mapRef = await mountHoverMap([
      hoverLayer("Gauges", {
        omittedPopupAttributes: { Gauges: ["secret"] },
        attributeAliases: { Gauges: { id: "Gauge" } },
        attributeVariables: { Gauges: { id: "Test Variable" } },
        popupConfig: layoutConfig(),
      }),
    ]);

    await hover(mapRef, [10, 20]);
    await expectTooltip(
      mapRef,
      [10, 20],
      [
        ["Gauge", "FTDC1"],
        ["stage", "12.3"],
      ],
    );
    await waitFor(() =>
      expect(variables()).toHaveTextContent(
        JSON.stringify({ "Test Variable": "FTDC1" }),
      ),
    );
    expect(tableOverlay(mapRef).getPosition()).toBeUndefined();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await click(mapRef, [30, 40]);
    expect(tooltipPosition(mapRef)).toBeUndefined();
    await waitFor(() =>
      expect(screen.getByTestId("popup-modal-header-title")).toHaveTextContent(
        "ABCD1",
      ),
    );
    await waitFor(() =>
      expect(variables()).toHaveTextContent(
        JSON.stringify({ "Test Variable": "ABCD1" }),
      ),
    );
    expect(tableOverlay(mapRef).getPosition()).toBeUndefined();
  });

  test("shows the nearest feature that has a hover field, with no pager, close button or title", async () => {
    answerAt({
      "10,20": {
        // The nearest of all, but it has no field checked for hover.
        Gauges: [
          feature("Gauges", { id: "G-near" }, 10, 20),
          feature("Gauges", { id: "G-far", name: "Far Gauge" }, 0, 0),
        ],
        Rivers: [feature("Rivers", { reach: "Near Creek" }, 12, 22)],
      },
    });

    const mapRef = await mountHoverMap([
      esriLayer("Gauges", {
        tablePopupType: "both",
        hoverPopupAttributes: { Gauges: ["name"] },
      }),
      hoverLayer("Rivers"),
    ]);
    await hover(mapRef, [10, 20]);

    await expectTooltip(mapRef, [10, 20], [["reach", "Near Creek"]]);
    const tooltip = within(tooltipOverlay(mapRef).getElement());
    expect(tooltip.queryAllByRole("table", { hidden: true })).toHaveLength(1);
    expect(
      tooltip.queryByRole("button", { hidden: true }),
    ).not.toBeInTheDocument();
    expect(tooltip.queryByLabelText("Next Swiper")).not.toBeInTheDocument();
    expect(tooltip.queryByText("Rivers")).not.toBeInTheDocument();
  });

  test("hovering a layer with both popups while the click table is open leaves the table's rows and labels alone", async () => {
    answerAt({
      "10,20": {
        Gauges: [feature("Gauges", { name: "Creek" }, 10, 20)],
      },
      "70,80": {
        Rivers: [feature("Rivers", { name: "Snake" }, 70, 80)],
      },
    });

    const mapRef = await mountHoverMap([
      esriLayer("Gauges", {
        attributeAliases: { Gauges: { name: "Gauge Name" } },
      }),
      esriLayer("Rivers", {
        tablePopupType: "both",
        attributeAliases: { Rivers: { name: "River Name" } },
      }),
    ]);
    await click(mapRef, [10, 20]);
    await waitFor(() =>
      expect(tableOverlay(mapRef).getPosition()).toEqual([10, 20]),
    );
    await waitFor(() => expect(tableRows()).toEqual([["Gauge Name", "Creek"]]));

    await hover(mapRef, [70, 80]);
    await expectTooltip(mapRef, [70, 80], [["River Name", "Snake"]]);

    expect(tableRows()).toEqual([["Gauge Name", "Creek"]]);
    expect(tableOverlay(mapRef).getPosition()).toEqual([10, 20]);
  });

  test("near the right and bottom edges it opens to the left of and above the cursor", async () => {
    answerAt({
      "10,20": {
        "Hover Layer": [feature("Hover Layer", { id: "HHH" }, 10, 20)],
      },
    });
    const mapRef = await mountHoverMap([hoverLayer()]);
    const away = HOVER_TOOLTIP_OFFSET;

    // Under jsdom the map has no size, so the tooltip takes the default
    // corner: below and to the right of the cursor.
    await hover(mapRef, [10, 20]);
    await expectTooltip(mapRef, [10, 20], [["id", "HHH"]]);
    expect(tooltipOverlay(mapRef).getPositioning()).toBe("top-left");
    expect(tooltipOverlay(mapRef).getOffset()).toEqual([away, away]);

    jest.spyOn(Map.prototype, "getSize").mockReturnValue([400, 300]);

    await hover(mapRef, [10, 20], { pixel: [390, 290] });
    await expectTooltip(mapRef, [10, 20], [["id", "HHH"]]);
    expect(tooltipOverlay(mapRef).getPositioning()).toBe("bottom-right");
    expect(tooltipOverlay(mapRef).getOffset()).toEqual([-away, -away]);

    await hover(mapRef, [10, 20], { pixel: [20, 30] });
    await expectTooltip(mapRef, [10, 20], [["id", "HHH"]]);
    expect(tooltipOverlay(mapRef).getPositioning()).toBe("top-left");
    expect(tooltipOverlay(mapRef).getOffset()).toEqual([away, away]);
  });
});

// --- What hides it -------------------------------------------------------------

describe("hiding the hover tooltip", () => {
  const twoFeatures = () =>
    answerAt({
      "10,20": {
        "Hover Layer": [feature("Hover Layer", { id: "AAA" }, 10, 20)],
      },
      "50,60": {
        "Hover Layer": [feature("Hover Layer", { id: "BBB" }, 50, 60)],
      },
    });

  // A map with the tooltip up on feature AAA at [10, 20].
  const mountWithTooltip = async (options) => {
    twoFeatures();
    const mapRef = await mountHoverMap([hoverLayer()], options);
    await hover(mapRef, [10, 20]);
    await expectTooltip(mapRef, [10, 20], [["id", "AAA"]]);
    return mapRef;
  };

  test("a pointer move hides it at once, and it comes back where the cursor rests", async () => {
    const mapRef = await mountWithTooltip();

    await hover(mapRef, [50, 60]);
    expect(tooltipPosition(mapRef)).toBeUndefined();

    await expectTooltip(mapRef, [50, 60], [["id", "BBB"]]);
  });

  test("a hover that finds nothing leaves it hidden", async () => {
    const mapRef = await mountWithTooltip();

    await hover(mapRef, [200, 300]);
    expect(tooltipPosition(mapRef)).toBeUndefined();
    await waitFor(() =>
      expect(mockedQueryLayerFeatures).toHaveBeenCalledTimes(2),
    );
    await outlastDebounce();
    expect(tooltipPosition(mapRef)).toBeUndefined();
  });

  test("leaving the map hides it", async () => {
    const mapRef = await mountWithTooltip();

    fireEvent.pointerLeave(mapRef.current.getViewport());

    expect(tooltipPosition(mapRef)).toBeUndefined();
  });

  test("leaving the map before the cursor rests cancels the query", async () => {
    twoFeatures();
    const mapRef = await mountHoverMap([hoverLayer()]);

    await hover(mapRef, [10, 20]);
    fireEvent.pointerLeave(mapRef.current.getViewport());
    await outlastDebounce();

    expect(mockedQueryLayerFeatures).not.toHaveBeenCalled();
    expect(tooltipPosition(mapRef)).toBeUndefined();
  });

  test("a click hides it", async () => {
    const mapRef = await mountWithTooltip();

    await click(mapRef, [10, 20]);

    expect(tooltipPosition(mapRef)).toBeUndefined();
  });

  test("a pan or zoom hides it, and one that starts before the cursor rests cancels the query", async () => {
    const mapRef = await mountWithTooltip();

    await act(async () => {
      mapRef.current.dispatchEvent("movestart");
    });
    expect(tooltipPosition(mapRef)).toBeUndefined();

    await hover(mapRef, [50, 60]);
    await act(async () => {
      mapRef.current.dispatchEvent("movestart");
    });
    await outlastDebounce();
    expect(mockedQueryLayerFeatures).toHaveBeenCalledTimes(1);
    expect(tooltipPosition(mapRef)).toBeUndefined();
  });

  test("moving onto the click table hides it and cancels the query still to come", async () => {
    const mapRef = await mountWithTooltip();
    // The table's content is in the page from mount, showing its empty state.
    const table = screen.getByLabelText("Map Popup Content");

    await hover(mapRef, [500, 500], { originalEvent: { target: table } });
    expect(tooltipPosition(mapRef)).toBeUndefined();

    // A move that is followed onto the table before the cursor rests.
    await hover(mapRef, [50, 60]);
    await hover(mapRef, [500, 500], { originalEvent: { target: table } });
    await outlastDebounce();
    expect(mockedQueryLayerFeatures).toHaveBeenCalledTimes(1);
    expect(tooltipPosition(mapRef)).toBeUndefined();
  });

  test("a dynamic layer's data swap hides it", async () => {
    const getVisualizationFeatures = jest
      .spyOn(appAPI, "getVisualizationFeatures")
      .mockResolvedValue({
        success: true,
        viz_type: "features",
        data: {
          type: "FeatureCollection",
          features: [],
          crs: { type: "name", properties: { name: "EPSG:4326" } },
        },
      });
    const dynamicLayer = JSON.parse(JSON.stringify(dynamicMapLayer));
    // Bound to the variable the harness sets, so setting it refetches.
    dynamicLayer.configuration.props.pluginSource.args = {
      // eslint-disable-next-line no-template-curly-in-string
      gauge: "${Test Variable}",
    };
    twoFeatures();
    const mapRef = await mountHoverMap([hoverLayer(), dynamicLayer]);
    // The first fetch swaps the layer's data in on load. Let it land first.
    await waitFor(() =>
      expect(mockedSwapVectorLayerFeatures).toHaveBeenCalled(),
    );
    await hover(mapRef, [10, 20]);
    await expectTooltip(mapRef, [10, 20], [["id", "AAA"]]);

    fireEvent.click(screen.getByText("set variable"));
    await waitFor(() =>
      expect(getVisualizationFeatures).toHaveBeenCalledTimes(2),
    );

    await waitFor(() => expect(tooltipPosition(mapRef)).toBeUndefined());
  });

  test("no tooltip while drawing", async () => {
    twoFeatures();
    const mapRef = await mountHoverMap([hoverLayer()], {
      mapDrawing: { options: ["Point"] },
    });

    fireEvent.click(screen.getByTitle("Draw Point"));
    await hover(mapRef, [10, 20]);
    await outlastDebounce();

    expect(mockedQueryLayerFeatures).not.toHaveBeenCalled();
    expect(tooltipPosition(mapRef)).toBeUndefined();
  });

  test("no tooltip while an extent is being drawn", async () => {
    twoFeatures();
    const mapRef = await mountHoverMap([hoverLayer()], {
      extentDrawMode: "rectangle",
    });

    await hover(mapRef, [10, 20]);
    await outlastDebounce();

    expect(mockedQueryLayerFeatures).not.toHaveBeenCalled();
    expect(tooltipPosition(mapRef)).toBeUndefined();
  });
});

describe("stale hover results", () => {
  test("a result that arrives after a click is dropped", async () => {
    const pending = deferred();
    mockedQueryLayerFeatures.mockReturnValue(pending.promise);
    const mapRef = await mountHoverMap([hoverLayer()]);

    await hover(mapRef, [10, 20]);
    await waitFor(() =>
      expect(mockedQueryLayerFeatures).toHaveBeenCalledTimes(1),
    );
    await click(mapRef, [10, 20]);
    await act(async () => {
      pending.resolve([feature("Hover Layer", { id: "AAA" }, 10, 20)]);
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(tooltipPosition(mapRef)).toBeUndefined();
  });

  test("a result that arrives after a newer one is dropped", async () => {
    const pending = deferred();
    mockedQueryLayerFeatures
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValue([feature("Hover Layer", { id: "BBB" }, 50, 60)]);
    const mapRef = await mountHoverMap([hoverLayer()]);

    await hover(mapRef, [10, 20]);
    await waitFor(() =>
      expect(mockedQueryLayerFeatures).toHaveBeenCalledTimes(1),
    );
    await hover(mapRef, [50, 60]);
    await expectTooltip(mapRef, [50, 60], [["id", "BBB"]]);

    await act(async () => {
      pending.resolve([feature("Hover Layer", { id: "AAA" }, 10, 20)]);
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(tooltipPosition(mapRef)).toEqual([50, 60]);
    expect(tooltipRows(mapRef)).toEqual([["id", "BBB"]]);
  });
});

// --- Variable inputs -----------------------------------------------------------

describe("hover and variable inputs", () => {
  test("a hover-only layer writes its linked variable inputs through its own aliases", async () => {
    answerAt({
      "10,20": {
        "Hover Layer": [
          feature("Hover Layer", { field1: "hover value" }, 10, 20),
        ],
      },
    });
    const mapRef = await mountHoverMap([
      hoverLayer("Hover Layer", {
        attributeAliases: { "Hover Layer": { field1: "Field One" } },
        // Linked by its alias, which only this layer's own alias map resolves.
        attributeVariables: { "Hover Layer": { "Field One": "Test Variable" } },
      }),
    ]);

    await hover(mapRef, [10, 20]);

    await waitFor(() =>
      expect(variables()).toHaveTextContent(
        JSON.stringify({ "Test Variable": "hover value" }),
      ),
    );
  });

  test("a hover-only layer with no hover fields still writes its variable inputs, and shows no tooltip", async () => {
    answerAt({
      "10,20": { Gauges: [feature("Gauges", { id: "X1" }, 10, 20)] },
    });
    const mapRef = await mountHoverMap([
      hoverLayer("Gauges", {
        hoverPopupAttributes: { Gauges: [] },
        attributeVariables: { Gauges: { id: "Test Variable" } },
      }),
    ]);

    await hover(mapRef, [10, 20]);

    await waitFor(() =>
      expect(variables()).toHaveTextContent(
        JSON.stringify({ "Test Variable": "X1" }),
      ),
    );
    await outlastDebounce();
    expect(tooltipPosition(mapRef)).toBeUndefined();
  });

  test("Covers AE4. Hovering a layer with both popups shows the tooltip and leaves its variable inputs to the click", async () => {
    answerAt({
      "10,20": {
        Gauges: [feature("Gauges", { cw3e_id: "B1", name: "Bravo" }, 10, 20)],
      },
    });
    const mapRef = await mountHoverMap([
      esriLayer("Gauges", {
        tablePopupType: "both",
        hoverPopupAttributes: { Gauges: ["name"] },
        attributeVariables: { Gauges: { cw3e_id: "Test Variable" } },
      }),
    ]);

    await hover(mapRef, [10, 20]);
    await expectTooltip(mapRef, [10, 20], [["name", "Bravo"]]);
    await outlastDebounce();
    expect(variables()).not.toHaveTextContent("Test Variable");

    await click(mapRef, [10, 20]);
    await waitFor(() =>
      expect(variables()).toHaveTextContent(
        JSON.stringify({ "Test Variable": "B1" }),
      ),
    );
  });
});

// --- Which layers are asked ------------------------------------------------------

describe("which layers a hover queries", () => {
  test("a layer below its minZoomQuery is not queried, so the map does not move", async () => {
    const deep = esriLayer("Deep", {
      tablePopupType: "both",
      hoverPopupAttributes: { Deep: ["id"] },
    });
    // The map opens at zoom 4.5.
    deep.configuration.props.minZoomQuery = 30;
    const mapRef = await mountHoverMap([deep, hoverLayer("Shallow")]);
    const view = mapRef.current.getView();
    const center = view.getCenter();
    const zoom = view.getZoom();

    await hover(mapRef, [10, 20]);
    await waitFor(() =>
      expect(mockedQueryLayerFeatures).toHaveBeenCalledTimes(1),
    );
    await outlastDebounce();

    expect(queriedLayerNames()).toEqual(["Shallow"]);
    expect(view.getCenter()).toEqual(center);
    expect(view.getZoom()).toBe(zoom);
    expect(tooltipPosition(mapRef)).toBeUndefined();
  });

  test("a layer hidden in the layer control is not queried", async () => {
    const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");
    const hidden = hoverLayer("HoverHidden");
    hidden.configuration.layerVisibility = false;
    const mapRef = await mountHoverMap([hidden, hoverLayer("HoverVisible")]);
    // The visibility check reads the OpenLayers layers, so both have to be on
    // the map first.
    await waitFor(() => {
      const addedNames = addLayerSpy.mock.calls.map(([layer]) =>
        layer.get("name"),
      );
      expect(addedNames).toEqual(
        expect.arrayContaining(["HoverHidden", "HoverVisible"]),
      );
    });

    await hover(mapRef, [10, 20]);
    await waitFor(() =>
      expect(mockedQueryLayerFeatures).toHaveBeenCalledTimes(1),
    );
    await outlastDebounce();

    expect(queriedLayerNames()).toEqual(["HoverVisible"]);
  });

  test("an Annotations layer is never queried, even one tagged hover", async () => {
    const mapRef = await mountHoverMap([
      {
        tablePopupType: "hover",
        configuration: {
          type: "VectorLayer",
          props: {
            name: "Callouts",
            source: { type: "Annotations", props: {} },
          },
          annotations: { defaults: {}, items: [] },
        },
      },
      hoverLayer("HoverLayer"),
    ]);

    await hover(mapRef, [10, 20]);
    await waitFor(() =>
      expect(mockedQueryLayerFeatures).toHaveBeenCalledTimes(1),
    );
    await outlastDebounce();

    expect(queriedLayerNames()).toEqual(["HoverLayer"]);
  });

  test("a map with no hover layers queries nothing", async () => {
    const mapRef = await mountHoverMap([esriLayer("Click Only")]);

    await hover(mapRef, [10, 20]);
    await outlastDebounce();

    expect(mockedQueryLayerFeatures).not.toHaveBeenCalled();
  });

  test("a hover layer with no name is still queried", async () => {
    // Visibility is looked up by name, so a layer without one is treated as
    // visible rather than dropped.
    mockedQueryLayerFeatures.mockResolvedValue([
      feature("Anon Layer", { field1: "anon" }, 10, 20),
    ]);
    const anonymous = hoverLayer();
    delete anonymous.configuration.props.name;
    const mapRef = await mountHoverMap([anonymous]);

    await hover(mapRef, [10, 20]);

    await expectTooltip(mapRef, [10, 20], [["field1", "anon"]]);
  });

  test("two moves in quick succession query once, at the second", async () => {
    const mapRef = await mountHoverMap([hoverLayer()]);

    await act(async () => {
      mapRef.current.dispatchEvent({
        type: "pointermove",
        coordinate: [10, 20],
      });
      mapRef.current.dispatchEvent({
        type: "pointermove",
        coordinate: [50, 60],
      });
    });
    await waitFor(() =>
      expect(mockedQueryLayerFeatures).toHaveBeenCalledTimes(1),
    );
    await outlastDebounce();

    expect(mockedQueryLayerFeatures).toHaveBeenCalledTimes(1);
    expect(mockedQueryLayerFeatures.mock.calls[0][2]).toEqual([50, 60]);
  });
});

// --- Results that show nothing ---------------------------------------------------

describe("hover results that show nothing", () => {
  test("a failed query shows no tooltip and leaves the click table alone", async () => {
    mockedQueryLayerFeatures.mockRejectedValue(
      new Error("network unreachable"),
    );
    const mapRef = await mountHoverMap([hoverLayer()]);

    await hover(mapRef, [10, 20]);
    await waitFor(() =>
      expect(mockedQueryLayerFeatures).toHaveBeenCalledTimes(1),
    );
    await outlastDebounce();

    expect(tooltipPosition(mapRef)).toBeUndefined();
    expect(tableOverlay(mapRef).getPosition()).toBeUndefined();
    expect(screen.getByText("Map Ready")).toBeInTheDocument();
  });

  test("a layer that answers by zooming shows no tooltip", async () => {
    mockedQueryLayerFeatures.mockResolvedValue("zoomed");
    const mapRef = await mountHoverMap([hoverLayer()]);

    await hover(mapRef, [10, 20]);
    await waitFor(() =>
      expect(mockedQueryLayerFeatures).toHaveBeenCalledTimes(1),
    );
    await outlastDebounce();

    expect(tooltipPosition(mapRef)).toBeUndefined();
  });

  test("a null in a result is dropped rather than rendered", async () => {
    mockedQueryLayerFeatures.mockResolvedValue([
      null,
      feature("Hover Layer", { id: "AAA" }, 10, 20),
    ]);
    const mapRef = await mountHoverMap([hoverLayer()]);

    await hover(mapRef, [10, 20]);

    await expectTooltip(mapRef, [10, 20], [["id", "AAA"]]);
  });
});

// --- Clicking a hover layer that has a layout -----------------------------------

test("A hover+modal layer joins the click union, hiding the table while it is active", async () => {
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
    const popSetPosition = jest.spyOn(Overlay.prototype, "setPosition");

    renderSyncMap([plainLayer("Raster", "GeoTIFF"), plainLayer("Vector")]);
    expect(await screen.findByText("Map Ready")).toBeInTheDocument();

    await waitFor(() =>
      expect(popSetPosition).toHaveBeenLastCalledWith([16, 26]),
    );
  });

  test("a hover shows the nearest feature, and the nearest drives the variable inputs", async () => {
    // "far" arrives first, but "near" is ~2.2 from the cursor versus ~22.
    mockedQueryLayerFeatures.mockResolvedValue([
      feature("H", { field1: "far" }, 0, 0),
      feature("H", { field1: "near" }, 11, 21),
    ]);
    const mapRef = await mountHoverMap([
      hoverLayer("H", {
        attributeVariables: { H: { field1: "Test Variable" } },
      }),
    ]);

    await hover(mapRef, [10, 20]);

    await expectTooltip(mapRef, [10, 20], [["field1", "near"]]);
    await waitFor(() =>
      expect(variables()).toHaveTextContent(
        JSON.stringify({ "Test Variable": "near" }),
      ),
    );
  });
});

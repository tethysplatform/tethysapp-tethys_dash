import { act } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import DrawInteractions from "components/map/DrawInteractions";
import VectorSource from "ol/source/Vector";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import Polygon from "ol/geom/Polygon";
import { fromLonLat } from "ol/proj";
import Draw from "ol/interaction/Draw";
import Modal from "react-bootstrap/Modal";
import PopupModal from "components/modals/PopupModal/PopupModal";
import { VariableInputsContext } from "components/contexts/Contexts";

// Renders DrawInteractions over a mock map and turns on `tool`. The toolbar
// renders inside the map's element (`mapElement`, the map's target), as it
// does in the app; `parent` holds the map element, as the page, the tile
// editor or a popup would. Returns, among others:
// - `finishShape`: ends a shape the way OpenLayers does, `drawend` first and
//   then the feature joining the source;
// - `written`: the variable values each write leaves, applied in order.
const renderDrawing = async (
  mapDrawing,
  tool = "Point",
  parent = document.body,
) => {
  const interactions = [];
  let layer;
  const mapElement = document.createElement("div");
  parent.appendChild(mapElement);
  const mockMap = {
    addLayer: jest.fn((added) => {
      layer = added;
    }),
    addInteraction: jest.fn((interaction) => interactions.push(interaction)),
    removeInteraction: jest.fn(),
    getView: () => ({ getProjection: () => ({ getCode: () => "EPSG:3857" }) }),
    getTargetElement: () => mapElement,
  };
  const setVariableInputValues = jest.fn();
  const drawing = { current: false };

  const view = render(
    <VariableInputsContext.Provider value={{ setVariableInputValues }}>
      <DrawInteractions
        mapDrawing={mapDrawing}
        visualizationRef={{ current: mockMap }}
        drawing={drawing}
      />
    </VariableInputsContext.Provider>,
    { container: mapElement },
  );
  fireEvent.click(await within(mapElement).findByTitle(`Draw ${tool}`));
  const source = layer.getSource();

  const finishShape = (geometry) => {
    const feature = new Feature({ geometry });
    act(() => {
      interactions.at(-1).dispatchEvent({
        type: "drawend",
        feature,
        target: { getMap: () => mockMap },
      });
    });
    source.addFeature(feature);
  };
  const written = (initial = {}) => {
    let values = initial;
    return setVariableInputValues.mock.calls.map(
      ([update]) => (values = update(values)),
    );
  };

  return {
    ...view,
    drawing,
    finishShape,
    interactions,
    mapElement,
    mockMap,
    setVariableInputValues,
    source,
    written,
  };
};

test("Draw Interactions no options and no render", async () => {
  const mockMap = {
    addLayer: jest.fn(),
    addInteraction: jest.fn(),
    removeInteraction: jest.fn(),
  };

  const visualizationRef = { current: mockMap };
  const drawing = { current: false };

  const { rerender } = render(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <DrawInteractions
        mapDrawing={{}}
        visualizationRef={visualizationRef}
        drawing={drawing}
      />
    </VariableInputsContext.Provider>,
  );

  expect(screen.queryByTitle("Stop Drawing (Esc)")).not.toBeInTheDocument();

  rerender(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <DrawInteractions
        mapDrawing={{ options: [] }}
        visualizationRef={visualizationRef}
        drawing={drawing}
      />
    </VariableInputsContext.Provider>,
  );

  expect(screen.queryByTitle("Stop Drawing (Esc)")).not.toBeInTheDocument();

  rerender(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <DrawInteractions
        mapDrawing={{ options: ["Point"] }}
        visualizationRef={visualizationRef}
        drawing={drawing}
      />
    </VariableInputsContext.Provider>,
  );

  expect(await screen.findByTitle("Stop Drawing (Esc)")).toBeInTheDocument();
});

test("Draw Interactions click draw and then deselect", async () => {
  const mapDrawing = { options: ["Rectangle"], limit: 2 };
  const mockAddInteraction = jest.fn();

  const mockMap = {
    addLayer: jest.fn(),
    addInteraction: mockAddInteraction,
    removeInteraction: jest.fn(),
  };

  const visualizationRef = { current: mockMap };
  const drawing = { current: false };

  render(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <DrawInteractions
        mapDrawing={mapDrawing}
        visualizationRef={visualizationRef}
        drawing={drawing}
      />
    </VariableInputsContext.Provider>,
  );

  // Click the "Draw Point" button to trigger interaction setup
  const drawButton = await screen.findByTitle("Draw Rectangle");
  fireEvent.click(drawButton);

  expect(drawing.current).toBe(true);
  expect(mockAddInteraction).toHaveBeenCalled();

  fireEvent.click(drawButton);

  expect(drawing.current).toBe(false);
});

test("Draw Interactions click draw and then stop", async () => {
  const mapDrawing = { options: ["Point"], limit: 2 };
  const mockAddInteraction = jest.fn();

  const mockMap = {
    addLayer: jest.fn(),
    addInteraction: mockAddInteraction,
    removeInteraction: jest.fn(),
  };

  const visualizationRef = { current: mockMap };
  const drawing = { current: false };

  render(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <DrawInteractions
        mapDrawing={mapDrawing}
        visualizationRef={visualizationRef}
        drawing={drawing}
      />
    </VariableInputsContext.Provider>,
  );

  // Click the "Draw Point" button to trigger interaction setup
  const drawButton = await screen.findByTitle("Draw Point");
  fireEvent.click(drawButton);

  expect(drawing.current).toBe(true);
  expect(mockAddInteraction).toHaveBeenCalled();

  const stopDrawingButton = screen.getByTitle("Stop Drawing (Esc)");
  fireEvent.click(stopDrawingButton);

  expect(drawing.current).toBe(false);
});

test("Draw Interactions clear features", async () => {
  const sourceClear = jest.spyOn(VectorSource.prototype, "clear");

  const mapDrawing = { options: ["Point"], limit: 2 };

  const mockMap = {
    addLayer: jest.fn(),
    addInteraction: jest.fn(),
    removeInteraction: jest.fn(),
  };

  const visualizationRef = { current: mockMap };
  const drawing = { current: false };

  render(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <DrawInteractions
        mapDrawing={mapDrawing}
        visualizationRef={visualizationRef}
        drawing={drawing}
      />
    </VariableInputsContext.Provider>,
  );

  // Click the "Draw Point" button to trigger interaction setup
  fireEvent.click(await screen.findByTitle("Draw Point"));

  const clearFeaturesButton = screen.getByTitle("Clear All Features");
  fireEvent.click(clearFeaturesButton);

  expect(sourceClear).toHaveBeenCalled();
});

test("Draw Interactions drawend", async () => {
  const sourceRemoveFeature = jest.spyOn(
    VectorSource.prototype,
    "removeFeature",
  );

  const addedInteractions = [];
  let interactionLayer;
  const mockMap = {
    addLayer: jest.fn((layer) => {
      interactionLayer = layer;
    }),
    addInteraction: jest.fn((interaction) => {
      addedInteractions.push(interaction); // Capture Draw
    }),
    removeInteraction: jest.fn(),
  };

  const mapDrawing = { options: ["Point"], limit: 1 };
  const visualizationRef = { current: mockMap };
  const drawing = { current: false };
  const mockSetVariableInputValues = jest.fn();

  render(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: mockSetVariableInputValues }}
    >
      <DrawInteractions
        mapDrawing={mapDrawing}
        visualizationRef={visualizationRef}
        drawing={drawing}
      />
    </VariableInputsContext.Provider>,
  );

  // Click the "Draw Point" button to trigger interaction setup
  fireEvent.click(await screen.findByTitle("Draw Point"));

  // Wait for the interaction to be created and added
  expect(addedInteractions.length).toBeGreaterThan(0);
  const drawInteraction = addedInteractions[0];

  let vectorSource = interactionLayer.getSource();

  // Now we can safely dispatch the event
  act(() => {
    drawInteraction.dispatchEvent({
      type: "drawend",
    });
  });

  expect(sourceRemoveFeature).toHaveBeenCalledTimes(0);
  expect(vectorSource.getFeatures().length).toBe(0);

  // add some features for tracking
  const feature = new Feature({
    geometry: new Point(fromLonLat([-123.1, 49.3])), // longitude, latitude
    name: "My Point Feature",
  });
  vectorSource.addFeature(feature);

  expect(vectorSource.getFeatures().length).toBe(1);

  const feature2 = new Feature({
    geometry: new Point(fromLonLat([-123.1, 49.3])), // longitude, latitude
    name: "My Point Feature 2",
  });
  vectorSource.addFeature(feature2);

  expect(vectorSource.getFeatures().length).toBe(2);

  // Now we can safely dispatch the event
  act(() => {
    drawInteraction.dispatchEvent({
      type: "drawend",
    });
  });

  expect(sourceRemoveFeature).toHaveBeenCalledWith(feature);
  expect(vectorSource.getFeatures().length).toBe(1);
  expect(mockSetVariableInputValues).toHaveBeenCalledTimes(0);
});

test("Draw Interactions drawend update variables", async () => {
  const addedInteractions = [];
  const mockMap = {
    addLayer: jest.fn(),
    addInteraction: jest.fn((interaction) => {
      addedInteractions.push(interaction); // Capture Draw
    }),
    removeInteraction: jest.fn(),
    getView: jest.fn(() => ({
      getProjection: jest.fn(() => ({
        getCode: jest.fn(() => 3857),
      })),
    })),
  };

  const mapDrawing = { options: ["Point"], limit: 1, variable: "test" };
  const visualizationRef = { current: mockMap };
  const drawing = { current: false };
  const target = { getMap: jest.fn(() => mockMap) };
  const mockSetVariableInputValues = jest.fn();

  render(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: mockSetVariableInputValues }}
    >
      <DrawInteractions
        mapDrawing={mapDrawing}
        visualizationRef={visualizationRef}
        drawing={drawing}
      />
    </VariableInputsContext.Provider>,
  );

  // Click the "Draw Point" button to trigger interaction setup
  fireEvent.click(await screen.findByTitle("Draw Point"));

  // Wait for the interaction to be created and added
  expect(addedInteractions.length).toBeGreaterThan(0);
  const drawInteraction = addedInteractions[0];

  const feature = new Feature({
    geometry: new Point(fromLonLat([-123.1, 49.3])), // longitude, latitude
    name: "My Point Feature",
  });

  // Now we can safely dispatch the event
  act(() => {
    drawInteraction.dispatchEvent({
      type: "drawend",
      feature,
      target,
    });
  });

  expect(mockSetVariableInputValues).toHaveBeenCalledTimes(1);
  // Get the function passed to setVariableInputValues
  const updaterFn = mockSetVariableInputValues.mock.calls[0][0];
  const result = updaterFn({}); // simulate previousVariableInputValues = {}

  expect(result).toEqual({
    test: {
      projection: 3857,
      geometries: [
        {
          type: "Point",
          coordinates: [-13703429.316651978, 6325919.274572156],
        },
      ],
    },
  });
});

test("Draw Interactions drawend multiple features update variables", async () => {
  const addedInteractions = [];
  let interactionLayer;
  const mockMap = {
    addLayer: jest.fn((layer) => {
      interactionLayer = layer;
    }),
    addInteraction: jest.fn((interaction) => {
      addedInteractions.push(interaction); // Capture Draw
    }),
    removeInteraction: jest.fn(),
    getView: jest.fn(() => ({
      getProjection: jest.fn(() => ({
        getCode: jest.fn(() => 3857),
      })),
    })),
  };

  const mapDrawing = { options: ["Point"], limit: 2, variable: "test" };
  const visualizationRef = { current: mockMap };
  const drawing = { current: false };
  const target = { getMap: jest.fn(() => mockMap) };
  const mockSetVariableInputValues = jest.fn();

  render(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: mockSetVariableInputValues }}
    >
      <DrawInteractions
        mapDrawing={mapDrawing}
        visualizationRef={visualizationRef}
        drawing={drawing}
      />
    </VariableInputsContext.Provider>,
  );

  // Click the "Draw Point" button to trigger interaction setup
  fireEvent.click(await screen.findByTitle("Draw Point"));

  // Wait for the interaction to be created and added
  expect(addedInteractions.length).toBeGreaterThan(0);
  const drawInteraction = addedInteractions[0];

  let vectorSource = interactionLayer.getSource();
  const feature = new Feature({
    geometry: new Point(fromLonLat([-123.1, 49.3])), // longitude, latitude
    name: "My Point Feature",
  });
  vectorSource.addFeature(feature);

  const feature2 = new Feature({
    geometry: new Point(fromLonLat([-123.1, 50])), // longitude, latitude
    name: "My Point Feature 2",
  });

  // Now we can safely dispatch the event
  act(() => {
    drawInteraction.dispatchEvent({
      type: "drawend",
      feature: feature2,
      target,
    });
  });

  expect(mockSetVariableInputValues).toHaveBeenCalledTimes(1);
  // Get the function passed to setVariableInputValues
  const updaterFn = mockSetVariableInputValues.mock.calls[0][0];
  const result = updaterFn({}); // simulate previousVariableInputValues = {}

  expect(result).toEqual({
    test: {
      projection: 3857,
      geometries: [
        {
          type: "Point",
          coordinates: [-13703429.316651978, 6325919.274572156],
        },
        {
          type: "Point",
          coordinates: [-13703429.316651978, 6446275.841017158],
        },
      ],
    },
  });
});

test("Draw Interactions drawend no limit", async () => {
  const addedInteractions = [];
  const mockMap = {
    addLayer: jest.fn(),
    addInteraction: jest.fn((interaction) => {
      addedInteractions.push(interaction); // Capture Draw
    }),
    removeInteraction: jest.fn(),
  };

  const mapDrawing = { options: ["Point"] };
  const visualizationRef = { current: mockMap };
  const drawing = { current: false };

  render(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <DrawInteractions
        mapDrawing={mapDrawing}
        visualizationRef={visualizationRef}
        drawing={drawing}
      />
    </VariableInputsContext.Provider>,
  );

  // Click the "Draw Point" button to trigger interaction setup
  fireEvent.click(await screen.findByTitle("Draw Point"));

  // Wait for the interaction to be created and added
  expect(addedInteractions.length).toBeGreaterThan(0);
  const drawInteraction = addedInteractions[0];

  const hasDrawEndHandler =
    drawInteraction?.ol_uid && // ensure it's an OL object
    drawInteraction?.eventTarget_?.listeners_?.drawend?.length > 0;

  expect(hasDrawEndHandler).toBe(false);
});

test("Draw Interactions update limit and remove existing", async () => {
  const sourceRemoveFeature = jest.spyOn(
    VectorSource.prototype,
    "removeFeature",
  );

  const addedInteractions = [];
  let interactionLayer;
  const mockMap = {
    addLayer: jest.fn((layer) => {
      interactionLayer = layer;
    }),
    addInteraction: jest.fn((interaction) => {
      addedInteractions.push(interaction); // Capture Draw
    }),
    removeInteraction: jest.fn(),
  };

  const mapDrawing = { options: ["Point"], limit: 2 };
  const visualizationRef = { current: mockMap };
  const drawing = { current: false };

  const { rerender } = render(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <DrawInteractions
        mapDrawing={mapDrawing}
        visualizationRef={visualizationRef}
        drawing={drawing}
      />
    </VariableInputsContext.Provider>,
  );

  // Click the "Draw Point" button to trigger interaction setup
  fireEvent.click(await screen.findByTitle("Draw Point"));

  // Wait for the interaction to be created and added
  expect(addedInteractions.length).toBeGreaterThan(0);

  let vectorSource = interactionLayer.getSource();

  // add some features for tracking
  const feature = new Feature({
    geometry: new Point(fromLonLat([-123.1, 49.3])), // longitude, latitude
    name: "My Point Feature",
  });
  vectorSource.addFeature(feature);

  const feature2 = new Feature({
    geometry: new Point(fromLonLat([-123.1, 49.3])), // longitude, latitude
    name: "My Point Feature 2",
  });
  vectorSource.addFeature(feature2);

  expect(vectorSource.getFeatures().length).toBe(2);

  const newMapDrawing = { options: ["Point"], limit: 1 };
  rerender(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <DrawInteractions
        mapDrawing={newMapDrawing}
        visualizationRef={visualizationRef}
        drawing={drawing}
      />
    </VariableInputsContext.Provider>,
  );

  expect(sourceRemoveFeature).toHaveBeenCalledWith(feature);
  expect(vectorSource.getFeatures().length).toBe(1);
});

describe("the drawing variable follows the shapes on the map", () => {
  const point = (x) => new Point([x, 0]);
  const xsOf = (values) =>
    values.area.geometries.map(({ coordinates }) => coordinates[0]);

  test("with no limit, each shape writes every shape drawn so far", async () => {
    const { finishShape, written } = await renderDrawing({
      options: ["Point"],
      variable: "area",
    });

    finishShape(point(1));
    finishShape(point(2));

    expect(written().map(xsOf)).toEqual([[1], [1, 2]]);
  });

  test("with a limit of 2, the first shape is written alone and the oldest gives way", async () => {
    const { finishShape, written } = await renderDrawing({
      options: ["Point"],
      limit: 2,
      variable: "area",
    });

    finishShape(point(1));
    finishShape(point(2));
    finishShape(point(3));

    expect(written().map(xsOf)).toEqual([[1], [1, 2], [2, 3]]);
  });

  test("with a limit of 1, each shape replaces the last", async () => {
    const { finishShape, written } = await renderDrawing({
      options: ["Point"],
      limit: 1,
      variable: "area",
    });

    finishShape(point(1));
    finishShape(point(2));

    expect(written().map(xsOf)).toEqual([[1], [2]]);
  });

  test("writes each shape's geometry with the map's projection", async () => {
    const ring = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 0],
    ];
    const { finishShape, written } = await renderDrawing(
      { options: ["Polygon"], variable: "area" },
      "Polygon",
    );

    finishShape(new Polygon([ring]));

    expect(written()).toEqual([
      {
        area: {
          projection: "EPSG:3857",
          geometries: [{ type: "Polygon", coordinates: [ring] }],
        },
      },
    ]);
  });

  test("with a limit and no variable, shapes are trimmed and nothing is written", async () => {
    const { finishShape, source, setVariableInputValues } = await renderDrawing(
      { options: ["Point"], limit: 1 },
    );

    finishShape(point(1));
    finishShape(point(2));

    expect(
      source.getFeatures().map((f) => f.getGeometry().getCoordinates()[0]),
    ).toEqual([2]);
    expect(setVariableInputValues).not.toHaveBeenCalled();
  });

  test("Clear All Features empties the variable and keeps every other", async () => {
    const { finishShape, source, setVariableInputValues } = await renderDrawing(
      { options: ["Point"], variable: "area" },
    );
    finishShape(point(1));

    fireEvent.click(screen.getByTitle("Clear All Features"));

    expect(source.getFeatures()).toEqual([]);
    const clear = setVariableInputValues.mock.calls.at(-1)[0];
    expect(clear({ area: { geometries: [] }, network: "W" })).toEqual({
      network: "W",
    });
    const withoutArea = { network: "W" };
    expect(clear(withoutArea)).toBe(withoutArea);
  });

  test("Clear All Features writes nothing for a map with no variable", async () => {
    const { setVariableInputValues } = await renderDrawing({
      options: ["Point"],
    });

    fireEvent.click(screen.getByTitle("Clear All Features"));

    expect(setVariableInputValues).not.toHaveBeenCalled();
  });
});

describe("Escape stops drawing", () => {
  const POPUP_POSITION = {
    leftPct: 20,
    topPct: 25,
    widthPct: 60,
    heightPct: 50,
  };
  // As a browser sends it: react-bootstrap's Modal reads `code`/`keyCode`.
  const escapeOn = (element) =>
    fireEvent.keyDown(element, { key: "Escape", code: "Escape", keyCode: 27 });
  let abortDrawing;

  beforeEach(() => {
    abortDrawing = jest.spyOn(Draw.prototype, "abortDrawing");
  });

  afterEach(() => {
    abortDrawing.mockRestore();
  });

  test("abandons the shape being drawn and leaves drawing mode, keeping what was drawn", async () => {
    const {
      drawing,
      finishShape,
      interactions,
      mockMap,
      setVariableInputValues,
      source,
    } = await renderDrawing(
      { options: ["Polygon"], variable: "area" },
      "Polygon",
    );
    finishShape(
      new Polygon([
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ]),
    );
    const writes = setVariableInputValues.mock.calls.length;
    mockMap.removeInteraction.mockClear();

    escapeOn(document.body);

    expect(abortDrawing).toHaveBeenCalledTimes(1);
    expect(drawing.current).toBe(false);
    expect(mockMap.removeInteraction).toHaveBeenCalledWith(interactions.at(-1));
    expect(source.getFeatures()).toHaveLength(1);
    expect(setVariableInputValues).toHaveBeenCalledTimes(writes);
  });

  test("counts a key from the map's own toolbar", async () => {
    const { drawing, mapElement } = await renderDrawing({ options: ["Point"] });

    escapeOn(within(mapElement).getByTitle("Draw Point"));

    expect(drawing.current).toBe(false);
  });

  test.each([
    ["an input", () => document.createElement("input")],
    ["a select", () => document.createElement("select")],
    [
      "a contenteditable element",
      () => {
        const element = document.createElement("div");
        element.setAttribute("contenteditable", "true");
        return element;
      },
    ],
  ])("is ignored while typing in %s", async (_label, makeField) => {
    const { drawing, mapElement } = await renderDrawing({
      options: ["Point"],
    });
    const field = makeField();
    mapElement.appendChild(field);

    escapeOn(field);

    expect(abortDrawing).not.toHaveBeenCalled();
    expect(drawing.current).toBe(true);
  });

  test("ignores other keys", async () => {
    const { drawing } = await renderDrawing({ options: ["Point"] });

    fireEvent.keyDown(document.body, { key: "Enter" });

    expect(drawing.current).toBe(true);
  });

  test("is not listened for once drawing has stopped or the map is gone", async () => {
    const reachedThePage = jest.fn();
    document.addEventListener("keydown", reachedThePage);
    const { mapElement, unmount } = await renderDrawing({ options: ["Point"] });

    fireEvent.click(within(mapElement).getByTitle("Stop Drawing (Esc)"));
    escapeOn(document.body);
    fireEvent.click(within(mapElement).getByTitle("Draw Point"));
    unmount();
    escapeOn(document.body);

    expect(abortDrawing).not.toHaveBeenCalled();
    expect(reachedThePage).toHaveBeenCalledTimes(2);
    document.removeEventListener("keydown", reachedThePage);
  });

  test("one Escape stops every map that is drawing", async () => {
    const { drawing: firstMap } = await renderDrawing({ options: ["Point"] });
    const { drawing: secondMap } = await renderDrawing({ options: ["Point"] });

    escapeOn(document.body);

    expect(firstMap.current).toBe(false);
    expect(secondMap.current).toBe(false);
  });

  test("keeps the tile editor open while drawing, and lets it close once drawing has stopped", async () => {
    const onHide = jest.fn();
    render(
      <Modal show={true} onHide={onHide} animation={false}>
        <Modal.Body>
          <div data-testid="map-host" />
        </Modal.Body>
      </Modal>,
    );
    const dialog = await screen.findByRole("dialog");
    const { drawing } = await renderDrawing(
      { options: ["Point"] },
      "Point",
      screen.getByTestId("map-host"),
    );

    escapeOn(dialog);

    expect(drawing.current).toBe(false);
    expect(onHide).not.toHaveBeenCalled();

    escapeOn(dialog);

    expect(onHide).toHaveBeenCalledTimes(1);
  });

  test("keeps a map popup open while drawing, and lets it close once drawing has stopped", async () => {
    const onClose = jest.fn();
    render(
      <PopupModal show={true} onClose={onClose} position={POPUP_POSITION}>
        <div data-testid="popup-map-host" />
      </PopupModal>,
    );
    const popup = screen.getByTestId("popup-modal");
    const { drawing } = await renderDrawing(
      { options: ["Point"] },
      "Point",
      screen.getByTestId("popup-map-host"),
    );

    escapeOn(popup);

    expect(drawing.current).toBe(false);
    expect(onClose).not.toHaveBeenCalled();

    escapeOn(popup);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("lets a dialog opened over a drawing map close, and keeps drawing", async () => {
    const { drawing } = await renderDrawing({ options: ["Point"] });
    const onHide = jest.fn();
    render(
      <Modal show={true} onHide={onHide} animation={false}>
        <Modal.Body>Dashboard settings</Modal.Body>
      </Modal>,
    );

    escapeOn(await screen.findByRole("dialog"));

    expect(onHide).toHaveBeenCalledTimes(1);
    expect(drawing.current).toBe(true);
    expect(abortDrawing).not.toHaveBeenCalled();
  });
});

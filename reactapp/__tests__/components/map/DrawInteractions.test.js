import { act } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import DrawInteractions from "components/map/DrawInteractions";
import VectorSource from "ol/source/Vector";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import { fromLonLat } from "ol/proj";
import createLoadedComponent, {
  InputVariablePComponent,
} from "__tests__/utilities/customRender";

test("Draw Interactions no options and no render", async () => {
  const mockMap = {
    addLayer: jest.fn(),
    addInteraction: jest.fn(),
    removeInteraction: jest.fn(),
  };

  const visualizationRef = { current: mockMap };
  const drawing = { current: false };

  let LoadedComponent = createLoadedComponent({
    children: (
      <DrawInteractions
        mapDrawing={{}}
        visualizationRef={visualizationRef}
        drawing={drawing}
      />
    ),
  });
  const { rerender } = render(LoadedComponent);

  expect(screen.queryByTitle("Stop Drawing")).not.toBeInTheDocument();

  LoadedComponent = createLoadedComponent({
    children: (
      <DrawInteractions
        mapDrawing={{ options: [] }}
        visualizationRef={visualizationRef}
        drawing={drawing}
      />
    ),
  });
  rerender(LoadedComponent);

  expect(screen.queryByTitle("Stop Drawing")).not.toBeInTheDocument();

  LoadedComponent = createLoadedComponent({
    children: (
      <DrawInteractions
        mapDrawing={{ options: ["Point"] }}
        visualizationRef={visualizationRef}
        drawing={drawing}
      />
    ),
  });
  rerender(LoadedComponent);

  expect(await screen.findByTitle("Stop Drawing")).toBeInTheDocument();
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

  const LoadedComponent = createLoadedComponent({
    children: (
      <DrawInteractions
        mapDrawing={mapDrawing}
        visualizationRef={visualizationRef}
        drawing={drawing}
      />
    ),
  });
  render(LoadedComponent);

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

  const LoadedComponent = createLoadedComponent({
    children: (
      <DrawInteractions
        mapDrawing={mapDrawing}
        visualizationRef={visualizationRef}
        drawing={drawing}
      />
    ),
  });
  render(LoadedComponent);

  // Click the "Draw Point" button to trigger interaction setup
  const drawButton = await screen.findByTitle("Draw Point");
  fireEvent.click(drawButton);

  expect(drawing.current).toBe(true);
  expect(mockAddInteraction).toHaveBeenCalled();

  const stopDrawingButton = screen.getByTitle("Stop Drawing");
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

  const LoadedComponent = createLoadedComponent({
    children: (
      <DrawInteractions
        mapDrawing={mapDrawing}
        visualizationRef={visualizationRef}
        drawing={drawing}
      />
    ),
  });
  render(LoadedComponent);

  // Click the "Draw Point" button to trigger interaction setup
  fireEvent.click(await screen.findByTitle("Draw Point"));

  const clearFeaturesButton = screen.getByTitle("Clear All Features");
  fireEvent.click(clearFeaturesButton);

  expect(sourceClear).toHaveBeenCalled();
});

test("Draw Interactions drawend", async () => {
  const sourceRemoveFeature = jest.spyOn(
    VectorSource.prototype,
    "removeFeature"
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

  const LoadedComponent = createLoadedComponent({
    children: (
      <DrawInteractions
        mapDrawing={mapDrawing}
        visualizationRef={visualizationRef}
        drawing={drawing}
      />
    ),
  });
  render(LoadedComponent);

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

  const LoadedComponent = createLoadedComponent({
    children: (
      <>
        <DrawInteractions
          mapDrawing={mapDrawing}
          visualizationRef={visualizationRef}
          drawing={drawing}
        />
        <InputVariablePComponent />
      </>
    ),
  });
  render(LoadedComponent);

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

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({
      test: {
        projection: 3857,
        geometries: [
          {
            type: "Point",
            coordinates: [-13703429.316651978, 6325919.274572156],
          },
        ],
      },
    })
  );
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

  const LoadedComponent = createLoadedComponent({
    children: (
      <>
        <DrawInteractions
          mapDrawing={mapDrawing}
          visualizationRef={visualizationRef}
          drawing={drawing}
        />
        <InputVariablePComponent />
      </>
    ),
  });
  render(LoadedComponent);

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

  expect(await screen.findByTestId("input-variables")).toHaveTextContent(
    JSON.stringify({
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
    })
  );
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

  const LoadedComponent = createLoadedComponent({
    children: (
      <DrawInteractions
        mapDrawing={mapDrawing}
        visualizationRef={visualizationRef}
        drawing={drawing}
      />
    ),
  });
  render(LoadedComponent);

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
    "removeFeature"
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

  const LoadedComponent = createLoadedComponent({
    children: (
      <DrawInteractions
        mapDrawing={mapDrawing}
        visualizationRef={visualizationRef}
        drawing={drawing}
      />
    ),
  });
  const { rerender } = render(LoadedComponent);

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
  const NewLoadedComponent = createLoadedComponent({
    children: (
      <DrawInteractions
        mapDrawing={newMapDrawing}
        visualizationRef={visualizationRef}
        drawing={drawing}
      />
    ),
  });
  rerender(NewLoadedComponent);

  expect(sourceRemoveFeature).toHaveBeenCalledWith(feature);
  expect(vectorSource.getFeatures().length).toBe(1);
});

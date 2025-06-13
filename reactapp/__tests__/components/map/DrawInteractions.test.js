import { act } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DrawInteractions from "components/map/DrawInteractions";
import PropTypes from "prop-types";
import { createRef } from "react";
import VectorSource from "ol/source/Vector";
import { Draw } from "ol/interaction";

test("Draw Interactions click draw and then deselect", async () => {
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
    <DrawInteractions
      mapDrawing={mapDrawing}
      visualizationRef={visualizationRef}
      drawing={drawing}
    />
  );

  // simulate clicking the draw button
  const drawButton = screen.getByTitle("Draw Point");
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
    <DrawInteractions
      mapDrawing={mapDrawing}
      visualizationRef={visualizationRef}
      drawing={drawing}
    />
  );

  // simulate clicking the draw button
  const drawButton = screen.getByTitle("Draw Point");
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

  render(
    <DrawInteractions
      mapDrawing={mapDrawing}
      visualizationRef={visualizationRef}
      drawing={drawing}
    />
  );

  const clearFeaturesButton = screen.getByTitle("Clear All Features");
  fireEvent.click(clearFeaturesButton);

  expect(sourceClear).toHaveBeenCalled();
});

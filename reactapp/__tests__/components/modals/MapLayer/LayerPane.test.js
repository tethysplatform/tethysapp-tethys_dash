import { useState } from "react";
import PropTypes from "prop-types";
import { render, screen, fireEvent } from "@testing-library/react";
import LayerPane from "components/modals/MapLayer/LayerPane";

const TestingComponent = ({
  initialLayerProps = {},
  sourceType,
  isDynamicLayer,
}) => {
  const [layerProps, setLayerProps] = useState(initialLayerProps);

  return (
    <>
      <LayerPane
        layerProps={layerProps}
        setLayerProps={setLayerProps}
        sourceType={sourceType}
        isDynamicLayer={isDynamicLayer}
      />
      <p data-testid="layerProps">{JSON.stringify(layerProps)}</p>
    </>
  );
};

TestingComponent.propTypes = {
  initialLayerProps: PropTypes.object,
  sourceType: PropTypes.string,
  isDynamicLayer: PropTypes.bool,
};

test("LayerPane", async () => {
  render(<TestingComponent />);

  expect(await screen.findByText("Name")).toBeInTheDocument();
  expect(await screen.findByText("Layer Properties")).toBeInTheDocument();

  const nameInput = await screen.findByLabelText("Name Input");
  fireEvent.change(nameInput, { target: { value: "some name" } });
  expect(await screen.findByTestId("layerProps")).toHaveTextContent(
    JSON.stringify({ name: "some name" }),
  );

  expect(await screen.findByText("Opacity")).toBeInTheDocument();
  expect(await screen.findByText("Min Resolution")).toBeInTheDocument();
  expect(await screen.findByText("Max Resolution")).toBeInTheDocument();
  expect(await screen.findByText("Min Zoom")).toBeInTheDocument();
  expect(await screen.findByText("Max Zoom")).toBeInTheDocument();

  const opacityInput = await screen.findByLabelText("value Input 0");
  fireEvent.change(opacityInput, { target: { value: ".5" } });
  expect(await screen.findByTestId("layerProps")).toHaveTextContent(
    JSON.stringify({ name: "some name", opacity: ".5" }),
  );

  expect(await screen.findByText("Default Visibility")).toBeInTheDocument();
  expect(await screen.findByText("Invisible")).toBeInTheDocument();
  expect(await screen.findByText("Visible")).toBeInTheDocument();

  const visibilityToggle = await screen.findByLabelText(
    "Default Visibility Toggle",
  );
  expect(visibilityToggle.checked).toBe(true);
  fireEvent.click(visibilityToggle);
  expect(visibilityToggle.checked).toBe(false);

  expect(await screen.findByTestId("layerProps")).toHaveTextContent(
    JSON.stringify({
      name: "some name",
      opacity: ".5",
      layerVisibility: false,
    }),
  );

  fireEvent.click(visibilityToggle);

  expect(await screen.findByTestId("layerProps")).toHaveTextContent(
    JSON.stringify({ name: "some name", opacity: ".5" }),
  );
});

test("LayerPane renders and edits clickTolerance, showClickTolerance, snapToFeatures, and snapSublayer", async () => {
  render(<TestingComponent />);

  // rows render with spaceAndCapitalize labels
  expect(await screen.findByText("Click Tolerance")).toBeInTheDocument();
  expect(await screen.findByText("Show Click Tolerance")).toBeInTheDocument();
  expect(await screen.findByText("Snap To Features")).toBeInTheDocument();
  expect(await screen.findByText("Snap Sublayer")).toBeInTheDocument();

  // clickTolerance is row 6 (opacity, minResolution, maxResolution, minZoom,
  // maxZoom, minZoomQuery, clickTolerance, showClickTolerance, snapToFeatures,
  // snapSublayer)
  const clickToleranceInput = await screen.findByLabelText("value Input 6");
  fireEvent.change(clickToleranceInput, { target: { value: "25" } });
  expect(await screen.findByTestId("layerProps")).toHaveTextContent(
    JSON.stringify({ clickTolerance: "25" }),
  );

  const showClickToleranceCheckbox =
    await screen.findByLabelText("value Input 7");
  expect(showClickToleranceCheckbox.checked).toBe(false);
  fireEvent.click(showClickToleranceCheckbox);
  expect(await screen.findByTestId("layerProps")).toHaveTextContent(
    JSON.stringify({ clickTolerance: "25", showClickTolerance: true }),
  );

  const snapToFeaturesCheckbox = await screen.findByLabelText("value Input 8");
  expect(snapToFeaturesCheckbox.checked).toBe(false);
  fireEvent.click(snapToFeaturesCheckbox);
  expect(await screen.findByTestId("layerProps")).toHaveTextContent(
    JSON.stringify({
      clickTolerance: "25",
      showClickTolerance: true,
      snapToFeatures: true,
    }),
  );

  const snapSublayerInput = await screen.findByLabelText("value Input 9");
  fireEvent.change(snapSublayerInput, { target: { value: "3" } });
  expect(await screen.findByTestId("layerProps")).toHaveTextContent(
    JSON.stringify({
      clickTolerance: "25",
      showClickTolerance: true,
      snapToFeatures: true,
      snapSublayer: "3",
    }),
  );
});

test("LayerPane round-trips existing clickTolerance/showClickTolerance/snapToFeatures/snapSublayer values and preserves them when editing the name", async () => {
  render(
    <TestingComponent
      initialLayerProps={{
        name: "River Layer",
        clickTolerance: 15,
        showClickTolerance: true,
        snapToFeatures: true,
        snapSublayer: 2,
      }}
    />,
  );

  const clickToleranceInput = await screen.findByLabelText("value Input 6");
  expect(clickToleranceInput.value).toBe("15");

  const showClickToleranceCheckbox =
    await screen.findByLabelText("value Input 7");
  expect(showClickToleranceCheckbox.checked).toBe(true);

  const snapToFeaturesCheckbox = await screen.findByLabelText("value Input 8");
  expect(snapToFeaturesCheckbox.checked).toBe(true);

  const snapSublayerInput = await screen.findByLabelText("value Input 9");
  expect(snapSublayerInput.value).toBe("2");

  // editing the unrelated Name field must not clobber the other props
  const nameInput = await screen.findByLabelText("Name Input");
  fireEvent.change(nameInput, { target: { value: "Updated Name" } });

  expect(await screen.findByTestId("layerProps")).toHaveTextContent(
    JSON.stringify({
      name: "Updated Name",
      clickTolerance: 15,
      showClickTolerance: true,
      snapToFeatures: true,
      snapSublayer: 2,
    }),
  );
});

test("LayerPane clearing Click Tolerance leaves it an empty string (no coercion to 0)", async () => {
  render(<TestingComponent initialLayerProps={{ clickTolerance: 15 }} />);

  const clickToleranceInput = await screen.findByLabelText("value Input 6");
  expect(clickToleranceInput.value).toBe("15");

  fireEvent.change(clickToleranceInput, { target: { value: "" } });

  expect(await screen.findByTestId("layerProps")).toHaveTextContent(
    JSON.stringify({ clickTolerance: "" }),
  );
});

test.each(["Annotations", "Linked Extents"])(
  "LayerPane omits query, snap and image rows for a %s layer",
  async (sourceType) => {
    render(<TestingComponent sourceType={sourceType} />);

    expect(await screen.findByText("Opacity")).toBeInTheDocument();
    expect(screen.getByText("Min Zoom")).toBeInTheDocument();
    expect(screen.getByText("Max Resolution")).toBeInTheDocument();
    for (const hidden of [
      "Min Zoom Query",
      "Click Tolerance",
      "Show Click Tolerance",
      "Snap To Features",
      "Snap Sublayer",
      "Render As Image",
      "Image Ratio",
    ]) {
      expect(screen.queryByText(hidden)).not.toBeInTheDocument();
    }
  },
);

test("LayerPane edits the right property after rows are hidden", async () => {
  render(<TestingComponent sourceType="Annotations" />);

  // Rows, placeholders and types are filtered together, so Max Zoom is the
  // last row and its input edits maxZoom.
  fireEvent.change(await screen.findByLabelText("value Input 4"), {
    target: { value: "12" },
  });

  expect(screen.queryByLabelText("value Input 5")).not.toBeInTheDocument();
  expect(screen.getByTestId("layerProps")).toHaveTextContent(
    JSON.stringify({ maxZoom: "12" }),
  );
});

test("LayerPane switches to a decoration source type without crashing", async () => {
  // Rows, placeholders and types must change together on the same render.
  const { rerender } = render(<TestingComponent sourceType="GeoJSON" />);
  expect(await screen.findByText("Click Tolerance")).toBeInTheDocument();

  rerender(<TestingComponent sourceType="Annotations" />);
  expect(screen.queryByText("Click Tolerance")).not.toBeInTheDocument();
  expect(screen.getByText("Max Zoom")).toBeInTheDocument();

  rerender(<TestingComponent sourceType="GeoJSON" />);
  expect(screen.getByText("Click Tolerance")).toBeInTheDocument();
});

describe("LayerPane Zoom To Layer On Change row", () => {
  // Registry order puts the row last, after Image Ratio (row 11).
  const ZOOM_ROW = "value Input 12";

  test.each([
    "GeoJSON",
    "KML",
    "Shapefile",
    "GeoPackage",
    "GeoParquet",
    "GeoTIFF",
    "Zarr",
    "Static Image",
  ])("is offered on a %s layer, whose data the browser holds", async (type) => {
    render(<TestingComponent sourceType={type} />);
    expect(
      await screen.findByText("Zoom To Layer On Change"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(ZOOM_ROW)).toHaveAttribute("type", "checkbox");
  });

  test.each([
    "WMS",
    "ESRI Image and Map Service",
    "Image Tile",
    "Vector Tile",
    "PMTiles Vector",
    "PMTiles Raster",
    "ESRI Feature Service",
  ])(
    "is not offered on a %s layer, which cannot say where it is",
    async (type) => {
      render(<TestingComponent sourceType={type} />);
      expect(await screen.findByText("Image Ratio")).toBeInTheDocument();
      expect(
        screen.queryByText("Zoom To Layer On Change"),
      ).not.toBeInTheDocument();
      expect(screen.queryByLabelText(ZOOM_ROW)).not.toBeInTheDocument();
    },
  );

  test("is offered on a dynamic plugin layer whatever its plugin is called", async () => {
    const { rerender } = render(
      <TestingComponent sourceType="Stream Gauges" />,
    );
    expect(await screen.findByText("Image Ratio")).toBeInTheDocument();
    expect(
      screen.queryByText("Zoom To Layer On Change"),
    ).not.toBeInTheDocument();

    rerender(<TestingComponent sourceType="Stream Gauges" isDynamicLayer />);
    expect(
      await screen.findByText("Zoom To Layer On Change"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(ZOOM_ROW)).toHaveAttribute("type", "checkbox");
  });

  test("ticking it writes zoomToLayerOnChange: true", async () => {
    render(<TestingComponent isDynamicLayer />);

    const checkbox = await screen.findByLabelText(ZOOM_ROW);
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);

    expect(screen.getByTestId("layerProps")).toHaveTextContent(
      JSON.stringify({ zoomToLayerOnChange: true }),
    );
    expect(screen.getByLabelText(ZOOM_ROW).checked).toBe(true);
  });

  test("shows a saved tick", async () => {
    render(
      <TestingComponent
        isDynamicLayer
        initialLayerProps={{ zoomToLayerOnChange: true }}
      />,
    );

    expect((await screen.findByLabelText(ZOOM_ROW)).checked).toBe(true);
  });

  test.each([
    ["hidden", false],
    ["shown", true],
  ])(
    "the other rows edit their own keys while it is %s",
    async (_, isDynamicLayer) => {
      render(<TestingComponent isDynamicLayer={isDynamicLayer} />);

      // Image Ratio stays row 11 either way, and keeps its number input.
      const imageRatioInput = await screen.findByLabelText("value Input 11");
      expect(imageRatioInput).toHaveAttribute("type", "number");
      fireEvent.change(imageRatioInput, { target: { value: "1.5" } });
      // Snap To Features keeps its checkbox at row 8.
      fireEvent.click(screen.getByLabelText("value Input 8"));

      expect(screen.getByTestId("layerProps")).toHaveTextContent(
        JSON.stringify({ imageRatio: "1.5", snapToFeatures: true }),
      );
      expect(screen.queryAllByLabelText(ZOOM_ROW)).toHaveLength(
        isDynamicLayer ? 1 : 0,
      );
    },
  );
});

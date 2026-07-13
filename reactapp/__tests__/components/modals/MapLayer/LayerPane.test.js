import { useState } from "react";
import PropTypes from "prop-types";
import { render, screen, fireEvent } from "@testing-library/react";
import LayerPane from "components/modals/MapLayer/LayerPane";

const TestingComponent = ({ initialLayerProps = {} }) => {
  const [layerProps, setLayerProps] = useState(initialLayerProps);

  return (
    <>
      <LayerPane layerProps={layerProps} setLayerProps={setLayerProps} />
      <p data-testid="layerProps">{JSON.stringify(layerProps)}</p>
    </>
  );
};

TestingComponent.propTypes = {
  initialLayerProps: PropTypes.object,
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

test("LayerPane renders and edits clickTolerance, snapToFeatures, and querySublayer", async () => {
  render(<TestingComponent />);

  // rows render with spaceAndCapitalize labels
  expect(await screen.findByText("Click Tolerance")).toBeInTheDocument();
  expect(await screen.findByText("Snap To Features")).toBeInTheDocument();
  expect(await screen.findByText("Query Sublayer")).toBeInTheDocument();

  // clickTolerance is row 6 (opacity, minResolution, maxResolution, minZoom,
  // maxZoom, minZoomQuery, clickTolerance, snapToFeatures, querySublayer)
  const clickToleranceInput = await screen.findByLabelText("value Input 6");
  fireEvent.change(clickToleranceInput, { target: { value: "25" } });
  expect(await screen.findByTestId("layerProps")).toHaveTextContent(
    JSON.stringify({ clickTolerance: "25" }),
  );

  const snapToFeaturesCheckbox = await screen.findByLabelText("value Input 7");
  expect(snapToFeaturesCheckbox.checked).toBe(false);
  fireEvent.click(snapToFeaturesCheckbox);
  expect(await screen.findByTestId("layerProps")).toHaveTextContent(
    JSON.stringify({ clickTolerance: "25", snapToFeatures: true }),
  );

  const querySublayerInput = await screen.findByLabelText("value Input 8");
  fireEvent.change(querySublayerInput, { target: { value: "3" } });
  expect(await screen.findByTestId("layerProps")).toHaveTextContent(
    JSON.stringify({
      clickTolerance: "25",
      snapToFeatures: true,
      querySublayer: "3",
    }),
  );
});

test("LayerPane round-trips existing clickTolerance/snapToFeatures/querySublayer values and preserves them when editing the name", async () => {
  render(
    <TestingComponent
      initialLayerProps={{
        name: "River Layer",
        clickTolerance: 15,
        snapToFeatures: true,
        querySublayer: 2,
      }}
    />,
  );

  const clickToleranceInput = await screen.findByLabelText("value Input 6");
  expect(clickToleranceInput.value).toBe("15");

  const snapToFeaturesCheckbox = await screen.findByLabelText("value Input 7");
  expect(snapToFeaturesCheckbox.checked).toBe(true);

  const querySublayerInput = await screen.findByLabelText("value Input 8");
  expect(querySublayerInput.value).toBe("2");

  // editing the unrelated Name field must not clobber the other props
  const nameInput = await screen.findByLabelText("Name Input");
  fireEvent.change(nameInput, { target: { value: "Updated Name" } });

  expect(await screen.findByTestId("layerProps")).toHaveTextContent(
    JSON.stringify({
      name: "Updated Name",
      clickTolerance: 15,
      snapToFeatures: true,
      querySublayer: 2,
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

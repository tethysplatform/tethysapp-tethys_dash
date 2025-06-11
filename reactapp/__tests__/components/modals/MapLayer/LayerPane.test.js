import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import LayerPane from "components/modals/MapLayer/LayerPane";

const TestingComponent = () => {
  const [layerProps, setLayerProps] = useState({});

  return (
    <>
      <LayerPane layerProps={layerProps} setLayerProps={setLayerProps} />
      <p data-testid="layerProps">{JSON.stringify(layerProps)}</p>
    </>
  );
};

test("LayerPane", async () => {
  render(<TestingComponent />);

  expect(await screen.findByText("Name")).toBeInTheDocument();
  expect(await screen.findByText("Layer Properties")).toBeInTheDocument();

  const nameInput = await screen.findByLabelText("Name Input");
  fireEvent.change(nameInput, { target: { value: "some name" } });
  expect(await screen.findByTestId("layerProps")).toHaveTextContent(
    JSON.stringify({ name: "some name" })
  );

  expect(await screen.findByText("Opacity")).toBeInTheDocument();
  expect(await screen.findByText("Min Resolution")).toBeInTheDocument();
  expect(await screen.findByText("Max Resolution")).toBeInTheDocument();
  expect(await screen.findByText("Min Zoom")).toBeInTheDocument();
  expect(await screen.findByText("Max Zoom")).toBeInTheDocument();

  const opacityInput = await screen.findByLabelText("value Input 0");
  fireEvent.change(opacityInput, { target: { value: ".5" } });
  expect(await screen.findByTestId("layerProps")).toHaveTextContent(
    JSON.stringify({ name: "some name", opacity: ".5" })
  );

  expect(await screen.findByText("Default Visibility")).toBeInTheDocument();
  expect(await screen.findByText("Invisible")).toBeInTheDocument();
  expect(await screen.findByText("Visible")).toBeInTheDocument();

  const visibilityToggle = await screen.findByLabelText(
    "Default Visibility Toggle"
  );
  expect(visibilityToggle.checked).toBe(true);
  fireEvent.click(visibilityToggle);
  expect(visibilityToggle.checked).toBe(false);

  expect(await screen.findByTestId("layerProps")).toHaveTextContent(
    JSON.stringify({ name: "some name", opacity: ".5", layerVisibility: false })
  );

  fireEvent.click(visibilityToggle);

  expect(await screen.findByTestId("layerProps")).toHaveTextContent(
    JSON.stringify({ name: "some name", opacity: ".5" })
  );
});

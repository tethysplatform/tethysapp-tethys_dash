import { useState, useEffect, act } from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  findAllByAltText,
} from "@testing-library/react";
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

  expect(await screen.findByText("opacity")).toBeInTheDocument();
  expect(await screen.findByText("minResolution")).toBeInTheDocument();
  expect(await screen.findByText("maxResolution")).toBeInTheDocument();
  expect(await screen.findByText("minZoom")).toBeInTheDocument();
  expect(await screen.findByText("maxZoom")).toBeInTheDocument();

  const opacityInput = await screen.findByLabelText("value Input 0");
  fireEvent.change(opacityInput, { target: { value: ".5" } });
  expect(await screen.findByTestId("layerProps")).toHaveTextContent(
    JSON.stringify({ name: "some name", opacity: ".5" })
  );
});

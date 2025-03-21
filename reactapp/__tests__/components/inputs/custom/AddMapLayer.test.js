import {
  render,
  within,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { AddMapLayer } from "components/inputs/custom/AddMapLayer";
import {
  layerConfigImageArcGISRest,
  layerConfigImageWMS,
} from "__tests__/utilities/constants";
import createLoadedComponent from "__tests__/utilities/customRender";
import selectEvent from "react-select-event";

it("AddMapLayer update existing", async () => {
  const layerConfiguration = JSON.parse(
    JSON.stringify(layerConfigImageArcGISRest)
  );
  layerConfiguration.legend = {
    title: "Legend Title",
    items: [{ color: "red", label: "legend label", symbol: "square" }],
  };
  const onChange = jest.fn();
  const setShowingSubModal = jest.fn();
  const values = [layerConfiguration];
  const gridItemIndex = 0;

  render(
    createLoadedComponent({
      children: (
        <AddMapLayer
          values={values}
          onChange={onChange}
          setShowingSubModal={setShowingSubModal}
          gridItemIndex={gridItemIndex}
        />
      ),
    })
  );

  const addLayerButton = await screen.findByText("Add Layer");
  expect(addLayerButton).toBeInTheDocument();
  expect(screen.getByText("Layer Name")).toBeInTheDocument();
  expect(screen.getByText("Legend")).toBeInTheDocument();

  expect(screen.getAllByRole("row").length).toBe(2);
  expect(screen.getByText("ImageArcGISRest Layer")).toBeInTheDocument();
  expect(screen.getByText("On")).toBeInTheDocument();

  const editMapLayerButton = screen.getByTestId("editMapLayer");
  fireEvent.mouseOver(editMapLayerButton);
  expect(editMapLayerButton).toHaveStyle("cursor: pointer");
  fireEvent.mouseOut(editMapLayerButton);
  expect(editMapLayerButton).toHaveStyle("cursor: default");
  fireEvent.click(editMapLayerButton);

  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  const nameInput = await screen.findByLabelText("Name Input");
  fireEvent.change(nameInput, { target: { value: "New Layer Name" } });

  const createLayerButton = await screen.findByLabelText("Create Layer Button");
  fireEvent.click(createLayerButton);

  expect(screen.queryByText("ImageArcGISRest Layer")).not.toBeInTheDocument();
  expect(await screen.findByText("New Layer Name")).toBeInTheDocument();
  expect(screen.queryByText("ImageArcGISRest Layer")).not.toBeInTheDocument();

  const removeMapLayerButton = screen.getByTestId("removeMapLayer");
  fireEvent.mouseOver(removeMapLayerButton);
  expect(removeMapLayerButton).toHaveStyle("cursor: pointer");
  fireEvent.mouseOut(removeMapLayerButton);
  expect(removeMapLayerButton).toHaveStyle("cursor: default");
  fireEvent.click(removeMapLayerButton);

  expect(screen.queryByText("New Layer Name")).not.toBeInTheDocument();

  expect(onChange).toHaveBeenCalledWith([
    {
      configuration: {
        props: {
          name: "New Layer Name",
          source: {
            props: {
              url: "https://maps.water.noaa.gov/server/rest/services/rfc/rfc_max_forecast/MapServer",
            },
            type: "ImageArcGISRest",
          },
          zIndex: 1,
        },
        type: "ImageLayer",
      },
      legend: {
        items: [
          {
            color: "red",
            label: "legend label",
            symbol: "square",
          },
        ],
        title: "Legend Title",
      },
    },
  ]);
});

it("AddMapLayer add new", async () => {
  const onChange = jest.fn();
  const setShowingSubModal = jest.fn();
  const values = [];
  const gridItemIndex = 0;

  render(
    createLoadedComponent({
      children: (
        <AddMapLayer
          values={values}
          onChange={onChange}
          setShowingSubModal={setShowingSubModal}
          gridItemIndex={gridItemIndex}
        />
      ),
    })
  );

  const addLayerButton = await screen.findByText("Add Layer");
  expect(addLayerButton).toBeInTheDocument();
  expect(screen.getByText("Layer Name")).toBeInTheDocument();
  expect(screen.getByText("Legend")).toBeInTheDocument();

  expect(screen.getAllByRole("row").length).toBe(1);

  fireEvent.click(addLayerButton);
  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  const nameInput = await screen.findByLabelText("Name Input");
  fireEvent.change(nameInput, { target: { value: "New Layer Name" } });

  const sourceTab = screen.getByText("Source");
  fireEvent.click(sourceTab);
  const sourceTabContent = screen.getByLabelText("layer-source-tab");
  const sourceDropdown = screen.getByRole("combobox");

  selectEvent.openMenu(sourceDropdown);
  const sourceOption = await screen.findByText("ImageArcGISRest");
  fireEvent.click(sourceOption);
  expect(await screen.findByText("Source Properties")).toBeInTheDocument();

  const urlInput = within(sourceTabContent).getByLabelText("value Input 0");
  fireEvent.change(urlInput, { target: { value: "Some Url" } });

  const createLayerButton = await screen.findByLabelText("Create Layer Button");
  fireEvent.click(createLayerButton);

  expect(await screen.findByText("New Layer Name")).toBeInTheDocument();
  expect(screen.getByText("Off")).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

  expect(onChange).toHaveBeenCalledWith([
    {
      configuration: {
        props: {
          name: "New Layer Name",
          source: {
            props: {
              url: "Some Url",
            },
            type: "ImageArcGISRest",
          },
        },
        type: "ImageLayer",
      },
    },
  ]);
});

it("AddMapLayer rerender", async () => {
  const onChange = jest.fn();
  const setShowingSubModal = jest.fn();
  const values = [layerConfigImageArcGISRest];
  const gridItemIndex = 0;

  const LoadedComponent = createLoadedComponent({
    children: (
      <AddMapLayer
        values={values}
        onChange={onChange}
        setShowingSubModal={setShowingSubModal}
        gridItemIndex={gridItemIndex}
      />
    ),
  });
  const { rerender } = render(LoadedComponent);

  const addLayerButton = await screen.findByText("Add Layer");
  expect(addLayerButton).toBeInTheDocument();
  expect(screen.getByText("Layer Name")).toBeInTheDocument();
  expect(screen.getByText("Legend")).toBeInTheDocument();

  expect(screen.getAllByRole("row").length).toBe(2);
  expect(screen.getByText("ImageArcGISRest Layer")).toBeInTheDocument();

  const NewLoadedComponent = createLoadedComponent({
    children: (
      <AddMapLayer
        values={[layerConfigImageWMS]}
        onChange={onChange}
        setShowingSubModal={setShowingSubModal}
        gridItemIndex={gridItemIndex}
      />
    ),
  });
  rerender(NewLoadedComponent);

  expect(screen.queryByText("ImageArcGISRest Layer")).not.toBeInTheDocument();
  expect(screen.getByText("Image WMS")).toBeInTheDocument();
});

it("AddMapLayer reorder", async () => {
  const onChange = jest.fn();
  const setShowingSubModal = jest.fn();
  const values = [layerConfigImageArcGISRest, layerConfigImageWMS];
  const gridItemIndex = 0;

  render(
    createLoadedComponent({
      children: (
        <AddMapLayer
          values={values}
          onChange={onChange}
          setShowingSubModal={setShowingSubModal}
          gridItemIndex={gridItemIndex}
        />
      ),
    })
  );

  const wmsLayer = await screen.findByText("Image WMS");
  const imageArcGISRestLayer = screen.getByText("ImageArcGISRest Layer");
  expect(wmsLayer).toBeInTheDocument();
  expect(imageArcGISRestLayer).toBeInTheDocument();

  const tabelCells = screen.getAllByRole("cell");
  expect(tabelCells[1]).toHaveTextContent("ImageArcGISRest Layer");
  expect(tabelCells[5]).toHaveTextContent("Image WMS");

  fireEvent.dragStart(tabelCells[1], {
    dataTransfer: {
      items: [{ type: "text/plain" }],
    },
  });

  fireEvent.dragOver(tabelCells[5]);
  fireEvent.drop(tabelCells[5]);

  await waitFor(() => {
    expect(tabelCells[1]).toHaveTextContent("Image WMS");
  });
  await waitFor(() => {
    expect(tabelCells[5]).toHaveTextContent("ImageArcGISRest Layer");
  });

  expect(onChange).toHaveBeenCalledWith([
    {
      configuration: {
        props: {
          name: "Image WMS",
          source: {
            props: {
              params: { LAYERS: "topp:states" },
              url: "https://ahocevar.com/geoserver/wms",
            },
            type: "ImageWMS",
          },
          zIndex: 1,
        },
        type: "ImageLayer",
      },
    },
    {
      configuration: {
        props: {
          name: "ImageArcGISRest Layer",
          source: {
            props: {
              url: "https://maps.water.noaa.gov/server/rest/services/rfc/rfc_max_forecast/MapServer",
            },
            type: "ImageArcGISRest",
          },
          zIndex: 1,
        },
        type: "ImageLayer",
      },
    },
  ]);
});

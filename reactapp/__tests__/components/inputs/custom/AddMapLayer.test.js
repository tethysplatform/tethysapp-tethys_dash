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
  exampleStyle,
} from "__tests__/utilities/constants";
import createLoadedComponent from "__tests__/utilities/customRender";
import selectEvent from "react-select-event";
import appAPI from "services/api/app";

jest.mock("uuid", () => ({
  v4: () => 12345678,
}));

it("AddMapLayer update existing", async () => {
  const mockDownloadJSON = jest.fn();
  appAPI.downloadJSON = mockDownloadJSON;
  mockDownloadJSON.mockResolvedValueOnce({
    success: true,
    data: exampleStyle,
  });
  const mockUploadJSON = jest.fn();
  appAPI.uploadJSON = mockUploadJSON;
  mockUploadJSON.mockResolvedValueOnce({
    success: true,
    filename: "geojson.json",
  });

  const layerConfiguration = JSON.parse(
    JSON.stringify(layerConfigImageArcGISRest)
  );
  layerConfiguration.configuration.style = "some_json.json";
  layerConfiguration.legend = {
    title: "Legend Title",
    items: [{ color: "red", label: "legend label", symbol: "square" }],
  };
  layerConfiguration.attributeVariables = {
    states: { the_geom: "some variable" },
  };
  layerConfiguration.omittedPopupAttributes = { states: ["the_geom"] };
  layerConfiguration.queryable = false;

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
      attributeVariables: {
        states: {
          the_geom: "some variable",
        },
      },
      configuration: {
        props: {
          name: "New Layer Name",
          source: {
            props: {
              url: "https://maps.water.noaa.gov/server/rest/services/rfc/rfc_max_forecast/MapServer",
            },
            type: "ESRI Image and Map Service",
          },
          zIndex: 1,
        },
        style: "geojson.json",
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
      omittedPopupAttributes: {
        states: ["the_geom"],
      },
      queryable: false,
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
  const sourceDropdown = screen.getByLabelText("Source Type Input");

  selectEvent.openMenu(sourceDropdown);
  const sourceOption = await screen.findByText("ESRI Image and Map Service");
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
            type: "ESRI Image and Map Service",
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
  expect(screen.getByText("WMS")).toBeInTheDocument();
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

  const wmsLayer = await screen.findByText("WMS");
  const imageArcGISRestLayer = screen.getByText("ImageArcGISRest Layer");
  expect(wmsLayer).toBeInTheDocument();
  expect(imageArcGISRestLayer).toBeInTheDocument();

  const tabelCells = screen.getAllByRole("cell");
  expect(tabelCells[1]).toHaveTextContent("ImageArcGISRest Layer");
  expect(tabelCells[5]).toHaveTextContent("WMS");

  fireEvent.dragStart(tabelCells[1], {
    dataTransfer: {
      items: [{ type: "text/plain" }],
    },
  });

  fireEvent.dragOver(tabelCells[5]);
  fireEvent.drop(tabelCells[5]);

  await waitFor(() => {
    expect(tabelCells[1]).toHaveTextContent("WMS");
  });
  await waitFor(() => {
    expect(tabelCells[5]).toHaveTextContent("ImageArcGISRest Layer");
  });

  expect(onChange).toHaveBeenCalledWith([
    {
      configuration: {
        props: {
          name: "WMS",
          source: {
            props: {
              params: { LAYERS: "topp:states" },
              url: "https://ahocevar.com/geoserver/wms",
            },
            type: "WMS",
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
            type: "ESRI Image and Map Service",
          },
          zIndex: 1,
        },
        type: "ImageLayer",
      },
    },
  ]);
});

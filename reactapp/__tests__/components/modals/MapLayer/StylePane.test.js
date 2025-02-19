import { useState } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import StylePane from "components/modals/MapLayer/StylePane";
import appAPI from "services/api/app";
import PropTypes from "prop-types";

const exampleStyle = {
  version: 8,
  sprite:
    "https://cdn.arcgis.com/sharing/rest/content/items/005b8960ddd04ae781df8d471b6726b3/resources/styles/../sprites/sprite",
  glyphs:
    "https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer/resources/fonts/{fontstack}/{range}.pbf",
  sources: {
    esri: {
      type: "vector",
      url: "https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer",
      tiles: [
        "https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer/tile/{z}/{y}/{x}.pbf",
      ],
    },
  },
  layers: [
    {
      id: "Land/Ice",
      type: "fill",
      source: "esri",
      "source-layer": "Land",
      filter: ["==", "_symbol", 1],
      layout: {},
      paint: {
        "fill-opacity": 0.8,
        "fill-color": "#feffff",
      },
    },
  ],
};

const TestingComponent = ({ initialStyle }) => {
  const [style, setStyle] = useState(initialStyle);

  return (
    <>
      <StylePane style={style} setStyle={setStyle} />
      <p data-testid="style">{style}</p>
    </>
  );
};

test("StylePane json Input", async () => {
  render(<TestingComponent />);

  expect(await screen.findByText("Upload style file")).toBeInTheDocument();

  const textArea = screen.getByLabelText("style-text-area");
  fireEvent.change(textArea, {
    target: { value: JSON.stringify(exampleStyle) },
  });
  expect(await screen.findByTestId("style")).toHaveTextContent(
    JSON.stringify(exampleStyle)
  );
});

test("StylePane Json File Upload", async () => {
  render(<TestingComponent />);

  expect(await screen.findByText("Upload style file")).toBeInTheDocument();

  const file = new File([JSON.stringify(exampleStyle)], "test-file.json", {
    type: "text/plain",
  });
  const fileInput = screen.getByTestId("file-input");
  fireEvent.change(fileInput, { target: { files: [file] } });

  await waitFor(async () => {
    expect(await screen.findByTestId("style")).toHaveTextContent(
      JSON.stringify(exampleStyle)
    );
  });
});

test("StylePane Updating Existing GeoJSON", async () => {
  const mockDownloadJSON = jest.fn();
  appAPI.downloadJSON = mockDownloadJSON;
  mockDownloadJSON.mockResolvedValue({ data: exampleStyle });

  render(<TestingComponent initialStyle={"some_file.json"} />);

  expect(await screen.findByText("Upload style file")).toBeInTheDocument();
  const textbox = await screen.findByRole("textbox");
  await waitFor(async () => {
    expect(textbox.value).toStrictEqual(JSON.stringify(exampleStyle, null, 4));
  });
});

TestingComponent.propTypes = {
  initialStyle: PropTypes.string,
};

import { useState } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import StylePane from "components/modals/MapLayer/StylePane";
import appAPI from "services/api/app";
import PropTypes from "prop-types";
import userEvent from "@testing-library/user-event";
import { LayoutContext } from "components/contexts/Contexts";

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

const TestingComponent = ({ initialStyle, setErrorMessage }) => {
  const [style, setStyle] = useState(initialStyle);

  return (
    <LayoutContext.Provider value={{ uuid: "123" }}>
      <StylePane
        style={style}
        setStyle={setStyle}
        setErrorMessage={setErrorMessage}
      />
      <p data-testid="style">{style}</p>
    </LayoutContext.Provider>
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

test("StylePane Json URL", async () => {
  global.fetch = jest.fn().mockResolvedValueOnce({
    ok: true,
  });
  const mockSetErrorMessage = jest.fn();

  render(<TestingComponent setErrorMessage={mockSetErrorMessage} />);

  expect(await screen.findByText("Style Source")).toBeInTheDocument();

  const UrlRadio = await screen.findByLabelText("URL");
  await userEvent.click(UrlRadio);
  expect(UrlRadio).toBeInTheDocument();

  const UrlInput = await screen.findByLabelText("URL Input");
  fireEvent.change(UrlInput, {
    target: { value: "some/url/file.json" },
  });
  expect(await screen.findByTestId("style")).toHaveTextContent(
    "some/url/file.json"
  );
  await waitFor(() => {
    expect(mockSetErrorMessage).toHaveBeenCalledTimes(0);
  });

  const CustomRadio = await screen.findByLabelText("Custom");
  await userEvent.click(CustomRadio);
  expect(await screen.findByTestId("style")).toHaveTextContent("{}");
});

test("StylePane Json bad URL", async () => {
  global.fetch = jest.fn().mockResolvedValueOnce({
    ok: false,
  });
  const mockSetErrorMessage = jest.fn();

  render(<TestingComponent setErrorMessage={mockSetErrorMessage} />);

  expect(await screen.findByText("Style Source")).toBeInTheDocument();

  const UrlRadio = await screen.findByLabelText("URL");
  await userEvent.click(UrlRadio);
  expect(UrlRadio).toBeInTheDocument();

  const UrlInput = await screen.findByLabelText("URL Input");
  fireEvent.change(UrlInput, {
    target: { value: "some/url/file.json" },
  });
  expect(await screen.findByTestId("style")).toHaveTextContent(
    "some/url/file.json"
  );
  await waitFor(() => {
    expect(mockSetErrorMessage).toHaveBeenCalledWith("Failed to retrieve JSON");
  });
});

test("StylePane Updating Existing GeoJSON", async () => {
  const mockDownloadJSON = jest.fn();
  jest.spyOn(appAPI, "downloadJSON").mockImplementation(mockDownloadJSON);
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
  setErrorMessage: PropTypes.func,
};

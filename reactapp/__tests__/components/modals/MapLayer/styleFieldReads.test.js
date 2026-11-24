import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PropTypes from "prop-types";
import StylePane from "components/modals/MapLayer/StylePane";
import { AppContext, LayoutContext } from "components/contexts/Contexts";
import * as utilities from "components/map/utilities";

// When the Style tab reads a layer's fields for its rule editor. The editor is
// replaced by the field list it is handed, which is all these tests look at.
jest.mock("components/inputs/RuleStyleEditor", () => {
  const MockPropTypes = require("prop-types");
  const Fields = ({ availableFields }) => (
    <p data-testid="fields">{availableFields.join(",")}</p>
  );
  Fields.propTypes = { availableFields: MockPropTypes.array.isRequired };
  return { __esModule: true, default: Fields };
});

const geojson = (name) => ({
  type: "GeoJSON",
  geojson: `https://example.com/${name}.geojson`,
});

const Pane = ({
  sourceProps,
  tabKey = "style",
  layerProps = { name: "gauges" },
  shapefileDiscovery,
}) => (
  <AppContext.Provider value={{ dynamicMapLayers: [] }}>
    <LayoutContext.Provider value={{ uuid: "123" }}>
      <StylePane
        tabKey={tabKey}
        style={{}}
        setStyle={() => {}}
        setErrorMessage={() => {}}
        sourceProps={sourceProps}
        setRasterStyle={() => {}}
        layerProps={layerProps}
        shapefileDiscovery={shapefileDiscovery}
      />
    </LayoutContext.Provider>
  </AppContext.Provider>
);

Pane.propTypes = {
  sourceProps: PropTypes.object,
  tabKey: PropTypes.string,
  layerProps: PropTypes.object,
  shapefileDiscovery: PropTypes.object,
};

const showRules = async () =>
  userEvent.click(await screen.findByLabelText("Rule-based Editor"));
const fields = () => screen.getByTestId("fields");

test("the Style tab reads fields when it shows, and again only after a change that reaches the read", async () => {
  const read = jest
    .spyOn(utilities, "getStyleFields")
    .mockResolvedValue(["gauge_id"]);
  const source = geojson("gauges");

  const { rerender } = render(<Pane sourceProps={source} tabKey="source" />);
  expect(read).not.toHaveBeenCalled();

  rerender(<Pane sourceProps={source} />);
  expect(read).toHaveBeenCalledTimes(1);

  // The layer's opacity is no part of a read.
  rerender(
    <Pane sourceProps={source} layerProps={{ name: "gauges", opacity: 0.5 }} />,
  );
  rerender(<Pane sourceProps={{ ...source }} tabKey="source" />);
  rerender(<Pane sourceProps={{ ...source }} />);
  expect(read).toHaveBeenCalledTimes(1);

  rerender(<Pane sourceProps={geojson("basins")} />);
  expect(read).toHaveBeenCalledTimes(2);
});

test("a field reply that a newer read replaced applies nothing", async () => {
  let releaseOld;
  jest
    .spyOn(utilities, "getStyleFields")
    .mockImplementation(({ sourceProps }) =>
      sourceProps.geojson.endsWith("old.geojson")
        ? new Promise((resolve) => {
            releaseOld = () => resolve(["old_field"]);
          })
        : Promise.resolve(["new_field"]),
    );
  const { rerender } = render(<Pane sourceProps={geojson("old")} />);
  await showRules();

  rerender(<Pane sourceProps={geojson("new")} />);
  await waitFor(() => expect(fields()).toHaveTextContent("new_field"));
  await act(async () => releaseOld());

  expect(fields()).toHaveTextContent(/^new_field$/);
});

test("fields read before a shapefile are read again when the source comes back", async () => {
  const read = jest
    .spyOn(utilities, "getStyleFields")
    .mockResolvedValue(["gauge_id"]);
  const source = geojson("gauges");
  const { rerender } = render(<Pane sourceProps={source} />);
  await showRules();
  await waitFor(() => expect(fields()).toHaveTextContent("gauge_id"));

  rerender(
    <Pane
      sourceProps={{
        type: "Shapefile",
        props: { url: "https://example.com/basins.zip" },
      }}
      shapefileDiscovery={{ isShapefile: true, fields: ["HUC8"] }}
    />,
  );
  await waitFor(() => expect(fields()).toHaveTextContent("HUC8"));

  rerender(<Pane sourceProps={source} />);
  await waitFor(() => expect(fields()).toHaveTextContent("gauge_id"));
  expect(read).toHaveBeenCalledTimes(2);
});

test("a raster's fields are never read: it has no rule editor", () => {
  const read = jest.spyOn(utilities, "getStyleFields").mockResolvedValue([]);
  render(
    <Pane
      sourceProps={{
        type: "GeoTIFF",
        props: { url: "https://example.com/dem.tif" },
      }}
    />,
  );
  expect(read).not.toHaveBeenCalled();
});

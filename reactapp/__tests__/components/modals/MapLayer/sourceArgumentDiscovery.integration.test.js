import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PropTypes from "prop-types";
import { useState } from "react";
import SourcePane from "components/modals/MapLayer/SourcePane";
import useSourceArgumentDiscovery from "components/modals/MapLayer/sourceArgumentDiscovery";
import {
  AppContext,
  LayoutContext,
  VariableInputsContext,
} from "components/contexts/Contexts";
import MapContextProvider from "components/contexts/MapContext";
import Modal from "react-bootstrap/Modal";
import { listArrays } from "components/map/zarrReader";
import { s3UrlToHttps } from "components/map/ModuleLoader";

// The hook suite fakes the pane and the panel suite fakes the hook, so a
// contract drift between them would slip past both. This wires the real hook
// into the real pane the way MapLayer.js does -- including the react-bootstrap
// Modal it actually lives in, whose focus trap is the kind of thing that only
// misbehaves once the real wrapper is there.
jest.mock("components/map/zarrReader", () => ({
  listArrays: jest.fn(),
  readMetadata: jest.fn(),
}));
jest.mock("components/map/ModuleLoader", () => ({
  s3UrlToHttps: jest.fn(),
  listGeoPackageTables: jest.fn(),
  invalidateGeoPackageTables: jest.fn(),
  listGeoParquetColumns: jest.fn(),
  invalidateGeoParquetColumns: jest.fn(),
  clearClientSourceCaches: jest.fn(),
}));

beforeEach(() => {
  s3UrlToHttps.mockReset().mockImplementation((url) => url);
  listArrays
    .mockReset()
    .mockResolvedValue({ names: ["depth"], enumerated: true });
});

function Harness({ initialProps }) {
  const [sourceProps, setSourceProps] = useState(initialProps);
  const argumentDiscovery = useSourceArgumentDiscovery({
    sourceProps,
    variableInputValues: {},
    variableInputDateFormats: {},
  });
  return (
    <AppContext.Provider
      value={{ dynamicMapLayers: [], mapLayerTemplates: [], csrf: "x" }}
    >
      <LayoutContext.Provider value={{ uuid: "u" }}>
        <VariableInputsContext.Provider
          value={{ variableInputValues: {}, variableInputDateFormats: {} }}
        >
          <MapContextProvider>
            <Modal show onHide={() => {}}>
              <Modal.Body>
                <SourcePane
                  sourceProps={sourceProps}
                  setSourceProps={setSourceProps}
                  setStyle={jest.fn()}
                  setAttributeProps={jest.fn()}
                  setErrorMessage={jest.fn()}
                  shapefileDiscovery={{ state: "idle", fields: [], drift: [] }}
                  argumentDiscovery={argumentDiscovery}
                />
              </Modal.Body>
            </Modal>
          </MapContextProvider>
        </VariableInputsContext.Provider>
      </LayoutContext.Provider>
    </AppContext.Provider>
  );
}

Harness.propTypes = { initialProps: PropTypes.object.isRequired };

const zarr = () => ({
  type: "Zarr",
  props: { url: "https://host/store.zarr", variable: "" },
});

const variableRow = () => screen.getByLabelText("value Input 1");

test("a discovered value can be chosen and reaches the source props", async () => {
  const user = userEvent.setup();
  render(<Harness initialProps={zarr()} />);

  await user.click(variableRow());
  await waitFor(() => expect(listArrays).toHaveBeenCalledTimes(1));
  await user.click(await screen.findByText("depth"));

  expect(screen.getByText("depth")).toBeInTheDocument();
});

test("a failed read is explained once and not restarted on every menu open", async () => {
  // Reported from the browser: reopening the dropdown to type a name by hand
  // wiped the explanation and kicked off another read, so the author was
  // fighting the control instead of typing into it.
  const user = userEvent.setup();
  listArrays.mockRejectedValue(new TypeError("Failed to fetch"));
  render(<Harness initialProps={zarr()} />);

  await user.click(variableRow());
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent(/Check the URL/),
  );
  expect(listArrays).toHaveBeenCalledTimes(1);

  // Click away and back, the way an author reaching for the keyboard does.
  await user.click(screen.getByLabelText("value Input 0"));
  await user.click(variableRow());

  expect(listArrays).toHaveBeenCalledTimes(1);
  // The reason stays on screen while they type rather than flashing away.
  expect(screen.getByRole("alert")).toHaveTextContent(/Check the URL/);
});

test("the author can still type a name of their own after a read fails", async () => {
  const user = userEvent.setup();
  listArrays.mockRejectedValue(new TypeError("Failed to fetch"));
  render(<Harness initialProps={zarr()} />);

  await user.click(variableRow());
  expect(await screen.findByRole("alert")).toBeInTheDocument();

  await user.type(variableRow(), "salinity");
  expect(variableRow()).toHaveValue("salinity");

  // The create option is what makes an unlisted value reachable, and it has to
  // survive a failed read -- that author is exactly who this control is for.
  await user.click(await screen.findByText('Use "salinity"'));
  expect(screen.getByText("salinity")).toBeInTheDocument();
});

test("the explicit re-read does start a new read", async () => {
  const user = userEvent.setup();
  listArrays.mockRejectedValue(new TypeError("Failed to fetch"));
  render(<Harness initialProps={zarr()} />);

  await user.click(variableRow());
  expect(await screen.findByRole("alert")).toBeInTheDocument();
  expect(listArrays).toHaveBeenCalledTimes(1);

  await user.click(screen.getByRole("button", { name: /Re-read variable/ }));
  await waitFor(() => expect(listArrays).toHaveBeenCalledTimes(2));
});

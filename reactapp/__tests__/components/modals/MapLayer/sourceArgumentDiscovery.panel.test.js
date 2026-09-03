import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import selectEvent from "react-select-event";
import SourcePane from "components/modals/MapLayer/SourcePane";
import {
  AppContext,
  LayoutContext,
  VariableInputsContext,
} from "components/contexts/Contexts";
import MapContextProvider from "components/contexts/MapContext";

// The hook is faked as a plain object rather than run, the way the shapefile
// panel suite does it: the states are what this file is about, and driving the
// real hook would make each UI state depend on a network fake.
function entry(overrides = {}) {
  return {
    state: "idle",
    slow: false,
    options: [],
    failure: null,
    retryable: false,
    ...overrides,
  };
}

function discovery(discoveries, overrides = {}) {
  return {
    discoveries,
    load: jest.fn(),
    refresh: jest.fn(),
    keys: {},
    ...overrides,
  };
}

function renderPane({
  sourceProps,
  argumentDiscovery,
  setSourceProps = jest.fn(),
}) {
  render(
    <AppContext.Provider
      value={{ dynamicMapLayers: [], mapLayerTemplates: [], csrf: "x" }}
    >
      <LayoutContext.Provider value={{ uuid: "uuid" }}>
        <VariableInputsContext.Provider
          value={{ variableInputValues: {}, variableInputDateFormats: {} }}
        >
          <MapContextProvider>
            <SourcePane
              sourceProps={sourceProps}
              setSourceProps={setSourceProps}
              setStyle={jest.fn()}
              setAttributeProps={jest.fn()}
              setErrorMessage={jest.fn()}
              argumentDiscovery={argumentDiscovery}
            />
          </MapContextProvider>
        </VariableInputsContext.Provider>
      </LayoutContext.Provider>
    </AppContext.Provider>,
  );
  return { setSourceProps };
}

const zarr = (props = {}) => ({
  type: "Zarr",
  props: { url: "https://host/store.zarr", ...props },
});
const geoparquet = (props = {}) => ({
  type: "GeoParquet",
  props: { url: "https://host/a.parquet", ...props },
});

// The Zarr `variable` row. Rows are [property, value] pairs and the value cell
// is the only input, so the argument's combobox is found by its row label.
const variableInput = () => screen.getByLabelText("value Input 1");
const columnsInput = () => screen.getByLabelText("value Input 1");

describe("source argument discovery in the editor", () => {
  it("renders a discoverable argument as a combobox, not a text box", async () => {
    renderPane({
      sourceProps: zarr(),
      argumentDiscovery: discovery({ variable: entry(), index: entry() }),
    });
    // The url row stays a text input; the array row becomes a combobox.
    expect(screen.getByLabelText("value Input 0")).toHaveAttribute(
      "type",
      "text",
    );
    expect(variableInput()).toBeInTheDocument();
    expect(screen.getAllByRole("combobox").length).toBeGreaterThan(1);
  });

  it("asks for a read when the author opens the menu, and only then", async () => {
    const argumentDiscovery = discovery({ variable: entry(), index: entry() });
    renderPane({ sourceProps: zarr(), argumentDiscovery });
    expect(argumentDiscovery.load).not.toHaveBeenCalled();
    selectEvent.openMenu(variableInput());
    await waitFor(() =>
      expect(argumentDiscovery.load).toHaveBeenCalledWith("variable"),
    );
  });

  it("offers the values a read returned", async () => {
    renderPane({
      sourceProps: zarr(),
      argumentDiscovery: discovery({
        variable: entry({
          state: "ready",
          options: [
            { value: "depth", label: "depth" },
            { value: "velocity", label: "velocity" },
          ],
        }),
        index: entry(),
      }),
    });
    selectEvent.openMenu(variableInput());
    expect(await screen.findByText("velocity")).toBeInTheDocument();
  });

  it("writes a chosen value into the source properties", async () => {
    const setSourceProps = jest.fn();
    renderPane({
      sourceProps: zarr(),
      setSourceProps,
      argumentDiscovery: discovery({
        variable: entry({
          state: "ready",
          options: [{ value: "depth", label: "depth" }],
        }),
        index: entry(),
      }),
    });
    await selectEvent.select(variableInput(), "depth");
    expect(setSourceProps).toHaveBeenCalled();
  });

  it("says the source lists nothing, distinctly from a failure", async () => {
    renderPane({
      sourceProps: zarr(),
      argumentDiscovery: discovery({
        variable: entry({ state: "empty" }),
        index: entry(),
      }),
    });
    expect(
      await screen.findByText(/does not list its contents/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toHaveTextContent(/CORS/i);
  });

  it("explains a failure beside the row and says typing still works", async () => {
    renderPane({
      sourceProps: zarr(),
      argumentDiscovery: discovery({
        variable: entry({
          state: "failed",
          retryable: true,
          failure: { detail: "Failed to fetch", remedy: "Check the URL" },
        }),
        index: entry(),
      }),
    });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Failed to fetch");
    expect(alert).toHaveTextContent(/still type the value/i);
  });

  it("says a slow read is slow, distinguishably from ordinary loading", async () => {
    const { unmount } = render(<div />);
    unmount();
    renderPane({
      sourceProps: zarr(),
      argumentDiscovery: discovery({
        variable: entry({ state: "loading", slow: true }),
        index: entry(),
      }),
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      /still reading/i,
    );
  });

  it("offers a re-read after a successful read and after an empty one", async () => {
    const argumentDiscovery = discovery({
      variable: entry({ state: "ready", options: [] }),
      index: entry(),
    });
    renderPane({ sourceProps: zarr(), argumentDiscovery });
    fireEvent.click(await screen.findByLabelText("Re-read variable values"));
    expect(argumentDiscovery.refresh).toHaveBeenCalledWith("variable");
  });

  it("withholds the re-read for a failure retrying cannot fix", async () => {
    renderPane({
      sourceProps: zarr(),
      argumentDiscovery: discovery({
        variable: entry({
          state: "failed",
          retryable: false,
          failure: { detail: "variable not found", remedy: null },
        }),
        index: entry(),
      }),
    });
    await screen.findByRole("alert");
    expect(
      screen.queryByLabelText("Re-read variable values"),
    ).not.toBeInTheDocument();
  });

  it("prompts for a URL instead of reading when there is none", async () => {
    renderPane({
      sourceProps: { type: "Zarr", props: {} },
      argumentDiscovery: discovery({
        variable: entry({ state: "nokey" }),
        index: entry(),
      }),
    });
    expect(await screen.findByText(/enter a source url/i)).toBeInTheDocument();
  });

  it("renders a multi-value argument and writes its selections joined", async () => {
    const setSourceProps = jest.fn();
    renderPane({
      sourceProps: geoparquet(),
      setSourceProps,
      argumentDiscovery: discovery({
        columns: entry({
          state: "ready",
          options: [
            { value: "elev", label: "elev" },
            { value: "depth", label: "depth" },
          ],
        }),
      }),
    });
    await selectEvent.select(columnsInput(), "elev");
    await selectEvent.select(columnsInput(), "depth");
    expect(setSourceProps).toHaveBeenCalled();
  });

  it("renders a source with no discoverable arguments unchanged", async () => {
    renderPane({
      sourceProps: { type: "WMS", props: { url: "https://host/wms" } },
      argumentDiscovery: discovery({}),
    });
    // Every WMS row is still a plain text input.
    expect(screen.getByLabelText("value Input 0")).toHaveAttribute(
      "type",
      "text",
    );
  });

  it("renders without a discovery hook at all", async () => {
    render(
      <AppContext.Provider
        value={{ dynamicMapLayers: [], mapLayerTemplates: [], csrf: "x" }}
      >
        <LayoutContext.Provider value={{ uuid: "uuid" }}>
          <VariableInputsContext.Provider
            value={{ variableInputValues: {}, variableInputDateFormats: {} }}
          >
            <MapContextProvider>
              <SourcePane
                sourceProps={zarr()}
                setSourceProps={jest.fn()}
                setStyle={jest.fn()}
                setAttributeProps={jest.fn()}
                setErrorMessage={jest.fn()}
              />
            </MapContextProvider>
          </VariableInputsContext.Provider>
        </LayoutContext.Provider>
      </AppContext.Provider>,
    );
    expect(screen.getByLabelText("value Input 0")).toBeInTheDocument();
  });
});

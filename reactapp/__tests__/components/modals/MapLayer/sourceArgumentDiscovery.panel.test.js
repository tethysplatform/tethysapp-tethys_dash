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
    stale: [],
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
              shapefileDiscovery={{ state: "idle", fields: [], drift: [] }}
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

describe("flagging a value the source no longer offers", () => {
  it("names the absent value and says it was left alone", async () => {
    renderPane({
      sourceProps: zarr({ variable: "salinity" }),
      argumentDiscovery: discovery({
        variable: entry({
          state: "ready",
          options: [{ value: "depth", label: "depth" }],
          stale: ["salinity"],
        }),
        index: entry(),
      }),
    });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("does not offer the saved value salinity");
    expect(alert).toHaveTextContent("left as it is");
    // The value stays in the control - the warning explains it, it does not
    // replace it.
    expect(variableInput()).toBeInTheDocument();
    expect(screen.getByText("salinity")).toBeInTheDocument();
  });

  it("reports a slice against the range the array has, not as a missing name", async () => {
    renderPane({
      sourceProps: zarr({ variable: "depth", index: "7" }),
      argumentDiscovery: discovery({
        variable: entry({ state: "ready" }),
        index: entry({
          state: "ready",
          sliceCount: 2,
          options: [
            { value: "0", label: "t0" },
            { value: "1", label: "t1" },
          ],
          stale: ["7"],
        }),
      }),
    });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("2 slices");
    expect(alert).toHaveTextContent("positions 0-1");
    expect(alert).toHaveTextContent("outside it");
  });

  it("speaks of a single slice in the singular", async () => {
    renderPane({
      sourceProps: zarr({ variable: "depth", index: "3" }),
      argumentDiscovery: discovery({
        variable: entry({ state: "ready" }),
        index: entry({
          state: "ready",
          sliceCount: 1,
          options: [{ value: "0", label: "0" }],
          stale: ["3"],
        }),
      }),
    });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("1 slice,");
    expect(alert).toHaveTextContent("only position 0 exists");
  });

  it("names just the absent entries of a multi-value argument", async () => {
    renderPane({
      sourceProps: geoparquet({ columns: "elev,aspect,slope" }),
      argumentDiscovery: discovery({
        columns: entry({
          state: "ready",
          options: [
            { value: "elev", label: "elev" },
            { value: "slope", label: "slope" },
          ],
          stale: ["aspect"],
        }),
      }),
    });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("does not offer the saved value aspect");
    expect(alert).not.toHaveTextContent("elev,");
  });

  it("says nothing when every saved value is on offer", async () => {
    renderPane({
      sourceProps: zarr({ variable: "depth" }),
      argumentDiscovery: discovery({
        variable: entry({
          state: "ready",
          options: [{ value: "depth", label: "depth" }],
        }),
        index: entry(),
      }),
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("the other discoverable source types", () => {
  const geopackage = (props = {}) => ({
    type: "GeoPackage",
    props: { url: "https://host/a.gpkg", ...props },
  });

  it("renders GeoPackage's table row as a combobox and reads on menu open", async () => {
    // SourcePane.test.js walks only the text-input source types, so this row
    // has no other regression net.
    const argumentDiscovery = discovery({
      layer: entry({
        state: "ready",
        options: [{ value: "streams", label: "streams" }],
      }),
    });
    renderPane({ sourceProps: geopackage(), argumentDiscovery });

    const input = screen.getByLabelText("value Input 1");
    expect(input).toBeInTheDocument();
    selectEvent.openMenu(input);
    await waitFor(() =>
      expect(argumentDiscovery.load).toHaveBeenCalledWith("layer"),
    );
    expect(await screen.findByText("streams")).toBeInTheDocument();
  });

  it("tells the author which sibling is missing rather than blaming the url", async () => {
    renderPane({
      sourceProps: zarr({ variable: "" }),
      argumentDiscovery: discovery({
        variable: entry(),
        index: entry({
          state: "nokey",
          blockedBy: { reason: "dependency", missingSibling: "variable" },
        }),
      }),
    });
    expect(screen.getByText(/Choose variable first/)).toBeInTheDocument();
    expect(screen.queryByText(/Enter a source URL/)).not.toBeInTheDocument();
  });

  it("distinguishes a source that lists nothing from one that cannot be listed", async () => {
    renderPane({
      sourceProps: zarr(),
      argumentDiscovery: discovery({
        variable: entry({ state: "empty", enumerated: true }),
        index: entry(),
      }),
    });
    expect(screen.getByText(/was read and offers nothing/)).toBeInTheDocument();
  });
});

describe("the note does not disturb the row", () => {
  it("renders nothing while a read is merely in flight", () => {
    // An empty wrapper still carries its margin, so the row grew the instant
    // the menu opened -- a layout shift landing between mousedown and mouseup.
    renderPane({
      sourceProps: zarr(),
      argumentDiscovery: discovery({
        variable: entry({ state: "loading", slow: false }),
        index: entry(),
      }),
    });
    expect(
      screen.queryByTestId("discovery-note-variable"),
    ).not.toBeInTheDocument();
  });

  it("does render once the read has something to say", () => {
    renderPane({
      sourceProps: zarr(),
      argumentDiscovery: discovery({
        variable: entry({ state: "loading", slow: true }),
        index: entry(),
      }),
    });
    expect(screen.getByTestId("discovery-note-variable")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/Still reading/);
  });
});

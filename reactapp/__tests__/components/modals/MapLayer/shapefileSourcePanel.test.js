import { render, screen, fireEvent } from "@testing-library/react";
import SourcePane from "components/modals/MapLayer/SourcePane";
import {
  AppContext,
  LayoutContext,
  VariableInputsContext,
} from "components/contexts/Contexts";
import MapContextProvider from "components/contexts/MapContext";

const SOURCE_PROPS = {
  type: "Shapefile",
  props: { url: "https://example.org/basins.zip" },
};

function discovery(overrides = {}) {
  return {
    isShapefile: true,
    resolvedUrl: "https://example.org/basins.zip",
    state: "idle",
    slow: false,
    fields: [],
    failure: null,
    drift: [],
    load: jest.fn(),
    ...overrides,
  };
}

function renderPane(shapefileDiscovery) {
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
              sourceProps={SOURCE_PROPS}
              setSourceProps={jest.fn()}
              setStyle={jest.fn()}
              setAttributeProps={jest.fn()}
              setErrorMessage={jest.fn()}
              shapefileDiscovery={shapefileDiscovery}
            />
          </MapContextProvider>
        </VariableInputsContext.Provider>
      </LayoutContext.Provider>
    </AppContext.Provider>,
  );
}

describe("shapefile discovery panel", () => {
  it("offers an explicit read action rather than reading on its own", async () => {
    // The style pane's own discovery effect re-runs on every source-props
    // change, which for a typed url is once per keystroke. Each read here is a
    // multi-megabyte download, so it has to be asked for.
    const state = discovery();
    renderPane(state);

    const button = await screen.findByLabelText("Read shapefile fields");
    expect(state.load).not.toHaveBeenCalled();

    fireEvent.click(button);
    expect(state.load).toHaveBeenCalled();
  });

  it("disables the action while a read is in flight", async () => {
    renderPane(discovery({ state: "loading" }));
    expect(
      await screen.findByLabelText("Read shapefile fields"),
    ).toBeDisabled();
  });

  it("disables the action when there is no url to read", async () => {
    renderPane(discovery({ resolvedUrl: null }));
    expect(
      await screen.findByLabelText("Read shapefile fields"),
    ).toBeDisabled();
  });

  it("escalates the message once a read passes the threshold", async () => {
    renderPane(discovery({ state: "loading", slow: true }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      /still reading/i,
    );
  });

  it("lists the fields it found", async () => {
    renderPane(discovery({ state: "ready", fields: ["HUC8", "AREASQKM"] }));
    expect(await screen.findByText(/Found 2 fields/)).toBeInTheDocument();
    expect(screen.getByText(/HUC8, AREASQKM/)).toBeInTheDocument();
  });

  it("reports a failure and names what the author can do about it", async () => {
    renderPane(
      discovery({
        state: "error",
        failure: {
          detail: "The shapefile could not be fetched.",
          remedy: "Convert the shapefile to GeoJSON and use that source.",
        },
      }),
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("could not be fetched");
    // Upload is not offered and a proxy is out of scope, so without naming an
    // alternative the author is told the cause and left with no move.
    expect(alert).toHaveTextContent("Convert the shapefile to GeoJSON");
    // And their existing configuration is explicitly said to be intact.
    expect(alert).toHaveTextContent(/unchanged/i);
  });

  it("omits the alternative for a failure it would not fix", async () => {
    renderPane(
      discovery({
        state: "error",
        failure: { detail: "No projection was supplied.", remedy: null },
      }),
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No projection");
    expect(alert).not.toHaveTextContent("Convert the shapefile");
  });

  it("names saved field references the source no longer has", async () => {
    // Rendered next to the action that produced it rather than split across the
    // style and attributes panes: a style-rule reference that had gone missing
    // would otherwise be invisible to an author who never opens Attributes.
    renderPane(
      discovery({
        state: "ready",
        fields: ["HUC8"],
        drift: ["POP2020", "SHAPE_LEN"],
      }),
    );

    const alerts = await screen.findAllByRole("alert");
    const drift = alerts.find((node) =>
      node.textContent.includes("does not have"),
    );
    expect(drift).toHaveTextContent("POP2020, SHAPE_LEN");
    expect(drift).toHaveTextContent(/will not match anything/i);
  });

  it("says nothing about drift when every referenced field is present", async () => {
    renderPane(discovery({ state: "ready", fields: ["HUC8"], drift: [] }));
    expect(await screen.findByText(/Found 1 field/)).toBeInTheDocument();
    expect(screen.queryByText(/does not have/)).not.toBeInTheDocument();
  });

  it("renders no panel for a non-shapefile source", async () => {
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
                sourceProps={{ type: "WMS", props: { url: "https://x" } }}
                setSourceProps={jest.fn()}
                setStyle={jest.fn()}
                setAttributeProps={jest.fn()}
                setErrorMessage={jest.fn()}
                shapefileDiscovery={discovery({ isShapefile: false })}
              />
            </MapContextProvider>
          </VariableInputsContext.Provider>
        </LayoutContext.Provider>
      </AppContext.Provider>,
    );

    expect(
      screen.queryByLabelText("Read shapefile fields"),
    ).not.toBeInTheDocument();
  });
});

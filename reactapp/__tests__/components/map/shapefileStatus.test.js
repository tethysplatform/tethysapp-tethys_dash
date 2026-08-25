import { useRef, useState } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PropTypes from "prop-types";
import { get as getProjection } from "ol/proj.js";
import MapComponent from "components/map/Map";
import LayersControl from "components/map/LayersControl";
import MapContextProvider, {
  useMapContext,
} from "components/contexts/MapContext";
import { VariableInputsContext } from "components/contexts/Contexts";
import { ERROR_KIND } from "components/map/layerStatus";
import { acquireComponents } from "components/map/shapefile/acquire";
import { interpretShapefile } from "components/map/shapefile/index";

global.ResizeObserver = require("resize-observer-polyfill");

jest.mock("components/map/shapefile/acquire", () => ({
  acquireComponents: jest.fn(),
}));
jest.mock("components/map/shapefile/index", () => ({
  interpretShapefile: jest.fn(),
}));

const FULL_EXTENT = [-Infinity, -Infinity, Infinity, Infinity];

const COLLECTION = {
  type: "FeatureCollection",
  crs: { type: "name", properties: { name: "EPSG:4326" } },
  features: [
    {
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: [-105, 40] },
    },
  ],
};

const SHAPEFILE_LAYER = {
  type: "VectorLayer",
  props: {
    name: "Basins",
    source: {
      type: "Shapefile",
      props: { url: "https://example.org/basins.zip" },
    },
  },
};

let mapRef;

let setLayers;

const Harness = ({ layers: initialLayers, layerControl }) => {
  const visualizationRef = useRef();
  const [layers, setLayersState] = useState(initialLayers);
  const { mapReady } = useMapContext();
  mapRef = visualizationRef;
  setLayers = setLayersState;
  return (
    <div>
      <MapComponent
        visualizationRef={visualizationRef}
        layers={layers}
        layerControl={layerControl}
      />
      <p>{mapReady ? "Map Ready" : "Map Not Ready"}</p>
    </div>
  );
};
Harness.propTypes = { layers: PropTypes.array, layerControl: PropTypes.bool };

async function mount({ layerControl = false } = {}) {
  render(
    <VariableInputsContext.Provider
      value={{ setVariableInputValues: jest.fn() }}
    >
      <MapContextProvider>
        <Harness layers={[SHAPEFILE_LAYER]} layerControl={layerControl} />
      </MapContextProvider>
    </VariableInputsContext.Provider>,
  );
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  await waitFor(() => expect(shapefileSource()).toBeDefined());
}

function shapefileSource() {
  return (mapRef?.current?.getLayers?.().getArray() ?? [])
    .map((layer) => layer.getSource?.())
    .find((source) => !!source?.get?.("shapefileController"));
}

// The loader is pulled by OpenLayers only when a layer renders, and a jsdom map
// has no size.
function drive() {
  shapefileSource().loadFeatures(FULL_EXTENT, 1, getProjection("EPSG:3857"));
}

beforeEach(() => {
  mapRef = undefined;
  acquireComponents.mockReset();
  interpretShapefile.mockReset();
  acquireComponents.mockResolvedValue({
    components: { shp: new Uint8Array() },
  });
  interpretShapefile.mockResolvedValue({
    featureCollection: COLLECTION,
    projectionCode: "EPSG:4326",
  });
});

describe("map-level surfacing", () => {
  it("reports a failure even with the layers control disabled", async () => {
    // The layers control is opt-in per dashboard and collapsed by default, so a
    // dashboard with it off must still not render a failure as a blank layer.
    acquireComponents.mockResolvedValue({
      error: {
        stage: "fetch",
        reason: "unreachable",
        detail: "The shapefile could not be fetched.",
      },
    });

    await mount({ layerControl: false });
    drive();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Basins");
    expect(alert).toHaveTextContent("could not be fetched");
  });

  it("reports a load in flight even with the layers control disabled", async () => {
    acquireComponents.mockImplementation(() => new Promise(() => {}));

    await mount({ layerControl: false });
    drive();

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("Loading Basins");
  });

  it("clears the in-flight indication once the load succeeds", async () => {
    await mount({ layerControl: false });
    drive();

    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("names the size ceiling and the observed size when a source is refused", async () => {
    acquireComponents.mockResolvedValue({
      error: {
        stage: "fetch",
        reason: "too_large",
        observed: 90 * 1024 * 1024,
        permitted: 25 * 1024 * 1024,
        detail:
          "The shapefile expands to at least 90.0 MB, above the 25.0 MB permitted.",
      },
    });

    await mount({ layerControl: false });
    drive();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("90.0 MB");
    expect(alert).toHaveTextContent("25.0 MB");
  });

  it("names the unresolvable coordinate system", async () => {
    interpretShapefile.mockResolvedValue({
      error: {
        stage: "parse",
        reason: "unresolvable_projection",
        detail: 'The projection "Totally_Not_Real" could not be resolved.',
      },
    });

    await mount({ layerControl: false });
    drive();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Totally_Not_Real",
    );
  });
});

describe("retry wiring and teardown", () => {
  it("retry from the layers control re-invokes the loader", async () => {
    acquireComponents.mockResolvedValue({
      error: { stage: "fetch", reason: "unreachable", detail: "no host" },
    });

    await mount({ layerControl: true });
    drive();
    await screen.findAllByRole("alert");
    expect(acquireComponents).toHaveBeenCalledTimes(1);

    fireEvent.click(await screen.findByLabelText("Show Layers Control"));
    fireEvent.click(await screen.findByLabelText("Retry Basins"));

    // Reset goes through the source's refresh, which is the only primitive that
    // causes the loader to run again -- so driving it once more loads afresh.
    drive();
    await waitFor(() => {
      expect(acquireComponents.mock.calls.length).toBeGreaterThan(1);
    });
  });

  it("discards a layer's status when the layer is removed", async () => {
    acquireComponents.mockResolvedValue({
      error: { stage: "fetch", reason: "unreachable", detail: "no host" },
    });

    await mount({ layerControl: false });
    drive();
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    setLayers([]);

    // Status lives keyed on layer name, so a removed layer's failure must not
    // linger -- and must not suppress a replacement's loading indication.
    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });
});

describe("per-layer rows in the layers control", () => {
  function renderControl(shapefileStatus, onRetryShapefile) {
    const layer = {
      get: jest.fn((key) => (key === "name" ? "Basins" : undefined)),
      getVisible: jest.fn(() => true),
      setVisible: jest.fn(),
    };
    render(
      <LayersControl
        updater
        visualizationRef={{
          current: { getLayers: () => ({ getArray: () => [layer] }) },
        }}
        shapefileStatus={shapefileStatus}
        onRetryShapefile={onRetryShapefile}
      />,
    );
    return screen.findByLabelText("Show Layers Control").then((button) => {
      fireEvent.click(button);
    });
  }

  it("shows an in-flight indication for a loading layer", async () => {
    await renderControl({ Basins: { state: "loading" } });
    expect(await screen.findByLabelText("Basins loading")).toBeInTheDocument();
  });

  it("shows the failure message for a failed layer", async () => {
    await renderControl({
      Basins: {
        state: "error",
        message: "The shapefile could not be fetched.",
        kind: ERROR_KIND.FETCH,
      },
    });
    expect(
      await screen.findByText("The shapefile could not be fetched."),
    ).toBeInTheDocument();
  });

  it("offers retry for a fetch-stage failure and calls back with the layer name", async () => {
    const onRetry = jest.fn();
    await renderControl(
      {
        Basins: {
          state: "error",
          message: "unreachable",
          kind: ERROR_KIND.FETCH,
        },
      },
      onRetry,
    );

    fireEvent.click(await screen.findByLabelText("Retry Basins"));

    expect(onRetry).toHaveBeenCalledWith("Basins");
  });

  it.each([
    [ERROR_KIND.PROJECTION, "a missing or unresolvable coordinate system"],
    [ERROR_KIND.PARSE, "a malformed component"],
    [ERROR_KIND.TOO_LARGE, "a source over the size ceiling"],
  ])("withholds retry for %s (%s)", async (kind) => {
    // Re-running the same request cannot fix any of these -- they need the
    // author to change something -- so a retry button would invite a viewer to
    // re-download megabytes and fail identically.
    await renderControl(
      { Basins: { state: "error", message: "nope", kind } },
      jest.fn(),
    );

    expect(await screen.findByText("nope")).toBeInTheDocument();
    expect(screen.queryByLabelText("Retry Basins")).not.toBeInTheDocument();
  });

  it("renders nothing extra for a layer with no status", async () => {
    await renderControl({});
    expect(
      await screen.findByLabelText("Basins Set Visible"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

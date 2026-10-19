import { useRef } from "react";
import PropTypes from "prop-types";
import { render, screen, waitFor } from "@testing-library/react";
import MapComponent from "components/map/Map";
import MapContextProvider, {
  useMapContext,
} from "components/contexts/MapContext";
import {
  GridItemContext,
  TabContext,
  VariableInputsContext,
} from "components/contexts/Contexts";
import { registerCaptureMap } from "components/map/captureLockedLayers";

jest.mock("components/map/captureLockedLayers", () => ({
  registerCaptureMap: jest.fn(),
}));

global.ResizeObserver = require("resize-observer-polyfill");

const stations = {
  type: "VectorLayer",
  props: {
    name: "Stations",
    source: {
      type: "GeoJSON",
      props: {},
      geojson: { type: "FeatureCollection", features: [] },
    },
  },
};

let mapRef;

const Harness = ({ layers }) => {
  const visualizationRef = useRef();
  const { mapReady } = useMapContext();
  mapRef = visualizationRef;
  return (
    <div>
      <MapComponent
        visualizationRef={visualizationRef}
        layers={layers}
        baseMap={null}
      />
      <p>{mapReady ? "Map Ready" : "Map Not Ready"}</p>
    </div>
  );
};
Harness.propTypes = { layers: PropTypes.array };

function mount(layers) {
  return render(
    <TabContext.Provider value={{ activeTabId: 1 }}>
      <GridItemContext.Provider
        value={{ gridItemUUID: "capture", shouldLoad: true }}
      >
        <VariableInputsContext.Provider
          value={{ setVariableInputValues: jest.fn() }}
        >
          <MapContextProvider>
            <Harness layers={layers} />
          </MapContextProvider>
        </VariableInputsContext.Provider>
      </GridItemContext.Provider>
    </TabContext.Provider>,
  );
}

const layerNamed = (name) =>
  mapRef.current
    .getLayers()
    .getArray()
    .find((layer) => layer.get("name") === name);

test("registers the map for capture, finds a layer's config by name, and unregisters on unmount", async () => {
  const unregister = jest.fn();
  registerCaptureMap.mockReturnValue(unregister);

  const { unmount } = mount([stations]);
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  await waitFor(() => expect(layerNamed("Stations")).toBeTruthy());

  expect(registerCaptureMap).toHaveBeenCalledTimes(1);
  const [element, map, getLayerConfig] = registerCaptureMap.mock.calls[0];
  // Keyed by the map's own element, the one a capture finds in the grid.
  expect(element).toHaveAttribute("aria-label", "Map Div");
  expect(map).toBe(mapRef.current);
  // The config the live layer was built from.
  expect(getLayerConfig(layerNamed("Stations"))).toEqual(
    expect.objectContaining({
      props: expect.objectContaining({ name: "Stations" }),
    }),
  );

  unmount();
  expect(unregister).toHaveBeenCalledTimes(1);
});

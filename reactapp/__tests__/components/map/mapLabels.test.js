// Styling and decluttering labeled layers, and repainting the layers the map
// preserves rather than rebuilds.
//
// jsdom lays out nothing and paints nothing, so nothing here can observe a
// label on screen, a collision, or a font. What it can observe is every
// mechanical precondition for those: which style function the layer carries,
// what that function returns for a given feature and resolution, the declutter
// group on the layer, and the render buffer it was constructed with.
//
// The style function is always exercised against a real feature rather than
// merely asserted to exist: an unstyled OpenLayers layer still answers
// `getStyle()` with its own default style function, so "a function is present"
// passes whether or not anything in this feature works.
import { useRef, useState } from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import PropTypes from "prop-types";
import MapComponent, {
  readLabelConfig,
  isRuleBasedStyle,
} from "components/map/Map";
import MapContextProvider, {
  useMapContext,
} from "components/contexts/MapContext";
import { VariableInputsContext } from "components/contexts/Contexts";
import { Map, View } from "ol";
import Feature from "ol/Feature.js";
import Point from "ol/geom/Point.js";
import VectorLayer from "ol/layer/Vector.js";
import WebGLTileLayer from "ol/layer/WebGLTile.js";
import { createDefaultStyle } from "ol/style/Style.js";
import * as olMapboxStyle from "ol-mapbox-style";
import { LABEL_RENDER_BUFFER } from "components/map/ModuleLoader";

global.ResizeObserver = require("resize-observer-polyfill");

// The label template every layer below is configured with. Held once so the
// feature-reference syntax needs a single lint exemption.
// eslint-disable-next-line no-template-curly-in-string
const STATION_TEMPLATE = "${feature.station_id}";

const pointFeature = (properties, coordinates = [0, 0]) =>
  new Feature({ geometry: new Point(coordinates), ...properties });

// A labeled feature returns its geometry style and its label style as two
// entries, so reading the text has to look through both.
const stylesOf = (returned) => [].concat(returned ?? []);
const textOf = (returned) =>
  stylesOf(returned)
    .map((style) => style?.getText?.())
    .find(Boolean)
    ?.getText();

const geojsonSource = (features) => ({
  type: "GeoJSON",
  props: {},
  geojson: {
    type: "FeatureCollection",
    crs: { type: "name", properties: { name: "EPSG:3857" } },
    features,
  },
});

const stationFeature = (id, coordinates = [0, 0]) => ({
  type: "Feature",
  geometry: { type: "Point", coordinates },
  properties: { station_id: id },
});

// The rule-based style the Style tab writes, as opposed to a vector-tile style
// document.
const styleRules = {
  default: { point: { shape: "circle", size: 6, fill: "#ff0000" } },
};

const vectorLayer = (name, props = {}, rest = {}) => ({
  type: "VectorLayer",
  props: {
    name,
    source: geojsonSource([stationFeature("ABC1")]),
    zIndex: 1,
    ...props,
  },
  ...rest,
});

let setLayers;

const Harness = ({ initialLayers }) => {
  const visualizationRef = useRef();
  const [layers, setLayersState] = useState(initialLayers);
  const { mapReady } = useMapContext();
  setLayers = setLayersState;
  return (
    <div>
      <MapComponent visualizationRef={visualizationRef} layers={layers} />
      <p>{mapReady ? "Map Ready" : "Map Not Ready"}</p>
    </div>
  );
};
Harness.propTypes = { initialLayers: PropTypes.array };

const tree = (initialLayers) => (
  <VariableInputsContext.Provider value={{ setVariableInputValues: jest.fn() }}>
    <MapContextProvider>
      <Harness initialLayers={initialLayers} />
    </MapContextProvider>
  </VariableInputsContext.Provider>
);

// Mounts and hands back every OL layer by name, plus the map they were added
// to. `addLayer` doubles as the rebuild detector: a preserved layer is never
// added a second time.
const renderMap = async (layers) => {
  const addLayerSpy = jest.spyOn(Map.prototype, "addLayer");
  const removeLayerSpy = jest.spyOn(Map.prototype, "removeLayer");
  addLayerSpy.mockClear();
  removeLayerSpy.mockClear();
  render(tree(layers));
  expect(await screen.findByText("Map Ready")).toBeInTheDocument();
  await waitFor(() => {
    expect(addLayerSpy.mock.calls.length).toBe(layers.length);
  });
  const byName = {};
  addLayerSpy.mock.calls.forEach(([layer]) => {
    byName[layer.get("name")] = layer;
  });
  return {
    layers: byName,
    olLayer: addLayerSpy.mock.calls[0][0],
    // `addLayer` was called on the map under test, so the spy already holds it.
    map: addLayerSpy.mock.instances[0],
    addLayerSpy,
    removeLayerSpy,
    update: (next) => act(() => setLayers(next)),
  };
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe("map layer labels", () => {
  test("a layer with label config and no style rules receives a working style function", async () => {
    const { layers } = await renderMap([
      vectorLayer("Stations", {}, { labels: { template: STATION_TEMPLATE } }),
    ]);

    const styleFunction = layers.Stations.getStyle();
    expect(typeof styleFunction).toBe("function");
    // Resolved against a real feature: an unstyled layer carries a style
    // function too, so only the text it produces distinguishes the two.
    expect(
      textOf(styleFunction(pointFeature({ station_id: "ABC1" }), 10)),
    ).toBe("ABC1");
  });

  test("a layer with neither label config nor style rules receives no style function, as today", async () => {
    const { layers } = await renderMap([vectorLayer("Plain")]);

    // OpenLayers' own fallback, which is what an unstyled layer carried before
    // this feature existed.
    expect(layers.Plain.getStyle()).toBe(createDefaultStyle);
    expect(layers.Plain.getDeclutter()).toBeUndefined();
  });

  test("a vector-tile style document keeps its own rendering path and gets no label", async () => {
    const applyStyleSpy = jest
      .spyOn(olMapboxStyle, "applyStyle")
      .mockResolvedValue(undefined);
    const mapboxStyle = { version: 8, sources: {}, layers: [] };

    const { layers } = await renderMap([
      vectorLayer(
        "Basemap Vector",
        {},
        { labels: { template: STATION_TEMPLATE }, style: mapboxStyle },
      ),
    ]);

    // Diverting this to the rule-based style function would silently discard
    // the whole style document, which is worse than a missing label.
    expect(applyStyleSpy).toHaveBeenCalledWith(
      layers["Basemap Vector"],
      mapboxStyle,
    );
    expect(layers["Basemap Vector"].getStyle()).toBe(createDefaultStyle);
    expect(layers["Basemap Vector"].getDeclutter()).toBeUndefined();
  });

  test("a WebGLTile layer carrying a label config is left alone", async () => {
    const setStyleSpy = jest.spyOn(WebGLTileLayer.prototype, "setStyle");

    const { layers } = await renderMap([
      {
        type: "WebGLTile",
        props: {
          name: "Raster",
          source: {
            type: "Image Tile",
            props: { url: "https://example.org/{z}/{y}/{x}" },
          },
          zIndex: 0,
        },
        // A misconfiguration -- a raster draws no per-feature labels -- and
        // the one thing it must not cost the layer is its rendering.
        labels: { template: STATION_TEMPLATE },
      },
    ]);

    // `setStyle` is the wrong capability to probe on: a WebGLTile layer has one
    // and would accept a per-feature style function that breaks its rendering.
    expect(
      setStyleSpy.mock.calls.every(([style]) => typeof style !== "function"),
    ).toBe(true);
    // The capability actually probed: a raster layer cannot declutter, which is
    // what tells it apart from a vector layer that can take a style function.
    expect(layers.Raster.setDeclutter).toBeUndefined();
  });

  test("each labeled layer declutters in its own group", async () => {
    const { layers } = await renderMap([
      vectorLayer("Stations", {}, { labels: { template: STATION_TEMPLATE } }),
      vectorLayer("Gauges", {}, { labels: { template: STATION_TEMPLATE } }),
      vectorLayer("Unlabeled", {}, { style: styleRules }),
    ]);

    const stationsGroup = layers.Stations.getDeclutter();
    const gaugesGroup = layers.Gauges.getDeclutter();

    expect(stationsGroup).toBeTruthy();
    expect(gaugesGroup).toBeTruthy();
    // Grouping is by stringified value, so two labeled layers sharing one would
    // compete for each other's label space.
    expect(stationsGroup).not.toBe(gaugesGroup);
    // A layer with no label declutters nothing, so its symbols are never
    // dropped.
    expect(layers.Unlabeled.getDeclutter()).toBeUndefined();
  });

  test("decluttering is applied through the setter rather than as a plain property", async () => {
    const setDeclutterSpy = jest.spyOn(VectorLayer.prototype, "setDeclutter");

    const { layers } = await renderMap([
      vectorLayer("Stations", {}, { labels: { template: STATION_TEMPLATE } }),
    ]);

    const group = layers.Stations.getDeclutter();
    expect(setDeclutterSpy).toHaveBeenCalledWith(group);
    // The setter writes a private field, not the property bag -- so the
    // property route neither reads nor writes what the renderer consults.
    expect(layers.Stations.get("declutter")).toBeUndefined();
    layers.Stations.set("declutter", "some-other-group");
    expect(layers.Stations.getDeclutter()).toBe(group);
  });

  test("a malformed label config still leaves the layer's geometry styled", async () => {
    const { layers } = await renderMap([
      // Not an object at all -- a plugin or a hand-edited config writing the
      // wrong shape.
      vectorLayer(
        "Wrong Shape",
        {},
        {
          labels: "station_id",
          style: styleRules,
        },
      ),
      // An object whose every field but the template is unusable.
      vectorLayer(
        "Bad Fields",
        {},
        {
          labels: {
            template: STATION_TEMPLATE,
            anchor: "nowhere",
            size: "huge",
            color: 12,
            minZoom: "soon",
          },
          style: styleRules,
        },
      ),
    ]);

    const wrongShape = layers["Wrong Shape"].getStyle();
    expect(typeof wrongShape).toBe("function");
    const wrongShapeStyles = stylesOf(
      wrongShape(pointFeature({ station_id: "ABC1" }), 10),
    );
    // The geometry still draws; the unreadable label is simply absent.
    expect(wrongShapeStyles[0].getImage()).toBeTruthy();
    expect(textOf(wrongShapeStyles)).toBeUndefined();
    expect(layers["Wrong Shape"].getDeclutter()).toBeUndefined();

    const badFields = layers["Bad Fields"].getStyle();
    const badFieldStyles = stylesOf(
      badFields(pointFeature({ station_id: "ABC1" }), 10),
    );
    expect(badFieldStyles[0].getImage()).toBeTruthy();
    // Unusable anchor, size, color and zoom floor each fall back rather than
    // costing the layer its render.
    expect(textOf(badFieldStyles)).toBe("ABC1");
  });

  test("a vector layer is constructed with the raised render buffer whether or not it carries a label", async () => {
    const { layers } = await renderMap([
      vectorLayer("Stations", {}, { labels: { template: STATION_TEMPLATE } }),
      vectorLayer("Plain"),
      vectorLayer("Authored", { renderBuffer: 42 }),
    ]);

    // `renderBuffer` is read once in the BaseVector constructor and has no
    // setter, so a layer that gains a label later can only have the room it was
    // built with.
    expect(LABEL_RENDER_BUFFER).toBeGreaterThan(100); // OpenLayers' default
    expect(layers.Stations.getRenderBuffer()).toBe(LABEL_RENDER_BUFFER);
    expect(layers.Plain.getRenderBuffer()).toBe(LABEL_RENDER_BUFFER);
    // An explicitly authored value still wins.
    expect(layers.Authored.getRenderBuffer()).toBe(42);
  });

  test("the label zoom floor is compared as a resolution derived from the live view", async () => {
    const { layers, map } = await renderMap([
      vectorLayer(
        "Stations",
        {},
        // Authored as a zoom level, the way the layer's own minZoom/maxZoom are.
        { labels: { template: STATION_TEMPLATE, minZoom: 8 } },
      ),
    ]);

    const styleFunction = layers.Stations.getStyle();
    const feature = pointFeature({ station_id: "ABC1" });
    const webMercatorFloor = map.getView().getResolutionForZoom(8);

    expect(textOf(styleFunction(feature, webMercatorFloor))).toBe("ABC1");
    expect(
      textOf(styleFunction(feature, webMercatorFloor * 2)),
    ).toBeUndefined();

    // Adopting a raster's projection re-scales what a zoom level means. The
    // floor is read through the live view on every call, so the same authored
    // zoom now suppresses the label at a resolution it used to allow -- a value
    // converted once, when the style was applied, would not.
    await act(async () => {
      map.setView(
        new View({ projection: "EPSG:4326", center: [0, 0], zoom: 4 }),
      );
    });

    const degreeFloor = map.getView().getResolutionForZoom(8);
    expect(degreeFloor).not.toBe(webMercatorFloor);
    expect(textOf(styleFunction(feature, degreeFloor))).toBe("ABC1");
    expect(textOf(styleFunction(feature, webMercatorFloor))).toBeUndefined();
  });

  test("a blank zoom floor is not read as zero", async () => {
    const { layers } = await renderMap([
      vectorLayer(
        "Stations",
        {},
        { labels: { template: STATION_TEMPLATE, minZoom: "" } },
      ),
    ]);

    // `Number("")` is 0, a real resolution floor that would hide the label
    // everywhere but the very bottom of the zoom range.
    expect(
      textOf(
        layers.Stations.getStyle()(pointFeature({ station_id: "ABC1" }), 10000),
      ),
    ).toBe("ABC1");
  });
});

// Two kinds of layer are kept across a reconciliation instead of being rebuilt
// -- a runtime layer, whose features were fetched by its plugin and would be
// thrown away by a rebuild, and a shapefile layer, whose archive would be
// refetched and reparsed. Neither is reconstructed, so neither passes through
// the add path where a style is applied: a label edit reaches them only if the
// update path re-applies the style itself.
describe("preserved layers", () => {
  const runtimeLayer = (props = {}, rest = {}) => ({
    type: "VectorLayer",
    props: {
      name: "Stations",
      layerId: "stations-1",
      pluginSource: { source: "station_layer", args: { bbox: "x" } },
      // Empty on purpose: a runtime layer's features are painted into the
      // source by its plugin after construction, which is the whole reason the
      // instance is preserved.
      source: geojsonSource([]),
      opacity: 1,
      zIndex: 1,
      ...props,
    },
    ...rest,
  });

  const shapefileLayer = (props = {}, rest = {}) => ({
    type: "VectorLayer",
    props: {
      name: "Basins",
      source: {
        type: "Shapefile",
        props: { url: "https://example.org/basins.zip" },
      },
      zIndex: 1,
      ...props,
    },
    ...rest,
  });

  // The feature a preserved runtime layer's plugin painted into it. Held on the
  // layer so the assertions can prove a repaint left it alone.
  const paintRuntimeFeature = (olLayer, id = "ABC1") => {
    const feature = pointFeature({ station_id: id });
    olLayer.getSource().addFeature(feature);
    return feature;
  };

  test("editing a label on a preserved runtime layer re-applies the style and retains the layer's existing features", async () => {
    const { olLayer, addLayerSpy, removeLayerSpy, update } = await renderMap([
      runtimeLayer({}, { labels: { template: STATION_TEMPLATE } }),
    ]);
    const painted = paintRuntimeFeature(olLayer);
    expect(textOf(olLayer.getStyle()(painted, 10))).toBe("ABC1");

    update([
      runtimeLayer(
        {},
        // eslint-disable-next-line no-template-curly-in-string
        { labels: { template: "Gauge ${feature.station_id}" } },
      ),
    ]);

    await waitFor(() => {
      expect(textOf(olLayer.getStyle()(painted, 10))).toBe("Gauge ABC1");
    });
    // The instance was kept, so the features the plugin fetched are still
    // there -- a rebuild would have discarded them.
    expect(olLayer.getSource().getFeatures()).toContain(painted);
    expect(addLayerSpy.mock.calls.length).toBe(1);
    expect(removeLayerSpy.mock.calls.length).toBe(0);
  });

  test("clearing a label on a preserved layer removes the text rather than leaving the last label drawn", async () => {
    const { olLayer, addLayerSpy, update } = await renderMap([
      runtimeLayer({}, { labels: { template: STATION_TEMPLATE } }),
    ]);
    const painted = paintRuntimeFeature(olLayer);
    expect(textOf(olLayer.getStyle()(painted, 10))).toBe("ABC1");

    // The label is the only thing this layer had -- there is no style edit
    // alongside it to carry the repaint.
    update([runtimeLayer()]);

    await waitFor(() => {
      expect(textOf(olLayer.getStyle()(painted, 10))).toBeUndefined();
    });
    // The geometry keeps drawing; only the text went away.
    expect(
      stylesOf(olLayer.getStyle()(painted, 10))[0].getImage(),
    ).toBeTruthy();
    // Nothing left to declutter, so the layer stops competing for space.
    expect(olLayer.getDeclutter()).toBeUndefined();
    expect(olLayer.getSource().getFeatures()).toContain(painted);
    expect(addLayerSpy.mock.calls.length).toBe(1);
  });

  test("editing an unrelated property on a labeled preserved layer does not drop the label", async () => {
    const { olLayer, addLayerSpy, update } = await renderMap([
      runtimeLayer({}, { labels: { template: STATION_TEMPLATE } }),
    ]);
    const painted = paintRuntimeFeature(olLayer);
    const group = olLayer.getDeclutter();
    expect(group).toBeTruthy();

    update([
      runtimeLayer(
        { opacity: 0.3 },
        { labels: { template: STATION_TEMPLATE } },
      ),
    ]);

    await waitFor(() => {
      expect(olLayer.getOpacity()).toBe(0.3);
    });
    expect(textOf(olLayer.getStyle()(painted, 10))).toBe("ABC1");
    expect(olLayer.getDeclutter()).toBe(group);
    expect(addLayerSpy.mock.calls.length).toBe(1);
  });

  test("an unrelated property edit on a labeled preserved layer does not re-apply style", async () => {
    const setStyleSpy = jest.spyOn(VectorLayer.prototype, "setStyle");
    const setDeclutterSpy = jest.spyOn(VectorLayer.prototype, "setDeclutter");
    const { olLayer, update } = await renderMap([
      runtimeLayer({}, { labels: { template: STATION_TEMPLATE } }),
    ]);
    const styleFunction = olLayer.getStyle();
    const styleCalls = setStyleSpy.mock.calls.length;
    const declutterCalls = setDeclutterSpy.mock.calls.length;

    update([
      runtimeLayer(
        { opacity: 0.3 },
        { labels: { template: STATION_TEMPLATE } },
      ),
    ]);

    await waitFor(() => {
      expect(olLayer.getOpacity()).toBe(0.3);
    });
    // Re-styling on every reconciliation would re-run the styling attempt and
    // raise a change event for every unrelated edit, forcing the layer to
    // replay its whole render -- so the stamp has to cover the label as well as
    // the style without firing on anything else.
    expect(setStyleSpy.mock.calls.length).toBe(styleCalls);
    expect(setDeclutterSpy.mock.calls.length).toBe(declutterCalls);
    expect(olLayer.getStyle()).toBe(styleFunction);
  });

  test("a preserved layer gaining its first label has decluttering enabled without being rebuilt", async () => {
    const { olLayer, addLayerSpy, removeLayerSpy, update } = await renderMap([
      runtimeLayer({}, { style: styleRules }),
    ]);
    const painted = paintRuntimeFeature(olLayer);
    // Built without decluttering, because it had no labels to declutter.
    expect(olLayer.getDeclutter()).toBeUndefined();

    update([
      runtimeLayer(
        {},
        { labels: { template: STATION_TEMPLATE }, style: styleRules },
      ),
    ]);

    await waitFor(() => {
      expect(olLayer.getDeclutter()).toBeTruthy();
    });
    // `setDeclutter` is a live setter, so the layer never had to be rebuilt to
    // gain it -- which it could not be without losing its features.
    expect(textOf(olLayer.getStyle()(painted, 10))).toBe("ABC1");
    expect(olLayer.getSource().getFeatures()).toContain(painted);
    expect(addLayerSpy.mock.calls.length).toBe(1);
    expect(removeLayerSpy.mock.calls.length).toBe(0);
  });

  test("a label change on a preserved shapefile layer re-applies style even though the style rules are unchanged", async () => {
    const { olLayer, addLayerSpy, update } = await renderMap([
      shapefileLayer({}, { style: styleRules }),
    ]);
    const feature = pointFeature({ station_id: "ABC1" });
    expect(textOf(olLayer.getStyle()(feature, 10))).toBeUndefined();

    // Only the label changed. The style rules are identical, which is exactly
    // what the old change check compared.
    update([
      shapefileLayer(
        {},
        { labels: { template: STATION_TEMPLATE }, style: styleRules },
      ),
    ]);

    await waitFor(() => {
      expect(textOf(olLayer.getStyle()(feature, 10))).toBe("ABC1");
    });
    expect(olLayer.getDeclutter()).toBeTruthy();
    expect(olLayer.get("appliedStyle")).toEqual(styleRules);
    expect(addLayerSpy.mock.calls.length).toBe(1);
  });

  test("clearing a label on a preserved shapefile layer removes the text and stops decluttering", async () => {
    const { olLayer, addLayerSpy, update } = await renderMap([
      shapefileLayer(
        {},
        { labels: { template: STATION_TEMPLATE }, style: styleRules },
      ),
    ]);
    const feature = pointFeature({ station_id: "ABC1" });
    expect(textOf(olLayer.getStyle()(feature, 10))).toBe("ABC1");

    update([shapefileLayer({}, { style: styleRules })]);

    await waitFor(() => {
      expect(textOf(olLayer.getStyle()(feature, 10))).toBeUndefined();
    });
    expect(olLayer.getDeclutter()).toBeUndefined();
    expect(addLayerSpy.mock.calls.length).toBe(1);
  });
});

describe("label config edge cases", () => {
  // eslint-disable-next-line no-template-curly-in-string
  const TEMPLATE = "${feature.station_id}";

  it("reads a blank template as no label at all", () => {
    // Opening the Labels tab and leaving without typing persists a config
    // object. Treating its existence as "has labels" would declutter the layer
    // and divert its styling for something that draws nothing.
    expect(readLabelConfig({ labels: { template: "" } })).toBeNull();
    expect(readLabelConfig({ labels: { template: "   " } })).toBeNull();
    expect(readLabelConfig({ labels: { anchor: "n" } })).toBeNull();
  });

  it("reads anything that is not a plain object as no label", () => {
    expect(readLabelConfig(undefined)).toBeNull();
    expect(readLabelConfig({})).toBeNull();
    expect(readLabelConfig({ labels: "station_id" })).toBeNull();
    expect(readLabelConfig({ labels: [{ template: TEMPLATE }] })).toBeNull();
  });

  it("reads a populated template from the layer's own `labels` key", () => {
    expect(readLabelConfig({ labels: { template: TEMPLATE } })).toEqual({
      template: TEMPLATE,
    });
    // `labels` is a sibling of `style` on the layer configuration. Nothing
    // nested under `props` is a label, so a config written that way draws none
    // rather than being picked up from two places at once.
    expect(
      readLabelConfig({ props: { labels: { template: TEMPLATE } } }),
    ).toBeNull();
  });

  it("does not treat a vector-tile style document as rule-based", () => {
    // A Mapbox style document must keep its own rendering path -- diverting it
    // to the rule-based style function would discard the whole style.
    expect(isRuleBasedStyle({ version: 8, layers: [], sources: {} })).toBe(
      false,
    );
    expect(isRuleBasedStyle("styles/basemap.json")).toBe(false);
    expect(isRuleBasedStyle(undefined)).toBe(false);
    expect(isRuleBasedStyle([{ rules: [] }])).toBe(false);
    expect(isRuleBasedStyle({ default: { point: {} } })).toBe(true);
    expect(isRuleBasedStyle({ rules: [] })).toBe(true);
  });
});

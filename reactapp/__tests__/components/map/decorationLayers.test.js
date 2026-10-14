import {
  buildDecorationContent,
  buildDecorationLayerEntry,
  defaultLinkedExtentStyle,
  isDecorationLayerConfig,
  isDecorationLayerEntry,
  isDecorationSourceType,
  resolveLinkedExtentStyle,
} from "components/map/decorationLayers";

describe("decoration type checks", () => {
  it("recognizes Annotations and Linked Extents and nothing else", () => {
    expect(isDecorationSourceType("Annotations")).toBe(true);
    expect(isDecorationSourceType("Linked Extents")).toBe(true);
    expect(isDecorationSourceType("GeoJSON")).toBe(false);
    expect(isDecorationSourceType(undefined)).toBe(false);
  });

  it("reads the source type off a configuration and a saved entry", () => {
    const configuration = {
      type: "VectorLayer",
      props: { name: "A", source: { type: "Annotations", props: {} } },
    };
    expect(isDecorationLayerConfig(configuration)).toBe(true);
    expect(isDecorationLayerEntry({ configuration })).toBe(true);
    expect(isDecorationLayerConfig({ props: {} })).toBe(false);
    expect(isDecorationLayerEntry(null)).toBe(false);
  });
});

describe("resolveLinkedExtentStyle", () => {
  it("fills unset or invalid values from the defaults", () => {
    expect(resolveLinkedExtentStyle(undefined)).toEqual(
      defaultLinkedExtentStyle,
    );
    expect(
      resolveLinkedExtentStyle({ color: "", width: -1, fillColor: "red" }),
    ).toEqual({ ...defaultLinkedExtentStyle, fillColor: "red" });
  });
});

describe("buildDecorationContent", () => {
  it("gives a Linked Extents layer an empty source, its style and the tag", () => {
    const { source, style, properties } = buildDecorationContent(
      {
        props: { source: { type: "Linked Extents", props: {} } },
        linkedExtentStyle: { color: "#00ff00", width: 5 },
      },
      "EPSG:3857",
    );
    expect(source.getFeatures()).toEqual([]);
    expect(style.getStroke().getColor()).toBe("#00ff00");
    expect(style.getStroke().getWidth()).toBe(5);
    expect(properties).toEqual({ linkedExtentOutlines: true });
  });
});

describe("buildDecorationLayerEntry", () => {
  it("writes an Annotations entry with its annotations and no popups", () => {
    expect(
      buildDecorationLayerEntry({
        sourceType: "Annotations",
        layerProps: { name: "Callouts", opacity: 0.5 },
        annotations: { items: [] },
      }),
    ).toEqual({
      configuration: {
        type: "VectorLayer",
        props: {
          name: "Callouts",
          opacity: 0.5,
          source: { type: "Annotations", props: {} },
        },
        annotations: { defaults: {}, items: [] },
      },
      tablePopupType: "none",
    });
  });

  it("writes a Linked Extents entry's style only when one was set", () => {
    const base = {
      sourceType: "Linked Extents",
      layerProps: { name: "Inset" },
    };
    expect(
      buildDecorationLayerEntry({ ...base, linkedExtentStyle: {} })
        .configuration,
    ).not.toHaveProperty("linkedExtentStyle");
    expect(
      buildDecorationLayerEntry({
        ...base,
        linkedExtentStyle: { width: 3 },
        layerVisibility: false,
      }).configuration,
    ).toMatchObject({
      linkedExtentStyle: { width: 3 },
      layerVisibility: false,
    });
  });
});

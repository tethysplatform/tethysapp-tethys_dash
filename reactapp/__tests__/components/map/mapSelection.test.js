import {
  resolveMapSelection,
  mapSelectionLegendEntries,
} from "components/map/mapSelection";
import { createHighlightLayer } from "components/map/utilities";

describe("resolveMapSelection", () => {
  const DEFAULTS = {
    clickedLocation: { map: true, legend: false, layerControl: true },
    selectedFeature: { map: true, legend: false, layerControl: true },
  };

  test.each([
    ["undefined", undefined],
    ["null", null],
    ["an empty object", {}],
  ])("%s resolves to today's behavior", (_, value) => {
    expect(resolveMapSelection(value)).toStrictEqual(DEFAULTS);
  });

  test("a partial value overrides only what it names", () => {
    expect(
      resolveMapSelection({
        clickedLocation: { map: false },
        selectedFeature: { legend: true },
      }),
    ).toStrictEqual({
      clickedLocation: { map: false, legend: false, layerControl: false },
      selectedFeature: { map: true, legend: true, layerControl: true },
    });
  });

  test("a mark can be left out of the layer control", () => {
    expect(
      resolveMapSelection({ clickedLocation: { layerControl: false } }),
    ).toStrictEqual({
      ...DEFAULTS,
      clickedLocation: { map: true, legend: false, layerControl: false },
    });
  });

  test("the legend entry and the layer-control row are forced off while the mark is hidden from the map", () => {
    expect(
      resolveMapSelection({
        selectedFeature: { map: false, legend: true, layerControl: true },
      }),
    ).toStrictEqual({
      ...DEFAULTS,
      selectedFeature: { map: false, legend: false, layerControl: false },
    });
  });

  test.each([
    ["a string", "hide"],
    ["a number", 1],
    ["an array", [{ map: false }]],
    ["a non-object entry", { clickedLocation: false, selectedFeature: "x" }],
    [
      "non-boolean fields",
      {
        clickedLocation: { map: "false", legend: "true", layerControl: "no" },
        selectedFeature: { map: 0, legend: 1, layerControl: 0 },
      },
    ],
  ])("ignores %s in favor of the defaults", (_, value) => {
    expect(resolveMapSelection(value)).toStrictEqual(DEFAULTS);
  });
});

describe("mapSelectionLegendEntries", () => {
  test("lists nothing at the defaults", () => {
    expect(mapSelectionLegendEntries(resolveMapSelection({}))).toStrictEqual(
      [],
    );
  });

  test("lists the clicked location before the selected feature, each as a single-item entry in the drawn colors", () => {
    const entries = mapSelectionLegendEntries(
      resolveMapSelection({
        selectedFeature: { legend: true },
        clickedLocation: { legend: true },
      }),
    );

    expect(entries).toStrictEqual([
      {
        title: "Clicked location",
        items: [{ label: "Clicked location", symbol: "pin", color: "#007bff" }],
      },
      {
        title: "Selected feature",
        items: [
          {
            label: "Selected feature",
            symbol: "circle",
            color: "transparent",
            stroke: "#00008b",
          },
        ],
      },
    ]);
    // The same colors the click draws with.
    expect(createHighlightLayer().getStyle().getStroke().getColor()).toBe(
      entries[1].items[0].stroke,
    );
  });

  test("lists only the rows whose legend box is on", () => {
    expect(
      mapSelectionLegendEntries(
        resolveMapSelection({ selectedFeature: { legend: true } }),
      ).map((entry) => entry.title),
    ).toStrictEqual(["Selected feature"]);
  });
});

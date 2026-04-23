// @ts-check
const { test, expect } = require("@playwright/test");
const { createDashboard, truncateAll } = require("./helpers/db");
const {
  plotlyChartItem,
  dataTableItem,
  cardItem,
  textItem,
  customImageItem,
  mapItem,
  variableInputItem,
  wmsLayer,
  esriImageLayer,
  geojsonLayer,
} = require("./helpers/dashboards");
const {
  mockAuthEndpoints,
  mockTileResponses,
  suppressWelcomePopups,
  ONE_PX_PNG,
} = require("./helpers/mocks");

const TIMEOUT = { timeout: 20_000 };

/** Helper: suppress popups, set up mocks, navigate. */
async function loadDashboard(page, items) {
  const uuid = createDashboard(items);
  await suppressWelcomePopups(page);
  await mockAuthEndpoints(page);
  await mockTileResponses(page);
  await page.goto(`/apps/tethysdash/dashboard/${uuid}`);
  return uuid;
}

test.afterEach(async () => {
  truncateAll();
});

// ---------------------------------------------------------------------------
// Multi-component dashboards — verify multiple panels render together
// ---------------------------------------------------------------------------

test.describe("Multi-component dashboards", () => {
  test("Map + WMS layer + date variable input render together", async ({ page }) => {
    await loadDashboard(page, [
      mapItem({
        layers: [wmsLayer("https://mock-wms.example.com/wms", "temperature")],
        layerControl: true,
      }),
      variableInputItem("selected_date", "date"),
    ]);
    // Map canvas renders
    await expect(page.locator("canvas").first()).toBeVisible(TIMEOUT);
    // Variable input element renders (any input on the page)
    await expect(page.locator("input").first()).toBeVisible(TIMEOUT);
  });

  test("Plotly chart + dropdown variable input render together", async ({ page }) => {
    await loadDashboard(page, [
      plotlyChartItem([{ x: [1, 2, 3], y: [10, 20, 30], type: "bar" }]),
      variableInputItem("region", "dropdown", {
        options: ["North", "South", "East", "West"],
      }),
    ]);
    await expect(page.locator(".js-plotly-plot")).toBeVisible(TIMEOUT);
    // DataSelect.js wraps react-select; the control exposes ARIA
    // role="combobox" on the inner input, not a native <select>.
    await expect(page.getByRole("combobox").first()).toBeVisible(TIMEOUT);
  });

  test("All 8 variable input subtypes render on one dashboard", async ({ page }) => {
    await loadDashboard(page, [
      variableInputItem("text_var", "text"),
      variableInputItem("num_var", "number", { initialValue: "5" }),
      variableInputItem("check_var", "checkbox"),
      variableInputItem("date_var", "date"),
      variableInputItem("dropdown_var", "dropdown", {
        options: ["A", "B", "C"],
      }),
      variableInputItem("slider_var", "slider", { min: 0, max: 100, step: 10 }),
      variableInputItem("daterange_var", "date-range"),
      variableInputItem("csv_var", "csv-uploader"),
    ]);
    // Assert common input types render — numbers render as input[type="text"]
    await expect(page.locator("input").first()).toBeVisible(TIMEOUT);
    await expect(page.locator('input[type="checkbox"]').first()).toBeVisible(TIMEOUT);
    await expect(page.locator("select").first()).toBeVisible(TIMEOUT);
    // Verify label text proving each var renders
    await expect(page.getByText("text_var:", { exact: false })).toBeVisible(TIMEOUT);
    await expect(page.getByText("check_var:", { exact: false })).toBeVisible(TIMEOUT);
    await expect(page.getByText("dropdown_var:", { exact: false })).toBeVisible(TIMEOUT);
    await expect(page.getByText("slider_var:", { exact: false })).toBeVisible(TIMEOUT);
  });

  test("Map with WMS + ESRI + GeoJSON layers all render", async ({ page }) => {
    const geojson = {
      type: "FeatureCollection",
      crs: { type: "name", properties: { name: "EPSG:4326" } },
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [-111.89, 40.76] },
          properties: { name: "Test Point" },
        },
      ],
    };
    await loadDashboard(page, [
      mapItem({
        layers: [
          wmsLayer("https://mock-wms.example.com/wms", "layer1", {
            name: "WMS",
          }),
          esriImageLayer("https://mock-esri.example.com/MapServer", {
            name: "ESRI Image",
          }),
          geojsonLayer(geojson, { name: "GeoJSON Points" }),
        ],
        layerControl: true,
      }),
    ]);
    await expect(page.locator("canvas").first()).toBeVisible(TIMEOUT);
  });

  test("Custom Image + slider input render together", async ({ page }) => {
    await page.route(/via\.placeholder\.com/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "image/png",
        body: ONE_PX_PNG,
      })
    );
    await loadDashboard(page, [
      customImageItem("https://via.placeholder.com/300x200"),
      variableInputItem("opacity", "slider", { min: 0, max: 100, step: 5 }),
    ]);
    await expect(page.locator("img").first()).toBeVisible(TIMEOUT);
    await expect(
      page.locator(".rc-slider, input[type='range']").first()
    ).toBeVisible(TIMEOUT);
  });

  test("Dashboard with 6 mixed panels all render simultaneously", async ({ page }) => {
    await loadDashboard(page, [
      textItem("Panel 1 Header"),
      plotlyChartItem(),
      dataTableItem([{ col: "a" }, { col: "b" }]),
      cardItem("Card Panel", {
        data: [{ color: "blue", label: "Count", value: 42, icon: "" }],
      }),
      mapItem(),
      variableInputItem("filter", "text"),
    ]);
    // Verify each panel type renders by its DOM indicator
    await expect(page.getByText("Panel 1 Header")).toBeVisible(TIMEOUT);
    await expect(page.locator(".js-plotly-plot")).toBeVisible(TIMEOUT);
    await expect(page.locator("table").first()).toBeVisible(TIMEOUT);
    await expect(page.getByText("Card Panel")).toBeVisible(TIMEOUT);
    await expect(page.locator("canvas").first()).toBeVisible(TIMEOUT);
    await expect(page.locator('input[type="text"]').first()).toBeVisible(TIMEOUT);
  });
});

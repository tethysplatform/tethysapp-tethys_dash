// @ts-check
const { test, expect } = require("@playwright/test");
const { createDashboard, truncateAll } = require("./helpers/db");
const {
  textItem,
  plotlyChartItem,
  dataTableItem,
  cardItem,
  customImageItem,
  mapItem,
  variableInputItem,
} = require("./helpers/dashboards");
const {
  mockAuthEndpoints,
  mockTileResponses,
  mockApiVisualization,
  suppressWelcomePopups,
  ONE_PX_PNG,
} = require("./helpers/mocks");

const TIMEOUT = { timeout: 15_000 };

/** Helper: suppress popups, set up mocks, navigate. */
async function navigateToDashboard(page, items) {
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
// Inline visualization types
// ---------------------------------------------------------------------------

test.describe("Text visualization", () => {
  test("renders text content", async ({ page }) => {
    await navigateToDashboard(page, [textItem("Hello E2E World")]);
    await expect(page.getByText("Hello E2E World")).toBeVisible(TIMEOUT);
  });
});

test.describe("Plotly chart", () => {
  test("renders plotly container", async ({ page }) => {
    await navigateToDashboard(page, [plotlyChartItem()]);
    await expect(page.locator(".js-plotly-plot")).toBeVisible(TIMEOUT);
  });
});

test.describe("Data table", () => {
  test("renders table with rows", async ({ page }) => {
    await navigateToDashboard(page, [
      dataTableItem([
        { name: "Alice", value: 10 },
        { name: "Bob", value: 20 },
      ]),
    ]);
    await expect(page.locator("table").first()).toBeVisible(TIMEOUT);
  });
});

test.describe("Card", () => {
  test("renders card with title", async ({ page }) => {
    // Card expects `data` to be an array of {color, label, value, icon} items
    await navigateToDashboard(page, [
      cardItem("Revenue", {
        data: [{ color: "blue", label: "Total", value: 42, icon: "" }],
      }),
    ]);
    await expect(page.getByText("Revenue")).toBeVisible(TIMEOUT);
  });
});

test.describe("Custom Image", () => {
  test("renders image element", async ({ page }) => {
    // Mock the image URL (via.placeholder.com subdomain)
    await page.route(/via\.placeholder\.com/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "image/png",
        body: ONE_PX_PNG,
      })
    );
    await navigateToDashboard(page, [
      customImageItem("https://via.placeholder.com/300x200"),
    ]);
    await expect(page.locator("img").first()).toBeVisible(TIMEOUT);
  });
});

test.describe("Map (no layers)", () => {
  test("renders map canvas", async ({ page }) => {
    await navigateToDashboard(page, [mapItem()]);
    await expect(page.locator("canvas").first()).toBeVisible(TIMEOUT);
  });
});

// ---------------------------------------------------------------------------
// Variable input subtypes
// ---------------------------------------------------------------------------

test.describe("Variable inputs", () => {
  test("text input renders", async ({ page }) => {
    await navigateToDashboard(page, [variableInputItem("test_var", "text")]);
    await expect(page.locator('input[type="text"]').first()).toBeVisible(TIMEOUT);
  });

  test("number input renders", async ({ page }) => {
    await navigateToDashboard(page, [
      variableInputItem("num_var", "number", { initialValue: "5" }),
    ]);
    // Number inputs render as a text-type input with numeric formatting.
    // Anchor on the label to prove the specific panel rendered.
    await expect(page.getByText("num_var:", { exact: false })).toBeVisible(TIMEOUT);
    await expect(page.locator("input").first()).toBeVisible(TIMEOUT);
  });

  test("checkbox input renders", async ({ page }) => {
    await navigateToDashboard(page, [variableInputItem("check_var", "checkbox")]);
    await expect(page.locator('input[type="checkbox"]').first()).toBeVisible(TIMEOUT);
  });

  test("date input renders", async ({ page }) => {
    await navigateToDashboard(page, [variableInputItem("date_var", "date")]);
    // Date inputs render as a date picker component
    await expect(page.locator('input[type="text"]').first()).toBeVisible(TIMEOUT);
  });

  test("dropdown renders with options", async ({ page }) => {
    await navigateToDashboard(page, [
      variableInputItem("select_var", "dropdown", {
        options: ["Option A", "Option B", "Option C"],
      }),
    ]);
    // DataSelect.js wraps react-select; the control exposes ARIA
    // role="combobox" on the inner input, not a native <select>.
    await expect(page.getByRole("combobox").first()).toBeVisible(TIMEOUT);
  });

  test("slider renders without crash", async ({ page }) => {
    await navigateToDashboard(page, [
      variableInputItem("slider_var", "slider", {
        min: 0,
        max: 100,
        step: 10,
      }),
    ]);
    // Slider should render — the key test is that outputFormat is present
    // so formatNumber() doesn't crash with "Cannot read properties of undefined"
    await expect(page.locator(".rc-slider, input[type='range']").first()).toBeVisible(TIMEOUT);
  });

  test("date-range renders", async ({ page }) => {
    await navigateToDashboard(page, [variableInputItem("daterange_var", "date-range")]);
    // Date-range renders as two date picker inputs labeled "Start Date"/"End Date".
    await expect(page.getByText("Start Date", { exact: false })).toBeVisible(TIMEOUT);
    await expect(page.getByText("End Date", { exact: false })).toBeVisible(TIMEOUT);
  });

  test("csv-uploader renders (missing-metadata state)", async ({ page }) => {
    // csv-uploader without headers metadata renders an error message — that's
    // the code path we want to verify doesn't crash the page.
    await navigateToDashboard(page, [variableInputItem("csv_var", "csv-uploader")]);
    await expect(page.getByText("Missing required metadata", { exact: false })).toBeVisible(TIMEOUT);
  });
});

// ---------------------------------------------------------------------------
// Mocked backend plugin viz_types
// ---------------------------------------------------------------------------

/** Helper for backend plugin tests: create dashboard, set mocks, navigate. */
async function setupBackendPluginTest(page, itemUuid, source, vizType, data) {
  const items = [
    {
      uuid: itemUuid,
      source,
      args: { vizSource: source, vizArgs: {} },
      w: 50,
      h: 35,
    },
  ];
  const dashUuid = createDashboard(items);
  await suppressWelcomePopups(page);
  await mockAuthEndpoints(page);
  await mockTileResponses(page);
  await mockApiVisualization(page, itemUuid, vizType, data);
  await page.goto(`/apps/tethysdash/dashboard/${dashUuid}`);
}

test.describe("Backend plugin visualizations", () => {
  test("mocked plotly plugin renders chart", async ({ page }) => {
    const itemUuid = "mock-plotly-" + Date.now();
    await setupBackendPluginTest(page, itemUuid, "test_plotly_plugin", "plotly", {
      data: [{ x: [1, 2], y: [3, 4], type: "scatter" }],
      layout: { title: "Mock Plot" },
    });
    await expect(page.locator(".js-plotly-plot")).toBeVisible(TIMEOUT);
  });

  test("mocked table plugin renders table", async ({ page }) => {
    const itemUuid = "mock-table-" + Date.now();
    await setupBackendPluginTest(page, itemUuid, "test_table_plugin", "table", {
      data: [{ col: "val" }],
      title: "Mock Table",
    });
    await expect(page.locator("table").first()).toBeVisible(TIMEOUT);
  });

  test("mocked image plugin renders img", async ({ page }) => {
    const itemUuid = "mock-image-" + Date.now();
    await page.route(/mock-image\.example\.com/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "image/png",
        body: ONE_PX_PNG,
      })
    );
    // Image viz_type expects `data` to be the URL string directly (not nested)
    await setupBackendPluginTest(
      page,
      itemUuid,
      "test_image_plugin",
      "image",
      "https://mock-image.example.com/image.png"
    );
    await expect(page.locator("img").first()).toBeVisible(TIMEOUT);
  });

  test("mocked card plugin renders card", async ({ page }) => {
    const itemUuid = "mock-card-" + Date.now();
    await setupBackendPluginTest(page, itemUuid, "test_card_plugin", "card", {
      title: "Mock Card",
      data: [{ label: "Metric", value: 99, color: "blue" }],
    });
    await expect(page.getByText("Mock Card")).toBeVisible(TIMEOUT);
  });

  test("mocked text plugin renders text", async ({ page }) => {
    const itemUuid = "mock-text-" + Date.now();
    await setupBackendPluginTest(page, itemUuid, "test_text_plugin", "text", {
      text: "Backend plugin text content",
    });
    await expect(page.getByText("Backend plugin text content")).toBeVisible(TIMEOUT);
  });

  test("mocked map plugin renders map canvas", async ({ page }) => {
    const itemUuid = "mock-map-" + Date.now();
    await setupBackendPluginTest(page, itemUuid, "test_map_plugin", "map", {
      baseMap:
        "https://server.arcgisonline.com/arcgis/rest/services/World_Street_Map/MapServer",
      layers: [],
      layerControl: false,
    });
    await expect(page.locator("canvas").first()).toBeVisible(TIMEOUT);
  });

  test("mocked imageCollection plugin renders multiple images", async ({
    page,
  }) => {
    const itemUuid = "mock-imgcoll-" + Date.now();
    await page.route(/mock-images\.example\.com/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "image/png",
        body: ONE_PX_PNG,
      })
    );
    await setupBackendPluginTest(
      page,
      itemUuid,
      "test_imgcoll_plugin",
      "imageCollection",
      {
        urls: [
          "https://mock-images.example.com/a.png",
          "https://mock-images.example.com/b.png",
        ],
        title: "Mock Collection",
        columns: 2,
      }
    );
    await expect(page.locator("img").first()).toBeVisible(TIMEOUT);
  });
});

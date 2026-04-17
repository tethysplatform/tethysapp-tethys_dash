// @ts-check
const { test, expect } = require("@playwright/test");
const { createDashboard, truncateAll } = require("./helpers/db");
const { textItem } = require("./helpers/dashboards");
const { mockAuthEndpoints, mockTileResponses } = require("./helpers/mocks");

test.afterEach(async () => {
  truncateAll();
});

// ---------------------------------------------------------------------------
// Text visualization
// ---------------------------------------------------------------------------

test.describe("Text visualization", () => {
  test("renders text content from fixture", async ({ page }) => {
    const uuid = createDashboard([textItem("Hello E2E World")]);

    await mockAuthEndpoints(page);
    await mockTileResponses(page);
    await page.goto(`/apps/tethysdash/dashboard/${uuid}`);

    // Text panels render content inside a div
    await expect(page.getByText("Hello E2E World")).toBeVisible({
      timeout: 15_000,
    });
  });
});

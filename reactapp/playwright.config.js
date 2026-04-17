// @ts-check
const { defineConfig } = require("@playwright/test");
const path = require("path");
const os = require("os");

const TEST_PORT = process.env.E2E_PORT || "8765";
const BASE_URL = `http://localhost:${TEST_PORT}`;

module.exports = defineConfig({
  testDir: path.join(__dirname, "__tests__/e2e"),
  testMatch: "**/*.spec.js",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1, // SQLite does not support concurrent writers
  retries: 0,
  reporter: "list",

  use: {
    baseURL: BASE_URL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },

  projects: [
    {
      name: "mocked",
      use: {
        launchOptions: {
          executablePath: process.env.CHROMIUM_PATH || "/usr/sbin/chromium",
        },
        headless: true,
      },
    },
    {
      name: "integration",
      use: {
        launchOptions: {
          executablePath: process.env.CHROMIUM_PATH || "/usr/sbin/chromium",
        },
        headless: true,
      },
    },
  ],

  /* Start Django server before tests.
   * Requires: npm run build (frontend compiled), Tethys env active,
   * and setup-test-db.py already run once.
   *
   * Set E2E_REUSE_SERVER=1 during development to skip auto-start
   * and use a manually started server instead.
   */
  ...(process.env.E2E_REUSE_SERVER
    ? {}
    : {
        webServer: {
          command: `${process.env.TETHYS_BIN || "tethys"} manage start -p ${TEST_PORT}`,
          url: `http://localhost:${TEST_PORT}/`,
          reuseExistingServer: true,
          timeout: 60_000,
        },
      }),
});

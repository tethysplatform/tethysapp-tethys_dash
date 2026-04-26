// @ts-check
/**
 * consoleCapture.js — minimal Playwright helper for capturing browser
 * console output and uncaught page errors during a test.
 *
 * The mcp-server-panel spec uses this in two places:
 *   - Unit 1 (SSRF guard): assert that prop-supplied servers rejected by
 *     `validateServerUrl` produce a `console.warn` with credentials
 *     redacted.
 *   - Unit 3 (post-unmount race): assert that navigating away mid-probe
 *     produces no React "Can't perform a state update on an unmounted
 *     component" warning.
 *
 * Usage:
 *
 *   const capture = createConsoleCapture(page);
 *   await page.goto(...);
 *   // ...interact...
 *   expect(capture.messages.find(m => m.type === "warning" && m.text.includes("rejected"))).toBeTruthy();
 *
 * `messages` collects every console.* call (each entry is `{type, text}`).
 * `errors` collects uncaught page errors (each entry is the Error object).
 *
 * No filtering, no debouncing — keep this tiny so future tests can extend
 * it without coupling to a specific assertion shape.
 */

/**
 * @param {import("@playwright/test").Page} page
 * @returns {{
 *   messages: Array<{ type: string, text: string }>,
 *   errors: Array<Error>,
 * }}
 */
function createConsoleCapture(page) {
  const messages = [];
  const errors = [];

  page.on("console", (msg) => {
    messages.push({ type: msg.type(), text: msg.text() });
  });
  page.on("pageerror", (err) => {
    errors.push(err);
  });

  return { messages, errors };
}

module.exports = { createConsoleCapture };

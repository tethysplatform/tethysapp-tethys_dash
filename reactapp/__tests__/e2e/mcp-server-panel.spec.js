// @ts-check
/**
 * MCP server panel + in-chat signal coverage (Unit 7b).
 *
 * Covers the feature shipped in `docs/plans/2026-04-23-001-feat-mcp-server-
 * health-and-transports-plan.md`:
 *   - 5-state dot per server (grey/yellow/green/orange/red).
 *   - Probe triggers: panel-open, add, Retry.
 *   - URL sanitization (userinfo + known query-string tokens).
 *   - Scheme allowlist — `javascript:` is exercised end-to-end here; the
 *     other rejected schemes (`data:`, `ws:`, `file:`) go through the same
 *     code path in `helpers/url.js::sanitizeMcpUrl` and `transports.js::
 *     pickTransport`, so they're covered transitively but not asserted by a
 *     dedicated test in this spec.
 *   - Server-name XSS defense (angle brackets stripped at persistence).
 *   - In-chat system messages on send-time failure / no-tools outcomes.
 *
 * Mocking strategy
 * ----------------
 * We use `page.route` to intercept all MCP-server fetches. For the FAILED
 * path this is trivial (return 500). For the CONNECTED / NO-TOOLS paths we
 * rely on the SDK's StreamableHTTPClientTransport, which returns a working
 * handshake using pure JSON-RPC POST responses — no SSE streaming fixture
 * required. See `helpers/mocks.js` for the details. URLs in this spec end
 * in `/mcp` so the SDK picks the HTTP transport directly.
 *
 * The ChatSidebar mounts only for users with admin/editor permission on
 * the dashboard. We insert a permission row for the AnonymousUser in each
 * test's setup — see `helpers/db.js` `grantAdminTo: ""` option.
 */
const { test, expect } = require("@playwright/test");
const { createDashboard, truncateAll } = require("./helpers/db");
const { textItem } = require("./helpers/dashboards");
const {
  mockAuthEndpoints,
  mockTileResponses,
  suppressWelcomePopups,
  mockMcpServer,
  mockFailedMcpServer,
  mockZeroToolsMcpServer,
} = require("./helpers/mocks");

// Timing budgets used across the spec.
//
//  - SLOW: panel-open + render after suppressing welcome popups + dashboard
//    chrome boot. 15s tolerates the cold-cache first-test case in CI.
//  - PROBE: a single MCP probe should resolve well within this; the
//    chatbox-core scheduler caps connect+listTools at ~5s + 3s = 8s but
//    most tests use mocked servers that respond in <100ms.
//  - FAST: assertions on already-rendered DOM (state already settled, just
//    waiting for React to flush a single setState).
const SLOW = { timeout: 15_000 };
const PROBE = { timeout: 10_000 };
const FAST = { timeout: 5_000 };

// Backwards-compat alias: many tests below historically used TIMEOUT for
// "the slowest thing in the suite." Keep it pointing at SLOW so existing
// tests stay readable.
const TIMEOUT = SLOW;

// Mock URLs — the ".test" TLD is reserved (RFC 2606) so these never resolve
// on a real network; every request MUST be caught by page.route or it will
// error out visibly rather than silently hitting a real server somewhere.
const GOOD_URL = "http://mock-mcp.test/mcp";
const ZERO_TOOLS_URL = "http://mock-zero.test/mcp";
const BAD_URL = "http://mock-bad.test/mcp";

// A representative MCP tool fixture. Only `name` + a schema are required
// for list_tools; description is optional but realistic.
const SAMPLE_TOOLS = [
  {
    name: "echo",
    description: "Echo a message back",
    inputSchema: { type: "object", properties: { message: { type: "string" } } },
  },
];

/**
 * Open the chat sidebar → click the MCP button → wait for the panel.
 *
 * The "chatSidebarToggle" name matches the dashboard header button's
 * aria-label (defined in `reactapp/components/layout/Header.js` —
 * `aria-label="chatSidebarToggle"` on the speech-bubble icon). Likewise,
 * "Manage MCP servers" matches the MCP toolbar button's aria-label in
 * `chatbox-core/components/ChatInputBar.jsx`.
 */
async function openMcpPanel(page) {
  await page.getByRole("button", { name: "chatSidebarToggle" }).click();
  await page.getByRole("button", { name: "Manage MCP servers" }).click();
  // The panel renders its MCP Servers header once mounted.
  await expect(page.getByText("MCP Servers", { exact: true })).toBeVisible(SLOW);
}

/**
 * Seed user MCP servers into localStorage before React initializes. This
 * mirrors what `storage/mcpStorage.js` writes when the user adds servers
 * interactively, so the chatbox picks them up on first render.
 */
async function seedUserMcpServers(page, servers) {
  await page.addInitScript((initServers) => {
    try {
      localStorage.setItem("chatbox_mcp_servers", JSON.stringify(initServers));
    } catch {
      // ignore
    }
  }, servers);
}

/** Read the persisted MCP servers from the page's localStorage. */
async function readStoredMcpServers(page) {
  return page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem("chatbox_mcp_servers") || "[]");
    } catch {
      return [];
    }
  });
}

/**
 * Navigate to a fresh dashboard owned by AnonymousUser with admin
 * permissions (so the ChatSidebar mounts). Returns the dashboard UUID.
 */
async function loadEditableDashboard(page, opts = {}) {
  const uuid = createDashboard([textItem("MCP test dashboard")], {
    name: opts.name || "MCP panel e2e",
    public: true,
    grantAdminTo: "", // empty username == AnonymousUser
  });
  await suppressWelcomePopups(page);
  if (opts.seedServers) await seedUserMcpServers(page, opts.seedServers);
  await mockAuthEndpoints(page);
  await mockTileResponses(page);
  await page.goto(`/apps/tethysdash/dashboard/${uuid}`);
  return uuid;
}

test.afterEach(async () => {
  truncateAll();
});

// ---------------------------------------------------------------------------
// Panel-open probe — happy path (connected)
// ---------------------------------------------------------------------------

test.describe("MCP panel — probe lifecycle", () => {
  test("panel-open probe resolves a connected server to green", async ({ page }) => {
    await loadEditableDashboard(page, {
      seedServers: [{ url: GOOD_URL, name: "Good", enabled: true }],
    });
    await mockMcpServer(page, GOOD_URL, SAMPLE_TOOLS);
    await openMcpPanel(page);

    // Probe takes up to ~5s (timeout budget) + 400ms yellow-min + SDK roundtrips.
    // Role-based locator per docs/solutions/test-failures/playwright-react-select-dropdown-locator.
    await expect(
      page.getByRole("img", { name: /status: connected/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("zero-tools server settles to the orange no-tools state", async ({ page }) => {
    await loadEditableDashboard(page, {
      seedServers: [{ url: ZERO_TOOLS_URL, name: "Empty", enabled: true }],
    });
    await mockZeroToolsMcpServer(page, ZERO_TOOLS_URL);
    await openMcpPanel(page);

    await expect(
      page.getByRole("img", { name: /connected but no tools/i }),
    ).toBeVisible({ timeout: 10_000 });
    // Inline B9 copy.
    await expect(page.getByText(/exposes no tools/i)).toBeVisible(TIMEOUT);
  });

  test("unreachable server ends up red with Retry button", async ({ page }) => {
    await loadEditableDashboard(page, {
      seedServers: [{ url: BAD_URL, name: "Bad", enabled: true }],
    });
    await mockFailedMcpServer(page, BAD_URL, { statusCode: 500 });
    await openMcpPanel(page);

    await expect(
      page.getByRole("img", { name: /connection failed/i }),
    ).toBeVisible({ timeout: 10_000 });
    // Retry is the only button with "Retry connection" in its aria-label.
    await expect(
      page.getByRole("button", { name: /retry connection to bad/i }),
    ).toBeVisible(TIMEOUT);
    // Error text comes from the B8 enum — verify the failed variant is shown.
    // The exact copy is "Connection failed" but we match loosely to avoid
    // tight coupling to ERROR_COPY literals.
    await expect(page.getByText(/connection failed/i).first()).toBeVisible(TIMEOUT);
  });

  test("Retry on a red row flips dot back to yellow, then resolves", async ({ page }) => {
    // First load the server as failed so the dot is red from the panel-open probe.
    await loadEditableDashboard(page, {
      seedServers: [{ url: BAD_URL, name: "Bad", enabled: true }],
    });
    await mockFailedMcpServer(page, BAD_URL, { statusCode: 500 });
    await openMcpPanel(page);
    const retryBtn = page.getByRole("button", { name: /retry connection to bad/i });
    await expect(retryBtn).toBeVisible({ timeout: 10_000 });

    // Swap the route to succeed, click Retry, and observe the dot settle green.
    // Playwright's page.unroute + page.route model the latest-registered
    // handler, so we just install a new one and Playwright uses it.
    await page.unroute(BAD_URL);
    await mockMcpServer(page, BAD_URL, SAMPLE_TOOLS);
    await retryBtn.click();

    // The scheduler announces yellow immediately on schedule().
    await expect(
      page.getByRole("img", { name: /checking connection/i }),
    ).toBeVisible({ timeout: 5_000 });
    // Eventually resolves to connected.
    await expect(
      page.getByRole("img", { name: /status: connected/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("disabled server shows grey and does not probe", async ({ page }) => {
    let requestCount = 0;
    await loadEditableDashboard(page, {
      seedServers: [{ url: GOOD_URL, name: "Good", enabled: false }],
    });
    await page.route(GOOD_URL, (route) => {
      requestCount += 1;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "{}",
      });
    });
    await openMcpPanel(page);

    // Dot is grey (disabled). The panel also exposes it via ARIA.
    await expect(
      page.getByRole("img", { name: /status: disabled/i }),
    ).toBeVisible(TIMEOUT);

    // The panel's mount effect (which would fire panel-open probes) ran
    // synchronously during render — by the time the disabled dot is visible,
    // the scheduler has already had its chance to probe. No fetch should
    // have landed at GOOD_URL. This replaces a 1s real-time sleep that was
    // both flaky on slow CI and overspecified — the rendered grey dot IS
    // the "we decided not to probe" signal.
    expect(requestCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Add-form flows — sanitization + scheme allowlist + XSS
// ---------------------------------------------------------------------------

test.describe("MCP panel — add form sanitization", () => {
  test("URL userinfo is stripped on save and the D1 alert appears", async ({ page }) => {
    await loadEditableDashboard(page);
    await openMcpPanel(page);

    await page.getByPlaceholder(/server name/i).fill("With creds");
    await page
      .getByPlaceholder(/server url/i)
      .fill("http://user:pass@sanitize-userinfo.test/mcp");
    await page.getByRole("button", { name: /add server/i }).click();

    // D1 dismissible alert shows after a successful-but-stripped save.
    await expect(page.getByText(/credentials were removed/i)).toBeVisible(TIMEOUT);

    // Persisted URL must be credential-free.
    const stored = await readStoredMcpServers(page);
    expect(stored).toHaveLength(1);
    expect(stored[0].url).not.toContain("user:pass");
    expect(stored[0].url).not.toContain("@");

    // Dismiss the alert via the × button; it should disappear.
    await page
      .getByRole("button", { name: /dismiss credential-removed notice/i })
      .click();
    await expect(page.getByText(/credentials were removed/i)).not.toBeVisible();
  });

  test("?token=... in URL is stripped without user-visible credential leak", async ({
    page,
  }) => {
    await loadEditableDashboard(page);
    await openMcpPanel(page);

    await page
      .getByPlaceholder(/server url/i)
      .fill("http://sanitize-token.test/mcp?token=abc&keep=yes");
    await page.getByRole("button", { name: /add server/i }).click();

    await expect(page.getByText(/credentials were removed/i)).toBeVisible(TIMEOUT);

    const stored = await readStoredMcpServers(page);
    expect(stored).toHaveLength(1);
    expect(stored[0].url).not.toContain("token=abc");
    // Benign query params are preserved.
    expect(stored[0].url).toContain("keep=yes");
  });

  test("javascript: scheme is refused with an inline form error", async ({ page }) => {
    await loadEditableDashboard(page);
    await openMcpPanel(page);

    await page
      .getByPlaceholder(/server url/i)
      // eslint-disable-next-line no-script-url
      .fill("javascript:alert(1)");
    await page.getByRole("button", { name: /add server/i }).click();

    // Inline error message from the scheme-allowlist check.
    await expect(page.getByText(/must be http:\/\/ or https:\/\//i)).toBeVisible(
      TIMEOUT,
    );

    // Nothing persisted.
    const stored = await readStoredMcpServers(page);
    expect(stored).toHaveLength(0);
  });

  test("server names with angle brackets are stripped at persistence", async ({
    page,
  }) => {
    await loadEditableDashboard(page);
    await openMcpPanel(page);

    await page
      .getByPlaceholder(/server name/i)
      .fill("<img src=x onerror=alert(1)>");
    await page
      .getByPlaceholder(/server url/i)
      .fill("http://xss-name.test/mcp");
    await page.getByRole("button", { name: /add server/i }).click();

    // Persisted name has angle brackets stripped per sanitizeServerName.
    const stored = await readStoredMcpServers(page);
    expect(stored).toHaveLength(1);
    expect(stored[0].name).not.toContain("<");
    expect(stored[0].name).not.toContain(">");

    // The name renders as escaped text — no <img> element reaches the DOM
    // via the server-card. Use a query scoped to known text to confirm the
    // sanitized string is what's displayed.
    const img = page.locator('img[src="x"]');
    await expect(img).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// Scheduler lifecycle wiring (add / toggle / remove)
// ---------------------------------------------------------------------------
//
// Regression guard for the class of bugs where panel lifecycle events
// (add/toggle-on/toggle-off/remove) do not drive the probe scheduler.
// Before commit be72f01 the add-path specifically failed this contract —
// newly-added servers stayed grey until the user reloaded the page and
// the mount-effect's onPanelOpen iteration finally probed them.
//
// Per Unit 4 of the MCP health-probe plan:
//   - add         → scheduler.schedule(url)
//   - toggle-on   → scheduler.schedule(url)
//   - toggle-off  → scheduler.cancel(url) + status = grey
//   - remove      → scheduler.cancel(url) + status cleared
//
// If any of these break, the user sees the wrong dot state without the
// "reload fixes it" workaround.

test.describe("MCP panel — scheduler lifecycle wiring", () => {
  test("add triggers a probe immediately (no reload needed)", async ({ page }) => {
    // This is the direct regression test for the bug report: adding
    // https://subwayinfo.nyc/mcp showed grey until reload. The fix in
    // Chatbox.jsx handleAddMcpServer must call scheduler.schedule against
    // the newly-persisted URL so the row flips through yellow → green
    // within a few seconds of the add click.
    const NEW_URL = "http://add-probe.test/mcp";
    await loadEditableDashboard(page);
    await mockMcpServer(page, NEW_URL, SAMPLE_TOOLS);
    await openMcpPanel(page);

    // Starting state — no servers, no status entries.
    await expect(page.getByText(/no mcp servers configured/i)).toBeVisible(TIMEOUT);

    // Submit the add form with a reachable mocked URL.
    await page.getByPlaceholder(/server url/i).fill(NEW_URL);
    await page.getByRole("button", { name: /add server/i }).click();

    // Assertion: the freshly-added row settles to green WITHOUT any page
    // reload. Pre-fix behavior was grey until reload.
    await expect(
      page.getByRole("img", { name: /status: connected/i }),
    ).toBeVisible(TIMEOUT);

    // Sanity: the URL actually persisted (rules out an invalid-scheme
    // form-error path that would mask the probe-wiring question).
    const stored = await readStoredMcpServers(page);
    expect(stored).toHaveLength(1);
    expect(stored[0].url).toBe(NEW_URL);
  });

  test("toggle-on a disabled server fires a probe and flips to green", async ({ page }) => {
    // Seeds a disabled server so the panel-open effect does NOT probe it
    // (disabled servers are filtered out of the probe iteration), then
    // clicks the dot to enable. The enable path must itself schedule.
    await loadEditableDashboard(page, {
      seedServers: [{ url: GOOD_URL, name: "Toggle-me", enabled: false }],
    });
    await mockMcpServer(page, GOOD_URL, SAMPLE_TOOLS);
    await openMcpPanel(page);

    // Starting state: disabled → grey, no probe fires.
    await expect(
      page.getByRole("img", { name: /status: disabled/i }),
    ).toBeVisible(TIMEOUT);

    // Click the dot container to toggle on. The title attribute is the
    // stable selector (ARIA role is "img" on the dot itself, not its
    // clickable wrapper).
    // Use a regex match against the title attribute so a future copy tweak
    // (e.g., "Click to enable server") doesn't silently break the test.
    await page.getByTitle(/click to enable/i).click();

    // A probe must fire and resolve to green.
    await expect(
      page.getByRole("img", { name: /status: connected/i }),
    ).toBeVisible(TIMEOUT);
  });

  test("toggle-off flips an enabled server to grey immediately", async ({ page }) => {
    // Seeded enabled server → panel-open probe → green. Then toggle off →
    // the dot must return to grey (scheduler.cancel + explicit grey write).
    await loadEditableDashboard(page, {
      seedServers: [{ url: GOOD_URL, name: "Toggle-off-me", enabled: true }],
    });
    await mockMcpServer(page, GOOD_URL, SAMPLE_TOOLS);
    await openMcpPanel(page);

    // Initial probe resolves to green.
    await expect(
      page.getByRole("img", { name: /status: connected/i }),
    ).toBeVisible(TIMEOUT);

    // Toggle off. The dot must flip to grey without requiring a reload.
    await page.getByTitle(/click to disable/i).click();
    await expect(
      page.getByRole("img", { name: /status: disabled/i }),
    ).toBeVisible(TIMEOUT);
  });

  test("remove drops the row and clears its status entry", async ({ page }) => {
    // Seeded enabled server → probe green → click Remove → the row is
    // gone from the panel and from localStorage. Implicitly verifies
    // handleRemoveMcpServer runs scheduler.cancel + mcpStatus delete +
    // userMcpServers mutation in one coordinated handler — before
    // commit be72f01 the cancel piece was missing.
    await loadEditableDashboard(page, {
      seedServers: [{ url: GOOD_URL, name: "Remove-me", enabled: true }],
    });
    await mockMcpServer(page, GOOD_URL, SAMPLE_TOOLS);
    await openMcpPanel(page);

    // Wait for initial probe to resolve so the row is fully mounted.
    await expect(
      page.getByRole("img", { name: /status: connected/i }),
    ).toBeVisible(TIMEOUT);

    // Click Remove.
    await page
      .getByRole("button", { name: /remove remove-me/i })
      .click();

    // Row gone from the UI.
    await expect(page.getByText("Remove-me", { exact: true })).toHaveCount(0);
    // Persisted server list is empty.
    const stored = await readStoredMcpServers(page);
    expect(stored).toHaveLength(0);
    // Panel falls back to empty-state copy.
    await expect(page.getByText(/no mcp servers configured/i)).toBeVisible(TIMEOUT);
  });
});

// ---------------------------------------------------------------------------
// Retry double-click guard
// ---------------------------------------------------------------------------

test.describe("MCP panel — Retry interaction during probe", () => {
  test("Retry click during a red row transitions to yellow and hides the button", async ({
    page,
  }) => {
    // Plan B10 specifies Retry is disabled while the row is yellow. The
    // shipped implementation goes one step further: the Retry affordance is
    // rendered only on rows whose state is `red` (MCPServerPanel.jsx ~431).
    // When the state flips to yellow after Retry click, the entire error
    // line (which contains the Retry button) unmounts — which trivially
    // satisfies the "no-op second click while probing" requirement since
    // the user has no button to click a second time.
    await loadEditableDashboard(page, {
      seedServers: [{ url: BAD_URL, name: "Bad", enabled: true }],
    });
    await mockFailedMcpServer(page, BAD_URL, { statusCode: 500 });
    await openMcpPanel(page);
    const retryBtn = page.getByRole("button", { name: /retry connection to bad/i });
    await expect(retryBtn).toBeVisible({ timeout: 10_000 });

    // Install a slow route so yellow-state lingers long enough to observe
    // the Retry button disappearing from the DOM.
    await page.unroute(BAD_URL);
    await page.route(BAD_URL, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3_000));
      return route.fulfill({ status: 500, contentType: "text/plain", body: "" });
    });

    await retryBtn.click();
    // The dot flips to yellow immediately on schedule().
    await expect(
      page.getByRole("img", { name: /checking connection/i }),
    ).toBeVisible({ timeout: 5_000 });
    // And while yellow, the Retry button is no longer rendered (the error
    // line with Retry is only shown for red rows).
    await expect(retryBtn).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// Send-time in-chat signal + dot flip (Unit 6 / C1/C2)
// ---------------------------------------------------------------------------
//
// These scenarios require the LLM provider to be configured in localStorage
// so `runChatSession` actually fires. Configuring a fake provider lets the
// engine reach `connectMcpServers`, which hits our mocked MCP endpoints and
// produces the `perServer` outcomes that drive the in-chat messages.
//
// If the engine bails out before reaching the MCP connect stage (e.g. the
// LLM request itself fails), the in-chat C1/C2 text won't render — these
// tests are marked `.fixme` so they stay committed and visible but don't
// block the suite. Follow-up: stub the LLM stream at the fetch layer too.
test.describe("MCP in-chat signal on send", () => {
  test.fixme(
    "failing server produces in-chat 'Couldn't reach' message and red dot",
    async ({ page }) => {
      // Deferred: stubbing the full Ollama/OpenAI/Anthropic streaming chat
      // fetch + matching the engine's provider config shape is a substantial
      // additional fixture. Tracked for a follow-up E2E pass. In the meantime,
      // the Chatbox.jsx sendMessage path is covered by unit tests in
      // chatbox-core.
      await loadEditableDashboard(page, {
        seedServers: [{ url: BAD_URL, name: "Bad", enabled: true }],
      });
      await mockFailedMcpServer(page, BAD_URL, { statusCode: 500 });

      await page.getByRole("button", { name: "chatSidebarToggle" }).click();
      await page
        .getByRole("textbox", { name: "Chat message input" })
        .fill("hello");
      await page.getByRole("button", { name: "Send message" }).click();

      await expect(
        page.getByText(/couldn't reach mcp server.*bad/i),
      ).toBeVisible({ timeout: 15_000 });
    },
  );

  test.fixme(
    "zero-tools server produces in-chat 'reports no tools' message and orange dot",
    async ({ page }) => {
      await loadEditableDashboard(page, {
        seedServers: [{ url: ZERO_TOOLS_URL, name: "Empty", enabled: true }],
      });
      await mockZeroToolsMcpServer(page, ZERO_TOOLS_URL);

      await page.getByRole("button", { name: "chatSidebarToggle" }).click();
      await page
        .getByRole("textbox", { name: "Chat message input" })
        .fill("hello");
      await page.getByRole("button", { name: "Send message" }).click();

      await expect(
        page.getByText(/reports no tools/i),
      ).toBeVisible({ timeout: 15_000 });
    },
  );
});

// ---------------------------------------------------------------------------
// Mixed-content scenario — documented as manual-QA only.
// ---------------------------------------------------------------------------
//
// The probe pre-check (in chatbox-core engine/transports.js::pickTransport)
// fires `ERROR_KEYS.mixedContent` when `window.location.protocol === 'https:'`
// AND the URL starts with `http://`. We cannot make a Playwright `page`
// appear to be on https without a real TLS endpoint — the
// `page.addInitScript` trick of overriding `window.location.protocol` breaks
// the SDK's URL-origin check further down the stack and makes the assertion
// flaky. The check itself is plain JS; covering it via a future chatbox-core
// unit test suite is the right place.
//
// Manual-QA steps (record-and-verify on a real https deployment):
//   1. Host TethysDash behind https (`tethys manage start -s` + TLS front).
//   2. Add an MCP server URL starting with `http://`.
//   3. Assert the row dot is red with the "Insecure URL" enum text and
//      that no outbound fetch was issued (devtools Network tab empty).
//
// (No empty `test.skip("…", () => {})` placeholder here — it would render as
// a "skipped" entry in test reports without context. The narrative above is
// the documentation; the actual check belongs in a unit test.)

/**
 * SQLite fixture helper for Playwright E2E tests.
 *
 * Opens the same SQLite file that Tethys/Django reads via
 * App.get_persistent_store_database('primary_db').  The file must already
 * exist and be migrated (run setup-test-db.py once).
 *
 * Usage:
 *   const { createDashboard, truncateAll, closeDb } = require('./helpers/db');
 *   const uuid = createDashboard([gridItem1, gridItem2]);
 *   // ... Playwright navigates to /dashboard/<uuid> ...
 *   truncateAll();
 */

const Database = require("better-sqlite3");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

// DB path — set via env or default to Tethys e2e-test directory.
// The DB name follows Tethys convention: <app>_<setting_name>.sqlite
const DB_PATH =
  process.env.E2E_DB_PATH ||
  path.join(os.homedir(), ".tethys", "e2e-test", "tethysdash_primary_db.sqlite");

let _db = null;

function getDb() {
  if (!_db) {
    _db = new Database(DB_PATH, { fileMustExist: true });
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
  }
  return _db;
}

/**
 * Create a dashboard with the given grid items.
 *
 * @param {Array<Object>} gridItems - Array of grid item objects. Each must have:
 *   { source, args, x?, y?, w?, h?, metadata? }
 * @param {Object} [opts] - Dashboard options.
 * @param {string} [opts.name] - Dashboard name.
 * @param {boolean} [opts.public] - Whether the dashboard is public (default true).
 * @param {string|null} [opts.grantAdminTo] - If set, insert a DashboardPermission
 *   row giving the named user admin on this dashboard. Pass `""` to grant the
 *   permission to the AnonymousUser (which is what the Tethys dev server uses
 *   when no login session is active — matches `request.user.username === ""`).
 *   Needed for tests that exercise the chatbox: `ChatSidebar` mounts only when
 *   `LayoutContext.editable === true`, which requires admin/editor permission.
 * @returns {string} The dashboard UUID.
 */
function createDashboard(gridItems, opts = {}) {
  const db = getDb();
  const dashUuid = crypto.randomUUID();
  const name = opts.name || `E2E Test Dashboard ${dashUuid.slice(0, 8)}`;
  const isPublic = opts.public !== false ? 1 : 0;

  db.prepare(
    `INSERT INTO dashboards (uuid, name, description, notes, owner, public, unrestricted_placement)
     VALUES (?, ?, '', '', 'admin', ?, 0)`
  ).run(dashUuid, name, isPublic);

  const dashboard = db.prepare("SELECT id FROM dashboards WHERE uuid = ?").get(dashUuid);

  // Optional: grant admin permission so the frontend's LayoutContext.editable
  // becomes true for this dashboard. `get_dashboard_user_permission()` in
  // model.py matches rows by `username == request.user.username`, so on the
  // Tethys dev server (no login) we pass `""` to match AnonymousUser.
  if (opts.grantAdminTo !== undefined && opts.grantAdminTo !== null) {
    db.prepare(
      `INSERT INTO dashboard_permissions (dashboard_id, username, group_id, permission)
       VALUES (?, ?, NULL, 'admin')`
    ).run(dashboard.id, opts.grantAdminTo);
  }

  db.prepare(
    `INSERT INTO dashboard_tabs (dashboard_id, name, tab_order)
     VALUES (?, 'Tab 1', 0)`
  ).run(dashboard.id);

  const tab = db
    .prepare("SELECT id FROM dashboard_tabs WHERE dashboard_id = ?")
    .get(dashboard.id);

  const insertItem = db.prepare(
    `INSERT INTO griditems (dashboard_id, tab_id, uuid, i, x, y, w, h, source, args_string, metadata_string, "order")
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  gridItems.forEach((item, idx) => {
    const itemUuid = item.uuid || crypto.randomUUID();
    insertItem.run(
      dashboard.id,
      tab.id,
      itemUuid,
      String(idx + 1), // grid item identifier
      item.x ?? 0,
      item.y ?? idx * 20,
      item.w ?? 50,
      item.h ?? 25,
      item.source || "",
      typeof item.args === "string" ? item.args : JSON.stringify(item.args || {}),
      typeof item.metadata === "string"
        ? item.metadata
        : JSON.stringify(item.metadata || { refreshRate: 0 }),
      idx
    );
  });

  return dashUuid;
}

/**
 * Delete all data rows from test tables. Preserves alembic_version.
 */
// Tables where "missing table" is an expected outcome in some schema versions.
// `dashboard_permissions` is included because dev environments set up before
// the permission-system migration landed don't have the table — truncating
// it would otherwise throw and leave subsequent tests with dirty state.
const OPTIONAL_TABLES = new Set([
  "messages",
  "permission_group_user",
  "permission_groups",
  "visualization_permissions",
  "dashboard_permissions",
]);

function truncateAll() {
  const db = getDb();
  db.pragma("foreign_keys = OFF");
  const tables = [
    "griditems",
    "dashboard_permissions",
    "dashboard_tabs",
    "messages",
    "permission_group_user",
    "permission_groups",
    "visualization_permissions",
    "dashboards",
  ];
  for (const table of tables) {
    try {
      db.prepare(`DELETE FROM ${table}`).run();
    } catch (err) {
      // Only swallow "no such table" for known-optional tables. Any other
      // DELETE failure (e.g., FK constraint we didn't expect) must surface
      // — otherwise test isolation silently breaks and later tests see
      // stale rows.
      const msg = String(err?.message || err);
      if (OPTIONAL_TABLES.has(table) && /no such table/i.test(msg)) continue;
      // eslint-disable-next-line no-console
      console.error(`[db.js] truncateAll: DELETE FROM ${table} failed:`, msg);
      throw err;
    }
  }
  db.pragma("foreign_keys = ON");
}

/**
 * Close the database connection. Call in globalTeardown.
 */
function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}

module.exports = { createDashboard, truncateAll, closeDb, getDb, DB_PATH };

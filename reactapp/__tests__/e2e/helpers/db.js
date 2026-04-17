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
    } catch {
      // Table may not exist in all schema versions
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

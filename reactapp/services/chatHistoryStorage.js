/**
 * chatHistoryStorage.js
 *
 * Persists chat conversation messages per dashboard to localStorage.
 *
 * Plan: docs/plans/2026-05-08-004-feat-persist-chatbox-per-dashboard-plan.md
 *
 * Mirrors the shape of `lib/chatbox-core/storage/mcpStorage.js`:
 *   - STORAGE_PREFIX constant
 *   - get/save/clear helpers
 *   - try/catch silent-fail on quota / unavailable / serialization errors
 *   - Array.isArray fallback on read so malformed data degrades to []
 *
 * The key shape is versioned (`tethysdash:chat:v1:<dashboardUuid>`) so a
 * future schema change can ship with a v2 reader that ignores v1 data.
 *
 * Storage is per-origin per-browser-profile. Cache-clear or private-
 * browsing wipes everything — this is intentional (see plan Scope
 * Boundaries).
 */

const STORAGE_PREFIX = "tethysdash:chat:v1:";

function buildKey(dashboardUuid) {
  return `${STORAGE_PREFIX}${dashboardUuid}`;
}

function isValidUuid(dashboardUuid) {
  return typeof dashboardUuid === "string" && dashboardUuid.length > 0;
}

/**
 * Read the persisted message list for a dashboard.
 *
 * Returns `[]` for any failure mode: missing key, malformed JSON,
 * non-array result, localStorage unavailable / throw on access.
 * Defensive against empty / null UUIDs so callers don't have to
 * guard themselves.
 */
export function getChatHistory(dashboardUuid) {
  if (!isValidUuid(dashboardUuid)) return [];
  try {
    const raw = localStorage.getItem(buildKey(dashboardUuid));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Persist a message list for a dashboard.
 *
 * Silent-fail on:
 *   - localStorage unavailable (private browsing some browsers)
 *   - quota exceeded
 *   - JSON serialization throw (e.g., circular references — shouldn't
 *     happen for plain message objects, but defensive)
 *   - empty / null UUID (no-op)
 *
 * Matches the existing chatbox-core storage helpers' silent-fail
 * convention so the chatbox keeps working even when persistence is
 * unavailable.
 */
export function saveChatHistory(dashboardUuid, messages) {
  if (!isValidUuid(dashboardUuid)) return;
  if (!Array.isArray(messages)) return;
  try {
    localStorage.setItem(buildKey(dashboardUuid), JSON.stringify(messages));
  } catch {
    // localStorage full, unavailable, or threw on serialize — silently fail.
  }
}

/**
 * Remove the persisted history for a dashboard. Useful for a future
 * "clear chat" affordance and for tests.
 */
export function clearChatHistory(dashboardUuid) {
  if (!isValidUuid(dashboardUuid)) return;
  try {
    localStorage.removeItem(buildKey(dashboardUuid));
  } catch {
    // Silent-fail, same convention as save.
  }
}

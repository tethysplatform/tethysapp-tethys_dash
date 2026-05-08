/**
 * services/chatHistoryStorage.test.js — coverage for the per-dashboard
 * chat-history localStorage helper (plan 2026-05-08-004 Unit 2).
 */

import {
  getChatHistory,
  saveChatHistory,
  clearChatHistory,
} from "services/chatHistoryStorage";

const STORAGE_PREFIX = "tethysdash:chat:v1:";

describe("chatHistoryStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("happy path", () => {
    it("save then get round-trips the messages array", () => {
      const messages = [
        { role: "user", content: "hello" },
        { role: "assistant", content: "hi there" },
      ];
      saveChatHistory("dashboard-A", messages);
      expect(getChatHistory("dashboard-A")).toEqual(messages);
    });

    it("uses the versioned key shape tethysdash:chat:v1:<uuid>", () => {
      saveChatHistory("dashboard-A", [{ role: "user", content: "x" }]);
      expect(localStorage.getItem(`${STORAGE_PREFIX}dashboard-A`)).not.toBeNull();
    });

    it("empty array is a valid round-trip", () => {
      saveChatHistory("dashboard-A", []);
      expect(getChatHistory("dashboard-A")).toEqual([]);
    });
  });

  describe("per-dashboard isolation", () => {
    it("dashboards have independent history", () => {
      saveChatHistory("dashboard-A", [{ role: "user", content: "from A" }]);
      saveChatHistory("dashboard-B", [{ role: "user", content: "from B" }]);
      expect(getChatHistory("dashboard-A")).toEqual([
        { role: "user", content: "from A" },
      ]);
      expect(getChatHistory("dashboard-B")).toEqual([
        { role: "user", content: "from B" },
      ]);
    });

    it("returns [] for a dashboard that has no saved history", () => {
      saveChatHistory("dashboard-A", [{ role: "user", content: "hi" }]);
      expect(getChatHistory("dashboard-never-saved")).toEqual([]);
    });
  });

  describe("malformed data — silent fallback to []", () => {
    it("returns [] for missing key", () => {
      expect(getChatHistory("dashboard-A")).toEqual([]);
    });

    it("returns [] for malformed JSON in storage", () => {
      localStorage.setItem(`${STORAGE_PREFIX}dashboard-A`, "{not json");
      expect(getChatHistory("dashboard-A")).toEqual([]);
    });

    it("returns [] for non-array JSON value", () => {
      localStorage.setItem(
        `${STORAGE_PREFIX}dashboard-A`,
        JSON.stringify({ not: "an array" }),
      );
      expect(getChatHistory("dashboard-A")).toEqual([]);
    });

    it("returns [] for JSON null", () => {
      localStorage.setItem(`${STORAGE_PREFIX}dashboard-A`, "null");
      expect(getChatHistory("dashboard-A")).toEqual([]);
    });
  });

  describe("invalid UUID input", () => {
    it("getChatHistory returns [] for empty string", () => {
      expect(getChatHistory("")).toEqual([]);
    });

    it("getChatHistory returns [] for null / undefined", () => {
      expect(getChatHistory(null)).toEqual([]);
      expect(getChatHistory(undefined)).toEqual([]);
    });

    it("saveChatHistory is a no-op for empty / null uuid", () => {
      saveChatHistory("", [{ role: "user", content: "ignored" }]);
      saveChatHistory(null, [{ role: "user", content: "ignored" }]);
      // No keys with the prefix should exist.
      const matchingKeys = Object.keys(localStorage).filter((k) =>
        k.startsWith(STORAGE_PREFIX),
      );
      expect(matchingKeys).toEqual([]);
    });

    it("saveChatHistory is a no-op when messages is not an array", () => {
      saveChatHistory("dashboard-A", null);
      saveChatHistory("dashboard-A", "not an array");
      saveChatHistory("dashboard-A", { not: "an array" });
      expect(getChatHistory("dashboard-A")).toEqual([]);
    });
  });

  describe("storage failure — silent-fail", () => {
    it("saveChatHistory swallows setItem throw (e.g., QuotaExceeded)", () => {
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = jest.fn(() => {
        throw new DOMException("QuotaExceededError");
      });
      // Must not throw.
      expect(() => {
        saveChatHistory("dashboard-A", [{ role: "user", content: "x" }]);
      }).not.toThrow();
      Storage.prototype.setItem = originalSetItem;
    });

    it("getChatHistory swallows getItem throw", () => {
      const originalGetItem = Storage.prototype.getItem;
      Storage.prototype.getItem = jest.fn(() => {
        throw new Error("storage unavailable");
      });
      expect(getChatHistory("dashboard-A")).toEqual([]);
      Storage.prototype.getItem = originalGetItem;
    });
  });

  describe("clearChatHistory", () => {
    it("removes the persisted entry for the given uuid", () => {
      saveChatHistory("dashboard-A", [{ role: "user", content: "x" }]);
      expect(getChatHistory("dashboard-A")).toHaveLength(1);
      clearChatHistory("dashboard-A");
      expect(getChatHistory("dashboard-A")).toEqual([]);
    });

    it("does not affect other dashboards' entries", () => {
      saveChatHistory("dashboard-A", [{ role: "user", content: "A" }]);
      saveChatHistory("dashboard-B", [{ role: "user", content: "B" }]);
      clearChatHistory("dashboard-A");
      expect(getChatHistory("dashboard-A")).toEqual([]);
      expect(getChatHistory("dashboard-B")).toEqual([
        { role: "user", content: "B" },
      ]);
    });

    it("is a no-op for empty / null uuid", () => {
      saveChatHistory("dashboard-A", [{ role: "user", content: "x" }]);
      clearChatHistory("");
      clearChatHistory(null);
      expect(getChatHistory("dashboard-A")).toHaveLength(1);
    });
  });
});

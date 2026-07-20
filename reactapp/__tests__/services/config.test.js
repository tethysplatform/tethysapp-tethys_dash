import {
  getConfig,
  setConfig,
  clearConfig,
  checkContractVersion,
  TARGET_CONTRACT_VERSION,
} from "services/config";

describe("config singleton", () => {
  afterEach(() => clearConfig());

  test("setConfig override wins and fills defaults", () => {
    setConfig({ appRootUrl: "/x/" });
    expect(getConfig().appRootUrl).toBe("/x/");
    expect(getConfig().portalHost).toBe("");
  });

  test("reads the injected #tethysdash-config element", () => {
    const el = document.createElement("script");
    el.id = "tethysdash-config";
    el.type = "application/json";
    el.textContent = JSON.stringify({
      appRootUrl: "/injected/",
      contractVersion: "1.0",
    });
    document.body.appendChild(el);
    try {
      expect(getConfig().appRootUrl).toBe("/injected/");
    } finally {
      document.body.removeChild(el);
    }
  });

  test("ignores a malformed injected element and falls back", () => {
    const el = document.createElement("script");
    el.id = "tethysdash-config";
    el.type = "application/json";
    el.textContent = "{not valid json";
    document.body.appendChild(el);
    try {
      expect(getConfig().appRootUrl).toBe("/apps/tethysdash/");
    } finally {
      document.body.removeChild(el);
    }
  });

  test("ignores a non-object injected payload", () => {
    const el = document.createElement("script");
    el.id = "tethysdash-config";
    el.type = "application/json";
    el.textContent = JSON.stringify(["not", "an", "object"]);
    document.body.appendChild(el);
    try {
      const cfg = getConfig();
      expect(cfg.appRootUrl).toBe("/apps/tethysdash/");
      expect(cfg["0"]).toBeUndefined();
    } finally {
      document.body.removeChild(el);
    }
  });

  describe("checkContractVersion", () => {
    test("ok when versions match", () => {
      setConfig({ contractVersion: TARGET_CONTRACT_VERSION });
      expect(checkContractVersion()).toBe("ok");
    });

    test("unknown when the backend advertises no version", () => {
      setConfig({ contractVersion: null });
      expect(checkContractVersion()).toBe("unknown");
    });

    test("mismatch logs a clear error and returns mismatch", () => {
      const spy = jest.spyOn(console, "error").mockImplementation(() => {});
      setConfig({ contractVersion: "9.9" });
      expect(checkContractVersion()).toBe("mismatch");
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});

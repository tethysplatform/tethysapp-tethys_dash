import {
  getTethysPortalHost,
  getPublicUrl,
  getTethysAppRoot,
} from "services/utilities";

// Mock window.location
const mockLocation = (href, origin) => {
  delete window.location;
  window.location = {
    href,
    origin,
  };
};

describe("utilities", () => {
  // Store original environment variables
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables before each test
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // Restore original environment variables
    process.env = originalEnv;
  });

  describe("getTethysPortalHost", () => {
    test("should return portal host with prefix when both are set", () => {
      process.env.TETHYS_PORTAL_HOST = "https://example.com";
      process.env.TETHYS_PREFIX_URL = "/tethys/";

      const result = getTethysPortalHost();
      expect(result).toBe("https://example.com");
    });

    test("should return portal host without prefix when prefix is empty", () => {
      process.env.TETHYS_PORTAL_HOST = "https://example.com";
      process.env.TETHYS_PREFIX_URL = "";

      const result = getTethysPortalHost();
      expect(result).toBe("https://example.com");
    });

    test("should handle prefix URL with leading and trailing slashes", () => {
      process.env.TETHYS_PORTAL_HOST = "https://example.com";
      process.env.TETHYS_PREFIX_URL = "/tethys/";

      const result = getTethysPortalHost();
      expect(result).toBe("https://example.com");
    });

    test("should derive portal host from window.location when env var is not set", () => {
      process.env.TETHYS_PORTAL_HOST = "";
      process.env.TETHYS_PREFIX_URL = "/tethys/";
      mockLocation(
        "https://localhost:8000/apps/tethysdash/",
        "https://localhost:8000",
      );

      const result = getTethysPortalHost();
      expect(result).toBe("https://localhost:8000");
    });

    test("should derive portal host from window.location when env var is undefined", () => {
      delete process.env.TETHYS_PORTAL_HOST;
      process.env.TETHYS_PREFIX_URL = "";
      mockLocation("https://mysite.com/dashboard/", "https://mysite.com");

      const result = getTethysPortalHost();
      expect(result).toBe("https://mysite.com");
    });

    test("should handle empty prefix URL correctly", () => {
      process.env.TETHYS_PORTAL_HOST = "https://example.com";
      process.env.TETHYS_PREFIX_URL = "";

      const result = getTethysPortalHost();
      expect(result).toBe("https://example.com");
    });

    test("should handle prefix URL with only leading slash", () => {
      process.env.TETHYS_PORTAL_HOST = "https://example.com";
      process.env.TETHYS_PREFIX_URL = "/tethys";

      const result = getTethysPortalHost();
      expect(result).toBe("https://example.com");
    });

    test("should handle prefix URL with only trailing slash", () => {
      process.env.TETHYS_PORTAL_HOST = "https://example.com";
      process.env.TETHYS_PREFIX_URL = "tethys/";

      const result = getTethysPortalHost();
      expect(result).toBe("https://example.com");
    });
  });

  describe("getPublicUrl", () => {
    test("should generate correct public URL with uuid", () => {
      process.env.TETHYS_PORTAL_HOST = "https://example.com";
      process.env.TETHYS_PREFIX_URL = "";
      process.env.TETHYS_APP_ROOT_URL = "/apps/tethysdash/";

      const uuid = "test-uuid-123";
      const result = getPublicUrl(uuid);
      expect(result).toBe(
        "https://example.com/apps/tethysdash/dashboard/test-uuid-123",
      );
    });

    test("should generate correct public URL with prefix", () => {
      process.env.TETHYS_PORTAL_HOST = "https://example.com";
      process.env.TETHYS_PREFIX_URL = "/tethys/";
      process.env.TETHYS_APP_ROOT_URL = "/apps/tethysdash/";

      const uuid = "another-uuid-456";
      const result = getPublicUrl(uuid);
      expect(result).toBe(
        "https://example.com/tethys/apps/tethysdash/dashboard/another-uuid-456",
      );
    });

    test("should handle special characters in uuid", () => {
      process.env.TETHYS_PORTAL_HOST = "https://example.com";
      process.env.TETHYS_PREFIX_URL = "";
      process.env.TETHYS_APP_ROOT_URL = "/apps/tethysdash/";

      const uuid = "test-uuid_with-special.chars";
      const result = getPublicUrl(uuid);
      expect(result).toBe(
        "https://example.com/apps/tethysdash/dashboard/test-uuid_with-special.chars",
      );
    });

    test("should work with derived portal host from window.location", () => {
      process.env.TETHYS_PORTAL_HOST = "";
      process.env.TETHYS_PREFIX_URL = "";
      process.env.TETHYS_APP_ROOT_URL = "/apps/tethysdash/";
      mockLocation(
        "https://localhost:8000/apps/tethysdash/",
        "https://localhost:8000",
      );

      const uuid = "local-test-uuid";
      const result = getPublicUrl(uuid);
      expect(result).toBe(
        "https://localhost:8000/apps/tethysdash/dashboard/local-test-uuid",
      );
    });
  });

  describe("getTethysAppRoot", () => {
    test("should construct app root path correctly", () => {
      process.env.TETHYS_APP_ROOT_URL = "/apps/tethysdash/";
      process.env.TETHYS_PREFIX_URL = "/tethys/";

      const result = getTethysAppRoot();
      expect(result).toBe("/tethys/apps/tethysdash/");
    });

    test("should handle empty prefix URL", () => {
      process.env.TETHYS_APP_ROOT_URL = "/apps/tethysdash/";
      process.env.TETHYS_PREFIX_URL = "";

      const result = getTethysAppRoot();
      expect(result).toBe("/apps/tethysdash/");
    });

    test("should remove duplicate slashes", () => {
      process.env.TETHYS_APP_ROOT_URL = "/apps/tethysdash/";
      process.env.TETHYS_PREFIX_URL = "/tethys/";

      const result = getTethysAppRoot();
      expect(result).toBe("/tethys/apps/tethysdash/");
      expect(result).not.toContain("//");
    });

    test("should handle multiple consecutive slashes", () => {
      process.env.TETHYS_APP_ROOT_URL = "//apps//tethysdash//";
      process.env.TETHYS_PREFIX_URL = "//tethys//";

      const result = getTethysAppRoot();
      expect(result).toBe("/tethys/apps/tethysdash/");
      expect(result).not.toContain("//");
    });

    test("should handle prefix without slashes", () => {
      process.env.TETHYS_APP_ROOT_URL = "apps/tethysdash";
      process.env.TETHYS_PREFIX_URL = "tethys";

      const result = getTethysAppRoot();
      expect(result).toBe("/tethys/apps/tethysdash");
    });

    test("should handle mixed slash scenarios", () => {
      process.env.TETHYS_APP_ROOT_URL = "apps/tethysdash/";
      process.env.TETHYS_PREFIX_URL = "/tethys";

      const result = getTethysAppRoot();
      expect(result).toBe("/tethys/apps/tethysdash/");
    });

    test("should handle minimal app root URL", () => {
      process.env.TETHYS_APP_ROOT_URL = "/";
      process.env.TETHYS_PREFIX_URL = "";

      const result = getTethysAppRoot();
      expect(result).toBe("/");
    });

    test("should handle both empty values", () => {
      process.env.TETHYS_APP_ROOT_URL = "";
      process.env.TETHYS_PREFIX_URL = "";

      const result = getTethysAppRoot();
      expect(result).toBe("/");
    });
  });

  describe("Integration tests", () => {
    test("should work together - full workflow with derived host", () => {
      // Setup environment without explicit host
      delete process.env.TETHYS_PORTAL_HOST;
      process.env.TETHYS_PREFIX_URL = "/tethys/";
      process.env.TETHYS_APP_ROOT_URL = "/apps/tethysdash/";
      mockLocation(
        "https://myapp.com/tethys/apps/tethysdash/",
        "https://myapp.com",
      );

      // Test portal host derivation
      const portalHost = getTethysPortalHost();
      expect(portalHost).toBe("https://myapp.com");

      // Test app root construction
      const appRoot = getTethysAppRoot();
      expect(appRoot).toBe("/tethys/apps/tethysdash/");

      // Test public URL generation
      const publicUrl = getPublicUrl("test-123");
      expect(publicUrl).toBe(
        "https://myapp.com/tethys/apps/tethysdash/dashboard/test-123",
      );
    });

    test("should work together - full workflow with explicit host", () => {
      // Setup environment with explicit host
      process.env.TETHYS_PORTAL_HOST = "https://production.example.com";
      process.env.TETHYS_PREFIX_URL = "";
      process.env.TETHYS_APP_ROOT_URL = "/apps/tethysdash/";

      // Test portal host usage
      const portalHost = getTethysPortalHost();
      expect(portalHost).toBe("https://production.example.com");

      // Test app root construction
      const appRoot = getTethysAppRoot();
      expect(appRoot).toBe("/apps/tethysdash/");

      // Test public URL generation
      const publicUrl = getPublicUrl("prod-dashboard-456");
      expect(publicUrl).toBe(
        "https://production.example.com/apps/tethysdash/dashboard/prod-dashboard-456",
      );
    });
  });
});

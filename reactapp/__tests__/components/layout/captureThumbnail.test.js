import captureThumbnail from "components/layout/captureThumbnail";
import { snapdom } from "@zumer/snapdom";

jest.mock("@zumer/snapdom", () => ({ snapdom: jest.fn() }));
jest.mock("services/utilities", () => ({
  getTethysAppRoot: () => "/apps/tethysdash/",
}));

const CAPTURED = { width: 1000, height: 800 };

// snapdom hands back an object that can produce a canvas; the canvas itself is
// only ever measured and drawn from, so a plain shape is enough.
const snapdomReturns = (captured = CAPTURED) =>
  snapdom.mockResolvedValue({
    toCanvas: jest.fn().mockResolvedValue(captured),
  });

function addGrid({ width = 1200, height = 900 } = {}) {
  const grid = document.createElement("div");
  grid.className = "react-grid-layout";
  jest.spyOn(grid, "getBoundingClientRect").mockReturnValue({
    width,
    height,
    top: 0,
    left: 0,
    toJSON: () => ({}),
  });
  document.body.appendChild(grid);
  return grid;
}

function setHeaderHeight(value) {
  document.documentElement.style.setProperty("--ts-header-height", value);
}

beforeEach(() => {
  document.body.innerHTML = "";
  document.documentElement.style.removeProperty("--ts-header-height");
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest
    .spyOn(HTMLCanvasElement.prototype, "toDataURL")
    .mockReturnValue("data:image/png;base64,AAA");
  snapdomReturns();
});

afterEach(() => {
  jest.restoreAllMocks();
  delete global.fetch;
});

describe("captureThumbnail", () => {
  it("returns nothing when there is no laid-out grid to capture", async () => {
    await expect(captureThumbnail()).resolves.toBeNull();
    expect(snapdom).not.toHaveBeenCalled();
  });

  it("ignores a grid that has no size", async () => {
    addGrid({ width: 0, height: 0 });
    await expect(captureThumbnail()).resolves.toBeNull();
  });

  it("captures the page and returns a png data url", async () => {
    addGrid();
    await expect(captureThumbnail()).resolves.toBe("data:image/png;base64,AAA");
    expect(snapdom).toHaveBeenCalledWith(
      document.body,
      expect.objectContaining({ clip: "viewport", excludeMode: "remove" }),
    );
  });

  it("returns nothing when the capture came back empty", async () => {
    addGrid();
    snapdomReturns({ width: 0, height: 0 });
    await expect(captureThumbnail()).resolves.toBeNull();
  });

  it("reports a capture that throws rather than propagating it", async () => {
    // A failed thumbnail must not take down the save that triggered it.
    addGrid();
    snapdom.mockRejectedValue(new Error("snapdom exploded"));
    await expect(captureThumbnail()).resolves.toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      "Dashboard thumbnail capture failed:",
      expect.any(Error),
    );
  });

  it("scrolls its container to the top and puts it back afterwards", async () => {
    // Otherwise the thumbnail shows wherever the author happened to be.
    const scroller = document.createElement("div");
    document.body.appendChild(scroller);
    Object.defineProperty(scroller, "scrollHeight", { value: 2000 });
    Object.defineProperty(scroller, "clientHeight", { value: 500 });
    scroller.scrollTop = 350;

    const grid = addGrid();
    scroller.appendChild(grid);
    let scrollTopDuringCapture;
    snapdom.mockImplementation(async () => {
      scrollTopDuringCapture = scroller.scrollTop;
      return { toCanvas: async () => CAPTURED };
    });

    await captureThumbnail();

    expect(scrollTopDuringCapture).toBe(0);
    expect(scroller.scrollTop).toBe(350);
  });

  it("crops by the header height when one is declared", async () => {
    addGrid();
    setHeaderHeight("56px");
    await expect(captureThumbnail()).resolves.toBe("data:image/png;base64,AAA");
  });

  it("crops nothing when the header height is not a number", async () => {
    addGrid();
    setHeaderHeight("inherit");
    await expect(captureThumbnail()).resolves.toBe("data:image/png;base64,AAA");
  });

  it("returns nothing when the capture has no width", async () => {
    addGrid();
    snapdomReturns({ width: 0, height: 10 });
    await expect(captureThumbnail()).resolves.toBeNull();
  });
});

describe("cross-origin images", () => {
  const imageResponse = (body = "png-bytes") => ({
    ok: true,
    status: 200,
    headers: { get: () => "image/png" },
    blob: async () => new Blob([body], { type: "image/png" }),
  });

  function addImage(attributes) {
    const image = document.createElement("img");
    if (attributes.src !== undefined) image.setAttribute("src", attributes.src);
    if (attributes.currentSrc !== undefined) {
      Object.defineProperty(image, "currentSrc", {
        value: attributes.currentSrc,
        configurable: true,
      });
    }
    document.body.appendChild(image);
    return image;
  }

  it("inlines a cross-origin image through the proxy and puts it back after", async () => {
    addGrid();
    const image = addImage({ src: "https://elsewhere.test/logo.png" });
    global.fetch = jest.fn().mockResolvedValue(imageResponse());
    let srcDuringCapture;
    snapdom.mockImplementation(async () => {
      srcDuringCapture = image.getAttribute("src");
      return { toCanvas: async () => CAPTURED };
    });

    await captureThumbnail();

    expect(global.fetch).toHaveBeenCalledWith(
      `/apps/tethysdash/images/proxy/?url=${encodeURIComponent("https://elsewhere.test/logo.png")}`,
      { credentials: "include" },
    );
    expect(srcDuringCapture).toMatch(/^data:/);
    // The page is left exactly as it was found.
    expect(image.getAttribute("src")).toBe("https://elsewhere.test/logo.png");
  });

  it("removes the attribute again for an image that never had one", async () => {
    addGrid();
    const image = addImage({
      currentSrc: "https://elsewhere.test/only-current.png",
    });
    global.fetch = jest.fn().mockResolvedValue(imageResponse());

    await captureThumbnail();

    expect(image.hasAttribute("src")).toBe(false);
  });

  it("leaves an image alone when the proxy refuses it", async () => {
    // An unauthenticated request is answered with a redirect to the login page.
    addGrid();
    const image = addImage({ src: "https://elsewhere.test/logo.png" });
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 302,
      headers: { get: () => "text/html" },
    });

    await captureThumbnail();

    expect(image.getAttribute("src")).toBe("https://elsewhere.test/logo.png");
    expect(console.warn).toHaveBeenCalled();
  });

  it("leaves an image alone when the proxy answers with something that is not an image", async () => {
    addGrid();
    addImage({ src: "https://elsewhere.test/logo.png" });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "text/html" },
    });

    await captureThumbnail();
    expect(console.warn).toHaveBeenCalled();
  });

  it("carries on when the proxy request throws", async () => {
    addGrid();
    addImage({ src: "https://elsewhere.test/logo.png" });
    global.fetch = jest
      .fn()
      .mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(captureThumbnail()).resolves.toBe("data:image/png;base64,AAA");
    expect(console.warn).toHaveBeenCalled();
  });

  it("leaves same-origin, data and blob images untouched", async () => {
    addGrid();
    addImage({ src: "/local/logo.png" });
    addImage({ src: "data:image/png;base64,AAA" });
    addImage({ src: "blob:http://localhost/abc" });
    global.fetch = jest.fn();

    await captureThumbnail();

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("treats an unparseable src as same-origin rather than throwing", async () => {
    addGrid();
    addImage({ src: "http://[bad" });
    global.fetch = jest.fn();

    await expect(captureThumbnail()).resolves.toBe("data:image/png;base64,AAA");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("carries on when the fetched image cannot be read", async () => {
    addGrid();
    addImage({ src: "https://elsewhere.test/logo.png" });
    global.fetch = jest.fn().mockResolvedValue(imageResponse());
    const RealFileReader = global.FileReader;
    global.FileReader = class {
      readAsDataURL() {
        this.onerror(new Error("unreadable"));
      }
    };
    try {
      await expect(captureThumbnail()).resolves.toBe(
        "data:image/png;base64,AAA",
      );
      expect(console.warn).toHaveBeenCalled();
    } finally {
      global.FileReader = RealFileReader;
    }
  });
});

it("walks past containers that do not scroll to find the one that does", async () => {
  const outer = document.createElement("div");
  Object.defineProperty(outer, "scrollHeight", { value: 3000 });
  Object.defineProperty(outer, "clientHeight", { value: 600 });
  outer.scrollTop = 120;
  const middle = document.createElement("div"); // same height: not the scroller
  Object.defineProperty(middle, "scrollHeight", { value: 400 });
  Object.defineProperty(middle, "clientHeight", { value: 400 });
  outer.appendChild(middle);
  document.body.appendChild(outer);
  middle.appendChild(addGrid());

  await captureThumbnail();

  expect(outer.scrollTop).toBe(120);
});

describe("edges of the crop and the proxy response", () => {
  it("treats a proxy response with no content type as not an image", async () => {
    addGrid();
    const image = document.createElement("img");
    image.setAttribute("src", "https://elsewhere.test/logo.png");
    document.body.appendChild(image);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
    });

    await captureThumbnail();

    expect(image.getAttribute("src")).toBe("https://elsewhere.test/logo.png");
    expect(console.warn).toHaveBeenCalled();
  });

  it("clamps a header taller than the viewport instead of cropping everything", async () => {
    addGrid();
    setHeaderHeight("100000px");
    // Clamped to the full height, then held one pixel back so there is still
    // an image to scale.
    await expect(captureThumbnail()).resolves.toBe("data:image/png;base64,AAA");
  });

  it("falls back to the captured height when the window reports none", async () => {
    addGrid();
    setHeaderHeight("56px");
    const realHeight = window.innerHeight;
    window.innerHeight = 0;
    try {
      await expect(captureThumbnail()).resolves.toBe(
        "data:image/png;base64,AAA",
      );
    } finally {
      window.innerHeight = realHeight;
    }
  });
});

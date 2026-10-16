import captureThumbnail from "components/layout/captureThumbnail";
import {
  captureDashboardCanvas,
  CaptureBusyError,
  NothingToCaptureError,
} from "components/layout/captureDashboard";

jest.mock("components/layout/captureDashboard", () => {
  const actual = jest.requireActual("components/layout/captureDashboard");
  return { ...actual, captureDashboardCanvas: jest.fn() };
});
jest.mock("services/utilities", () => ({
  getTethysAppRoot: () => "/apps/tethysdash/",
}));

const DASHBOARD = "8a1d6a8e-0c8e-4c43-9b1e-5d2f7f0e1a11";

let drawImage;

beforeEach(() => {
  document.documentElement.style.setProperty("--ts-header-height", "56px");
  window.innerHeight = 800;
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest
    .spyOn(HTMLCanvasElement.prototype, "toDataURL")
    .mockReturnValue("data:image/png;base64,AAA");
  drawImage = jest.fn();
  jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    fillRect: () => {},
    drawImage,
  });
  captureDashboardCanvas.mockResolvedValue({
    canvas: { width: 1200, height: 3000 },
    problems: [],
    downscaled: false,
  });
});

afterEach(() => {
  document.documentElement.style.removeProperty("--ts-header-height");
});

describe("captureThumbnail", () => {
  it("captures the whole tab at screen density for the named dashboard", async () => {
    await expect(captureThumbnail(DASHBOARD)).resolves.toBe(
      "data:image/png;base64,AAA",
    );
    expect(captureDashboardCanvas).toHaveBeenCalledWith({
      mode: "whole",
      dpr: 1,
      dashboardUuid: DASHBOARD,
    });
  });

  it("keeps one screen's height from the top, scaled to 640 wide", async () => {
    await captureThumbnail(DASHBOARD);

    // One screen below the header: 800 - 56 rows of a 1200-wide capture.
    expect(drawImage).toHaveBeenCalledWith(
      expect.anything(),
      0,
      0,
      1200,
      744,
      0,
      0,
      640,
      Math.round((744 / 1200) * 640),
    );
  });

  it("keeps everything when the grid is shorter than a screen", async () => {
    captureDashboardCanvas.mockResolvedValue({
      canvas: { width: 1200, height: 300 },
      problems: [],
    });

    await captureThumbnail(DASHBOARD);

    expect(drawImage.mock.calls[0][4]).toBe(300);
  });

  it("keeps the whole capture when the window reports no height", async () => {
    window.innerHeight = 0;

    await captureThumbnail(DASHBOARD);

    expect(drawImage.mock.calls[0][4]).toBe(3000);
  });

  it("returns nothing for an empty capture", async () => {
    captureDashboardCanvas.mockResolvedValue({
      canvas: { width: 0, height: 0 },
      problems: [],
    });
    await expect(captureThumbnail(DASHBOARD)).resolves.toBeNull();
  });

  it.each([
    ["nothing to capture", new NothingToCaptureError()],
    ["an export is running", new CaptureBusyError()],
  ])("quietly returns nothing when %s", async (_, error) => {
    captureDashboardCanvas.mockRejectedValue(error);

    await expect(captureThumbnail(DASHBOARD)).resolves.toBeNull();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("reports a capture that throws rather than propagating it", async () => {
    // A failed thumbnail must not take down the save that triggered it.
    captureDashboardCanvas.mockRejectedValue(new Error("snapdom exploded"));

    await expect(captureThumbnail(DASHBOARD)).resolves.toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      "Dashboard thumbnail capture failed:",
      expect.any(Error),
    );
  });
});

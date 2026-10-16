import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ExportImageButton, {
  canCopyImages,
  describeProblems,
} from "components/layout/ExportImageButton";
import { LayoutContext } from "components/contexts/Contexts";
import LayoutAlertContextProvider from "components/contexts/LayoutAlertContext";
import DashboardLayoutAlerts from "components/dashboard/DashboardLayoutAlerts";
import {
  captureDashboard,
  CaptureBusyError,
  CAPTURE_PROBLEM,
  NothingToCaptureError,
} from "components/layout/captureDashboard";

jest.mock("components/layout/captureDashboard", () => {
  const actual = jest.requireActual("components/layout/captureDashboard");
  return { ...actual, captureDashboard: jest.fn() };
});
jest.mock("components/map/captureLockedLayers", () => ({
  captureLockedMapLayers: jest.fn(),
}));

const DASHBOARD = {
  uuid: "8a1d6a8e-0c8e-4c43-9b1e-5d2f7f0e1a11",
  name: "River",
};
const BLOB = new Blob(["png"], { type: "image/png" });
const clean = { blob: BLOB, problems: [], downscaled: false };

function renderButton(props = {}) {
  return render(
    <LayoutContext.Provider value={DASHBOARD}>
      <LayoutAlertContextProvider>
        <ExportImageButton {...props} />
        <DashboardLayoutAlerts />
      </LayoutAlertContextProvider>
    </LayoutContext.Provider>,
  );
}

async function choose(item) {
  await userEvent.click(screen.getByLabelText("exportImageButton"));
  await userEvent.click(await screen.findByText(item));
}

let clipboardWrite;
let clickedLinks;

beforeEach(() => {
  captureDashboard.mockResolvedValue(clean);
  clipboardWrite = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { write: clipboardWrite },
    configurable: true,
  });
  window.ClipboardItem = jest.fn(function ClipboardItem(items) {
    this.items = items;
  });
  window.isSecureContext = true;
  window.URL.createObjectURL = jest.fn(() => "blob:http://localhost/png");
  window.URL.revokeObjectURL = jest.fn();
  clickedLinks = [];
  jest
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(function click() {
      clickedLinks.push({ href: this.href, download: this.download });
    });
});

afterEach(() => {
  delete window.ClipboardItem;
  delete navigator.clipboard;
});

describe("ExportImageButton", () => {
  it("downloads the whole tab, named after the dashboard and the time", async () => {
    renderButton();

    await choose("Download whole tab");

    await waitFor(() => expect(clickedLinks).toHaveLength(1));
    expect(captureDashboard).toHaveBeenCalledWith({
      mode: "whole",
      dashboardUuid: DASHBOARD.uuid,
    });
    expect(clickedLinks[0].download).toMatch(
      /^River_\d{4}-\d{2}-\d{2}_\d{4}\.png$/,
    );
    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith(
      "blob:http://localhost/png",
    );
    // A clean download needs no message.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("downloads the visible area", async () => {
    renderButton();

    await choose("Download visible area");

    await waitFor(() => expect(clickedLinks).toHaveLength(1));
    expect(captureDashboard).toHaveBeenCalledWith({
      mode: "visible",
      dashboardUuid: DASHBOARD.uuid,
    });
  });

  it("writes to the clipboard inside the click, before the image exists", async () => {
    let finish;
    captureDashboard.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    renderButton();

    await choose("Copy visible area");

    // The write has to start while the user's click still grants access.
    expect(clipboardWrite).toHaveBeenCalledTimes(1);
    const [item] = clipboardWrite.mock.calls[0][0];
    expect(item.items["image/png"]).toBeInstanceOf(Promise);

    await act(async () => finish(clean));
    await expect(item.items["image/png"]).resolves.toBe(BLOB);
    expect(
      await screen.findByText("Image copied to the clipboard."),
    ).toBeInTheDocument();
  });

  it("offers no copy where the browser cannot copy images", async () => {
    delete window.ClipboardItem;
    renderButton();

    await userEvent.click(screen.getByLabelText("exportImageButton"));

    expect(await screen.findByText("Download whole tab")).toBeInTheDocument();
    expect(screen.queryByText("Copy whole tab")).not.toBeInTheDocument();
  });

  it("names what could not be included", async () => {
    captureDashboard.mockResolvedValue({
      blob: BLOB,
      problems: [
        { tile: "Rain Map", kind: CAPTURE_PROBLEM.mapLayer },
        { tile: "Logo", kind: CAPTURE_PROBLEM.image },
      ],
      downscaled: true,
    });
    renderButton();

    await choose("Download whole tab");

    expect(
      await screen.findByText(
        "Exported. Some content could not be included: Rain Map (a map layer), Logo (an image). The image was scaled down to fit the browser's size limit.",
      ),
    ).toBeInTheDocument();
  });

  it.each([
    [new Error("snapdom exploded"), "The image could not be created."],
    [
      new CaptureBusyError(),
      "Another image is still being created. Try again in a moment.",
    ],
    [new NothingToCaptureError(), "There is nothing on this tab to export."],
  ])("reports a capture that fails: %s", async (error, message) => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    captureDashboard.mockRejectedValue(error);
    renderButton();

    await choose("Download whole tab");

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(clickedLinks).toHaveLength(0);
  });

  it("suggests downloading when the clipboard refuses a finished image", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    clipboardWrite.mockRejectedValue(
      new DOMException("denied", "NotAllowedError"),
    );
    renderButton();

    await choose("Copy whole tab");

    expect(
      await screen.findByText(
        "The image could not be copied to the clipboard. Try downloading it instead.",
      ),
    ).toBeInTheDocument();
  });

  it("starts one export at a time and shows it is working", async () => {
    let finish;
    captureDashboard.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    renderButton();

    await choose("Download whole tab");

    expect(screen.getByLabelText("exportImageButton")).toBeDisabled();
    expect(screen.getByLabelText("Creating image")).toBeInTheDocument();
    expect(captureDashboard).toHaveBeenCalledTimes(1);

    await act(async () => finish(clean));
    await waitFor(() =>
      expect(screen.getByLabelText("exportImageButton")).toBeEnabled(),
    );
  });

  it("can be disabled by its header", () => {
    renderButton({ disabled: true });
    expect(screen.getByLabelText("exportImageButton")).toBeDisabled();
  });
});

describe("canCopyImages", () => {
  it("needs ClipboardItem, a clipboard that writes, and a secure page", () => {
    expect(canCopyImages()).toBe(true);
    window.isSecureContext = false;
    expect(canCopyImages()).toBe(false);
    window.isSecureContext = true;
    delete navigator.clipboard;
    expect(canCopyImages()).toBe(false);
  });
});

describe("describeProblems", () => {
  it("lists each tile with what it lost", () => {
    expect(
      describeProblems([
        { tile: "A", kind: CAPTURE_PROBLEM.image },
        { tile: "B", kind: "other" },
      ]),
    ).toBe("A (an image), B (other)");
  });
});

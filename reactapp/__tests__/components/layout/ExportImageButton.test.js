import {
  render,
  screen,
  waitFor,
  act,
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ExportImageButton, {
  canCopyImages,
  describeProblems,
  wholeCaptureLabel,
} from "components/layout/ExportImageButton";
import { LayoutContext, TabContext } from "components/contexts/Contexts";
import LayoutAlertContextProvider from "components/contexts/LayoutAlertContext";
import DashboardLayoutAlerts from "components/dashboard/DashboardLayoutAlerts";
import {
  captureDashboard,
  CaptureBusyError,
  CAPTURE_PROBLEM,
  CaptureTimeoutError,
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

const ONE_TAB = [{ id: 1, name: "Main" }];

function renderButton(props = {}, tabs = ONE_TAB) {
  const tabContext = { tabs, getActiveTab: () => tabs[tabs.length - 1] };
  return render(
    <LayoutContext.Provider value={DASHBOARD}>
      <TabContext.Provider value={tabContext}>
        <LayoutAlertContextProvider>
          <ExportImageButton {...props} />
          <DashboardLayoutAlerts />
        </LayoutAlertContextProvider>
      </TabContext.Provider>
    </LayoutContext.Provider>,
  );
}

/* Items are found by their accessible names: the same two choices sit under
   both the Download and the Copy heading. */
async function choose(item) {
  await userEvent.click(screen.getByLabelText("exportImageButton"));
  await userEvent.click(await screen.findByLabelText(item));
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

    await choose("Download entire dashboard");

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

    await choose("Download just what's on screen");

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

    await choose("Copy just what's on screen");

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

    expect(
      await screen.findByLabelText("Download entire dashboard"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Copy image to clipboard"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Copy entire dashboard"),
    ).not.toBeInTheDocument();
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

    await choose("Download entire dashboard");

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
    [new NothingToCaptureError(), "There is nothing here to save as an image."],
    [
      new CaptureTimeoutError(),
      "Creating the image took too long. Try again, or save just what's on screen.",
    ],
  ])("reports a capture that fails: %s", async (error, message) => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    captureDashboard.mockRejectedValue(error);
    renderButton();

    await choose("Download entire dashboard");

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(clickedLinks).toHaveLength(0);
  });

  it("suggests downloading when the clipboard refuses a finished image", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    clipboardWrite.mockRejectedValue(
      new DOMException("denied", "NotAllowedError"),
    );
    renderButton();

    await choose("Copy entire dashboard");

    expect(
      await screen.findByText(
        "The image could not be copied to the clipboard. Try downloading it instead.",
      ),
    ).toBeInTheDocument();
  });

  it("frees the menu when the browser throws building the clipboard item", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    window.ClipboardItem = jest.fn(() => {
      throw new TypeError("Promise values are not supported");
    });
    renderButton();

    await choose("Copy entire dashboard");

    expect(
      await screen.findByText(
        "The image could not be copied to the clipboard. Try downloading it instead.",
      ),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByLabelText("exportImageButton")).toBeEnabled(),
    );
  });

  it("starts one export at a time and shows it is working", async () => {
    let finish;
    captureDashboard.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    renderButton();

    await choose("Download entire dashboard");

    expect(screen.getByLabelText("exportImageButton")).toBeDisabled();
    expect(screen.getByLabelText("Creating image")).toBeInTheDocument();
    expect(captureDashboard).toHaveBeenCalledTimes(1);

    await act(async () => finish(clean));
    await waitFor(() =>
      expect(screen.getByLabelText("exportImageButton")).toBeEnabled(),
    );
  });

  it("ignores a second choice that lands before the first one disables the menu", async () => {
    let finish;
    captureDashboard.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    renderButton();
    await userEvent.click(screen.getByLabelText("exportImageButton"));
    const item = await screen.findByLabelText("Download entire dashboard");

    fireEvent.click(item);
    fireEvent.click(item);

    expect(captureDashboard).toHaveBeenCalledTimes(1);
    await act(async () => finish(clean));
  });

  it("groups the choices under Download and Copy, in plain words", async () => {
    renderButton();
    await userEvent.click(screen.getByLabelText("exportImageButton"));

    expect(await screen.findByText("Download image")).toBeInTheDocument();
    expect(screen.getByText("Copy image to clipboard")).toBeInTheDocument();
    expect(screen.getAllByText("Entire dashboard")).toHaveLength(2);
    expect(screen.getAllByText("Just what's on screen")).toHaveLength(2);
    expect(screen.getByLabelText("exportImageButton")).toHaveAttribute(
      "title",
      "Save as image",
    );
  });

  it("names the tab the viewer is on when the dashboard has several", async () => {
    renderButton({}, [
      { id: 1, name: "Willamette Basin" },
      { id: 2, name: "Weather Outlook" },
    ]);

    await choose("Download entire \u201cWeather Outlook\u201d tab");

    expect(captureDashboard).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "whole" }),
    );
    // The full name stays in the tooltip when a long one is cut short.
    await userEvent.click(screen.getByLabelText("exportImageButton"));
    expect(
      await screen.findByLabelText(
        "Copy entire \u201cWeather Outlook\u201d tab",
      ),
    ).toHaveAttribute("title", "Entire \u201cWeather Outlook\u201d tab");
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
        { tile: "Map popup", kind: CAPTURE_PROBLEM.popup },
        { tile: "B", kind: "other" },
      ]),
    ).toBe("A (an image), Map popup (could not be drawn), B (other)");
  });
});

describe("wholeCaptureLabel", () => {
  it("calls a single-tab dashboard the dashboard, since its tab bar is hidden", () => {
    expect(wholeCaptureLabel([{ id: 1, name: "Main" }], { name: "Main" })).toBe(
      "Entire dashboard",
    );
  });

  it("falls back to the dashboard without tabs or a named active tab", () => {
    expect(wholeCaptureLabel(undefined, undefined)).toBe("Entire dashboard");
    expect(wholeCaptureLabel([{}, {}], { name: "" })).toBe("Entire dashboard");
  });
});

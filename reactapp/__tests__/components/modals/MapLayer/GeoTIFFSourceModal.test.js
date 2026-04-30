import { useState, useRef } from "react";
import PropTypes from "prop-types";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GeoTIFFSourceModal from "components/modals/MapLayer/GeoTIFFSourceModal";

const Harness = ({
  initialShow = true,
  initialValue = null,
  onSaveSpy,
  onHideSpy,
  includeTrigger = false,
}) => {
  const [show, setShow] = useState(initialShow);
  const triggerRef = useRef(null);

  const handleHide = () => {
    setShow(false);
    if (onHideSpy) onHideSpy();
  };

  const handleSave = (payload) => {
    if (onSaveSpy) onSaveSpy(payload);
  };

  return (
    <>
      {includeTrigger && (
        <button
          ref={triggerRef}
          type="button"
          data-testid="trigger-button"
          onClick={() => setShow(true)}
        >
          Open
        </button>
      )}
      <GeoTIFFSourceModal
        show={show}
        onHide={handleHide}
        onSave={handleSave}
        initialValue={initialValue}
        returnFocusRef={includeTrigger ? triggerRef : undefined}
      />
    </>
  );
};

Harness.propTypes = {
  initialShow: PropTypes.bool,
  initialValue: PropTypes.object,
  onSaveSpy: PropTypes.func,
  onHideSpy: PropTypes.func,
  includeTrigger: PropTypes.bool,
};

test("GeoTIFFSourceModal renders all 7 fields with labels and placeholders", async () => {
  render(<Harness />);

  // Title for Add flow
  expect(await screen.findByText("Add GeoTIFF Source")).toBeInTheDocument();

  // Labels render inside <b> tags; the <b> text node matches exactly.
  expect(screen.getByText("URL")).toBeInTheDocument();
  expect(screen.getByText("Bands")).toBeInTheDocument();
  expect(screen.getByText("Min")).toBeInTheDocument();
  expect(screen.getByText("Max")).toBeInTheDocument();
  expect(screen.getByText("Nodata")).toBeInTheDocument();
  expect(screen.getByText("Projection")).toBeInTheDocument();
  expect(screen.getByText("Overviews")).toBeInTheDocument();

  // Inputs reachable by aria-label
  expect(screen.getByLabelText("URL Input")).toBeInTheDocument();
  expect(screen.getByLabelText("Bands Input")).toBeInTheDocument();
  expect(screen.getByLabelText("Min Input")).toBeInTheDocument();
  expect(screen.getByLabelText("Max Input")).toBeInTheDocument();
  expect(screen.getByLabelText("Nodata Input")).toBeInTheDocument();
  expect(screen.getByLabelText("Projection Input")).toBeInTheDocument();
  expect(screen.getByLabelText("Overviews Input")).toBeInTheDocument();

  // Placeholders
  expect(
    screen.getByPlaceholderText("https://example.com/file.tif"),
  ).toBeInTheDocument();
  expect(screen.getByPlaceholderText("1, 2, 3")).toBeInTheDocument();
  expect(screen.getByPlaceholderText("EPSG:4326")).toBeInTheDocument();
  expect(
    screen.getByPlaceholderText("One overview URL per line"),
  ).toBeInTheDocument();
});

test("GeoTIFFSourceModal title is 'Edit GeoTIFF Source' when initialValue is provided", async () => {
  render(
    <Harness
      initialValue={{
        url: "https://example.com/a.tif",
        bands: "",
        min: "",
        max: "",
        nodata: "",
        projection: "",
        overviews: [],
      }}
    />,
  );

  expect(await screen.findByText("Edit GeoTIFF Source")).toBeInTheDocument();
});

test("GeoTIFFSourceModal auto-focuses the url input when opened", async () => {
  render(<Harness />);

  await waitFor(() => {
    expect(screen.getByLabelText("URL Input")).toHaveFocus();
  });
});

test("GeoTIFFSourceModal typing a URL and clicking Save calls onSave with all fields as strings", async () => {
  const user = userEvent.setup();
  const onSaveSpy = jest.fn();
  const onHideSpy = jest.fn();

  render(<Harness onSaveSpy={onSaveSpy} onHideSpy={onHideSpy} />);

  const urlInput = await screen.findByLabelText("URL Input");
  await user.type(urlInput, "https://example.com/test.tif");

  await user.type(screen.getByLabelText("Bands Input"), "1,2,3");
  await user.type(screen.getByLabelText("Min Input"), "10");
  await user.type(screen.getByLabelText("Max Input"), "255");
  await user.type(screen.getByLabelText("Nodata Input"), "0");
  await user.type(screen.getByLabelText("Projection Input"), "EPSG:4326");

  const saveBtn = screen.getByRole("button", {
    name: "Save GeoTIFF Source Button",
  });
  expect(saveBtn).not.toBeDisabled();
  await user.click(saveBtn);

  expect(onSaveSpy).toHaveBeenCalledTimes(1);
  const payload = onSaveSpy.mock.calls[0][0];

  expect(payload.url).toBe("https://example.com/test.tif");
  expect(payload.bands).toBe("1,2,3");
  expect(payload.projection).toBe("EPSG:4326");

  // Critical invariant: numeric-looking fields are strings, not numbers
  expect(typeof payload.min).toBe("string");
  expect(typeof payload.max).toBe("string");
  expect(typeof payload.nodata).toBe("string");
  expect(payload.min).toBe("10");
  expect(payload.max).toBe("255");
  expect(payload.nodata).toBe("0");

  // Overviews is an array (empty here since nothing was typed)
  expect(Array.isArray(payload.overviews)).toBe(true);
  expect(payload.overviews).toEqual([]);

  // onHide is also called after Save
  expect(onHideSpy).toHaveBeenCalledTimes(1);
});

test("GeoTIFFSourceModal pre-populates all fields from initialValue, preserving '0' min", async () => {
  render(
    <Harness
      initialValue={{
        url: "https://example.com/a.tif",
        bands: "1,2,3",
        min: "0",
        max: "100",
        nodata: "",
        projection: "EPSG:4326",
        overviews: ["https://example.com/a.ovr", "https://example.com/b.ovr"],
      }}
    />,
  );

  expect(await screen.findByLabelText("URL Input")).toHaveValue(
    "https://example.com/a.tif",
  );
  expect(screen.getByLabelText("Bands Input")).toHaveValue("1,2,3");
  // Key bug-fix case: "0" must round-trip, not be treated as empty
  expect(screen.getByLabelText("Min Input")).toHaveValue("0");
  expect(screen.getByLabelText("Max Input")).toHaveValue("100");
  expect(screen.getByLabelText("Nodata Input")).toHaveValue("");
  expect(screen.getByLabelText("Projection Input")).toHaveValue("EPSG:4326");
  expect(screen.getByLabelText("Overviews Input")).toHaveValue(
    "https://example.com/a.ovr\nhttps://example.com/b.ovr",
  );
});

test("GeoTIFFSourceModal Save button is disabled when url is empty", async () => {
  render(<Harness />);

  const saveBtn = await screen.findByRole("button", {
    name: "Save GeoTIFF Source Button",
  });
  expect(saveBtn).toBeDisabled();
});

test("GeoTIFFSourceModal Save button is disabled when url is whitespace-only", async () => {
  const user = userEvent.setup();
  render(<Harness />);

  const urlInput = await screen.findByLabelText("URL Input");
  await user.type(urlInput, "   ");

  const saveBtn = screen.getByRole("button", {
    name: "Save GeoTIFF Source Button",
  });
  expect(saveBtn).toBeDisabled();
});

test("GeoTIFFSourceModal filters blank lines from overviews on save", async () => {
  const user = userEvent.setup();
  const onSaveSpy = jest.fn();

  render(<Harness onSaveSpy={onSaveSpy} />);

  const urlInput = await screen.findByLabelText("URL Input");
  await user.type(urlInput, "https://example.com/x.tif");

  const overviewsInput = screen.getByLabelText("Overviews Input");
  // userEvent type treats {Enter} as newline for textarea
  await user.type(overviewsInput, "https://a{Enter}{Enter}https://b{Enter}");

  await user.click(
    screen.getByRole("button", { name: "Save GeoTIFF Source Button" }),
  );

  expect(onSaveSpy).toHaveBeenCalledTimes(1);
  const payload = onSaveSpy.mock.calls[0][0];
  expect(payload.overviews).toEqual(["https://a", "https://b"]);
});

test("GeoTIFFSourceModal preserves string '0' in min on save (not coerced to number or empty)", async () => {
  const user = userEvent.setup();
  const onSaveSpy = jest.fn();

  render(<Harness onSaveSpy={onSaveSpy} />);

  await user.type(
    await screen.findByLabelText("URL Input"),
    "https://example.com/x.tif",
  );
  await user.type(screen.getByLabelText("Min Input"), "0");
  await user.type(screen.getByLabelText("Max Input"), "0");
  await user.type(screen.getByLabelText("Nodata Input"), "0");

  await user.click(
    screen.getByRole("button", { name: "Save GeoTIFF Source Button" }),
  );

  expect(onSaveSpy).toHaveBeenCalledTimes(1);
  const payload = onSaveSpy.mock.calls[0][0];
  expect(payload.min).toBe("0");
  expect(payload.max).toBe("0");
  expect(payload.nodata).toBe("0");
  // And ensure they are not numeric 0 or empty strings
  expect(typeof payload.min).toBe("string");
  expect(payload.min).not.toBe("");
  expect(payload.min).not.toBe(0);
});

test("GeoTIFFSourceModal Cancel does NOT fire onSave but does fire onHide", async () => {
  const user = userEvent.setup();
  const onSaveSpy = jest.fn();
  const onHideSpy = jest.fn();

  render(<Harness onSaveSpy={onSaveSpy} onHideSpy={onHideSpy} />);

  await user.type(
    await screen.findByLabelText("URL Input"),
    "https://example.com/x.tif",
  );

  await user.click(
    screen.getByRole("button", { name: "Cancel GeoTIFF Source Button" }),
  );

  expect(onSaveSpy).not.toHaveBeenCalled();
  expect(onHideSpy).toHaveBeenCalledTimes(1);
});

test("GeoTIFFSourceModal pressing Escape closes the modal without firing onSave", async () => {
  const user = userEvent.setup();
  const onSaveSpy = jest.fn();
  const onHideSpy = jest.fn();

  render(<Harness onSaveSpy={onSaveSpy} onHideSpy={onHideSpy} />);

  await screen.findByLabelText("URL Input");
  await user.keyboard("{Escape}");

  await waitFor(() => {
    expect(onHideSpy).toHaveBeenCalled();
  });
  expect(onSaveSpy).not.toHaveBeenCalled();
});

test("seedFromInitial fills missing fields with defaults when initialValue is a partial object", async () => {
  // Covers the `?? ""` fallbacks at lines 34-39 and the `Array.isArray`
  // else branch at line 30. An empty (but truthy) object skips the
  // `!initialValue` early-return, then each ?? falls through to "" and
  // overviews falls through to [] (rendered as empty string).
  render(<Harness initialValue={{}} />);

  // Edit-mode title — proves the truthy-but-empty initialValue path was
  // taken (not the null/falsy emptyState() branch).
  expect(await screen.findByText("Edit GeoTIFF Source")).toBeInTheDocument();

  // Every field defaulted to empty string.
  expect(screen.getByLabelText("URL Input")).toHaveValue("");
  expect(screen.getByLabelText("Bands Input")).toHaveValue("");
  expect(screen.getByLabelText("Min Input")).toHaveValue("");
  expect(screen.getByLabelText("Max Input")).toHaveValue("");
  expect(screen.getByLabelText("Nodata Input")).toHaveValue("");
  expect(screen.getByLabelText("Projection Input")).toHaveValue("");
  expect(screen.getByLabelText("Overviews Input")).toHaveValue("");
});

test("auto-focus rAF callback is a no-op when the url input ref is null at fire time", async () => {
  // Covers the `if (urlInputRef.current)` else branch (line 68). We
  // intercept requestAnimationFrame, capture the callback, then close
  // the modal so the urlInputRef detaches before invoking the callback
  // by hand. The callback should run without throwing.
  let capturedCb;
  const rafSpy = jest
    .spyOn(global, "requestAnimationFrame")
    .mockImplementation((cb) => {
      capturedCb = cb;
      return 1;
    });
  // Don't actually cancel — we want to fire the captured callback below.
  const cancelSpy = jest
    .spyOn(global, "cancelAnimationFrame")
    .mockImplementation(() => {});

  const Closer = () => {
    const [show, setShow] = useState(true);
    return (
      <>
        <GeoTIFFSourceModal
          show={show}
          onHide={() => setShow(false)}
          onSave={jest.fn()}
          initialValue={null}
        />
        <button data-testid="hide" onClick={() => setShow(false)}>
          hide
        </button>
      </>
    );
  };

  render(<Closer />);
  // Effect ran, RAF was scheduled, callback captured.
  expect(typeof capturedCb).toBe("function");

  // Close the modal so its body unmounts and urlInputRef.current goes null.
  await userEvent.click(screen.getByTestId("hide"));
  await waitFor(() => {
    expect(screen.queryByLabelText("URL Input")).not.toBeInTheDocument();
  });

  // Now fire the captured RAF callback. The else branch runs — no throw,
  // no focus call (the input is gone).
  expect(() => capturedCb()).not.toThrow();

  rafSpy.mockRestore();
  cancelSpy.mockRestore();
});

test("GeoTIFFSourceModal returns focus to returnFocusRef element on close", async () => {
  const user = userEvent.setup();
  const onSaveSpy = jest.fn();

  render(<Harness onSaveSpy={onSaveSpy} includeTrigger />);

  // Wait for url input to be focused (modal is open)
  await waitFor(() => {
    expect(screen.getByLabelText("URL Input")).toHaveFocus();
  });

  await user.click(
    screen.getByRole("button", { name: "Cancel GeoTIFF Source Button" }),
  );

  // onExited fires after the exit transition completes. Wait for focus
  // to return to the trigger button.
  await waitFor(
    () => {
      expect(screen.getByTestId("trigger-button")).toHaveFocus();
    },
    { timeout: 2000 },
  );
});

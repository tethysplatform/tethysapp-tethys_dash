import {
  CANCEL_REASON,
  ERROR_KIND,
  isRetryable,
  errorKindFor,
} from "components/map/layerStatus";

describe("cancel reasons", () => {
  it("names the three reasons a load stops", () => {
    expect(Object.values(CANCEL_REASON).sort()).toEqual([
      "removed",
      "superseded",
      "unmount",
    ]);
  });
});

describe("isRetryable", () => {
  it("offers retry only for a fetch-stage failure", () => {
    // Re-running the same request can only help when the request itself was the
    // problem. Offering it for the others invites a viewer to re-download
    // megabytes and fail identically.
    expect(isRetryable(ERROR_KIND.FETCH)).toBe(true);
    expect(isRetryable(ERROR_KIND.PARSE)).toBe(false);
    expect(isRetryable(ERROR_KIND.TOO_LARGE)).toBe(false);
    expect(isRetryable(ERROR_KIND.PROJECTION)).toBe(false);
    expect(isRetryable(ERROR_KIND.UNAVAILABLE)).toBe(false);
  });

  it("does not offer retry for an unknown kind", () => {
    expect(isRetryable(undefined)).toBe(false);
    expect(isRetryable("something-else")).toBe(false);
  });
});

describe("errorKindFor", () => {
  it.each([
    [{ stage: "fetch", reason: "unreachable" }, ERROR_KIND.FETCH],
    [{ stage: "fetch", reason: "unsupported_scheme" }, ERROR_KIND.FETCH],
    [{ stage: "fetch", reason: "component_status" }, ERROR_KIND.FETCH],
    [{ stage: "parse", reason: "unreadable_archive" }, ERROR_KIND.PARSE],
    [{ stage: "parse", reason: "wrong_content_type" }, ERROR_KIND.PARSE],
    [{ stage: "parse", reason: "unreadable_geometry" }, ERROR_KIND.PARSE],
    [{ stage: "parse", reason: "ambiguous_archive" }, ERROR_KIND.PARSE],
  ])("maps %o to %s", (failure, expected) => {
    expect(errorKindFor(failure)).toBe(expected);
  });

  it("gives the size ceiling its own kind regardless of stage", () => {
    // The pipeline reports this on the fetch stage, but a viewer must not be
    // offered a retry for it.
    expect(errorKindFor({ stage: "fetch", reason: "too_large" })).toBe(
      ERROR_KIND.TOO_LARGE,
    );
    expect(
      isRetryable(errorKindFor({ stage: "fetch", reason: "too_large" })),
    ).toBe(false);
  });

  it.each(["missing_projection", "unresolvable_projection"])(
    "gives %s the projection kind so retry is withheld",
    (reason) => {
      const kind = errorKindFor({ stage: "parse", reason });
      expect(kind).toBe(ERROR_KIND.PROJECTION);
      expect(isRetryable(kind)).toBe(false);
    },
  );

  it("gives a url-shape problem its own kind so no host remedy is offered", () => {
    // A rejected url is not a reachability failure. Classifying it as one made
    // the editor suggest converting the file because the host could not be
    // reached, and offer a retry that would fail identically forever.
    const kind = errorKindFor({ stage: "input", reason: "unsupported_path" });
    expect(kind).toBe(ERROR_KIND.INPUT);
    expect(isRetryable(kind)).toBe(false);
  });

  it("defaults to the fetch kind for an unrecognised failure", () => {
    expect(errorKindFor(undefined)).toBe(ERROR_KIND.FETCH);
    expect(errorKindFor({})).toBe(ERROR_KIND.FETCH);
  });
});

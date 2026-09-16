import {
  CANCEL_REASON,
  ERROR_KIND,
  LAYER_STATE,
  isRetryable,
  errorKindFor,
  mergeLayerStatus,
  parseProgress,
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
    [{ stage: "parse", reason: "unreadable_geometry" }, ERROR_KIND.PARSE],
    [{ stage: "parse", reason: "ambiguous_archive" }, ERROR_KIND.PARSE],
  ])("maps %o to %s", (failure, expected) => {
    expect(errorKindFor(failure)).toBe(expected);
  });

  it.each([
    [{ stage: "parse", reason: "wrong_content_type" }],
    [{ stage: "parse", reason: "incomplete_archive" }],
  ])(
    "treats %o as a transfer failure even though it surfaced at the parse stage",
    (failure) => {
      // A portal answering with an HTML error page under a 200, and an archive
      // whose bytes stopped arriving, are conditions of the host and the
      // connection -- the most retryable things that can happen. This case
      // previously asserted PARSE, which withheld the retry that would have
      // fixed it and told the author their file was wrong.
      expect(errorKindFor(failure)).toBe(ERROR_KIND.FETCH);
      expect(isRetryable(errorKindFor(failure))).toBe(true);
    },
  );

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

describe("layer states", () => {
  it("names the three states a layer reports", () => {
    expect(Object.values(LAYER_STATE).sort()).toEqual([
      "error",
      "loading",
      "ready",
    ]);
  });
});

describe("mergeLayerStatus", () => {
  const loading = { state: LAYER_STATE.LOADING };
  const ready = { state: LAYER_STATE.READY };
  const failed = { state: LAYER_STATE.ERROR, message: "boom" };

  it("keeps an outstanding load over a settled one", () => {
    // The case the helper exists for: construction settles a runtime layer as
    // ready while its plugin fetch is still outstanding, and a plain spread
    // would report the layer as done.
    expect(mergeLayerStatus({ A: ready }, { A: loading })).toEqual({
      A: loading,
    });
    expect(mergeLayerStatus({ A: loading }, { A: ready })).toEqual({
      A: loading,
    });
  });

  it("keeps a failure over both", () => {
    expect(mergeLayerStatus({ A: failed }, { A: loading })).toEqual({
      A: failed,
    });
    expect(mergeLayerStatus({ A: ready }, { A: failed })).toEqual({
      A: failed,
    });
  });

  it("lets the later source win a tie, as the spread it replaces did", () => {
    const second = { state: LAYER_STATE.ERROR, message: "newer" };
    expect(mergeLayerStatus({ A: failed }, { A: second })).toEqual({
      A: second,
    });
  });

  it("unions layers across sources and tolerates missing ones", () => {
    expect(mergeLayerStatus({ A: loading }, undefined, { B: ready })).toEqual({
      A: loading,
      B: ready,
    });
    expect(mergeLayerStatus()).toEqual({});
  });

  it("keeps an entry whose state it does not recognise", () => {
    const odd = { state: "something-else" };
    expect(mergeLayerStatus({ A: odd })).toEqual({ A: odd });
  });
});

describe("parseProgress", () => {
  it("reads a numeric percentage out of a progress message", () => {
    expect(parseProgress(JSON.stringify({ percentageComplete: 42 }))).toBe(42);
    expect(parseProgress(JSON.stringify({ percentageComplete: 0 }))).toBe(0);
  });

  it("returns null for anything that is not a numeric percentage", () => {
    expect(parseProgress(null)).toBeNull();
    expect(parseProgress(undefined)).toBeNull();
    expect(parseProgress("not json")).toBeNull();
    expect(parseProgress(JSON.stringify({ message: "working" }))).toBeNull();
    expect(
      parseProgress(JSON.stringify({ percentageComplete: "60" })),
    ).toBeNull();
  });
});

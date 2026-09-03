// Read a public Zarr store directly in the browser. Group attrs carry
// georeferencing (`transform`, `crs`) and optional masking (`extent_threshold_m`,
// `source_nodata`).

// zarrita is only needed when a Zarr layer renders, so keep it out of the
// initial bundle every dashboard downloads. Mirrors getHyparquet/getGeoPackageLib.
let zarritaLib = null;
async function getZarrita() {
  if (!zarritaLib) zarritaLib = await import("zarrita");
  return zarritaLib;
}

// A read that never settles leaves the layer spinning with no way to tell it
// from a slow one, so bound every store request.
const ZARR_FETCH_TIMEOUT_MS = 30000;

// AbortSignal.timeout is unavailable in jsdom and older browsers; fall back to
// a controller. Returns undefined where AbortController is missing too, so the
// fetch simply proceeds unbounded rather than throwing.
function timeoutSignal(ms) {
  if (typeof AbortSignal !== "undefined" && AbortSignal.timeout) {
    return AbortSignal.timeout(ms);
  }
  if (typeof AbortController === "undefined") return undefined;
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

// Reasons a v3 open can fail that mean "this isn't a v3 store" rather than
// "the store is unreachable". Only those are worth retrying as v2.
function isFormatMismatch(error) {
  const message = String(error?.message ?? error ?? "");
  return (
    error?.name === "NodeNotFoundError" ||
    /not found|no such|404|zarr\.json|missing/i.test(message)
  );
}

// Open the node at `url` (group or array), trying zarr v3 then falling back to
// v2. A network/CORS/timeout failure is rethrown as-is: retrying it as v2 only
// issues a second doomed request and replaces the real cause with a misleading
// "not a v2 store" message, which is exactly wrong when CORS is the problem.
async function openNode(url) {
  const { FetchStore, open } = await getZarrita();
  const signal = timeoutSignal(ZARR_FETCH_TIMEOUT_MS);
  const store = new FetchStore(
    url.replace(/\/$/, ""),
    signal ? { overrides: { signal } } : undefined,
  );
  let v3Error;
  try {
    return await open.v3(store);
  } catch (error) {
    if (!isFormatMismatch(error)) throw error;
    v3Error = error;
  }
  try {
    return await open.v2(store);
  } catch (v2Error) {
    if (!isFormatMismatch(v2Error)) throw v2Error;
    throw new Error(
      `could not open '${url}' as a zarr v3 or v2 store ` +
        `(v3: ${v3Error?.message ?? v3Error}; v2: ${v2Error?.message ?? v2Error})`,
      { cause: v2Error },
    );
  }
}

// (n_slices, height, width) for a 2-D [y, x] or 3-D [n, y, x] array.
function gridDims(shape) {
  if (shape.length === 2) return { n: 1, h: shape[0], w: shape[1] };
  if (shape.length === 3) return { n: shape[0], h: shape[1], w: shape[2] };
  throw new Error(
    `expected a 2D [y, x] or 3D [n, y, x] array, got shape [${shape.join(", ")}]`,
  );
}

// Affine transform [a, b, c, d, e, f] + grid size -> [minx, miny, maxx, maxy].
// e is normally negative, so bottom < top; order both pairs so min <= max and a
// west-decreasing (negative `a`) grid cannot invert the extent.
//
// The slice renders as one axis-aligned tile at a single resolution, so a
// rotated transform (nonzero b/d) cannot be represented and is rejected rather
// than silently drawn as if it were north-up. The backend this replaced handed
// the full affine to GDAL, which honored rotation natively.
function extentFromTransform(transform, h, w) {
  const [a, b, c, d, e, f] = transform.map(Number);
  if (b !== 0 || d !== 0) {
    throw new Error(
      `store's 'transform' has rotation/skew terms (b=${b}, d=${d}); ` +
        `only north-up, axis-aligned grids can be rendered`,
    );
  }
  if (!Number.isFinite(a) || !Number.isFinite(e) || a === 0 || e === 0) {
    throw new Error(
      `store's 'transform' has a zero or non-numeric pixel size ` +
        `(a=${a}, e=${e}); cannot georeference`,
    );
  }
  const right = c + a * w;
  const bottom = f + e * h;
  return [
    Math.min(c, right),
    Math.min(f, bottom),
    Math.max(c, right),
    Math.max(f, bottom),
  ];
}

// Pixel sizes from the transform. The tile grid carries one resolution, so a
// store with non-square pixels would be drawn stretched; surface both so the
// caller can reject that rather than render it wrong.
function pixelSizes(transform) {
  const [a, , , , e] = transform.map(Number);
  return { x: Math.abs(a), y: Math.abs(e) };
}

function requireAttr(attrs, name) {
  if (!(name in attrs)) {
    throw new Error(`store missing '${name}' attr; cannot georeference`);
  }
  return attrs[name];
}

/**
 * Read one 2-D slice of a Zarr variable as tile data for an OL DataTile source.
 *
 * The slice is a plain [y, x] array, or `index` along a leading [n, y, x]
 * dimension. Cells are masked (alpha 0 -> rendered transparent) when `<= maskBelow`
 * or `=== sourceNodata`; both default to the store's own `extent_threshold_m` /
 * `source_nodata` attrs, so a store can declare its own masking.
 *
 * Returns { width, height, extent, crs, data, min, max } where `data` is a
 * Float32Array of interleaved [value, alpha] pairs and min/max span the visible
 * cells (for fitting the color ramp).
 */
export async function readSlice({
  url,
  variable,
  index = 0,
  maskBelow,
  sourceNodata,
} = {}) {
  const group = await openNode(url);
  const attrs = group.attrs;
  const transform = requireAttr(attrs, "transform");
  requireAttr(attrs, "crs");

  const arr = await openNode(`${url.replace(/\/$/, "")}/${variable}`);
  const { n, h, w } = gridDims(arr.shape);

  let selection;
  if (arr.shape.length === 2) {
    if (index !== 0)
      throw new Error("2D array has a single slice; index must be 0");
    selection = [null, null];
  } else {
    if (!(index >= 0 && index < n)) {
      throw new Error(`index ${index} out of range 0..${n - 1}`);
    }
    selection = [index, null, null];
  }
  const { get } = await getZarrita();
  const raw = (await get(arr, selection)).data;

  const below = maskBelow ?? attrs.extent_threshold_m;
  const nodata = sourceNodata ?? attrs.source_nodata;
  const belowNum = below == null ? null : Number(below);
  const nodataNum = nodata == null ? null : Number(nodata);

  const data = new Float32Array(w * h * 2); // interleaved [value, alpha]
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < w * h; i++) {
    const v = Number(raw[i]);
    const masked =
      Number.isNaN(v) ||
      (belowNum !== null && v <= belowNum) ||
      (nodataNum !== null && v === nodataNum);
    data[i * 2] = masked ? 0 : v;
    data[i * 2 + 1] = masked ? 0 : 1;
    if (!masked) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (min === Infinity) min = max = 0; // every cell masked

  return {
    width: w,
    height: h,
    extent: extentFromTransform(transform, h, w),
    pixelSize: pixelSizes(transform),
    crs: attrs.crs,
    data,
    min,
    max,
  };
}

/**
 * Selectable metadata for a Zarr store:
 * { variables, slice_count, slice_labels, crs, grid_shape, extent }.
 *
 * NOTE: intentionally not wired into the UI yet. This is the client-side
 * replacement for the removed `tethysdash/zarr/meta` endpoint, kept so the
 * MapLayer editor can grow a variable/slice picker without re-deriving the
 * read. Until then a layer author types `variable`/`index` by hand and finds
 * out they are wrong when the layer fails to render. Delete this if that picker
 * is not going to be built.
 *
 * HTTP-backed stores cannot be listed, so `variables` comes from the caller's
 * `candidates` (or the chosen `variable`). `labelVar` names a 1-D array whose
 * values label each slice; otherwise labels are the slice indices.
 */
export async function readMetadata({
  url,
  variable,
  candidates,
  labelVar,
} = {}) {
  const group = await openNode(url);
  const attrs = group.attrs;

  const variables = candidates?.length
    ? candidates
    : variable
      ? [variable]
      : [];
  const refName = variable ?? variables[0];
  if (!refName) {
    throw new Error(
      "could not determine a griddable variable; pass `variable`",
    );
  }

  const base = url.replace(/\/$/, "");
  const arr = await openNode(`${base}/${refName}`);
  const { n, h, w } = gridDims(arr.shape);
  const transform = requireAttr(attrs, "transform");

  let sliceLabels;
  if (labelVar) {
    try {
      const larr = await openNode(`${base}/${labelVar}`);
      if (larr.shape.length === 1 && larr.shape[0] === n) {
        const { get } = await getZarrita();
        const values = (await get(larr, [null])).data;
        sliceLabels = Array.from(values, (v) => `${Number(v)}`);
      }
    } catch {
      // label array absent or unreadable -> fall back to indices below
    }
  }
  if (!sliceLabels) sliceLabels = Array.from({ length: n }, (_, i) => `${i}`);

  return {
    variables,
    slice_count: n,
    slice_labels: sliceLabels,
    crs: attrs.crs ?? null,
    grid_shape: [h, w],
    extent: extentFromTransform(transform, h, w),
  };
}

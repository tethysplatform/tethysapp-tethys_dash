import { FetchStore, get, open } from "zarrita";

// Read a public Zarr store directly in the browser. Group attrs carry
// georeferencing (`transform`, `crs`) and optional masking (`extent_threshold_m`,
// `source_nodata`).

// Open the node at `url` (group or array), trying zarr v3 then falling back to v2.
async function openNode(url) {
  const store = new FetchStore(url.replace(/\/$/, ""));
  try {
    return await open.v3(store);
  } catch {
    return await open.v2(store);
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
// e is negative, so bottom < top; order the pair so miny <= maxy.
function extentFromTransform(transform, h, w) {
  const [a, , c, , e, f] = transform.map(Number);
  const maxx = c + a * w;
  const bottom = f + e * h;
  return [c, Math.min(f, bottom), maxx, Math.max(f, bottom)];
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

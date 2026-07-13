// --- CSV download modebar button ---------------------------------------------
// Serialize the currently-visible traces of a plotly figure to CSV. Only traces
// the user can actually see are included (legend-hidden traces are skipped),
// matching the "download the data visible to the user" intent.

const Plotly = require("plotly.js-strict-dist-min");

const csvEscape = (v) => {
  if (v === undefined || v === null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// Plotly.py encodes numeric arrays as base64 typed-arrays ({ dtype, bdata });
// plotly.js keeps that raw object on gd.data. Decode it (and handle real
// TypedArrays) so numeric x/y values are not lost in the exported CSV.
const DTYPE_TO_TYPED_ARRAY = {
  f8: Float64Array,
  f4: Float32Array,
  i1: Int8Array,
  i2: Int16Array,
  i4: Int32Array,
  u1: Uint8Array,
  u2: Uint16Array,
  u4: Uint32Array,
};

const decodeTypedArray = (spec) => {
  const Ctor = DTYPE_TO_TYPED_ARRAY[spec.dtype];
  if (!Ctor || typeof spec.bdata !== "string") return [];
  const binary = atob(spec.bdata);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return Array.from(new Ctor(bytes.buffer));
};

const toArray = (v) => {
  if (Array.isArray(v)) return v;
  if (ArrayBuffer.isView(v)) return Array.from(v);
  if (v && typeof v === "object" && typeof v.bdata === "string" && v.dtype) {
    return decodeTypedArray(v);
  }
  return [];
};

// Serialize a single table trace (header/cells) to its own CSV section.
const buildTableSection = (t) => {
  const headers = (t.header?.values || []).map((h) =>
    Array.isArray(h) ? h.join(" ") : h,
  );
  const columns = (t.cells?.values || []).map(toArray);
  const rowCount = columns.reduce((m, c) => Math.max(m, c.length), 0);
  const lines = [headers.map(csvEscape).join(",")];
  for (let r = 0; r < rowCount; r++) {
    lines.push(columns.map((c) => csvEscape(c[r])).join(","));
  }
  return lines.join("\n");
};

// Choose a comparator for wide-format row keys (String(x) values): numeric if
// every key is a finite number, else chronological if every key parses as a
// date, else lexicographic. Falling back to lexicographic never throws.
const compareRowKeys = (keys) => {
  const isNumeric = keys.every(
    (k) => k.trim() !== "" && Number.isFinite(Number(k)),
  );
  if (isNumeric) return (a, b) => Number(a) - Number(b);

  const isDate = keys.every((k) => !Number.isNaN(Date.parse(k)));
  if (isDate) return (a, b) => Date.parse(a) - Date.parse(b);

  return (a, b) => (a < b ? -1 : a > b ? 1 : 0);
};

// Serialize the cartesian (non-table) traces. Default is a wide table keyed
// by x, sorted per compareRowKeys. If any trace has a duplicate x value, the
// pivot would silently overwrite points (e.g. fill bands, vertical lines), so
// the whole section instead emits in long format (trace,x,y) preserving every
// point in per-trace order.
const buildCartesianSection = (cartesianTraces) => {
  const names = cartesianTraces.map((t, i) => t.name || `series_${i}`);

  const hasDuplicateX = cartesianTraces.some((t) => {
    const xs = toArray(t.x).map(String);
    return new Set(xs).size !== xs.length;
  });

  if (hasDuplicateX) {
    const lines = ["trace,x,y"];
    cartesianTraces.forEach((t, i) => {
      const xs = toArray(t.x);
      const ys = toArray(t.y);
      xs.forEach((xv, j) => {
        lines.push(
          [csvEscape(names[i]), csvEscape(xv), csvEscape(ys[j])].join(","),
        );
      });
    });
    return lines.join("\n");
  }

  const rowsByX = new Map();
  cartesianTraces.forEach((t, i) => {
    const xs = toArray(t.x);
    const ys = toArray(t.y);
    xs.forEach((xv, j) => {
      const key = String(xv);
      if (!rowsByX.has(key)) rowsByX.set(key, { x: xv });
      rowsByX.get(key)[i] = ys[j];
    });
  });

  const sortedKeys = Array.from(rowsByX.keys()).sort(
    compareRowKeys(Array.from(rowsByX.keys())),
  );
  const header = ["x", ...names];
  const lines = [header.map(csvEscape).join(",")];
  for (const key of sortedKeys) {
    const row = rowsByX.get(key);
    lines.push(
      [
        csvEscape(row.x),
        ...cartesianTraces.map((_, i) => csvEscape(row[i])),
      ].join(","),
    );
  }
  return lines.join("\n");
};

export const buildCsvFromGraphDiv = (gd) => {
  const traces = (gd?.data || []).filter(
    (t) => t && t.visible !== false && t.visible !== "legendonly",
  );
  if (!traces.length) return "";

  // Table traces (e.g. the exceedance table) carry header/cells, not x/y;
  // everything else is treated as cartesian (x/y) data.
  const cartesianTraces = traces.filter((t) => t.type !== "table");
  const tableTraces = traces.filter((t) => t.type === "table");

  const sections = [];
  if (cartesianTraces.length) {
    sections.push(buildCartesianSection(cartesianTraces));
  }
  tableTraces.forEach((t) => sections.push(buildTableSection(t)));

  return sections.join("\n\n");
};

export const downloadCsvFromGraphDiv = (gd) => {
  const csv = buildCsvFromGraphDiv(gd);
  if (!csv) return;
  const rawTitle = gd?.layout?.title?.text || gd?.layout?.title || "plot_data";
  const filename =
    String(rawTitle)
      .replace(/[^\w.-]+/g, "_")
      .replace(/^_+|_+$/g, "") || "plot_data";
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${filename}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

export const csvDownloadButton = {
  name: "downloadCsv",
  title: "Download data as CSV",
  icon: Plotly.Icons?.disk,
  click: (gd) => downloadCsvFromGraphDiv(gd),
};

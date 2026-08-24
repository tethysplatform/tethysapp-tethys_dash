// The components of an unzipped shapefile. `shp` carries geometry, `dbf`
// attributes, `prj` the coordinate reference system as WKT, and `shx` the record
// index.
export const COMPONENT_EXTENSIONS = ["shp", "dbf", "prj", "shx"];

const ALLOWED_PROTOCOLS = ["http:", "https:"];

function failure(reason, detail) {
  return { error: { stage: "fetch", reason, detail } };
}

// The extension of the final path segment, lower-cased, or "" when there is
// none. Read from the path alone: a download endpoint whose query string says
// `format=shp` is not a .shp path, and a .zip path carrying a cache token still
// is an archive.
function pathExtension(url) {
  const segments = url.pathname.split("/");
  const last = segments[segments.length - 1];
  const dot = last.lastIndexOf(".");
  return dot === -1 ? "" : last.slice(dot + 1).toLowerCase();
}

/**
 * Decide whether a source URL is usable, and which of the two accepted forms it
 * is.
 *
 * Runs before any fetch. The scheme restriction is the point: an author-supplied
 * `data:` URI would carry an entire base64 archive into the saved layer
 * configuration, which is exactly the storage accumulation that referencing a
 * remote URL exists to avoid.
 *
 * @param {string} rawUrl The author-supplied URL.
 * @returns {{form: "archive"|"components", url: string}|{error: object}}
 */
export function validateSourceUrl(rawUrl) {
  if (typeof rawUrl !== "string" || rawUrl.trim() === "") {
    return failure("empty", "No shapefile URL was supplied.");
  }

  const trimmed = rawUrl.trim();

  // Checked before parsing, because a protocol-relative URL has no protocol to
  // report and would otherwise surface as an unhelpful malformed-URL error.
  if (trimmed.startsWith("//")) {
    return failure(
      "unsupported_scheme",
      "A protocol-relative URL is not accepted. Use an http:// or https:// URL.",
    );
  }

  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return failure("malformed_url", `"${trimmed}" is not a valid URL.`);
  }

  if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
    return failure(
      "unsupported_scheme",
      `The scheme "${url.protocol}" is not accepted. Use an http:// or https:// URL.`,
    );
  }

  const extension = pathExtension(url);
  if (extension === "zip") return { form: "archive", url: trimmed };
  if (extension === "shp") return { form: "components", url: trimmed };

  return failure(
    "unsupported_path",
    "The URL path must end in .zip for a zipped shapefile, or .shp for an unzipped one.",
  );
}

/**
 * Derive the sibling component URLs from a `.shp` URL.
 *
 * Only the final path segment's extension is replaced; the query string and
 * fragment are carried through untouched. Presigned links compute their
 * signature over the object key and portal links carry cache tokens, so
 * rewriting anything outside the path corrupts the request.
 *
 * @param {string} shpUrl A validated `.shp` URL.
 * @returns {Record<string, string>} One URL per component extension.
 */
export function deriveSiblingUrls(shpUrl) {
  const url = new URL(shpUrl);
  const segments = url.pathname.split("/");
  const last = segments[segments.length - 1];
  const stem = last.slice(0, last.lastIndexOf("."));

  return COMPONENT_EXTENSIONS.reduce((derived, extension) => {
    const rebuilt = new URL(url.toString());
    rebuilt.pathname = [...segments.slice(0, -1), `${stem}.${extension}`].join(
      "/",
    );
    return { ...derived, [extension]: rebuilt.toString() };
  }, {});
}

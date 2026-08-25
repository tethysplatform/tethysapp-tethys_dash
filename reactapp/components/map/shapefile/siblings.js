// The components of an unzipped shapefile. `shp` carries geometry, `dbf`
// attributes, `prj` the coordinate reference system as WKT, and `shx` the record
// index.
export const COMPONENT_EXTENSIONS = ["shp", "dbf", "prj", "shx"];

const ALLOWED_PROTOCOLS = ["http:", "https:"];

// Something wrong with what the author typed, as distinct from something wrong
// with the host. Kept separate so these never suggest converting the file
// because the host is unreachable, and never offer a retry -- re-running an
// unsupported URL fails identically forever.
function inputFailure(reason, detail) {
  return { error: { stage: "input", reason, detail } };
}

// Extensions that clearly name a different format. A path ending in one of these
// is a mistake worth catching before a request goes out; a path with no
// extension at all is not, since that is what a download endpoint looks like.
const WRONG_FORMAT_EXTENSIONS = [
  "geojson",
  "json",
  "kml",
  "kmz",
  "csv",
  "tif",
  "tiff",
  "gpkg",
  "gdb",
];

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
    return inputFailure("empty", "No shapefile URL was supplied.");
  }

  const trimmed = rawUrl.trim();

  // Checked before parsing, because a protocol-relative URL has no protocol to
  // report and would otherwise surface as an unhelpful malformed-URL error.
  if (trimmed.startsWith("//")) {
    return inputFailure(
      "unsupported_scheme",
      "A protocol-relative URL is not accepted. Use an http:// or https:// URL.",
    );
  }

  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return inputFailure("malformed_url", `"${trimmed}" is not a valid URL.`);
  }

  if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
    return inputFailure(
      "unsupported_scheme",
      `The scheme "${url.protocol}" is not accepted. Use an http:// or https:// URL.`,
    );
  }

  const extension = pathExtension(url);
  if (extension === "zip") return { form: "archive", url: trimmed };
  // A .shp path is the only case sibling derivation can work from, since it
  // needs an extension to replace.
  if (extension === "shp") return { form: "components", url: trimmed };

  if (WRONG_FORMAT_EXTENSIONS.includes(extension)) {
    return inputFailure(
      "unsupported_path",
      `A ".${extension}" file is not a shapefile. Supply a zipped shapefile, or the .shp of an unzipped one.`,
    );
  }

  // No extension, or one we do not recognise: treat it as an archive and let the
  // bytes decide. Portal download endpoints are the common shape here -- ArcGIS
  // Hub serves shapefiles from paths ending in "data", with the format in the
  // query string -- and rejecting those on path shape alone would turn away the
  // host class most authors actually use.
  return { form: "archive", url: trimmed };
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

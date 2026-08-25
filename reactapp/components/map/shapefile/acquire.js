import {
  validateSourceUrl,
  deriveSiblingUrls,
  COMPONENT_EXTENSIONS,
} from "components/map/shapefile/siblings";
import {
  unzipShapefileComponents,
  createByteBudget,
} from "components/map/shapefile/unzip";
import {
  getCachedComponents,
  setCachedComponents,
} from "components/map/shapefile/cache";

// The ceiling on how much a shapefile is allowed to expand to. Applied
// identically here and at view time, because the two paths share this module --
// a single number is what keeps an author from saving a layer viewers cannot
// load.
export const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;

// A browser cannot tell these apart: a cross-origin refusal, an unreachable
// host, a missing file and an expired signature all surface as the same opaque
// rejection, with no status and no body. So the message names them together
// rather than picking one and being wrong.
const FETCH_STAGE_CAUSES =
  "The likely causes are missing cross-origin headers on the host, an unreachable host, a URL that no longer exists, or an expired signature on a signed URL.";

// Components whose absence cannot change how the layer draws: the encoding
// falls back to a sniff of the .dbf itself, and the record index is never read.
// Hosts disagree on what a missing object is -- an S3 bucket without
// ListBucket returns 403, not 404 -- so for these two, any client error means
// "not published" rather than failing a layer over a file it did not need.
const INCONSEQUENTIAL_COMPONENTS = ["cpg", "shx"];

function fetchFailure(reason, detail, extra = {}) {
  return { error: { stage: "fetch", reason, detail, ...extra } };
}

// A host returning an HTML error page with a success status is common on the
// portal class this feature targets, and it would otherwise reach the parser as
// geometry. Only markup is rejected: .prj is legitimately text, and archives are
// served as everything from application/zip to octet-stream to nothing at all,
// so allow-listing would break more hosts than it protects.
function isMarkup(contentType) {
  if (!contentType) return false;
  return /^\s*(text\/html|application\/xhtml)/i.test(contentType);
}

function wasAborted(error, signal) {
  return signal?.aborted || error?.name === "AbortError";
}

async function fetchBytes(url, signal) {
  let response;
  try {
    response = await fetch(url, { signal });
  } catch (error) {
    if (wasAborted(error, signal)) return { cancelled: true };
    return fetchFailure(
      "unreachable",
      `The shapefile could not be fetched. ${FETCH_STAGE_CAUSES}`,
    );
  }

  const contentType = response.headers?.get?.("content-type") ?? "";
  if (response.ok && isMarkup(contentType)) {
    return {
      error: {
        stage: "parse",
        reason: "wrong_content_type",
        detail: `The host returned "${contentType}" rather than shapefile data. A portal error page served with a success status is the usual cause.`,
      },
    };
  }

  if (!response.ok) {
    return { status: response.status, response };
  }

  try {
    // Read the whole body rather than streaming it. Aborting rejects this and
    // terminates the transfer, which is what cancellation needs, and the
    // configured test environment exposes no response stream at all -- so a
    // stream-reader implementation could not be exercised.
    const buffer = new Uint8Array(await response.arrayBuffer());
    return { status: response.status, bytes: buffer };
  } catch (error) {
    if (wasAborted(error, signal)) return { cancelled: true };
    return fetchFailure(
      "unreachable",
      `The shapefile transfer did not complete. ${FETCH_STAGE_CAUSES}`,
    );
  }
}

async function acquireArchive(url, signal, maxBytes) {
  const fetched = await fetchBytes(url, signal);
  if (fetched.cancelled || fetched.error) return fetched;
  if (fetched.status && fetched.status >= 400) {
    return fetchFailure(
      "unreachable",
      `The shapefile request returned ${fetched.status}. ${FETCH_STAGE_CAUSES}`,
      { status: fetched.status },
    );
  }
  return unzipShapefileComponents(fetched.bytes, { maxBytes });
}

async function acquireSiblings(url, signal, maxBytes) {
  const derived = deriveSiblingUrls(url);
  const budget = createByteBudget(maxBytes);
  const components = {};

  // Sequential rather than concurrent: the .shp is required, so there is no
  // point paying for the others before knowing it exists, and a shared budget is
  // simpler to reason about when only one request is in flight. Driven off the
  // component set so adding a component does not mean remembering to add it in
  // two places.
  for (const extension of COMPONENT_EXTENSIONS) {
    const fetched = await fetchBytes(derived[extension], signal);
    if (fetched.cancelled) return fetched;
    if (fetched.error) {
      // A missing optional component is not an error; a malformed one is.
      if (fetched.error.stage === "parse" && extension !== "shp") continue;
      return fetched;
    }

    if (fetched.status >= 400) {
      // The .shp is required; there is nothing to draw without it.
      if (extension === "shp") {
        return fetchFailure(
          "unreachable",
          `No shapefile was found at ${derived.shp}. ${FETCH_STAGE_CAUSES}`,
          { status: fetched.status },
        );
      }

      // For the components that do change how the layer draws, absence and
      // failure stay distinguishable: a transient 403 on a .prj routed into the
      // "no projection supplied" fallback would render features at the wrong
      // location with no error at all. Only a 404 is absence for those.
      if (
        fetched.status === 404 ||
        INCONSEQUENTIAL_COMPONENTS.includes(extension)
      ) {
        continue;
      }

      return {
        error: {
          stage: "fetch",
          reason: "component_status",
          component: extension,
          status: fetched.status,
          detail: `The .${extension} component returned ${fetched.status}. It is not being treated as absent, because that would silently change how the layer is drawn.`,
        },
      };
    }

    if (!budget.add(fetched.bytes.length)) {
      const mb = (bytes) => (bytes / (1024 * 1024)).toFixed(1);
      return {
        error: {
          stage: "fetch",
          reason: "too_large",
          observed: budget.observed,
          permitted: budget.permitted,
          detail: `The shapefile components total at least ${mb(
            budget.observed,
          )} MB, above the ${mb(budget.permitted)} MB permitted.`,
        },
      };
    }

    components[extension] = fetched.bytes;
  }

  return { components };
}

/**
 * Fetch a shapefile's component bytes, from either a zipped archive or an
 * unzipped set of siblings.
 *
 * Knows nothing about what a shapefile means -- it returns raw buffers, and
 * interpreting them is a separate step. That split is deliberate: the parser
 * choice carries real risk, and the byte accounting and cancellation contract
 * here survive a parser swap intact.
 *
 * @param {string} rawUrl The author-supplied URL, already interpolated.
 * @param {{signal?: AbortSignal, maxBytes?: number}} [options]
 * @returns {Promise<{components: Record<string, Uint8Array>, fromCache?: boolean}
 *   |{error: object}|{cancelled: true}>}
 */
export async function acquireComponents(
  rawUrl,
  { signal, maxBytes = DEFAULT_MAX_BYTES } = {},
) {
  const validated = validateSourceUrl(rawUrl);
  if (validated.error) return validated;

  const cached = getCachedComponents(validated.url);
  if (cached) return { components: cached, fromCache: true };

  if (signal?.aborted) return { cancelled: true };

  const result =
    validated.form === "archive"
      ? await acquireArchive(validated.url, signal, maxBytes)
      : await acquireSiblings(validated.url, signal, maxBytes);

  // A failed acquisition is never cached, so a retry actually retries.
  if (result.components) setCachedComponents(validated.url, result.components);
  return result;
}

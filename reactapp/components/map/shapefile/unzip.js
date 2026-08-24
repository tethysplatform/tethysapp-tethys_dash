import { Unzip, UnzipInflate } from "fflate";
import { COMPONENT_EXTENSIONS } from "components/map/shapefile/siblings";

/**
 * Running total against a ceiling, for bounding how much a source is allowed to
 * expand to.
 *
 * Separate from the unzip loop because the archives available to a test always
 * declare their member sizes, while a streamed archive declares none and takes
 * the byte-counting path instead. Keeping the arithmetic here makes both
 * testable.
 *
 * @param {number} maxBytes The ceiling, in bytes.
 */
export function createByteBudget(maxBytes) {
  return {
    observed: 0,
    exceeded: false,
    permitted: maxBytes,
    add(bytes) {
      this.observed += Number.isFinite(bytes) ? bytes : 0;
      if (this.observed > maxBytes) this.exceeded = true;
      return !this.exceeded;
    },
  };
}

function componentExtension(name) {
  const base = name.split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot === -1) return null;
  const extension = base.slice(dot + 1).toLowerCase();
  return COMPONENT_EXTENSIONS.includes(extension) ? extension : null;
}

function tooLarge(budget) {
  const mb = (bytes) => (bytes / (1024 * 1024)).toFixed(1);
  return {
    error: {
      stage: "fetch",
      reason: "too_large",
      observed: budget.observed,
      permitted: budget.permitted,
      detail: `The shapefile expands to at least ${mb(
        budget.observed,
      )} MB, above the ${mb(budget.permitted)} MB permitted.`,
    },
  };
}

/**
 * Extract the shapefile components from a zipped archive, bounded by how much
 * they are allowed to expand to.
 *
 * The ceiling is applied to each member's *declared* size, read from the local
 * header before any data flows, and refused by simply never starting that
 * member. Summing bytes as they arrive does not work: a 200 MB expansion can
 * arrive in a single callback, so a running total notices it only once the whole
 * payload is already allocated and inflated -- which is the cost the ceiling
 * exists to prevent. Members with no declared size fall back to counting.
 *
 * Only shapefile components are ever started, so a bomb parked in an unrelated
 * member costs nothing.
 *
 * @param {Uint8Array} buffer The archive bytes.
 * @param {{maxBytes: number}} options
 * @returns {{components: Record<string, Uint8Array>}|{error: object}}
 */
export function unzipShapefileComponents(buffer, { maxBytes }) {
  // Every zip starts "PK" -- 0x03 0x04 for a normal entry, 0x05 0x06 for an
  // empty archive, 0x07 0x08 for a spanned one. Checked up front because pushing
  // something else into Unzip does not fail: it simply finds no entries, and the
  // author would be told the archive has no .shp entry when the real answer is
  // that a portal returned an HTML error page with a 200.
  if (!(buffer?.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b)) {
    return {
      error: {
        stage: "parse",
        reason: "unreadable_archive",
        detail:
          "The source is not a zip archive. A portal returning an error page with a success status is the usual cause.",
      },
    };
  }

  const components = {};
  const shpMembers = [];
  const budget = createByteBudget(maxBytes);
  let failure = null;

  const unzip = new Unzip();
  // Without this, Unzip carries only a pass-through decoder and every member of
  // a deflate-compressed archive -- which is to say every real archive -- throws
  // on start.
  unzip.register(UnzipInflate);

  unzip.onfile = (file) => {
    const extension = componentExtension(file.name);
    if (!extension || failure) return;
    if (extension === "shp") shpMembers.push(file.name);

    const declared = file.originalSize;
    if (Number.isFinite(declared) && declared > 0) {
      if (!budget.add(declared)) {
        failure = tooLarge(budget);
        return;
      }
    }

    const chunks = [];
    const declaredKnown = Number.isFinite(declared) && declared > 0;
    file.ondata = (error, chunk, final) => {
      if (error) {
        failure = failure ?? {
          error: {
            stage: "parse",
            reason: "unreadable_component",
            detail: `The "${file.name}" entry could not be read: ${error.message}`,
          },
        };
        return;
      }
      // Counted only when the header declared nothing, so a declared member is
      // not charged twice.
      if (!declaredKnown) {
        if (!budget.add(chunk.length)) {
          failure = tooLarge(budget);
          file.terminate?.();
          return;
        }
      }
      chunks.push(chunk);
      if (final) {
        const total = chunks.reduce((sum, part) => sum + part.length, 0);
        const merged = new Uint8Array(total);
        chunks.reduce((offset, part) => {
          merged.set(part, offset);
          return offset + part.length;
        }, 0);
        components[extension] = merged;
      }
    };

    try {
      file.start();
    } catch (error) {
      failure = failure ?? {
        error: {
          stage: "parse",
          reason: "unreadable_component",
          detail: `The "${file.name}" entry could not be decompressed: ${error.message}`,
        },
      };
    }
  };

  try {
    unzip.push(buffer, true);
  } catch (error) {
    return {
      error: {
        stage: "parse",
        reason: "unreadable_archive",
        detail: `The source could not be read as a zip archive: ${error.message}`,
      },
    };
  }

  if (failure) return failure;

  if (shpMembers.length > 1) {
    return {
      error: {
        stage: "parse",
        reason: "ambiguous_archive",
        detail: `The archive contains more than one shapefile (${shpMembers.join(
          ", ",
        )}). Point the URL at a single shapefile instead.`,
      },
    };
  }

  if (!components.shp) {
    return {
      error: {
        stage: "parse",
        reason: "no_shapefile",
        detail: "The archive contains no .shp entry.",
      },
    };
  }

  return { components };
}

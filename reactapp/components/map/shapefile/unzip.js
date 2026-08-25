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
  // Directory entries carry no data, and a macOS-zipped archive ships an
  // AppleDouble twin beside every real file. "__MACOSX/._basins.shp" ends in
  // ".shp", so counting it makes a Finder-zipped shapefile -- the way most
  // people produce one by hand -- look like an archive holding two shapefiles.
  if (name.endsWith("/")) return null;
  const segments = name.split("/");
  const base = segments[segments.length - 1] ?? "";
  if (segments.includes("__MACOSX") || base.startsWith("._")) return null;
  const dot = base.lastIndexOf(".");
  if (dot === -1) return null;
  const extension = base.slice(dot + 1).toLowerCase();
  return COMPONENT_EXTENSIONS.includes(extension) ? extension : null;
}

// The directory and stem that a shapefile's parts share. Components are matched
// on this rather than on extension alone: an archive may hold unrelated parts,
// and keying only by extension lets whichever .dbf appears last in the archive
// silently become the attribute table for the geometry.
function memberIdentity(name) {
  const cut = name.lastIndexOf("/");
  const directory = cut === -1 ? "" : name.slice(0, cut);
  const base = cut === -1 ? name : name.slice(cut + 1);
  const dot = base.lastIndexOf(".");
  return { directory, stem: dot === -1 ? base : base.slice(0, dot) };
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
          "The source is not a zip archive. Either the host returned an error page with a success status, or the URL points at something else -- an unzipped shapefile has to be given as its .shp URL.",
      },
    };
  }

  const members = [];
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

    // The declared size refuses an oversized member before any of it is
    // inflated, which is the whole point of reading it. But it is a claim made
    // by the archive, not a fact: fflate's inflater ignores it, so a member that
    // under-declares would otherwise expand without limit. It is charged up
    // front as a fast path, then reconciled against the bytes that actually
    // arrive -- so a lying header buys nothing.
    const declared = file.originalSize;
    let charged = 0;
    if (Number.isFinite(declared) && declared > 0) {
      if (!budget.add(declared)) {
        failure = tooLarge(budget);
        return;
      }
      charged = declared;
    }

    const chunks = [];
    let received = 0;
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
      received += chunk.length;
      // Only the overshoot beyond what the header already paid for, so an
      // honest member is not charged twice.
      if (received > charged) {
        if (!budget.add(received - charged)) {
          failure = tooLarge(budget);
          file.terminate?.();
          return;
        }
        charged = received;
      }
      chunks.push(chunk);
      if (final) {
        const total = chunks.reduce((sum, part) => sum + part.length, 0);
        const merged = new Uint8Array(total);
        chunks.reduce((offset, part) => {
          merged.set(part, offset);
          return offset + part.length;
        }, 0);
        members.push({ name: file.name, extension, bytes: merged });
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

  const shpMember = members.find((member) => member.extension === "shp");
  if (!shpMember) {
    return {
      error: {
        stage: "parse",
        reason: "no_shapefile",
        detail: "The archive contains no .shp entry.",
      },
    };
  }

  // Only the parts belonging to this shapefile. A part with a different stem or
  // in a different directory is another dataset's, and attaching it would draw
  // the geometry with the wrong attributes rather than fail.
  const target = memberIdentity(shpMember.name);
  const components = members.reduce((selected, member) => {
    const identity = memberIdentity(member.name);
    if (
      identity.directory === target.directory &&
      identity.stem === target.stem
    ) {
      return { ...selected, [member.extension]: member.bytes };
    }
    return selected;
  }, {});

  return { components };
}

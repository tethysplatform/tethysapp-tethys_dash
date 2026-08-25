// How a .dbf's text is decoded and de-padded before the parser sees it.
//
// Two independent defects live here, both of which surface as unreadable
// attribute values rather than as errors, which is why they are handled at the
// bytes rather than left to the parser:
//
// 1. The parser strips padding with String.prototype.trim(), and NUL is not
//    whitespace in JavaScript. A .dbf that pads its character fields with NUL
//    rather than spaces -- Natural Earth's do -- yields values carrying their
//    padding, which renders as a run of tofu boxes. Worse, an empty field
//    becomes a truthy string of NULs instead of null, and a NUL-padded numeric
//    field fails `+value` and so reads as null with nothing reported.
// 2. The parser defaults to windows-1252. A UTF-8 .dbf decoded that way turns
//    every non-ASCII name into mojibake.

const DEFAULT_ENCODING = "windows-1252";

// A DBF records its own header length at offset 8, and records begin there.
// Everything before it is binary -- field lengths, decimal counts, flags -- and
// everything after it is text for every field type this parser reads. That
// split is what makes the record region safe to rewrite and safe to sniff, and
// why neither is done to the whole buffer.
const HEADER_LENGTH_OFFSET = 8;
const MIN_HEADER_LENGTH = 33;

const NUL = 0x00;
const SPACE = 0x20;

// What a .cpg contains varies by whatever wrote the shapefile: a codepage
// number, an ESRI name, or an IANA label. Only the forms that appear in practice
// are mapped -- anything else is offered to TextDecoder directly, so an unusual
// but valid label still works without being enumerated here.
const CODE_PAGE_ALIASES = {
  65001: "utf-8",
  UTF8: "utf-8",
  1252: "windows-1252",
  ANSI: "windows-1252",
  LATIN1: "iso-8859-1",
  8859: "iso-8859-1",
};

// A label is usable only if TextDecoder accepts it. Checked here rather than
// left to the parser, which builds its decoder inside the read and would surface
// a bad .cpg as an unreadable-geometry error naming the wrong component.
function usableLabel(label) {
  if (!label || typeof TextDecoder === "undefined") return null;
  try {
    new TextDecoder(label);
    return label;
  } catch {
    return null;
  }
}

/**
 * The encoding a .cpg names, or null when it names nothing usable.
 *
 * @param {Uint8Array} [cpgBytes]
 * @returns {string|null}
 */
export function encodingFromCodePage(cpgBytes) {
  if (!cpgBytes?.length) return null;

  // Only printable ASCII is kept. A .cpg is commonly written with a trailing
  // newline or NUL, and neither trim() nor TextDecoder would reject the result
  // -- it would just be an unusable label for a reason nothing could report.
  const raw = Array.from(cpgBytes)
    .filter((byte) => byte > SPACE && byte < 0x7f)
    .map((byte) => String.fromCharCode(byte))
    .join("");
  if (raw === "") return null;

  const upper = raw.toUpperCase();
  // Forms like "ANSI1252" carry the number alongside the name, so a trailing
  // bare number is tried as a codepage before the string as a whole.
  const digits = upper.match(/(\d{3,5})$/)?.[1];

  return (
    usableLabel(CODE_PAGE_ALIASES[upper]) ??
    usableLabel(digits ? CODE_PAGE_ALIASES[digits] : null) ??
    usableLabel(raw.toLowerCase()) ??
    null
  );
}

// Where the records start, or null when the header does not describe a .dbf this
// can reason about -- in which case the buffer is passed through untouched
// rather than rewritten on a guess.
function recordRegionOffset(bytes) {
  if (bytes.length <= HEADER_LENGTH_OFFSET + 1) return null;
  const headerLength =
    bytes[HEADER_LENGTH_OFFSET] | (bytes[HEADER_LENGTH_OFFSET + 1] << 8);
  if (headerLength < MIN_HEADER_LENGTH || headerLength >= bytes.length) {
    return null;
  }
  return headerLength;
}

/**
 * Whether the record region is UTF-8.
 *
 * UTF-8 is self-validating, so an invalid sequence is proof the bytes are not
 * UTF-8. The converse is weaker but strong enough: multi-byte UTF-8 sequences
 * arising by chance across a whole file of legacy text is vanishingly unlikely.
 * Pure ASCII is deliberately not evidence -- it decodes identically either way,
 * so it must not tip the decision.
 *
 * @param {Uint8Array} bytes
 * @param {number} from Offset of the record region.
 * @returns {boolean}
 */
export function looksLikeUtf8(bytes, from) {
  if (typeof TextDecoder === "undefined") return false;

  let sawNonAscii = false;
  for (let index = from; index < bytes.length; index += 1) {
    if (bytes[index] > 0x7f) {
      sawNonAscii = true;
      break;
    }
  }
  if (!sawNonAscii) return false;

  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(from));
    return true;
  } catch {
    return false;
  }
}

// NUL padding rewritten to spaces, which the parser's trim() does remove. Done
// to a copy rather than in place: these buffers are cached and handed back to
// callers as the bytes the host served, and quietly differing from that is a
// trap for anything reading them later.
function depadRecords(bytes, from) {
  let padded = false;
  for (let index = from; index < bytes.length; index += 1) {
    if (bytes[index] === NUL) {
      padded = true;
      break;
    }
  }
  if (!padded) return bytes;

  const copy = bytes.slice();
  for (let index = from; index < copy.length; index += 1) {
    if (copy[index] === NUL) copy[index] = SPACE;
  }
  return copy;
}

/**
 * The .dbf bytes and encoding to hand the parser.
 *
 * The .cpg wins when it names something usable, being the only explicit
 * statement of intent available. Otherwise the record region is sniffed for
 * UTF-8, and failing that the parser's own default stands -- so a file carrying
 * no encoding information decodes exactly as it did before any of this existed.
 *
 * The legacy language-driver byte in the header is deliberately not consulted:
 * its two common values both mean windows-1252, which is already the fallback,
 * and the rest name codepages TextDecoder cannot construct.
 *
 * @param {Uint8Array} [dbfBytes]
 * @param {Uint8Array} [cpgBytes]
 * @returns {{dbf: Uint8Array|null, encoding: string|null}}
 */
export function prepareAttributes(dbfBytes, cpgBytes) {
  if (!dbfBytes?.length) return { dbf: null, encoding: null };

  const recordsAt = recordRegionOffset(dbfBytes);
  const declared = encodingFromCodePage(cpgBytes);
  const sniffed =
    recordsAt !== null && looksLikeUtf8(dbfBytes, recordsAt) ? "utf-8" : null;

  return {
    dbf: recordsAt === null ? dbfBytes : depadRecords(dbfBytes, recordsAt),
    encoding: declared ?? sniffed ?? DEFAULT_ENCODING,
  };
}

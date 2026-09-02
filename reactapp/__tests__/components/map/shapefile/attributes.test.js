import {
  prepareAttributes,
  encodingFromCodePage,
  looksLikeUtf8,
} from "components/map/shapefile/attributes";
import { bytes } from "../../../utilities/bytes";

const NUL = 0x00;
const SPACE = 0x20;

// A .dbf-shaped buffer: a header of the declared length followed by record
// bytes. Only the length at offset 8 matters to the code under test, so the rest
// of the header is filled with a byte that would be rewritten if the record
// boundary were ignored.
function dbfLike(recordBytes, { headerLength = 33 } = {}) {
  const buffer = new Uint8Array(headerLength + recordBytes.length);
  buffer.fill(NUL);
  buffer[8] = headerLength & 0xff;
  buffer[9] = (headerLength >> 8) & 0xff;
  buffer.set(recordBytes, headerLength);
  return buffer;
}

function ascii(text) {
  return Array.from(text).map((character) => character.charCodeAt(0));
}

describe("encodingFromCodePage", () => {
  it("reads the label a .cpg declares", () => {
    expect(encodingFromCodePage(bytes("UTF-8"))).toBe("utf-8");
  });

  it("accepts a numeric code page", () => {
    expect(encodingFromCodePage(bytes("65001"))).toBe("utf-8");
    expect(encodingFromCodePage(bytes("1252"))).toBe("windows-1252");
  });

  it("ignores the trailing newline a .cpg is usually written with", () => {
    // Neither trim() nor TextDecoder would reject the result -- it would just be
    // an unusable label, and the encoding would silently fall back.
    expect(
      encodingFromCodePage(new Uint8Array([...ascii("UTF-8"), 0x0a])),
    ).toBe("utf-8");
  });

  it("ignores trailing NUL padding in a .cpg", () => {
    expect(encodingFromCodePage(new Uint8Array([...ascii("UTF-8"), NUL]))).toBe(
      "utf-8",
    );
  });

  it("maps an ESRI spelling onto the label TextDecoder knows", () => {
    expect(encodingFromCodePage(bytes("ANSI"))).toBe("windows-1252");
    expect(encodingFromCodePage(bytes("LATIN1"))).toBe("iso-8859-1");
  });

  it("passes through a valid label it does not enumerate", () => {
    expect(encodingFromCodePage(bytes("ISO-8859-7"))).toBe("iso-8859-7");
  });

  it("returns null for a label TextDecoder cannot construct", () => {
    // Reported as "no declared encoding" rather than handed to the parser, which
    // builds its decoder inside the read and would blame the geometry.
    expect(encodingFromCodePage(bytes("NOT-AN-ENCODING"))).toBeNull();
  });

  it("returns null for an absent or empty .cpg", () => {
    expect(encodingFromCodePage(undefined)).toBeNull();
    expect(encodingFromCodePage(new Uint8Array())).toBeNull();
  });
});

describe("looksLikeUtf8", () => {
  it("does not treat pure ASCII as evidence either way", () => {
    // ASCII decodes identically under both candidates, so calling it UTF-8 would
    // be an unfounded claim that happens to be harmless -- and the next reader
    // would trust it for a file where it is not.
    expect(looksLikeUtf8(new Uint8Array(ascii("Minnesota")), 0)).toBe(false);
  });

  it("recognises multi-byte UTF-8", () => {
    const utf8 = new Uint8Array([0xe6, 0x98, 0x8e, 0xe5, 0xb0, 0xbc]);
    expect(looksLikeUtf8(utf8, 0)).toBe(true);
  });

  it("rejects bytes that are not valid UTF-8", () => {
    // 0xF1 in isolation is a windows-1252 "ñ" and an invalid UTF-8 lead byte,
    // which is what makes UTF-8's self-validation usable as a test.
    expect(looksLikeUtf8(new Uint8Array([0x4d, 0x69, 0xf1, 0x6f]), 0)).toBe(
      false,
    );
  });

  it("looks only past the offset it is given", () => {
    // The header is binary, so bytes before the record region are not text and
    // would fail the check for reasons that say nothing about the attributes.
    const buffer = new Uint8Array([0xff, 0xfe, 0xe6, 0x98, 0x8e]);
    expect(looksLikeUtf8(buffer, 0)).toBe(false);
    expect(looksLikeUtf8(buffer, 2)).toBe(true);
  });
});

describe("prepareAttributes", () => {
  it("rewrites NUL padding in the record region as spaces", () => {
    // The parser strips padding with trim(), and NUL is not whitespace in
    // JavaScript, so without this the padding arrives as part of the value.
    const dbf = dbfLike(new Uint8Array([...ascii("Basin"), NUL, NUL, NUL]));
    const prepared = prepareAttributes(dbf);

    expect(Array.from(prepared.dbf.slice(33))).toEqual([
      ...ascii("Basin"),
      SPACE,
      SPACE,
      SPACE,
    ]);
  });

  it("leaves the binary header untouched", () => {
    // Field lengths, decimal counts and flags are binary, and a NUL there is a
    // value rather than padding.
    const dbf = dbfLike(new Uint8Array([...ascii("Basin"), NUL]));
    const prepared = prepareAttributes(dbf);

    const header = Array.from(prepared.dbf.slice(0, 33));
    expect(header.filter((byte) => byte === SPACE)).toHaveLength(0);
    expect(header[8]).toBe(33);
  });

  it("does not mutate the buffer it was given", () => {
    // These buffers are cached and handed back to callers as the bytes the host
    // served; quietly differing from that is a trap for anything reading them
    // later.
    const dbf = dbfLike(new Uint8Array([...ascii("Basin"), NUL]));
    const before = Array.from(dbf);

    prepareAttributes(dbf);

    expect(Array.from(dbf)).toEqual(before);
  });

  it("returns the same buffer when there is no padding to rewrite", () => {
    const dbf = dbfLike(new Uint8Array(ascii("Basin")));
    expect(prepareAttributes(dbf).dbf).toBe(dbf);
  });

  it("prefers the encoding the .cpg declares over what the bytes look like", () => {
    // The .cpg is the only explicit statement of intent available. These bytes
    // are valid UTF-8, so the sniffer would say utf-8 -- the declaration wins.
    const dbf = dbfLike(new Uint8Array([0xe6, 0x98, 0x8e]));
    expect(prepareAttributes(dbf, bytes("ISO-8859-1")).encoding).toBe(
      "iso-8859-1",
    );
  });

  it("sniffs UTF-8 when no .cpg says otherwise", () => {
    const dbf = dbfLike(new Uint8Array([0xe6, 0x98, 0x8e]));
    expect(prepareAttributes(dbf).encoding).toBe("utf-8");
  });

  it("sniffs UTF-8 when the .cpg declares something unusable", () => {
    const dbf = dbfLike(new Uint8Array([0xe6, 0x98, 0x8e]));
    expect(prepareAttributes(dbf, bytes("NOT-AN-ENCODING")).encoding).toBe(
      "utf-8",
    );
  });

  it("falls back to the parser's own default when nothing indicates otherwise", () => {
    // A file carrying no encoding information decodes exactly as it did before
    // any of this existed.
    const dbf = dbfLike(new Uint8Array([0x4d, 0x69, 0xf1, 0x6f]));
    expect(prepareAttributes(dbf).encoding).toBe("windows-1252");
  });

  it("passes a header it cannot make sense of through untouched", () => {
    // Rewriting on a guess would corrupt whatever this actually is; the parser
    // gets to report it instead.
    const nonsense = new Uint8Array(40);
    nonsense[8] = 0xff;
    nonsense[9] = 0xff;
    const prepared = prepareAttributes(nonsense);

    expect(prepared.dbf).toBe(nonsense);
    expect(prepared.encoding).toBe("windows-1252");
  });

  it("reports nothing to read for an absent .dbf", () => {
    expect(prepareAttributes(undefined)).toEqual({ dbf: null, encoding: null });
    expect(prepareAttributes(new Uint8Array())).toEqual({
      dbf: null,
      encoding: null,
    });
  });
});

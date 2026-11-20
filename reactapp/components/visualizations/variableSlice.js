// Bash-style substring slicing for `${...}` template tokens.
//
//   ${var:0:4}   first four characters
//   ${var:4}     everything from the fifth character on
//   ${var: -3}   the last three characters
//   ${var:2:-2}  from the third character to two before the end
//
// The offset and the optional length are integers. A negative offset counts
// from the end and, as in bash, must be preceded by whitespace: `${var:-3}` is
// bash's default-value syntax, not a slice, so it is left alone here (it reads
// as a reference to a name `var:-3`). A negative length is an end position
// counted from the end of the value.
//
// Names may themselves contain colons, so a token that is a name in its own
// right always wins over reading its tail as a slice.
const SLICE_RE = /^(.+?):(\s+-?\d+|\d+)(?::(\s*-?\d+))?$/;

/**
 * Split the inside of a `${...}` token into the name it references and the
 * slice to apply to that name's value.
 *
 * @param {string} token the text between `${` and `}`
 * @param {(name: string) => boolean} [isName] whether a string is a name the
 *   caller can resolve; a token for which it returns true is never sliced
 * @returns {{name: string, slice: ({offset: number, length?: number}|null)}}
 */
export function parseVariableToken(token, isName = () => false) {
  if (isName(token)) return { name: token, slice: null };
  const match = SLICE_RE.exec(token);
  if (!match) return { name: token, slice: null };
  const slice = { offset: parseInt(match[2], 10) };
  if (match[3] !== undefined) slice.length = parseInt(match[3], 10);
  return { name: match[1], slice };
}

/**
 * Apply a slice to a string with bash's `${var:offset:length}` semantics.
 * Characters are counted as code points, so an emoji or other astral
 * character is never split in half. Where bash would report an error (a
 * negative length reaching back before the offset) the result is empty.
 *
 * @param {string} text
 * @param {{offset: number, length?: number}|null} slice
 * @returns {string}
 */
export function applySlice(text, slice) {
  if (!slice) return text;
  const chars = Array.from(text);
  const n = chars.length;
  const start = slice.offset < 0 ? n + slice.offset : slice.offset;
  if (start < 0 || start > n) return "";
  let end;
  if (slice.length === undefined) {
    end = n;
  } else if (slice.length < 0) {
    end = n + slice.length;
  } else {
    end = Math.min(start + slice.length, n);
  }
  if (end <= start) return "";
  return chars.slice(start, end).join("");
}

/**
 * The text a value substitutes as: objects and arrays as JSON, null and
 * undefined as the empty string, anything else through `String`.
 */
export function valueAsText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

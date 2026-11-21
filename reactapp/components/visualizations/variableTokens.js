// Transforms written inside a `${...}` template token, after (or around) the
// name it references. Everything that reads a token's name or computes its
// value goes through this module, so adding a transform is one entry in
// `TRANSFORMS` below plus its docs and tests -- no call site changes.
//
// Today's only transform is bash's substring slice:
//
//   ${var:0:4}   first four characters
//   ${var:4}     everything from the fifth character on
//   ${var: -3}   the last three characters
//   ${var:2:-2}  from the third character to two before the end
//
// Syntax follows bash where bash has a form for the job, so `${var:-x}` stays
// free for bash's default-value form: a negative slice offset must be preceded
// by whitespace, and `${var:-3}` reads as a reference to a name `var:-3`.
//
// How a token is read, in order:
//   1. A token that is a known name in its own right is that name, untouched.
//      Names may hold almost any character (spaces, dots, colons, slashes), so
//      this is what keeps a name like `Ratio:4` from reading as a slice.
//   2. Otherwise each entry of `TRANSFORMS`, in order, is matched with both
//      the shortest and the longest name its text allows. The first of those
//      readings whose name is a known name wins (so with an input `Ratio:4`,
//      `${Ratio:4:0}` is `Ratio:4` from 0, not `Ratio` sliced `:4:0`);
//      failing that, the first reading wins.
//   3. Otherwise the whole token is the name, untouched.
// Only one transform applies per token, as in bash.
//
// Callers find tokens with `\$\{([^}]+)\}` and decide what a token refers to
// by its parsed `name` -- `feature.*` included -- never by the raw token's
// first characters, so a transform written before the name (bash's `${#var}`)
// works everywhere a suffix one does. A transform's text cannot contain `}`.

/**
 * The transforms, tried in order. Each entry has:
 *
 * - `kind`: its name, carried on the parsed token as `transform.kind`.
 * - `before` / `after`: regular-expression source for the transform's text
 *   before and after the name, either of which may be empty (the slice is all
 *   `after`; bash's `${#var}` would be all `before`). They may hold named
 *   groups for `params`. The module builds the whole-token pattern around
 *   them, so every match has the `pre`, `name` and `post` groups a rename
 *   needs.
 * - `params(groups)`: the transform's parameters, from the match groups.
 * - `apply(value, params)`: the token's result. `value` is the referenced
 *   value as substitution has it: raw (a number, an object, null...) in
 *   visualization args and settings, but already formatted as text for a
 *   `${feature.*}` in a popup title or map label. Text is the safe result:
 *   an exactly-templated string arg keeps any other type (a split could give
 *   an array there), but a date-typed arg parses the result as a date, and a
 *   token inside an object arg is inserted as text into its JSON.
 */
const TRANSFORMS = [
  {
    kind: "slice",
    before: "",
    after: String.raw`:(?<offset>\s+-?\d+|\d+)(?::(?<length>\s*-?\d+))?`,
    params: ({ offset, length }) =>
      length === undefined
        ? { offset: parseInt(offset, 10) }
        : { offset: parseInt(offset, 10), length: parseInt(length, 10) },
    apply: (value, params) => applySlice(valueAsText(value), params),
  },
];

const TRANSFORMS_BY_KIND = new Map(TRANSFORMS.map((t) => [t.kind, t]));

// Each transform as two whole-token patterns, differing only in whether the
// name is read as short or as long as the transform's text allows.
const TRANSFORM_PATTERNS = TRANSFORMS.flatMap((entry) =>
  [".+?", ".+"].map((namePattern) => ({
    entry,
    pattern: new RegExp(
      `^(?<pre>${entry.before})(?<name>${namePattern})(?<post>${entry.after})$`,
    ),
  })),
);

/**
 * Split the inside of a `${...}` token into the name it references and the
 * transform to apply to that name's value.
 *
 * `prefix + name + suffix` always rebuilds the token, so a caller replacing
 * the name (a rename) keeps the transform exactly as written.
 *
 * @param {string} token the text between `${` and `}`
 * @param {(name: string) => boolean} [isName] whether a string is a name the
 *   caller can resolve; a token for which it returns true is never transformed
 * @returns {{name: string, prefix: string, suffix: string,
 *   transform: ({kind: string}|null)}}
 */
export function parseVariableToken(token, isName = () => false) {
  const untransformed = {
    name: token,
    prefix: "",
    suffix: "",
    transform: null,
  };
  if (isName(token)) return untransformed;
  const readings = [];
  for (const { entry, pattern } of TRANSFORM_PATTERNS) {
    const match = pattern.exec(token);
    if (match) readings.push({ entry, groups: match.groups });
  }
  if (readings.length === 0) return untransformed;
  const { entry, groups } =
    readings.find((reading) => isName(reading.groups.name)) ?? readings[0];
  return {
    name: groups.name,
    prefix: groups.pre,
    suffix: groups.post,
    transform: { kind: entry.kind, ...entry.params(groups) },
  };
}

/**
 * The value a token produces: the referenced value itself when the token has
 * no transform, otherwise the transform's result.
 *
 * @param {*} value the referenced name's value, raw
 * @param {{kind: string}|null} transform from `parseVariableToken`
 */
export function applyTransform(value, transform) {
  if (!transform) return value;
  const { kind, ...params } = transform;
  return TRANSFORMS_BY_KIND.get(kind).apply(value, params);
}

/**
 * Apply a slice to a string with bash's `${var:offset:length}` semantics.
 * Characters are counted as code points, so an emoji or other astral
 * character is never split in half. Where bash would report an error (a
 * negative length reaching back before the offset) the result is empty.
 *
 * @param {string} text
 * @param {{offset: number, length?: number}} slice
 * @returns {string}
 */
export function applySlice(text, slice) {
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

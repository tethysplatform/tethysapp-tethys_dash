/* eslint-disable no-template-curly-in-string */
// Test names quote the literal `${var:...}` syntax under test.
import {
  applySlice,
  applyTransform,
  parseVariableToken,
  valueAsText,
} from "components/visualizations/variableTokens";

// Resolve a token against one value the way the substitution does.
const resolve = (token, value, names = ["var"]) => {
  const { name, transform } = parseVariableToken(token, (candidate) =>
    names.includes(candidate),
  );
  expect(name).toBe("var");
  return applyTransform(value, transform);
};

// The parse of a slice token, which carries its text after the name.
const sliced = (name, suffix, offset, length) => ({
  name,
  prefix: "",
  suffix,
  transform:
    length === undefined
      ? { kind: "slice", offset }
      : { kind: "slice", offset, length },
});

const untransformed = (name) => ({
  name,
  prefix: "",
  suffix: "",
  transform: null,
});

describe("bash examples from the task", () => {
  test.each([
    ["var:0:4", "fore"],
    ["var:4", "casting"],
    ["var: -3", "ing"],
    ["var:2:-2", "recasti"],
  ])("${%s} of forecasting is %s", (token, expected) => {
    expect(resolve(token, "forecasting")).toBe(expected);
  });
});

describe("parseVariableToken", () => {
  test("a plain name has no transform", () => {
    expect(parseVariableToken("Site")).toEqual(untransformed("Site"));
  });

  test("names keep their spaces and dots", () => {
    expect(parseVariableToken("Start Time:0:10")).toEqual(
      sliced("Start Time", ":0:10", 0, 10),
    );
    expect(parseVariableToken("feature.station id: -2")).toEqual(
      sliced("feature.station id", ": -2", -2),
    );
  });

  test("whitespace is allowed before a positive offset and before a length", () => {
    expect(parseVariableToken("var: 2: 3")).toEqual(
      sliced("var", ": 2: 3", 2, 3),
    );
    expect(parseVariableToken("var:1: -2")).toEqual(
      sliced("var", ":1: -2", 1, -2),
    );
  });

  test("`:-N` without a space is bash's default-value syntax, not a slice", () => {
    expect(parseVariableToken("var:-3")).toEqual(untransformed("var:-3"));
  });

  test("anything that is not an integer slice is part of the name", () => {
    for (const token of ["Time:abc", "Time:", "Time:1.5", ":3"]) {
      expect(parseVariableToken(token)).toEqual(untransformed(token));
    }
  });

  test("names may contain colons, so only the trailing slice is read", () => {
    expect(parseVariableToken("Time::2")).toEqual(sliced("Time:", ":2", 2));
    expect(parseVariableToken("Time:1:2:3")).toEqual(
      sliced("Time:1", ":2:3", 2, 3),
    );
  });

  test("a token that is a name in its own right is never transformed", () => {
    const isName = (candidate) => candidate === "Ratio:4";
    expect(parseVariableToken("Ratio:4", isName)).toEqual(
      untransformed("Ratio:4"),
    );
    // ...while a slice of that name still parses.
    expect(parseVariableToken("Ratio:4:0:1", isName)).toEqual(
      sliced("Ratio:4", ":0:1", 0, 1),
    );
  });

  test("a reading that names a known variable wins over a shorter name", () => {
    // Read shortest-first, `Ratio:4:0` would be `Ratio` sliced `:4:0`.
    expect(parseVariableToken("Ratio:4:0")).toEqual(
      sliced("Ratio", ":4:0", 4, 0),
    );
    // With an input named `Ratio:4`, it is that input from 0.
    expect(
      parseVariableToken("Ratio:4:0", (candidate) => candidate === "Ratio:4"),
    ).toEqual(sliced("Ratio:4", ":0", 0));
  });

  test.each(["Site", "Site:0:3", "Site: -2", "Start Time:1:-1", "a:b:1:2"])(
    "prefix + name + suffix rebuilds %p exactly",
    (token) => {
      const { prefix, name, suffix } = parseVariableToken(token);
      expect(prefix + name + suffix).toBe(token);
    },
  );
});

describe("applyTransform", () => {
  test("no transform returns the value itself, type and all", () => {
    expect(applyTransform(2026, null)).toBe(2026);
    expect(applyTransform(false, null)).toBe(false);
    const object = { a: 1 };
    expect(applyTransform(object, null)).toBe(object);
    expect(applyTransform(undefined, null)).toBeUndefined();
  });

  test("a slice works on the value's text", () => {
    const transform = { kind: "slice", offset: 0, length: 2 };
    expect(applyTransform(2026, transform)).toBe("20");
    expect(applyTransform({ a: 1 }, transform)).toBe('{"');
    expect(applyTransform(null, transform)).toBe("");
  });
});

describe("applySlice", () => {
  test.each([
    // [offset, length, expected] against "forecasting" (11 characters)
    [0, undefined, "forecasting"],
    [11, undefined, ""],
    [12, undefined, ""],
    [-11, undefined, "forecasting"],
    [-12, undefined, ""],
    [0, 0, ""],
    [8, 10, "ing"],
    [0, -11, ""],
    [5, -8, ""],
    [-4, -1, "tin"],
  ])("offset %p length %p gives %p", (offset, length, expected) => {
    const parsed = length === undefined ? { offset } : { offset, length };
    expect(applySlice("forecasting", parsed)).toBe(expected);
  });

  test("counts characters, never splitting a surrogate pair", () => {
    expect(applySlice("a😀b", { offset: 1, length: 1 })).toBe("😀");
    expect(applySlice("a😀b", { offset: -1 })).toBe("b");
  });
});

describe("valueAsText", () => {
  test.each([
    [null, ""],
    [undefined, ""],
    [0, "0"],
    [false, "false"],
    ["x", "x"],
    [{ a: 1 }, '{"a":1}'],
    [[1, 2], "[1,2]"],
  ])("%p reads as %p", (value, expected) => {
    expect(valueAsText(value)).toBe(expected);
  });
});

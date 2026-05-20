/* eslint-disable no-template-curly-in-string */
// This file tests literal `${feature.<key>}` template syntax handling.
import { substituteTemplateString } from "components/modals/PopupModal/substituteTemplateString";

describe("substituteTemplateString", () => {
  test("empty/null/undefined template returns empty string", () => {
    expect(substituteTemplateString("", {})).toBe("");
    expect(substituteTemplateString(null, {})).toBe("");
    expect(substituteTemplateString(undefined, {})).toBe("");
  });

  test("non-template string passes through unchanged", () => {
    expect(substituteTemplateString("hello world", { hello: "x" })).toBe(
      "hello world",
    );
  });

  test("substitutes a single ${feature.key} token", () => {
    expect(
      substituteTemplateString("Site: ${feature.station_name}", {
        station_name: "Boulder Creek",
      }),
    ).toBe("Site: Boulder Creek");
  });

  test("substitutes multiple distinct keys", () => {
    expect(
      substituteTemplateString(
        "${feature.station_name} (${feature.state_id})",
        { station_name: "Boulder Creek", state_id: "CO" },
      ),
    ).toBe("Boulder Creek (CO)");
  });

  test("substitutes the same key multiple times", () => {
    expect(
      substituteTemplateString("${feature.id}-${feature.id}", { id: "ABC" }),
    ).toBe("ABC-ABC");
  });

  test("missing key resolves to empty string (not literal 'null' or 'undefined')", () => {
    expect(substituteTemplateString("Site: ${feature.unknown}", {})).toBe(
      "Site: ",
    );
    expect(
      substituteTemplateString("a${feature.x}b", { other: "y" }),
    ).toBe("ab");
  });

  test("null/undefined attribute value resolves to empty string", () => {
    expect(
      substituteTemplateString("${feature.x}/${feature.y}", {
        x: null,
        y: undefined,
      }),
    ).toBe("/");
  });

  test("numeric and boolean values are stringified", () => {
    expect(
      substituteTemplateString("count=${feature.n}, active=${feature.flag}", {
        n: 42,
        flag: true,
      }),
    ).toBe("count=42, active=true");
  });

  test("missing/null attributes object falls back to empty replacements", () => {
    expect(substituteTemplateString("${feature.x}", null)).toBe("");
    expect(substituteTemplateString("${feature.x}", undefined)).toBe("");
  });

  test("keys with dots, spaces, and parens are preserved", () => {
    expect(
      substituteTemplateString("${feature.Mean Flow (m³/sec)}", {
        "Mean Flow (m³/sec)": 12.5,
      }),
    ).toBe("12.5");
  });

  test("non-feature template tokens are NOT substituted", () => {
    // The variable-input pipeline owns generic ${name} substitution
    // elsewhere; this helper is scoped to the feature.* namespace and must
    // leave other tokens alone.
    expect(
      substituteTemplateString("${other} ${feature.x}", { x: "Y" }),
    ).toBe("${other} Y");
  });
});

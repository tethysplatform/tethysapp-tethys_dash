import {
  STOPWORDS,
  filterDashboards,
  matchesDashboardSearch,
  normalizeForSearch,
  significantTokens,
} from "components/landingPage/dashboardSearch";

const dashboard = (name, description) => ({ name, description });

describe("normalizeForSearch", () => {
  test("casefolds", () => {
    expect(normalizeForSearch("Guatemala")).toBe("guatemala");
  });

  test("strips accents so an unaccented query still matches", () => {
    expect(normalizeForSearch("Clasificación")).toBe("clasificacion");
    expect(normalizeForSearch("Peligro Sevéro")).toBe("peligro severo");
  });

  test("non-strings normalize to an empty string", () => {
    // description is nullable on a dashboard record.
    expect(normalizeForSearch(undefined)).toBe("");
    expect(normalizeForSearch(null)).toBe("");
    expect(normalizeForSearch(42)).toBe("");
  });
});

describe("significantTokens", () => {
  test("drops stopwords and keeps the rest", () => {
    expect(significantTokens("the flood and the depth")).toEqual([
      "flood",
      "depth",
    ]);
  });

  test("a query of only stopwords yields no tokens", () => {
    expect(significantTokens("the and a an of")).toEqual([]);
  });

  test("splits on punctuation, not just spaces", () => {
    expect(significantTokens("Exercise #2 / flood-depth")).toEqual([
      "exercise",
      "2",
      "flood",
      "depth",
    ]);
  });

  test("digits survive as tokens", () => {
    expect(significantTokens("hands on 1")).toEqual(["hands", "1"]);
  });

  test("empty and whitespace queries yield no tokens", () => {
    expect(significantTokens("")).toEqual([]);
    expect(significantTokens("   ")).toEqual([]);
  });

  test("the list covers the words called out as insignificant", () => {
    for (const word of ["the", "and", "a", "an"]) {
      expect(STOPWORDS.has(word)).toBe(true);
    }
  });
});

describe("matchesDashboardSearch", () => {
  const guatemala = dashboard(
    "Guatemala Hands On 1",
    "Solution for WMO Guatemala Hands On Exercise #1",
  );

  test("an empty or whitespace query matches everything", () => {
    expect(matchesDashboardSearch(guatemala, "")).toBe(true);
    expect(matchesDashboardSearch(guatemala, "   ")).toBe(true);
  });

  test("matches a partial name, case-insensitively", () => {
    expect(matchesDashboardSearch(guatemala, "guat")).toBe(true);
    expect(matchesDashboardSearch(guatemala, "GUATEMALA hands")).toBe(true);
  });

  test("matches on description words the name does not contain", () => {
    expect(matchesDashboardSearch(guatemala, "WMO")).toBe(true);
    expect(matchesDashboardSearch(guatemala, "exercise")).toBe(true);
  });

  test("ignores stopwords in the query when matching a description", () => {
    // "for" appears in the description, but the match must not depend on it.
    expect(matchesDashboardSearch(guatemala, "the solution")).toBe(true);
    expect(matchesDashboardSearch(guatemala, "a wmo exercise")).toBe(true);
  });

  test("requires every significant token, not just one", () => {
    expect(matchesDashboardSearch(guatemala, "solution exercise")).toBe(true);
    expect(matchesDashboardSearch(guatemala, "solution volcano")).toBe(false);
  });

  test("tokens match inside longer words", () => {
    const flood = dashboard("Basin", "Shows flooding across the basin");
    expect(matchesDashboardSearch(flood, "flood")).toBe(true);
  });

  test("a stopword-only query does not match via the description", () => {
    // The whole point: "the" appears in this description, but matching on it
    // would surface every dashboard in the app.
    const withThe = dashboard("Basin", "Shows the depth of the basin");
    expect(matchesDashboardSearch(withThe, "the")).toBe(false);
    expect(matchesDashboardSearch(withThe, "and the")).toBe(false);
  });

  test("a stopword-only query still matches a name containing it", () => {
    // Stopwords are not stripped from the name path, so a dashboard actually
    // called "The Basin" stays findable by typing "the".
    const theBasin = dashboard("The Basin", "Depth across a basin");
    expect(matchesDashboardSearch(theBasin, "the")).toBe(true);
  });

  test("accents in the record do not need accents in the query", () => {
    const hazard = dashboard(
      "Peligro",
      "Clasificación de peligro por inundación",
    );
    expect(matchesDashboardSearch(hazard, "clasificacion")).toBe(true);
    expect(matchesDashboardSearch(hazard, "inundacion")).toBe(true);
  });

  test("a missing description does not throw and does not match", () => {
    const bare = dashboard("Basin", undefined);
    expect(matchesDashboardSearch(bare, "basin")).toBe(true);
    expect(matchesDashboardSearch(bare, "depth")).toBe(false);
  });

  test("a name is matched as a whole substring, spaces included", () => {
    // "hands on" is contiguous in the name; "on hands" is not, and has no
    // description support either.
    expect(matchesDashboardSearch(guatemala, "hands on 1")).toBe(true);
    const reordered = dashboard("Hands On", "unrelated text");
    expect(matchesDashboardSearch(reordered, "on hands")).toBe(false);
  });
});

describe("filterDashboards", () => {
  const dashboards = [
    dashboard("Guatemala Hands On 1", "Solution for WMO Exercise #1"),
    dashboard("Guatemala Hands On 2", "Solution for WMO Exercise #2"),
    dashboard("Willamette", "Reservoir forecasts for the Willamette basin"),
  ];

  test("preserves the original order", () => {
    const result = filterDashboards(dashboards, "guatemala");
    expect(result.map((d) => d.name)).toEqual([
      "Guatemala Hands On 1",
      "Guatemala Hands On 2",
    ]);
  });

  test("an empty query returns every dashboard", () => {
    expect(filterDashboards(dashboards, "")).toHaveLength(3);
  });

  test("narrows to one on a description word", () => {
    expect(filterDashboards(dashboards, "reservoir")).toHaveLength(1);
  });

  test("a stopword-only query matches nothing here", () => {
    // "the" appears in the Willamette description but in no name.
    expect(filterDashboards(dashboards, "the")).toHaveLength(0);
  });

  test("returns an empty array for a missing list", () => {
    expect(filterDashboards(undefined, "x")).toEqual([]);
    expect(filterDashboards(null, "x")).toEqual([]);
  });
});

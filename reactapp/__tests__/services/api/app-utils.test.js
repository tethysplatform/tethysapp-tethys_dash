import { server } from "__tests__/utilities/server";
import { rest } from "msw";
import appAPI from "services/api/app";

describe("replaceHtmlEntitiesInExpressions utility function", () => {
  // Since replaceHtmlEntitiesInExpressions is not exported, we test it indirectly through downloadJSON

  test("handles string replacement correctly", async () => {
    server.use(
      rest.get(
        "http://api.test/apps/tethysdash/json/download/",
        (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              success: true,
              data: "&gt;",
            }),
            ctx.set("Content-Type", "application/json")
          );
        }
      )
    );

    const response = await appAPI.downloadJSON({ filename: "test.json" });
    expect(response.data).toBe(">");
  });

  test("handles string that doesn't match any replacement", async () => {
    server.use(
      rest.get(
        "http://api.test/apps/tethysdash/json/download/",
        (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              success: true,
              data: "normalString",
            }),
            ctx.set("Content-Type", "application/json")
          );
        }
      )
    );

    const response = await appAPI.downloadJSON({ filename: "test.json" });
    expect(response.data).toBe("normalString");
  });

  test("handles arrays correctly", async () => {
    server.use(
      rest.get(
        "http://api.test/apps/tethysdash/json/download/",
        (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              success: true,
              data: ["&gt;", "&lt;", "normal", "&eq;"],
            }),
            ctx.set("Content-Type", "application/json")
          );
        }
      )
    );

    const response = await appAPI.downloadJSON({ filename: "test.json" });
    expect(response.data).toEqual([">", "<", "normal", "=="]);
  });

  test("handles nested arrays correctly", async () => {
    server.use(
      rest.get(
        "http://api.test/apps/tethysdash/json/download/",
        (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              success: true,
              data: [
                ["&gt;", "&lt;"],
                ["&ne;", "normal"],
              ],
            }),
            ctx.set("Content-Type", "application/json")
          );
        }
      )
    );

    const response = await appAPI.downloadJSON({ filename: "test.json" });
    expect(response.data).toEqual([
      [">", "<"],
      ["!=", "normal"],
    ]);
  });

  test("handles null values correctly", async () => {
    server.use(
      rest.get(
        "http://api.test/apps/tethysdash/json/download/",
        (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              success: true,
              data: null,
            }),
            ctx.set("Content-Type", "application/json")
          );
        }
      )
    );

    const response = await appAPI.downloadJSON({ filename: "test.json" });
    expect(response.data).toBe(null);
  });

  test("handles nested objects correctly", async () => {
    server.use(
      rest.get(
        "http://api.test/apps/tethysdash/json/download/",
        (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              success: true,
              data: {
                level1: {
                  level2: {
                    value: "&gt;=",
                    array: ["&lt;", "&amp;"],
                  },
                  simple: "&eq;",
                },
                topLevel: "&ne;",
              },
            }),
            ctx.set("Content-Type", "application/json")
          );
        }
      )
    );

    const response = await appAPI.downloadJSON({ filename: "test.json" });
    expect(response.data).toEqual({
      level1: {
        level2: {
          value: ">=",
          array: ["<", "&"],
        },
        simple: "==",
      },
      topLevel: "!=",
    });
  });

  test("handles numbers and booleans correctly", async () => {
    server.use(
      rest.get(
        "http://api.test/apps/tethysdash/json/download/",
        (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              success: true,
              data: {
                number: 42,
                boolean: true,
                zero: 0,
                false_val: false,
                text: "&gt;",
              },
            }),
            ctx.set("Content-Type", "application/json")
          );
        }
      )
    );

    const response = await appAPI.downloadJSON({ filename: "test.json" });
    expect(response.data).toEqual({
      number: 42,
      boolean: true,
      zero: 0,
      false_val: false,
      text: ">",
    });
  });

  test("handles empty objects and arrays", async () => {
    server.use(
      rest.get(
        "http://api.test/apps/tethysdash/json/download/",
        (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              success: true,
              data: {
                emptyObject: {},
                emptyArray: [],
                mixedEmpty: {
                  nested: {
                    empty: [],
                  },
                },
              },
            }),
            ctx.set("Content-Type", "application/json")
          );
        }
      )
    );

    const response = await appAPI.downloadJSON({ filename: "test.json" });
    expect(response.data).toEqual({
      emptyObject: {},
      emptyArray: [],
      mixedEmpty: {
        nested: {
          empty: [],
        },
      },
    });
  });

  test("handles all replacement patterns", async () => {
    server.use(
      rest.get(
        "http://api.test/apps/tethysdash/json/download/",
        (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              success: true,
              data: {
                "&gt;": "&gt;",
                "&lt;": "&lt;",
                "&gt;=": "&gt;=",
                "&lt;=": "&lt;=",
                "&eq;": "&eq;",
                "&ne;": "&ne;",
                "&amp;": "&amp;",
              },
            }),
            ctx.set("Content-Type", "application/json")
          );
        }
      )
    );

    const response = await appAPI.downloadJSON({ filename: "test.json" });
    expect(response.data).toEqual({
      "&gt;": ">",
      "&lt;": "<",
      "&gt;=": ">=",
      "&lt;=": "<=",
      "&eq;": "==",
      "&ne;": "!=",
      "&amp;": "&",
    });
  });
});

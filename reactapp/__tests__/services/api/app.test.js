import { server } from "__tests__/utilities/server";
import { rest } from "msw";
import appAPI from "services/api/app";

test("appAPI downloadJSON", async () => {
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/json/download/",
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            success: true,
            data: {
              greaterThan: "&gt;",
              lessThan: "&lt;",
              greaterThanEqual: "&gt;=",
              lessThanEqual: "&lt;=",
              more: {
                equal: "&eq;",
                notEqual: "&ne;",
                and: "&amp;",
              },
            },
          }),
          ctx.set("Content-Type", "application/json")
        );
      }
    )
  );

  const response = await appAPI.downloadJSON({
    filename: "some_json.json",
  });

  expect(response).toStrictEqual({
    success: true,
    data: {
      greaterThan: ">",
      lessThan: "<",
      greaterThanEqual: ">=",
      lessThanEqual: "<=",
      more: {
        equal: "==",
        notEqual: "!=",
        and: "&",
      },
    },
  });
});

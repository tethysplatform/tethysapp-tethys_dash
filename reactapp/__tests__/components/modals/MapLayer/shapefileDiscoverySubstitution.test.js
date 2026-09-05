import { resolveShapefileUrl } from "components/modals/MapLayer/shapefileDiscovery";
import { updateObjectWithVariableInputs } from "components/visualizations/utilities";

// Its own file because the substituter is mocked at module scope: the main
// suite exercises real substitution, and swapping it per test there needs a
// module reset, which hands the hook a second React.
jest.mock("components/visualizations/utilities", () => ({
  updateObjectWithVariableInputs: jest.fn(),
}));

// eslint-disable-next-line no-template-curly-in-string
const TEMPLATED = "https://example.org/${Storm}.zip";

it("keeps the url as it is when substitution throws", () => {
  // A malformed template must leave the url alone rather than take the pane
  // down with it; the read then fails on the literal, which is legible.
  updateObjectWithVariableInputs.mockImplementation(() => {
    throw new Error("substitution blew up");
  });

  expect(
    resolveShapefileUrl({
      sourceProps: { props: { url: TEMPLATED } },
      variableInputValues: {},
      variableInputDateFormats: {},
    }),
  ).toBe(TEMPLATED);
});

it("keeps the url when substitution returns nothing usable", () => {
  updateObjectWithVariableInputs.mockReturnValue({});

  expect(
    resolveShapefileUrl({
      sourceProps: { props: { url: TEMPLATED } },
      variableInputValues: {},
      variableInputDateFormats: {},
    }),
  ).toBe(TEMPLATED);
});

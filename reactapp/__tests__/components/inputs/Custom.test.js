import * as customInputs from "components/inputs/Custom";

// The barrel DataInput resolves a custom input through: it looks a component up
// by name on this namespace, so a renamed or dropped export does not fail the
// build -- the input simply stops rendering, wherever in a dashboard it was
// configured. Naming them here is what turns that into a test failure.
const EXPECTED_EXPORTS = [
  "AddMapLayer",
  "MapExtent",
  "MapDrawing",
  "SliderMetadata",
  "CSVUploaderMetadata",
  "DateRangeMetadata",
  "DropdownMetadata",
  "DateMetadata",
];

test.each(EXPECTED_EXPORTS)("Custom exports %s as a component", (name) => {
  const exported = customInputs[name];
  expect(exported).toBeDefined();
  // Either a function component or one wrapped in memo/forwardRef, which is an
  // object rather than a function.
  expect(["function", "object"]).toContain(typeof exported);
});

test("Custom exports nothing beyond the inputs DataInput looks up", () => {
  expect(Object.keys(customInputs).sort()).toEqual(
    [...EXPECTED_EXPORTS].sort(),
  );
});

import {
  getInitialInputValue,
  spaceAndCapitalize,
  valuesEqual,
} from "components/modals/utilities";

test("getInitialInputValue", async () => {
  let inputValue;

  inputValue = getInitialInputValue("text");
  expect(inputValue).toBe("");

  inputValue = getInitialInputValue("checkbox");
  expect(inputValue).toBe(false);

  inputValue = getInitialInputValue([{}]);
  expect(inputValue).toBe(null);
});

test("spaceAndCapitalize", async () => {
  const newValue = spaceAndCapitalize("some_string_to_space");
  expect(newValue).toBe("Some String To Space");
});

test("valuesEqual", async () => {
  let equal;

  equal = valuesEqual({ test: "test" }, { test: "test" });
  expect(equal).toBe(true);

  equal = valuesEqual({ test: "test" }, { test: "test2" });
  expect(equal).toBe(false);

  equal = valuesEqual("", { test: "test2" });
  expect(equal).toBe(false);

  equal = valuesEqual({}, { test: "test2" });
  expect(equal).toBe(false);

  equal = valuesEqual({ test: "test" }, "");
  expect(equal).toBe(false);

  equal = valuesEqual({ test: "test" }, {});
  expect(equal).toBe(false);

  equal = valuesEqual([1, 2, 3], [1, 2, 3]);
  expect(equal).toBe(true);

  equal = valuesEqual([1, 2, 3], [1, 2]);
  expect(equal).toBe(false);

  equal = valuesEqual("test", "test");
  expect(equal).toBe(true);

  equal = valuesEqual("test", "test2");
  expect(equal).toBe(false);
});

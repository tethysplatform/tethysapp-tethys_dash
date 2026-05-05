import {
  getInitialInputValue,
  spaceAndCapitalize,
  valuesEqual,
  removeEmptyValues,
  checkRequiredKeys,
} from "components/modals/utilities";
import { addHours } from "date-fns";

test("getInitialInputValue", async () => {
  let inputValue;

  inputValue = getInitialInputValue("text");
  expect(inputValue).toBe("");

  inputValue = getInitialInputValue("checkbox");
  expect(inputValue).toBe(true);

  inputValue = getInitialInputValue([{}]);
  expect(inputValue).toBe(null);

  inputValue = getInitialInputValue("multiinput");
  expect(inputValue).toStrictEqual([]);

  inputValue = getInitialInputValue("custom-AddMapLayer");
  expect(inputValue).toStrictEqual([]);
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

  equal = valuesEqual(null, null);
  expect(equal).toBe(true);

  equal = valuesEqual({}, {});
  expect(equal).toBe(true);

  equal = valuesEqual(
    { location: "BEE", start_time: new Date(), end_time: new Date() },
    {
      location: "BEE",
      start_time: addHours(new Date(), 1),
      end_time: addHours(new Date(), 1),
    },
  );
  expect(equal).toBe(false);
});

test("removeEmptyStringsFromObject", async () => {
  let newValue = removeEmptyValues({ test: "test" });
  expect(newValue).toStrictEqual({ test: "test" });

  newValue = removeEmptyValues({ test: "", test2: "test2" });
  expect(newValue).toStrictEqual({ test2: "test2" });

  newValue = removeEmptyValues({ test: null });
  expect(newValue).toStrictEqual({});

  newValue = removeEmptyValues([{ test: "test" }, { test: "test2" }]);
  expect(newValue).toStrictEqual([{ test: "test" }, { test: "test2" }]);

  newValue = removeEmptyValues([{ test: null }, { test: "test2" }]);
  expect(newValue).toStrictEqual([{ test: "test2" }]);

  newValue = removeEmptyValues([{ test: null }]);
  expect(newValue).toStrictEqual([]);

  newValue = removeEmptyValues([[[{ test: null }]]]);
  expect(newValue).toStrictEqual([]);

  newValue = removeEmptyValues({ test: [1, " "] });
  expect(newValue).toStrictEqual({ test: [1] });

  newValue = removeEmptyValues({ test: [""] });
  expect(newValue).toStrictEqual({});

  newValue = removeEmptyValues({
    "Max Status - Forecast Trend": {
      WFO: "Test",
      "NWS LID": " ",
    },
  });
  expect(newValue).toStrictEqual({
    "Max Status - Forecast Trend": { WFO: "Test" },
  });
});

test("checkRequiredKeys", async () => {
  let requiredKeysObj = {
    test: "test",
    test2: { test3: "some value" },
  };
  let checkingObj = {
    test: "test",
    test2: { test3: "some value" },
  };
  let missingKeys = checkRequiredKeys(requiredKeysObj, checkingObj);
  expect(missingKeys).toStrictEqual([]);

  requiredKeysObj = {
    test: "",
    test2: { test3: "" },
  };
  checkingObj = {
    test: "test",
  };
  missingKeys = checkRequiredKeys(requiredKeysObj, checkingObj);
  expect(missingKeys).toStrictEqual(["test2"]);

  requiredKeysObj = {
    test: "",
    test2: { test3: "" },
  };
  checkingObj = {
    test2: { test5: "" },
  };
  missingKeys = checkRequiredKeys(requiredKeysObj, checkingObj);
  expect(missingKeys).toStrictEqual(["test", "test2.test3"]);

  missingKeys = checkRequiredKeys(null, checkingObj);
  expect(missingKeys).toStrictEqual([]);
});

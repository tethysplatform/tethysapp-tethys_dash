export function getInitialInputValue(value) {
  let inputValue;
  if (value === "text") {
    inputValue = "";
  } else if (value === "checkbox") {
    inputValue = false;
  } else if (value === "multiinput" || value === "custom-AddMapLayer") {
    inputValue = [];
  } else {
    inputValue = null;
  }

  return inputValue;
}

export function spaceAndCapitalize(string) {
  let capitalized_words = [];
  let separated_string = string.split("_");
  for (let substring of separated_string) {
    capitalized_words.push(
      substring.charAt(0).toUpperCase() + substring.slice(1)
    );
  }

  return capitalized_words.join(" ");
}

const objectsEqual = (o1, o2) => {
  if (Object.keys(o1).length === 0 && Object.keys(o2).length === 0) {
    return true;
  } else if (Object.keys(o1).length === Object.keys(o2).length) {
    return Object.keys(o1).every((p) => valuesEqual(o1[p], o2[p]));
  } else {
    return o1 === o2;
  }
};

const arraysEqual = (a1, a2) =>
  a1.length === a2.length && a1.every((o, idx) => valuesEqual(o, a2[idx]));

export const valuesEqual = (a1, a2) => {
  if (a1 === null || a2 === null) {
    return a1 === a2;
  } else if (Array.isArray(a1) && Array.isArray(a2)) {
    return arraysEqual(a1, a2);
  } else if (typeof a1 === "object" && typeof a2 === "object") {
    return objectsEqual(a1, a2);
  } else {
    return a1 === a2;
  }
};

export function objectToArray(obj) {
  return Object.entries(obj).map(([Parameter, Value]) => ({
    Parameter,
    Value,
  }));
}

export function arrayToObject(arr) {
  return arr.reduce((acc, obj) => {
    acc[obj.Parameter] = obj.Value;
    return acc;
  }, {});
}

export const removeEmptyStringsFromObject = (obj) => {
  if (Array.isArray(obj)) {
    return obj
      .map((item) =>
        typeof item === "object" && item !== null
          ? removeEmptyStringsFromObject(item) // Recursively process array elements
          : item
      )
      .filter((item) => item !== ""); // Remove empty strings from arrays
  }

  if (typeof obj !== "object" || obj === null) return obj; // Return non-objects as is

  return Object.fromEntries(
    Object.entries(obj)
      .filter(([_, value]) => value !== "") // Remove empty strings
      .map(([key, value]) => [
        key,
        typeof value === "object" && value !== null
          ? removeEmptyStringsFromObject(value) // Recursively process nested objects
          : value,
      ])
      .filter(
        ([_, value]) =>
          !(
            typeof value === "object" &&
            value !== null &&
            Object.keys(value).length === 0
          ) // Remove empty objects
      )
  );
};

export const findMissingKeys = (templateObj, dataObj, parentKey = "") => {
  let invalidKeys = [];

  for (const [key, value] of Object.entries(templateObj)) {
    const fullKey = parentKey ? `${parentKey}.${key}` : key; // Build full key path

    if (!(key in dataObj)) {
      invalidKeys.push(fullKey); // Add missing key to the list
    } else if (typeof value === "object" && value !== null) {
      // Recursively check nested objects
      invalidKeys = invalidKeys.concat(
        findMissingKeys(value, dataObj[key], fullKey)
      );
    }
  }

  return invalidKeys;
};

export const extractVariableInputNames = (attributes) => {
  const result = {};

  Object.keys(attributes).forEach((layerName) => {
    if (Array.isArray(attributes[layerName])) {
      const mappings = attributes[layerName].reduce((acc, item) => {
        if (item["variableInput"]) {
          acc[item.alias] = item["variableInput"];
        }
        return acc;
      }, {});

      if (Object.keys(mappings).length > 0) {
        result[layerName] = mappings;
      }
    } else {
      result[layerName] = Object.fromEntries(
        Object.entries(attributes[layerName]).filter(
          ([_, value]) => value !== ""
        )
      );
    }
  });

  return result;
};

export const extractOmittedPopupAttributes = (attributes) => {
  const result = {};

  Object.keys(attributes).forEach((category) => {
    if (Array.isArray(attributes[category])) {
      const mappings = attributes[category]
        .filter((item) => item.popup === false) // Keep items where popup is explicitly false
        .map((item) => item.alias); // Extract the alias property

      if (Object.keys(mappings).length > 0) {
        result[category] = mappings;
      }
    } else {
      result[category] = attributes[category];
    }
  });

  return result;
};

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

// removes null or empty strings from arrays and objects
export const removeEmptyValues = (values) => {
  if (Array.isArray(values)) {
    return values
      .map((item) => {
        // if item in array is an object, then recursively run function to get nonempty nested values
        if (item && typeof item === "object") {
          const updatedObject = removeEmptyValues(item);
          // only return nonempty objects
          if (Object.keys(updatedObject).length > 0) {
            return updatedObject;
          }
        } else {
          return typeof item === "string" ? item.trim() : item;
        }
      })
      .filter((item) => item); // filter out empty, null, or undefined items
  }

  return Object.fromEntries(
    Object.entries(values)
      .filter(([_, value]) => value) // Remove empty and null/undefined strings
      .map(([key, value]) => [
        key,
        value && typeof value === "object"
          ? removeEmptyValues(value) // Recursively process nested objects
          : typeof value === "string"
            ? value.trim()
            : value,
      ])
      .filter(
        ([_, value]) =>
          value &&
          !(typeof value === "object" && Object.keys(value).length === 0) // Remove empty objects
      )
  );
};

// Checks to see if required keys from an object are present in an another object
export const checkRequiredKeys = (
  requiredKeysObj,
  checkingObj,
  parentKey = ""
) => {
  let missingKeys = [];

  for (const [key, value] of Object.entries(requiredKeysObj)) {
    const fullKey = parentKey ? `${parentKey}.${key}` : key; // Build full key path

    if (!(key in checkingObj)) {
      missingKeys.push(fullKey); // Add missing key to the list
    } else if (value && typeof value === "object") {
      // Recursively check nested objects
      missingKeys = missingKeys.concat(
        checkRequiredKeys(value, checkingObj[key], fullKey)
      );
    }
  }

  return missingKeys;
};

//  extract variableInputs from map layer attributes
export const extractVariableInputNames = (attributes) => {
  const result = {};

  // check each layer for attributes
  Object.keys(attributes).forEach((layerName) => {
    const mappings = attributes[layerName].reduce((acc, item) => {
      if (item["variableInput"]) {
        acc[item.alias] = item["variableInput"];
      }
      return acc;
    }, {});

    if (Object.keys(mappings).length > 0) {
      result[layerName] = mappings;
    }
  });

  return result;
};

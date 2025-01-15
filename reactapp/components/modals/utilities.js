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

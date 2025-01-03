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

const objectsEqual = (o1, o2) =>
  typeof o1 === "object" && Object.keys(o1).length > 0
    ? Object.keys(o1).length === Object.keys(o2).length &&
      Object.keys(o1).every((p) => objectsEqual(o1[p], o2[p]))
    : o1 === o2;

const arraysEqual = (a1, a2) =>
  a1.length === a2.length && a1.every((o, idx) => objectsEqual(o, a2[idx]));

export const valuesEqual = (a1, a2) => {
  if (Array.isArray(a1) && Array.isArray(a2)) {
    return arraysEqual(a1, a2);
  } else if (typeof a1 === "object" && typeof a2 === "object") {
    return objectsEqual(a1, a2);
  } else {
    return a1 === a2;
  }
};

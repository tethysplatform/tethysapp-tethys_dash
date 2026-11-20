// Fill `${feature.<key>}` tokens, where the key permits dots, spaces, parens,
// dashes — anything except a closing brace. Tokens are found with the same
// regex the variable-input pipeline uses, so the syntax is consistent.
import { formatAttributeValue } from "components/map/utilities";
import {
  applyTransform,
  parseVariableToken,
  valueAsText,
} from "components/visualizations/variableTokens";

// Every `${...}` token; which ones are feature fields is decided by the parsed
// name, so a transform may sit before or after `feature.<key>`.
const TEMPLATE_TOKEN_RE = /\$\{([^}]+)\}/g;
const FEATURE_PREFIX = "feature.";

// The attribute key a parsed name refers to, or null when it is not a
// `feature.<key>` reference. Spacing is read as it always has been: a space
// after `feature.` is dropped (`${feature. name}` reads `name`), as is one at
// the very end of the token (`substituteTemplateString` trims that before
// parsing), but a space before a transform stays part of the key
// (`${feature.name :0:2}` reads `name `), and a token opening with a space
// (`${ feature.x}`) is not a feature reference at all.
function featureKey(name) {
  return name.startsWith(FEATURE_PREFIX)
    ? name.slice(FEATURE_PREFIX.length).trimStart()
    : null;
}

/**
 * Substitute `${feature.<key>}` template tokens in `template` against the
 * supplied attribute map.
 *
 * - Empty/null/undefined `template` → empty string.
 * - Missing/null/undefined attribute → empty string (NOT the literal "null").
 * - Numbers, booleans, and other primitives → `String(value)`.
 * - Dates → ISO 8601 UTC; objects and arrays → JSON.
 * - Non-template characters pass through unchanged.
 *
 * @param {string|null|undefined} template
 * @param {Object|null|undefined} attributes
 * @returns {string}
 */
export function substituteTemplateString(template, attributes) {
  if (template === null || template === undefined || template === "") {
    return "";
  }
  return String(template).replace(TEMPLATE_TOKEN_RE, (match, token) => {
    // A token may carry a transform, e.g. `${feature.name:0:4}` slices the
    // field's text, bash-style; a field whose own name looks like a transform
    // is read whole. What a token refers to is decided by its parsed name, so
    // a transform written before the name works too (see variableTokens.js).
    const { name, transform } = parseVariableToken(
      token.trimEnd(),
      (candidate) => {
        const key = featureKey(candidate);
        return (
          key !== null &&
          !!attributes &&
          Object.prototype.hasOwnProperty.call(attributes, key)
        );
      },
    );
    const key = featureKey(name);
    // Not a feature field (`${Site}`): this template only fills in features.
    if (key === null) return match;
    const value = attributes ? attributes[key] : undefined;
    if (value === null || value === undefined) {
      return "";
    }
    // Shared with the popup table, so a Date reads the same in a title as it
    // does in the row below it -- and as ISO rather than whatever locale the
    // viewer happens to have. A transform then works on that same text.
    return valueAsText(
      applyTransform(String(formatAttributeValue(value)), transform),
    );
  });
}

export default substituteTemplateString;

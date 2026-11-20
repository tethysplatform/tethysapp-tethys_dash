// Match `${feature.<key>}` where the key permits dots, spaces, parens, dashes
// — anything except a closing brace. Mirrors the substitution regex used by
// the existing variable-input pipeline so the syntax is consistent.
import { formatAttributeValue } from "components/map/utilities";
import {
  applySlice,
  parseVariableToken,
} from "components/visualizations/variableSlice";

const FEATURE_TEMPLATE_RE = /\$\{feature\.([^}]+)\}/g;

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
  return String(template).replace(FEATURE_TEMPLATE_RE, (_match, rawKey) => {
    // `${feature.name:0:4}` slices the field's text, bash-style; a field whose
    // own name looks like a slice is read whole (see variableSlice.js).
    const { name, slice } = parseVariableToken(
      rawKey.trim(),
      (candidate) =>
        !!attributes &&
        Object.prototype.hasOwnProperty.call(attributes, candidate),
    );
    const value = attributes ? attributes[name] : undefined;
    if (value === null || value === undefined) {
      return "";
    }
    // Shared with the popup table, so a Date reads the same in a title as it
    // does in the row below it -- and as ISO rather than whatever locale the
    // viewer happens to have.
    return applySlice(String(formatAttributeValue(value)), slice);
  });
}

export default substituteTemplateString;

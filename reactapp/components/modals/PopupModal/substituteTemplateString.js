// Match `${feature.<key>}` where the key permits dots, spaces, parens, dashes
// — anything except a closing brace. Mirrors the substitution regex used by
// the existing variable-input pipeline so the syntax is consistent.
const FEATURE_TEMPLATE_RE = /\$\{feature\.([^}]+)\}/g;

/**
 * Substitute `${feature.<key>}` template tokens in `template` against the
 * supplied attribute map.
 *
 * - Empty/null/undefined `template` → empty string.
 * - Missing/null/undefined attribute → empty string (NOT the literal "null").
 * - Numbers, booleans, and other primitives → `String(value)`.
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
    const key = rawKey.trim();
    const value = attributes ? attributes[key] : undefined;
    if (value === null || value === undefined) {
      return "";
    }
    return String(value);
  });
}

export default substituteTemplateString;

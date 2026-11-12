import PropTypes from "prop-types";
import { formatAttributeValue } from "components/map/utilities";

// Matches a value that starts with http(s)://, ftp:// or www.
const URL_PATTERN =
  /^(https?:\/\/|ftp:\/\/|www\.)[\w-]+(\.[\w-]+)+([\w\-.,@?^=%&:/~+#]*[\w\-@?^=%&/~+#])?/i;

/**
 * One feature attribute as the map's popups show it: a value that reads as a
 * URL is a link, and anything else is display text. The click table and the
 * hover tooltip both render values through this, so a field reads the same in
 * either one.
 */
const AttributeValue = ({ value }) => {
  if (typeof value === "string" && URL_PATTERN.test(value)) {
    // A bare www. link gets a protocol, or the browser would resolve it
    // relative to the dashboard's own URL.
    const href =
      value.startsWith("http") || value.startsWith("ftp")
        ? value
        : `https://${value}`;
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {value}
      </a>
    );
  }
  return formatAttributeValue(value);
};

AttributeValue.propTypes = {
  value: PropTypes.any,
};

export default AttributeValue;

import PropTypes from "prop-types";
import styled from "styled-components";
import Table from "react-bootstrap/Table";
import AttributeValue from "components/map/AttributeValue";

// How far the tooltip sits from the cursor, in pixels, so it never covers the
// point it describes.
export const HOVER_TOOLTIP_OFFSET = 12;

// The click table's light card, at a tooltip's size. The caps keep a feature
// with many fields, or one long value, from covering the map; since the
// tooltip takes no pointer events and so cannot be scrolled, whatever passes
// the height cap is cut off rather than given a scrollbar.
const TooltipBox = styled.div`
  background-color: white;
  border-radius: 8px;
  box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.2);
  padding: 0.5rem;
  max-width: 320px;
  max-height: 240px;
  overflow: hidden;
`;

const TooltipTable = styled(Table)`
  font-size: small;
  margin-bottom: 0;
`;

// Long values wrap, even where they have no spaces (a URL, an ID), so the
// width cap never turns into a horizontal overflow.
const WrappingTD = styled.td`
  overflow-wrap: anywhere;
  vertical-align: top;
`;

/**
 * The hover tooltip: the hovered feature's fields as label and value rows,
 * styled like the click table's. It describes one feature and is gone as soon
 * as the cursor moves, so it has no title, pager or close button.
 *
 * @param {object} props
 * @param {{key: string, label: string, value: *}[]} props.rows The feature's
 *   hover rows, from `hoverAttributeRows`.
 */
const HoverTooltip = ({ rows }) => (
  <TooltipBox role="tooltip">
    <TooltipTable striped bordered size="sm">
      <tbody>
        {rows.map(({ key, label, value }) => (
          <tr key={key}>
            <WrappingTD>{label}</WrappingTD>
            <WrappingTD>
              <AttributeValue value={value} />
            </WrappingTD>
          </tr>
        ))}
      </tbody>
    </TooltipTable>
  </TooltipBox>
);

/**
 * Where the tooltip sits relative to the cursor: below and to the right of it,
 * flipped to the left in the right half of the map and above it in the bottom
 * half, so it opens toward the middle rather than running off the nearer
 * edges. Without a pixel or a map size to compare it to, the tooltip takes the
 * default corner.
 *
 * @param {number[]|null|undefined} pixel The cursor's pixel on the map.
 * @param {number[]|undefined} size The map's size in pixels.
 * @returns {{positioning: string, offset: number[]}} The OpenLayers overlay
 *   positioning and offset.
 */
export function hoverTooltipPlacement(pixel, size) {
  const known = Array.isArray(pixel) && Array.isArray(size);
  const flipLeft = known && pixel[0] > size[0] / 2;
  const flipUp = known && pixel[1] > size[1] / 2;
  return {
    positioning: `${flipUp ? "bottom" : "top"}-${flipLeft ? "right" : "left"}`,
    offset: [
      flipLeft ? -HOVER_TOOLTIP_OFFSET : HOVER_TOOLTIP_OFFSET,
      flipUp ? -HOVER_TOOLTIP_OFFSET : HOVER_TOOLTIP_OFFSET,
    ],
  };
}

HoverTooltip.propTypes = {
  rows: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string,
      label: PropTypes.node,
      value: PropTypes.any,
    }),
  ).isRequired,
};

export default HoverTooltip;

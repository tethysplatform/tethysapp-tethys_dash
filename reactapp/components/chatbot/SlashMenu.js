import styled from "styled-components";
import PropTypes from "prop-types";
import { colors, radii } from "./styles";

const Menu = styled.ul`
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: calc(100% + 6px);
  margin: 0;
  padding: 4px;
  list-style: none;
  max-height: 260px;
  overflow-y: auto;
  background: ${colors.surface};
  border: 1px solid ${colors.border};
  border-radius: ${radii.md};
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.16);
  z-index: 5;
`;

const GroupLabel = styled.li`
  padding: 6px 8px 2px;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: ${colors.textFainter};
`;

const Option = styled.li`
  padding: 6px 8px;
  border-radius: ${radii.sm};
  cursor: pointer;
  background: ${(p) => (p.$active ? colors.accentSoft : "transparent")};
`;

const OptTitle = styled.div`
  font-size: 0.82rem;
  font-weight: 600;
  color: ${colors.text};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const OptSub = styled.div`
  font-size: 0.74rem;
  color: ${colors.textFaint};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export default function SlashMenu({
  items,
  highlight,
  onSelect,
  onHighlight,
  listId,
}) {
  let lastGroup = null;
  return (
    <Menu role="listbox" id={listId} aria-label="Chat commands">
      {items.map((item, i) => {
        const showGroup = item.group !== lastGroup;
        lastGroup = item.group;
        return (
          <div key={item.key}>
            {showGroup && <GroupLabel aria-hidden="true">{item.group}</GroupLabel>}
            <Option
              role="option"
              id={`${listId}-opt-${i}`}
              aria-selected={i === highlight}
              $active={i === highlight}
              // mousedown (not click) so selection fires before the textarea blurs
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(item);
              }}
              onMouseEnter={() => onHighlight(i)}
            >
              <OptTitle>{item.title}</OptTitle>
              <OptSub>{item.subtitle}</OptSub>
            </Option>
          </div>
        );
      })}
    </Menu>
  );
}

SlashMenu.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      group: PropTypes.string,
      title: PropTypes.string,
      subtitle: PropTypes.string,
      insert: PropTypes.string.isRequired,
    }),
  ).isRequired,
  highlight: PropTypes.number.isRequired,
  onSelect: PropTypes.func.isRequired,
  onHighlight: PropTypes.func.isRequired,
  listId: PropTypes.string.isRequired,
};

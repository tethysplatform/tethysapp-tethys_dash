import { useCallback, useRef } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";

const Strip = styled.div`
  display: flex;
  flex-direction: row;
  gap: 0.4rem;
  padding: 0.4rem 0;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  /* Hide scrollbar in webkit + firefox so the chips look like a control row,
     not a content scroller. The scroll behavior still works via gestures and
     keyboard. */
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;

const Chip = styled.button`
  flex: 0 0 auto;
  scroll-snap-align: start;
  max-width: 16rem;
  padding: 0.3rem 0.7rem;
  border: 1px solid ${({ $active }) => ($active ? "#0d6efd" : "#ced4da")};
  background: ${({ $active }) => ($active ? "#0d6efd" : "#ffffff")};
  color: ${({ $active }) => ($active ? "#ffffff" : "#212529")};
  border-radius: 999px;
  font-size: 0.85rem;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  &:focus-visible {
    outline: 2px solid #2684ff;
    outline-offset: 2px;
  }
`;

/**
 * `PopupModalCarousel` — feature-selector chip strip.
 *
 * Renders nothing when `features` has 0 or 1 entries (no point selecting).
 * For multi-feature clicks, each chip is a focusable, role="tab" button
 * showing the per-feature label. Clicking sets `activeIndex` via
 * `onActiveIndexChange`. Arrow Left/Right cycles through chips for keyboard
 * a11y; Home/End jumps to the ends.
 */
const PopupModalCarousel = ({
  features,
  activeIndex,
  onActiveIndexChange,
  getLabel,
}) => {
  const stripRef = useRef(null);

  const handleKeyDown = useCallback(
    (event) => {
      if (!features || features.length === 0) return;
      let nextIndex = null;
      if (event.key === "ArrowRight") {
        nextIndex = Math.min(features.length - 1, activeIndex + 1);
      } else if (event.key === "ArrowLeft") {
        nextIndex = Math.max(0, activeIndex - 1);
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = features.length - 1;
      }
      if (nextIndex !== null && nextIndex !== activeIndex) {
        event.preventDefault();
        onActiveIndexChange(nextIndex);
      }
    },
    [features, activeIndex, onActiveIndexChange],
  );

  if (!features || features.length <= 1) {
    return null;
  }

  return (
    <Strip
      ref={stripRef}
      role="tablist"
      aria-label="Popup feature selector"
      onKeyDown={handleKeyDown}
      data-testid="popup-modal-carousel"
    >
      {features.map((feature, i) => {
        const label = getLabel ? getLabel(feature, i) : `Feature ${i + 1}`;
        const isActive = i === activeIndex;
        return (
          <Chip
            key={i}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            $active={isActive}
            onClick={() => onActiveIndexChange(i)}
            data-testid={`popup-modal-carousel-chip-${i}`}
            title={label}
          >
            {label}
          </Chip>
        );
      })}
    </Strip>
  );
};

PopupModalCarousel.propTypes = {
  // eslint-disable-next-line react/forbid-prop-types
  features: PropTypes.arrayOf(PropTypes.object),
  activeIndex: PropTypes.number.isRequired,
  onActiveIndexChange: PropTypes.func.isRequired,
  getLabel: PropTypes.func,
};

PopupModalCarousel.defaultProps = {
  features: [],
  getLabel: null,
};

export default PopupModalCarousel;

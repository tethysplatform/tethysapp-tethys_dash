import { useCallback } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";

const Controls = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 0.4rem 0;
  user-select: none;
`;

const Arrow = styled.button`
  background: transparent;
  border: none;
  font-size: 1.25rem;
  line-height: 1;
  color: #333;
  cursor: pointer;
  padding: 0.2rem 0.55rem;
  border-radius: 4px;

  &:hover {
    background: #f1f3f5;
  }

  &:focus-visible {
    outline: 2px solid #2684ff;
    outline-offset: 2px;
  }
`;

const Pagination = styled.span`
  font-size: 0.9rem;
  color: #495057;
  min-width: 3.5rem;
  text-align: center;
`;

/**
 * Step `activeIndex` by `delta`, wrapping around either end: the last feature
 * advances to the first, the first steps back to the last. Mirrors the table
 * popup's Swiper, which is configured with `rewind`.
 */
export function wrapIndex(activeIndex, delta, total) {
  return (((activeIndex + delta) % total) + total) % total;
}

/**
 * Pure helper: compute the next active index given a keyboard key, the
 * features array, and the current index. Returns null when the key isn't a
 * navigation key (or when there are no features). Exported so keyboard
 * navigation can be unit-tested without standing up the component.
 */
export function computeNextIndexFromKey(key, features, activeIndex) {
  if (!features || features.length === 0) return null;
  if (key === "ArrowRight") {
    return wrapIndex(activeIndex, 1, features.length);
  }
  if (key === "ArrowLeft") {
    return wrapIndex(activeIndex, -1, features.length);
  }
  if (key === "Home") {
    return 0;
  }
  if (key === "End") {
    return features.length - 1;
  }
  return null;
}

/**
 * `PopupModalCarousel` — prev / pagination / next controls for stepping
 * through the features clicked in a single map gesture. Mirrors the
 * navigation pattern of the regular OL Overlay popup's swiper (◀ N / Total
 * ▶) so the two popup styles feel consistent.
 *
 * Renders nothing for 0 or 1 features (no choice to make). The active
 * feature's visible title is rendered by the modal header — this row only
 * does navigation, so the pagination indicator is a simple "N / Total"
 * fraction.
 *
 * `getLabel` (optional) is used only for the prev/next arrows' aria-labels
 * so screen readers can announce "Next feature: <label>" instead of just
 * "Next feature".
 */
const PopupModalCarousel = ({
  features,
  activeIndex,
  onActiveIndexChange,
  getLabel,
}) => {
  const handleKeyDown = useCallback(
    (event) => {
      const nextIndex = computeNextIndexFromKey(
        event.key,
        features,
        activeIndex,
      );
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

  // Both arrows wrap, so neither is ever a dead end: the last feature advances
  // to the first and the first steps back to the last.
  const prevIndex = wrapIndex(activeIndex, -1, features.length);
  const nextIndex = wrapIndex(activeIndex, 1, features.length);

  const goPrev = () => onActiveIndexChange(prevIndex);
  const goNext = () => onActiveIndexChange(nextIndex);

  const prevAriaLabel = getLabel
    ? `Previous feature: ${getLabel(features[prevIndex], prevIndex)}`
    : "Previous feature";
  const nextAriaLabel = getLabel
    ? `Next feature: ${getLabel(features[nextIndex], nextIndex)}`
    : "Next feature";

  return (
    <Controls
      role="group"
      aria-label="Popup feature navigation"
      onKeyDown={handleKeyDown}
      data-testid="popup-modal-carousel"
    >
      <Arrow
        type="button"
        onClick={goPrev}
        aria-label={prevAriaLabel}
        data-testid="popup-modal-carousel-prev"
      >
        ❮
      </Arrow>
      <Pagination
        aria-live="polite"
        aria-atomic="true"
        data-testid="popup-modal-carousel-pagination"
      >
        {activeIndex + 1} / {features.length}
      </Pagination>
      <Arrow
        type="button"
        onClick={goNext}
        aria-label={nextAriaLabel}
        data-testid="popup-modal-carousel-next"
      >
        ❯
      </Arrow>
    </Controls>
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

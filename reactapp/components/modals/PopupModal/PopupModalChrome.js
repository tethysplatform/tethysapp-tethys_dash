import { useMemo, useRef, useLayoutEffect, useState } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import FeatureScopedVariableInputs from "components/contexts/FeatureScopedVariableInputs";
import DashboardLayout from "components/dashboard/DashboardLayout";
import { TabContext, EditingContext } from "components/contexts/Contexts";

export const DEFAULT_ROW_HEIGHT = 30;
const TARGET_ROWS = 20;

const Body = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0.25rem 0;
`;

const GridContainer = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  position: relative;
  overflow-x: hidden;
  overflow-y: auto;
  /* Reserve the vertical scrollbar's width whether or not it's currently
     visible. Without this the scrollbar flickers between visible/hidden as
     embedded plots' resize observers re-measure on every appearance — the
     classic ResizeObserver feedback loop. The reserved gutter keeps the
     inner width stable and lets Plotly settle in one frame. */
  scrollbar-gutter: stable;
`;

const EmptyHint = styled.p`
  color: #6c757d;
  font-size: 0.9rem;
  text-align: center;
  margin: 1rem 0;
`;

export function deriveRowHeight(containerHeight) {
  if (!containerHeight || !Number.isFinite(containerHeight)) {
    return DEFAULT_ROW_HEIGHT;
  }
  // Fractional rowHeight is intentional: with Math.floor an item at
  // h=TARGET_ROWS could be up to 19px short of the body height (~5% gap
  // on small modals). RGL accepts non-integer rowHeight, so dividing
  // cleanly gives h=TARGET_ROWS an exact 100% fill. Clamp to >=1 only to
  // avoid pathological zero/sub-pixel rows at tiny containers.
  return Math.max(1, containerHeight / TARGET_ROWS);
}

/**
 * `PopupModalChrome` — body contents of the modal popup. Wraps the embedded
 * DashboardLayout in `<FeatureScopedVariableInputs feature={feature}>` so the
 * configured visualizations see the clicked feature's attributes under the
 * `feature.*` namespace.
 *
 * Multi-feature navigation lives in `PopupModal`'s header (via the
 * `leadingControls` prop wired up in Map.js), NOT here — keeping the chrome
 * focused on rendering the active feature's body. The parent owns the
 * active-feature state and just hands us the resolved `feature`.
 */
const PopupModalChrome = ({ feature, popupConfig }) => {
  const bodyRef = useRef(null);
  const [rowHeight, setRowHeight] = useState(DEFAULT_ROW_HEIGHT);

  useLayoutEffect(() => {
    const node = bodyRef.current;
    if (!node) return undefined;

    const apply = () => {
      const rect = node.getBoundingClientRect();
      const next = deriveRowHeight(rect.height);
      setRowHeight((prev) => (prev === next ? prev : next));
    };

    apply();

    if (typeof window === "undefined" || !window.ResizeObserver) {
      return undefined;
    }
    const observer = new window.ResizeObserver(() => apply());
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const gridItems = useMemo(() => popupConfig?.gridItems ?? [], [popupConfig]);
  const tabContextValue = useMemo(() => {
    const popupTab = { id: "popup", name: "popup", gridItems };
    return {
      tabs: [popupTab],
      activeTabId: "popup",
    };
  }, [gridItems]);

  // Runtime view: never editable. Editing happens in PopupLayoutEditor.
  const editingContextValue = useMemo(() => ({ isEditing: false }), []);

  const hasGridItems = gridItems.length > 0;

  return (
    <Body data-testid="popup-modal-chrome">
      <FeatureScopedVariableInputs feature={feature}>
        <GridContainer
          ref={bodyRef}
          data-testid="popup-modal-chrome-grid-container"
        >
          {!hasGridItems ? (
            <EmptyHint data-testid="popup-modal-chrome-empty">
              No visualizations have been configured for this popup.
            </EmptyHint>
          ) : (
            <TabContext.Provider value={tabContextValue}>
              <EditingContext.Provider value={editingContextValue}>
                <DashboardLayout
                  tabId="popup"
                  gridItems={gridItems}
                  shouldLoad={true}
                  responsive
                  rowHeight={rowHeight}
                  allowOverlap={false}
                />
              </EditingContext.Provider>
            </TabContext.Provider>
          )}
        </GridContainer>
      </FeatureScopedVariableInputs>
    </Body>
  );
};

PopupModalChrome.propTypes = {
  feature: PropTypes.shape({
    layerName: PropTypes.string,
    // eslint-disable-next-line react/forbid-prop-types
    attributes: PropTypes.object,
    // eslint-disable-next-line react/forbid-prop-types
    geometry: PropTypes.any,
  }),
  popupConfig: PropTypes.shape({
    id: PropTypes.number,
    mode: PropTypes.oneOf(["table", "modal"]),
    // eslint-disable-next-line react/forbid-prop-types
    position: PropTypes.object,
    titleTemplate: PropTypes.string,
    // eslint-disable-next-line react/forbid-prop-types
    gridItems: PropTypes.array,
  }),
};

PopupModalChrome.defaultProps = {
  feature: null,
  popupConfig: null,
};

export default PopupModalChrome;

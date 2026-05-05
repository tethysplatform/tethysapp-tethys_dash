import {
  useState,
  useMemo,
  useRef,
  useLayoutEffect,
  useCallback,
} from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import FeatureScopedVariableInputs from "components/contexts/FeatureScopedVariableInputs";
import DashboardLayout from "components/dashboard/DashboardLayout";
import { TabContext, EditingContext } from "components/contexts/Contexts";
import PopupModalCarousel from "components/modals/PopupModal/PopupModalCarousel";
import { substituteTemplateString } from "components/modals/PopupModal/substituteTemplateString";

// Default rowHeight used before useLayoutEffect measurement runs. Roughly
// matches a legible cell size at 100-column resolution.
const DEFAULT_ROW_HEIGHT = 30;
// Target row count used to derive rowHeight from the measured body height.
const TARGET_ROWS = 20;

const noop = () => {};

const Title = styled.div`
  font-weight: 600;
  font-size: 0.95rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

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

function deriveRowHeight(containerHeight) {
  if (!containerHeight || !Number.isFinite(containerHeight)) {
    return DEFAULT_ROW_HEIGHT;
  }
  return Math.max(20, Math.floor(containerHeight / TARGET_ROWS));
}

/**
 * `PopupModalChrome` — runtime contents of the modal-mode popup.
 *
 * Owns the active-feature index for multi-feature clicks, renders the
 * substituted title, optional feature carousel, and a single
 * `<DashboardLayout>` of the popup's configured visualizations wrapped in
 * `<FeatureScopedVariableInputs>` so each tile receives the active feature's
 * attributes via the `feature.*` namespace. Switching the carousel slide
 * remounts the FeatureScopedVariableInputs feature prop so dependent
 * visualizations re-fetch their data with the new `feature.*` values
 * (consistent with the rest of the variable-input pipeline).
 *
 * View-only at runtime — `EditingContext.isEditing` is forced false. Popup
 * tile editing happens in `PopupLayoutEditor`, not here.
 */
const PopupModalChrome = ({ features, popupConfig }) => {
  const [activeIndex, setActiveIndex] = useState(0);

  // Clamp activeIndex if the features array shrinks. (Defensive — the parent
  // typically remounts on each gesture, but we still don't want to render
  // an out-of-range slide if it changes in place.)
  const safeActiveIndex =
    features && features.length > 0
      ? Math.min(activeIndex, features.length - 1)
      : 0;
  const activeFeature =
    features && features.length > 0 ? features[safeActiveIndex] : null;

  const titleText = useMemo(() => {
    const template = popupConfig?.titleTemplate;
    if (template) {
      const substituted = substituteTemplateString(
        template,
        activeFeature?.attributes ?? {},
      );
      if (substituted.trim().length > 0) {
        return substituted;
      }
    }
    return activeFeature?.layerName ?? "";
  }, [popupConfig, activeFeature]);

  const getCarouselLabel = useCallback(
    (feature, i) => {
      const template = popupConfig?.titleTemplate;
      if (template) {
        const substituted = substituteTemplateString(
          template,
          feature?.attributes ?? {},
        );
        if (substituted.trim().length > 0) {
          return substituted;
        }
      }
      return `Feature ${i + 1}`;
    },
    [popupConfig],
  );

  // Measure the body to derive a sensible per-row pixel height. Synchronous
  // first measurement avoids a first-paint reflow flash. ResizeObserver
  // covers subsequent modal resizes / viewport resizes.
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

  // Synthetic TabContext: the popup is modeled as a single "popup" tab. The
  // embedded DashboardLayout reads gridItems via getActiveTab(); other
  // methods are no-ops at runtime since reordering/deleting tiles only
  // happens in the editor. Memoize the gridItems reference so the tab
  // context value is stable when popupConfig hasn't actually changed.
  const gridItems = useMemo(
    () => popupConfig?.gridItems ?? [],
    [popupConfig],
  );
  const tabContextValue = useMemo(() => {
    const popupTab = { id: "popup", name: "popup", gridItems };
    return {
      tabs: [popupTab],
      activeTabId: "popup",
      setActiveTabId: noop,
      addTab: noop,
      importTabs: noop,
      updateTab: noop,
      deleteTab: noop,
      reorderTabs: noop,
      resetTabs: noop,
      getActiveTab: () => popupTab,
      getTab: () => popupTab,
    };
  }, [gridItems]);

  // Runtime view: never editable. Editing happens in PopupLayoutEditor.
  const editingContextValue = useMemo(
    () => ({ isEditing: false, setIsEditing: noop }),
    [],
  );

  const hasGridItems = gridItems.length > 0;

  return (
    <Body data-testid="popup-modal-chrome">
      <Title data-testid="popup-modal-chrome-title">{titleText}</Title>
      <PopupModalCarousel
        features={features}
        activeIndex={safeActiveIndex}
        onActiveIndexChange={setActiveIndex}
        getLabel={getCarouselLabel}
      />
      <FeatureScopedVariableInputs feature={activeFeature}>
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
  features: PropTypes.arrayOf(
    PropTypes.shape({
      layerName: PropTypes.string,
      // eslint-disable-next-line react/forbid-prop-types
      attributes: PropTypes.object,
      // eslint-disable-next-line react/forbid-prop-types
      geometry: PropTypes.any,
    }),
  ),
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
  features: [],
  popupConfig: null,
};

export default PopupModalChrome;

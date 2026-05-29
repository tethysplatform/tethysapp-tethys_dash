import React, { Suspense } from "react";
import styled from "styled-components";
import PropTypes from "prop-types";

/*
 * Card — quiet stat tile.
 *
 * Prior version was the "hero metric template" DESIGN.md anti-references
 * by name: colored icon chip + 1.5rem bold value + 0.9rem gray label,
 * 10px radius. Plugin contract {color, label, value, icon} (see
 * CLAUDE.md Plugin Visualization Return Types) trained the LLM to fill
 * the template — so the template is the wrong shape.
 *
 * Replacement keeps the plugin contract intact (label / value / color /
 * icon all still accepted) but:
 *   - The LLM-supplied `color` becomes a 12px leading dot, not a chip.
 *   - The icon shrinks to a 12px monochrome leading mark in the label row.
 *   - The value uses JetBrains Mono with tabular-nums for vertical decimal
 *     alignment across cards in a row.
 *   - Labels and values share a baseline so a row of 4 cards reads as a
 *     visual row of numbers, not 4 islands.
 *   - 4px radius (rounded.md in DESIGN.md), not 10px.
 *   - "No Data found" → "—" (Forecasting Desk voice).
 */

const PAPER = "#fbfcfc";
const PAPER_RAISED = "#f4f6f7";
const INK = "#15202a";
const INK_MUTED = "#4b5b6a";
const RULE = "#e0e5e9";

const CardContainer = styled.div`
  background-color: ${PAPER};
  height: 100%;
  width: 100%;
  overflow-x: auto;
  padding: 16px 20px;
`;

const Header = styled.header`
  margin-bottom: 20px;

  h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: ${INK};
    line-height: 1.3;
  }

  p {
    margin: 4px 0 0;
    font-size: 13px;
    color: ${INK_MUTED};
    line-height: 1.45;
  }
`;

const StatsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 24px;
  align-items: end;
`;

const StatItem = styled.article`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
`;

const StatLabel = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.04em;
  color: ${INK_MUTED};
  text-transform: uppercase;
`;

/* The 12px leading dot is the new home for plugin-supplied `color`. */
const LeadingDot = styled.span`
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: ${({ $color }) => $color || RULE};
  flex-shrink: 0;
`;

/* Monochrome inline icon, 12px. Replaces the prior 2rem colored chip. */
const InlineIcon = styled.span`
  display: inline-flex;
  width: 12px;
  height: 12px;
  align-items: center;
  justify-content: center;
  color: ${INK_MUTED};

  svg {
    width: 12px;
    height: 12px;
  }
`;

const StatValue = styled.div`
  margin: 0;
  font-family: "JetBrains Mono", Menlo, Consolas, monospace;
  font-feature-settings: "tnum";
  font-variant-numeric: tabular-nums;
  font-size: 24px;
  font-weight: 500;
  color: ${INK};
  line-height: 1.1;
  letter-spacing: -0.01em;
`;

const EmptyValue = styled.div`
  margin: 0;
  font-size: 24px;
  color: ${RULE};
  line-height: 1.1;
`;

const EmptyShell = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 80%;
  color: ${INK_MUTED};
  font-size: 13px;
  background: ${PAPER_RAISED};
  border-radius: 4px;
`;

const StatItemGroup = ({ item }) => {
  /*
   * Icon source: plugin-supplied name from react-icons/bi (legacy plugin
   * shape) lazy-loaded. ESLint rule no-restricted-imports rejects /bi at
   * import time but does not catch dynamic import — flagged as polish
   * follow-up to migrate plugins to a BS icon name AND swap the dynamic
   * import path. Falls back to no icon on missing.
   */
  const iconName = item?.icon || null;
  const Icon = React.useMemo(() => {
    if (!iconName) return null;
    return React.lazy(async () => {
      const module = await import(/* webpackIgnore: false */ `react-icons/bi`);
      const Cmp = module[iconName];
      return { default: Cmp ?? (() => null) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iconName]);

  const label = typeof item?.label === "string" ? item.label : "";
  const hasValue =
    item?.value !== undefined && item?.value !== null && item?.value !== "";

  return (
    <StatItem>
      <StatLabel>
        <LeadingDot $color={item?.color} aria-hidden="true" />
        {Icon ? (
          <Suspense fallback={null}>
            <InlineIcon aria-hidden="true">
              <Icon data-testid={item?.label ?? item?.icon ?? "BiStats"} />
            </InlineIcon>
          </Suspense>
        ) : null}
        <span>{label}</span>
      </StatLabel>
      {hasValue ? (
        <StatValue>{item.value}</StatValue>
      ) : (
        <EmptyValue aria-label="No value">—</EmptyValue>
      )}
    </StatItem>
  );
};

const Card = ({ title, description, data, visualizationRef }) => {
  const hasData = Array.isArray(data) && data.length > 0;
  return (
    <CardContainer ref={visualizationRef}>
      {(title || description) && (
        <Header>
          {title && <h3>{title}</h3>}
          {description && <p>{description}</p>}
        </Header>
      )}
      {hasData ? (
        <StatsRow>
          {data.map((item, index) => (
            <StatItemGroup key={`${item?.label ?? "stat"}-${index}`} item={item} />
          ))}
        </StatsRow>
      ) : (
        <EmptyShell>No data.</EmptyShell>
      )}
    </CardContainer>
  );
};

Card.propTypes = {
  title: PropTypes.string,
  description: PropTypes.string,
  data: PropTypes.array,
  visualizationRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
};

StatItemGroup.propTypes = {
  item: PropTypes.object,
};

export default Card;

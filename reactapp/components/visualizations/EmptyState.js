import PropTypes from "prop-types";
import styled from "styled-components";

/**
 * EmptyState — shared empty / unavailable / error surface for tile renderers.
 *
 * Extracted from Base.js's `FeaturePendingShell` (the one consistent
 * micro-pattern in the visualizations folder, per the 2026-05-29
 * critique). Migrates the previously-divergent "No Data found" /
 * "No Data Available" / "Failed to get image." / "Failed to load
 * remote: <URL>" surfaces to one Forecasting Desk voice.
 *
 * Slots:
 *   - title (required): short status, ideally <16 chars.
 *   - hint (optional): one-line context. Avoid technical jargon.
 *   - details (optional): collapsed by default behind <details>. URL /
 *     stacktrace / engineering detail lives here, not in the title.
 *   - onRetry (optional): if provided, renders a "Retry" link. Wire to
 *     the existing refresh-count flow in Base.js when migrating.
 *   - variant: "empty" (default, striped) | "error" (warn-tinted) |
 *     "info" (neutral). Empty + error share the same shape; the variant
 *     only changes the background tint so a user scanning a 4-tile
 *     dashboard can spot which tiles have data vs which broke.
 */
const PAPER = "#fbfcfc";
const PAPER_SUNKEN = "#eef1f3";
const INK = "#15202a";
const INK_MUTED = "#4b5b6a";
const WARN = "#c25a14";
const PRIMARY = "#1e6b8b";

const VARIANT_STYLES = {
  empty: {
    background: `repeating-linear-gradient(45deg, ${PAPER}, ${PAPER} 10px, ${PAPER_SUNKEN} 10px, ${PAPER_SUNKEN} 20px)`,
    titleColor: INK,
    hintColor: INK_MUTED,
  },
  error: {
    background: "rgba(194, 90, 20, 0.06)",
    titleColor: WARN,
    hintColor: INK_MUTED,
  },
  info: {
    background: PAPER_SUNKEN,
    titleColor: INK,
    hintColor: INK_MUTED,
  },
};

const Shell = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
  width: 100%;
  padding: 16px;
  text-align: center;
  border-radius: 4px;
  background: ${({ $variant }) => VARIANT_STYLES[$variant].background};
  color: ${({ $variant }) => VARIANT_STYLES[$variant].titleColor};
`;

const Title = styled.div`
  font-weight: 600;
  font-size: 15px;
  line-height: 1.3;
  color: ${({ $variant }) => VARIANT_STYLES[$variant].titleColor};
`;

const Hint = styled.div`
  margin-top: 4px;
  font-size: 13px;
  line-height: 1.45;
  color: ${({ $variant }) => VARIANT_STYLES[$variant].hintColor};
  word-break: break-word;
  max-width: 38ch;
`;

const Details = styled.details`
  margin-top: 12px;
  font-size: 12px;
  color: ${INK_MUTED};
  cursor: pointer;
  max-width: 80%;

  summary {
    cursor: pointer;
    user-select: none;
  }

  pre {
    margin-top: 8px;
    padding: 8px;
    background: ${PAPER};
    border-radius: 4px;
    white-space: pre-wrap;
    word-break: break-all;
    text-align: left;
    font-family: "JetBrains Mono", Menlo, Consolas, monospace;
    font-size: 11px;
    color: ${INK};
  }
`;

const RetryLink = styled.button`
  margin-top: 12px;
  background: none;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  color: ${PRIMARY};
  cursor: pointer;
  font-family: inherit;

  &:hover {
    text-decoration: underline;
  }

  &:focus-visible {
    outline: 2px solid rgba(30, 107, 139, 0.3);
    outline-offset: 2px;
  }
`;

const EmptyState = ({
  title,
  hint,
  details,
  onRetry,
  variant = "empty",
  ...rest
}) => {
  const resolvedVariant = VARIANT_STYLES[variant] ? variant : "empty";
  return (
    <Shell
      $variant={resolvedVariant}
      role={variant === "error" ? "alert" : "status"}
      {...rest}
    >
      <Title $variant={resolvedVariant}>{title}</Title>
      {hint && <Hint $variant={resolvedVariant}>{hint}</Hint>}
      {details && (
        <Details>
          <summary>Details</summary>
          <pre>{details}</pre>
        </Details>
      )}
      {onRetry && (
        <RetryLink type="button" onClick={onRetry}>
          Retry
        </RetryLink>
      )}
    </Shell>
  );
};

EmptyState.propTypes = {
  title: PropTypes.string.isRequired,
  hint: PropTypes.string,
  details: PropTypes.string,
  onRetry: PropTypes.func,
  variant: PropTypes.oneOf(["empty", "error", "info"]),
};

export default EmptyState;

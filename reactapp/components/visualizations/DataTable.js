import PropTypes from "prop-types";
import styled from "styled-components";
import { memo, useMemo } from "react";
import EmptyState from "components/visualizations/EmptyState";

/*
 * DataTable — Forecasting Desk density.
 *
 * Replaces the prior react-bootstrap `<Table striped bordered hover>` +
 * `<h2>` title + `<th>` in body rows. Decisions baked in:
 *
 *   - Bare <table> with subtle row separators only (no zebra, no
 *     gridlines, no hover-stripe).
 *   - Sticky <thead> so column names stay visible when the user scrolls
 *     a long table in a tile.
 *   - Numeric columns get `font-variant-numeric: tabular-nums` + right
 *     alignment. Column-type detection is column-wide: a column is
 *     numeric when every non-null cell is a finite Number. Mixed columns
 *     stay left-aligned.
 *   - Header text is verbatim from the data. No `capitalizePhrase`
 *     (the prior version turned `comid` into `Comid`, disrespecting the
 *     scientist's own column names).
 *   - <th scope="col"> in head only. <td> in body (the prior <th> in
 *     body rows was an a11y regression).
 *   - Title rendered as a tight header — Title type (15px / 600), not
 *     <h2> Bootstrap-default 32px.
 */

const PAPER = "#fbfcfc";
const PAPER_RAISED = "#f4f6f7";
const INK = "#15202a";
const INK_MUTED = "#4b5b6a";
const RULE = "#e0e5e9";

const Wrapper = styled.div`
  height: 100%;
  width: 100%;
  overflow: auto;
  padding: 12px 16px;
  background: ${PAPER};
`;

const Header = styled.header`
  margin-bottom: 8px;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: ${INK};
  line-height: 1.3;
`;

const Subtitle = styled.p`
  margin: 2px 0 0;
  font-size: 12px;
  color: ${INK_MUTED};
  line-height: 1.45;
`;

const StyledTable = styled.table`
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 13px;
  color: ${INK};

  thead th {
    position: sticky;
    top: 0;
    background: ${PAPER_RAISED};
    text-align: left;
    font-weight: 600;
    font-size: 11px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: ${INK_MUTED};
    padding: 6px 10px;
    border-bottom: 1px solid ${RULE};
    white-space: nowrap;
  }

  thead th.numeric {
    text-align: right;
  }

  tbody td {
    padding: 6px 10px;
    border-bottom: 1px solid ${RULE};
    vertical-align: top;
    line-height: 1.45;
  }

  tbody td.numeric {
    text-align: right;
    font-family: "JetBrains Mono", Menlo, Consolas, monospace;
    font-feature-settings: "tnum";
    font-variant-numeric: tabular-nums;
  }

  tbody tr:last-child td {
    border-bottom: none;
  }

  tbody tr:hover td {
    background: ${PAPER_RAISED};
  }
`;

/*
 * detectNumericColumns — a column is numeric iff every non-null cell is
 * a finite Number. Mixed columns (strings + numbers) stay left-aligned
 * proportional. Empty / all-null columns are NOT numeric (no defaulting
 * to right-align on no evidence).
 */
function detectNumericColumns(rows, keys) {
  const numeric = new Set();
  for (const key of keys) {
    let sawAny = false;
    let allNumeric = true;
    for (const row of rows) {
      const v = row?.[key];
      if (v === null || v === undefined || v === "") continue;
      sawAny = true;
      if (typeof v !== "number" || !Number.isFinite(v)) {
        allNumeric = false;
        break;
      }
    }
    if (sawAny && allNumeric) numeric.add(key);
  }
  return numeric;
}

const DataTable = ({ data, title, subtitle, visualizationRef }) => {
  if (!Array.isArray(data) || data.length === 0) {
    return <EmptyState title="No data." />;
  }

  const tableKeys = Object.keys(data[0]);
  const numericKeys = useMemo(
    () => detectNumericColumns(data, tableKeys),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data],
  );

  return (
    <Wrapper ref={visualizationRef}>
      {(title || subtitle) && (
        <Header>
          {title && <Title>{title}</Title>}
          {subtitle && <Subtitle>{subtitle}</Subtitle>}
        </Header>
      )}
      <StyledTable>
        <thead>
          <tr>
            {tableKeys.map((key) => (
              <th
                key={key}
                scope="col"
                className={numericKeys.has(key) ? "numeric" : undefined}
              >
                {key}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr key={index}>
              {tableKeys.map((key) => (
                <td
                  key={key}
                  className={numericKeys.has(key) ? "numeric" : undefined}
                >
                  {row[key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </StyledTable>
    </Wrapper>
  );
};

DataTable.propTypes = {
  data: PropTypes.array,
  title: PropTypes.string,
  subtitle: PropTypes.string,
  visualizationRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
};

export default memo(DataTable);

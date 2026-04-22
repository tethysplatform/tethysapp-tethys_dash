import PropTypes from "prop-types";
import styled from "styled-components";
import { BsExclamationTriangle } from "react-icons/bs";

// Compact fallback for the per-tile ErrorBoundary in DashboardItem.
// Constrained to the enclosing grid cell — the tile's chrome (title bar,
// attribution, CustomAlert siblings) stays intact; only the visualization
// area is replaced. Honors TETHYS_DEBUG_MODE the same way the app-level
// boundary does.

const Wrapper = styled.div`
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 12px;
  box-sizing: border-box;
  color: #6c757d;
  text-align: center;
  overflow: hidden;
`;

const Icon = styled.div`
  font-size: 2rem;
  color: #d9534f;
  margin-bottom: 8px;
`;

const Message = styled.p`
  margin: 0 0 8px;
  font-size: 0.95rem;
  font-weight: 600;
  color: #343a40;
`;

const DebugDetails = styled.pre`
  margin: 8px 0 0;
  padding: 8px;
  width: 100%;
  max-height: 60%;
  overflow: auto;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  font-size: 0.7rem;
  text-align: left;
  white-space: pre-wrap;
  word-break: break-word;
`;

const TileErrorFallback = ({ error, errorInfo }) => {
  const debug = process.env.TETHYS_DEBUG_MODE === "true";
  const errorText = typeof error === "string" ? error : String(error ?? "");
  const stack = errorInfo && errorInfo.componentStack;

  return (
    <Wrapper role="alert" aria-label="visualization-error">
      <Icon>
        <BsExclamationTriangle aria-hidden="true" />
      </Icon>
      <Message>Visualization could not be rendered</Message>
      {debug && (
        <DebugDetails data-testid="tile-error-debug">
          {errorText}
          {stack ? `\n${stack}` : ""}
        </DebugDetails>
      )}
    </Wrapper>
  );
};

TileErrorFallback.propTypes = {
  error: PropTypes.oneOfType([
    PropTypes.instanceOf(Error),
    PropTypes.string,
  ]),
  errorInfo: PropTypes.shape({
    componentStack: PropTypes.string,
  }),
};

export default TileErrorFallback;

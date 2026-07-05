import { useState } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import Form from "react-bootstrap/Form";
import { FaLayerGroup } from "react-icons/fa";

const Container = styled.div`
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
`;

const ToggleButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.9);
  color: #333;
  cursor: pointer;

  &:hover {
    background: #fff;
  }
`;

const Panel = styled.div`
  margin-top: 4px;
  padding: 8px 10px;
  max-height: 70%;
  overflow-y: auto;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
`;

/**
 * Overlay control (top-right corner of the plot) that lists each toggleable
 * subplot as a checkbox. Purely presentational: it owns only its open/closed
 * state; pane visibility state lives in the parent (BasePlot).
 */
const SubplotToggleControl = ({ panes, visiblePaneIds, onToggle }) => {
  const [open, setOpen] = useState(false);

  if (!panes || panes.length < 2) return null;

  const visibleSet = new Set(visiblePaneIds);

  return (
    <Container data-testid="subplot-toggle-control">
      <ToggleButton
        type="button"
        aria-label="Toggle subplots"
        aria-expanded={open}
        title="Show/hide subplots"
        onClick={() => setOpen((o) => !o)}
      >
        <FaLayerGroup />
      </ToggleButton>
      {open && (
        <Panel role="group" aria-label="Subplot visibility">
          {panes.map((pane) => (
            <Form.Check
              key={pane.id}
              type="checkbox"
              id={`subplot-toggle-${pane.id}`}
              label={pane.label}
              aria-label={pane.label}
              checked={visibleSet.has(pane.id)}
              onChange={(e) => onToggle(pane.id, e.target.checked)}
            />
          ))}
        </Panel>
      )}
    </Container>
  );
};

SubplotToggleControl.propTypes = {
  panes: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string,
    }),
  ),
  visiblePaneIds: PropTypes.arrayOf(PropTypes.string),
  onToggle: PropTypes.func.isRequired,
};

export default SubplotToggleControl;

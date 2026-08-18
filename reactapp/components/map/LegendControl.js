import { useState } from "react";
import styled from "styled-components";
import LegendRenderer from "components/map/LegendRenderer";
import FloatingMapControl from "components/map/FloatingMapControl";
import { FaTimes, FaListUl } from "react-icons/fa";
import PropTypes from "prop-types";

// Positioning stays here, on the anchor FloatingMapControl leaves behind, so
// the corner is defined in one place. The control itself is portalled to the
// body: a fill-viewport tile is position:fixed and seals its subtree into a
// stacking context, which no descendant z-index can escape.
const LegendWrapper = styled(FloatingMapControl)`
  position: absolute;
  bottom: 1rem;
  left: 1rem;
`;
const LEGEND_EDGES = ["bottom", "left"];

const LegendControlContainer = styled.div`
  background-color: white;
  padding: ${(props) => (props.$isexpanded ? "10px" : "5px")};
  z-index: 1000;
  border: 1px solid #ccc;
  border-radius: 4px;
  width: ${(props) => (props.$isexpanded ? "13vw" : "40px")};
  max-width: 20vw;
  max-height: 35vh;
  height: ${(props) => (props.$isexpanded ? "auto" : "40px")};
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  position: relative;
  overflow: ${(props) => props.$isexpanded && "auto"};
`;

const ControlButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  font-size: 18px;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  font-size: 18px;
  position: absolute;
  top: 5px;
  right: 5px;
`;

const LegendControl = ({ legendItems }) => {
  const [isexpanded, setisexpanded] = useState(false);

  return (
    <div aria-label="Map Legend">
      {legendItems.filter((item) => item !== null).length > 0 && (
        <LegendWrapper edges={LEGEND_EDGES}>
          <LegendControlContainer
            $isexpanded={isexpanded}
            aria-label="Legend Control"
            className="legend-control"
          >
            {isexpanded ? (
              <>
                <b>Legend</b>
                <CloseButton
                  aria-label="Close Legend Control"
                  onClick={() => setisexpanded(false)}
                >
                  <FaTimes />
                </CloseButton>
                <div
                  style={{
                    marginTop: "20px",
                    width: "100%",
                  }}
                  aria-label="Legend Items"
                  className="legend-items-container"
                >
                  {legendItems.map((legendGroup, groupIndex) => (
                    <LegendRenderer key={groupIndex} legend={legendGroup} />
                  ))}
                </div>
              </>
            ) : (
              // Collapsed control - show the layers icon button
              <ControlButton
                aria-label="Show Legend Control"
                onClick={() => setisexpanded(true)}
              >
                <FaListUl />
              </ControlButton>
            )}
          </LegendControlContainer>
        </LegendWrapper>
      )}
    </div>
  );
};

LegendControl.propTypes = {
  legendItems: PropTypes.arrayOf(
    PropTypes.shape({
      title: PropTypes.string, // Title for layer legend
      items: PropTypes.arrayOf(
        PropTypes.shape({
          label: PropTypes.string, // Label for legend item
          color: PropTypes.string, // Color for legend item
          symbol: PropTypes.string, // Symbol for legend item
        }),
      ),
    }),
  ),
};

export default LegendControl;

import { useContext } from "react";
import Modal from "react-bootstrap/Modal";
import PropTypes from "prop-types";
import styled from "styled-components";
import { AppContext } from "components/contexts/Contexts";
import VisualizationCard from "components/modals/DataViewer/VisualizationCard";
import VisualizationGroup from "components/modals/DataViewer/VisualizationGroup";

const StyledModalBody = styled(Modal.Body)`
  height: 75vh;
  max-height: 75vh;
  overflow-y: auto;
`;

function VisualizationSelector({ showModal, handleModalClose }) {
  const { visualizations } = useContext(AppContext);
  console.log(visualizations);

  return (
    <>
      <Modal
        className="visualization-type-settings"
        show={showModal}
        onHide={handleModalClose}
        aria-label={"Selected Visualization Type Modal"}
      >
        <Modal.Header closeButton>
          <Modal.Title>Available Visualization Types</Modal.Title>
        </Modal.Header>
        <StyledModalBody>
          {visualizations.map(({ label, options }, index) => (
            <VisualizationGroup key={index} title={label}>
              <>
                {options.map((metadata, index) => (
                  <VisualizationCard key={index} {...metadata} />
                ))}
              </>
            </VisualizationGroup>
          ))}
        </StyledModalBody>
      </Modal>
    </>
  );
}

VisualizationSelector.propTypes = {
  showModal: PropTypes.bool,
  handleModalClose: PropTypes.func,
  deselectedVisualizations: PropTypes.arrayOf(PropTypes.string),
  setDeselectedVisualizations: PropTypes.func,
};

export default VisualizationSelector;

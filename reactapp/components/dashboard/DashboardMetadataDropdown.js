import styled from 'styled-components';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import PropTypes from 'prop-types';
import Tooltip from 'react-bootstrap/Tooltip';
import { BsPencilSquare } from "react-icons/bs";
import Dropdown from 'react-bootstrap/Dropdown';
import { useEditingContext } from 'components/contexts/EditingContext';
import { useEditDashboardDimensionModalShowContext } from 'components/contexts/EditDashboardDimensionModalShowContext';
import EditDashboardDimensionsModal from 'components/modals/EditDashboardDimensions'


const StyledDropdown = styled(Dropdown)`
  margin: 0 .5rem;
  display: inline;
`;


const DashboardMetadataDropdown = ({tooltipPlacement, tooltipText}) => {
  const setIsEditing = useEditingContext()[1];
  const [showModal, setShowModal] = useEditDashboardDimensionModalShowContext();

  function editCellDimensions() {
    setShowModal(true)
  }

  function editCellContent() {
    setIsEditing(true)
  }

  const styledDropdown = (
    <StyledDropdown>
        <StyledDropdown.Toggle variant="warning" id="dropdown-basic"  size="sm">
            <BsPencilSquare size="1rem"/>
        </StyledDropdown.Toggle>
        <StyledDropdown.Menu>
            <StyledDropdown.Item onClick={editCellDimensions}>Edit Cell Dimensions</StyledDropdown.Item>
            <StyledDropdown.Item onClick={editCellContent}>Edit Cell Content</StyledDropdown.Item>
        </StyledDropdown.Menu>
    </StyledDropdown>
  )

  const styledButtonWithTooltip = (
    <>
      <OverlayTrigger
        key={tooltipPlacement}
        placement={tooltipPlacement}
        overlay={
          <Tooltip id={`tooltip-${tooltipPlacement}`}>
            {tooltipText}
          </Tooltip>
        }
      >
        {styledDropdown}
      </OverlayTrigger>
      {showModal && <EditDashboardDimensionsModal />}
    </>
  );
  return styledButtonWithTooltip;
}

DashboardMetadataDropdown.propTypes = {
  children: PropTypes.element,
  tooltipPlacement: PropTypes.oneOf(['top', 'bottom', 'left', 'right']),
  tooltipText: PropTypes.string,
  href: PropTypes.string,
};

export default DashboardMetadataDropdown
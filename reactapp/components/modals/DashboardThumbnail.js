import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Alert from "react-bootstrap/Alert";
import { AvailableDashboardsContext } from "components/contexts/Contexts";
import { useState, useContext } from "react";
import TextArea from "components/inputs/TextArea";
import NormalInput from "components/inputs/NormalInput";
import PropTypes from "prop-types";
import styled from "styled-components";

const StyledDiv = styled.div`
  max-height: 50vh;
`;

function DashboardThumbnailModal({
  showModal,
  setShowModal,
  onUpdateThumbnail,
}) {
  const [imageSrc, setImageSrc] = useState(null);

  const handleModalClose = () => {
    setShowModal(false);
  };

  const handleImageChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageSrc(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <Modal
      className="newdashboard"
      contentClassName="newdashboard-content"
      show={showModal}
      onHide={handleModalClose}
      centered
    >
      <Modal.Header closeButton>
        <Modal.Title>Update Dashboard Thumbnail</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <input type="file" accept="image/*" onChange={handleImageChange} />
        {imageSrc && (
          <StyledDiv>
            <img
              src={imageSrc}
              alt="Uploaded"
              style={{ width: "100%", marginTop: "1rem" }}
            />
          </StyledDiv>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="secondary"
          onClick={handleModalClose}
          aria-label={"Close Modal Button"}
        >
          Close
        </Button>
        <Button
          variant="success"
          onClick={() => onUpdateThumbnail(imageSrc)}
          aria-label={"Create Dashboard Button"}
        >
          Create
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

DashboardThumbnailModal.propTypes = {
  showModal: PropTypes.bool,
  setShowModal: PropTypes.func,
};

export default DashboardThumbnailModal;

import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import { useState } from "react";
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
      className="dashboardThumbnail"
      show={showModal}
      onHide={handleModalClose}
      aria-label="Dashboard Thumbnail Modal"
      centered
    >
      <Modal.Header closeButton>
        <Modal.Title>Update Dashboard Thumbnail</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <input
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          data-testid="file-input"
        />
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
          aria-label={"Close Thumbnail Modal Button"}
        >
          Close
        </Button>
        <Button
          variant="success"
          onClick={() => onUpdateThumbnail(imageSrc)}
          aria-label={"Update Thumbnail Button"}
          disabled={!imageSrc}
        >
          Update
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

DashboardThumbnailModal.propTypes = {
  showModal: PropTypes.bool,
  setShowModal: PropTypes.func,
  onUpdateThumbnail: PropTypes.func,
};

export default DashboardThumbnailModal;

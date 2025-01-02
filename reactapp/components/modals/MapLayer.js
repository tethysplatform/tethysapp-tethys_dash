import PropTypes from "prop-types";
import Modal from "react-bootstrap/Modal";
import styled from "styled-components";
import Button from "react-bootstrap/Button";
import DataInput from "components/inputs/DataInput";
import { useState } from "react";
import Alert from "react-bootstrap/Alert";
import "components/modals/wideModal.css";

const StyledModal = styled(Modal)`
  height: 95vh;
`;

const StyledModalHeader = styled(Modal.Header)`
  height: 5%;
`;

const StyledModalBody = styled(Modal.Body)`
  height: 95%;
`;

const layerTypes = [
  "ImageLayer",
  "VectorLayer",
  "ImageTile",
  "ImageArcGISRest",
  "GeoJSON",
];

const MapLayerModal = ({
  showModal,
  handleModalClose,
  addMapLayer,
  existingLayerInfo,
}) => {
  const [url, setUrl] = useState(
    existingLayerInfo.current
      ? existingLayerInfo.current.props.source.props.url
      : ""
  );
  const [layerType, setLayerType] = useState(
    existingLayerInfo.current && existingLayerInfo.current.props.source.type
  );
  const [name, setName] = useState(
    existingLayerInfo.current ? existingLayerInfo.current.props.name : ""
  );
  const [errorMessage, setErrorMessage] = useState(null);

  function saveLayer() {
    if (!url || !layerType || !name) {
      setErrorMessage("All arguments must be filled out to save the layer");
      return;
    }
    addMapLayer({
      type: layerType.includes("Image") ? "ImageLayer" : "VectorLayer",
      props: {
        source: {
          type: layerType,
          props: {
            url: url,
          },
        },
        name: name,
      },
    });
    handleModalClose();
  }

  return (
    <>
      <StyledModal
        show={showModal}
        onHide={handleModalClose}
        className="map-layer"
      >
        <StyledModalHeader closeButton>
          <Modal.Title>Add Map Layer</Modal.Title>
        </StyledModalHeader>
        <StyledModalBody>
          {errorMessage && (
            <Alert key="danger" variant="danger">
              {errorMessage}
            </Alert>
          )}
          <DataInput
            objValue={{
              label: "Layer Type",
              type: layerTypes,
              value: layerType,
            }}
            onChange={(e) => {
              setLayerType(e.value);
            }}
            includeVariableInputs={false}
          />
          <DataInput
            objValue={{ label: "URL", type: "text", value: url }}
            onChange={(e) => {
              setUrl(e);
            }}
          />
          <DataInput
            objValue={{ label: "Name", type: "text", value: name }}
            onChange={(e) => {
              setName(e);
            }}
          />
        </StyledModalBody>
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
            onClick={saveLayer}
            aria-label={"Create Dashboard Button"}
          >
            Create
          </Button>
        </Modal.Footer>
      </StyledModal>
    </>
  );
};

MapLayerModal.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
    PropTypes.object,
  ]),
  showModal: PropTypes.bool,
  handleModalClose: PropTypes.func,
};

export default MapLayerModal;

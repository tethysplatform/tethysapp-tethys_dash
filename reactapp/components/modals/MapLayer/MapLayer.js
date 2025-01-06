import PropTypes from "prop-types";
import Modal from "react-bootstrap/Modal";
import styled from "styled-components";
import Button from "react-bootstrap/Button";
import DataInput from "components/inputs/DataInput";
import { useState, useRef } from "react";
import Alert from "react-bootstrap/Alert";
import Tab from "react-bootstrap/Tab";
import Tabs from "react-bootstrap/Tabs";
import ConfigurationPane from "components/modals/MapLayer/ConfigurationPane";
import LegendPane from "components/modals/MapLayer/LegendPane";
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

const MapLayerModal = ({
  showModal,
  handleModalClose,
  addMapLayer,
  layerInfo,
}) => {
  const [tabKey, setTabKey] = useState("configuration");
  const [errorMessage, setErrorMessage] = useState(null);
  const containerRef = useRef(null);

  function saveLayer() {
    if (
      !layerInfo.current.url ||
      !layerInfo.current.layerType ||
      !layerInfo.current.name
    ) {
      setErrorMessage("All arguments must be filled out to save the layer");
      return;
    }
    addMapLayer({
      type: layerInfo.current.layerType.includes("Image")
        ? "ImageLayer"
        : "VectorLayer",
      props: {
        source: {
          type: layerInfo.current.layerType,
          props: {
            url: layerInfo.current.url,
          },
        },
        name: layerInfo.current.name,
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
          <Tabs
            activeKey={tabKey}
            onSelect={(k) => setTabKey(k)}
            id="map-layer-tabs"
            className="mb-3"
          >
            <Tab
              eventKey="configuration"
              title="Configuration"
              aria-label="layer-configuration-tab"
              className="layer-configuration-tab"
            >
              <ConfigurationPane layerInfo={layerInfo} />
            </Tab>
            <Tab
              eventKey="legend"
              title="Legend"
              aria-label="layer-legend-tab"
              className="layer-legend-tab"
            >
              <div ref={containerRef}>
                <LegendPane layerInfo={layerInfo} containerRef={containerRef} />
              </div>
            </Tab>
            <Tab
              eventKey="attributes"
              title="Attributes"
              aria-label="layer-attributes-tab"
              className="layer-attributes-tab"
            ></Tab>
          </Tabs>
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

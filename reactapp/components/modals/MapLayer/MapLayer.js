import PropTypes from "prop-types";
import Modal from "react-bootstrap/Modal";
import styled from "styled-components";
import Button from "react-bootstrap/Button";
import { useState, useRef, useContext } from "react";
import Alert from "react-bootstrap/Alert";
import Tab from "react-bootstrap/Tab";
import Tabs from "react-bootstrap/Tabs";
import ConfigurationPane from "components/modals/MapLayer/ConfigurationPane";
import LegendPane from "components/modals/MapLayer/LegendPane";
import AttributePane from "components/modals/MapLayer/AttributePane";
import {
  LayoutContext,
  VariableInputsContext,
} from "components/contexts/Contexts";
import { getMapAttributeVariables } from "components/visualizations/utilities";
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
  setLayerInfo,
  mapLayers,
  existingLayerOriginalName,
  gridItemIndex,
}) => {
  const { variableInputValues } = useContext(VariableInputsContext);
  const [tabKey, setTabKey] = useState("configuration");
  const [errorMessage, setErrorMessage] = useState(null);
  const containerRef = useRef(null);
  const { getLayoutContext } = useContext(LayoutContext);
  const { gridItems } = getLayoutContext();

  function saveLayer() {
    setErrorMessage(null);
    if (!layerInfo.url || !layerInfo.layerType || !layerInfo.name) {
      setErrorMessage("All arguments must be filled out to save the layer");
      return;
    }

    // Check to see if the pending attribute variables are valid
    if (layerInfo.attributeVariables) {
      // flatten attribute variables into a list
      const pendingVariableInputs = Object.values(
        layerInfo.attributeVariables
      ).flatMap((value) => Object.values(value));

      // get other variable inputs in the map
      let otherMapLayers;
      if (existingLayerOriginalName.current) {
        // Get all the map layers except the one being edited
        otherMapLayers = mapLayers.current.filter(
          (t) =>
            t.configuration.props.name !== existingLayerOriginalName.current
        );
      } else {
        otherMapLayers = mapLayers.current;
      }
      const otherMapAttributeVariables =
        getMapAttributeVariables(otherMapLayers);

      // check to see if pending variable input names already exist in the other map layers
      const alreadyExistingVariableInputsInMap = pendingVariableInputs.filter(
        (pendingVariableInput) =>
          otherMapAttributeVariables.includes(pendingVariableInput)
      );
      if (alreadyExistingVariableInputsInMap.length > 0) {
        setErrorMessage(
          <>
            <p>The following variable inputs are already in use in the map:</p>
            <ul>
              {alreadyExistingVariableInputsInMap.map(
                (alreadyExistingVariableInput, index) => (
                  <li key={index}>{alreadyExistingVariableInput}</li>
                )
              )}
            </ul>
            <p>
              Check the other map layers and change the Variable Input names in
              the Attributes tab before trying again.
            </p>
          </>
        );
        return;
      }

      // check for duplicate pending variable input names
      const duplicatePendingVariableInputs = pendingVariableInputs.filter(
        (pendingVariableInput, index) =>
          pendingVariableInputs.indexOf(pendingVariableInput) !== index
      );
      if (duplicatePendingVariableInputs.length) {
        setErrorMessage(
          <>
            <p>The following variable inputs are duplicated:</p>
            <ul>
              {duplicatePendingVariableInputs.map(
                (duplicatePendingVariableInput, index) => (
                  <li key={index}>{duplicatePendingVariableInput}</li>
                )
              )}
            </ul>
            <p>
              Change the Variable Input Names in the Attributes tab before
              trying again.
            </p>
          </>
        );
        return;
      }
    }

    addMapLayer({
      configuration: {
        type: layerInfo.layerType.includes("Image")
          ? "ImageLayer"
          : "VectorLayer",
        props: {
          source: {
            type: layerInfo.layerType,
            props: {
              url: layerInfo.url,
              params: layerInfo.params,
            },
            serverType: layerInfo.url.includes("geoserver") && "geoserver",
          },
          name: layerInfo.name,
        },
      },
      legend: layerInfo.legend ?? {},
      attributeVariables: layerInfo.attributeVariables ?? {},
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
              <ConfigurationPane
                layerInfo={layerInfo}
                setLayerInfo={setLayerInfo}
              />
            </Tab>
            <Tab
              eventKey="legend"
              title="Legend"
              aria-label="layer-legend-tab"
              className="layer-legend-tab"
            >
              <div ref={containerRef}>
                <LegendPane
                  layerInfo={layerInfo}
                  setLayerInfo={setLayerInfo}
                  containerRef={containerRef}
                />
              </div>
            </Tab>
            <Tab
              eventKey="attributes"
              title="Attributes"
              aria-label="layer-attributes-tab"
              className="layer-attributes-tab"
            >
              <AttributePane
                layerInfo={layerInfo}
                setLayerInfo={setLayerInfo}
                containerRef={containerRef}
                tabKey={tabKey}
              />
            </Tab>
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

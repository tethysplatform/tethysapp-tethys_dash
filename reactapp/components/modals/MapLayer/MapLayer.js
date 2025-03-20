import PropTypes from "prop-types";
import Modal from "react-bootstrap/Modal";
import styled from "styled-components";
import Button from "react-bootstrap/Button";
import { useState, useRef, useContext } from "react";
import Alert from "react-bootstrap/Alert";
import Tab from "react-bootstrap/Tab";
import Tabs from "react-bootstrap/Tabs";
import LayerPane from "components/modals/MapLayer/LayerPane";
import SourcePane from "components/modals/MapLayer/SourcePane";
import LegendPane from "components/modals/MapLayer/LegendPane";
import AttributesPane from "components/modals/MapLayer/AttributesPane";
import StylePane from "components/modals/MapLayer/StylePane";
import { AppContext } from "components/contexts/Contexts";
import {
  sourcePropertiesOptions,
  getMapAttributeVariables,
  layerPropType,
  omittedPopupAttributesPropType,
  attributeVariablesPropType,
  legendPropType,
  sourcePropType,
  saveLayerJSON,
} from "components/map/utilities";
import {
  removeEmptyValues,
  checkRequiredKeys,
} from "components/modals/utilities";
import "components/modals/wideModal.css";

const StyledModalHeader = styled(Modal.Header)`
  height: 7%;
`;

const StyledModalBody = styled(Modal.Body)`
  max-height: 70vh;
  height: 70vh;
  overflow-y: auto;
`;

const StyledAlert = styled(Alert)`
  left: 0;
  position: absolute;
  margin-left: 1rem;
  max-width: 75%;
`;

const MapLayerModal = ({
  showModal,
  handleModalClose,
  addMapLayer,
  layerInfo,
  mapLayers,
  existingLayerOriginalName,
}) => {
  const [tabKey, setTabKey] = useState("layer");
  const [errorMessage, setErrorMessage] = useState(null);
  const [sourceProps, setSourceProps] = useState(layerInfo.sourceProps ?? {});
  const [layerProps, setLayerProps] = useState(layerInfo.layerProps ?? {});
  const [style, setStyle] = useState(layerInfo.style);
  const [legend, setLegend] = useState(layerInfo.legend);
  const [attributeVariables, setAttributeVariables] = useState(
    layerInfo.attributeVariables
  );
  const [omittedPopupAttributes, setOmittedPopupAttributes] = useState(
    layerInfo.omittedPopupAttributes
  );
  const containerRef = useRef(null);
  const { csrf } = useContext(AppContext);

  async function saveLayer() {
    setErrorMessage(null);
    if (!sourceProps.type || !layerProps.name) {
      setErrorMessage(
        "Layer type and name must be provided in the configuration pane."
      );
      return;
    }

    const validSourceProps = removeEmptyValues(sourceProps.props);
    const validLayerProps = removeEmptyValues(layerProps);
    const missingRequiredProps = checkRequiredKeys(
      sourcePropertiesOptions[sourceProps.type].required,
      validSourceProps
    );
    if (missingRequiredProps.length > 0) {
      setErrorMessage(
        `Missing required ${missingRequiredProps} arguments. Please check the configuration and try again.`
      );
      return;
    }

    const minAttributeVariables = removeEmptyValues(attributeVariables);
    // Check to see if the pending attribute variables are valid
    if (Object.keys(minAttributeVariables).length > 0) {
      // flatten attribute variables into a list
      const pendingVariableInputs = Object.values(
        minAttributeVariables
      ).flatMap((value) => Object.values(value));

      // get other variable inputs in the map
      let otherMapLayers;
      if (existingLayerOriginalName.current) {
        // Get all the map layers except the one being edited
        otherMapLayers = mapLayers.filter(
          (t) =>
            t.configuration.props.name !== existingLayerOriginalName.current
        );
      } else {
        otherMapLayers = mapLayers;
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

    if (sourceProps.type === "VectorTile") {
      validSourceProps.urls = validSourceProps.urls.split(",");
    }

    const mapConfiguration = {
      configuration: {
        type:
          sourceProps.type === "VectorTile"
            ? "VectorTileLayer"
            : sourceProps.type.includes("Tile")
              ? "TileLayer"
              : sourceProps.type.includes("Image")
                ? "ImageLayer"
                : "VectorLayer",
        props: {
          ...validLayerProps,
          source: {
            type: sourceProps.type,
            props: validSourceProps,
          },
        },
      },
    };

    if (Object.keys(minAttributeVariables).length > 0) {
      mapConfiguration.attributeVariables = minAttributeVariables;
    }

    if (Object.keys(omittedPopupAttributes).length > 0) {
      mapConfiguration.omittedPopupAttributes = omittedPopupAttributes;
    }

    if (legend && Object.keys(legend).length > 0) {
      if (legend.title === "") {
        setErrorMessage(
          "Provide a legend title if showing a legend for this layer"
        );
        return;
      }

      //check if any key in the object is empty
      const hasEmptyValues = (obj) => {
        return Object.values(obj).some(
          (value) => value === "" || value === null || value === undefined
        );
      };

      if (legend.items.some(hasEmptyValues)) {
        setErrorMessage(
          "All Legend Items must have a label, color, and symbol"
        );
        return;
      }
      mapConfiguration.legend = legend;
    }

    if (sourceProps.type === "GeoJSON") {
      const apiResponse = await saveLayerJSON({
        stringJSON: sourceProps.geojson,
        csrf,
        check_crs: true,
      });
      if (!apiResponse.success) {
        setErrorMessage(
          apiResponse.message ??
            "Failed to upload the json data. Check logs for more information."
        );
        return;
      }
      mapConfiguration.configuration.props.source.props = {};
      mapConfiguration.configuration.props.source.geojson =
        apiResponse.filename;
    }

    if (style && style !== "{}") {
      const apiResponse = await saveLayerJSON({ stringJSON: style, csrf });
      if (!apiResponse.success) {
        setErrorMessage(
          apiResponse.message ??
            "Failed to upload the json data. Check logs for more information."
        );
        return;
      }
      mapConfiguration.configuration.style = apiResponse.filename;
    }

    addMapLayer(mapConfiguration);
    handleModalClose();
  }

  return (
    <>
      <Modal
        show={showModal}
        onHide={handleModalClose}
        className="map-layer"
        dialogClassName="fiftyWideModalDialog"
        contentClassName="mapLayerContent"
      >
        <StyledModalHeader closeButton>
          <Modal.Title>Add Map Layer</Modal.Title>
        </StyledModalHeader>
        <StyledModalBody>
          <Tabs
            activeKey={tabKey}
            onSelect={(k) => setTabKey(k)}
            id="map-layer-tabs"
            className="mb-3"
          >
            <Tab
              eventKey="layer"
              title="Layer"
              aria-label="layer-tab"
              className="layer-tab"
            >
              <LayerPane
                layerProps={layerProps}
                setLayerProps={setLayerProps}
              />
            </Tab>
            <Tab
              eventKey="source"
              title="Source"
              aria-label="layer-source-tab"
              className="layer-source-tab"
            >
              <SourcePane
                sourceProps={sourceProps}
                setSourceProps={setSourceProps}
                setAttributeVariables={setAttributeVariables}
                setOmittedPopupAttributes={setOmittedPopupAttributes}
              />
            </Tab>
            <Tab
              eventKey="style"
              title="Style"
              aria-label="layer-style-tab"
              className="layer-style-tab"
            >
              <StylePane style={style} setStyle={setStyle} />
            </Tab>
            <Tab
              eventKey="legend"
              title="Legend"
              aria-label="layer-legend-tab"
              className="layer-legend-tab"
            >
              <div ref={containerRef}>
                <LegendPane
                  legend={legend}
                  setLegend={setLegend}
                  containerRef={containerRef}
                />
              </div>
            </Tab>
            <Tab
              eventKey="attributes"
              title="Attributes/Popup"
              aria-label="layer-attributes-tab"
              className="layer-attributes-tab"
            >
              <AttributesPane
                attributeVariables={attributeVariables}
                setAttributeVariables={setAttributeVariables}
                omittedPopupAttributes={omittedPopupAttributes}
                setOmittedPopupAttributes={setOmittedPopupAttributes}
                sourceProps={sourceProps}
                layerProps={layerProps}
                tabKey={tabKey}
              />
            </Tab>
          </Tabs>
        </StyledModalBody>
        <Modal.Footer>
          {errorMessage && (
            <StyledAlert
              key="danger"
              variant="danger"
              dismissible
              onClose={() => setErrorMessage("")}
            >
              {errorMessage}
            </StyledAlert>
          )}
          <Button
            variant="secondary"
            onClick={handleModalClose}
            aria-label={"Close Layer Modal Button"}
          >
            Close
          </Button>
          <Button
            variant="success"
            onClick={saveLayer}
            aria-label={"Create Layer Button"}
          >
            Create
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

MapLayerModal.propTypes = {
  showModal: PropTypes.bool, // state for showing map layer modal
  handleModalClose: PropTypes.func, // callback function for when map layer modal closes
  addMapLayer: PropTypes.func, // callback function for adding map layer to the addMapLayer Input
  // contain information about the layer for each tab in the modal
  layerInfo: PropTypes.shape({
    sourceProps: sourcePropType,
    layerProps: PropTypes.shape({
      name: PropTypes.string,
    }), // an object of layer properties like opacity, zoom, etc. see components/map/utilities.js (layerPropertiesOptions) for examples
    legend: legendPropType,
    style: PropTypes.string, // name of .json file that is save with the application that contain the actual style json
    attributeVariables: attributeVariablesPropType,
    omittedPopupAttributes: omittedPopupAttributesPropType,
  }),
  mapLayers: PropTypes.arrayOf(layerPropType),
  existingLayerOriginalName: PropTypes.shape({
    current: PropTypes.any,
  }),
};

export default MapLayerModal;

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
import AttributesPane from "components/modals/MapLayer/AttributesPane";
import StylePane from "components/modals/MapLayer/StylePane";
import { AppContext } from "components/contexts/Contexts";
import { getMapAttributeVariables } from "components/visualizations/utilities";
import { layerTypeProperties } from "components/map/utilities";
import {
  removeEmptyStringsFromObject,
  extractVariableInputNames,
  extractOmittedPopupAttributes,
} from "components/modals/utilities";
import { v4 as uuidv4 } from "uuid";
import appAPI from "services/api/app";
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

const findMissingKeys = (templateObj, dataObj, parentKey = "") => {
  let invalidKeys = [];

  for (const [key, value] of Object.entries(templateObj)) {
    const fullKey = parentKey ? `${parentKey}.${key}` : key; // Build full key path

    if (!(key in dataObj)) {
      invalidKeys.push(fullKey); // Add missing key to the list
    } else if (typeof value === "object" && value !== null) {
      // Recursively check nested objects
      invalidKeys = invalidKeys.concat(
        findMissingKeys(value, dataObj[key], fullKey)
      );
    }
  }

  return invalidKeys;
};

const MapLayerModal = ({
  showModal,
  handleModalClose,
  addMapLayer,
  layerInfo,
  mapLayers,
  existingLayerOriginalName,
}) => {
  const [tabKey, setTabKey] = useState("configuration");
  const [errorMessage, setErrorMessage] = useState(null);
  const [configuration, setConfiguration] = useState(layerInfo.configuration);
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
    if (!configuration.layerType || !configuration.name) {
      setErrorMessage(
        "Layer type and name must be provided in the configuration pane."
      );
      return;
    }

    const validSourceProps = removeEmptyStringsFromObject(
      configuration.sourceProps
    );
    const missingRequiredProps = findMissingKeys(
      layerTypeProperties[configuration.layerType].required,
      validSourceProps
    );
    if (missingRequiredProps.length > 0) {
      setErrorMessage(
        `Missing required ${missingRequiredProps} arguments. Please check the configuration and try again.`
      );
      return;
    }

    // Check to see if the pending attribute variables are valid
    if (attributeVariables) {
      const minAttributeVariables =
        extractVariableInputNames(attributeVariables);

      // flatten attribute variables into a list
      const pendingVariableInputs = Object.values(
        minAttributeVariables
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

    if (
      configuration.layerType === "VectorTile" &&
      typeof validSourceProps.urls === "string"
    ) {
      validSourceProps.urls = validSourceProps.urls.split(",");
    }

    const mapConfiguration = {
      configuration: {
        type:
          configuration.layerType === "VectorTile"
            ? "VectorTileLayer"
            : configuration.layerType.includes("Tile")
              ? "TileLayer"
              : configuration.layerType.includes("Image")
                ? "ImageLayer"
                : "VectorLayer",
        props: {
          source: {
            type: configuration.layerType,
            props: validSourceProps,
          },
          name: configuration.name,
        },
      },
      legend: legend ?? {},
      attributeVariables: attributeVariables ?? {},
      omittedPopupAttributes: omittedPopupAttributes ?? {},
    };

    let geoJSON;
    if (configuration.layerType === "GeoJSON") {
      try {
        geoJSON = JSON.parse(configuration.geojson);
      } catch (err) {
        setErrorMessage(
          <>
            Invalid GeoJSON is being used. Please alter the json and try again.
            <br />
            <br />
            {err.message}
          </>
        );
        return;
      }

      if (!geoJSON?.crs?.properties?.name) {
        setErrorMessage(
          'GeoJSON must include a crs key with the structure {"properties": {"name": "EPSG:<CODE>"}}'
        );
        return;
      }

      const geoJSONFilename = `${uuidv4()}.json`;
      const geoJSONInfo = {
        data: configuration.geojson,
        filename: geoJSONFilename,
      };
      const apiResponse = await appAPI.uploadJSON(geoJSONInfo, csrf);
      if (!apiResponse.success) {
        setErrorMessage(
          "Failed to upload the json data. Check logs for more information."
        );
        return;
      }
      mapConfiguration.configuration.props.source.props = {};
      mapConfiguration.configuration.props.source.filename = geoJSONFilename;
    }

    if (style && style !== "{}") {
      try {
        JSON.parse(style);
      } catch (err) {
        setErrorMessage(
          <>
            Invalid style json is being used. Please alter the json and try
            again.
            <br />
            <br />
            {err.message}
          </>
        );
        return;
      }

      const styleJSONFilename = `${uuidv4()}.json`;
      const styleJSONInfo = {
        data: style,
        filename: styleJSONFilename,
      };
      const apiResponse = await appAPI.uploadJSON(styleJSONInfo, csrf);
      if (!apiResponse.success) {
        setErrorMessage(
          "Failed to upload the json data. Check logs for more information."
        );
        return;
      }
      mapConfiguration.style = styleJSONFilename;
    }

    addMapLayer(mapConfiguration);
    handleModalClose();
  }

  return (
    <>
      <StyledModal
        show={showModal}
        onHide={handleModalClose}
        className="map-layer"
        dialogClassName="fiftyWideModalDialog"
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
              eventKey="configuration"
              title="Configuration"
              aria-label="layer-configuration-tab"
              className="layer-configuration-tab"
            >
              <ConfigurationPane
                configuration={configuration}
                setConfiguration={setConfiguration}
                setAttributeVariables={setAttributeVariables}
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
                configuration={configuration}
                tabKey={tabKey}
              />
            </Tab>
          </Tabs>
        </StyledModalBody>
        <Modal.Footer>
          {errorMessage && (
            <Alert
              key="danger"
              variant="danger"
              dismissible
              onClose={() => setErrorMessage("")}
            >
              {errorMessage}
            </Alert>
          )}
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

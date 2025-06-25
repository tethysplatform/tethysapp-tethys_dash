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
  layerPropType,
  legendPropType,
  sourcePropType,
  attributePropsPropType,
  saveLayerJSON,
} from "components/map/utilities";
import {
  removeEmptyValues,
  checkRequiredKeys,
} from "components/modals/utilities";
import Select from "react-select";
import appAPI from "services/api/app";
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

const FooterContent = styled.div`
  display: flex;
  justify-content: space-between; /* spreads items out */
  align-items: center;
  width: 100%;
  gap: 1rem;
  flex-wrap: wrap; /* allows responsiveness */
`;

const LeftGroup = styled.div`
  flex: 1;
  display: flex;
  gap: 0.5rem;
  align-items: center;
`;

const RightGroup = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
`;

const MapLayerModal = ({
  showModal,
  handleModalClose,
  addMapLayer,
  layerInfo,
}) => {
  const [tabKey, setTabKey] = useState("layer");
  const [errorMessage, setErrorMessage] = useState(null);
  const [sourceProps, setSourceProps] = useState(layerInfo.sourceProps ?? {});
  const [layerProps, setLayerProps] = useState(layerInfo.layerProps ?? {});
  const [attributeProps, setAttributeProps] = useState(
    layerInfo.attributeProps ?? {}
  );
  const [style, setStyle] = useState(layerInfo.style);
  const [legend, setLegend] = useState(layerInfo.legend);
  const [selectedOption, setSelectedOption] = useState(null);
  const containerRef = useRef(null);
  const { csrf, mapLayerTemplates } = useContext(AppContext);

  async function saveLayer() {
    setErrorMessage(null);
    if (!sourceProps.type || !layerProps.name) {
      setErrorMessage(
        "Layer type and name must be provided in the configuration pane."
      );
      return;
    }

    const { layerVisibility, ...layerProperties } = layerProps;
    const validSourceProps = removeEmptyValues(sourceProps.props);
    const validLayerProps = removeEmptyValues(layerProperties);
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

    if (sourceProps.type === "Vector Tile") {
      validSourceProps.urls = validSourceProps.urls.split(",");
    }

    const mapConfiguration = {
      configuration: {
        type:
          sourceProps.type === "Vector Tile"
            ? "VectorTileLayer"
            : sourceProps.type.includes("Tile")
              ? "TileLayer"
              : sourceProps.type.includes("Image") ||
                  sourceProps.type.includes("WMS")
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

    const minAttributeVariables = removeEmptyValues(
      attributeProps.variables ?? {}
    );

    const minAttributeAliases = removeEmptyValues(attributeProps.aliases ?? {});

    if (layerVisibility === false) {
      mapConfiguration.configuration.layerVisibility = false;
    }

    if (Object.keys(minAttributeAliases).length > 0) {
      mapConfiguration.attributeAliases = attributeProps.aliases;
    }

    if (Object.keys(minAttributeVariables).length > 0) {
      mapConfiguration.attributeVariables = minAttributeVariables;
    }

    if (Object.keys(attributeProps.omitted ?? []).length > 0) {
      mapConfiguration.omittedPopupAttributes = attributeProps.omitted;
    }

    if (attributeProps.queryable === false) {
      mapConfiguration.queryable = false;
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

  const onLayoutChange = async (e) => {
    setSelectedOption(e);
    const apiResponse = await appAPI.getPlotData({
      source: e.source,
      args: {},
    });

    const attributeVariables = apiResponse.data.attributeVariables ?? {};
    const attributeAliases = apiResponse.data.attributeAliases ?? {};
    const omittedPopupAttributes =
      apiResponse.data.omittedPopupAttributes ?? {};
    const queryableLayer = apiResponse.data.queryable === false ? false : true;
    const updatedLayerProps = Object.fromEntries(
      Object.entries(apiResponse.data.configuration.props).filter(
        ([key]) => key !== "source"
      )
    );
    updatedLayerProps.layerVisibility =
      apiResponse.data.configuration.layerVisibility;

    setSourceProps(apiResponse.data.configuration.props.source);
    setLayerProps(updatedLayerProps);
    setAttributeProps({
      variables: attributeVariables,
      omitted: omittedPopupAttributes,
      aliases: attributeAliases,
      queryable: queryableLayer,
    });
    setStyle(JSON.stringify(apiResponse.data.configuration.style));
    setLegend(apiResponse.data.legend);
  };

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
                setAttributeProps={setAttributeProps}
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
                attributeProps={attributeProps}
                setAttributeProps={setAttributeProps}
                sourceProps={sourceProps}
                layerProps={layerProps}
                tabKey={tabKey}
              />
            </Tab>
          </Tabs>
        </StyledModalBody>
        <Modal.Footer>
          <FooterContent>
            <LeftGroup>
              <label htmlFor="layer-templates" style={{ fontWeight: "bold" }}>
                Layer Templates
              </label>
              <Select
                inputId="layer-templates"
                menuPlacement="top"
                options={mapLayerTemplates}
                value={selectedOption}
                onChange={onLayoutChange}
                aria-label={"Layer Templates Input"}
                styles={{
                  control: (base) => ({
                    ...base,
                    minWidth: "100%",
                  }),
                  container: (base) => ({
                    ...base,
                    flex: 0.5,
                  }),
                }}
              />
            </LeftGroup>
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
            <RightGroup>
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
            </RightGroup>
          </FooterContent>
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
    attributeProps: attributePropsPropType,
  }),
  mapLayers: PropTypes.arrayOf(layerPropType),
  existingLayerOriginalName: PropTypes.shape({
    current: PropTypes.any,
  }),
};

export default MapLayerModal;

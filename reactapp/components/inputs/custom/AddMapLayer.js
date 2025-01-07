import { useState, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import styled from "styled-components";
import MapLayerModal from "components/modals/MapLayer/MapLayer";
import DraggableList from "components/inputs/DraggableList";

const StyledDiv = styled.div`
  overflow-x: auto;
  white-space: nowrap;
  width: fit-content;
  border: 1px solid #ccc;
  margin-right: 0.5rem;
  padding-right: 0;
  background-color: #b8eeff;
  margin: 0.25rem auto;
`;
const StyledButton = styled.button`
  margin-left: 0.5rem;
  border: none;
  background-color: white;
`;

/**
 * A component template that will be used to create and handle map layers for the
 * draggable list.
 *
 * @param {object} mapLayer - The map layer object that contains layer metadata.
 * structured as:
 * {
 *   type: <string>,
 *     props: {
 *       source: {
 *         type: <string>,
 *         props: {
 *           url: <string>,
 *         },
 *       },
 *       name: <string>,
 *     },
 *   },
 *   legend: <array>,
 * }
 * @param {object} draggingProps - The properties from the DraggableList input to allow dragging functionality
 * @param {React Ref} mapLayers - A react ref that tracks all the available map layers
 * @param {function} onChange - A drilled property from dataviewer. This onchange
 *   function will handle what is being passed to the dataviewer for the overall configured map visualization
 * @param {React Ref} layerInfo - A react ref that tracks a map layer that is being edited.
 * @param {React Ref} existingLayerOriginalName - A react ref that tracks the original name of map layer that is being edited.
 * @param {function} setShowMapLayerModal - A function that controls the visibility of the Map Layer Modal
 *
 *
 * @returns {JSX.Element} - A rendered div with map layer name, delete button, and edit button
 */
const MapLayerTemplate = ({
  value: mapLayer,
  draggingProps,
  mapLayers,
  onChange,
  layerInfo,
  existingLayerOriginalName,
  setShowMapLayerModal,
}) => {
  const removeMapLayer = (mapLayerName) => {
    // Get all map layers except the given mapLayerName
    const updatedMapLayers = mapLayers.current.filter(
      (t) => t.configuration.props.name !== mapLayerName
    );

    // Update tracked mapLayers for custom input
    mapLayers.current = updatedMapLayers;

    // Update visualization args for dataviewer
    onChange(updatedMapLayers);
  };

  const editMapLayer = (mapLayerName) => {
    // Get the map layer with the given mapLayerName
    const existingMapLayer = mapLayers.current.find(
      (t) => t.configuration.props.name === mapLayerName
    );

    // Set the layerInfo and existingLayerOriginalName to the specified mapLayer
    layerInfo.current = {
      layerType: existingMapLayer.configuration.props.source.type,
      url: existingMapLayer.configuration.props.source.props.url,
      name: existingMapLayer.configuration.props.name,
      legend: existingMapLayer.legend,
    };
    existingLayerOriginalName.current =
      existingMapLayer.configuration.props.name;

    // Open the Map Layer Modal now that the layerInfo has been updated and will show that information
    setShowMapLayerModal(true);
  };

  return (
    <StyledDiv {...draggingProps}>
      {mapLayer.configuration.props.name}
      <StyledButton
        onClick={() => removeMapLayer(mapLayer.configuration.props.name)}
        title={`Remove ${mapLayer.configuration.props.name}`}
      >
        x
      </StyledButton>
      <StyledButton
        onClick={() => editMapLayer(mapLayer.configuration.props.name)}
        title={`Edit ${mapLayer.configuration.props.name}`}
      >
        edit
      </StyledButton>
    </StyledDiv>
  );
};

/**
 * A custom input component to handle creating and editing map layers
 *
 * @param {function} onChange - A function will handle what is being passed to the dataviewer for the overall configured map visualization
 * @param {React Ref} values - The existing values passed from the dataviewer and configured map visualization.
 * @param {function} setShowingSubModal - A function that indicates to parent modals that a submodal is showing and therefore a change in zindex is needed for the submodal focusing
 *
 *
 * @returns {JSX.Element} - A rendered div with an add layer button and a draggable list of configured layers
 */
export const AddMapLayer = ({ onChange, values, setShowingSubModal }) => {
  const [showMapLayerModal, setShowMapLayerModal] = useState(false);
  const mapLayers = useRef(values ?? []);
  const layerInfo = useRef({});
  let existingLayerOriginalName = useRef();

  useEffect(() => {
    setShowingSubModal(showMapLayerModal);
  }, [showMapLayerModal]);

  /**
   * Add or Update a map layer when the user saves a configuration from the MapLayer modal.
   *
   * @param {object} newMapLayer - The text displayed on the button.
   * structured as:
   * {
   *   type: <string>,
   *     props: {
   *       source: {
   *         type: <string>,
   *         props: {
   *           url: <string>,
   *         },
   *       },
   *       name: <string>,
   *     },
   *   },
   *   legend: <array>,
   * }
   */
  const addMapLayer = (newMapLayer) => {
    let updatedMapLayers = mapLayers.current;

    // Check to see if existingLayerOriginalName is set and therefore see if a layer is being updated instead of being created
    if (existingLayerOriginalName.current) {
      // Get the map layer with the original name before it was edited
      const originalMapLayer = mapLayers.current.find(
        (t) => t.configuration.props.name === existingLayerOriginalName.current
      );

      // Find the index of the original map layer in the mapLayer array
      const originalMapLayerIndex = mapLayers.current.indexOf(originalMapLayer);

      // Get all the map layers except for the original map layer that was edited
      updatedMapLayers = mapLayers.current.filter(
        (t) => t.configuration.props.name !== existingLayerOriginalName.current
      );

      // Add the newly created map layer in the same index as the original
      updatedMapLayers.splice(originalMapLayerIndex, 0, newMapLayer);
    } else {
      updatedMapLayers.push(newMapLayer);
    }

    // Update tracked mapLayers for custom input
    mapLayers.current = updatedMapLayers;

    // Update visualization args for dataviewer
    onChange(updatedMapLayers);
  };

  /**
   * Callback function for when a user rearranges the order of the map layers
   *
   * @param {array} reorderedMapLayers - An array of map layers in a new order
   */
  const onOrderUpdate = (reorderedMapLayers) => {
    // Update tracked mapLayers for custom input
    mapLayers.current = reorderedMapLayers;

    // Update visualization args for dataviewer
    onChange(updatedMapLayers);
  };

  function openMapLayerModal() {
    setShowMapLayerModal(true);
  }

  function handleMapLayerModalClose() {
    // Reset layerInfo and existingLayerOriginalName since a map layer is no longer being edited
    layerInfo.current = {};
    existingLayerOriginalName.current = null;
    setShowMapLayerModal(false);
  }

  const templateArgs = {
    mapLayers,
    onChange,
    layerInfo,
    existingLayerOriginalName,
    setShowMapLayerModal,
  };

  return (
    <>
      <Container>
        <Row className="mb-1">
          <button onClick={openMapLayerModal}>Add Layer</button>
          <br />
        </Row>
        <DraggableList
          items={mapLayers.current}
          onOrderUpdate={onOrderUpdate}
          ItemTemplate={MapLayerTemplate}
          templateArgs={templateArgs}
        />
      </Container>
      {showMapLayerModal && (
        <MapLayerModal
          showModal={showMapLayerModal}
          handleModalClose={handleMapLayerModalClose}
          addMapLayer={addMapLayer}
          layerInfo={layerInfo}
        />
      )}
    </>
  );
};

MapLayerTemplate.propTypes = {
  value: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.string,
    PropTypes.bool,
    PropTypes.object,
    PropTypes.array,
  ]).isRequired,
  draggingProps: PropTypes.shape({
    key: PropTypes.number.isRequired,
    onDragStart: PropTypes.func.isRequired,
    onDragEnd: PropTypes.func.isRequired,
    onDragOver: PropTypes.func.isRequired,
    onDrop: PropTypes.func.isRequired,
    draggable: PropTypes.string.isRequired,
  }).isRequired,
  mapLayers: PropTypes.shape({
    current: PropTypes.arrayOf(
      PropTypes.shape({
        type: PropTypes.string.isRequired,
        props: PropTypes.shape({
          source: PropTypes.shape({
            type: PropTypes.string.isRequired,
            props: PropTypes.shape({
              url: PropTypes.string.isRequired,
            }),
          }),
          type: PropTypes.string.isRequired,
        }),
        legend: PropTypes.arrayOf(
          PropTypes.shape({
            color: PropTypes.string.isRequired,
            label: PropTypes.string.isRequired,
          })
        ),
      })
    ),
  }).isRequired,
  onChange: PropTypes.func,
  layerInfo: PropTypes.shape({
    current: PropTypes.shape({
      layerType: PropTypes.string.isRequired,
      url: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      legend: PropTypes.arrayOf(
        PropTypes.shape({
          color: PropTypes.string.isRequired,
          label: PropTypes.string.isRequired,
        })
      ),
    }),
  }),
  existingLayerOriginalName: PropTypes.shape({
    current: PropTypes.string.isRequired,
  }),
  setShowMapLayerModal: PropTypes.func.isRequired,
};

AddMapLayer.propTypes = {
  onChange: PropTypes.func,
  values: PropTypes.array,
  setShowingSubModal: PropTypes.func,
};

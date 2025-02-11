import { useState, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import Table from "react-bootstrap/Table";
import styled from "styled-components";
import MapLayerModal from "components/modals/MapLayer/MapLayer";
import DraggableList from "components/inputs/DraggableList";
import Button from "react-bootstrap/Button";
import { valuesEqual } from "components/modals/utilities";
import { BsPencilSquare, BsTrash } from "react-icons/bs";
import { RxDragHandleHorizontal } from "react-icons/rx";

const FixedTable = styled(Table)`
  table-layout: fixed;
  font-size: small;
`;

const InLineDiv = styled.div`
  display: inline-block;
  float: ${(props) => props?.float && props.float};
`;

const OverflowTD = styled.td`
  overflow-x: auto;
`;

const RedTrashIcon = styled(BsTrash)`
  color: red;
`;
const BlueEditIcon = styled(BsPencilSquare)`
  color: blue;
`;
const MarginButton = styled(Button)`
  margin-bottom: 1rem;
`;
const AlignedDragHandle = styled(RxDragHandleHorizontal)`
  margin: auto;
`;

const MapLayerTemplate = ({
  value,
  draggingProps,
  mapLayers,
  setMapLayers,
  onChange,
  setLayerInfo,
  existingLayerOriginalName,
  setShowMapLayerModal,
}) => {
  const removeMapLayer = (mapLayerName) => {
    // Get all map layers except the given mapLayerName
    const updatedMapLayers = mapLayers.filter(
      (t) => t.configuration.props.name !== mapLayerName
    );

    // Update tracked mapLayers for custom input
    setMapLayers(updatedMapLayers);

    // Update visualization args for dataviewer
    onChange(updatedMapLayers);
  };

  const editMapLayer = (mapLayerName) => {
    // Get the map layer with the given mapLayerName
    const existingMapLayer = mapLayers.find(
      (t) => t.configuration.props.name === mapLayerName
    );

    // Set the layerInfo and existingLayerOriginalName to the specified mapLayer
    setLayerInfo({
      sourceProps: existingMapLayer.configuration.props.source,
      layerProps: Object.fromEntries(
        Object.entries(existingMapLayer.configuration.props).filter(
          ([key]) => key !== "source"
        )
      ),
      legend: existingMapLayer.legend,
      style: existingMapLayer.style,
      attributeVariables: existingMapLayer.attributeVariables ?? {}, // {layerName: {"field1": "Variable Name 1"}}
      omittedPopupAttributes: existingMapLayer.omittedPopupAttributes ?? {}, // {layerName: ["field1", "field2"]}
    });
    existingLayerOriginalName.current =
      existingMapLayer.configuration.props.name;

    // Open the Map Layer Modal now that the layerInfo has been updated and will show that information
    setShowMapLayerModal(true);
  };
  const { key, ...otherDraggingProps } = draggingProps;

  return (
    <tr key={key} {...otherDraggingProps}>
      <td>
        <AlignedDragHandle size={"1rem"} />
      </td>
      <OverflowTD
        className="text-center"
        data-testid={`${value.configuration.props.name} layerItem`}
      >
        {value.configuration.props.name}
      </OverflowTD>
      <OverflowTD className="text-center">
        {value.legend ? "On" : "Off"}
      </OverflowTD>
      <td>
        <InLineDiv
          data-testid="removeMapLayer"
          onClick={() => removeMapLayer(value.configuration.props.name)}
        >
          <RedTrashIcon size={"1rem"} />
        </InLineDiv>
        <InLineDiv
          data-testid="editMapLayer"
          float={"right"}
          onClick={() => editMapLayer(value.configuration.props.name)}
        >
          <BlueEditIcon size={"1rem"} />
        </InLineDiv>
      </td>
    </tr>
  );
};

export const AddMapLayer = ({
  onChange,
  values,
  setShowingSubModal,
  gridItemIndex,
}) => {
  const [showMapLayerModal, setShowMapLayerModal] = useState(false);
  const [layerInfo, setLayerInfo] = useState({});
  const [mapLayers, setMapLayers] = useState(values);
  let existingLayerOriginalName = useRef();

  useEffect(() => {
    if (!valuesEqual(mapLayers, values)) {
      setMapLayers(values);
    }
  }, [values]);

  useEffect(() => {
    setShowingSubModal(showMapLayerModal);
  }, [showMapLayerModal]);

  const addMapLayer = (newMapLayer) => {
    let updatedMapLayers = JSON.parse(JSON.stringify(mapLayers));

    // Check to see if existingLayerOriginalName is set and therefore see if a layer is being updated instead of being created
    if (existingLayerOriginalName.current) {
      // Get the map layer with the original name before it was edited
      const originalMapLayer = updatedMapLayers.find(
        (t) => t.configuration.props.name === existingLayerOriginalName.current
      );

      // Find the index of the original map layer in the mapLayer array
      const originalMapLayerIndex = updatedMapLayers.indexOf(originalMapLayer);

      // Get all the map layers except for the original map layer that was edited
      updatedMapLayers = updatedMapLayers.filter(
        (t) => t.configuration.props.name !== existingLayerOriginalName.current
      );

      // Add the newly created map layer in the same index as the original
      updatedMapLayers.splice(originalMapLayerIndex, 0, newMapLayer);
    } else {
      updatedMapLayers.push(newMapLayer);
    }

    // Update tracked mapLayers for custom input
    setMapLayers(updatedMapLayers);

    // Update visualization args for dataviewer
    onChange(updatedMapLayers);
  };

  const onOrderUpdate = (reorderedMapLayers) => {
    // Update tracked mapLayers for custom input
    setMapLayers(reorderedMapLayers);

    // Update visualization args for dataviewer
    onChange(reorderedMapLayers);
  };

  function openMapLayerModal() {
    setShowMapLayerModal(true);
  }

  function handleMapLayerModalClose() {
    // Reset layerInfo and existingLayerOriginalName since a map layer is no longer being edited
    existingLayerOriginalName.current = null;
    setLayerInfo({});
    setShowMapLayerModal(false);
  }

  const templateArgs = {
    mapLayers,
    setMapLayers,
    onChange,
    layerInfo,
    setLayerInfo,
    existingLayerOriginalName,
    setShowMapLayerModal,
  };

  return (
    <>
      <MarginButton
        variant="info"
        onClick={openMapLayerModal}
        aria-label={"Add Layer Button"}
      >
        Add Layer
      </MarginButton>
      <FixedTable striped bordered hover size="sm">
        <thead>
          <tr>
            <th className="text-center" style={{ width: "0%" }}></th>
            <th className="text-center" style={{ width: "60%" }}>
              Layer Name
            </th>
            <th className="text-center" style={{ width: "20%" }}>
              Legend
            </th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <DraggableList
            items={mapLayers}
            onOrderUpdate={onOrderUpdate}
            ItemTemplate={MapLayerTemplate}
            templateArgs={templateArgs}
          />
        </tbody>
      </FixedTable>
      {showMapLayerModal && (
        <MapLayerModal
          showModal={showMapLayerModal}
          handleModalClose={handleMapLayerModalClose}
          addMapLayer={addMapLayer}
          layerInfo={layerInfo}
          setLayerInfo={setLayerInfo}
          mapLayers={mapLayers}
          existingLayerOriginalName={existingLayerOriginalName}
          gridItemIndex={gridItemIndex}
        />
      )}
    </>
  );
};

MapLayerTemplate.propTypes = {
  // The map layer object that contains layer metadata
  value: PropTypes.shape({
    configuration: PropTypes.shape({
      type: PropTypes.string.isRequired,
      props: PropTypes.shape({
        name: PropTypes.string.isRequired,
        source: PropTypes.shape({
          type: PropTypes.string.isRequired,
          props: PropTypes.shape({
            url: PropTypes.string.isRequired,
          }),
        }),
      }),
    }).isRequired,
    legend: PropTypes.shape({
      title: PropTypes.string,
      items: PropTypes.arrayOf(
        PropTypes.shape({
          color: PropTypes.string.isRequired,
          label: PropTypes.string.isRequired,
          symbol: PropTypes.string.isRequired,
        })
      ),
    }),
  }).isRequired,
  // The properties from the DraggableList input to allow dragging functionality
  draggingProps: PropTypes.shape({
    key: PropTypes.number.isRequired,
    onDragStart: PropTypes.func.isRequired,
    onDragOver: PropTypes.func.isRequired,
    onDrop: PropTypes.func.isRequired,
    draggable: PropTypes.string.isRequired,
  }).isRequired,
  // ref that tracks all the available map layers
  mapLayers: PropTypes.shape({
    current: PropTypes.arrayOf(
      PropTypes.shape({
        configuration: PropTypes.shape({
          type: PropTypes.string.isRequired,
          props: PropTypes.shape({
            name: PropTypes.string.isRequired,
            source: PropTypes.shape({
              type: PropTypes.string.isRequired,
              props: PropTypes.shape({
                url: PropTypes.string.isRequired,
              }),
            }),
          }),
        }).isRequired,
        legend: PropTypes.shape({
          title: PropTypes.string,
          items: PropTypes.arrayOf(
            PropTypes.shape({
              color: PropTypes.string.isRequired,
              label: PropTypes.string.isRequired,
              symbol: PropTypes.string.isRequired,
            })
          ),
        }),
      })
    ),
  }).isRequired,
  onChange: PropTypes.func, // callback function will handle what is being passed to the dataviewer for the overall configured map visualization
  // ref that tracks a map layer that is being edited.
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
  // ref that tracks the original name of map layer that is being edited
  existingLayerOriginalName: PropTypes.shape({
    current: PropTypes.string,
  }),
  setShowMapLayerModal: PropTypes.func.isRequired, // function that controls the visibility of the Map Layer Modal
};

AddMapLayer.propTypes = {
  onChange: PropTypes.func, // callback function will handle what is being passed to the dataviewer for the overall configured map visualization
  // values passed from the dataviewer and configured map visualization
  values: PropTypes.arrayOf(
    PropTypes.shape({
      configuration: PropTypes.shape({
        type: PropTypes.string.isRequired,
        props: PropTypes.shape({
          name: PropTypes.string.isRequired,
          source: PropTypes.shape({
            type: PropTypes.string.isRequired,
            props: PropTypes.shape({
              url: PropTypes.string.isRequired,
            }),
          }),
        }),
      }).isRequired,
      legend: PropTypes.shape({
        title: PropTypes.string,
        items: PropTypes.arrayOf(
          PropTypes.shape({
            color: PropTypes.string.isRequired,
            label: PropTypes.string.isRequired,
            symbol: PropTypes.string.isRequired,
          })
        ),
      }),
    })
  ),
  setShowingSubModal: PropTypes.func, // indicates to parent modals that a submodal is showing and therefore a change in zindex is needed for the submodal focusing
  gridItemIndex: PropTypes.number, // index of the griditem currently being updated
};

import React, { useState, useRef, useEffect } from "react";
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

export const AddMapLayer = ({ onChange, values, setShowingSubModal }) => {
  const [showModal, setShowModal] = useState(false);
  const mapLayers = useRef(values ?? []);
  const layerInfo = useRef({});
  let existingLayerName = useRef();

  useEffect(() => {
    setShowingSubModal(showModal);
  }, [showModal]);

  const addMapLayer = (value) => {
    let updatedMapLayers = mapLayers.current;
    if (layerInfo.current) {
      const existingMapLayer = mapLayers.current.find(
        (t) => t.props.name === existingLayerName.current
      );
      const targetIndex = mapLayers.current.indexOf(existingMapLayer);
      updatedMapLayers = mapLayers.current.filter(
        (t) => t.props.name !== existingLayerName.current
      );
      updatedMapLayers.splice(targetIndex, 0, value);
    } else {
      updatedMapLayers = [...updatedMapLayers, value];
    }
    mapLayers.current = updatedMapLayers;
    onChange(updatedMapLayers);
  };

  const removeMapLayer = (mapLayerName) => {
    const updatedMapLayers = mapLayers.current.filter(
      (t) => t.props.name !== mapLayerName
    );
    mapLayers.current = updatedMapLayers;
    onChange(updatedMapLayers);
  };

  const onOrderUpdate = (newOrder) => {
    mapLayers.current = newOrder;
    onChange(newOrder);
  };

  const editMapLayer = (mapLayerName) => {
    const existingMapLayer = mapLayers.current.find(
      (t) => t.props.name === mapLayerName
    );
    layerInfo.current = {
      layerType: existingMapLayer.props.source.type,
      url: existingMapLayer.props.source.props.url,
      name: existingMapLayer.props.name,
    };
    existingLayerName.current = existingMapLayer.props.name;
    setShowModal(true);
  };

  function openModal() {
    setShowModal(true);
  }

  function handleModalClose() {
    layerInfo.current = {};
    existingLayerName = null;
    setShowModal(false);
  }

  const mapLayerTemplate = ({ value }) => {
    return (
      <StyledDiv>
        {value.props.name}
        <StyledButton
          onClick={() => removeMapLayer(value.props.name)}
          title={`Remove ${value.props.name}`}
        >
          x
        </StyledButton>
        <StyledButton
          onClick={() => editMapLayer(value.props.name)}
          title={`Edit ${value.props.name}`}
        >
          edit
        </StyledButton>
      </StyledDiv>
    );
  };

  return (
    <>
      <Container>
        <Row className="mb-1">
          <button onClick={openModal}>Add Layer</button>
          <br />
        </Row>
        <DraggableList
          items={mapLayers.current}
          onOrderUpdate={onOrderUpdate}
          itemTemplate={mapLayerTemplate}
        />
      </Container>
      {showModal && (
        <MapLayerModal
          showModal={showModal}
          handleModalClose={handleModalClose}
          addMapLayer={addMapLayer}
          layerInfo={layerInfo}
        />
      )}
    </>
  );
};

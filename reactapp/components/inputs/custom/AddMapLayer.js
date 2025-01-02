import React, { useState, useRef, useEffect } from "react";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import styled from "styled-components";
import MapLayerModal from "components/modals/MapLayer";
import DraggableList from "components/inputs/DraggableList";

const StyledValue = styled.span`
  width: auto;
  border: 1px solid #ccc;
  margin-right: 0.5rem;
  padding-right: 0;
  background-color: #b8eeff;
`;
const StyledRow = styled(Row)`
  padding-top: 0.5rem;
`;
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

export const AddMapLayer = ({
  label,
  onChange,
  values,
  setShowingSubModal,
}) => {
  const [showModal, setShowModal] = useState(false);
  const mapLayers = useRef(values);
  const existingLayerInfo = useRef();
  let updatedMapLayers;

  useEffect(() => {
    setShowingSubModal(showModal);
  }, [showModal]);

  const addMapLayer = (value) => {
    updatedMapLayers = mapLayers.current;
    if (existingLayerInfo.current) {
      const targetIndex = mapLayers.current.indexOf(existingLayerInfo.current);
      updatedMapLayers = mapLayers.current.filter(
        (t) => t.props.name !== existingLayerInfo.current.props.name
      );
      updatedMapLayers.splice(targetIndex, 0, value);
    } else {
      updatedMapLayers = [...updatedMapLayers, value];
    }
    mapLayers.current = updatedMapLayers;
    onChange(updatedMapLayers);
  };

  const removeMapLayer = (mapLayerName) => {
    updatedMapLayers = mapLayers.current.filter(
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
    existingLayerInfo.current = existingMapLayer;
    setShowModal(true);
  };

  function openModal() {
    setShowModal(true);
  }

  function handleModalClose() {
    existingLayerInfo.current = null;
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
          existingLayerInfo={existingLayerInfo}
        />
      )}
    </>
  );
};

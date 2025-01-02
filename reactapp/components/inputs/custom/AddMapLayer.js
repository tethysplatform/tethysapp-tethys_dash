import React, { useState, useRef, useEffect } from "react";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import styled from "styled-components";
import MapLayerModal from "components/modals/MapLayer";

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
  width: auto;
  border: 1px solid #ccc;
  margin-right: 0.5rem;
  padding-right: 0;
  background-color: #b8eeff;
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
  const [draggingItem, setDraggingItem] = useState();
  const [newItemName, setNewItemName] = useState("");
  const [mapLayers, setMapLayers] = useState(values);
  const existingLayerInfo = useRef();

  useEffect(() => {
    setShowingSubModal(showModal);
  }, [showModal]);

  const handleDragStart = (e, item) => {
    setDraggingItem(item);
    e.dataTransfer.setData("text/plain", "");
  };

  const handleDragEnd = () => {
    setDraggingItem(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, targetItem) => {
    if (!draggingItem) return;

    const currentIndex = mapLayers.indexOf(draggingItem);
    const targetIndex = mapLayers.indexOf(targetItem);

    if (currentIndex !== -1 && targetIndex !== -1) {
      mapLayers.splice(currentIndex, 1);
      mapLayers.splice(targetIndex, 0, draggingItem);
    }
    setMapLayers(mapLayers);
  };

  const addMapLayer = (value) => {
    let updatedMapLayers = mapLayers;
    if (existingLayerInfo.current) {
      updatedMapLayers = mapLayers.filter(
        (t) => t.props.name !== existingLayerInfo.current.props.name
      );
    }
    setMapLayers([...updatedMapLayers, value]);
    onChange(mapLayers);
  };

  const removeMapLayer = (mapLayerName) => {
    setMapLayers(mapLayers.filter((t) => t.props.name !== mapLayerName));
    onChange(mapLayers);
  };

  const editMapLayer = (mapLayerName) => {
    const mapLayer = mapLayers.find((t) => t.props.name === mapLayerName);
    existingLayerInfo.current = mapLayer;
    setShowModal(true);
  };

  function openModal() {
    setShowModal(true);
  }

  function handleModalClose() {
    existingLayerInfo.current = null;
    setShowModal(false);
  }

  return (
    <>
      <Container>
        <Row className="mb-1">
          <button onClick={openModal}>Add Layer</button>
          <br />
        </Row>

        {mapLayers.map((value, index) => (
          <StyledRow
            key={index}
            onDragStart={(e) => handleDragStart(e, value)}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, value)}
            className={`${value === draggingItem ? "dragging" : ""}`}
            draggable="true"
          >
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
          </StyledRow>
        ))}
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

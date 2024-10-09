import React, { useState, useEffect } from 'react';
import { useMapContext } from '../../hooks/useMapContext';
import styled from 'styled-components';
import { FaLayerGroup, FaTimes } from 'react-icons/fa'; // Import icons

const ControlWrapper = styled.div`
  position: absolute;
  bottom: 10px;
  right: 10px;
`;

const LayerControlContainer = styled.div`
  background-color: white;
  padding: ${(props) => (props.isExpanded ? '10px' : '5px')};
  z-index: 1000;
  border: 1px solid #ccc;
  border-radius: 4px;
  width: ${(props) => (props.isExpanded ? '200px' : '40px')};
  height: ${(props) => (props.isExpanded ? 'auto' : '40px')};
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
`;

const ControlButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  font-size: 18px;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  font-size: 18px;
  position: absolute;
  top: 5px;
  right: 5px;
`;

const LayersControl = () => {
  const { map } = useMapContext();
  const [layers, setLayers] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (map) {
      // Get layers from the map and set them in local state
      const mapLayers = map.getLayers().getArray();
      setLayers(mapLayers);
    }
  }, [map]); // This effect runs whenever `map` changes

  // If `map` is not available yet, you can show a loading state or nothing
  if (!map) {
    return null; // Or a loading spinner
  }

  return (
    <ControlWrapper>
      <LayerControlContainer isExpanded={isExpanded}>
        {isExpanded ? (
          // Expanded layer control without title and list
          <>
            <CloseButton onClick={() => setIsExpanded(false)}>
              <FaTimes />
            </CloseButton>
            <div style={{ marginTop: '20px', width: '100%' }}>
              {layers.map((layer, index) => {
                const layerName = layer.get('name') ?? `Layer ${index + 1}`;
                const visible = layer.getVisible() ?? true;
                return (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                    <label style={{ display: 'flex', alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={visible}
                        onChange={() => {
                          layer.setVisible(!visible);
                          // Update the local state to force re-render
                          setLayers([...layers]);
                        }}
                        style={{ marginRight: '8px' }}
                      />
                      <span>{layerName}</span>
                    </label>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          // Collapsed control - show the layers icon button
          <ControlButton onClick={() => setIsExpanded(true)}>
            <FaLayerGroup />
          </ControlButton>
        )}
      </LayerControlContainer>
    </ControlWrapper>
  );
};

export { LayersControl };
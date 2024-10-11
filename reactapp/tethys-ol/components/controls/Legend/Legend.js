import React, { useState } from 'react';
import styled from 'styled-components';
import { FaTimes,FaListUl } from 'react-icons/fa'; // Import icons


const LegendWrapper = styled.div`
  position: absolute;
  bottom: 10px;
  left: 10px;
`;

const LegendControlContainer = styled.div`
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


const LegendControl = ({items}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <LegendWrapper>
      <LegendControlContainer isExpanded={isExpanded}>
        {isExpanded ? (
          // Expanded layer control without title and list
          <>
            <CloseButton onClick={() => setIsExpanded(false)}>
              <FaTimes />
            </CloseButton>
            <div style={{ marginTop: '20px', width: '100%' }}>
              {items.map((item, index) => {
                return (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                    <div style={{ width: '20px', height: '20px', backgroundColor: item.color, marginRight: '10px' }}></div>
                    <div>{item.label}</div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          // Collapsed control - show the layers icon button
          <ControlButton onClick={() => setIsExpanded(true)}>
            <FaListUl />
          </ControlButton>
        )}
      </LegendControlContainer>
    </LegendWrapper>
  );
};

export { LegendControl };
import React, { useState } from "react";
import styled from "styled-components";

const Section = styled.div`
  border: 1px solid #ccc;
  border-radius: 12px;
  padding: 16px;
  margin: 10px 0;
  background-color: #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 18px;
`;

const Arrow = styled.div`
  font-size: 20px;
  transition: transform 0.2s ease;
  transform: ${({ isOpen }) => (isOpen ? "rotate(180deg)" : "rotate(0deg)")};
`;

const Body = styled.div`
  margin-top: 12px;
`;

export default function VisualizationGroup({ title, children }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Section>
      <Header onClick={() => setIsOpen(!isOpen)}>
        <Title>{title}</Title>
        <Arrow isOpen={isOpen}>&#9660;</Arrow>
      </Header>
      {isOpen && <Body>{children}</Body>}
    </Section>
  );
}

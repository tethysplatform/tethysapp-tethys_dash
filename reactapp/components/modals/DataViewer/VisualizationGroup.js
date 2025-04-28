import { useState } from "react";
import styled from "styled-components";
import Row from "react-bootstrap/Row";

const Section = styled.div`
  padding-left: 16px;
  padding-right: 16px;
  margin: 10px 0;
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
  transform: ${({ isOpen }) => (isOpen ? "rotate(0deg)" : "rotate(-90deg)")};
`;

const Body = styled.div`
  margin-top: 12px;
`;

const FlexDiv = styled.div`
  display: flex;
`;

const FlexTitle = styled.div`
  flex-grow: 1;
  margin: auto;
  margin-left: 0.5rem;
`;

export default function VisualizationGroup({ title, children }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Section>
      <Header onClick={() => setIsOpen(!isOpen)}>
        <FlexDiv>
          <Arrow isOpen={isOpen}>&#9660;</Arrow>
          <FlexTitle>
            <Title>{title}</Title>
          </FlexTitle>
        </FlexDiv>
      </Header>
      {isOpen && (
        <Body>
          <Row>{children}</Row>
        </Body>
      )}
    </Section>
  );
}

import React from 'react';
import styled from 'styled-components';
import { BiStats } from "react-icons/bi";


// Styled components
const CardContainer = styled.div`
  background-color: #fff;
  border-radius: 10px;
  padding: 20px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
`;

const Header = styled.div`
  margin-bottom: 20px;

  h3 {
    margin: 0;
    font-size: 1.5rem;
  }

  p {
    font-size: 0.9rem;
    color: #6c757d;
  }
`;

const StatsContainer = styled.div`
  display: flex;
  justify-content: space-between;
  overflow: auto;
`;

const StatItem = styled.div`
  display: flex;
  align-items: center;
  padding: 10px;
`;

const StatIcon = styled.div`
  background-color: ${({ bgColor }) => bgColor};
  color: white;
  padding: 10px;
  border-radius: 10px;
  margin-right: 10px;
  font-size: 2rem;
`;

const StatContent = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

const StatTitle = styled.p`
  margin: 0;
  font-size: 1rem;
  color: #6c757d;
`;

const StatValue = styled.p`
  margin: 0;
  font-size: 1.5rem;
  font-weight: bold;
`;

// Component to display the StatsCard
const Card = ({ title, description, data }) => {
  return (
    <CardContainer>
      <Header>
        <h3>{title}</h3>
        <p>{description}</p>
      </Header>
      {Object.keys(data).length === 0 ? (
        <StatItem>
          <StatIcon bgColor={"black"}><BiStats /></StatIcon>
          <StatContent>
            <StatTitle>0</StatTitle>
            <StatValue>No Data found</StatValue>
          </StatContent>
        </StatItem>
      ) : (
        <StatsContainer>
          {data.map((item, index) => (
            <StatItem key={index}>
              <StatIcon bgColor={item.hex}><BiStats /></StatIcon>
              <StatContent>
                <StatTitle>{item.label}</StatTitle>
                <StatValue>{item.size}</StatValue>
              </StatContent>
            </StatItem>
          ))}
        </StatsContainer>
      )}
    </CardContainer>
  );
};



export default Card;

import React, {useEffect,memo, Fragment} from "react";
import styled from "styled-components";

// Styled components for the card and its layout
const CardContainer = styled.div`
  display: flex;
  justify-content: space-between;
  background-color: #f7f9fc;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 900px;
  margin: 20px auto;
`;

const StatBox = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  background-color: white;
  padding: 15px;
  border-radius: 10px;
  flex: 1;
  margin: 0 10px;
  box-shadow: 0px 5px 10px rgba(0, 0, 0, 0.05);
`;

const StatValue = styled.span`
  font-size: 24px;
  font-weight: bold;
  margin-top: 8px;
`;

const StatLabel = styled.span`
  font-size: 14px;
  color: #7a7a7a;
`;

const Card = ({ data, title }) => {
  // Rendering stat boxes based on the provided object
  useEffect(() => {
    if (!data) return;
    console.log(data)
    return () => {
        
    }
  }, [])
  
  return (
    <Fragment>
      <h2>{title}</h2>
      <CardContainer>
        { data && Object.entries(data[0]).map(([label, value], index) => (
          <StatBox key={index}>
            <StatLabel>{label}</StatLabel>
            <StatValue>{value}</StatValue>
          </StatBox>
        ))}
      </CardContainer>
    </Fragment>

  );
};

export default memo(Card);


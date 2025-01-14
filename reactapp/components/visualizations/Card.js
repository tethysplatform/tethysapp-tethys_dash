import React, { Suspense } from "react";
import styled from "styled-components";
import PropTypes from "prop-types";
import useConditionalChecks from "hooks/useConditionalChecks";

// Styled components
const CardContainer = styled.div`
  background-color: #fff;
  height: 100%;
  width: 100%;
  overflow-x: auto;
`;

const Header = styled.div`
  margin-bottom: 1.5rem;
  text-align: center;

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

const StyledErrorDiv = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
`;

const StatItemGroup = ({ item, index }) => {
  const iconName = item?.icon ? item.icon : "BiStats";
  const Icon = React.lazy(async () => {
    const module = await import(`react-icons/bi`);
    return { default: module[iconName] };
  });

  return (
    <Suspense>
      <StatItem key={index ? index : 0}>
        <StatIcon bgColor={item?.color ? item?.color : "black"}>
          <Icon data-testid={item?.label ?? item?.icon ?? "BiStats"} />
        </StatIcon>
        <StatContent>
          <StatTitle>{item?.label ? item?.label : 0}</StatTitle>
          <StatValue>{item?.value ? item.value : "No Data found"}</StatValue>
        </StatContent>
      </StatItem>
    </Suspense>
  );
};

// Component to display the StatsCard
const Card = ({ title, description, data, visualizationRef, customErrors }) => {
  const { passed, resultMessages } = useConditionalChecks(customErrors);

  return (
    passed ? (
      <CardContainer ref={visualizationRef}>
        <Header>
          <h3>{title}</h3>
          <p>{description}</p>
        </Header>
        {data.length === 0 ? (
          <StatItemGroup />
        ) : (
          <StatsContainer>
            {data.map((item, index) => (
              <StatItemGroup key={index} item={item} index={index} />
            ))}
          </StatsContainer>
        )}
      </CardContainer>
    ) : (
      // These will only show if the useConditionalChecks hook finds any failures
      // It will then map through all of the possible errors that occured.
      resultMessages.map((message, messageIndex) => (
        <StyledErrorDiv key={messageIndex}>
          <h2>{message}</h2>
        </StyledErrorDiv>
      ))
    )
  );
};

Card.propTypes = {
  title: PropTypes.string,
  description: PropTypes.string,
  data: PropTypes.array,
  visualizationRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
  customErrors: PropTypes.arrayOf(
    PropTypes.shape({
      variableName: PropTypes.string,
      operator: PropTypes.string,
      comparison: PropTypes.string,
      resultMessage: PropTypes.string,
    })
  ),
};

StatItemGroup.propTypes = {
  item: PropTypes.object,
  index: PropTypes.number,
};

export default Card;

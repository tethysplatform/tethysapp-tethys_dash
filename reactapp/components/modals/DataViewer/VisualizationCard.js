import PropTypes from "prop-types";
import { memo } from "react";
import Card from "react-bootstrap/Card";
import styled from "styled-components";

const CustomCard = styled(Card).withConfig({
  shouldForwardProp: (prop) => prop !== "newCard", // Prevent `newCard` from being passed to the DOM
})`
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
  width: 20rem;
  height: 15rem;
  display: flex;
  margin-bottom: 1.5rem;
  background-color: rgb(238, 238, 238);
  border: ${(props) => props?.newCard && "#dcdcdc dashed 1px"};
`;

const CardBody = styled(Card.Body)`
  position: relative; /* Ensure content is layered properly */
  overflow-y: auto;

  &:hover {
    background-color: rgba(
      169,
      169,
      169,
      0.5
    ); /* Light gray background on hover */
  }
`;

const CardImage = styled(Card.Img)`
  transition: opacity 0.3s ease; /* Smooth transition for opacity change */
  opacity: 1; /* Default visibility */
  width: 100%;
  height: 100%;

  ${CardBody}:hover & {
    opacity: 0.5; /* Dim the image on hover */
  }
`;

const CardHeader = styled(Card.Header)`
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 3rem;
  max-height: 4.5rem;
`;

const CardTitleDiv = styled.div`
  height: 100%;
  overflow-y: auto;
  margin: 0.1rem;
  display: flex;
  align-items: center;
  width: 100%;
  position: relative;
  text-align: center;
`;

const CardTitle = styled.h5`
  margin: 0;
  width: 100%;
`;

const VisualizationCard = ({ source, value, label, args, type }) => {
  return (
    <>
      <CustomCard
        className={"visualizationCard"}
        aria-label="Visualization Card"
      >
        <CardHeader>
          <CardTitleDiv className="card-header-title">
            <CardTitle>{label}</CardTitle>
          </CardTitleDiv>
        </CardHeader>
        <CardBody>
          <CardImage
            variant="top"
            src={
              "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Aptenodytes_forsteri_-Snow_Hill_Island%2C_Antarctica_-adults_and_juvenile-8.jpg/640px-Aptenodytes_forsteri_-Snow_Hill_Island%2C_Antarctica_-adults_and_juvenile-8.jpg"
            }
            aria-label="Dashboard Card Image"
          />
        </CardBody>
      </CustomCard>
    </>
  );
};

VisualizationCard.propTypes = {
  id: PropTypes.number,
  name: PropTypes.string,
  editable: PropTypes.bool,
  description: PropTypes.string,
  accessGroups: PropTypes.arrayOf(PropTypes.string),
  image: PropTypes.string,
};

export default memo(VisualizationCard);

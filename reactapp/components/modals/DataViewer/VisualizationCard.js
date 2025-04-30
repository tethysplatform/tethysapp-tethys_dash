import PropTypes from "prop-types";
import { memo, useRef, useState, Fragment } from "react";
import Card from "react-bootstrap/Card";
import styled from "styled-components";
import Overlay from "react-bootstrap/Overlay";
import Popover from "react-bootstrap/Popover";
import { spaceAndCapitalize } from "components/modals/utilities";

const CustomCard = styled(Card)`
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
  width: 12rem;
  height: 12rem;
  margin-left: 0.5rem;
  margin-bottom: 0.5rem;
  display: flex;
  background-color: rgb(238, 238, 238);
`;

const CardBody = styled(Card.Body)`
  position: relative; /* Ensure content is layered properly */
  overflow-y: auto;
`;

const CardImage = styled(Card.Img)`
  transition: opacity 0.3s ease; /* Smooth transition for opacity change */
  opacity: 1; /* Default visibility */
  width: 100%;
  height: 100%;
`;

const CardHeader = styled(Card.Header)`
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-height: 4rem;
  padding: 0;
  background-color: transparent;
`;

const CardTitleDiv = styled.div`
  height: 100%;
  overflow-y: auto;
  margin: 0.1rem;
  display: flex;
  width: 100%;
  position: relative;
  text-align: center;
`;

const CardTitle = styled.p`
  margin: 0;
  width: 100%;
`;

const InfoItem = styled.div`
  margin-bottom: 0.5rem;
`;

const VisualizationCard = ({
  source,
  value,
  label,
  args,
  type,
  description,
  tags,
  onClick,
}) => {
  const cardRef = useRef();
  const [showPopover, setShowPopover] = useState(false);

  return (
    <>
      <CustomCard
        className={"visualizationCard"}
        aria-label="Visualization Card"
        ref={cardRef}
        onMouseEnter={() => setShowPopover(true)}
        onMouseLeave={() => setShowPopover(false)}
        style={{ cursor: "pointer" }}
        onClick={onClick}
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
      <Overlay
        target={cardRef.current}
        show={showPopover}
        placement="left"
        rootClose={true}
        onHide={() => setShowPopover(false)}
      >
        <Popover className="color-picker-popover">
          <Popover.Body>
            <div>
              <h4>{label}</h4>
              <InfoItem>
                <b>Description</b>: {description}
              </InfoItem>
              <InfoItem>
                <b>Type</b>: {type}
              </InfoItem>
              <InfoItem>
                <b>Tags</b>: {tags && tags.join(", ")}
              </InfoItem>
            </div>
          </Popover.Body>
        </Popover>
      </Overlay>
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

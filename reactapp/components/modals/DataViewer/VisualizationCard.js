import PropTypes from "prop-types";
import { memo, useRef, useState } from "react";
import Card from "react-bootstrap/Card";
import styled from "styled-components";
import Overlay from "react-bootstrap/Overlay";
import Popover from "react-bootstrap/Popover";

const CustomCard = styled(Card)`
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
  width: 12.5rem;
  height: 11rem;
  margin-left: 0.6rem;
  margin-bottom: 0.6rem;
  display: flex;
  background-color: rgb(238, 238, 238);
`;

const CardBody = styled(Card.Body)`
  padding: 0.3rem;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 9.5rem;
`;

const ImageWrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%; /* Fill the body */
  overflow: hidden;
`;

const CardImage = styled(Card.Img)`
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
`;

const CardHeader = styled(Card.Header)`
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 1.5rem;
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
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
`;

const InfoItem = styled.div`
  margin-bottom: 0.5rem;
`;

const CenteredDiv = styled.div`
  text-align: center;
`;

const VisualizationCard = ({
  source,
  label,
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
        aria-label={`${label} Visualization Card`}
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
          <ImageWrapper>
            <CardImage
              variant="top"
              src={`/static/tethysdash/images/plugins/${source}.png`}
              aria-label="Dashboard Card Image"
            />
          </ImageWrapper>
        </CardBody>
      </CustomCard>
      <Overlay
        target={cardRef.current}
        show={showPopover}
        placement="left"
        rootClose={true}
        onHide={() => setShowPopover(false)}
      >
        <Popover
          onMouseEnter={() => setShowPopover(true)}
          onMouseLeave={() => setShowPopover(false)}
          aria-label="Visualization Card Popover"
        >
          <Popover.Body>
            <div>
              <CenteredDiv>
                <h5>{label}</h5>
              </CenteredDiv>
              <InfoItem>
                <b>Description</b>: {description}
              </InfoItem>
              <InfoItem>
                <b>Type</b>: {type}
              </InfoItem>
              <InfoItem>
                <b>Tags</b>: {tags.join(", ")}
              </InfoItem>
            </div>
          </Popover.Body>
        </Popover>
      </Overlay>
    </>
  );
};

VisualizationCard.propTypes = {
  source: PropTypes.string,
  label: PropTypes.string,
  type: PropTypes.string,
  description: PropTypes.string,
  tags: PropTypes.arrayOf(PropTypes.string),
  onClick: PropTypes.func,
};

export default memo(VisualizationCard);

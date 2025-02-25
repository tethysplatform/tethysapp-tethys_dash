import PropTypes from "prop-types";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import styled from "styled-components";
import { BsTrash } from "react-icons/bs";
import { useNavigate } from "react-router-dom";

const RedTrashIcon = styled(BsTrash)`
  color: red;
`;

const CustomCard = styled(Card)`
  width: 15rem;
  height: 20rem;
  display: flex;
`;

const CardHeader = styled(Card.Header)`
  background-color: transparent;
  text-align: center;
  border-bottom: 1px solid black;
  padding-bottom: 1rem;
`;

const CardFooter = styled(Card.Footer)`
  justify-content: space-between;
  display: flex;
  background-color: transparent;
`;

const HoverDiv = styled.div`
  cursor: pointer;
  position: absolute;
  top: 0.3rem;
  right: 0.5rem;
`;

const DashboardCard = ({
  id,
  name,
  label,
  description,
  notes,
  editable,
  accessGroups,
  gridItems,
}) => {
  const navigate = useNavigate();

  return (
    <CustomCard>
      <Card.Body>
        <CardHeader as="h5">{label}</CardHeader>
        <HoverDiv
          onMouseOver={(e) => (e.target.style.cursor = "pointer")}
          onMouseOut={(e) => (e.target.style.cursor = "default")}
        >
          <RedTrashIcon size={"1rem"} />
        </HoverDiv>
        <Card.Text>{description}</Card.Text>
      </Card.Body>
      <CardFooter>
        <Button
          variant="success"
          onClick={() => {
            navigate("/dashboard/" + name);
          }}
        >
          View
        </Button>
        <Button variant="info">Copy</Button>
      </CardFooter>
    </CustomCard>
  );
};

DashboardCard.propTypes = {
  id: PropTypes.number,
  name: PropTypes.string,
  label: PropTypes.string,
  notes: PropTypes.string,
  editable: PropTypes.bool,
  accessGroups: PropTypes.arrayOf(PropTypes.string),
  gridItems: PropTypes.shape({
    id: PropTypes.number,
    i: PropTypes.string,
    x: PropTypes.number,
    y: PropTypes.number,
    w: PropTypes.number,
    h: PropTypes.number,
    source: PropTypes.string,
    args_string: PropTypes.string,
    metadata_string: PropTypes.string,
  }),
};

export default DashboardCard;

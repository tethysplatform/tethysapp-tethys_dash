import PropTypes from "prop-types";
import { useContext, useState } from "react";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import styled from "styled-components";
import { BsTrash } from "react-icons/bs";
import { FaPlus } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { confirm } from "components/dashboard/DeleteConfirmation";
import { AvailableDashboardsContext } from "components/contexts/Contexts";
import Alert from "react-bootstrap/Alert";
import NewDashboardModal from "components/modals/NewDashboard";

const RedTrashIcon = styled(BsTrash)`
  color: red;
`;

const CustomCard = styled(Card).withConfig({
  shouldForwardProp: (prop) => prop !== "newCard", // Prevent `newCard` from being passed to the DOM
})`
  width: 15rem;
  height: 20rem;
  display: flex;
  background-color: rgb(238, 238, 238);
  border: ${(props) => props?.newCard && "#dcdcdc dashed 1px"};
`;

const CardBody = styled(Card.Body)`
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
  overflow-y: auto;
`;

const CardHeader = styled(Card.Header)`
  background-color: transparent;
  text-align: center;
  border-bottom: 1px solid black;
  min-height: 3rem;
  max-height: 3rem;
  overflow-y: auto;
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

const NewDashboardDiv = styled.div`
  text-align: center;
  display: flex;
  flex-direction: column; /* Stack items vertically */
  align-items: center; /* Center items horizontally */
  justify-content: center; /* Center items vertically */
  height: 100%; /* Ensure it takes full height of its parent */
  cursor: pointer;
`;

const CenteredP = styled.p`
  margin: 0.5rem;
`;

const StyledAlert = styled(Alert)`
  position: absolute;
  margin: 1rem;
`;

const DashboardCard = ({ name, editable, description }) => {
  const navigate = useNavigate();
  const { deleteDashboard, copyDashboard } = useContext(
    AvailableDashboardsContext
  );
  const [errorMessage, setErrorMessage] = useState(null);

  async function onDelete() {
    setErrorMessage("");
    if (
      await confirm(
        "Are you sure you want to delete the " + name + " dashboard?"
      )
    ) {
      deleteDashboard(name).then((response) => {
        if (!response["success"]) {
          setErrorMessage("Failed to delete dashboard");
        }
      });
    }
  }

  function viewDashboard() {
    if (editable) {
      navigate("/dashboard/user/" + name);
    } else {
      navigate("/dashboard/public/" + name);
    }
  }

  function onCopy() {
    setErrorMessage("");
    copyDashboard(name).then((response) => {
      if (!response["success"]) {
        setErrorMessage("Failed to copy dashboard");
      }
    });
  }

  return (
    <CustomCard>
      <CardHeader as="h5">
        <CenteredP>{name}</CenteredP>
        <HoverDiv
          onClick={onDelete}
          onMouseOver={(e) => (e.target.style.cursor = "pointer")}
          onMouseOut={(e) => (e.target.style.cursor = "default")}
        >
          <RedTrashIcon size={"1rem"} />
        </HoverDiv>
      </CardHeader>
      <CardBody>
        {errorMessage && (
          <StyledAlert
            key="danger"
            variant="danger"
            onClose={() => setErrorMessage("")}
            dismissible={true}
          >
            {errorMessage}
          </StyledAlert>
        )}
        {description}
      </CardBody>
      <CardFooter>
        <Button variant="success" onClick={viewDashboard}>
          View
        </Button>
        <Button variant="info" onClick={onCopy}>
          Copy
        </Button>
      </CardFooter>
    </CustomCard>
  );
};

export const NewDashboardCard = () => {
  const [showNewDashboardModal, setShowNewDashboardModal] = useState(false);

  return (
    <>
      <CustomCard newCard={true}>
        <CardBody>
          <NewDashboardDiv
            onClick={() => {
              setShowNewDashboardModal(true);
            }}
            onMouseOver={(e) => (e.target.style.cursor = "pointer")}
            onMouseOut={(e) => (e.target.style.cursor = "default")}
          >
            <FaPlus size={"1rem"} />
            <p>Create a New Dashboard</p>
          </NewDashboardDiv>
        </CardBody>
      </CustomCard>
      {showNewDashboardModal && (
        <NewDashboardModal
          showModal={showNewDashboardModal}
          setShowModal={setShowNewDashboardModal}
        />
      )}
    </>
  );
};

DashboardCard.propTypes = {
  name: PropTypes.string,
  label: PropTypes.string,
  description: PropTypes.string,
};

export default DashboardCard;

import PropTypes from "prop-types";
import { useContext, useState } from "react";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import styled from "styled-components";
import { BsTrash, BsCopy, BsPeople, BsSlashLg } from "react-icons/bs";
import { FaPlus } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { confirm } from "components/dashboard/DeleteConfirmation";
import { AvailableDashboardsContext } from "components/contexts/Contexts";
import Alert from "react-bootstrap/Alert";
import NewDashboardModal from "components/modals/NewDashboard";

const RedTrashIcon = styled(BsTrash)`
  color: red;
`;

const BlueCopyIcon = styled(BsCopy)`
  color: #1e6b8b;
`;

const CustomCard = styled(Card).withConfig({
  shouldForwardProp: (prop) => prop !== "newCard", // Prevent `newCard` from being passed to the DOM
})`
  width: 15rem;
  height: 20rem;
  display: flex;
  margin-bottom: 1.5rem;
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
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 3rem;
  max-height: 4.5rem;
`;

const CardFooter = styled(Card.Footer)`
  justify-content: space-between;
  display: flex;
  background-color: transparent;
`;

const HoverDiv = styled.div`
  cursor: pointer;
  padding-left: 0.3rem;
  height: 100%;
  justify-content: center;
  display: flex;
  align-items: center;
`;

const ButtonGroup = styled.div`
  display: inline-flex;
  height: 100%;
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

const CardTitleDiv = styled.div`
  height: 100%;
  overflow-y: auto;
  margin: 0.1rem;
`;

const CardTitle = styled.h5`
  margin: 0;
  width: 100%;
`;

const StyledAlert = styled(Alert)`
  position: absolute;
  margin: 1rem;
`;

const SharingIconDiv = styled.div`
  position: relative;
  display: flex;
  height: 100%;
  justify-content: center;
  align-items: center;
`;

const WideButton = styled(Button)`
  width: 100%;
`;

const SharingIcon = ({ shared }) => {
  return (
    <SharingIconDiv>
      <BsPeople size="1.2rem" />
      {!shared && <BsSlashLg size="1.2rem" style={{ position: "absolute" }} />}
    </SharingIconDiv>
  );
};

const DashboardCard = ({
  id,
  name,
  editable,
  description,
  accessGroups,
  last_updated,
  image,
}) => {
  const navigate = useNavigate();
  const { deleteDashboard, copyDashboard, updateDashboard } = useContext(
    AvailableDashboardsContext
  );
  const [errorMessage, setErrorMessage] = useState(null);
  const [shared, setShared] = useState(accessGroups.includes("public"));
  const updatedTime = new Date(`${last_updated}Z`);
  const localUpdatedTime = updatedTime.toLocaleString();

  async function onDelete() {
    setErrorMessage("");
    if (
      await confirm(
        "Are you sure you want to delete the " + name + " dashboard?"
      )
    ) {
      deleteDashboard(id).then((response) => {
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
    copyDashboard(id, name).then((response) => {
      if (!response["success"]) {
        setErrorMessage("Failed to copy dashboard");
      }
    });
  }

  async function onShare() {
    const apiResponse = await updateDashboard({
      id,
      newProperties: {
        accessGroups: !shared ? ["public"] : [],
      },
    });
    if (apiResponse["success"]) {
      setShared(!shared);
    } else {
      setErrorMessage(apiResponse["message"] ?? "Failed to share dashboard");
    }
    return apiResponse;
  }

  return (
    <CustomCard>
      <CardHeader>
        <CardTitleDiv>
          <CardTitle>{name}</CardTitle>
        </CardTitleDiv>
        <ButtonGroup>
          <HoverDiv
            onClick={onCopy}
            onMouseOver={(e) => (e.target.style.cursor = "pointer")}
            onMouseOut={(e) => (e.target.style.cursor = "default")}
          >
            <BlueCopyIcon size={"1.1rem"} />
          </HoverDiv>
          {editable && (
            <>
              <HoverDiv
                onClick={onShare}
                onMouseOver={(e) => (e.target.style.cursor = "pointer")}
                onMouseOut={(e) => (e.target.style.cursor = "default")}
              >
                <SharingIcon shared={shared} />
              </HoverDiv>
              <HoverDiv
                onClick={onDelete}
                onMouseOver={(e) => (e.target.style.cursor = "pointer")}
                onMouseOut={(e) => (e.target.style.cursor = "default")}
              >
                <RedTrashIcon size={"1.1rem"} />
              </HoverDiv>
            </>
          )}
        </ButtonGroup>
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
        <Card.Img variant="top" src={image} />
        {description}
        <p>
          <b>Last Updated</b>: {localUpdatedTime}
        </p>
        <p>
          <b>Author</b>: someone
        </p>
      </CardBody>
      <CardFooter>
        <WideButton variant="success" onClick={viewDashboard}>
          View
        </WideButton>
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

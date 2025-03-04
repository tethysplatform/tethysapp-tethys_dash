import PropTypes from "prop-types";
import { useContext, useState, memo } from "react";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import styled from "styled-components";
import {
  BsTrash,
  BsCopy,
  BsPeople,
  BsPeopleFill,
  BsSlashLg,
} from "react-icons/bs";
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

const BluePeopleFilledIcon = styled(BsPeopleFill)`
  color: blue;
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

const DescriptionDiv = styled.div`
  cursor: ${({ editable }) => (editable ? "text" : "default")};

  ${({ editable }) =>
    editable &&
    `
    &:hover {
      border: 1px solid rgb(7, 7, 7); /* Add an outline when hovered */
      border-radius: 4px;
    }
  `}
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
  display: flex;
  align-items: center;
  width: 100%;
  cursor: text;
  position: relative;
`;

const EditableInput = styled.input`
  width: 100%;
  border: none;
  background: transparent;
  font-size: 1rem;
  transition: border 0.3s ease; /* Smooth transition for border change */
  border-radius: 4px;

  &:focus {
    outline: none; /* Prevent default focus outline */
    border: 1px solid #007bff; /* Outline color when focused */
  }
`;

const EditableTextarea = styled.textarea`
  width: 100%;
  border: none;
  background: transparent;
  font-size: 1rem;
  outline: none;
  transition: border 0.3s ease;
  border-radius: 4px;

  &:focus {
    outline: none;
    border: 1px solid #007bff;
  }
`;

const CardTitle = styled.h5`
  margin: 0;
  width: 100%;
  cursor: ${({ editable }) => (editable ? "text" : "default")};

  ${({ editable }) =>
    editable &&
    `
    &:hover {
      border: 1px solid rgb(7, 7, 7); /* Add an outline when hovered */
      border-radius: 4px;
    }
  `}
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

const CardImage = styled(Card.Img)`
  margin-bottom: 1rem;
`;

const SharingIcon = ({ shared }) => {
  if (shared) {
    return (
      <SharingIconDiv>
        <BluePeopleFilledIcon size="1.2rem" />
      </SharingIconDiv>
    );
  } else {
    return (
      <SharingIconDiv>
        <BsPeople size="1.2rem" />
        <BsSlashLg size="1.2rem" style={{ position: "absolute" }} />
      </SharingIconDiv>
    );
  }
};

const DashboardCard = ({
  id,
  name,
  editable,
  description,
  accessGroups,
  last_updated,
  image,
  owner,
}) => {
  const navigate = useNavigate();
  const { deleteDashboard, copyDashboard, updateDashboard } = useContext(
    AvailableDashboardsContext
  );
  const [errorMessage, setErrorMessage] = useState(null);
  const [shared, setShared] = useState(accessGroups.includes("public"));
  const updatedTime = new Date(`${last_updated}Z`);
  const localUpdatedTime = updatedTime.toLocaleString();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [title, setTitle] = useState(name);
  const [desc, setDesc] = useState(description);

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

  const handleFieldChange = async (field, setField, setIsEditing) => {
    const value = field === "name" ? title : desc;
    const originalValue = field === "name" ? name : description;
    if (value !== originalValue) {
      const apiResponse = await updateDashboard({
        id,
        newProperties: { [field]: value },
      });
      if (apiResponse["success"]) {
        setIsEditing(false);
      } else {
        setErrorMessage(apiResponse["message"] ?? "Failed to update dashboard");
      }
    } else {
      setIsEditing(false);
    }
  };

  // Handle the click event to start editing a field (title or description)
  const handleEditClick = (setIsEditing) => {
    setIsEditing(true);
  };

  // Handle the change event for title and description
  const handleChange = (e, setField) => {
    setField(e.target.value);
  };

  // Handle blur and enter keydown for title and description
  const handleBlur = async (field, setField, setIsEditing) => {
    await handleFieldChange(field, setField, setIsEditing);
  };

  const handleKeyDown = async (e, field, setField, setIsEditing) => {
    if (e.key === "Enter") {
      await handleFieldChange(field, setField, setIsEditing);
    } else if (e.key === "Escape") {
      // Reset the field value to its original value (either title or description)
      setField(field === "name" ? name : description);
      setIsEditing(false);
    }
  };

  return (
    <CustomCard>
      <CardHeader>
        <CardTitleDiv onClick={() => handleEditClick(setIsEditingTitle)}>
          {editable && isEditingTitle ? (
            <EditableInput
              type="text"
              value={title}
              autoFocus
              onChange={(e) => handleChange(e, setTitle)}
              onBlur={() => handleBlur("name", setTitle, setIsEditingTitle)}
              onKeyDown={(e) =>
                handleKeyDown(e, "name", setTitle, setIsEditingTitle)
              }
            />
          ) : (
            <CardTitle>{title}</CardTitle>
          )}
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
        <CardImage variant="top" src={image} />
        <div onClick={() => handleEditClick(setIsEditingDescription)}>
          <label>
            <b>Description</b>:
            {editable && isEditingDescription ? (
              <EditableTextarea
                value={desc}
                autoFocus
                onChange={(e) => handleChange(e, setDesc)}
                onBlur={() =>
                  handleBlur("description", setDesc, setIsEditingDescription)
                }
                onKeyDown={(e) =>
                  handleKeyDown(
                    e,
                    "description",
                    setDesc,
                    setIsEditingDescription
                  )
                }
              />
            ) : (
              <DescriptionDiv editable={editable}>
                <p>{desc}</p>
              </DescriptionDiv>
            )}
          </label>
        </div>
        <div>
          <label>
            <b>Last Updated</b>:<p>{localUpdatedTime}</p>
          </label>
        </div>
        {!editable && (
          <div>
            <label>
              <b>Owner</b>:<p>{owner}</p>
            </label>
          </div>
        )}
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

export default memo(DashboardCard);

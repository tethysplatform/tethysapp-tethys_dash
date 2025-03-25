import PropTypes from "prop-types";
import { useContext, useState, memo, useEffect, useRef } from "react";
import { getPublicUrl } from "services/utilities";
import Card from "react-bootstrap/Card";
import styled from "styled-components";
import { BsPeopleFill } from "react-icons/bs";
import { FaPlus } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { confirm } from "components/inputs/DeleteConfirmation";
import { AvailableDashboardsContext } from "components/contexts/Contexts";
import { useAppTourContext } from "components/contexts/AppTourContext";
import Alert from "react-bootstrap/Alert";
import NewDashboardModal from "components/modals/NewDashboard";
import { FaRegUserCircle } from "react-icons/fa";
import ContextMenu from "components/landingPage/ContextMenu";
import DashboardThumbnailModal from "components/modals/DashboardThumbnail";

const StyledBsPeopleFill = styled(BsPeopleFill)`
  margin-left: 0.3rem;
`;

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

const DescriptionDiv = styled.div.withConfig({
  shouldForwardProp: (prop) => !["isEditing"].includes(prop),
})`
  position: absolute; /* Overlay the description on top of the image */
  bottom: 10px; /* Adjust the position as needed */
  left: 10px; /* Adjust the position as needed */
  right: 10px;
  color: white;
  font-size: 1rem;
  background-color: rgba(0, 0, 0, 0.5); /* Semi-transparent background */
  padding: 5px;
  border-radius: 4px;
  display: ${(props) => (props?.isEditing ? "flex" : "none")};
  height: 90%; /* Ensure it takes full height of the parent */
  overflow-y: auto;
  white-space: pre-wrap;

  ${CardBody}:hover & {
    display: flex; /* Show the description on hover */
  }
`;

const CardHeader = styled(Card.Header)`
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 3rem;
  max-height: 4.5rem;
`;

const NewDashboardDiv = styled.div`
  text-align: center;
  display: flex;
  flex-direction: column; /* Stack items vertically */
  align-items: center; /* Center items horizontally */
  justify-content: center; /* Center items vertically */
  height: 100%; /* Ensure it takes full height of its parent */
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
  resize: none;
  color: white;

  &:focus {
    outline: none;
    border: 1px solid #007bff;
  }
`;

const CardTitle = styled.h5`
  margin: 0;
  width: 100%;
`;

const StyledAlert = styled(Alert)`
  position: absolute;
  margin: 1rem;
  z-index: 1;
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

const FlexDiv = styled.div`
  display: flex;
`;

const DashboardCard = ({
  id,
  name,
  editable,
  description,
  accessGroups,
  image,
}) => {
  const navigate = useNavigate();
  const { deleteDashboard, copyDashboard, updateDashboard, exportDashboard } =
    useContext(AvailableDashboardsContext);
  const [errorMessage, setErrorMessage] = useState(null);
  const [shared, setShared] = useState(accessGroups.includes("public"));
  const [showThumbnailModal, setShowThumbnailModal] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [title, setTitle] = useState(name);
  const [desc, setDesc] = useState(description);
  const [dashboardImage, setDashboardImage] = useState(image);
  const nameInput = useRef();
  const descriptionInput = useRef();
  const { activeAppTour } = useAppTourContext();

  useEffect(() => {
    if (isEditingTitle) {
      nameInput.current.focus();
    }
  }, [isEditingTitle]);

  useEffect(() => {
    if (isEditingDescription) {
      descriptionInput.current.focus();
    }
  }, [isEditingDescription]);

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

  async function onExport() {
    const apiResponse = await exportDashboard(id);
    if (!apiResponse["success"]) {
      setErrorMessage(apiResponse["message"] ?? "Failed to export dashboard");
    }
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
  }

  const onCopyPublicLink = async () => {
    const dashboardPublicUrl = getPublicUrl(name);
    try {
      await window.navigator.clipboard.writeText(dashboardPublicUrl);
    } catch (err) {
      setErrorMessage("Failed to copy public link");
    }
  };

  const handleFieldChange = async (field, setIsEditing) => {
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

  const onUpdateThumbnail = async (newImage) => {
    setShowThumbnailModal(false);
    const apiResponse = await updateDashboard({
      id,
      newProperties: {
        image: newImage,
      },
    });
    if (apiResponse["success"]) {
      setDashboardImage(newImage);
    } else {
      setErrorMessage("Failed to update dashboard");
    }
  };

  // Handle the change event for title and description
  const handleChange = (e, setField) => {
    setField(e.target.value);
  };

  // Handle blur and enter keydown for title and description
  const handleBlur = async (field, setIsEditing) => {
    await handleFieldChange(field, setIsEditing);
  };

  const handleKeyDown = async (e, field, setField, setIsEditing) => {
    if (e.key === "Enter" && !e.shiftKey) {
      await handleFieldChange(field, setIsEditing);
    } else if (e.key === "Enter" && e.shiftKey) {
      setField(e.target.value); // Update the textarea value with the new line
    } else if (e.key === "Escape") {
      // Reset the field value to its original value (either title or description)
      setField(field === "name" ? name : description);
      setIsEditing(false);
    }
  };

  const onDoubleClickCard = () => {
    if (!isEditingTitle && !isEditingDescription && !activeAppTour) {
      viewDashboard();
    }
  };

  return (
    <>
      <CustomCard
        onDoubleClick={onDoubleClickCard}
        className={"dashboardCard"}
        aria-label="Dashboard Card"
      >
        <CardHeader>
          <FlexDiv className="card-header-icons">
            {editable && (
              <FaRegUserCircle
                size={"1.2rem"}
                title={"You are the owner"}
                aria-label="Owner Icon"
              />
            )}
            {shared && (
              <StyledBsPeopleFill
                size={"1.2rem"}
                title={"Public dashboard"}
                aria-label="Public Icon"
              />
            )}
          </FlexDiv>
          <CardTitleDiv className="card-header-title">
            {isEditingTitle ? (
              <EditableInput
                ref={nameInput}
                type="text"
                value={title}
                onChange={(e) => handleChange(e, setTitle)}
                onBlur={() => handleBlur("name", setIsEditingTitle)}
                onKeyDown={(e) =>
                  handleKeyDown(e, "name", setTitle, setIsEditingTitle)
                }
                aria-label="Title Input"
              />
            ) : (
              <CardTitle>{title}</CardTitle>
            )}
          </CardTitleDiv>
          <ContextMenu
            editable={editable}
            setIsEditingTitle={setIsEditingTitle}
            setIsEditingDescription={setIsEditingDescription}
            onDelete={onDelete}
            onCopy={onCopy}
            onExport={onExport}
            viewDashboard={viewDashboard}
            onShare={onShare}
            onCopyPublicLink={onCopyPublicLink}
            shared={shared}
            setShowThumbnailModal={setShowThumbnailModal}
          />
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
          <CardImage
            variant="top"
            src={dashboardImage}
            aria-label="Dashboard Card Image"
          />

          <DescriptionDiv
            isEditing={isEditingDescription}
            aria-label="Description"
          >
            {isEditingDescription ? (
              <EditableTextarea
                ref={descriptionInput}
                value={desc}
                onChange={(e) => handleChange(e, setDesc)}
                onBlur={() =>
                  handleBlur("description", setIsEditingDescription)
                }
                onKeyDown={(e) =>
                  handleKeyDown(
                    e,
                    "description",
                    setDesc,
                    setIsEditingDescription
                  )
                }
                aria-label="Description Input"
              />
            ) : (
              desc
            )}
          </DescriptionDiv>
        </CardBody>
      </CustomCard>
      {showThumbnailModal && (
        <DashboardThumbnailModal
          showModal={showThumbnailModal}
          setShowModal={setShowThumbnailModal}
          onUpdateThumbnail={onUpdateThumbnail}
        />
      )}
    </>
  );
};

export const NewDashboardCard = () => {
  const [showNewDashboardModal, setShowNewDashboardModal] = useState(false);
  const { setAppTourStep, activeAppTour } = useAppTourContext();

  const onClick = () => {
    setShowNewDashboardModal(true);
    if (activeAppTour) {
      setAppTourStep((previousStep) => previousStep + 1);
    }
  };

  return (
    <>
      <CustomCard newCard={true} className="create-new-card">
        <CardBody>
          <NewDashboardDiv
            onClick={onClick}
            onMouseOver={(e) => (e.target.style.cursor = "pointer")}
            onMouseOut={(e) => (e.target.style.cursor = "default")}
            aria-label="Create New Card"
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

export const NoDashboardCard = () => {
  return (
    <CustomCard newCard={true}>
      <Card.Body>
        <NewDashboardDiv>
          <p>There are no available public dashboards</p>
        </NewDashboardDiv>
      </Card.Body>
    </CustomCard>
  );
};

DashboardCard.propTypes = {
  id: PropTypes.number,
  name: PropTypes.string,
  editable: PropTypes.bool,
  description: PropTypes.string,
  accessGroups: PropTypes.arrayOf(PropTypes.string),
  image: PropTypes.string,
};

export default memo(DashboardCard);

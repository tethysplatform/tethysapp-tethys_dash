import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Alert from "react-bootstrap/Alert";
import Table from "react-bootstrap/Table";
import Form from "react-bootstrap/Form";
import DataRadioSelect from "components/inputs/DataRadioSelect";
import PropTypes from "prop-types";
import { useState, useEffect, useContext, memo } from "react";
import {
  AvailableDashboardsContext,
  AppContext,
  PermissionGroupContext,
} from "components/contexts/Contexts";
import styled from "styled-components";
import TooltipButton from "components/buttons/TooltipButton";
import Dropdown from "react-bootstrap/Dropdown";
import DropdownButton from "react-bootstrap/DropdownButton";
import { getPublicUrl } from "services/utilities";
import { BsClipboard, BsFillTrashFill } from "react-icons/bs";

const PERMISSION_LEVELS = ["admin", "editor", "viewer"];

const FlexDiv = styled.div`
  display: flex;
  width: 100%;
`;

const ButtonDiv = styled.div`
  margin-bottom: 1rem;
`;

const UrlDiv = styled.div`
  flex: 1;
  margin-right: 1rem;
  overflow-x: auto;
`;

const TableContainer = styled.div`
  max-height: 40vh;
  overflow-y: auto;
  margin-bottom: 1rem;
  width: 100%;
`;

const AddUserContainer = styled.div`
  display: flex;
  gap: 10px;
  margin-bottom: 1rem;
`;

const UserInput = styled.input`
  flex-grow: 1;
`;

const StyledTable = styled(Table)`
  table-layout: fixed;
  max-width: 100%;
`;

const TableHeader = styled.th`
  max-width: ${(props) => props.maxWidth || "auto"};
  width: ${(props) => props.width || "auto"};
  text-align: center;
`;

const TableCell = styled.td`
  max-width: ${(props) => props.maxWidth || "auto"};
  width: ${(props) => props.width || "auto"};
  display: ${(props) => (props.flex ? "flex" : "table-cell")};
  align-items: ${(props) => (props.flex ? "center" : "inherit")};
  gap: ${(props) => props.gap || "0"};
`;

const UsernameContainer = styled.div`
  max-width: 100%;
  overflow-x: auto;
  white-space: nowrap;
`;

function PermissionsModal({
  showModal,
  setShowModal,
  uuid,
  publicDashboard,
  userPermission,
  permissions,
  id,
  owner,
  onSave = () => {},
}) {
  const { permissionGroups } = useContext(PermissionGroupContext);
  const { updateDashboard } = useContext(AvailableDashboardsContext);
  const { user } = useContext(AppContext);
  const [publicStatus, setPublicStatus] = useState(publicDashboard);
  const [nameInput, setNameInput] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [dashboardPermissions, setDashboardPermissions] = useState(permissions);
  const [copyClipboardSuccess, setCopyClipboardSuccess] = useState(null);

  useEffect(() => {
    setDashboardPermissions(permissions);
  }, [permissions]);

  useEffect(() => {
    setPublicStatus(publicDashboard);
  }, [publicDashboard]);

  const publicStatusOptions = [
    { label: "Public", value: true },
    { label: "Private", value: false },
  ];

  function onPublicChange(e) {
    setPublicStatus(e.target.value === "true");
  }

  const handleModalClose = () => {
    setShowModal(false);
    setErrorMessage(null);
    setNameInput("");
  };

  const handleAdd = (type) => {
    setErrorMessage(null);
    if (!nameInput.trim()) {
      setErrorMessage("Username cannot be empty.");
      return;
    }

    if (
      dashboardPermissions.some((perm) =>
        type === "user"
          ? perm.username === nameInput.trim()
          : perm.group === nameInput.trim()
      )
    ) {
      setErrorMessage(`This ${type} is already in the list.`);
      return;
    }

    const newPermission =
      type === "user"
        ? { username: nameInput.trim(), permission: "viewer" }
        : { group: nameInput.trim(), permission: "viewer" };

    setDashboardPermissions([...dashboardPermissions, newPermission]);
    setNameInput("");
  };

  const handlePermissionChange = (index, newPermission) => {
    const updated = dashboardPermissions.map((perm, i) =>
      i === index ? { ...perm, permission: newPermission } : perm
    );
    setDashboardPermissions(updated);
  };

  const handleSave = async () => {
    setSuccessMessage("");
    setErrorMessage("");
    const newProperties = {
      permissions: dashboardPermissions,
      public: publicStatus,
    };
    const apiResponse = await updateDashboard({ id, newProperties });
    if (apiResponse["success"]) {
      setSuccessMessage("Successfully updated dashboard settings");
      onSave(newProperties);
    } else {
      setErrorMessage(
        apiResponse["message"] ??
          "Failed to update dashboard settings. Check server logs."
      );
    }
  };

  const handleCopyURLClick = async () => {
    const dashboardPublicUrl = getPublicUrl(uuid);
    try {
      await window.navigator.clipboard.writeText(dashboardPublicUrl);
      setCopyClipboardSuccess(true);
    } catch (err) {
      setCopyClipboardSuccess(false);
    }
  };

  return (
    <Modal show={showModal} onHide={handleModalClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>Manage Permissions</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {errorMessage && (
          <Alert
            key="danger"
            variant="danger"
            onClose={() => setErrorMessage("")}
            dismissible={true}
          >
            {errorMessage}
          </Alert>
        )}
        {successMessage && (
          <Alert
            key="success"
            variant="success"
            onClose={() => setSuccessMessage("")}
            dismissible={true}
          >
            {successMessage}
          </Alert>
        )}
        {userPermission === "admin" && (
          <AddUserContainer>
            <UserInput
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Add people or groups"
              aria-label="Username Input"
              className="form-control"
            />
            <DropdownButton aria-label="Add Button" title="Add">
              <Dropdown.Item
                aria-label="Add User"
                onClick={() => handleAdd("user")}
              >
                User
              </Dropdown.Item>
              <Dropdown.Item
                aria-label="Add Group"
                onClick={() => handleAdd("group")}
              >
                Group
              </Dropdown.Item>
            </DropdownButton>
          </AddUserContainer>
        )}
        <TableContainer>
          <StyledTable bordered hover>
            <thead>
              <tr>
                <TableHeader maxWidth="40%" width="40%">
                  Username/Group
                </TableHeader>
                <TableHeader width="20%">Type</TableHeader>
                <TableHeader>Permission Level</TableHeader>
              </tr>
            </thead>
            <tbody>
              {dashboardPermissions.map((perm, idx) => (
                <tr
                  key={
                    perm.group
                      ? `group-${perm.group}`
                      : `user-${perm.username}-${idx}`
                  }
                >
                  <TableCell maxWidth="40%" width="40%">
                    <UsernameContainer>
                      {perm.group
                        ? `${perm.group}${
                            permissionGroups.some(
                              (g) =>
                                g.name === perm.group &&
                                g.members.some(
                                  (m) => m.username === user.username
                                )
                            )
                              ? " (you)"
                              : ""
                          }`
                        : perm.username === user.username
                          ? `${perm.username} (you)`
                          : perm.username}
                    </UsernameContainer>
                  </TableCell>
                  <TableCell width="20%">
                    {perm.group ? "Group" : "User"}
                  </TableCell>
                  <TableCell flex gap="8px">
                    {perm.username === owner ? (
                      <span>Owner</span>
                    ) : userPermission === "admin" &&
                      perm.username !== user.username ? (
                      <>
                        <Form.Select
                          value={perm.permission}
                          onChange={(e) =>
                            handlePermissionChange(idx, e.target.value)
                          }
                          aria-label={`Permission level for ${perm.username ? perm.username + " user" : perm.group + " group"}`}
                        >
                          {PERMISSION_LEVELS.map((level) => (
                            <option key={level} value={level}>
                              {level.charAt(0).toUpperCase() + level.slice(1)}
                            </option>
                          ))}
                        </Form.Select>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => {
                            setDashboardPermissions(
                              dashboardPermissions.filter((_, i) => i !== idx)
                            );
                          }}
                          aria-label={`Delete permission for ${perm.username ? perm.username + " user" : perm.group + " group"}`}
                        >
                          <BsFillTrashFill />
                        </Button>
                      </>
                    ) : (
                      <span>
                        {perm.permission.charAt(0).toUpperCase() +
                          perm.permission.slice(1)}
                      </span>
                    )}
                  </TableCell>
                </tr>
              ))}
            </tbody>
          </StyledTable>
        </TableContainer>
        {userPermission === "admin" && (
          <DataRadioSelect
            label={"Public Status"}
            selectedRadio={publicStatus}
            radioOptions={publicStatusOptions}
            onChange={onPublicChange}
          />
        )}
        <label>
          <b>URL</b>:
        </label>
        <FlexDiv>
          <ButtonDiv>
            <TooltipButton
              tooltipPlacement={"right"}
              tooltipText={
                copyClipboardSuccess === null
                  ? "Copy to clipboard"
                  : copyClipboardSuccess
                    ? "Copied"
                    : "Failed to Copy"
              }
              variant={"warning"}
              onClick={handleCopyURLClick}
              aria-label={"Copy Clipboard Button"}
            >
              <BsClipboard />
            </TooltipButton>
          </ButtonDiv>
          <UrlDiv>{getPublicUrl(uuid)}</UrlDiv>
        </FlexDiv>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="secondary"
          onClick={handleModalClose}
          aria-label="Close Modal Button"
        >
          Close
        </Button>
        {userPermission === "admin" && (
          <Button
            variant="success"
            onClick={handleSave}
            aria-label="Save Permissions Button"
          >
            Save
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
}

PermissionsModal.propTypes = {
  showModal: PropTypes.bool.isRequired,
  setShowModal: PropTypes.func.isRequired,
  uuid: PropTypes.string.isRequired,
  publicDashboard: PropTypes.bool.isRequired,
  userPermission: PropTypes.oneOf(["admin", "editor", "viewer"]).isRequired,
  permissions: PropTypes.arrayOf(
    PropTypes.shape({
      username: PropTypes.string,
      group: PropTypes.string,
      permission: PropTypes.oneOf(["admin", "editor", "viewer"]).isRequired,
    })
  ).isRequired,
  id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  owner: PropTypes.string.isRequired,
  onSave: PropTypes.func,
};

export default memo(PermissionsModal);

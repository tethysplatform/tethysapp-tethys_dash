import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Alert from "react-bootstrap/Alert";
import Table from "react-bootstrap/Table";
import Form from "react-bootstrap/Form";
import DataRadioSelect from "components/inputs/DataRadioSelect";
import PropTypes from "prop-types";
import { useState, useEffect, useContext, memo } from "react";
import {
  LayoutContext,
  AppContext,
  PermissionGroupContext,
} from "components/contexts/Contexts";
import styled from "styled-components";
import TooltipButton from "components/buttons/TooltipButton";
import Dropdown from "react-bootstrap/Dropdown";
import DropdownButton from "react-bootstrap/DropdownButton";
import { getPublicUrl } from "services/utilities";
import { BsClipboard } from "react-icons/bs";

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

function PermissionsModal({ showModal, setShowModal }) {
  const {
    uuid,
    publicDashboard,
    userPermission,
    permissions,
    saveLayoutContext,
    owner,
  } = useContext(LayoutContext);
  const { permissionGroups } = useContext(PermissionGroupContext);
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

  const handleSave = () => {
    setSuccessMessage("");
    setErrorMessage("");
    const newProperties = {
      permissions: dashboardPermissions,
      public: publicStatus,
    };
    saveLayoutContext(newProperties).then((response) => {
      if (response["success"]) {
        setSuccessMessage("Successfully updated dashboard settings");
      } else {
        setErrorMessage(
          response["message"] ??
            "Failed to update dashboard settings. Check server logs."
        );
      }
    });
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
          <div
            style={{
              display: "flex",
              gap: "10px",
              marginBottom: "1rem",
            }}
          >
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Add people or groups"
              style={{ flexGrow: 1 }}
              aria-label="Username Input"
              className="form-control"
            />
            <DropdownButton aria-label="Add Button" title="Add">
              <Dropdown.Item onClick={() => handleAdd("user")}>
                User
              </Dropdown.Item>
              <Dropdown.Item onClick={() => handleAdd("group")}>
                Group
              </Dropdown.Item>
            </DropdownButton>
          </div>
        )}
        <TableContainer>
          <Table
            bordered
            hover
            style={{ tableLayout: "fixed", maxWidth: "100%" }}
          >
            <thead>
              <tr>
                <th style={{ maxWidth: "50%", width: "50%" }}>
                  Username/Group
                </th>
                <th>Permission Level</th>
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
                  <td style={{ maxWidth: "50%", width: "50%" }}>
                    <div
                      style={{
                        maxWidth: "100%",
                        overflowX: "auto",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {perm.group
                        ? `${perm.group} (group)${
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
                    </div>
                  </td>
                  <td
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
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
                          aria-label={`Permission level for ${perm.username}`}
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
                          aria-label={`Delete permission for ${perm.username}`}
                        >
                          Delete
                        </Button>
                      </>
                    ) : (
                      <span>
                        {perm.permission.charAt(0).toUpperCase() +
                          perm.permission.slice(1)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
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
              style={{ display: "flex" }}
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
};

export default memo(PermissionsModal);

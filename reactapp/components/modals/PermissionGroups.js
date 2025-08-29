import { useState, useContext } from "react";
import { Modal, Button, Table } from "react-bootstrap";
import Alert from "react-bootstrap/Alert";
import styled from "styled-components";
import {
  PermissionGroupContext,
  AppContext,
} from "components/contexts/Contexts";
import Form from "react-bootstrap/Form";
import PropTypes from "prop-types";

const PERMISSION_LEVELS = ["admin", "member"];

const TableContainer = styled.div`
  max-height: 40vh;
  overflow-y: auto;
  margin-bottom: 1rem;
  width: 100%;
`;

// Summary Modal: shows all groups and a button to open manage modal
const PermissionGroupsSummaryModal = ({ showModal, setShowModal }) => {
  const [showManageModal, setShowManageModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState();
  const { permissionGroups, deletePermissionGroup } = useContext(
    PermissionGroupContext
  );
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const onDelete = async (id, name) => {
    const deleteResponse = await deletePermissionGroup(id);
    if (deleteResponse.success) {
      setSuccessMessage(`Permission group "${name}" deleted successfully.`);
    } else {
      setErrorMessage(deleteResponse.message);
    }
    setSelectedGroup(false);
  };

  const onCreate = () => {
    setSelectedGroup(null);
    setShowManageModal(true);
  };

  const onView = (group) => {
    setSelectedGroup(group);
    setShowManageModal(true);
  };

  return (
    <>
      <Modal
        show={showModal}
        onHide={() => setShowModal(false)}
        size="lg"
        centered
        style={showManageModal && { zIndex: 1050 }}
      >
        <Modal.Header closeButton>
          <Modal.Title>Permission Groups</Modal.Title>
        </Modal.Header>
        <Modal.Body>
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
          <div className="mb-3">
            <h5>Existing Groups</h5>
            <TableContainer>
              <Table bordered hover size="sm">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Permission Level</th>
                    <th
                      style={{
                        width: "1%",
                        whiteSpace: "nowrap",
                        textAlign: "center",
                      }}
                    ></th>
                  </tr>
                </thead>
                <tbody>
                  {permissionGroups && permissionGroups.length > 0 ? (
                    permissionGroups.map((group) => (
                      <tr key={group.id}>
                        <td
                          style={{
                            wordBreak: "break-word",
                            whiteSpace: "normal",
                          }}
                        >
                          {group.name}
                        </td>
                        <td
                          style={{
                            wordBreak: "break-word",
                            whiteSpace: "normal",
                          }}
                        >
                          {group.description}
                        </td>
                        <td
                          style={{
                            wordBreak: "break-word",
                            whiteSpace: "normal",
                          }}
                        >
                          {group.user_permission}
                        </td>
                        <td
                          style={{
                            width: "1%",
                            whiteSpace: "nowrap",
                            textAlign: "center",
                          }}
                        >
                          <Button
                            variant={
                              group.user_permission === "admin"
                                ? "warning"
                                : "primary"
                            }
                            size="sm"
                            onClick={() => onView(group)}
                            aria-label={`${
                              group.user_permission === "admin"
                                ? "Edit"
                                : "View"
                            } group ${group.name}`}
                          >
                            {group.user_permission === "admin"
                              ? "Edit"
                              : "View"}
                          </Button>
                          {group.user_permission === "admin" && (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => onDelete(group.id, group.name)}
                              aria-label={`Delete group ${group.name}`}
                              style={{ marginLeft: "10px" }}
                            >
                              Delete
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="text-center">
                        No groups found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </TableContainer>
            <div className="d-flex justify-content-end">
              <Button
                aria-label="Create new permission group"
                variant="primary"
                onClick={onCreate}
              >
                Create New Group
              </Button>
            </div>
          </div>
        </Modal.Body>
      </Modal>
      {showManageModal && (
        <PermissionGroupsManageModal
          showModal={showManageModal}
          setShowModal={setShowManageModal}
          selectedGroup={selectedGroup}
          setSuccessMessage={setSuccessMessage}
        />
      )}
    </>
  );
};

// Manage Modal: create/edit/delete groups and members
const PermissionGroupsManageModal = ({
  showModal,
  setShowModal,
  selectedGroup,
  setSuccessMessage,
}) => {
  const { user } = useContext(AppContext);
  const { updatePermissionGroup, deletePermissionGroup } = useContext(
    PermissionGroupContext
  );
  const [newGroupName, setNewGroupName] = useState(selectedGroup?.name ?? "");
  const [newGroupDesc, setNewGroupDesc] = useState(
    selectedGroup?.description ?? ""
  );
  const [groupUsers, setGroupUsers] = useState(
    selectedGroup
      ? selectedGroup.members
      : [{ username: user.username, permission: "admin" }]
  );
  const [usernameInput, setUsernameInput] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const owner = selectedGroup?.owner ?? user.username;

  const handleRemoveUser = (username) => {
    setGroupUsers(groupUsers.filter((u) => u.username !== username));
  };

  // Handle saving changes to an existing group
  const handleSaveGroup = async () => {
    const response = await updatePermissionGroup({
      id: selectedGroup?.id ?? null,
      name: newGroupName,
      description: newGroupDesc,
      members: groupUsers,
    });

    if (response.success) {
      // Reset modal state for new group creation
      if (!selectedGroup) {
        setNewGroupName("");
        setNewGroupDesc("");
        setGroupUsers([{ username: user.username, permission: "admin" }]);
        setUsernameInput("");
        setErrorMessage("");
      }
      if (selectedGroup?.id) {
        setSuccessMessage(
          `Permission group "${selectedGroup.name}" updated successfully.`
        );
      } else {
        setSuccessMessage(
          `Permission group "${newGroupName}" created successfully.`
        );
      }
      setShowModal(false);
    } else {
      setErrorMessage(response.message);
    }
  };

  // Handle deleting a group
  const handleDeleteGroup = async () => {
    const deleteResponse = await deletePermissionGroup(selectedGroup.id);
    if (deleteResponse.success) {
      setSuccessMessage(
        `Permission group "${selectedGroup.name}" deleted successfully.`
      );
      setShowModal(false);
    } else {
      setErrorMessage(deleteResponse.message);
    }
  };

  const handleAddUser = (e) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!usernameInput.trim()) {
      setErrorMessage("Username cannot be empty.");
      return;
    }
    if (groupUsers.some((user) => user.username === usernameInput.trim())) {
      setErrorMessage("This user is already in the list.");
      return;
    }
    setGroupUsers([
      ...groupUsers,
      { username: usernameInput.trim(), permission: "member" },
    ]);
    setUsernameInput("");
  };

  const handlePermissionChange = (index, newPermission) => {
    const updated = groupUsers.map((perm, i) =>
      i === index ? { ...perm, permission: newPermission } : perm
    );
    setGroupUsers(updated);
  };

  return (
    <Modal
      show={showModal}
      onHide={() => setShowModal(false)}
      size="lg"
      centered
    >
      <Modal.Header closeButton>
        <Modal.Title>Manage Permission Groups</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <form>
          <div className="mb-2">
            {!selectedGroup || selectedGroup?.user_permission === "admin" ? (
              <>
                <label>Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={newGroupName}
                  onChange={(e) => {
                    setNewGroupName(e.target.value);
                  }}
                  placeholder="Enter group name"
                  maxLength={100}
                  aria-label="Name Input"
                />
                <div style={{ fontSize: "0.8em", color: "#888" }}>
                  {newGroupName.length}/100
                </div>
              </>
            ) : (
              <h5>
                <b>Name:</b> {selectedGroup.name}
              </h5>
            )}
          </div>
          <div className="mb-2">
            {!selectedGroup || selectedGroup?.user_permission === "admin" ? (
              <>
                <label>Description</label>
                <input
                  type="text"
                  className="form-control"
                  value={newGroupDesc}
                  onChange={(e) => {
                    setNewGroupDesc(e.target.value);
                  }}
                  placeholder="Enter group description"
                  maxLength={200}
                  aria-label="Description Input"
                />
                <div style={{ fontSize: "0.8em", color: "#888" }}>
                  {newGroupDesc.length}/200
                </div>
              </>
            ) : (
              <h5>
                <b>Description:</b> {selectedGroup.description}
              </h5>
            )}
          </div>
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
          {(!selectedGroup || selectedGroup?.user_permission === "admin") && (
            <div className="mb-2">
              <label>Add Users</label>
              <div
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <input
                  type="text"
                  className="form-control"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="Add people"
                  style={{ flexGrow: 1 }}
                  aria-label="Username Input"
                />
                <Button
                  variant="primary"
                  onClick={handleAddUser}
                  style={{ whiteSpace: "nowrap" }}
                  aria-label="Add User Button"
                >
                  Add User
                </Button>
              </div>
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
                  <th style={{ maxWidth: "50%", width: "50%" }}>Username</th>
                  <th>Permission Level</th>
                </tr>
              </thead>
              <tbody>
                {groupUsers.map((groupUser, idx) => (
                  <tr key={groupUser.username}>
                    <td style={{ maxWidth: "50%", width: "50%" }}>
                      <div
                        style={{
                          maxWidth: "100%",
                          overflowX: "auto",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {groupUser.username === user.username
                          ? `${groupUser.username} (you)`
                          : groupUser.username}
                      </div>
                    </td>
                    <td
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      {groupUser.username === owner ? (
                        <span>Owner</span>
                      ) : groupUser.username !== user.username ? ( // add back userPermission === "admin"  when handling group permissions again
                        <>
                          <Form.Select
                            value={groupUser.permission}
                            onChange={(e) =>
                              handlePermissionChange(idx, e.target.value)
                            }
                            aria-label={`Permission level for ${groupUser.username}`}
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
                              handleRemoveUser(groupUser.username);
                            }}
                            aria-label={`Delete permission for ${groupUser.username}`}
                          >
                            Delete
                          </Button>
                        </>
                      ) : (
                        <span>
                          {groupUser.permission.charAt(0).toUpperCase() +
                            groupUser.permission.slice(1)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableContainer>
        </form>
      </Modal.Body>

      {(!selectedGroup || selectedGroup?.user_permission === "admin") && (
        <Modal.Footer>
          {selectedGroup ? (
            <>
              <Button
                aria-label="Delete Group"
                variant="danger"
                onClick={handleDeleteGroup}
              >
                Delete Group
              </Button>
              <Button
                aria-label="Save Changes"
                variant="success"
                className="me-2"
                onClick={handleSaveGroup}
              >
                Save Changes
              </Button>
            </>
          ) : (
            <Button
              aria-label="Create Group"
              variant="primary"
              onClick={handleSaveGroup}
            >
              Create Group
            </Button>
          )}
        </Modal.Footer>
      )}
    </Modal>
  );
};

PermissionGroupsSummaryModal.propTypes = {
  showModal: PropTypes.bool.isRequired,
  setShowModal: PropTypes.func.isRequired,
};

PermissionGroupsManageModal.propTypes = {
  showModal: PropTypes.bool.isRequired,
  setShowModal: PropTypes.func.isRequired,
  selectedGroup: PropTypes.shape({
    id: PropTypes.number.isRequired,
    name: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    members: PropTypes.arrayOf(
      PropTypes.shape({
        username: PropTypes.string,
        permission: PropTypes.string.isRequired,
      })
    ).isRequired,
    owner: PropTypes.string.isRequired,
    user_permission: PropTypes.string.isRequired,
  }),
  setSuccessMessage: PropTypes.func.isRequired,
};

export { PermissionGroupsSummaryModal, PermissionGroupsManageModal };

import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Alert from "react-bootstrap/Alert";
import Table from "react-bootstrap/Table";
import Form from "react-bootstrap/Form";
import Accordion from "react-bootstrap/Accordion";
import PropTypes from "prop-types";
import appAPI from "services/api/app";
import { useEffect, useState, useContext } from "react";
import {
  AppContext,
  PermissionGroupContext,
} from "components/contexts/Contexts";
import styled from "styled-components";
import Dropdown from "react-bootstrap/Dropdown";
import DropdownButton from "react-bootstrap/DropdownButton";
import { BsFillTrashFill } from "react-icons/bs";

const FlexDiv = styled.div`
  display: flex;
  width: 100%;
  gap: 8px;
  margin-bottom: 1rem;
`;

const TableContainer = styled.div`
  max-height: 30vh;
  overflow-y: auto;
  margin-bottom: 1rem;
  width: 100%;
`;

const TableHeader = styled.th`
  width: ${(props) => props.width || "auto"};
  text-align: center;
`;

const TableCell = styled.td`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const AccordionHeaderContent = styled.div`
  .text-muted {
    color: #6c757d;
  }
`;

function VisualizationPermissionsModal({ showModal, setShowModal }) {
  const { permissionGroups } = useContext(PermissionGroupContext);
  const { user, csrf } = useContext(AppContext);
  const [visualizationPermissions, setVisualizationPermissions] = useState({});
  const [nameInput, setNameInput] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchPermissions = async () => {
      setLoading(true);
      try {
        const response = await appAPI.listVisualizationPermissions();
        if (response.success) {
          setVisualizationPermissions(response.visualization_permissions);
        } else {
          setErrorMessage(
            response.message || "Failed to fetch visualization permissions"
          );
        }
      } catch (error) {
        console.error("Failed to fetch visualization permissions:", error);
        setErrorMessage("Failed to load visualization permissions");
      } finally {
        setLoading(false);
      }
    };

    if (showModal) {
      fetchPermissions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal]);

  const handleModalClose = () => {
    setShowModal(false);
    setErrorMessage("");
    setSuccessMessage("");
    setNameInput("");
  };

  const handleAddUser = (visualizationName) => {
    setErrorMessage("");
    if (!nameInput.trim()) {
      setErrorMessage("Username cannot be empty.");
      return;
    }

    const currentViz = visualizationPermissions[visualizationName];

    if (currentViz.users.includes(nameInput.trim())) {
      setErrorMessage("This user already has access to this visualization.");
      return;
    }

    setVisualizationPermissions({
      ...visualizationPermissions,
      [visualizationName]: {
        ...currentViz,
        users: [...currentViz.users, nameInput.trim()],
      },
    });
    setNameInput("");
  };

  const handleAddGroup = (visualizationName) => {
    setErrorMessage("");
    if (!nameInput.trim()) {
      setErrorMessage("Group name cannot be empty.");
      return;
    }

    const currentViz = visualizationPermissions[visualizationName];

    if (currentViz.groups.includes(nameInput.trim())) {
      setErrorMessage("This group already has access to this visualization.");
      return;
    }

    setVisualizationPermissions({
      ...visualizationPermissions,
      [visualizationName]: {
        ...currentViz,
        groups: [...currentViz.groups, nameInput.trim()],
      },
    });
    setNameInput("");
  };

  const handleRemoveUser = (visualizationName, username) => {
    const currentViz = visualizationPermissions[visualizationName];
    setVisualizationPermissions({
      ...visualizationPermissions,
      [visualizationName]: {
        ...currentViz,
        users: currentViz.users.filter((u) => u !== username),
      },
    });
  };

  const handleRemoveGroup = (visualizationName, groupName) => {
    const currentViz = visualizationPermissions[visualizationName];
    setVisualizationPermissions({
      ...visualizationPermissions,
      [visualizationName]: {
        ...currentViz,
        groups: currentViz.groups.filter((g) => g !== groupName),
      },
    });
  };

  const handleSave = async () => {
    setLoading(true);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      const apiResponse = await appAPI.updateVisualizationPermissions(
        { permissions: visualizationPermissions },
        csrf
      );

      if (apiResponse.success) {
        setSuccessMessage("Successfully updated visualization permissions");
      } else {
        setErrorMessage(
          apiResponse.message || "Failed to update visualization permissions"
        );
      }
    } catch (error) {
      console.error("Error updating visualization permissions:", error);
      setErrorMessage("Failed to update visualization permissions");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Modal size="lg" show={showModal} onHide={handleModalClose} centered>
        <Modal.Header closeButton>
          <Modal.Title>Manage Visualization Permissions</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loading && <div>Loading...</div>}

          {errorMessage && (
            <Alert
              variant="danger"
              dismissible
              onClose={() => setErrorMessage("")}
            >
              {errorMessage}
            </Alert>
          )}

          {successMessage && (
            <Alert
              variant="success"
              dismissible
              onClose={() => setSuccessMessage("")}
            >
              {successMessage}
            </Alert>
          )}

          <p>
            Manage which users and groups have access to specific
            visualizations. Only users with access can use these visualizations
            in their dashboards.
          </p>

          <Accordion>
            {Object.keys(visualizationPermissions).map((vizName) => {
              const currentPermissions = visualizationPermissions[vizName];
              const vizInfo = currentPermissions.info;

              return (
                <Accordion.Item key={vizName} eventKey={vizName}>
                  <Accordion.Header>
                    <AccordionHeaderContent>
                      <strong>{vizInfo.label}</strong>
                      <br />
                      <small className="text-muted">
                        {currentPermissions.users.length +
                          currentPermissions.groups.length}{" "}
                        permission(s)
                      </small>
                    </AccordionHeaderContent>
                  </Accordion.Header>
                  <Accordion.Body>
                    <p className="text-muted">{vizInfo.description}</p>

                    {/* Add User/Group Section */}
                    <FlexDiv>
                      <Form.Control
                        type="text"
                        placeholder="Enter username or group name"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        aria-label="Username or Group Input"
                      />
                      <DropdownButton
                        id={`add-dropdown-${vizName}`}
                        title="Add"
                        variant="primary"
                      >
                        <Dropdown.Item onClick={() => handleAddUser(vizName)}>
                          Add User
                        </Dropdown.Item>
                        <Dropdown.Item onClick={() => handleAddGroup(vizName)}>
                          Add Group
                        </Dropdown.Item>
                      </DropdownButton>
                    </FlexDiv>

                    {/* Permissions Table */}
                    {(currentPermissions.users.length > 0 ||
                      currentPermissions.groups.length > 0) && (
                      <TableContainer>
                        <Table striped bordered hover size="sm">
                          <thead>
                            <tr>
                              <TableHeader width="75%">User/Group</TableHeader>
                              <TableHeader>Type</TableHeader>
                            </tr>
                          </thead>
                          <tbody>
                            {currentPermissions.users.map((username) => (
                              <tr key={`user-${username}`}>
                                <td>
                                  {username === user.username
                                    ? `${username} (you)`
                                    : username}
                                </td>
                                <TableCell flex>
                                  User
                                  <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={() =>
                                      handleRemoveUser(vizName, username)
                                    }
                                  >
                                    <BsFillTrashFill />
                                  </Button>
                                </TableCell>
                              </tr>
                            ))}
                            {currentPermissions.groups.map((groupName) => {
                              const group = permissionGroups.find(
                                (g) => g.name === groupName
                              );
                              const userInGroup = group?.members.some(
                                (m) => m.username === user.username
                              );
                              return (
                                <tr key={`group-${groupName}`}>
                                  <td>
                                    {groupName}
                                    {userInGroup ? " (you)" : ""}
                                  </td>
                                  <TableCell flex>
                                    Group
                                    <Button
                                      variant="danger"
                                      size="sm"
                                      onClick={() =>
                                        handleRemoveGroup(vizName, groupName)
                                      }
                                    >
                                      <BsFillTrashFill />
                                    </Button>
                                  </TableCell>
                                </tr>
                              );
                            })}
                          </tbody>
                        </Table>
                      </TableContainer>
                    )}

                    {currentPermissions.users.length === 0 &&
                      currentPermissions.groups.length === 0 && (
                        <p className="text-muted">
                          No permissions set for this visualization.
                        </p>
                      )}
                  </Accordion.Body>
                </Accordion.Item>
              );
            })}
          </Accordion>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleModalClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

VisualizationPermissionsModal.propTypes = {
  showModal: PropTypes.bool,
  setShowModal: PropTypes.func,
};

export default VisualizationPermissionsModal;

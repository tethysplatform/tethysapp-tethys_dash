import { useState, useContext, memo } from "react";
import Tab from "react-bootstrap/Tab";
import Tabs from "react-bootstrap/Tabs";
import { TabContext, EditingContext } from "components/contexts/Contexts";
import DashboardLayout from "./DashboardLayout";
import { BsX } from "react-icons/bs";
import styled from "styled-components";
import { confirm } from "components/inputs/DeleteConfirmation";

const EditableTabTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  width: 100%;
  justify-content: center;
  opacity: ${(props) => (props.isDragging ? 0.5 : 1)};
  background-color: ${(props) =>
    props.isDropTarget ? "rgba(0, 123, 255, 0.1)" : "transparent"};
  border-radius: 4px;
  transition: background-color 0.2s ease;
`;

const TabTitleInput = styled.input`
  background: none;
  border: none;
  color: inherit;
  font: inherit;
  padding: 0;
  margin: 0;
  min-width: 0;
  max-width: none;
  text-align: center;
  flex: 1;

  &:focus {
    outline: 1px solid #007bff;
    outline-offset: 1px;
    border-radius: 2px;
  }
`;

const TabTitleText = styled.span`
  cursor: ${(props) => (props.isActive ? "pointer" : "default")};
  min-width: 0;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  flex: 1;

  &:hover {
    background-color: ${(props) =>
      props.isActive ? "rgba(0, 123, 255, 0.1)" : "transparent"};
    border-radius: 2px;
  }
`;

const DeleteButton = styled.button`
  background: none;
  border: none;
  color: #dc3545;
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  border-radius: 2px;

  &:hover {
    background-color: rgba(220, 53, 69, 0.1);
  }
`;

const StyledTabs = styled(Tabs)`
  display: ${(props) => (props.shouldHideTabBar ? "none" : "flex")};

  .nav-item {
    flex: 1;
  }

  .nav-link {
    text-align: center;
    width: 100%;
    background-color: #e3f2fd;
    border: 1px solid #d0d0d0;
    color: #333;

    &:hover {
      background-color: #bbdefb;
    }

    &.active {
      background-color: white;
      border-right: 1px solid #999;
      border-left: 1px solid #999;
      color: #333;
    }
  }
`;

const DashboardTabs = () => {
  const { isEditing } = useContext(EditingContext);
  const {
    tabs,
    addTab,
    setActiveTabId,
    activeTabId,
    updateTab,
    deleteTab,
    reorderTabs,
  } = useContext(TabContext);
  const [editingTabId, setEditingTabId] = useState(null);
  const [draggedTabId, setDraggedTabId] = useState(null);
  const [dragOverTabId, setDragOverTabId] = useState(null);

  const handleTabSelect = (selectedTabId) => {
    if (selectedTabId === "add-tab") {
      addTab();
    } else {
      // Try to parse as integer first, fall back to raw string if that fails
      const parsedTabId = parseInt(selectedTabId, 10);
      const finalTabId = isNaN(parsedTabId) ? selectedTabId : parsedTabId;
      setActiveTabId(finalTabId);
    }
  };

  const handleTabNameClick = (tabId) => {
    if (isEditing && tabId === activeTabId) {
      setEditingTabId(tabId);
    }
  };

  const handleTabNameChange = (tabId, newName) => {
    if (newName.trim()) {
      updateTab(tabId, { name: newName.trim() });
    }
    setEditingTabId(null);
  };

  const handleTabNameKeyDown = (e, tabId) => {
    if (e.key === "Enter") {
      handleTabNameChange(tabId, e.target.value);
    } else if (e.key === "Escape") {
      setEditingTabId(null);
    }
  };

  const handleDeleteTab = async (e, tabId, tabName) => {
    e.stopPropagation();
    if (
      await confirm(`Are you sure you want to delete the tab "${tabName}"?`)
    ) {
      deleteTab(tabId);
    }
  };

  const handleDragStart = (e, tabId) => {
    setDraggedTabId(tabId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, tabId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (draggedTabId && draggedTabId !== tabId) {
      setDragOverTabId(tabId);
    }
  };

  const handleDragLeave = (e) => {
    // Only clear drag over if we're leaving the tab entirely
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverTabId(null);
    }
  };

  const handleDrop = (e, targetTabId) => {
    e.preventDefault();
    if (draggedTabId && draggedTabId !== targetTabId) {
      // Find the indices of the dragged and target tabs
      const draggedIndex = tabs.findIndex((tab) => tab.id === draggedTabId);
      const targetIndex = tabs.findIndex((tab) => tab.id === targetTabId);

      // Create a new array with reordered tabs
      const newTabs = [...tabs];
      const [draggedTab] = newTabs.splice(draggedIndex, 1);
      newTabs.splice(targetIndex, 0, draggedTab);

      reorderTabs(newTabs);
    }
    setDraggedTabId(null);
    setDragOverTabId(null);
  };

  const handleDragEnd = () => {
    setDraggedTabId(null);
    setDragOverTabId(null);
  };

  const renderTabTitle = (tab) => {
    if (!isEditing) {
      return tab.name;
    }

    const isDragging = draggedTabId === tab.id;
    const isDropTarget = dragOverTabId === tab.id && draggedTabId !== tab.id;

    return (
      <EditableTabTitle
        draggable={isEditing}
        isDragging={isDragging}
        isDropTarget={isDropTarget}
        onDragStart={(e) => handleDragStart(e, tab.id)}
        onDragOver={(e) => handleDragOver(e, tab.id)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, tab.id)}
        onDragEnd={handleDragEnd}
      >
        {editingTabId === tab.id ? (
          <TabTitleInput
            aria-label={`name-input-${tab.id}`}
            defaultValue={tab.name}
            autoFocus
            onBlur={(e) => handleTabNameChange(tab.id, e.target.value)}
            onKeyDown={(e) => handleTabNameKeyDown(e, tab.id)}
            onClick={(e) => e.stopPropagation()}
            onDragStart={(e) => e.stopPropagation()}
          />
        ) : (
          <TabTitleText
            isActive={tab.id === activeTabId}
            aria-label={`tab-title-${tab.id}`}
            onClick={() => handleTabNameClick(tab.id)}
          >
            {tab.name}
          </TabTitleText>
        )}

        {isEditing && tabs.length > 1 && (
          <DeleteButton onClick={(e) => handleDeleteTab(e, tab.id, tab.name)}>
            <BsX size={16} />
          </DeleteButton>
        )}
      </EditableTabTitle>
    );
  };

  // Hide tab bar when there's only one tab and not editing
  const shouldHideTabBar = tabs.length === 1 && !isEditing;

  return (
    <StyledTabs
      className="dashboard-tabs"
      activeKey={activeTabId}
      onSelect={handleTabSelect}
      shouldHideTabBar={shouldHideTabBar}
    >
      {tabs.map((tab) => (
        <Tab eventKey={tab.id} title={renderTabTitle(tab)} key={tab.id}>
          <DashboardLayout
            tabId={tab.id}
            gridItems={tab.gridItems}
            shouldLoad={tab.id === activeTabId}
          />
        </Tab>
      ))}
      {isEditing && <Tab eventKey="add-tab" title="+" aria-label="add-tab" />}
    </StyledTabs>
  );
};
export default memo(DashboardTabs);

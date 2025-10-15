import { useState, useContext } from "react";
import Tab from "react-bootstrap/Tab";
import Tabs from "react-bootstrap/Tabs";
import { TabContext, EditingContext } from "components/contexts/Contexts";
import DashboardLayout from "./DashboardLayout";

const DashboardTabs = () => {
  const { isEditing } = useContext(EditingContext);
  const { tabs, addTab, setActiveTabId, activeTabId } = useContext(TabContext);

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

  return (
    <Tabs
      className="dashboard-tabs"
      activeKey={activeTabId}
      onSelect={handleTabSelect}
    >
      {tabs.map((tab) => (
        <Tab eventKey={tab.id} title={tab.name} key={tab.id}>
          <DashboardLayout tabId={tab.id} gridItems={tab.gridItems} />
        </Tab>
      ))}
      {isEditing && (
        <Tab eventKey="add-tab" title="+">
          {/* Add tab functionality */}
        </Tab>
      )}
    </Tabs>
  );
};
export default DashboardTabs;

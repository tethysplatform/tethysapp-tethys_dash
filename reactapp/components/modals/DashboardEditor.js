import Offcanvas from "react-bootstrap/Offcanvas";
import DataRadioSelect from "components/inputs/DataRadioSelect";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import { useContext, useState, useEffect } from "react";
import {
  useLayoutContext,
  useLayoutNameContext,
} from "components/contexts/SelectedDashboardContext";
import styled from "styled-components";
import { getTethysPortalHost } from "services/utilities";
import ClipboardCopyButton from "components/buttons/ClipboardCopy";
import { confirm } from "components/dashboard/DeleteConfirmation";
import { useAvailableDashboardContext } from "components/contexts/AvailableDashboardContext";
import { useSelectedOptionContext } from "components/contexts/SelectedOptionContext";
import { useAvailableOptionsContext } from "components/contexts/AvailableOptionsContext";
import appAPI from "services/api/app";
import { AppContext } from "components/contexts/AppContext";

const APP_ROOT_URL = process.env.TETHYS_APP_ROOT_URL;

const StyledOffcanvas = styled(Offcanvas)`
  height: 100vh;
  width: 25%;
`;
const StyledDiv = styled.div`
  display: inline-block;
`;
const StyledMarginDiv = styled.div`
  display: inline-block;
  margin-right: 1rem;
`;
const StyledFooter = styled.footer`
  display: flex;
  justify-content: space-between;
  padding: 15px;
  border-top: 1px solid #ccc;
`;

function DashboardEditorCanvas({ showCanvas, setShowCanvas }) {
  const handleClose = () => setShowCanvas(false);
  const [selectedSharingStatus, setSelectedSharingStatus] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [copyClipboardSuccess, setCopyClipboardSuccess] = useState(null);
  const resetLayoutContext = useLayoutContext()[1];
  const getLayoutContext = useLayoutContext()[2];
  const name = useLayoutNameContext()[0];
  const [dashboardLayoutConfigs, setDashboardLayoutConfigs] =
    useAvailableDashboardContext();
  const dashboardPublicUrl =
    getTethysPortalHost() + APP_ROOT_URL + "dashboard/" + name;
  const [selectedOption, setSelectedOption] = useSelectedOptionContext();
  const [selectOptions, setSelectOptions] = useAvailableOptionsContext();
  const { csrf } = useContext(AppContext);

  const sharingStatusOptions = [
    { label: "Public", value: "public" },
    { label: "Private", value: "private" },
  ];

  useEffect(() => {
    const updatedLayoutContext = getLayoutContext();
    if (updatedLayoutContext["access_groups"].includes("public")) {
      setSelectedSharingStatus("public");
    } else {
      setSelectedSharingStatus("private");
    }
    // eslint-disable-next-line
  }, []);

  function onSharingChange(e) {
    setSelectedSharingStatus(e.target.value);
  }

  const handleCopyClick = async () => {
    try {
      await window.navigator.clipboard.writeText(dashboardPublicUrl);
      setCopyClipboardSuccess(true);
    } catch (err) {
      setCopyClipboardSuccess(false);
    }
  };

  function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("Successfully updated sharing status");
    // const updatedLayoutContext = getLayoutContext();
    // if (selectedSharingStatus === "public") {
    //   updatedLayoutContext["access_groups"] = ["public"];
    // } else {
    //   updatedLayoutContext["access_groups"] = [];
    // }
    // appAPI.updateDashboard(updatedLayoutContext, csrf).then((response) => {
    //   if (response["success"]) {
    //     const name = response["updated_dashboard"]["name"];
    //     let OGLayouts = Object.assign({}, dashboardLayoutConfigs);
    //     OGLayouts[name] = response["updated_dashboard"];
    //     setDashboardLayoutConfigs(OGLayouts);
    //     setLayoutContext(response["updated_dashboard"]);
    //     setSuccessMessage("Successfully updated sharing status");
    //   } else {
    //     setErrorMessage("Failed to update sharing status. Check server logs.");
    //   }
    // });
  }

  async function onDelete(e) {
    const selectedOptionValue = selectedOption["value"];

    if (
      await confirm(
        "Are your sure you want to delete the " +
          selectedOptionValue +
          " dashboard?"
      )
    ) {
      const newdashboardLayoutConfigs = Object.fromEntries(
        Object.entries(dashboardLayoutConfigs).filter(
          ([key]) => key !== selectedOptionValue
        )
      );
      const userOptions = selectOptions.find(({ label }) => label === "User");
      const userOptionsIndex = selectOptions.indexOf(userOptions);
      const deletedOptionIndex = userOptions["options"].findIndex(
        (x) => x.value === selectedOptionValue
      );
      const updatedUserOptions = userOptions["options"].toSpliced(
        deletedOptionIndex,
        1
      );
      const updatedSelectOptions = selectOptions.toSpliced(
        userOptionsIndex,
        1,
        { label: "User", options: updatedUserOptions }
      );
      appAPI
        .deleteDashboard({ name: selectedOptionValue }, csrf)
        .then((response) => {
          setDashboardLayoutConfigs(newdashboardLayoutConfigs);
          setSelectOptions(updatedSelectOptions);
          setSelectedOption(null);
          resetLayoutContext();
          handleClose();
        });
    }
  }

  return (
    <StyledOffcanvas show={showCanvas} onHide={handleClose} placement={"left"}>
      <Offcanvas.Header closeButton>
        <Offcanvas.Title>Edit Dashboard</Offcanvas.Title>
      </Offcanvas.Header>
      <Offcanvas.Body>
        {errorMessage && (
          <Alert key="danger" variant="danger" dismissible={true}>
            {errorMessage}
          </Alert>
        )}
        {successMessage && (
          <Alert key="success" variant="success" dismissible={true}>
            {successMessage}
          </Alert>
        )}
        <DataRadioSelect
          label={"Sharing Status"}
          selectedRadio={selectedSharingStatus}
          radioOptions={sharingStatusOptions}
          onChange={onSharingChange}
        />
        {selectedSharingStatus === "public" && (
          <>
            <StyledMarginDiv>
              <b>Public URL:</b>
              <br></br>
              <p>{dashboardPublicUrl}</p>
            </StyledMarginDiv>
            <StyledDiv>
              <ClipboardCopyButton
                success={copyClipboardSuccess}
                onClick={handleCopyClick}
              />
            </StyledDiv>
          </>
        )}
      </Offcanvas.Body>
      <StyledFooter>
        <Button variant="secondary" onClick={handleClose}>
          Close
        </Button>
        <Button variant="danger" onClick={onDelete}>
          Delete dashboard
        </Button>
        <Button variant="success" onClick={handleSubmit}>
          Save changes
        </Button>
      </StyledFooter>
    </StyledOffcanvas>
  );
}

export default DashboardEditorCanvas;

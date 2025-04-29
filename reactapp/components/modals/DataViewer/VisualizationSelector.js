import { useContext, useState } from "react";
import Modal from "react-bootstrap/Modal";
import PropTypes from "prop-types";
import styled from "styled-components";
import { AppContext } from "components/contexts/Contexts";
import VisualizationCard from "components/modals/DataViewer/VisualizationCard";
import VisualizationGroup from "components/modals/DataViewer/VisualizationGroup";
import { InputGroup, FormControl } from "react-bootstrap";
import Button from "react-bootstrap/Button";
import ButtonGroup from "react-bootstrap/ButtonGroup";
import { BsSearch, BsList, BsGrid } from "react-icons/bs";
import "components/modals/wideModal.css";

const StyledModalBody = styled(Modal.Body)`
  height: 75vh;
  max-height: 75vh;
  overflow-y: auto;
`;

const FlexDiv = styled.div`
  display: flex;
`;

const FlexButtonGroup = styled(ButtonGroup)`
  flex-grow: 1;
  margin-left: 1rem;
`;

const ListItem = styled.div`
  margin-left: 1rem;
  border-bottom: 1px solid black;
`;

function VisualizationSelector({ showModal, handleModalClose }) {
  const { visualizations } = useContext(AppContext);
  const [search, setSearch] = useState("");
  const [visualizationStyle, setVisualizationStyle] = useState("icon");
  const [visualizationItems, setVisualizationItems] = useState(visualizations);

  const onSearch = (e) => {
    setSearch(e.target.value);
    console.log(visualizationItems);
    const lowerQuery = e.target.value.toLowerCase();
    setVisualizationItems(
      visualizations
        .map((group) => {
          const filteredOptions = group.options.filter((option) => {
            const labelMatch = option.label.toLowerCase().includes(lowerQuery);
            const tagMatch = (option.tags || []).some((tag) =>
              tag.toLowerCase().includes(lowerQuery)
            );
            return labelMatch || tagMatch;
          });

          if (filteredOptions.length > 0) {
            return {
              label: group.label,
              options: filteredOptions,
            };
          }

          return null;
        })
        .filter((group) => group !== null)
    );
  };

  return (
    <>
      <Modal
        className="visualization-selector"
        show={showModal}
        onHide={handleModalClose}
        dialogClassName="seventyWideModalDialog"
        aria-label={"Selected Visualization Type Modal"}
      >
        <Modal.Header closeButton>
          <Modal.Title>Available Visualizations</Modal.Title>
        </Modal.Header>
        <StyledModalBody>
          <FlexDiv>
            <InputGroup>
              <FormControl
                onChange={onSearch}
                value={search}
                type="text"
                aria-label="Visualization Search Input"
                placeholder="Search by Name or Tags"
              />
              <InputGroup.Text>
                <BsSearch />
              </InputGroup.Text>
            </InputGroup>
            <FlexButtonGroup aria-label="Basic example">
              <Button
                variant={visualizationStyle === "list" ? "info" : "secondary"}
                onClick={() => setVisualizationStyle("list")}
              >
                <BsList />
              </Button>
              <Button
                variant={visualizationStyle === "icon" ? "info" : "secondary"}
                onClick={() => setVisualizationStyle("icon")}
              >
                <BsGrid />
              </Button>
            </FlexButtonGroup>
          </FlexDiv>
          {visualizationItems.map(({ label, options }, index) => (
            <VisualizationGroup key={index} title={label}>
              <>
                {options.map((metadata, index) => {
                  if (visualizationStyle === "icon") {
                    return <VisualizationCard key={index} {...metadata} />;
                  } else {
                    return <ListItem key={index}>{metadata.label}</ListItem>;
                  }
                })}
              </>
            </VisualizationGroup>
          ))}
        </StyledModalBody>
      </Modal>
    </>
  );
}

VisualizationSelector.propTypes = {
  showModal: PropTypes.bool,
  handleModalClose: PropTypes.func,
  deselectedVisualizations: PropTypes.arrayOf(PropTypes.string),
  setDeselectedVisualizations: PropTypes.func,
};

export default VisualizationSelector;

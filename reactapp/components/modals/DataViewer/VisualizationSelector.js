import { useContext, useState } from "react";
import Modal from "react-bootstrap/Modal";
import PropTypes from "prop-types";
import styled from "styled-components";
import { AppContext } from "components/contexts/Contexts";
import VisualizationCard from "components/modals/DataViewer/VisualizationCard";
import VisualizationGroup from "components/modals/DataViewer/VisualizationGroup";
import { InputGroup, FormControl } from "react-bootstrap";
import { BsSearch } from "react-icons/bs";
import "components/modals/wideModal.css";

const StyledModalBody = styled(Modal.Body)`
  height: 75vh;
  max-height: 75vh;
  overflow-y: auto;
`;

function VisualizationSelector({
  showModal,
  handleModalClose,
  setSelectVizTypeOption,
}) {
  const { visualizations } = useContext(AppContext);
  const [search, setSearch] = useState("");
  const [visualizationItems, setVisualizationItems] = useState(visualizations);
  const [sectionsOpened, setSectionsOpened] = useState([]);

  const onSearch = (e) => {
    setSearch(e.target.value);
    const lowerQuery = e.target.value.toLowerCase();
    setVisualizationItems(
      visualizations
        .map((group) => {
          const filteredOptions = group.options.filter((option) => {
            const labelMatch = option.label.toLowerCase().includes(lowerQuery);
            const tagMatch = option.tags.some((tag) =>
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

  const handleOnClick = (metadata) => {
    setSelectVizTypeOption(metadata);
    handleModalClose();
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
          <div>
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
          </div>
          {visualizationItems.map(({ label, options }, index) => (
            <VisualizationGroup
              key={index}
              title={label}
              sectionsOpened={sectionsOpened}
              setSectionsOpened={setSectionsOpened}
            >
              <>
                {options.map((metadata, index) => (
                  <VisualizationCard
                    key={index}
                    onClick={() => handleOnClick(metadata)}
                    {...metadata}
                  />
                ))}
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
  setSelectVizTypeOption: PropTypes.func,
};

export default VisualizationSelector;

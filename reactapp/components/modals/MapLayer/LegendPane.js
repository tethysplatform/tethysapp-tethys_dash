import PropTypes from "prop-types";
import DataInput from "components/inputs/DataInput";
import Button from "react-bootstrap/Button";
import { useState, useRef } from "react";
import Table from "react-bootstrap/Table";
import DraggableList from "components/inputs/DraggableList";
import styled from "styled-components";
import Overlay from "react-bootstrap/Overlay";
import Popover from "react-bootstrap/Popover";
import ColorPicker from "components/inputs/ColorPicker";
import "components/modals/wideModal.css";

const StyledDiv = styled.div`
  margin-top: 0.5rem;
`;

const RightButton = styled(Button)`
  float: right;
`;

const LegendPane = ({ layerInfo, containerRef }) => {
  const [legendMode, setLegendMode] = useState(
    layerInfo.current.legend ? "on" : "off"
  );
  const [legend, setLegend] = useState(
    layerInfo.current.legend ?? [
      { label: "Normal", color: "#4BACCC" },
      { label: "Exceeds 2yr", color: "#F7D23E" },
      { label: "Exceeds 10yr", color: "#FF813D" },
      { label: "Exceeds 25yr", color: "#FA4343" },
      { label: "Exceeds 50yr", color: "#BC25F7" },
    ]
  );

  const valueOptions = [
    { label: "Don't show legend for layer", value: "off" },
    { label: "Show legend for layer", value: "on" },
  ];

  const loadLegend = () => {};

  const onOrderUpdate = (newLegend) => {
    layerInfo.current.legend = newLegend;
    setLegend(newLegend);
  };

  const legendTemplate = ({ value, index, draggingProps }) => {
    const [show, setShow] = useState(false);
    const target = useRef(null);
    const { label, color } = value;
    const newColor = useRef(null);

    const onChangeComplete = (changedColor) => {
      newColor.current = changedColor.hex;
    };

    const saveColor = () => {
      if (newColor.current) {
        legend[index].color = newColor.current;
        setLegend(legend);
        setShow(!show);
      }
    };

    return (
      <tr {...draggingProps}>
        <td>{label}</td>
        <td>
          <div style={{ color }} ref={target} onClick={() => setShow(!show)}>
            &#9632;
          </div>
          <Overlay
            target={target.current}
            container={containerRef?.current}
            show={show}
            placement="right"
          >
            <Popover className="color-picker-popover">
              <Popover.Body>
                <ColorPicker
                  color={color}
                  onChangeComplete={onChangeComplete}
                />
                <StyledDiv>
                  <Button
                    onClick={() => setShow(!show)}
                    aria-label={"Cancel Color Button"}
                  >
                    Cancel
                  </Button>
                  <RightButton
                    variant="success"
                    onClick={saveColor}
                    aria-label={"Save Color Button"}
                  >
                    Save
                  </RightButton>
                </StyledDiv>
              </Popover.Body>
            </Popover>
          </Overlay>
        </td>
        <td>&#9632;</td>
      </tr>
    );
  };

  return (
    <>
      <DataInput
        objValue={{
          label: "Legend Control",
          type: "radio",
          value: legendMode,
          valueOptions,
        }}
        onChange={(e) => {
          setLegendMode(e);
        }}
      />
      {legendMode === "on" && (
        <div>
          <Button
            variant="secondary"
            onClick={loadLegend()}
            aria-label={"Load Legend Button"}
          >
            Load Legend
          </Button>
          <Table striped bordered hover>
            <thead>
              <tr>
                <th>Label</th>
                <th>Color</th>
                <th>Symbol</th>
              </tr>
            </thead>
            <tbody>
              <DraggableList
                items={legend}
                onOrderUpdate={onOrderUpdate}
                itemTemplate={legendTemplate}
              />
            </tbody>
          </Table>
        </div>
      )}
    </>
  );
};

LegendPane.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
    PropTypes.object,
  ]),
  showModal: PropTypes.bool,
  handleModalClose: PropTypes.func,
};

export default LegendPane;

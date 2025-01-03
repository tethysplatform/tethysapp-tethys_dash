import PropTypes from "prop-types";
import DataInput from "components/inputs/DataInput";
import Button from "react-bootstrap/Button";
import { useState, useRef } from "react";
import Table from "react-bootstrap/Table";
import DraggableList from "components/inputs/DraggableList";
import { Popover } from "react-tiny-popover";
import ColorPicker from "components/inputs/ColorPicker";
import "components/modals/wideModal.css";

const legendTemplate = ({ value, index, draggingProps }) => {
  const [isPopoverOpen, setIsPopoverOpen] = useState();
  const { label, color } = value;
  return (
    <tr {...draggingProps}>
      <td>{label}</td>
      <td>
        <Popover
          isOpen={isPopoverOpen}
          positions={["top", "bottom", "left", "right"]} // preferred positions by priority
          content={<ColorPicker color={color} />}
          containerStyle={{ "z-index": 1060 }}
        >
          <div
            style={{ color }}
            onClick={() => setIsPopoverOpen(!isPopoverOpen)}
          >
            &#9632;
          </div>
        </Popover>
      </td>
      <td>&#9632;</td>
    </tr>
  );
};

const LegendPane = ({ layerInfo }) => {
  const [legendMode, setLegendMode] = useState(
    layerInfo.current.legend ? "on" : "off"
  );
  const legend = useRef(
    layerInfo.current.legend ?? [
      { label: "Normal", color: "#4BACCC" },
      { label: "Exceeds 2yr", color: "#F7D23E" },
      { label: "Exceeds 10yr", color: "#FF813D" },
      { label: "Exceeds 25yr", color: "#FA4343" },
      { label: "Exceeds 50yr", color: "#BC25F7" },
    ]
  );
  const [anchorEl, setAnchorEl] = useState();

  const valueOptions = [
    { label: "Don't show legend for layer", value: "off" },
    { label: "Show legend for layer", value: "on" },
  ];

  const loadLegend = () => {};

  const onOrderUpdate = (newLegend) => {
    legend.current = newLegend;
    layerInfo.current.legend = newLegend;
  };

  const onColorChange = (newColor) => {
    console.log(newColor);
    // const existingMapLayer = legend.current.find(
    //   (t) => t.props.name === existingLayerName.current
    // );
    // legend.current = newLegend;
    // layerInfo.current.legend = newLegend;
  };

  const openColorPicker = (target, color, index) => {
    setAnchorEl(target);
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
                items={legend.current}
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

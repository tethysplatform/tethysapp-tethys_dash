import PropTypes from "prop-types";
import DataInput from "components/inputs/DataInput";
import Button from "react-bootstrap/Button";
import { useState, useRef, useEffect } from "react";
import Table from "react-bootstrap/Table";
import DraggableList from "components/inputs/DraggableList";
import styled from "styled-components";
import Overlay from "react-bootstrap/Overlay";
import Popover from "react-bootstrap/Popover";
import ColorPicker from "components/inputs/ColorPicker";
import CustomPicker from "components/inputs/CustomPicker";
import { BsTrash } from "react-icons/bs";
import {
  BsFillTriangleFill,
  BsFillSquareFill,
  BsFillCircleFill,
} from "react-icons/bs";
import { RiRectangleFill } from "react-icons/ri";
import { IoAnalyticsOutline } from "react-icons/io5";
import {
  legendSymbols,
  getLegendSymbol,
} from "components/backlayer/control/Legend";
import "components/modals/wideModal.css";

const ColoredUpTriangle = styled(BsFillTriangleFill)`
  color: ${(props) => props.color};
`;

const ColoredRightTriangle = styled(BsFillTriangleFill)`
  transform: rotate(90deg);
  color: ${(props) => props.color};
`;

const ColoredDownTriangle = styled(BsFillTriangleFill)`
  transform: rotate(180deg);
  color: ${(props) => props.color};
`;

const ColoredLeftTriangle = styled(BsFillTriangleFill)`
  transform: rotate(270deg);
  color: ${(props) => props.color};
`;

const ColoredSquare = styled(BsFillSquareFill)`
  color: ${(props) => props.color};
`;

const ColoredCircle = styled(BsFillCircleFill)`
  color: ${(props) => props.color};
`;

const ColoredRectangle = styled(RiRectangleFill)`
  color: ${(props) => props.color};
`;

const ColoredLine = styled(IoAnalyticsOutline)`
  color: ${(props) => props.color};
`;

const StyledLabel = styled.label`
  width: 100%;
`;

const RedIcon = styled(BsTrash)`
  color: red;
`;

const LegendTemplate = ({
  value,
  index,
  draggingProps,
  containerRef,
  legendItems,
  setLegendItems,
}) => {
  const { label, color, symbol } = value;
  const [symbolColor, setSymbolColor] = useState(color);
  const [showColorPopover, setShowColorPopover] = useState(false);
  const [localLabel, setLocalLabel] = useState(label);
  const colorTarget = useRef(null);
  const [symbolValue, setSymbolValue] = useState(symbol);
  const [symbolComponent, setSymbolComponent] = useState();

  useEffect(() => {
    setLocalLabel(label);
    setSymbolColor(color);
    setSymbolValue(symbol);
  }, [label, color, symbol]);

  useEffect(() => {
    legendItems[index].symbol = symbolValue;
    legendItems[index].color = symbolColor;
    setSymbolComponent(getLegendSymbol(symbolValue, symbolColor));
    setLegendItems(legendItems);
  }, [symbolValue, symbolColor]);

  const onColorChange = (changedColor) => {
    setSymbolColor(changedColor.hex);
  };

  const onLabelChange = (e) => {
    legendItems[index].label = e.target.value;
    setLocalLabel(e.target.value);
    setLegendItems(legendItems);
  };

  const deleteRow = () => {
    const newLegend = legendItems.filter(
      (_, arrayIndex) => arrayIndex !== index
    );
    setLegendItems(newLegend);
    setShowColorPopover(false);
  };

  return (
    <tr {...draggingProps}>
      <td>
        <input value={localLabel} onChange={onLabelChange}></input>
      </td>
      <td>
        <div
          ref={colorTarget}
          onClick={() => setShowColorPopover(!showColorPopover)}
        >
          {symbolComponent}
        </div>
        <Overlay
          target={colorTarget.current}
          container={containerRef?.current}
          show={showColorPopover}
          placement="right"
          rootClose={true}
          onHide={() => setShowColorPopover(false)}
        >
          <Popover className="color-picker-popover">
            <Popover.Body>
              <StyledLabel>
                <b>Symbol</b>:{" "}
                <CustomPicker
                  maxColCount={3}
                  pickerOptions={legendSymbols}
                  setPickervalue={setSymbolValue}
                />
              </StyledLabel>
              <StyledLabel>
                <b>Color</b>:{" "}
                <ColorPicker color={color} onChangeComplete={onColorChange} />
              </StyledLabel>
            </Popover.Body>
          </Popover>
        </Overlay>
      </td>
      <td></td>
      <td>
        <div onClick={deleteRow}>
          <RedIcon size={"1rem"} />
        </div>
      </td>
    </tr>
  );
};

const LegendPane = ({ layerInfo, containerRef }) => {
  const [legendMode, setLegendMode] = useState(
    layerInfo.current.legend ? "on" : "off"
  );
  const [legendItems, setLegendItems] = useState(
    layerInfo.current.legend?.items ?? []
  );
  const [legendTitle, setLegendTitle] = useState(
    layerInfo.current.legend?.title ?? ""
  );
  const previousLegendInfo = useRef(layerInfo.current.legend ?? {});

  useEffect(() => {
    if (legendMode === "off") return;

    layerInfo.current.legend.title = legendTitle;
    layerInfo.current.legend.items = legendItems;
  }, [legendItems, legendTitle]);

  const valueOptions = [
    { label: "Don't show legend for layer", value: "off" },
    { label: "Show legend for layer", value: "on" },
  ];

  const addLegendItem = () => {
    setLegendItems((previousLegendItems) => [
      ...previousLegendItems,
      { label: "", color: "#ff0000", symbol: "square" },
    ]);
  };

  const onOrderUpdate = (newLegendItems) => {
    setLegendItems(newLegendItems);
  };

  const changeLegendMode = (e) => {
    if (e === "off") {
      previousLegendInfo.current = layerInfo.current.legend;
      layerInfo.current.legend = null;
    } else {
      layerInfo.current.legend = previousLegendInfo.current;
    }
    setLegendMode(e);
  };

  const onTitleChange = (e) => {
    setLegendTitle(e.target.value);
  };

  const templateArgs = {
    containerRef,
    legendItems,
    setLegendItems,
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
        onChange={changeLegendMode}
      />
      {legendMode === "on" && (
        <div>
          <input value={legendTitle} onChange={onTitleChange}></input>
          <Button
            variant="secondary"
            onClick={addLegendItem}
            aria-label={"Add Legend Item Button"}
          >
            Add Legend Item
          </Button>
          <Table striped bordered hover size="sm">
            <thead>
              <tr>
                <th>Label</th>
                <th>Color</th>
                <th>Symbol</th>
              </tr>
            </thead>
            <tbody>
              <DraggableList
                items={legendItems}
                onOrderUpdate={onOrderUpdate}
                ItemTemplate={LegendTemplate}
                templateArgs={templateArgs}
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

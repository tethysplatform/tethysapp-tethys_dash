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
import { legendSymbols, getLegendSymbol } from "components/map/Legend";
import { RxDragHandleHorizontal } from "react-icons/rx";
import "components/modals/wideModal.css";

const StyledLabel = styled.label`
  width: 100%;
  padding: 0.5rem;
`;

const RedTrashIcon = styled(BsTrash)`
  color: red;
`;

const StyledDiv = styled.div`
  padding-bottom: 1rem;
`;

const StyledInput = styled.input`
  width: 100%;
`;

const InLineInputDiv = styled.div`
  display: inline-block;
  width: calc(
    ${(props) => (props?.widthBuffer ? props.widthBuffer : "100%")} - 1.5em
  );
  vertical-align: middle;
`;

const InLineButtonDiv = styled.div`
  display: inline-block;
`;
const AlignedDragHandle = styled(RxDragHandleHorizontal)`
  margin: auto;
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
        <InLineButtonDiv>
          <AlignedDragHandle size={"1rem"} />
        </InLineButtonDiv>
        <InLineInputDiv>
          <StyledInput
            value={localLabel}
            onChange={onLabelChange}
          ></StyledInput>
        </InLineInputDiv>
      </td>
      <td className="text-center">
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
      <td className="text-center">
        <div onClick={deleteRow}>
          <RedTrashIcon size={"1rem"} />
        </div>
      </td>
    </tr>
  );
};

const LegendPane = ({ legend, setLegend, containerRef }) => {
  const [legendMode, setLegendMode] = useState(legend ? "on" : "off");
  const [legendItems, setLegendItems] = useState(legend?.items ?? []);
  const [legendTitle, setLegendTitle] = useState(legend?.title ?? "");
  const previousLegendInfo = useRef(legend ?? {});

  useEffect(() => {
    if (legendMode === "off") return;

    const newLegend = { title: legendTitle, items: legendItems };
    setLegend(newLegend);
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
    let newLegend;
    if (e === "off") {
      previousLegendInfo.current = legend;
      newLegend = {};
    } else {
      newLegend = previousLegendInfo.current;
    }
    setLegendMode(e);
    setLegend(newLegend);
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
        <>
          <StyledDiv>
            <InLineInputDiv widthBuffer={"70%"}>
              <label>
                <b>Title</b>:{" "}
                <input value={legendTitle} onChange={onTitleChange}></input>
              </label>
            </InLineInputDiv>
            <InLineButtonDiv>
              <Button
                variant="info"
                onClick={addLegendItem}
                aria-label={"Add Legend Item Button"}
              >
                Add Legend Item
              </Button>
            </InLineButtonDiv>
          </StyledDiv>
          <div>
            <Table striped bordered hover size="sm">
              <thead>
                <tr>
                  <th className="text-center">Label</th>
                  <th className="text-center">Symbol</th>
                  <th></th>
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
        </>
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

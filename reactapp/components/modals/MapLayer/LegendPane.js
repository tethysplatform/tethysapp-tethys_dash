import PropTypes from "prop-types";
import DataRadioSelect from "components/inputs/DataRadioSelect";
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
import { legendSymbols, getLegendSymbol } from "components/map/LegendControl";
import { RxDragHandleHorizontal } from "react-icons/rx";
import { legendPropType, legendItemPropType } from "components/map/utilities";
import { valuesEqual } from "components/modals/utilities";
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
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
`;

const StyledInput = styled.input`
  width: 100%;
`;

const InputDiv = styled.div`
  vertical-align: middle;
  flex: 1;
`;

const AlignedDragHandle = styled(RxDragHandleHorizontal)`
  margin: auto;
`;

const StyledPopoverBody = styled(Popover.Body)`
  max-height: 70vh;
  overflow-y: auto;
`;

const HoverDiv = styled.div`
  cursor: pointer;
`;

const FlexDiv = styled.div`
  display: flex;
  width: 100%;
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
    const updatedLegendItems = JSON.parse(JSON.stringify(legendItems));
    updatedLegendItems[index].symbol = symbolValue;
    updatedLegendItems[index].color = symbolColor;
    setSymbolComponent(getLegendSymbol(symbolValue, symbolColor));
    setLegendItems(updatedLegendItems);
    // eslint-disable-next-line
  }, [symbolValue, symbolColor]);

  const onColorChange = (changedColor) => {
    setSymbolColor(changedColor);
  };

  const onLabelChange = (e) => {
    const updatedLegendItems = JSON.parse(JSON.stringify(legendItems));
    updatedLegendItems[index].label = e.target.value;
    setLocalLabel(e.target.value);
    setLegendItems(updatedLegendItems);
  };

  const deleteRow = () => {
    const newLegend = legendItems.filter(
      (_, arrayIndex) => arrayIndex !== index
    );
    setLegendItems(newLegend);
    setShowColorPopover(false);
  };

  return (
    <tr key={index} {...draggingProps}>
      <td>
        <FlexDiv>
          <AlignedDragHandle size={"1rem"} />
          <InputDiv>
            <StyledInput
              value={localLabel}
              onChange={onLabelChange}
            ></StyledInput>
          </InputDiv>
        </FlexDiv>
      </td>
      <td className="text-center">
        <div
          ref={colorTarget}
          onClick={() => setShowColorPopover(!showColorPopover)}
        >
          {symbolComponent}
        </div>
        <Overlay
          container={containerRef}
          target={colorTarget.current}
          show={showColorPopover}
          placement="left"
          rootClose={true}
          onHide={() => setShowColorPopover(false)}
        >
          <Popover className="color-picker-popover">
            <StyledPopoverBody>
              <StyledLabel>
                <b>Symbol</b>:{" "}
                <CustomPicker
                  maxColCount={3}
                  pickerOptions={legendSymbols}
                  onSelect={setSymbolValue}
                />
              </StyledLabel>
              <StyledLabel>
                <b>Color</b>:{" "}
                <ColorPicker
                  hideInput={["rgb", "hsv"]}
                  color={color}
                  onChange={onColorChange}
                />
              </StyledLabel>
            </StyledPopoverBody>
          </Popover>
        </Overlay>
      </td>
      <td className="text-center">
        <HoverDiv
          onClick={deleteRow}
          onMouseOver={(e) => (e.target.style.cursor = "pointer")}
          onMouseOut={(e) => (e.target.style.cursor = "default")}
        >
          <RedTrashIcon size={"1rem"} />
        </HoverDiv>
      </td>
    </tr>
  );
};

const LegendPane = ({ legend, setLegend, containerRef }) => {
  const [legendMode, setLegendMode] = useState(legend ? "on" : "off");
  const [legendItems, setLegendItems] = useState(legend?.items ?? []);
  const [legendTitle, setLegendTitle] = useState(legend?.title ?? "");
  const previousLegendInfo = useRef(legend);

  useEffect(() => {
    if (
      !valuesEqual(previousLegendInfo.current, legend) &&
      Object.keys(legend ?? {}).length > 0
    ) {
      previousLegendInfo.current = legend;
      setLegendMode("on");
      setLegendItems(legend.items ?? []);
      setLegendTitle(legend.title ?? "");
    }
    // eslint-disable-next-line
  }, [legend]);

  useEffect(() => {
    if (legendMode === "off") return;

    const newLegend = { title: legendTitle, items: legendItems };
    setLegend(newLegend);
    // eslint-disable-next-line
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
      <DataRadioSelect
        label={"Legend Control"}
        aria-label={"Legend Control Input"}
        selectedRadio={legendMode}
        radioOptions={valueOptions}
        onChange={(e) => {
          changeLegendMode(e.target.value);
        }}
      />
      {legendMode === "on" && (
        <>
          <StyledDiv>
            <label>
              <b>Title</b>:{" "}
              <input value={legendTitle} onChange={onTitleChange}></input>
            </label>
            <Button
              variant="info"
              onClick={addLegendItem}
              aria-label={"Add Legend Item Button"}
            >
              Add Legend Item
            </Button>
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

LegendTemplate.propTypes = {
  value: legendItemPropType,
  index: PropTypes.number, // index of the row (legenditem)
  // The properties from the DraggableList input to allow dragging functionality
  draggingProps: PropTypes.shape({
    onDragStart: PropTypes.func.isRequired,
    onDragOver: PropTypes.func.isRequired,
    onDrop: PropTypes.func.isRequired,
    draggable: PropTypes.string.isRequired,
  }).isRequired,
  containerRef: PropTypes.shape({
    current: PropTypes.oneOfType([PropTypes.object, PropTypes.element]),
  }), // ref pointing to the container of the content so that color picker renders inside the same div
  legendItems: PropTypes.arrayOf(legendItemPropType), // state that controls the legend items in the table
  setLegendItems: PropTypes.func,
};

LegendPane.propTypes = {
  legend: legendPropType,
  setLegend: PropTypes.func,
  containerRef: PropTypes.shape({
    current: PropTypes.oneOfType([PropTypes.object, PropTypes.element]),
  }), // ref pointing to the container of the content so that color picker renders inside the same div
};

export default LegendPane;

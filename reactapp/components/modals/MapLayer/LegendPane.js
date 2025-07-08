import PropTypes from "prop-types";
import DataRadioSelect from "components/inputs/DataRadioSelect";
import Button from "react-bootstrap/Button";
import { useState, useRef, useEffect, memo, useMemo } from "react";
import Table from "react-bootstrap/Table";
import DraggableList from "components/inputs/DraggableList";
import styled from "styled-components";
import Overlay from "react-bootstrap/Overlay";
import Popover from "react-bootstrap/Popover";
import ColorPicker from "components/inputs/ColorPicker";
import CustomPicker from "components/inputs/CustomPicker";
import { BsTrash } from "react-icons/bs";
import LegendRenderer, {
  legendSymbols,
  getLegendSymbol,
} from "components/map/LegendRenderer";
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

const LegendDiv = styled.div`
  width: 25%;
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
const LegendPane = ({ legend, setLegend, containerRef, sourceProps }) => {
  const [legendMode, setLegendMode] = useState(
    !legend ? "off" : legend === "default" ? "default" : "custom"
  );
  const previousCustomLegendRef = useRef(typeof legend === "object" && legend);

  const limitedLegendTypes = ["GeoJSON", "Image Tile"];

  // Dynamically determine valid options based on sourceProps.type
  const legendOptions = useMemo(() => {
    return limitedLegendTypes.includes(sourceProps?.type)
      ? [
          { label: "No Legend", value: "off" },
          { label: "Custom Legend", value: "custom" },
        ]
      : [
          { label: "No Legend", value: "off" },
          { label: "Default Legend", value: "default" },
          { label: "Custom Legend", value: "custom" },
        ];
  }, [sourceProps?.type]);

  const validOptionValues = useMemo(
    () => legendOptions.map((o) => o.value),
    [legendOptions]
  );

  // Keep legendMode in sync with incoming legend or sourceProps changes
  useEffect(() => {
    let nextMode = "off";
    if (typeof legend === "object" && Object.keys(legend).length > 0) {
      nextMode = "custom";
      previousCustomLegendRef.current = legend;
    } else if (legend === "default") {
      nextMode = "default";
    }

    // Fallback if current mode is no longer valid (e.g. due to sourceProps change)
    if (!validOptionValues.includes(nextMode)) {
      nextMode = "off";
      setLegend({});
    }

    setLegendMode(nextMode);
  }, [legend, validOptionValues]);

  const handleModeChange = (event) => {
    const mode = event.target.value;

    if (legendMode === "custom") {
      previousCustomLegendRef.current = legend;
    }
    setLegendMode(mode);

    if (mode === "off") {
      setLegend({});
    } else if (mode === "default") {
      setLegend("default");
    } else {
      setLegend(previousCustomLegendRef.current ?? { title: "", items: [] });
    }
  };

  const handleTitleChange = (e) => {
    const title = e.target.value;
    setLegend((prev) => ({ ...prev, title }));
  };

  const addLegendItem = () => {
    setLegend((prev) => ({
      ...prev,
      items: [
        ...(prev.items ?? []),
        { label: "", color: "#ff0000", symbol: "square" },
      ],
    }));
  };

  const updateLegendItems = (newItems) => {
    setLegend((prev) => ({ ...prev, items: newItems }));
  };

  const templateArgs = {
    containerRef,
    legendItems: legend?.items ?? [],
    setLegendItems: updateLegendItems,
  };

  return (
    <>
      <DataRadioSelect
        label="Legend Control"
        aria-label="Legend Control Input"
        selectedRadio={legendMode}
        radioOptions={legendOptions}
        onChange={handleModeChange}
      />

      {legendMode === "default" && (
        <LegendDiv>
          <LegendRenderer
            legend={{
              sourceType: sourceProps.type,
              url: sourceProps.props?.url,
              layers:
                sourceProps.props?.params?.LAYERS || sourceProps.props?.layer,
            }}
          />
        </LegendDiv>
      )}

      {legendMode === "custom" && (
        <>
          <StyledDiv>
            <label>
              <b>Title</b>:{" "}
              <input value={legend?.title ?? ""} onChange={handleTitleChange} />
            </label>
            <Button
              variant="info"
              onClick={addLegendItem}
              aria-label="Add Legend Item Button"
            >
              Add Legend Item
            </Button>
          </StyledDiv>

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
                items={legend?.items ?? []}
                onOrderUpdate={updateLegendItems}
                ItemTemplate={LegendTemplate}
                templateArgs={templateArgs}
              />
            </tbody>
          </Table>
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

export default memo(LegendPane);

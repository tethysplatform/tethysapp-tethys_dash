import { useRef, useState } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import NormalInput from "components/inputs/NormalInput";
import ColorPicker from "components/inputs/ColorPicker";
import Overlay from "react-bootstrap/Overlay";
import Popover from "react-bootstrap/Popover";

const RuleContainer = styled.div`
  border: 1px solid #ccc;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 12px;
  background: #fafbfc;
`;

const StyledPopoverBody = styled(Popover.Body)`
  max-height: 70vh;
  overflow-y: auto;
`;

const RuleEditor = ({
  rule,
  onChange,
  onRemove,
  availableShapes,
  containerRef,
}) => {
  const colorFillTarget = useRef(null);
  const colorStrokeTarget = useRef(null);
  const [showColorFillPopover, setShowColorFillPopover] = useState(false);
  const [showColorStrokePopover, setShowColorStrokePopover] = useState(false);

  const handleFieldChange = (field, value) => {
    onChange({ ...rule, [field]: value });
  };

  // Small input style
  const smallInputStyle = {
    fontSize: "0.9em",
    padding: "4px 6px",
    borderRadius: "3px",
    border: "1px solid #ccc",
    width: "100%",
    boxSizing: "border-box",
    minWidth: 0,
    maxWidth: "120px",
  };

  return (
    <RuleContainer>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          position: "relative",
        }}
      >
        <NormalInput
          label="Field (Condition)"
          value={Object.keys(rule.conditions || {})[0] || ""}
          type="text"
          style={smallInputStyle}
          onChange={(e) => {
            const oldKey = Object.keys(rule.conditions || {})[0];
            const newKey = e.target.value;
            const newConditions = { ...rule.conditions };
            if (oldKey && oldKey !== newKey) {
              delete newConditions[oldKey];
            }
            if (newKey) newConditions[newKey] = rule.conditions?.[oldKey] || "";
            onChange({ ...rule, conditions: newConditions });
          }}
        />
        <NormalInput
          label="Value (Condition)"
          value={Object.values(rule.conditions || {})[0] || ""}
          type="text"
          style={smallInputStyle}
          onChange={(e) => {
            const key = Object.keys(rule.conditions || {})[0];
            onChange({
              ...rule,
              conditions: key ? { [key]: e.target.value } : {},
            });
          }}
        />

        {/* Group shape, size, fill, stroke, stroke width side by side */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            alignItems: "center",
            gridColumn: "1 / span 2",
          }}
        >
          {/* Shape dropdown */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
            }}
          >
            <label
              htmlFor="shape-select"
              style={{ fontWeight: "bold", fontSize: "0.95em" }}
            >
              Shape
            </label>
            <select
              id="shape-select"
              value={rule.shape || "circle"}
              onChange={(e) => handleFieldChange("shape", e.target.value)}
              style={{
                ...smallInputStyle,
                padding: "4px 6px",
                maxWidth: "80px",
              }}
            >
              {availableShapes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Icon shape: show iconUrl and size only */}
          {rule.shape === "icon" ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
              }}
            >
              <NormalInput
                label="Icon URL"
                value={rule.iconUrl || ""}
                type="text"
                style={{ ...smallInputStyle, maxWidth: "120px" }}
                onChange={(e) => handleFieldChange("iconUrl", e.target.value)}
              />
              <NormalInput
                label="Size"
                value={rule.size || ""}
                type="number"
                style={{ ...smallInputStyle, maxWidth: "50px" }}
                onChange={(e) => handleFieldChange("size", e.target.value)}
              />
            </div>
          ) : (
            <>
              {/* Size input */}
              <NormalInput
                label="Size"
                value={rule.size || ""}
                type="number"
                style={{ ...smallInputStyle, maxWidth: "50px" }}
                onChange={(e) => handleFieldChange("size", e.target.value)}
              />

              {/* Fill color preview square and popover */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                }}
              >
                <label style={{ fontWeight: "bold", fontSize: "0.95em" }}>
                  Fill
                </label>
                <div
                  ref={colorFillTarget}
                  onClick={() => setShowColorFillPopover(!showColorFillPopover)}
                  style={{
                    width: "24px",
                    height: "24px",
                    background: rule.fill || "#cccccc",
                    border: "1px solid #aaa",
                    borderRadius: "4px",
                    cursor: "pointer",
                    marginTop: "2px",
                  }}
                  title="Click to change fill color"
                />
                <Overlay
                  container={containerRef}
                  target={colorFillTarget.current}
                  show={showColorFillPopover}
                  placement="left"
                  rootClose
                  onHide={() => setShowColorFillPopover(false)}
                >
                  <Popover className="color-picker-popover">
                    <StyledPopoverBody>
                      <ColorPicker
                        hideInput={["rgb", "hsv"]}
                        color={rule.fill || "#cccccc"}
                        onChange={(color) => {
                          handleFieldChange("fill", color);
                        }}
                      />
                    </StyledPopoverBody>
                  </Popover>
                </Overlay>
              </div>

              {/* Stroke color preview square and popover */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                }}
              >
                <label style={{ fontWeight: "bold", fontSize: "0.95em" }}>
                  Stroke
                </label>
                <div
                  ref={colorStrokeTarget}
                  onClick={() =>
                    setShowColorStrokePopover(!showColorStrokePopover)
                  }
                  style={{
                    width: "24px",
                    height: "24px",
                    background: rule.stroke || "#000000",
                    border: "1px solid #aaa",
                    borderRadius: "4px",
                    cursor: "pointer",
                    marginTop: "2px",
                  }}
                  title="Click to change stroke color"
                />
                <Overlay
                  container={containerRef}
                  target={colorStrokeTarget.current}
                  show={showColorStrokePopover}
                  placement="left"
                  rootClose
                  onHide={() => setShowColorStrokePopover(false)}
                >
                  <Popover className="color-picker-popover">
                    <StyledPopoverBody>
                      <ColorPicker
                        hideInput={["rgb", "hsv"]}
                        color={rule.stroke || "#000000"}
                        onChange={(color) => {
                          handleFieldChange("stroke", color);
                        }}
                      />
                    </StyledPopoverBody>
                  </Popover>
                </Overlay>
              </div>

              {/* Stroke width input */}
              <NormalInput
                label="Stroke Width"
                value={rule.strokeWidth || ""}
                type="number"
                style={{ ...smallInputStyle, maxWidth: "50px" }}
                onChange={(e) =>
                  handleFieldChange("strokeWidth", e.target.value)
                }
              />
            </>
          )}
        </div>

        <button
          type="button"
          onClick={onRemove}
          style={{
            marginTop: 8,
            gridColumn: "1 / -1",
            justifySelf: "end",
            fontSize: "0.95em",
            padding: "4px 10px",
          }}
        >
          Remove
        </button>
      </div>
    </RuleContainer>
  );
};

RuleEditor.propTypes = {
  rule: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
  availableShapes: PropTypes.array.isRequired,
};

export default RuleEditor;

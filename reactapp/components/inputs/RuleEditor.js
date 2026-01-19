import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import NormalInput from "components/inputs/NormalInput";
import DataSelect from "components/inputs/DataSelect";
import ColorPickerPopover from "components/inputs/ColorPickerPopOver";
import { spaceAndCapitalize } from "components/modals/utilities";

const availableShapes = [
  "circle",
  "square",
  "rectangle",
  "triangle",
  "star",
  "diamond",
  "cross",
  "x",
  "icon",
];

// Geometry-specific style option filters
export const geomStyleOptions = {
  point: ["fill", "stroke", "strokeWidth", "size", "shape", "zIndex"],
  linestring: ["stroke", "strokeWidth", "strokeDash", "zIndex"],
  polygon: [
    "fill",
    "stroke",
    "strokeWidth",
    "polygonFillType",
    "hatchDirection",
    "hatchSpacing",
    "hatchColor",
    "dotRadius",
    "dotSpacing",
    "dotColor",
    "zIndex",
  ],
};

const RuleContainer = styled.div`
  border: 1px solid #ccc;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 12px;
  background: #fafbfc;
`;

const CONDITION_OPTIONS = [
  { value: "=", label: "=" },
  { value: "!=", label: "≠" },
  { value: "<", label: "<" },
  { value: "<=", label: "≤" },
  { value: ">", label: ">" },
  { value: ">=", label: "≥" },
];

// Geometry type options for dropdown
const GEOMETRY_TYPE_OPTIONS = [
  { value: "point", label: "Point" },
  { value: "linestring", label: "LineString" },
  { value: "polygon", label: "Polygon" },
];
const POLYGON_FILL_TYPES = [
  { value: "solid", label: "Solid" },
  { value: "hatch", label: "Hatch" },
  { value: "crosshatch", label: "Crosshatch" },
  { value: "dot", label: "Dot" },
];
const getStyleKeysForGeom = (geomType) => {
  if (["point", "multipoint"].includes(geomType)) return geomStyleOptions.point;
  if (["linestring", "multilinestring"].includes(geomType))
    return geomStyleOptions.linestring;
  if (["polygon", "multipolygon"].includes(geomType))
    return geomStyleOptions.polygon;
  return [];
};

const RuleEditor = ({
  rule,
  onChange,
  availableFields,
  containerRef,
  defaultSection = false,
}) => {
  const [selectedGeomType, setSelectedGeomType] = useState(
    rule.geometryType || "point",
  );
  const [styleOptions, setStyleOptions] = useState(
    getStyleKeysForGeom(rule.geometryType || "point"),
  );

  // Extract condition
  const conditionField = rule.conditionField || "";
  const conditionType = rule.conditionType || "=";
  const conditionValue = rule.conditionValue || "";

  const handleGeomTypeChange = (opt) => {
    setSelectedGeomType(opt);
    const newStyleOptions = getStyleKeysForGeom(opt.value);
    const formatedStyleOptions = newStyleOptions.map((key) => ({
      value: key,
      label: spaceAndCapitalize(key),
    }));
    setStyleOptions(formatedStyleOptions);
    onChange({ ...rule, geometryType: opt.value });
  };

  // Add style option
  const handleAddStyle = (selected) => {
    const newRule = { ...rule };
    if (selected.value === "fill" || selected.value === "stroke") {
      newRule[selected.value] = "#888888";
    } else {
      newRule[selected.value] = "";
    }
    onChange(newRule);
  };

  // Remove style option
  const handleRemoveStyle = (key) => {
    const newRule = { ...rule };
    delete newRule[key];
    onChange(newRule);
  };

  // Update style value
  const handleStyleValueChange = (key, value) => {
    const newRule = { ...rule };
    newRule[key] = value;
    onChange(newRule);
  };

  return (
    <RuleContainer>
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {!defaultSection && (
          <>
            <DataSelect
              label="Geometry Type"
              options={GEOMETRY_TYPE_OPTIONS}
              selectedOption={selectedGeomType}
              onChange={handleGeomTypeChange}
              creatable={false}
              divProps={{ style: { marginBottom: 0 } }}
            />
            <DataSelect
              label="Field"
              options={availableFields.map((f) => ({ value: f, label: f }))}
              selectedOption={
                conditionField
                  ? { value: conditionField, label: conditionField }
                  : null
              }
              onChange={(opt) =>
                onChange({ ...rule, conditionField: opt?.value || "" })
              }
              creatable={false}
              divProps={{ style: { marginBottom: 0 } }}
            />
            <DataSelect
              label="Condition"
              options={CONDITION_OPTIONS}
              selectedOption={CONDITION_OPTIONS.find(
                (o) => o.value === conditionType,
              )}
              onChange={(opt) =>
                onChange({ ...rule, conditionType: opt?.value || "=" })
              }
              creatable={false}
              divProps={{ style: { marginBottom: 0 } }}
            />
            <NormalInput
              label="Value"
              value={conditionValue}
              type="text"
              onChange={(e) =>
                onChange({ ...rule, conditionValue: e.target.value })
              }
              labelProps={{ style: { marginBottom: 0 } }}
            />
            {/* Add Style Option Dropdown, filtered by styleOptionFilter */}
            <DataSelect
              label="Add Style Option"
              options={styleOptions}
              selectedOption={null}
              onChange={handleAddStyle}
              creatable={false}
              divProps={{ style: { marginBottom: 0 } }}
            />
            {rule.shape === "icon" && (
              <NormalInput
                label="Icon URL"
                value={rule.iconUrl || ""}
                type="text"
                onChange={(e) => onChange({ ...rule, iconUrl: e.target.value })}
                style={{ minWidth: 120 }}
              />
            )}
          </>
        )}
        <div style={{ width: "100%" }}>
          {defaultSection ? (
            <div key={defaultSection} style={{ marginBottom: 24 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>
                {spaceAndCapitalize(defaultSection)}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  alignItems: "center",
                  marginTop: 8,
                }}
              >
                {geomStyleOptions[defaultSection].map((optKey) => {
                  const value =
                    rule[defaultSection]?.[optKey] !== undefined
                      ? rule[defaultSection][optKey]
                      : optKey === "fill" || optKey === "stroke"
                        ? "#888888"
                        : "";
                  // Handler for nested default object
                  const handleNestedChange = (key, val) => {
                    const newRule = { ...rule };
                    newRule[defaultSection] = {
                      ...newRule[defaultSection],
                      [optKey]: val,
                    };
                    onChange(newRule);
                  };
                  if (optKey === "fill" || optKey === "stroke") {
                    return (
                      <ColorPickerPopover
                        key={optKey}
                        label={optKey === "fill" ? "Fill" : "Stroke"}
                        color={value}
                        onChange={(color) => handleNestedChange(optKey, color)}
                        containerRef={containerRef}
                      />
                    );
                  } else if (optKey === "shape") {
                    return (
                      <DataSelect
                        key={optKey}
                        label="Shape"
                        options={availableShapes.map((s) => ({
                          value: s,
                          label: s,
                        }))}
                        selectedOption={value ? { value, label: value } : null}
                        onChange={(o) =>
                          handleNestedChange(optKey, o?.value || "circle")
                        }
                        creatable={false}
                        divProps={{ style: { marginBottom: 0 } }}
                      />
                    );
                  } else if (optKey === "polygonFillType") {
                    return (
                      <DataSelect
                        key={optKey}
                        label="Polygon Fill Type"
                        options={POLYGON_FILL_TYPES}
                        selectedOption={POLYGON_FILL_TYPES.find(
                          (o) => o.value === value,
                        )}
                        onChange={(opt) =>
                          handleNestedChange(optKey, opt?.value || "solid")
                        }
                        creatable={false}
                        style={{ minWidth: 120 }}
                      />
                    );
                  } else if (optKey === "hatchColor" || optKey === "dotColor") {
                    return (
                      <ColorPickerPopover
                        key={optKey}
                        label={
                          optKey === "hatchColor" ? "Hatch Color" : "Dot Color"
                        }
                        color={
                          value || (optKey === "hatchColor" ? "#000" : "#444")
                        }
                        onChange={(color) => handleNestedChange(optKey, color)}
                        containerRef={containerRef}
                      />
                    );
                  } else {
                    // Fallback label: Capitalize and add spaces
                    const label = optKey
                      .replace(/([A-Z])/g, " $1")
                      .replace(/^./, (str) => str.toUpperCase());
                    return (
                      <NormalInput
                        key={optKey}
                        label={label}
                        value={value}
                        type="number"
                        onChange={(e) =>
                          handleNestedChange(optKey, e.target.value)
                        }
                        labelProps={{ style: { marginBottom: 0 } }}
                      />
                    );
                  }
                })}
              </div>
            </div>
          ) : (
            Object.keys(rule)
              .filter(
                (key) =>
                  ![
                    "conditionField",
                    "conditionType",
                    "conditionValue",
                    "geometryType",
                  ].includes(key),
              )
              .map((key) => {
                if (key === "polygonFillType") {
                  return (
                    <div
                      key={key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginTop: 8,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleRemoveStyle(key)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#d32f2f",
                          fontWeight: "bold",
                          fontSize: 20,
                          cursor: "pointer",
                          zIndex: 2,
                          marginRight: 4,
                        }}
                        aria-label={`Remove ${key} style option`}
                        title={`Remove ${key} style option`}
                      >
                        ×
                      </button>
                      <DataSelect
                        label="Polygon Fill Type"
                        options={POLYGON_FILL_TYPES}
                        selectedOption={POLYGON_FILL_TYPES.find(
                          (o) => o.value === rule[key],
                        )}
                        onChange={(opt) =>
                          handleStyleValueChange(key, opt?.value || "solid")
                        }
                        creatable={false}
                        style={{ minWidth: 120 }}
                      />
                      {/* Conditional extra options for hatching/crosshatch/dot */}
                      {rule[key] === "hatch" && (
                        <>
                          <DataSelect
                            label="Hatch Direction"
                            options={[
                              { value: "diagonal", label: "Diagonal" },
                              { value: "horizontal", label: "Horizontal" },
                              { value: "vertical", label: "Vertical" },
                            ]}
                            selectedOption={
                              rule.hatchDirection
                                ? {
                                    value: rule.hatchDirection,
                                    label:
                                      rule.hatchDirection
                                        .charAt(0)
                                        .toUpperCase() +
                                      rule.hatchDirection.slice(1),
                                  }
                                : null
                            }
                            onChange={(opt) =>
                              handleStyleValueChange(
                                "hatchDirection",
                                opt?.value || "diagonal",
                              )
                            }
                            creatable={false}
                            style={{ minWidth: 100 }}
                          />
                          <NormalInput
                            label="Hatch Spacing"
                            value={rule.hatchSpacing || ""}
                            type="number"
                            onChange={(e) =>
                              handleStyleValueChange(
                                "hatchSpacing",
                                e.target.value,
                              )
                            }
                            style={{ minWidth: 60 }}
                          />
                          <ColorPickerPopover
                            label="Hatch Color"
                            color={rule.hatchColor || "#000"}
                            onChange={(color) =>
                              handleStyleValueChange("hatchColor", color)
                            }
                            containerRef={containerRef}
                          />
                        </>
                      )}
                      {rule[key] === "crosshatch" && (
                        <>
                          <NormalInput
                            label="Hatch Spacing"
                            value={rule.hatchSpacing || ""}
                            type="number"
                            onChange={(e) =>
                              handleStyleValueChange(
                                "hatchSpacing",
                                e.target.value,
                              )
                            }
                            style={{ minWidth: 60 }}
                          />
                          <ColorPickerPopover
                            label="Hatch Color"
                            color={rule.hatchColor || "#000"}
                            onChange={(color) =>
                              handleStyleValueChange("hatchColor", color)
                            }
                            containerRef={containerRef}
                          />
                        </>
                      )}
                      {rule[key] === "dot" && (
                        <>
                          <NormalInput
                            label="Dot Radius"
                            value={rule.dotRadius || ""}
                            type="number"
                            onChange={(e) =>
                              handleStyleValueChange(
                                "dotRadius",
                                e.target.value,
                              )
                            }
                            style={{ minWidth: 60 }}
                          />
                          <NormalInput
                            label="Dot Spacing"
                            value={rule.dotSpacing || ""}
                            type="number"
                            onChange={(e) =>
                              handleStyleValueChange(
                                "dotSpacing",
                                e.target.value,
                              )
                            }
                            style={{ minWidth: 60 }}
                          />
                          <ColorPickerPopover
                            label="Dot Color"
                            color={rule.dotColor || "#444"}
                            onChange={(color) =>
                              handleStyleValueChange("dotColor", color)
                            }
                            containerRef={containerRef}
                          />
                        </>
                      )}
                    </div>
                  );
                }
                return (
                  <div
                    key={key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      marginTop: 8,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleRemoveStyle(key)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#d32f2f",
                        fontWeight: "bold",
                        fontSize: 20,
                        cursor: "pointer",
                        zIndex: 2,
                        marginRight: 4,
                      }}
                      aria-label={`Remove ${key} style option`}
                      title={`Remove ${key} style option`}
                    >
                      ×
                    </button>
                    {key === "fill" || key === "stroke" ? (
                      <ColorPickerPopover
                        label={key === "fill" ? "Fill" : "Stroke"}
                        color={rule[key]}
                        onChange={(color) => handleStyleValueChange(key, color)}
                        containerRef={containerRef}
                      />
                    ) : key === "shape" ? (
                      <DataSelect
                        label="Shape"
                        options={availableShapes.map((s) => ({
                          value: s,
                          label: s,
                        }))}
                        selectedOption={
                          rule[key]
                            ? { value: rule[key], label: rule[key] }
                            : null
                        }
                        onChange={(opt) =>
                          handleStyleValueChange(key, opt?.value || "circle")
                        }
                        creatable={false}
                        style={{ minWidth: 100 }}
                      />
                    ) : (
                      <NormalInput
                        label={key}
                        value={rule[key]}
                        type="number"
                        onChange={(e) =>
                          handleStyleValueChange(key, e.target.value)
                        }
                        style={{ minWidth: 60 }}
                      />
                    )}
                  </div>
                );
              })
          )}
        </div>
      </div>
    </RuleContainer>
  );
};

RuleEditor.propTypes = {
  rule: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
  availableShapes: PropTypes.array.isRequired,
  availableFields: PropTypes.array.isRequired,
  containerRef: PropTypes.object.isRequired,
  styleOptionFilter: PropTypes.array,
  hideConditionFields: PropTypes.bool,
};

export default RuleEditor;

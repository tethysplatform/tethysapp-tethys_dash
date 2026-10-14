import PropTypes from "prop-types";
import { memo, useState } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import styled from "styled-components";
import NormalInput from "components/inputs/NormalInput";
import ColorPickerPopOver from "components/inputs/ColorPickerPopOver";
import AnchorPicker, { ANCHOR_LABELS } from "components/inputs/AnchorPicker";
import {
  coerceNumericField,
  colorValue,
} from "components/modals/MapLayer/LabelsPane";
import { LABEL_ANCHOR_OPTIONS } from "components/map/labelStyle";
import {
  ARROWHEAD_OPTIONS,
  DEFAULT_ARROWHEAD_OPTIONS,
  annotationLabel,
  normalizeAnnotations,
  resetAnnotationOverride,
  resolveAnnotationDefaults,
  resolveAnnotationStyle,
} from "components/map/annotations";

const Section = styled.div`
  margin-bottom: 1.25rem;
`;

const SectionTitle = styled.h6`
  font-weight: bold;
  margin-bottom: 0.5rem;
`;

const Field = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.6rem;
`;

const FieldLabel = styled(Form.Label)`
  font-weight: bold;
  margin-bottom: 0;
  min-width: 10rem;
`;

const Control = styled.div`
  flex: 0 1 auto;
  max-width: ${(props) => props.$width || "16rem"};
`;

const Help = styled.p`
  color: #6c757d;
  font-size: 0.875rem;
  margin: 0 0 0.75rem;
`;

const ItemRow = styled.div`
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.5rem;
`;

const ItemHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ItemName = styled.span`
  flex: 1 1 auto;
  font-weight: 500;
`;

const ItemBody = styled.div`
  margin-top: 0.75rem;
`;

const OverrideState = styled.span`
  color: #6c757d;
  font-size: 0.8rem;
`;

export const ARROWHEAD_LABELS = {
  none: "None",
  end: "End",
  start: "Start",
  both: "Both ends",
};

// Which style properties each kind of annotation draws with. Overrides are
// only offered for these, so a line never shows a text-size control.
const FIELDS_BY_KIND = {
  line: ["lineColor", "lineWidth", "arrowheads"],
  text: ["textColor", "textSize", "haloColor", "textAnchor"],
};

const FIELD_LABELS = {
  lineColor: "Line Color",
  lineWidth: "Line Width",
  arrowheads: "Arrowheads",
  textColor: "Text Color",
  textSize: "Text Size",
  haloColor: "Text Outline Color",
  textAnchor: "Text Placement",
};

const COLOR_FIELDS = ["lineColor", "textColor", "haloColor"];
const NUMBER_FIELDS = ["lineWidth", "textSize"];

/**
 * One style control. `onChange` receives the new value, or `undefined` for a
 * cleared number field -- which means "unset" rather than zero.
 */
const StyleControl = ({
  field,
  value,
  storedValue,
  onChange,
  ariaPrefix,
  containerRef,
  arrowheadOptions,
  compactAnchor,
}) => {
  const label = `${ariaPrefix}${FIELD_LABELS[field]}`;
  if (COLOR_FIELDS.includes(field)) {
    return (
      <ColorPickerPopOver
        label={label}
        color={value}
        onChange={(color) => onChange(colorValue(color))}
        containerRef={containerRef}
        hideLabel
      />
    );
  }
  if (NUMBER_FIELDS.includes(field)) {
    return (
      // Bound to what is stored, not to the resolved value: clearing the field
      // to type a new number must leave it empty, not snap back to the value
      // it inherits -- which shows as the placeholder instead.
      <NormalInput
        value={storedValue ?? ""}
        placeholder={String(value)}
        type="number"
        min={1}
        onChange={(e) => {
          const next = coerceNumericField(e.target.value);
          onChange(next === "" ? undefined : next);
        }}
        ariaLabel={label}
        allowEmpty
      />
    );
  }
  if (field === "arrowheads") {
    return (
      <Form.Select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {arrowheadOptions.map((option) => (
          <option key={option} value={option}>
            {ARROWHEAD_LABELS[option]}
          </option>
        ))}
      </Form.Select>
    );
  }
  if (field === "textAnchor" && compactAnchor) {
    return (
      <Form.Select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {LABEL_ANCHOR_OPTIONS.map((anchor) => (
          <option key={anchor} value={anchor}>
            {ANCHOR_LABELS[anchor]}
          </option>
        ))}
      </Form.Select>
    );
  }
  return <AnchorPicker value={value} onChange={onChange} label={label} />;
};

StyleControl.propTypes = {
  field: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  // The stored value (an override, or the authored default), if any.
  storedValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  ariaPrefix: PropTypes.string,
  containerRef: PropTypes.object,
  arrowheadOptions: PropTypes.arrayOf(PropTypes.string),
  compactAnchor: PropTypes.bool,
};

const AnnotationItem = ({
  item,
  items,
  defaults,
  onItemChange,
  onDelete,
  containerRef,
}) => {
  const [expanded, setExpanded] = useState(false);
  const name = annotationLabel(item, items, defaults);
  const resolved = resolveAnnotationStyle(defaults, item.style);

  const setOverride = (field, value) => {
    if (value === undefined) {
      onItemChange(resetAnnotationOverride(item, field));
      return;
    }
    onItemChange({ ...item, style: { ...(item.style ?? {}), [field]: value } });
  };

  return (
    <ItemRow data-testid={`annotation-item-${item.id}`}>
      <ItemHeader>
        <ItemName>{name}</ItemName>
        <Button
          size="sm"
          variant="outline-secondary"
          aria-expanded={expanded}
          aria-label={`${expanded ? "Collapse" : "Expand"} ${name}`}
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? "Done" : "Edit"}
        </Button>
        <Button
          size="sm"
          variant="outline-danger"
          aria-label={`Delete ${name}`}
          onClick={onDelete}
        >
          Delete
        </Button>
      </ItemHeader>
      {expanded && (
        <ItemBody>
          {item.kind === "text" && (
            <Field>
              <FieldLabel>Text</FieldLabel>
              <Control $width="20rem">
                <NormalInput
                  value={item.text ?? ""}
                  type="text"
                  onChange={(e) =>
                    onItemChange({ ...item, text: e.target.value })
                  }
                  ariaLabel={`${name} Text`}
                />
              </Control>
            </Field>
          )}
          {FIELDS_BY_KIND[item.kind].map((field) => {
            const overridden = item.style?.[field] !== undefined;
            return (
              <Field key={field}>
                <FieldLabel>{FIELD_LABELS[field]}</FieldLabel>
                <Control $width={field === "arrowheads" ? "10rem" : "8rem"}>
                  <StyleControl
                    field={field}
                    value={resolved[field]}
                    storedValue={item.style?.[field]}
                    onChange={(value) => setOverride(field, value)}
                    ariaPrefix={`${name} `}
                    containerRef={containerRef}
                    arrowheadOptions={ARROWHEAD_OPTIONS}
                    compactAnchor
                  />
                </Control>
                {overridden ? (
                  <Button
                    size="sm"
                    variant="link"
                    aria-label={`Reset ${name} ${FIELD_LABELS[field]}`}
                    onClick={() => setOverride(field, undefined)}
                  >
                    Reset to default
                  </Button>
                ) : (
                  <OverrideState>Layer default</OverrideState>
                )}
              </Field>
            );
          })}
        </ItemBody>
      )}
    </ItemRow>
  );
};

AnnotationItem.propTypes = {
  item: PropTypes.object.isRequired,
  items: PropTypes.array.isRequired,
  defaults: PropTypes.object.isRequired,
  onItemChange: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  containerRef: PropTypes.object,
};

/**
 * The Annotations tab: the layer's default style, the list of its annotations
 * with per-annotation overrides, and the button that starts drawing on the
 * map. Geometry is only ever edited on the map; this tab edits everything
 * else.
 */
const AnnotationsPane = ({
  annotations,
  onChange,
  onEditOnMap,
  containerRef,
}) => {
  const { defaults, items } = normalizeAnnotations(annotations);
  const resolvedDefaults = resolveAnnotationDefaults(defaults);

  const setDefault = (field, value) => {
    const next = { ...defaults };
    if (value === undefined) {
      delete next[field];
    } else {
      next[field] = value;
    }
    onChange({ defaults: next, items });
  };

  const setItem = (index, next) =>
    onChange({
      defaults,
      items: items.map((item, i) => (i === index ? next : item)),
    });

  const deleteItem = (index) =>
    onChange({ defaults, items: items.filter((_, i) => i !== index) });

  return (
    <div data-testid="annotations-pane">
      <Section>
        <SectionTitle>Annotations</SectionTitle>
        <Help>
          Draw lines, arrows and text on the map. Each one stays pinned to the
          place you drew it as viewers pan and zoom.
        </Help>
        <Button
          variant="primary"
          onClick={onEditOnMap}
          disabled={!onEditOnMap}
          aria-label="Edit annotations on map"
        >
          Edit on map
        </Button>
      </Section>

      <Section>
        <SectionTitle>Default style</SectionTitle>
        <Help>
          Used by every annotation in this layer unless it sets its own value.
          Arrowheads apply to arrows; plain lines never draw them.
        </Help>
        {[...FIELDS_BY_KIND.line, ...FIELDS_BY_KIND.text].map((field) => (
          <Field key={field}>
            <FieldLabel>{FIELD_LABELS[field]}</FieldLabel>
            <Control $width={field === "arrowheads" ? "10rem" : "8rem"}>
              <StyleControl
                field={field}
                value={resolvedDefaults[field]}
                storedValue={defaults[field]}
                onChange={(value) => setDefault(field, value)}
                ariaPrefix="Default "
                containerRef={containerRef}
                arrowheadOptions={DEFAULT_ARROWHEAD_OPTIONS}
              />
            </Control>
          </Field>
        ))}
      </Section>

      <Section>
        <SectionTitle>In this layer</SectionTitle>
        {items.length === 0 ? (
          <Help>
            This layer has no annotations yet. Use Edit on map to draw some.
          </Help>
        ) : (
          items.map((item, index) => (
            <AnnotationItem
              key={item.id ?? index}
              item={item}
              items={items}
              defaults={defaults}
              onItemChange={(next) => setItem(index, next)}
              onDelete={() => deleteItem(index)}
              containerRef={containerRef}
            />
          ))
        )}
      </Section>
    </div>
  );
};

AnnotationsPane.propTypes = {
  annotations: PropTypes.shape({
    defaults: PropTypes.object,
    items: PropTypes.array,
  }),
  onChange: PropTypes.func.isRequired,
  // Starts the on-map editing session; absent until the editor can host one.
  onEditOnMap: PropTypes.func,
  containerRef: PropTypes.object,
};

export default memo(AnnotationsPane);

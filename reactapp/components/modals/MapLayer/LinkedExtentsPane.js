import PropTypes from "prop-types";
import { memo } from "react";
import Alert from "react-bootstrap/Alert";
import Form from "react-bootstrap/Form";
import styled from "styled-components";
import NormalInput from "components/inputs/NormalInput";
import ColorPickerPopOver from "components/inputs/ColorPickerPopOver";
import {
  coerceNumericField,
  colorValue,
} from "components/modals/MapLayer/LabelsPane";
import { resolveLinkedExtentStyle } from "components/map/decorationLayers";
import { readLinkedExtentGroup } from "components/map/viewGroup";

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
  max-width: ${(props) => props.$width || "8rem"};
`;

const Help = styled.p`
  color: #6c757d;
  font-size: 0.875rem;
  margin: 0 0 0.75rem;
`;

/**
 * The Outline tab of a Linked Extents layer: the one style every outline it
 * draws shares, and a note when its map belongs to no linked extent group --
 * the case in which the layer draws nothing at all.
 */
const LinkedExtentsPane = ({ style, onChange, mapExtent, containerRef }) => {
  const resolved = resolveLinkedExtentStyle(style);
  // Undefined when the editor was opened somewhere the map's extent settings
  // do not reach; the note is only shown when there is something to judge.
  const groupName =
    mapExtent === undefined ? undefined : readLinkedExtentGroup(mapExtent);

  const set = (key, value) => {
    const next = { ...(style ?? {}) };
    if (value === undefined || value === "") {
      delete next[key];
    } else {
      next[key] = value;
    }
    onChange(next);
  };

  return (
    <div data-testid="linked-extents-pane">
      <Help>
        Outlines where each other map in this map&apos;s linked extent group is
        looking, updated as they pan and zoom. A map that shares this map&apos;s
        view group, or that is on a tab no one is viewing, is not outlined.
      </Help>
      {groupName === null && (
        <Alert variant="warning" role="status">
          This map is not in a linked extent group, so this layer draws nothing.
          Name a group under Map Extent, Linked Extent Group, and give the other
          maps the same name.
        </Alert>
      )}
      {groupName && (
        <Help>
          Showing the maps in group <b>{groupName}</b>.
        </Help>
      )}
      <Field>
        <FieldLabel>Outline Color</FieldLabel>
        <Control>
          <ColorPickerPopOver
            label="Outline Color"
            color={resolved.color}
            onChange={(color) => set("color", colorValue(color))}
            containerRef={containerRef}
            hideLabel
          />
        </Control>
      </Field>
      <Field>
        <FieldLabel>Outline Width</FieldLabel>
        <Control $width="6rem">
          <NormalInput
            value={style?.width ?? ""}
            placeholder={String(resolved.width)}
            type="number"
            min={1}
            onChange={(e) => set("width", coerceNumericField(e.target.value))}
            ariaLabel="Outline Width"
            allowEmpty
          />
        </Control>
      </Field>
      <Field>
        <FieldLabel>Fill Color</FieldLabel>
        <Control>
          <ColorPickerPopOver
            label="Fill Color"
            color={resolved.fillColor}
            onChange={(color) => set("fillColor", colorValue(color))}
            containerRef={containerRef}
            hideLabel
          />
        </Control>
      </Field>
    </div>
  );
};

LinkedExtentsPane.propTypes = {
  style: PropTypes.shape({
    color: PropTypes.string,
    width: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    fillColor: PropTypes.string,
  }),
  onChange: PropTypes.func.isRequired,
  // The map's in-progress `map_extent` value, when the editor has it.
  mapExtent: PropTypes.any,
  containerRef: PropTypes.object,
};

export default memo(LinkedExtentsPane);

import PropTypes from "prop-types";
import NormalInput from "components/inputs/NormalInput";
import {
  layerPropertiesOptions,
  ZOOM_ON_CHANGE_SOURCE_TYPES,
} from "components/map/utilities";
import {
  DECORATION_HIDDEN_LAYER_PROPS,
  isDecorationSourceType,
} from "components/map/decorationLayers";
import InputTable from "components/inputs/InputTable";
import { memo } from "react";
import styled from "styled-components";
import { spaceAndCapitalize } from "components/modals/utilities";
import Toggle from "components/inputs/Toggle";

const PaddedDiv = styled.div`
  padding-bottom: 1rem;
  display: flex;
  width: 100%;
  gap: 5rem;
`;

// The registry rows this layer can use. Rows, placeholders and types are all
// built from this one list: `handlePropertyChange` indexes rows by position,
// so the three arrays have to be filtered together.
//
// Zoom To Layer On Change needs a layer the map can be fitted to: a dynamic
// plugin layer, or a static source whose data the browser holds.
const layerPropertyKeys = (sourceType, isDynamicLayer) => {
  const isDecoration = isDecorationSourceType(sourceType);
  const canZoomOnChange =
    isDynamicLayer || ZOOM_ON_CHANGE_SOURCE_TYPES.includes(sourceType);
  return Object.keys(layerPropertiesOptions).filter(
    (key) =>
      !(isDecoration && DECORATION_HIDDEN_LAYER_PROPS.includes(key)) &&
      (canZoomOnChange || key !== "zoomToLayerOnChange"),
  );
};

const LayerPane = ({
  layerProps,
  setLayerProps,
  sourceType,
  isDynamicLayer,
}) => {
  const propertyKeys = layerPropertyKeys(sourceType, isDynamicLayer);
  // Derived during render, not mirrored into state: the rows must always come
  // from the same key list as the placeholders and types below. A copy synced
  // by an effect lags one render behind a source-type change, and the table
  // then reads a placeholder for a row that list no longer has.
  const layerProperties = filterLayerProps(layerProps);

  function filterLayerProps(props) {
    return loadExistingArgs(
      Object.fromEntries(
        Object.entries(props).filter(
          ([key]) => !["name", "layerVisibility"].includes(key),
        ),
      ),
    );
  }

  // setup placeholders for the input table
  const propertyPlaceholders = propertyKeys.map((key) => ({
    value: layerPropertiesOptions[key].placeholder,
  }));
  // setup placeholders for the input table
  const propertyTypes = propertyKeys.map(
    (key) => layerPropertiesOptions[key].type,
  );

  function loadExistingArgs(existingProps) {
    // create an array for the input table of the various properties
    return propertyKeys.map((key) => ({
      rawProperty: key,
      property: spaceAndCapitalize(key),
      value: existingProps[key] ?? "",
    }));
  }

  function handlePropertyChange({ newValue, rowIndex }) {
    // update property based on the table row
    const updatedLayerProps = JSON.parse(JSON.stringify(layerProps));
    const property = layerProperties[rowIndex]["rawProperty"];
    updatedLayerProps[property] = newValue;
    setLayerProps(updatedLayerProps);
  }

  function onVisibilityToggle(newValue) {
    setLayerProps((previousLayerProps) => {
      const { layerVisibility, ...rest } = previousLayerProps;

      return newValue ? rest : { ...rest, layerVisibility: newValue }; // remove layerVisibility unless its false
    });
  }

  return (
    <>
      <PaddedDiv>
        <NormalInput
          label={"Name"}
          onChange={(e) => {
            setLayerProps((previousLayerProps) => ({
              ...previousLayerProps,
              ...{
                name: e.target.value,
              },
            }));
          }}
          value={layerProps.name ?? ""}
          type={"text"}
          divProps={{ style: { flex: 1 } }}
        />
        <Toggle
          checked={layerProps.layerVisibility !== false}
          label={"Default Visibility"}
          uncheckedLabel={"Invisible"}
          checkedLabel={"Visible"}
          onChange={onVisibilityToggle}
        />
      </PaddedDiv>
      <InputTable
        label="Layer Properties"
        onChange={handlePropertyChange}
        values={layerProperties}
        disabledFields={["property"]}
        hiddenFields={["rawProperty"]}
        placeholders={propertyPlaceholders}
        types={propertyTypes}
        show_placeholder_on_hover={true}
      />
    </>
  );
};

LayerPane.propTypes = {
  layerProps: PropTypes.shape({
    name: PropTypes.string, // name of the layer
    opacity: PropTypes.oneOfType([PropTypes.number, PropTypes.string]), // opacity of the layer (0-1)
    minResolution: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    maxResolution: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    minZoom: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    maxZoom: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    layerVisibility: PropTypes.bool,
  }),
  setLayerProps: PropTypes.func,
  // The layer's source type; decoration layers omit rows that cannot apply.
  sourceType: PropTypes.string,
  // Whether the source is a dynamic plugin, which is offered Zoom To Layer On
  // Change whatever its type (see layerPropertyKeys).
  isDynamicLayer: PropTypes.bool,
};

export default memo(LayerPane);

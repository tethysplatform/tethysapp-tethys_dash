import PropTypes from "prop-types";
import NormalInput from "components/inputs/NormalInput";
import { layerPropertiesOptions } from "components/map/utilities";
import InputTable from "components/inputs/InputTable";
import { useState, useEffect } from "react";
import styled from "styled-components";
import { spaceAndCapitalize } from "components/modals/utilities";
import Toggle from "components/inputs/Toggle";

const PaddedDiv = styled.div`
  padding-bottom: 1rem;
  display: flex;
  width: 100%;
  gap: 5rem;
`;

const LayerPane = ({ layerProps, setLayerProps }) => {
  const [layerProperties, setLayerProperties] = useState(
    filterLayerProps(layerProps)
  );

  useEffect(() => {
    setLayerProperties(filterLayerProps(layerProps));
    // eslint-disable-next-line
  }, [layerProps]);

  function filterLayerProps(props) {
    return loadExistingArgs(
      Object.fromEntries(
        Object.entries(props).filter(
          ([key]) => !["name", "layerVisibility"].includes(key)
        )
      )
    );
  }

  // setup placeholders for the input table
  const propertyPlaceholders = Object.keys(layerPropertiesOptions).map(
    (key) => ({
      value: layerPropertiesOptions[key].placeholder,
    })
  );
  // setup placeholders for the input table
  const propertyTypes = Object.keys(layerPropertiesOptions).map(
    (key) => layerPropertiesOptions[key].type
  );

  function loadExistingArgs(existingProps) {
    // create an array for the input table of the various properties
    return Object.keys(layerPropertiesOptions).map((key) => ({
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
    opacity: PropTypes.string,
    minResolution: PropTypes.string,
    maxResolution: PropTypes.string,
    minZoom: PropTypes.string,
    maxZoom: PropTypes.string,
    layerVisibility: PropTypes.bool,
  }),
  setLayerProps: PropTypes.func,
};

export default LayerPane;

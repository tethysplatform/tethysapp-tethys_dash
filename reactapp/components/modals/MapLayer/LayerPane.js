import PropTypes from "prop-types";
import NormalInput from "components/inputs/NormalInput";
import { layerPropertiesOptions } from "components/map/utilities";
import InputTable from "components/inputs/InputTable";
import { useState } from "react";
import styled from "styled-components";

const PaddedDiv = styled.div`
  padding-bottom: 1rem;
`;

const LayerPane = ({ layerProps, setLayerProps }) => {
  // load existing layerProperties
  const layerProperties = loadExistingArgs(
    Object.fromEntries(
      Object.entries(layerProps).filter(([key]) => key !== "name")
    )
  );
  // setup placeholders for the input table
  const propertyPlaceholders = Object.keys(layerPropertiesOptions).map(
    (key) => ({
      value: layerPropertiesOptions[key],
    })
  );

  const [name, setName] = useState(layerProps?.name ?? "");

  function loadExistingArgs(existingProps) {
    // create an array for the input table of the various properties
    return Object.keys(layerPropertiesOptions).map((key) => ({
      required: false,
      property: key,
      value: existingProps[key] ?? "",
    }));
  }

  function handlePropertyChange({ newValue, rowIndex }) {
    // update property based on the table row
    const updatedLayerProps = JSON.parse(JSON.stringify(layerProps));
    const property = layerProperties[rowIndex]["property"];
    updatedLayerProps[property] = newValue;
    setLayerProps(updatedLayerProps);
  }

  return (
    <>
      <PaddedDiv>
        <NormalInput
          label={"Name"}
          onChange={(e) => {
            setName(e.target.value);
            setLayerProps((previousLayerProps) => ({
              ...previousLayerProps,
              ...{
                name: e.target.value,
              },
            }));
          }}
          value={name}
          type={"text"}
        />
      </PaddedDiv>
      <InputTable
        label="Layer Properties"
        onChange={handlePropertyChange}
        values={layerProperties}
        disabledFields={["required", "property"]}
        allowRowCreation={true}
        placeholders={propertyPlaceholders}
      />
    </>
  );
};

LayerPane.propTypes = {
  layerProps: PropTypes.shape({
    name: PropTypes.string.isRequired, // name of the layer
    opacity: PropTypes.string,
    minResolution: PropTypes.string,
    maxResolution: PropTypes.string,
    minZoom: PropTypes.string,
    maxZoom: PropTypes.string,
  }),
  setLayerProps: PropTypes.func,
};

export default LayerPane;

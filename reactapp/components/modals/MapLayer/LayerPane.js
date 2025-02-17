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
  const layerProperties = loadExistingArgs(
    Object.fromEntries(
      Object.entries(layerProps).filter(([key]) => key !== "name")
    )
  );
  const propertyPlaceholders = Object.keys(layerPropertiesOptions).map(
    (key) => ({
      value: layerPropertiesOptions[key],
    })
  );

  const [name, setName] = useState(layerProps?.name ?? "");

  function loadExistingArgs(existingProps) {
    return Object.keys(layerPropertiesOptions).map((key) => ({
      required: false,
      property: key,
      value: existingProps[key] ?? "",
    }));
  }

  function handlePropertyChange({ newValue, rowIndex }) {
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
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
    PropTypes.object,
  ]),
  showModal: PropTypes.bool,
  handleModalClose: PropTypes.func,
};

export default LayerPane;

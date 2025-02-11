import PropTypes from "prop-types";
import DataInput from "components/inputs/DataInput";
import { layerPropertiesOptions } from "components/map/utilities";
import InputTable from "components/inputs/InputTable";
import { useState } from "react";

const LayerPane = ({ layerProps, setLayerProps }) => {
  const [layerProperties, setLayerProperties] = useState(
    loadExistingArgs(
      Object.fromEntries(
        Object.entries(layerProps).filter(([key]) => key !== "name")
      )
    )
  );
  const [name, setName] = useState(layerProps?.name ?? "");

  function loadExistingArgs(existingProps) {
    return Object.keys(layerPropertiesOptions).map((key) => ({
      required: false,
      property: key,
      value: {
        value: existingProps[key] ?? "",
        placeholder: layerPropertiesOptions[key],
      },
    }));
  }

  function handlePropertyChange(updatedUserInputs) {
    const updatedLayerProps = JSON.parse(JSON.stringify(layerProps));
    updatedUserInputs.forEach(({ property, value }) => {
      updatedLayerProps[property] = value;
    });
    setLayerProps(updatedLayerProps);
    setLayerProperties(updatedUserInputs);
  }

  return (
    <>
      <DataInput
        objValue={{ label: "Name", type: "text", value: name }}
        onChange={(e) => {
          setName(e);
          setLayerProps((previousLayerProps) => ({
            ...previousLayerProps,
            ...{
              name: e,
            },
          }));
        }}
      />
      <InputTable
        label="Layer Properties"
        onChange={handlePropertyChange}
        values={layerProperties}
        disabledFields={["required", "property"]}
        allowRowCreation={true}
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

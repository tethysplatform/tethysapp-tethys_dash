import { useState, useEffect } from "react";
import styled from "styled-components";
import PropTypes from "prop-types";
import NormalInput from "components/inputs/NormalInput";

const WideLabel = styled.label`
  width: 100%;
  margin-bottom: 0.5rem;
`;

const FlexLabel = styled.label`
  display: flex;
  align-items: center;
  margin-bottom: 0.5rem;
`;

const Flex1Div = styled.div`
  flex: 1;
  margin-left: 1rem;
`;

function getDependentVariableInputs(inputs) {
  const regex = /\${(.*?)}/g; // Matches ${...}
  const uniqueValues = new Set();

  Object.values(inputs).forEach((item) => {
    let match;
    while ((match = regex.exec(item?.value ?? item)) !== null) {
      uniqueValues.add(match[1]); // Extract the variable name
    }
  });

  return [...uniqueValues];
}

const CustomMessaging = ({
  vizInputsValues,
  customMessaging,
  setCustomMessaging,
}) => {
  const [dependentVariableInputs, setDependentVariableInputs] = useState(
    getDependentVariableInputs(vizInputsValues)
  );

  useEffect(() => {
    setDependentVariableInputs(getDependentVariableInputs(vizInputsValues));
    // eslint-disable-next-line
  }, [vizInputsValues]);

  function onCustomMessageChange(type, message) {
    setCustomMessaging((prevValue) => ({ ...prevValue, [type]: message }));
  }

  return (
    <WideLabel>
      <b className="no-caret">Custom Messaging</b>:
      <div>
        <FlexLabel>
          Error -
          <Flex1Div>
            <NormalInput
              type="text"
              value={customMessaging.error ?? ""}
              onChange={(e) => onCustomMessageChange("error", e.target.value)}
              ariaLabel={"error Custom Message Input"}
            />
          </Flex1Div>
        </FlexLabel>
        {dependentVariableInputs.map((dependentVariableInput, index) => (
          <FlexLabel key={index}>
            {`Empty ${dependentVariableInput} Variable -`}
            <Flex1Div>
              <NormalInput
                type="text"
                value={customMessaging[dependentVariableInput] ?? ""}
                onChange={(e) =>
                  onCustomMessageChange(dependentVariableInput, e.target.value)
                }
                ariaLabel={`${dependentVariableInput} Custom Message Input`}
              />
            </Flex1Div>
          </FlexLabel>
        ))}
      </div>
    </WideLabel>
  );
};

CustomMessaging.propTypes = {
  vizInputsValues: PropTypes.object,
  customMessaging: PropTypes.objectOf(PropTypes.string),
  setCustomMessaging: PropTypes.func,
};

export default CustomMessaging;

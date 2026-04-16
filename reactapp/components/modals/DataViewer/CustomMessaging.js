import { useState, useEffect } from "react";
import styled from "styled-components";
import PropTypes from "prop-types";
import NormalInput from "components/inputs/NormalInput";
import { getDependentVariableInputs } from "components/visualizations/utilities";

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

const StyledDiv = styled.div`
  padding-left: 2rem;
`;

const CustomMessaging = ({
  vizInputsValues,
  initialCustomMessaging,
  onChange,
}) => {
  const [customMessaging, setCustomMessaging] = useState(
    initialCustomMessaging ?? {}
  );
  const [dependentVariableInputs, setDependentVariableInputs] = useState(
    getDependentVariableInputs(vizInputsValues)
  );

  useEffect(() => {
    onChange(customMessaging);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customMessaging]);

  useEffect(() => {
    setDependentVariableInputs(getDependentVariableInputs(vizInputsValues));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vizInputsValues]);

  function onCustomMessageChange(type, message) {
    setCustomMessaging((prevValue) => ({ ...prevValue, [type]: message }));
  }

  return (
    <WideLabel>
      <b className="no-caret">Custom Messaging</b>:
      <StyledDiv>
        <FlexLabel>
          On Error -
          <Flex1Div>
            <NormalInput
              type="text"
              value={customMessaging.error ?? ""}
              onChange={(e) => onCustomMessageChange("error", e.target.value)}
              ariaLabel={"error Custom Message Input"}
            />
          </Flex1Div>
        </FlexLabel>
        {dependentVariableInputs.length > 0 && (
          <FlexLabel>
            On Any Empty Variable -
            <Flex1Div>
              <NormalInput
                type="text"
                value={customMessaging.anyEmptyVariable ?? ""}
                onChange={(e) =>
                  onCustomMessageChange("anyEmptyVariable", e.target.value)
                }
                ariaLabel={"anyEmptyVariable Custom Message Input"}
              />
            </Flex1Div>
          </FlexLabel>
        )}
        {dependentVariableInputs.map((dependentVariableInput, index) => (
          <FlexLabel key={index}>
            {`On Empty ${dependentVariableInput} Variable -`}
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
      </StyledDiv>
    </WideLabel>
  );
};

CustomMessaging.propTypes = {
  vizInputsValues: PropTypes.object,
  initialCustomMessaging: PropTypes.objectOf(PropTypes.string),
  onChange: PropTypes.func,
};

export default CustomMessaging;

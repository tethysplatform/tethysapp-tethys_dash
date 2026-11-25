import { useState, useEffect, useMemo } from "react";
import styled from "styled-components";
import PropTypes from "prop-types";
import NormalInput from "components/inputs/NormalInput";
import { findGatingVariableInputTokens } from "components/visualizations/utilities";
import { argsAsSaved } from "components/modals/utilities";

/**
 * The variables a tile can show an empty-variable message for: those that
 * can hold it back on the dashboard, read from the args as they will be
 * saved. That leaves out variables used only as an optional arg, `feature.*`
 * tokens, and variables inside a popup layout or a map layer's labels, none
 * of which ever shows a message.
 */
function messageableVariableInputs(vizInputsValues, optionalArgs) {
  return findGatingVariableInputTokens(
    argsAsSaved(vizInputsValues),
    optionalArgs,
  ).filter((name) => !name.startsWith("feature."));
}

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
  optionalArgs,
  initialCustomMessaging,
  onChange,
}) => {
  const [customMessaging, setCustomMessaging] = useState(
    initialCustomMessaging ?? {},
  );
  const dependentVariableInputs = useMemo(
    () => messageableVariableInputs(vizInputsValues, optionalArgs),
    [vizInputsValues, optionalArgs],
  );

  useEffect(() => {
    onChange(customMessaging);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customMessaging]);

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
  optionalArgs: PropTypes.arrayOf(PropTypes.string), // the plugin's optional args
  initialCustomMessaging: PropTypes.objectOf(PropTypes.string),
  onChange: PropTypes.func,
};

export default CustomMessaging;

import { useState, useEffect, useContext } from 'react';
import { VariableInputsContext } from 'components/contexts/Contexts';

const CONDITIONAL_CHECKS = {
  isEmpty: (val, comparison) => val === "",
  isNotEmpty: (val, comparison) => val !== "",
  textContains: (val, comparison) => val === comparison,
  textNotContains: (val, comparison) => val !== comparison,
  greaterThan: (val, comparison) => val > comparison,
  lessThan: (val, comparison) => val < comparison,
  greaterThanEqual: (val, comparison) => val >= comparison,
  lessThanEqual: (val, comparison) => val <= comparison,
  equal: (val, comparison) => val === comparison,
  notEqual: (val, comparison) => val !== comparison,
  badError: (val, comparison) => false // Returns false as the default if the error check is malformed
}

/**
 * Custom hook to evaluate conditions on a variable and return results and messages.
 * 
 * @param {Array<{
 *   variableName: string,
 *   operator: string,
 *   comparison?: any,
 *   resultMessage: string
 * }>} checks - List of checks to perform.
 * @returns {{
 *   passed: boolean,
 *   resultMessages: string[]
 * }} The evaluation result and messages.
 */
const useConditionalChecks = (checks) => {
  const [results, setResults] = useState({ passed: true, resultMessages: [] });
  const { variableInputValues } = useContext(
    VariableInputsContext
  );

  useEffect(() => {
    const resultMessages = [];
    let allPassed = true;

    if (checks) {
      checks.forEach(({ variableName, operator, comparison, resultMessage }) => {
        const checkFunction = CONDITIONAL_CHECKS[operator] || CONDITIONAL_CHECKS.badError;
        if (!checkFunction(variableInputValues[variableName], comparison)) {
          allPassed = false;
          resultMessages.push(resultMessage);
        }
      });
    } 

    setResults({ passed: allPassed, resultMessages });
  }, [checks, variableInputValues]);

  return results;
};

export default useConditionalChecks;
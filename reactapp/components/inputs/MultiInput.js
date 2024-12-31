import React, { useState, useRef } from "react";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import styled from "styled-components";

const StyledValue = styled.span`
  width: auto;
  border: 1px solid #ccc;
  margin-right: 0.5rem;
  padding-right: 0;
  background-color: #b8eeff;
`;
const StyledRow = styled(Row)`
  padding-top: 0.5rem;
`;
const StyledDiv = styled.div`
  overflow-x: auto;
  white-space: nowrap;
`;
const StyledButton = styled.button`
  margin-left: 0.5rem;
  border: none;
  background-color: white;
`;

const MultiInput = ({ label, onChange, values }) => {
  const id = label.toLowerCase().replace(" ", "");
  const [userInput, setUserInput] = useState("");
  const inputValues = useRef(values);

  const addValue = (value) => {
    inputValues.current = [...inputValues.current, value];
    onChange(inputValues.current);
  };

  const removeValue = (value) => {
    inputValues.current = inputValues.current.filter((t) => t !== value);
    onChange(inputValues.current);
  };

  const handleInputChange = (e) => {
    setUserInput(e.target.value);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      e.preventDefault(); // Prevent form submission or new line creation

      if (userInput.trim() !== "") {
        addValue(userInput);
        setUserInput(""); // Clear the input after adding a tag
      }
    }
  };

  return (
    <Container>
      <Row className="mb-1">
        <label htmlFor={id}>
          <b>{label}</b>:
        </label>
        <br />
        <input
          id={id}
          name="keyword_tags"
          type="text"
          placeholder="Add a value and press enter"
          className="w-100 border border-gray-300 rounded-md px-4 py-2"
          onKeyDown={handleKeyPress}
          onChange={handleInputChange}
          value={userInput}
        />
      </Row>

      <StyledRow>
        {values.map((value, index) => (
          <StyledDiv key={index}>
            <StyledValue>
              {value}
              <StyledButton
                onClick={() => removeValue(value)}
                title={`Remove ${value}`}
              >
                x
              </StyledButton>
            </StyledValue>
          </StyledDiv>
        ))}
      </StyledRow>
    </Container>
  );
};

export default MultiInput;

import styled from "styled-components";
import Select from "react-select";
import PropTypes from "prop-types";

const StyledSelect = styled(Select)`
  width: 20rem;
  margin-right: 0.5rem;
  display: inline-block;
`;

const StyledLabel = styled.label`
  color: white;
  padding-right: 1rem;
`;

const DashboardSelect = ({ children, options, ...props }) => {
  return (
    <>
      <StyledLabel htmlFor={"dashboardSelector"}>
        Select/Add Dashboard:
      </StyledLabel>
      <StyledSelect
        inputId={"dashboardSelector"}
        options={options}
        styles={{
          groupHeading: (base) => ({
            ...base,
            flex: "1 1",
            color: "black",
            backgroundColor: "lightgray",
            margin: 0,
            fontSize: "12",
          }),
          option: (styles, { data, isFocused }) => ({
            ...styles,
            backgroundColor: data.color
              ? data.color
              : isFocused && "rgb(163, 196, 247, .5)",
            color: "black",
          }),
        }}
        {...props}
      >
        {children}
      </StyledSelect>
    </>
  );
};

DashboardSelect.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
  ]),
  options: PropTypes.arrayOf(PropTypes.object),
};

export default DashboardSelect;

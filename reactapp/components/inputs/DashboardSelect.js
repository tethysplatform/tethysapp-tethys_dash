import styled from "styled-components";
import Select from "react-select";
import PropTypes from "prop-types";

const StyledSelect = styled(Select)`
  width: 20rem;
  margin-right: 0.5rem;
  display: inline-block;
`;

const DashboardSelect = ({ children, options, ...props }) => {
  const styledSelect = (
    <StyledSelect
      options={options}
      styles={{
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
  );
  return styledSelect;
};

DashboardSelect.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
  ]),
  options: PropTypes.arrayOf(PropTypes.object),
};

export default DashboardSelect;

import styled from 'styled-components';
import Select from 'react-select'


const StyledSelect = styled(Select)`
  width: 20rem;
  margin-right: .5rem;
  display: inline-block;
`;


const SelectInput = ({children, options, ...props}) => {
  const styledSelect = (
    <StyledSelect 
      options={options} 
      styles={{
        option: (styles, { data, isFocused }) => ({
          ...styles,
          backgroundColor: data.color
            ? data.color
            : isFocused
            && "rgb(163, 196, 247, .5)",
          color: "black"
        }),
      }}
      {...props}
    >
      {children}
    </StyledSelect>
  );
  return styledSelect;
}


export default SelectInput
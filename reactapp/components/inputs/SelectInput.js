import styled from 'styled-components';
import Select from 'react-select'


const StyledSelect = styled(Select)`
  padding: 10px;
`;


const SelectInput = ({children, options, ...props}) => {
  const styledSelect = (
    <StyledSelect options={options} {...props}>{children}</StyledSelect>
  );
  return styledSelect;
}


export default SelectInput
import styled from 'styled-components';
import Select from 'react-select'


const StyledSelect = styled(Select)`
  width: 20rem;
  margin-right: .5rem;
  display: inline-block;
`;


const SelectInput = ({children, options, ...props}) => {
  const styledSelect = (
    <StyledSelect options={options} {...props}>{children}</StyledSelect>
  );
  return styledSelect;
}


export default SelectInput
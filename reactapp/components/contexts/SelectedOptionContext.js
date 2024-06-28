import PropTypes from 'prop-types'
import { useContext, createContext, useState } from "react";

const SelectedOptionContext = createContext();

const SelectedOptionContextProvider = ({ children }) => {
  const [selectedOption, setSelectedOption] = useState(null)

  return (
    <SelectedOptionContext.Provider value={[selectedOption, setSelectedOption]}>
      {children}
    </SelectedOptionContext.Provider>
  );

};

SelectedOptionContextProvider.propTypes = {
  children: PropTypes.oneOfType([
      PropTypes.arrayOf(PropTypes.node),
      PropTypes.node
  ]),
}

export default SelectedOptionContextProvider;

export const useSelectedOptionContext = () => {
  return useContext(SelectedOptionContext);
};
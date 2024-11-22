import PropTypes from "prop-types";
import appAPI from "services/api/app";
import { useContext, useEffect, createContext, useState } from "react";
import { spaceAndCapitalize } from "components/modals/utilities";

export const AvailableVisualizationsContext = createContext();

const AvailableVisualizationsContextProvider = ({ children }) => {
  const [availableVisualizations, setAvailableVisualizations] = useState([]);
  const [availableVizArgs, setAvailableVizArgs] = useState([]);

  useEffect(() => {
    appAPI.getVisualizations().then((data) => {
      let options = data.visualizations;
      setAvailableVisualizations(options);
      let all_viz_args = [];
      for (let optionGroup of options) {
        for (let option of optionGroup.options) {
          let args = option.args;
          for (let arg in args) {
            all_viz_args.push({
              label:
                optionGroup.label +
                ": " +
                option.label +
                " - " +
                spaceAndCapitalize(arg),
              value:
                optionGroup.label +
                ": " +
                option.label +
                " - " +
                spaceAndCapitalize(arg),
              argOptions: args[arg],
            });
          }
        }
      }
      setAvailableVizArgs(all_viz_args);
    });
    // eslint-disable-next-line
  }, []);

  return (
    <AvailableVisualizationsContext.Provider
      value={{availableVisualizations, availableVizArgs}}
    >
      {children}
    </AvailableVisualizationsContext.Provider>
  );
};

AvailableVisualizationsContextProvider.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
  ]),
};

export default AvailableVisualizationsContextProvider;

export const useAvailableVisualizationsContext = () => {
  return useContext(AvailableVisualizationsContext);
};

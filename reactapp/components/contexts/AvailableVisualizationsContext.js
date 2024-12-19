import PropTypes from "prop-types";
import appAPI from "services/api/app";
import { useContext, useEffect, createContext, useState } from "react";
import { spaceAndCapitalize } from "components/modals/utilities";
import { nonDropDownVariableInputTypes } from "components/visualizations/utilities";

export const AvailableVisualizationsContext = createContext();

const AvailableVisualizationsContextProvider = ({ children }) => {
  const [availableVisualizations, setAvailableVisualizations] = useState([]);
  const [availableVizArgs, setAvailableVizArgs] = useState([]);

  useEffect(() => {
    appAPI.getVisualizations().then((data) => {
      const options = data.visualizations;
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

      options.push({
        label: "Other",
        options: [
          {
            source: "Custom Image",
            value: "Custom Image",
            label: "Custom Image",
            args: { image_source: "text" },
          },
          {
            source: "Text",
            value: "Text",
            label: "Text",
            args: { text: "text" },
          },
          {
            source: "Variable Input",
            value: "Variable Input",
            label: "Variable Input",
            args: {
              variable_name: "text",
              variable_options_source: [
                ...nonDropDownVariableInputTypes,
                ...[
                  {
                    label: "Existing Visualization Inputs",
                    options: all_viz_args,
                  },
                ],
              ],
            },
          },
        ],
      });
      setAvailableVisualizations(options);
    });
    // eslint-disable-next-line
  }, []);

  return (
    <AvailableVisualizationsContext.Provider
      value={{ availableVisualizations, availableVizArgs }}
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

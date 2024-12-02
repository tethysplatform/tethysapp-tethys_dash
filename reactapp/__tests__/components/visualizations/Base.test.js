import PropTypes from "prop-types";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { mockedBase, mockedVisualizations } from "__tests__/utilities/constants";
import Base from "components/visualizations/Base";
import appAPI from "services/api/app";
import { EditingContext } from "components/contexts/EditingContext";
import { VariableInputValuesContext } from "components/contexts/VariableInputsContext";

appAPI.getVisualizations = () => {
  return Promise.resolve({ visualizations: mockedVisualizations });
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function initAndRender(props) {
  const user = userEvent.setup();
  const hideFullscreen = jest.fn();
  const setVariableInputValues = jest.fn();
  const updateVariableInputValuesWithGridItems = jest.fn();
  const setIsEditing = jest.fn();

  const BaseRender = (props) => {
    return (
      <VariableInputValuesContext.Provider
        value={{
          variableInputValues: props.variableInputValues,
          setVariableInputValues,
          updateVariableInputValuesWithGridItems,
        }}
      >
        <EditingContext.Provider value={{isEditing: props.isEditing, setIsEditing}}>
          <Base
            source={props.source}
            argsString={props.argsString}
            metadataString={props.metadataString}
            showFullscreen={props.showFullscreen}
            hideFullscreen={hideFullscreen}
          />
        </EditingContext.Provider>
      </VariableInputValuesContext.Provider>
    );
  };

  BaseRender.propTypes = {
    source: PropTypes.string,
    argsString: PropTypes.string,
    metadataString: PropTypes.string,
    showFullscreen: PropTypes.bool,
    hideFullscreen: PropTypes.func,
    variableInputValues: PropTypes.array,
    isEditing: PropTypes.bool,
  };

  const { rerender } = render(BaseRender(props));

  return {
    user,
    BaseRender,
    rerender,
    setVariableInputValues,
    updateVariableInputValuesWithGridItems,
    setIsEditing,
    hideFullscreen,
  }
}

it("Creates an Base Item with an image obtained from the api", async () => {
  appAPI.getPlotData = () => {
    return Promise.resolve({
      success: true,
      data: "https://www.cnrfc.noaa.gov/images/ensembles/PLBC1.ens_accum10day.png",
      viz_type: "image"
    });
  };

  const gridItem = mockedBase;
  initAndRender({
    source: gridItem.source,
    argsString: gridItem.args_string,
    metadataString: gridItem.metadata_string,
    showFullscreen: false,
  });

  const spinner = screen.getByTestId('Loading...');
  expect(spinner).toBeInTheDocument();

  await sleep(10);
  const image = screen.getByAltText(gridItem.source);
  expect(image.src).toBe("https://www.cnrfc.noaa.gov/images/ensembles/PLBC1.ens_accum10day.png");
});

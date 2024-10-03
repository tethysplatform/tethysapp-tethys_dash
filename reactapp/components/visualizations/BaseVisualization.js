import PropTypes from "prop-types";
import { useEffect, useState, memo, useRef } from "react";
import FullscreenPlotModal from "components/modals/FullscreenPlot";
import Image from "components/visualizations/Image";
import Text from "components/visualizations/Text";
import VariableInput from "components/visualizations/VariableInput";
import { setVisualization } from "components/visualizations/utilities";
import { updateGridItemArgsWithVariableInputs } from "components/visualizations/utilities";
import { useVariableInputValuesContext } from "components/contexts/VariableInputsContext";
import { valuesEqual } from "components/modals/utilities";

const BaseVisualization = ({
  source,
  argsString,
  showFullscreen,
  hideFullscreen,
}) => {
  const [viz, setViz] = useState(null);
  const variableInputValues = useVariableInputValuesContext()[0];
  const gridItemArgsWithVariableInputs = useRef(0);

  useEffect(() => {
    const args = JSON.parse(argsString);
    const itemData = { source: source, args: args };
    if (source === "") {
      setViz(<div></div>);
    } else if (source === "Custom Image") {
      setViz(<Image source={args["image_source"]} />);
    } else if (source === "Text") {
      setViz(<Text textValue={args["text"]} />);
    } else if (source === "Variable Input") {
      setViz(<VariableInput args={args} onChange={(e) => e} />);
    } else {
      const updatedGridItemArgs = updateGridItemArgsWithVariableInputs(
        argsString,
        variableInputValues
      );
      if (
        !valuesEqual(
          gridItemArgsWithVariableInputs.current,
          updatedGridItemArgs
        )
      ) {
        itemData.args = updatedGridItemArgs;
        gridItemArgsWithVariableInputs.current = updatedGridItemArgs;
        setVisualization(setViz, itemData);
      }
    }
    // eslint-disable-next-line
  }, [source, argsString]);

  useEffect(() => {
    const args = JSON.parse(argsString);
    const itemData = { source: source, args: args };
    if (!["", "Custom Image", "Text", "Variable Input"].includes(source)) {
      const updatedGridItemArgs = updateGridItemArgsWithVariableInputs(
        argsString,
        variableInputValues
      );
      if (
        !valuesEqual(
          gridItemArgsWithVariableInputs.current,
          updatedGridItemArgs
        )
      ) {
        itemData.args = updatedGridItemArgs;
        gridItemArgsWithVariableInputs.current = updatedGridItemArgs;
        setVisualization(setViz, itemData);
      }
    }
    // eslint-disable-next-line
  }, [variableInputValues]);

  return (
    <>
      {viz}
      <FullscreenPlotModal
        showModal={showFullscreen}
        handleModalClose={hideFullscreen}
      >
        {viz}
      </FullscreenPlotModal>
    </>
  );
};

BaseVisualization.propTypes = {
  source: PropTypes.string,
  argsString: PropTypes.string,
  showFullscreen: PropTypes.bool,
  hideFullscreen: PropTypes.func,
};
export default memo(BaseVisualization);

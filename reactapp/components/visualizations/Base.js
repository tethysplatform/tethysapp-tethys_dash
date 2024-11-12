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
import { useEditingContext } from "components/contexts/EditingContext";

const BaseVisualization = ({
  source,
  argsString,
  metadataString,
  showFullscreen,
  hideFullscreen,
}) => {
  const [viz, setViz] = useState(null);
  const variableInputValues = useVariableInputValuesContext()[0];
  const gridItemArgsWithVariableInputs = useRef(0);
  const gridItemSource = useRef(0);
  const [refreshCount, setRefreshCount] = useState(0);
  const isEditing = useEditingContext()[0];
  const gridMetadata = JSON.parse(metadataString);
  const refreshRate = gridMetadata.refreshRate;

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
        ) ||
        !valuesEqual(gridItemSource.current, source)
      ) {
        itemData.args = updatedGridItemArgs;
        gridItemArgsWithVariableInputs.current = updatedGridItemArgs;
        gridItemSource.current = source;
        setVisualization(setViz, itemData);
      }
    }
    if (refreshRate && refreshRate > 0) {
      const interval = setInterval(
        () => {
          if (!isEditing) {
            setRefreshCount(refreshCount + 1);
            setVisualization(setViz, itemData);
          }
        },
        parseInt(refreshRate) * 1000 * 60
      );
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line
  }, [source, argsString, refreshRate]);

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
        ) &&
        Object.keys(updatedGridItemArgs).length !== 0
      ) {
        itemData.args = updatedGridItemArgs;
        gridItemArgsWithVariableInputs.current = updatedGridItemArgs;
        gridItemSource.current = source;
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
  refreshRate: PropTypes.number,
  showFullscreen: PropTypes.bool,
  hideFullscreen: PropTypes.func,
};
export default memo(BaseVisualization);

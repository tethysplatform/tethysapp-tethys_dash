import PropTypes from "prop-types";
import { useEffect, useState, memo, useRef, useContext } from "react";
import FullscreenPlotModal from "components/modals/FullscreenPlot";
import Image from "components/visualizations/Image";
import Text from "components/visualizations/Text";
import VariableInput from "components/visualizations/VariableInput";
import {
  setVisualization,
  updateGridItemArgsWithVariableInputs,
} from "components/visualizations/utilities";
import {
  EditingContext,
  VariableInputsContext,
} from "components/contexts/Contexts";
import { valuesEqual } from "components/modals/utilities";

const BaseVisualization = ({
  source,
  argsString,
  metadataString,
  showFullscreen,
  hideFullscreen,
}) => {
  const [viz, setViz] = useState(null);
  const { variableInputValues } = useContext(VariableInputsContext);
  const gridItemArgsWithVariableInputs = useRef(0);
  const gridItemSource = useRef(0);
  const [refreshCount, setRefreshCount] = useState(0);
  const { isEditing } = useContext(EditingContext);
  const gridMetadata = JSON.parse(metadataString);
  const refreshRate = gridMetadata.refreshRate;
  const visualizationRef = useRef();

  useEffect(() => {
    const args = JSON.parse(argsString);
    const itemData = { source: source, args: args };
    if (source === "") {
      setViz(<div data-testid="Source_Unknown"></div>);
    } else if (source === "Custom Image") {
      setViz(<Image source={args["image_source"]} alt="custom_image" />);
    } else if (source === "Text") {
      setViz(<Text textValue={args["text"]} />);
    } else if (source === "Variable Input") {
      setViz(<VariableInput args={args} onChange={(e) => e} />);
    } else {
      const updatedGridItemArgs = updateGridItemArgsWithVariableInputs(
        argsString,
        variableInputValues
      );
      itemData.args = updatedGridItemArgs;
      gridItemArgsWithVariableInputs.current = updatedGridItemArgs;
      gridItemSource.current = source;
      setVisualization(setViz, itemData, visualizationRef);
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
        ) &&
        Object.keys(updatedGridItemArgs).length !== 0
      ) {
        itemData.args = updatedGridItemArgs;
        gridItemArgsWithVariableInputs.current = updatedGridItemArgs;
        gridItemSource.current = source;
        setVisualization(setViz, itemData, visualizationRef);
      }
    }
    // eslint-disable-next-line
  }, [variableInputValues]);

  useEffect(() => {
    if (
      refreshRate &&
      refreshRate > 0 &&
      !["", "Text", "Variable Input"].includes(source)
    ) {
      const args = JSON.parse(argsString);
      const itemData = { source: source, args: args };
      const updatedGridItemArgs = updateGridItemArgsWithVariableInputs(
        argsString,
        variableInputValues
      );
      itemData.args = updatedGridItemArgs;
      const interval = setInterval(
        () => {
          if (!isEditing) {
            setRefreshCount(refreshCount + 1);
            setVisualization(setViz, itemData, visualizationRef);
          }
        },
        parseInt(refreshRate) * 1000 * 60
      );
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line
  }, [refreshRate, isEditing]);

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
  metadataString: PropTypes.string,
  showFullscreen: PropTypes.bool,
  hideFullscreen: PropTypes.func,
};
export default memo(BaseVisualization);

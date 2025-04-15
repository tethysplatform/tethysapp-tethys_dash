import PropTypes from "prop-types";
import { useEffect, useState, memo, useRef, useContext, Fragment } from "react";
import FullscreenPlotModal from "components/modals/FullscreenPlot";
import Image from "components/visualizations/Image";
import Text from "components/visualizations/Text";
import VariableInput from "components/visualizations/VariableInput";
import MapVisualization from "components/visualizations/Map";
import BasePlot from "components/visualizations/BasePlot";
import Card from "components/visualizations/Card";
import DataTable from "components/visualizations/DataTable";
import ModuleLoader from "components/visualizations/ModuleLoader";
import {
  getVisualization,
  updateObjectWithVariableInputs,
} from "components/visualizations/utilities";
import {
  EditingContext,
  VariableInputsContext,
} from "components/contexts/Contexts";
import { valuesEqual } from "components/modals/utilities";
import styled from "styled-components";
import Spinner from "react-bootstrap/Spinner";

const StyledSpinner = styled(Spinner)`
  margin: auto;
  display: block;
`;

const SpinnerContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  width: 100%;
`;

const StyledH2 = styled.h2`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
`;

const BaseVisualization = ({
  source,
  argsString,
  metadataString,
  showFullscreen,
  hideFullscreen,
}) => {
  const [vizType, setVizType] = useState("loader");
  const [vizData, setVizData] = useState({});
  const [viz, setViz] = useState(null);
  const { variableInputValues } = useContext(VariableInputsContext);
  const gridItemArgsWithVariableInputs = useRef(0);
  const gridItemSource = useRef(0);
  const [refreshCount, setRefreshCount] = useState(0);
  const { isEditing } = useContext(EditingContext);
  const visualizationRef = useRef();

  useEffect(() => {
    const args = JSON.parse(argsString);
    if (source === "") {
      setVizType("unknown");
    } else if (source === "Custom Image") {
      setVizType("image");
      setVizData({ source: args["image_source"], alt: "custom_image" });
    } else if (source === "Text") {
      setVizType("text");
      setVizData({ text: args.text });
    } else if (source === "Variable Input") {
      setVizType("variableInput");
      setVizData({
        variable_name: args.variable_name,
        initial_value: args.initial_value,
        variable_options_source: args.variable_options_source,
      });
    } else {
      setVariableDependentVisualizations({});
    }
    // eslint-disable-next-line
  }, [source, argsString]);

  useEffect(() => {
    if (!["", "Custom Image", "Variable Input"].includes(source)) {
      setVariableDependentVisualizations({});
    }
    // eslint-disable-next-line
  }, [variableInputValues]);

  useEffect(() => {
    const gridMetadata = JSON.parse(metadataString);
    const refreshRate = gridMetadata.refreshRate;
    if (
      refreshRate &&
      refreshRate > 0 &&
      !["", "Text", "Variable Input"].includes(source)
    ) {
      const interval = setInterval(
        () => {
          if (!isEditing) {
            setRefreshCount(refreshCount + 1);
            setVariableDependentVisualizations({ refresh: true });
          }
        },
        parseInt(refreshRate) * 1000 * 60
      );
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line
  }, [metadataString, isEditing]);

  async function setVariableDependentVisualizations({ refresh }) {
    const args = JSON.parse(argsString);

    const itemData = { source: source, args: args };
    const updatedGridItemArgs = updateObjectWithVariableInputs(
      argsString,
      variableInputValues
    );

    if (
      refresh ||
      (source && argsString === "{}") ||
      !valuesEqual(gridItemArgsWithVariableInputs.current, updatedGridItemArgs)
    ) {
      itemData.args = updatedGridItemArgs;
      gridItemArgsWithVariableInputs.current = updatedGridItemArgs;
      gridItemSource.current = source;

      if (source === "Map") {
        setVizType("map");
        setVizData({
          baseMap: updatedGridItemArgs.variable_name,
          layers: updatedGridItemArgs.initial_value,
          layerControl: updatedGridItemArgs.variable_options_source,
          viewConfig: updatedGridItemArgs.variable_options_source,
        });
      } else if (source === "Text") {
        setVizType("text");
        setVizData({ text: updatedGridItemArgs.text });
      } else {
        const { vizType, ...vizMetadata } = await getVisualization({
          itemData,
          visualizationRef,
          metadataString,
          argsString,
          variableInputValues,
        });
        setVizType(vizType);
        setVizData(vizMetadata);
      }
    }
  }

  return (
    <>
      {vizType === "loader" && (
        <SpinnerContainer>
          <StyledSpinner
            data-testid="Loading..."
            animation="border"
            variant="info"
          />
        </SpinnerContainer>
      )}
      {vizType === "unknown" && <div data-testid="Source_Unknown"></div>}
      {vizType === "image" && (
        <Image
          source={vizData.source}
          alt={vizData.alt}
          imageError={vizData.imageError}
        />
      )}
      {vizType === "text" && <Text textValue={vizData.text} />}
      {vizType === "variableInput" && (
        <VariableInput
          variable_name={vizData.variable_name}
          initial_value={vizData.initial_value}
          variable_options_source={vizData.variable_options_source}
          onChange={(e) => e}
        />
      )}
      {vizType === "variableInput" && (
        <VariableInput
          variable_name={vizData.variable_name}
          initial_value={vizData.initial_value}
          variable_options_source={vizData.variable_options_source}
          onChange={(e) => e}
        />
      )}
      {vizType === "map" && (
        <MapVisualization
          visualizationRef={visualizationRef}
          baseMap={vizData.baseMap}
          layers={vizData.layers}
          layerControl={vizData.layerControl}
          viewConfig={vizData.viewConfig}
          mapConfig={vizData.mapConfig}
        />
      )}
      {vizType === "plotly" && (
        <BasePlot
          data={vizData.data}
          layout={vizData.layout}
          config={vizData.config}
          visualizationRef={visualizationRef}
        />
      )}
      {vizType === "card" && (
        <Card
          title={vizData.title}
          description={vizData.description}
          data={vizData.data}
          visualizationRef={visualizationRef}
        />
      )}
      {vizType === "table" && (
        <DataTable
          data={vizData.data}
          title={vizData.title}
          visualizationRef={visualizationRef}
        />
      )}
      {vizType === "custom" && (
        <ModuleLoader
          url={vizData.url}
          scope={vizData.scope}
          module={vizData.module}
          props={vizData.props}
        />
      )}
      {vizType === "vizWarning" && (
        <StyledH2>
          {vizData.warnings.map((warning, index) => (
            <Fragment key={index}>
              {warning}
              <br />
            </Fragment>
          ))}
        </StyledH2>
      )}
      {vizType === "vizError" && <StyledH2>{vizData.error}</StyledH2>}

      {/* <FullscreenPlotModal
        showModal={showFullscreen}
        handleModalClose={hideFullscreen}
      >
        {viz}
      </FullscreenPlotModal> */}
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

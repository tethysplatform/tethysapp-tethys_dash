import PropTypes from "prop-types";
import { useEffect, useState, memo, useRef, useContext, Fragment } from "react";
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
  findSelectOptionByValue,
} from "components/visualizations/utilities";
import {
  AppContext,
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
  text-align: center;
`;

export const Visualization = memo(
  ({ vizRef, vizType, vizData, dataviewerViz }) => {
    switch (vizType) {
      case "unknown":
        return <div data-testid="Source_Unknown" />;
      case "image":
        return (
          <Image
            source={vizData.source}
            alt={vizData.alt}
            imageError={vizData.imageError}
            visualizationRef={vizRef}
          />
        );
      case "text":
        return <Text textValue={vizData.text} />;
      case "variableInput":
        return (
          <VariableInput
            variable_name={vizData.variable_name}
            initial_value={vizData.initial_value}
            variable_options_source={vizData.variable_options_source}
            onChange={vizData.onChange ?? (() => {})}
          />
        );
      case "map":
        return (
          <MapVisualization
            visualizationRef={vizRef}
            baseMap={vizData.baseMap}
            layers={vizData.layers}
            layerControl={vizData.layerControl}
            mapExtent={vizData.map_extent}
            mapConfig={vizData.mapConfig}
            mapDrawing={vizData.mapDrawing}
            dataviewerViz={dataviewerViz}
          />
        );
      case "plotly":
        return (
          <BasePlot
            data={vizData.data}
            layout={vizData.layout}
            config={vizData.config}
            visualizationRef={vizRef}
          />
        );
      case "card":
        return (
          <Card
            title={vizData.title}
            description={vizData.description}
            data={vizData.data}
            visualizationRef={vizRef}
          />
        );
      case "table":
        return (
          <DataTable
            data={vizData.data}
            title={vizData.title}
            subtitle={vizData.subtitle}
            visualizationRef={vizRef}
          />
        );
      case "custom":
        return (
          <ModuleLoader
            url={vizData.url}
            scope={vizData.scope}
            module={vizData.module}
            props={vizData.props}
          />
        );
      case "vizWarning":
        return (
          <StyledH2>
            {vizData.warnings.map((warning, index) => (
              <Fragment key={index}>
                {warning}
                <br />
              </Fragment>
            ))}
          </StyledH2>
        );
      case "vizError":
        return <StyledH2>{vizData.error}</StyledH2>;
      default:
        return (
          <SpinnerContainer>
            <StyledSpinner
              data-testid="Loading..."
              animation="border"
              variant="info"
            />
          </SpinnerContainer>
        );
    }
  }
);

const BaseVisualization = ({ source, argsString, metadataString }) => {
  const [vizType, setVizType] = useState("loader");
  const [vizData, setVizData] = useState({});
  const { visualizations } = useContext(AppContext);
  const { variableInputValues } = useContext(VariableInputsContext);
  const gridItemArgsWithVariableInputs = useRef(0);
  const gridItemSource = useRef(0);
  const [refreshCount, setRefreshCount] = useState(0);
  const { isEditing } = useContext(EditingContext);
  const dashboardVizRef = useRef();

  useEffect(() => {
    const args = JSON.parse(argsString);
    if (source === "") {
      setVizType("unknown");
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
    if (!["", "Variable Input"].includes(source)) {
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
    const sourceType = findSelectOptionByValue(
      visualizations,
      source,
      "source"
    )?.type;

    const itemData = { source: source, args: args };
    const updatedGridItemArgs = updateObjectWithVariableInputs(
      args,
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
          baseMap: updatedGridItemArgs.baseMap,
          layers: updatedGridItemArgs.layers,
          layerControl: updatedGridItemArgs.layerControl,
          map_extent: updatedGridItemArgs.map_extent,
          mapConfig: updatedGridItemArgs.mapConfig,
          mapDrawing: updatedGridItemArgs.mapDrawing,
        });
      } else if (source === "Text") {
        setVizType("text");
        setVizData({ text: updatedGridItemArgs.text });
      } else if (source === "Custom Image") {
        setVizType("image");
        setVizData({
          source: updatedGridItemArgs.image_source,
          alt: "custom_image",
        });
      } else {
        await getVisualization({
          setVizType,
          setVizData,
          sourceType,
          itemData,
          metadataString,
          argsString,
          variableInputValues,
          dashboardView: true,
        });
      }
    }
  }

  return (
    <Visualization
      vizRef={dashboardVizRef}
      vizType={vizType}
      vizData={vizData}
    />
  );
};

BaseVisualization.propTypes = {
  source: PropTypes.string,
  argsString: PropTypes.string,
  metadataString: PropTypes.string,
};

Visualization.propTypes = {
  vizRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
  vizType: PropTypes.string, // determines the type of visualization to be displayed
  vizData: PropTypes.object, // contains information for the various visualization args
  dataviewerViz: PropTypes.bool, // determines if the visualization is in the dataviewer
};

export default memo(BaseVisualization);
Visualization.displayName = "Visualization";

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
  getDependentVariableInputs,
} from "components/visualizations/utilities";
import {
  AppContext,
  EditingContext,
  VariableInputsContext,
  GridItemContext,
} from "components/contexts/Contexts";
import { valuesEqual } from "components/modals/utilities";
import styled from "styled-components";
import Spinner from "react-bootstrap/Spinner";
import { addVerticalLine } from "components/visualizations/BasePlot";
import { WebsocketContext } from "components/contexts/WebSocketContext";
import ProgressBar from "react-bootstrap/ProgressBar";
import LiveChat from "components/visualizations/LiveChat";

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
  word-wrap: break-word;
  word-break: break-word;
  white-space: pre-wrap;
  overflow: auto;
  padding: 1rem;
`;

const CenteredContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 100%;
  width: 100%;
`;

export const Visualization = memo(
  ({ vizRef, vizType, vizData, progressMessage, dataviewerViz }) => {
    if (progressMessage && vizType === "loader") {
      const msgObj = JSON.parse(progressMessage);
      const { message, step, totalSteps } = msgObj;
      const percent =
        step && totalSteps ? Math.round((step / totalSteps) * 100) : null;

      return (
        <CenteredContainer>
          <StyledH2>{message}</StyledH2>
          {percent !== null && (
            <ProgressBar
              now={percent}
              label={`${step} / ${totalSteps} (${percent}%)`}
              style={{ margin: "0 auto", width: "60%" }}
            />
          )}
          <SpinnerContainer>
            <StyledSpinner
              data-testid="Progress Message Loading..."
              animation="border"
              variant="info"
            />
          </SpinnerContainer>
        </CenteredContainer>
      );
    }

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
            metadata={vizData.metadata}
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
      case "liveChat":
        return (
          <LiveChat
            requestId={vizData.requestId}
            chatHistory={vizData.chatHistory}
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
  },
);

// Helper function to check if a value is a relative date
const isRelativeDate = (val) => {
  return typeof val === "string" && /^now([+-]\d+[YMWDHmS])*$/.test(val);
};

export function toLocalISO(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    "-" +
    pad(d.getMonth() + 1) +
    "-" +
    pad(d.getDate()) +
    "T" +
    pad(d.getHours()) +
    ":" +
    pad(d.getMinutes()) +
    ":" +
    pad(d.getSeconds()) +
    (d.getTimezoneOffset() > 0 ? "-" : "+") +
    pad(Math.abs(d.getTimezoneOffset() / 60)) +
    ":" +
    pad(Math.abs(d.getTimezoneOffset() % 60))
  );
}

// Helper function to convert Date objects to UTC strings recursively
const convertDates = (obj) => {
  if (obj instanceof Date) {
    return toLocalISO(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(convertDates);
  }

  if (obj !== null && typeof obj === "object") {
    const converted = {};
    for (const [key, value] of Object.entries(obj)) {
      converted[key] = convertDates(value);
    }
    return converted;
  }

  return obj;
};

// Helper function to compare only the keys that exist in filteredOriginalArgs
export const compareFilteredArgs = (
  currentArgs,
  updatedArgs,
  keysToCompare,
) => {
  const filteredCurrent = {};
  const filteredUpdated = {};

  for (const key of Object.keys(keysToCompare)) {
    if (currentArgs && currentArgs[key] !== undefined) {
      filteredCurrent[key] = currentArgs[key];
    }
    if (updatedArgs && updatedArgs[key] !== undefined) {
      filteredUpdated[key] = updatedArgs[key];
    }
  }

  return valuesEqual(filteredCurrent, filteredUpdated);
};

// Filter function to exclude date/date-hour types and relative dates
const filterNonRelativeDateArgs = (args, variableInputs, types) => {
  const filtered = {};
  for (const [key, value] of Object.entries(args)) {
    const argType = types?.[key];
    const dependentVariableInputs = getDependentVariableInputs(value);

    let validFilter = true;
    for (const input of dependentVariableInputs) {
      // Skip if the argument type is date or date-hour and the value is a relative date
      const variableInput = variableInputs?.[input];
      if (
        (argType === "date" || argType === "date-hour") &&
        isRelativeDate(variableInput)
      ) {
        validFilter = false;
      }
    }

    if (validFilter) {
      filtered[key] = value;
    }
  }
  return filtered;
};

const BaseVisualization = () => {
  const {
    gridItemSource,
    gridItemArgsString,
    gridItemMetadataString,
    gridItemUUID,
    shouldLoad,
  } = useContext(GridItemContext);
  const [vizType, setVizType] = useState("loader");
  const [vizData, setVizData] = useState({});
  const { visualizations } = useContext(AppContext);
  const { variableInputValues } = useContext(VariableInputsContext);
  const gridItemArgsWithVariableInputs = useRef(0);
  const gridItemMetadataWithVariableInputs = useRef(0);
  const customMessages = useRef({});
  const [refreshCount, setRefreshCount] = useState(0);
  const { isEditing } = useContext(EditingContext);
  const dashboardVizRef = useRef();
  const { getMessageForRequest } = useContext(WebsocketContext);
  const requestId = useRef(gridItemUUID);
  // Ref to track if we've already loaded for this source with empty args
  const loadedEmptyArgsForSource = useRef({});

  useEffect(() => {
    const args = JSON.parse(gridItemArgsString);
    if (gridItemSource === "") {
      setVizType("unknown");
    } else if (gridItemSource === "Variable Input") {
      setVizType("variableInput");
      setVizData({
        variable_name: args.variable_name,
        initial_value: args.initial_value,
        variable_options_source: args.variable_options_source,
        metadata: args["variable_options_source.metadata"],
      });
    } else {
      setVariableDependentVisualizations({});
    }
    // eslint-disable-next-line
  }, [gridItemSource, gridItemArgsString, gridItemMetadataString]);

  useEffect(() => {
    if (!["", "Variable Input"].includes(gridItemSource)) {
      setVariableDependentVisualizations({});
    }
    // eslint-disable-next-line
  }, [variableInputValues, shouldLoad]);

  useEffect(() => {
    const gridMetadata = JSON.parse(gridItemMetadataString);
    const refreshRate = gridMetadata.refreshRate;
    if (
      refreshRate &&
      refreshRate > 0 &&
      !["", "Text", "Variable Input"].includes(gridItemSource)
    ) {
      const interval = setInterval(
        () => {
          if (!isEditing) {
            setRefreshCount(refreshCount + 1);
            setVariableDependentVisualizations({ refresh: true });
          }
        },
        parseInt(refreshRate) * 1000 * 60,
      );
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line
  }, [gridItemMetadataString, isEditing]);

  async function setVariableDependentVisualizations({ refresh }) {
    const originalArgs = JSON.parse(gridItemArgsString);
    const args = JSON.parse(gridItemArgsString);
    const gridMetadata = JSON.parse(gridItemMetadataString);
    const visualization = findSelectOptionByValue(
      visualizations,
      gridItemSource,
      "source",
    );
    const sourceType = visualization?.type;
    const argTypes = visualization?.args;

    const itemData = { source: gridItemSource, args: args };
    const updatedGridItemArgs = convertDates(
      updateObjectWithVariableInputs(args, variableInputValues, argTypes),
    );

    const updatedGridItemMetadata = updateObjectWithVariableInputs(
      gridMetadata,
      variableInputValues,
      argTypes,
    );
    const customMessaging = gridMetadata.customMessaging;

    const filteredOriginalArgs = filterNonRelativeDateArgs(
      originalArgs,
      variableInputValues,
      argTypes,
    );

    // Only allow the empty args load to run once per source unless refresh is true
    const isEmptyArgs = gridItemSource && Object.keys(args).length === 0;
    const alreadyLoadedEmptyArgs =
      loadedEmptyArgsForSource.current[gridItemSource];

    if (
      (refresh ||
        (isEmptyArgs && !alreadyLoadedEmptyArgs) ||
        (!isEmptyArgs &&
          (!compareFilteredArgs(
            gridItemArgsWithVariableInputs.current,
            updatedGridItemArgs,
            filteredOriginalArgs,
          ) ||
            !valuesEqual(customMessages.current, customMessaging)))) &&
      shouldLoad
    ) {
      if (isEmptyArgs) {
        loadedEmptyArgsForSource.current[gridItemSource] = true;
      }
      itemData.args = updatedGridItemArgs;
      itemData.requestId = requestId.current;
      gridItemArgsWithVariableInputs.current = updatedGridItemArgs;
      customMessages.current = customMessaging;

      await getVisualization({
        setVizType,
        setVizData,
        sourceType,
        itemData,
        argsString: gridItemArgsString,
        metadataString: gridItemMetadataString,
        variableInputValues,
        dashboardView: true,
        vizLoadingIcon: findSelectOptionByValue(
          visualizations,
          gridItemSource,
          "source",
        )?.loading_icon,
      });
    }

    if (
      !valuesEqual(
        gridItemMetadataWithVariableInputs.current,
        updatedGridItemMetadata,
      )
    ) {
      gridItemMetadataWithVariableInputs.current = updatedGridItemMetadata;

      const sourceType = findSelectOptionByValue(
        visualizations,
        gridItemSource,
        "source",
      )?.type;

      if (
        sourceType === "plotly" &&
        updatedGridItemMetadata?.plotlyVerticalLine
      ) {
        let verticalLineValue =
          updatedGridItemMetadata?.plotlyVerticalLine?.value;
        const verticalLineColor =
          updatedGridItemMetadata?.plotlyVerticalLine?.color;
        const verticalLineWidth =
          updatedGridItemMetadata?.plotlyVerticalLine?.width;
        const verticalLineDash =
          updatedGridItemMetadata?.plotlyVerticalLine?.dash;

        addVerticalLine(dashboardVizRef, verticalLineValue, {
          color: verticalLineColor,
          width: verticalLineWidth,
          dash: verticalLineDash,
        });
      }
    }
  }

  return (
    <Visualization
      vizRef={dashboardVizRef}
      vizType={vizType}
      vizData={vizData}
      progressMessage={getMessageForRequest(requestId.current)}
    />
  );
};

Visualization.propTypes = {
  vizRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
  vizType: PropTypes.string, // determines the type of visualization to be displayed
  vizData: PropTypes.object, // contains information for the various visualization args
  dataviewerViz: PropTypes.bool, // determines if the visualization is in the dataviewer
  progressMessage: PropTypes.string, // stringified object that contains message, step, and totalSteps
};

// Custom comparison function for BaseVisualization
const areBasePropsEqual = (prevProps, nextProps) => {
  // Only rerender if the actual props that affect visualization change
  return (
    valuesEqual(prevProps.source, nextProps.source) &&
    valuesEqual(prevProps.argsString, nextProps.argsString) &&
    valuesEqual(prevProps.metadataString, nextProps.metadataString) &&
    valuesEqual(prevProps.shouldLoad, nextProps.shouldLoad) &&
    valuesEqual(prevProps.uuid, nextProps.uuid)
  );
};

export default memo(BaseVisualization, areBasePropsEqual);
Visualization.displayName = "Visualization";

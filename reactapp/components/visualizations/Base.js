import PropTypes from "prop-types";
import { useEffect, useState, memo, useRef, useContext, Fragment } from "react";
import Image from "components/visualizations/Image";
import ImageSequence from "components/visualizations/ImageSequence";
import ImageCollection from "components/visualizations/ImageCollection";
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
  findUnresolvedFeatureTokens,
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

const FeaturePendingShell = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
  width: 100%;
  padding: 1rem;
  text-align: center;
  color: #495057;
  background: repeating-linear-gradient(
    45deg,
    #f8f9fa,
    #f8f9fa 10px,
    #f1f3f5 10px,
    #f1f3f5 20px
  );
  border-radius: 4px;
`;

const FeaturePendingTitle = styled.div`
  font-weight: 600;
  font-size: 0.95rem;
  margin-bottom: 0.25rem;
`;

const FeaturePendingHint = styled.div`
  font-size: 0.8rem;
  color: #6c757d;
  word-break: break-word;
`;

export const Visualization = memo(
  ({
    vizRef,
    vizType,
    vizData,
    vizMetadata,
    progressMessage,
    dataviewerViz,
    refreshCount,
  }) => {
    if (progressMessage && vizType === "loader") {
      const msgObj = JSON.parse(progressMessage);
      const { message, percentageComplete } = msgObj;
      const percent =
        percentageComplete !== undefined
          ? Math.round(percentageComplete)
          : null;

      return (
        <CenteredContainer>
          <StyledH2>{message}</StyledH2>
          {percent !== null && (
            <ProgressBar
              now={percent}
              label={`${percentageComplete}%`}
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
      case "imageSequence":
        return (
          <ImageSequence
            urls={vizData.urls}
            activeUrl={vizData.activeUrl}
            alt={vizData.alt}
            imageError={vizData.imageError}
            visualizationRef={vizRef}
          />
        );
      case "imageCollection":
        return (
          <ImageCollection
            urls={vizData.urls}
            title={vizData.title}
            columns={vizData.columns}
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
            show_label={vizData.show_label}
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
            refreshCount={refreshCount}
          />
        );
      case "plotly":
        return (
          <BasePlot
            data={vizData.data}
            layout={vizData.layout}
            config={vizData.config}
            visualizationRef={vizRef}
            metadata={vizMetadata}
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
            remoteType={vizData.remoteType}
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
      case "featurePending":
        return (
          <FeaturePendingShell data-testid="feature-pending-tile">
            <FeaturePendingTitle>
              Awaiting feature selection
            </FeaturePendingTitle>
            <FeaturePendingHint>
              {vizData.source ? `${vizData.source} renders ` : "Renders "}
              when a feature is clicked on the map
              {vizData.pendingTokens && vizData.pendingTokens.length > 0
                ? ` (resolves \${${vizData.pendingTokens.join("}, ${")}}).`
                : "."}
            </FeaturePendingHint>
          </FeaturePendingShell>
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
  const [vizMetadata, setVizMetadata] = useState({});
  const { visualizations } = useContext(AppContext);
  const {
    variableInputValues,
    variableInputDateFormats,
    variableInputSliderMeta,
  } = useContext(VariableInputsContext);
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
        show_label: args.show_label,
        variable_options_source: args.variable_options_source,
        metadata: args["variable_options_source.metadata"],
      });
    } else {
      setVariableDependentVisualizations({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridItemSource, gridItemArgsString, gridItemMetadataString]);

  useEffect(() => {
    if (!["", "Variable Input"].includes(gridItemSource)) {
      setVariableDependentVisualizations({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            setRefreshCount((prev) => prev + 1);
            setVariableDependentVisualizations({ refresh: true });
          }
        },
        parseInt(refreshRate) * 1000 * 60,
      );
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridItemMetadataString, isEditing, shouldLoad]);

  async function setVariableDependentVisualizations({ refresh }) {
    const args = JSON.parse(gridItemArgsString);
    const gridMetadata = JSON.parse(gridItemMetadataString);
    const visualization = findSelectOptionByValue(
      visualizations,
      gridItemSource,
      "source",
    );
    const sourceType = visualization?.type;
    const sourceArgs = visualization?.args;

    const itemData = { source: gridItemSource, args: args };
    const updatedGridItemArgs = updateObjectWithVariableInputs({
      args,
      variableInputs: variableInputValues,
      variableInputDateFormats,
    });

    const updatedGridItemMetadata = updateObjectWithVariableInputs({
      args: gridMetadata,
      variableInputs: variableInputValues,
      variableInputDateFormats,
    });
    const customMessaging = gridMetadata.customMessaging;

    // Only allow the empty args load to run once per source unless refresh is true
    const isEmptyArgs = gridItemSource && Object.keys(args).length === 0;
    const alreadyLoadedEmptyArgs =
      loadedEmptyArgsForSource.current[gridItemSource];

    // ImageSequence fast-path: when only a slider variable changed,
    // just update activeUrl instead of regenerating the full URL list.
    if (
      vizType === "imageSequence" &&
      gridItemSource === "Custom Image" &&
      !refresh &&
      shouldLoad
    ) {
      const newActiveUrl = updatedGridItemArgs.image_source;
      if (newActiveUrl && newActiveUrl !== vizData.activeUrl) {
        gridItemArgsWithVariableInputs.current = updatedGridItemArgs;
        setVizData((prev) => ({ ...prev, activeUrl: newActiveUrl }));
      }
      // Still check if non-slider args changed (e.g. a dropdown variable in the URL).
      // If urls need regeneration, fall through to the full getVisualization below.
      const prevUrls = vizData.urls;
      if (prevUrls && !prevUrls.includes(newActiveUrl)) {
        refresh = true;
      }
    }

    if (
      (refresh ||
        (isEmptyArgs && !alreadyLoadedEmptyArgs) ||
        (!isEmptyArgs &&
          (!valuesEqual(
            gridItemArgsWithVariableInputs.current,
            updatedGridItemArgs,
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

      // Edit-time gate: when args reference `${feature.<key>}` and no
      // feature is in scope (e.g., the popup layout editor before a
      // feature is clicked at runtime), the host substitution pass
      // preserves the raw token. Calling the plugin with a literal
      // "${feature.comid}" would error out and clutter the editor with
      // failure messages, so render a friendly placeholder instead and
      // skip the fetch. The next render that *does* have feature.* in
      // scope will resolve the tokens, the args will differ from the
      // ref above, and getVisualization will fire normally.
      const pendingFeatureTokens = findUnresolvedFeatureTokens(
        updatedGridItemArgs,
      );
      if (pendingFeatureTokens.length > 0) {
        setVizType("featurePending");
        setVizData({
          source: gridItemSource,
          pendingTokens: pendingFeatureTokens,
        });
        return;
      }

      await getVisualization({
        setVizType,
        setVizData,
        sourceType,
        sourceArgs,
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
        variableInputDateFormats,
        variableInputSliderMeta,
      });
    }

    if (
      !valuesEqual(
        gridItemMetadataWithVariableInputs.current,
        updatedGridItemMetadata,
      )
    ) {
      gridItemMetadataWithVariableInputs.current = updatedGridItemMetadata;
      setVizMetadata(updatedGridItemMetadata);
    }
  }

  return (
    <Visualization
      vizRef={dashboardVizRef}
      vizType={vizType}
      vizData={vizData}
      vizMetadata={vizMetadata}
      progressMessage={getMessageForRequest(requestId.current)}
      refreshCount={refreshCount}
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
  progressMessage: PropTypes.string, // stringified object that contains message and percentageComplete (if provided)
  vizMetadata: PropTypes.object, // contains metadata for the visualization
  // Increments each time BaseVisualization's refreshRate interval ticks.
  // Forwarded to MapVisualization so dynamic_map_layer plugins can force
  // a re-fetch even when their args are unchanged.
  refreshCount: PropTypes.number,
};

// Custom comparison function for BaseVisualization
const areBasePropsEqual = (prevProps, nextProps) => {
  // Only rerender if the actual props that affect visualization change
  return (
    valuesEqual(prevProps.source, nextProps.source) &&
    valuesEqual(prevProps.argsString, nextProps.argsString) &&
    valuesEqual(prevProps.metadataString, nextProps.metadataString) &&
    valuesEqual(prevProps.shouldLoad, nextProps.shouldLoad) &&
    valuesEqual(prevProps.uuid, nextProps.uuid) &&
    valuesEqual(prevProps.vizMetadata, nextProps.vizMetadata)
  );
};

export default memo(BaseVisualization, areBasePropsEqual);
Visualization.displayName = "Visualization";

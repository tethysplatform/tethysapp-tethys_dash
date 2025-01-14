import { memo } from "react";
import styled from "styled-components";
import {
  Map,
  View,
  Layer,
  Layers,
  Controls,
  LegendControl,
  LayersControl,
} from "backlayer";
import PropTypes from "prop-types";
import useConditionalChecks from "hooks/useConditionalChecks";

const StyledErrorDiv = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
`;

const MapVisualization = ({
  mapConfig,
  viewConfig,
  layers,
  legend,
  visualizationRef,
  customErrors,
}) => {
  const { passed, resultMessages } = useConditionalChecks(customErrors);

  const defaultMapConfig = {
    className: "ol-map",
    style: { width: "100%", height: "100%", position: "relative" },
  };
  const customMapConfig = { ...defaultMapConfig, ...mapConfig };

  const defaultViewConfig = {
    projection: "EPSG:3857",
    zoom: 4.5,
    center: [-10686671.116154263, 4721671.572580108],
  };
  const customViewConfig = { ...defaultViewConfig, ...viewConfig };

  const defaultBaseLayers = [
    {
      type: "WebGLTile",
      props: {
        source: {
          type: "ImageTile",
          props: {
            url: "https://server.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
            attributions:
              'Tiles © <a href="https://server.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer">ArcGIS</a>',
          },
        },
        name: "World Street Map",
      },
    },
  ];
  const customBaseLayers = layers ? layers : defaultBaseLayers;

  return (
    passed ? (
      <Map {...customMapConfig} ref={visualizationRef} data-testid="backlayer-map">
        <View {...customViewConfig} />
        <Layers>
          {customBaseLayers.map((config, index) => (
            <Layer key={index} config={config} />
          ))}
        </Layers>
        <Controls>
          <LayersControl />
          {legend && <LegendControl items={legend} />}
        </Controls>
      </Map>
    ) : (
      // These will only show if the useConditionalChecks hook finds any failures
      // It will then map through all of the possible errors that occured.
      resultMessages.map((message, messageIndex) => (
        <StyledErrorDiv key={messageIndex}>
          <h2>{message}</h2>
        </StyledErrorDiv>
      ))
    )
  );
};

MapVisualization.propTypes = {
  mapConfig: PropTypes.object,
  viewConfig: PropTypes.object,
  layers: PropTypes.array,
  legend: PropTypes.array,
  visualizationRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
  customErrors: PropTypes.arrayOf(
    PropTypes.shape({
      variableName: PropTypes.string,
      operator: PropTypes.string,
      comparison: PropTypes.string,
      resultMessage: PropTypes.string,
    })
  ),
};

export default memo(MapVisualization);

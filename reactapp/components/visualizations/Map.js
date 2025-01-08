import { memo } from "react";
import { Map } from "components/backlayer";
import PropTypes from "prop-types";
import { getBaseMapLayer } from "components/visualizations/utilities";

const MapVisualization = ({
  mapConfig,
  viewConfig,
  layers,
  visualizationRef,
  baseMap,
  layerControl,
}) => {
  const mapLegend = [];
  const mapLayers = [];

  for (const layer of layers) {
    if (layer.legend) {
      mapLegend.push(layer.legend);
    }
    mapLayers.push(layer.configuration);
  }

  if (baseMap) {
    const baseMapLayer = getBaseMapLayer(baseMap);
    mapLayers.splice(0, 0, baseMapLayer);
  }

  mapLayers.forEach((layer, index) => {
    layer.props.zIndex = index;
  });

  return (
    <Map
      mapConfig={mapConfig}
      viewConfig={viewConfig}
      layers={mapLayers}
      legend={mapLegend}
      layerControl={layerControl}
      ref={visualizationRef}
      data-testid="backlayer-map"
    />
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
};

export default memo(MapVisualization);

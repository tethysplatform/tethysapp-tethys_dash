import { memo } from "react";
import { Map } from "components/backlayer";
import PropTypes from "prop-types";
import { getBaseMapLayer } from "components/visualizations/utilities";

const MapVisualization = ({
  mapConfig,
  viewConfig,
  layers,
  legend,
  visualizationRef,
  baseMap,
}) => {
  if (baseMap) {
    const baseMapLayer = getBaseMapLayer(baseMap);
    layers.push(baseMapLayer);
  }

  return (
    <Map
      mapConfig={mapConfig}
      viewConfig={viewConfig}
      layers={layers}
      legend={legend}
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

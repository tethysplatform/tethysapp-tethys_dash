import { memo } from "react";
import { Map } from "components/backlayer";
import PropTypes from "prop-types";

const MapVisualization = ({
  mapConfig,
  viewConfig,
  layers,
  legend,
  visualizationRef,
}) => {
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

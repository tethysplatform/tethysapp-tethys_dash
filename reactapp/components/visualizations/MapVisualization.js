import React, {memo} from "react";
import {
    Map,
    View,
    Layer,
    Layers,
    Controls,
    LegendControl,
    LayersControl,
  } from 'backlayer';


const MapVisualization = ({ mapConfig, viewConfig,layers,legend }) => {
  return (
    <Map {...mapConfig} >
        <View {...viewConfig} />
        <Layers>
          {layers &&
          layers.map((config, index) => (
            <Layer key={index} config={config} />
          ))}
        </Layers>
        <Controls>
            <LayersControl />
            <LegendControl items={legend} />
        </Controls>
    </Map>
  );
}

export default memo(MapVisualization)




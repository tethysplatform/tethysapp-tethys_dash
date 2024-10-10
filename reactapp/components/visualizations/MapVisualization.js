import React, {memo} from "react";
import { Map } from "../../tethys-ol/providers/Map";
import Layer from "../../tethys-ol/components/layers/Layer";
import Source from "../../tethys-ol/lib/Source";
import Layers from "../../tethys-ol/components/layers/Layers";
import Controls from "../../tethys-ol/components/controls/Controls";
import { LayersControl } from "../../tethys-ol/components/controls/LayersControl";
import View from "../../tethys-ol/components/View";


const MapVisualization = ({ mapConfig, viewConfig,layers }) => {
  
  return (

    <Map {...mapConfig} >
        <View {...viewConfig} />
        <Layers>
        {layers &&
          layers.map((config, index) => {
            const {
              type: LayerType,
              props: {
                source: { type: SourceType, props: sourceProps },
                ...layerProps
              },
            } = config;

            const source = Source({ is: SourceType, ...sourceProps });

            return (
              <Layer key={index} is={LayerType} source={source} {...layerProps} />
            );
          })}
        </Layers>
        <Controls>
            <LayersControl />
        </Controls>

    </Map>
  );
}

export default memo(MapVisualization)
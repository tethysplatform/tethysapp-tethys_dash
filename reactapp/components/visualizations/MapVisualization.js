import React, {memo, useState} from "react";
import { Map } from "../../tethys-ol/providers/Map";
import Layer from "../../tethys-ol/components/layers/Layer";
import Source from "../../tethys-ol/lib/Source";
import Layers from "../../tethys-ol/components/layers/Layers";
import Controls from "../../tethys-ol/components/controls/Controls";
import { LayersControl } from "../../tethys-ol/components/controls/LayersControl";
import View from "../../tethys-ol/components/View";
import Format from "../../tethys-ol/lib/Format";
import {Style, Stroke} from "ol/style.js";

const available_styles = {
  "Polygon": new Style({
    stroke: new Stroke({
      color: 'black',
      width: 2
    })
  })
}

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

            const sourceOptions = { ...sourceProps };

            if (sourceProps.format) {
              sourceOptions.format = Format({
                is: sourceProps.format.type,
              });
            }
            if (layerProps.style) {
              layerProps.style = available_styles[layerProps.style];
            }

            const source = Source({ is: SourceType, ...sourceOptions });

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
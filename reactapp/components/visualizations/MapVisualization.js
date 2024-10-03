import React, {memo, useEffect} from "react";


import { Map } from "../../tethys-ol/providers/Map";
import Layer from "../../tethys-ol/components/layers/Layer";
import Source from "../../tethys-ol/lib/Source";
import Layers from "../../tethys-ol/components/layers/Layers";
import Overlay from "../../tethys-ol/components/overlays/Overlay";
import { fromLonLat } from "ol/proj";
import styled from 'styled-components';
import View from "../../tethys-ol/components/View";

const OverLayContentWrapper = styled.div`
  position: absolute;
  background-color: white;
  padding: 15px;
  border-radius: 10px;
  border: 1px solid #ccc;
  min-width: 200px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
  transform: translate(-50%, -100%);

  &:after,
  &:before {
    bottom: -20px;
    border: solid transparent;
    content: '';
    height: 0;
    width: 0;
    position: absolute;
    pointer-events: none;
  }

  &:after {
    border-top-color: white;
    border-width: 10px;
    left: 50%;
    margin-left: -10px;
  }

  &:before {
    border-top-color: #ccc;
    border-width: 11px;
    left: 50%;
    margin-left: -11px;
  }
`;

//Map Config
const MapConfig = {
  className: "ol-map",
  style: {
    width: "100%", 
    height: "100%"
  },
  events:{
    click: (evt)=>{
        console.log("Hola")
        // mapEvents.onClickMapEvent(evt)
    }
  }
};


// View Config
const ViewConfig = {
    center: fromLonLat([-110.875, 37.345]),
    zoom: 5
};

  
const MapVisualization = ({ viewConfig,layers }) => {

  useEffect(() => {
    console.log(layers)
    if (!layers) return;
    console.log(layers)
    return () => {
      console.log("unmount visualization")
    }
  }, [])
  return (

    <Map {...MapConfig} >
        <View {...viewConfig} />
        <Layers>
            {layers && layers.map((config, index) => {
                const { type: LayerType, props: { source: { type: SourceType, props: sourceProps }, ...layerProps } } = config;
                const source = Source({ is: SourceType, ...sourceProps });
                return (
                    <Layer 
                        key={index} 
                        is={LayerType}
                        source={source}
                        {...layerProps}
                    />
                );
            })}
        </Layers>
    </Map>
  );
}

export default memo(MapVisualization)

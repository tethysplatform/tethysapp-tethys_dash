import React, {memo, useState} from "react";
import { useVariableInputValuesContext } from "components/contexts/VariableInputsContext";
import { Map } from "../../tethys-ol/providers/Map";
import Layer from "../../tethys-ol/components/layers/Layer";
import Source from "../../tethys-ol/lib/Source";
import Layers from "../../tethys-ol/components/layers/Layers";
import Controls from "../../tethys-ol/components/controls/Controls";
import { LayersControl } from "../../tethys-ol/components/controls/LayersControl";
import Overlay from "../../tethys-ol/components/overlays/Overlay";
import { fromLonLat } from "ol/proj";
import styled from 'styled-components';
import View from "../../tethys-ol/components/View";
import MapEvents from "./mapEvents";

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





const mapEvents = new MapEvents();
  
const MapVisualization = ({ viewConfig,layers }) => {
  const [variableInputValues, setVariableInputValues] = useVariableInputValuesContext();
  const [layersList, setLayers] = useState(layers);
  const [view, setView] = useState(viewConfig);


  const removeItemsWithNameContaining = (substring) => {
    setLayers((prevLayers) =>
      prevLayers.filter((item) => {
        if (item.props && item.props.name && typeof item.props.name === 'string') {
          return !item.props.name.includes(substring);
        }
        return true;
      })
    );
  };

  const MapConfig = {
    className: "ol-map",
    style: {
      width: "100%", 
      height: "100%"
    },
    events:{
      click: async (evt)=>{
          // set center to clicked point
          setView({
            center: evt.coordinate,
            zoom: evt.map.getView().getZoom(),
            duration: 10,
          })
          // remove any previous selection layers
          removeItemsWithNameContaining('_huc_vector_selection')
          let response = await mapEvents.onClickMapEvent(evt);
          if (!response) return;
          if(response.hasOwnProperty('layer')){
            setLayers((prevState) => {
              return [...prevState, response.layer]
            })
          }
          if (response.hasOwnProperty('hucid')){
            setVariableInputValues((prevState) => ({
              ...prevState,
              HUC: `${response.hucid}`,
            }));
          }
          if (response.hasOwnProperty('id')){
            console.log(variableInputValues)
            setVariableInputValues((prevState) => ({
              ...prevState,
              ID: `${response.id}`,
            }));
          }
      }
    }
  };
  
  
  return (

    <Map {...MapConfig} >
        <View {...view} />
        <Layers>
            {layersList && layersList.map((config, index) => {
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
        <Controls>
            <LayersControl />
        </Controls>
    </Map>
  );
}

export default memo(MapVisualization)

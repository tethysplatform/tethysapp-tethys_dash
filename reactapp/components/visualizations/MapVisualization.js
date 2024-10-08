import React, {Fragment, memo, useState} from "react";
import { useVariableInputValuesContext } from "components/contexts/VariableInputsContext";
import { Map } from "../../tethys-ol/providers/Map";
import Layer from "../../tethys-ol/components/layers/Layer";
import Source from "../../tethys-ol/lib/Source";
import Layers from "../../tethys-ol/components/layers/Layers";
import Controls from "../../tethys-ol/components/controls/Controls";
import { LayersControl } from "../../tethys-ol/components/controls/LayersControl";
import View from "../../tethys-ol/components/View";
import MapEvents from "./mapEvents";
import Format from "../../tethys-ol/lib/Format";

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
          removeItemsWithNameContaining('huc_vector_selection')
          // removeItemsWithNameContaining('_huc_vector_selection')
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
        {layersList &&
          layersList.map((config, index) => {
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


// future 
// import Overlay from "../../tethys-ol/components/overlays/Overlay";
// import Overlays from "../../tethys-ol/components/overlays/Overlays";
// <Overlays>
//     <Overlay
//       id="metadata"
//       autoPan= {{
//         animation: {
//           duration: 250,
//         }
//       }}
//       content={
//         <Fragment>
//           <div id="metadata"></div>
//         </Fragment>

//       }
//     />
// </Overlays> 
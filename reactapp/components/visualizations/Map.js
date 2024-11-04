import React, { memo } from "react";
import {
  Map,
  View,
  Layer,
  Layers,
  Controls,
  LegendControl,
  LayersControl,
} from "backlayer";

const MapVisualization = ({ mapConfig, viewConfig, layers, legend }) => {
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
    <Map {...customMapConfig}>
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
  );
};

export default memo(MapVisualization);

import { memo } from "react";
import { Map } from "components/backlayer";
import PropTypes from "prop-types";
import { getBaseMapLayer } from "components/visualizations/utilities";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { LineString } from "ol/geom";
import { Stroke, Style } from "ol/style";
import Icon from "ol/style/Icon";

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

  function onMapClick(map, evt) {
    let markerLayer, streamLayer, riverId;
    const markPath = `
        M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9
        c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z
      `;
    const svgIcon = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="40" height="40">
          <path d="${markPath}" fill="#007bff" stroke="white" stroke-width="1"/>
        </svg>
      `;
    const svgURI = "data:image/svg+xml;base64," + btoa(svgIcon);
    const coordinate = evt.coordinate;
    const url =
      "https://livefeeds3.arcgis.com/arcgis/rest/services/GEOGLOWS/GlobalWaterModel_Medium/MapServer/identify";
    if (markerLayer) {
      map.removeLayer(markerLayer);
    }
    const marker = new Feature({
      type: "marker",
      geometry: new Point(coordinate),
    });
    marker.setStyle(
      new Style({
        image: new Icon({
          src: svgURI,
          anchor: [0.5, 1], // Align the bottom-center of the icon to the point
        }),
      })
    );
    markerLayer = new VectorLayer({
      source: new VectorSource({
        features: [marker],
      }),
      zIndex: 4,
      name: "Stream Marker",
    });
    map.addLayer(markerLayer);

    // Build the identify request parameters
    const params = new URLSearchParams({
      f: "json",
      tolerance: 50, // Pixel tolerance
      returnGeometry: true,
      geometryType: "esriGeometryPoint",
      sr: 3857,
      geometry: coordinate.join(","),
      mapExtent: map.getView().calculateExtent().join(","),
      imageDisplay: "800,600,96",
    });

    fetch(`${url}?${params.toString()}`)
      .then((response) => response.json())
      .then((data) => {
        if (data.results && data.results.length > 0) {
          if (streamLayer) {
            map.removeLayer(streamLayer);
          }
          riverId = data.results[0].attributes["TDX Hydro Link Number"];
          console.log(riverId);
          const features = data.results[0].geometry.paths.map((path) => {
            return new Feature({
              geometry: new LineString(path),
              name: "Polyline",
            });
          });
          streamLayer = new VectorLayer({
            source: new VectorSource({
              features: features,
            }),
            style: new Style({
              stroke: new Stroke({
                color: "#00008b",
                width: 3,
              }),
            }),
            zIndex: 3,
            name: "Stream Segment",
          });
          map.addLayer(streamLayer);

          updateVariableInputValues({ "River ID": riverId });
        } else {
          map.removeLayer(markerLayer);
          alert(
            "River not found. Try to zoom in and be precise when clicking the map."
          );
        }
      })
      .catch((error) => {
        console.error("Identify request failed:", error);
      });
  }

  return (
    <Map
      mapConfig={mapConfig}
      viewConfig={viewConfig}
      layers={mapLayers}
      legend={mapLegend}
      layerControl={layerControl}
      onMapClick={onMapClick}
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

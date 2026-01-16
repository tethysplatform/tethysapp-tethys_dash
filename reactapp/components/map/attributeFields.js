// Extracted logic for getting available attribute fields from sourceProps, layerProps, attributeProps
export function getAvailableAttributeFields({
  sourceProps,
  layerProps,
  attributeProps,
}) {
  // make sure a valid json is supplied if the source is GeoJSON
  let fields = [];
  if (
    sourceProps.type === "GeoJSON" &&
    sourceProps.geojson &&
    sourceProps.geojson.trim().startsWith("{")
  ) {
    try {
      const geojson = JSON.parse(sourceProps.geojson);
      if (geojson.features && geojson.features.length > 0) {
        fields = Object.keys(geojson.features[0].properties || {});
      }
    } catch (err) {
      // ignore parse error, no fields
    }
  }
  // For other types, try to use attributeProps if available
  if (fields.length === 0 && attributeProps && attributeProps.variables) {
    fields = Object.keys(attributeProps.variables);
  }
  // Fallback to layerProps.name if nothing else
  if (fields.length === 0 && layerProps && layerProps.name) {
    fields = [layerProps.name];
  }
  return fields;
}
